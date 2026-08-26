/**
 * Real-time sync client (Socket.io) — BCC Riders Club
 * ==================================================
 *
 * Replaces the old "refresh the page / switch tabs / wait for a `storage` event" model with a
 * push channel. The server watches MongoDB with change streams (see `server.ts`) and emits:
 *
 *   db:ready   -> handshake completed. Sent on first connect AND on every reconnect, so we treat
 *                 it as "you may have missed writes while you were away — resync everything".
 *   db:change  -> one insert/update/replace/delete landed in a watched collection.
 *   db:resync  -> the server lost its place in the oplog (or a collection was dropped). Refetch all.
 *
 * On a `db:change` we pull the affected collection back through `safeFetchJson`, which repopulates
 * the API cache and the session mirrors that `store.getFinanceRecords()` and friends read from, then
 * re-emit the app's existing `bcc_*_updated` events. Every already-mounted component listens to
 * those, so screens update live without any component-level socket plumbing.
 *
 * localStorage is still written on the way through, but purely as an offline cache for the next cold
 * start. It is no longer the cross-device sync mechanism, and no `storage` event is required for two
 * devices to agree.
 */

import { io, Socket } from 'socket.io-client';
import { safeFetchJson, store } from './db';
import { getAuthToken } from './storageSecurity';

// ==========================================
// Types
// ==========================================

export type RealtimeStatus =
  | 'idle'          // never connected in this session
  | 'connecting'    // first handshake in flight
  | 'connected'     // live push channel
  | 'reconnecting'  // dropped, retrying with backoff
  | 'offline';      // gave up / browser reports no network

export type RealtimeMode = 'database' | 'collection' | 'disabled' | 'unknown';

export interface RealtimeChangePayload {
  collection: string;
  operationType: 'insert' | 'update' | 'replace' | 'delete' | string;
  documentId: string | null;
  mongoId: string | null;
  at: string;
  source: 'change-stream' | 'rest-fallback';
  document?: Record<string, unknown>;
}

export interface RealtimeReadyPayload {
  authenticated: boolean;
  mode: RealtimeMode;
  collections: string[];
  signalOnlyCollections: string[];
  serverStartedAt: string | null;
  recovered: boolean;
  at: string;
}

export interface RealtimeSnapshot {
  status: RealtimeStatus;
  /** Which change-stream strategy the server ended up using. */
  mode: RealtimeMode;
  /** True when the socket handshake carried a valid session token. */
  authenticated: boolean;
  connectedAt: string | null;
  lastChangeAt: string | null;
  lastError: string | null;
  reconnectAttempts: number;
  transport: string | null;
}

/** Window event the UI listens to for the connection pill. */
export const REALTIME_STATUS_EVENT = 'bcc_realtime_status';

// `vite/client` types aren't referenced by this project's tsconfig, so read the Vite env through a
// narrow cast instead of pulling extra global declarations into the build.
const viteEnv: { DEV?: boolean; VITE_REALTIME_URL?: string } =
  (import.meta as unknown as { env?: Record<string, any> }).env || {};

// ==========================================
// Connection tuning (point 5 — Render free tier + general resilience)
// ==========================================
//
// Render's free tier drops idle instances, deploys restart the process, and mobile riders bounce
// between cell and wifi. All three look identical to the client: the socket dies. So retry forever
// with exponential backoff + jitter rather than a fixed attempt budget — a rider who leaves the app
// open overnight should still be live in the morning without a manual refresh.

const RECONNECTION_DELAY = 1000;        // first retry after ~1s
const RECONNECTION_DELAY_MAX = 15000;   // cap backoff at 15s (Render cold start is ~30-50s)
const RECONNECTION_ATTEMPTS = Infinity; // never permanently give up while the tab is open
const RANDOMIZATION_FACTOR = 0.5;       // jitter, so a redeploy doesn't stampede every client at once
const HANDSHAKE_TIMEOUT = 20000;        // generous: a cold Render dyno can take a while to answer

/** Coalescing window — a bulk write loop fires many change events for one collection. */
const CHANGE_DEBOUNCE_MS = 180;
const RESYNC_DEBOUNCE_MS = 300;

// ==========================================
// Module state (singleton — one socket per tab)
// ==========================================

let socket: Socket | null = null;
let detachEvents: (() => void) | null = null;
let lastHandshakeToken: string | null = null;

const snapshot: RealtimeSnapshot = {
  status: 'idle',
  mode: 'unknown',
  authenticated: false,
  connectedAt: null,
  lastChangeAt: null,
  lastError: null,
  reconnectAttempts: 0,
  transport: null,
};

const statusListeners = new Set<(snap: RealtimeSnapshot) => void>();

function emitStatus(patch: Partial<RealtimeSnapshot>): void {
  Object.assign(snapshot, patch);
  const frozen: RealtimeSnapshot = { ...snapshot };
  statusListeners.forEach((listener) => {
    try {
      listener(frozen);
    } catch (err) {
      console.warn('[Realtime] status listener error:', err);
    }
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(REALTIME_STATUS_EVENT, { detail: frozen }));
  }
}

export function getRealtimeSnapshot(): RealtimeSnapshot {
  return { ...snapshot };
}

export function subscribeRealtimeStatus(listener: (snap: RealtimeSnapshot) => void): () => void {
  statusListeners.add(listener);
  listener({ ...snapshot });
  return () => statusListeners.delete(listener);
}

// ==========================================
// Collection -> app-state refresh map
// ==========================================
//
// The existing `bcc_*_updated` custom events are the app's state bus; every screen already
// subscribes to the ones it cares about. We refetch first where a component reads through the
// cache (finance, users, settings) and dispatch bare events where the listener refetches itself
// (activities, attendance) — that keeps the request count per change at a minimum.

function dispatchAppEvent(name: string, detail?: unknown): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

/**
 * Expenses live in two mirrored collections. `Finances.tsx` prefers `liquidationLogs` and falls
 * back to `expenseLogs`, so refresh in the same order to avoid the mirror clobbering the cache.
 */
async function refreshExpenses(): Promise<void> {
  const liquidation = await safeFetchJson('/api/mongodb/liquidationLogs');
  const rows = Array.isArray(liquidation.data) ? liquidation.data : [];
  if (!liquidation.success || rows.length === 0) {
    await safeFetchJson('/api/mongodb/expenseLogs');
  }
  dispatchAppEvent('bcc_finance_updated');
}

const COLLECTION_HANDLERS: Record<string, () => Promise<void>> = {
  // Riders + pending applications -> merged user list (dispatches bcc_users_updated internally).
  members: async () => {
    await store.refreshUsersFromServer();
  },
  registration: async () => {
    await store.refreshUsersFromServer();
  },

  // Money. Refetch before dispatching: RiderProfile/Dashboard read via store/cache.
  financeLogs: async () => {
    await safeFetchJson('/api/mongodb/financeLogs');
    dispatchAppEvent('bcc_finance_updated');
  },
  liquidationLogs: refreshExpenses,
  expenseLogs: refreshExpenses,
  financeArchives: async () => {
    await store.refreshFinanceArchivesFromServer();
    dispatchAppEvent('bcc_finance_updated');
  },
  treasurerRequests: async () => {
    await store.refreshTreasurerRequestsFromServer();
    dispatchAppEvent('bcc_finance_updated');
  },
  payments: async () => {
    dispatchAppEvent('bcc_finance_updated');
  },

  // Fees, monthly dues, dynamic collections and security flags all live in `settings`.
  settings: async () => {
    await store.refreshSettingsFromServer();
    dispatchAppEvent('bcc_finance_updated');
  },

  // Announcements.
  updates: async () => {
    await store.refreshAnnouncementsFromServer();
  },

  // Rides + attendance. ActivityLog/QRScan refetch themselves when the event carries no detail.
  activities: async () => {
    dispatchAppEvent('bcc_activities_updated');
  },
  events: async () => {
    dispatchAppEvent('bcc_activities_updated');
  },
  attendanceLogs: async () => {
    dispatchAppEvent('bcc_attendance_updated');
  },

  posts: async () => {
    dispatchAppEvent('bcc_posts_updated');
  },
};

/** Collections refreshed on a full resync (connect, reconnect, or server-requested). */
const FULL_RESYNC_ORDER = [
  'members',
  'settings',
  'updates',
  'financeLogs',
  'liquidationLogs',
  'financeArchives',
  'treasurerRequests',
  'activities',
  'attendanceLogs',
];

// ==========================================
// Debounced refresh scheduling
// ==========================================

const pendingRefreshes = new Map<string, ReturnType<typeof setTimeout>>();
let resyncTimer: ReturnType<typeof setTimeout> | null = null;
let resyncInFlight = false;

function scheduleCollectionRefresh(collection: string): void {
  const handler = COLLECTION_HANDLERS[collection];
  if (!handler) return; // e.g. `logs` — audit trail with no live consumer

  const existing = pendingRefreshes.get(collection);
  if (existing) clearTimeout(existing);

  pendingRefreshes.set(
    collection,
    setTimeout(() => {
      pendingRefreshes.delete(collection);
      handler().catch((err) => {
        console.warn(`[Realtime] refresh failed for "${collection}":`, err);
      });
    }, CHANGE_DEBOUNCE_MS)
  );
}

async function runFullResync(reason: string): Promise<void> {
  if (resyncInFlight) return;
  resyncInFlight = true;
  try {
    // Sequential on purpose: a cold Render instance handles nine staggered reads far better
    // than nine simultaneous ones, and the user sees each section fill in as it lands.
    for (const collection of FULL_RESYNC_ORDER) {
      const handler = COLLECTION_HANDLERS[collection];
      if (!handler) continue;
      try {
        await handler();
      } catch (err) {
        console.warn(`[Realtime] resync step "${collection}" failed:`, err);
      }
    }
  } finally {
    resyncInFlight = false;
    if (viteEnv.DEV) {
      console.log(`[Realtime] full resync complete (${reason})`);
    }
  }
}

function scheduleFullResync(reason: string): void {
  if (resyncTimer) clearTimeout(resyncTimer);
  resyncTimer = setTimeout(() => {
    resyncTimer = null;
    void runFullResync(reason);
  }, RESYNC_DEBOUNCE_MS);
}

// ==========================================
// Socket lifecycle
// ==========================================

function resolveSocketUrl(): string | undefined {
  // Same-origin in every real deployment (Express + Socket.io share one HTTP server and one port),
  // so let socket.io infer it. `VITE_REALTIME_URL` is an escape hatch for split-origin setups.
  const override = viteEnv.VITE_REALTIME_URL;
  return typeof override === 'string' && override.trim() ? override.trim() : undefined;
}

/**
 * Opens (or reuses) the singleton socket. Safe to call repeatedly — call it on app load.
 *
 * The server refuses sockets without a valid session token, so there is nothing to gain by
 * connecting before sign-in — it would just burn the reconnection budget against a handshake
 * that is guaranteed to fail. `refreshRealtimeAuth()` picks it up as soon as a token exists.
 */
export function connectRealtime(): Socket | null {
  if (typeof window === 'undefined') return null;

  if (socket) {
    if (!socket.connected && !socket.active) socket.connect();
    return socket;
  }

  const token = getAuthToken();
  if (!token) {
    lastHandshakeToken = null;
    emitStatus({ status: 'idle', lastError: null, authenticated: false });
    return null;
  }

  const url = resolveSocketUrl();
  lastHandshakeToken = token;

  emitStatus({ status: 'connecting', lastError: null });

  const instance = url
    ? io(url, buildOptions())
    : io(buildOptions());

  socket = instance;
  wireEvents(instance);
  return instance;
}

function buildOptions() {
  return {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    // Always build a dedicated Manager. `io()` otherwise caches Managers per URL, and a
    // disconnect/reconnect cycle could hand us back one we had already torn down.
    forceNew: true,
    // Point 5: explicit reconnection policy. Not just spin-down cover — deploys, tunnel drops,
    // and phones switching from wifi to LTE all land here.
    reconnection: true,
    reconnectionAttempts: RECONNECTION_ATTEMPTS,
    reconnectionDelay: RECONNECTION_DELAY,
    reconnectionDelayMax: RECONNECTION_DELAY_MAX,
    randomizationFactor: RANDOMIZATION_FACTOR,
    timeout: HANDSHAKE_TIMEOUT,
    autoConnect: true,
    withCredentials: true,
    // Function form so the *current* token is read on every reconnect attempt, not just the first.
    auth: (cb: (data: Record<string, unknown>) => void) => {
      const token = getAuthToken();
      lastHandshakeToken = token || null;
      cb(token ? { token } : {});
    },
  };
}

function wireEvents(instance: Socket): void {
  const onConnect = () => {
    emitStatus({
      status: 'connected',
      connectedAt: new Date().toISOString(),
      lastError: null,
      reconnectAttempts: 0,
      transport: instance.io.engine?.transport?.name ?? null,
    });
  };

  const onReconnectAttempt = (attempt: number) => {
    emitStatus({ status: 'reconnecting', reconnectAttempts: attempt });
  };

  const onReconnectError = (err: Error) => {
    emitStatus({ status: 'reconnecting', lastError: err?.message || 'reconnect error' });
  };

  const onReconnectFailed = () => {
    emitStatus({ status: 'offline', lastError: 'reconnection attempts exhausted' });
  };

  const onConnectError = (err: Error) => {
    // `active` true means socket.io is still retrying on its own schedule.
    emitStatus({
      status: instance.active ? 'reconnecting' : 'offline',
      lastError: err?.message || 'connect error',
    });
  };

  const onDisconnect = (reason: string) => {
    emitStatus({
      status: reason === 'io client disconnect' ? 'idle' : 'reconnecting',
      transport: null,
    });
  };

  // Server handshake result. Fires on connect AND every reconnect — the reconnect case is exactly
  // where we may have missed writes, so it always triggers a full resync.
  const onReady = (payload: RealtimeReadyPayload) => {
    emitStatus({
      mode: payload?.mode ?? 'unknown',
      authenticated: Boolean(payload?.authenticated),
    });
    scheduleFullResync(payload?.recovered ? 'session recovered' : 'connected');
  };

  const onChange = (payload: RealtimeChangePayload) => {
    if (!payload?.collection) return;
    emitStatus({ lastChangeAt: payload.at || new Date().toISOString() });
    scheduleCollectionRefresh(payload.collection);
  };

  // Oplog history lost / collection dropped — the incremental stream is untrustworthy, start over.
  const onResync = (payload: { reason?: string } | undefined) => {
    scheduleFullResync(payload?.reason || 'server requested resync');
  };

  instance.on('connect', onConnect);
  instance.on('connect_error', onConnectError);
  instance.on('disconnect', onDisconnect);
  instance.on('db:ready', onReady);
  instance.on('db:change', onChange);
  instance.on('db:resync', onResync);
  instance.io.on('reconnect_attempt', onReconnectAttempt);
  instance.io.on('reconnect_error', onReconnectError);
  instance.io.on('reconnect_failed', onReconnectFailed);

  // Targeted teardown. Never `removeAllListeners()` on the Manager — socket.io keeps its own
  // internal subscriptions there and stripping them breaks reconnection.
  detachEvents = () => {
    instance.off('connect', onConnect);
    instance.off('connect_error', onConnectError);
    instance.off('disconnect', onDisconnect);
    instance.off('db:ready', onReady);
    instance.off('db:change', onChange);
    instance.off('db:resync', onResync);
    instance.io.off('reconnect_attempt', onReconnectAttempt);
    instance.io.off('reconnect_error', onReconnectError);
    instance.io.off('reconnect_failed', onReconnectFailed);
  };
}

/**
 * Tears the socket down. Called on sign-out and page unload.
 */
export function disconnectRealtime(): void {
  pendingRefreshes.forEach((timer) => clearTimeout(timer));
  pendingRefreshes.clear();
  if (resyncTimer) {
    clearTimeout(resyncTimer);
    resyncTimer = null;
  }
  if (detachEvents) {
    detachEvents();
    detachEvents = null;
  }
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  lastHandshakeToken = null;
  emitStatus({ status: 'idle', connectedAt: null, transport: null, authenticated: false });
}

/**
 * Re-handshakes when the session token changes (sign-in, sign-out, token refresh). On sign-out the
 * socket is torn down rather than reconnected, because the server now rejects tokenless sockets.
 * No-op when the token is unchanged.
 */
export function refreshRealtimeAuth(): void {
  const token = getAuthToken() || null;
  if (token === lastHandshakeToken) return;

  if (!token) {
    // Signed out (or the server rejected our token). Stop rather than retry.
    disconnectRealtime();
    return;
  }

  lastHandshakeToken = token;
  if (!socket) {
    connectRealtime();
    return;
  }
  // A reconnect is the only way to re-run the server's handshake middleware.
  socket.disconnect();
  socket.connect();
}

/** Ask the server to confirm we are current; also runs a local resync. */
export function requestRealtimeResync(reason = 'client requested'): void {
  socket?.emit('client:resync', { reason });
  scheduleFullResync(reason);
}

// ==========================================
// Backstops
// ==========================================
//
// socket.io's own backoff covers almost everything. These handle the cases where the browser
// froze our timers (backgrounded mobile tab) or the OS just handed us a network again — in both
// the retry loop can be sitting on a long delay when connectivity is already back.

let backstopsInstalled = false;

export function installRealtimeBackstops(): void {
  if (backstopsInstalled || typeof window === 'undefined') return;
  backstopsInstalled = true;

  const nudge = () => {
    if (!socket) return;
    if (socket.connected) return;
    // `active` false means socket.io stopped retrying; either way an explicit connect is safe.
    socket.connect();
  };

  window.addEventListener('online', nudge);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') nudge();
  });
  window.addEventListener('pageshow', nudge);
  window.addEventListener('offline', () => {
    emitStatus({ status: 'offline', lastError: 'browser reports no network' });
  });
}
