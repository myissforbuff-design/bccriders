/**
 * Storage Security & Local / Session Persistence Utilities
 * Provides seamless local storage caching for zero-latency UI rendering,
 * while maintaining safe token management and clean logout purging.
 */

// All known storage keys
export const AUTH_TOKEN_KEY = 'bcc_auth_token_v1';

export const SENSITIVE_STORAGE_KEYS = [
  AUTH_TOKEN_KEY,
  'bcc_users_v2',
  'bcc_current_user_id_v2',
  'bcc_user_profile_v2',
  'bcc_payments_v2',
  'bcc_finance_records_v3',
  'bcc_expense_records_v1',
  'brc_finance_expenses',
  'bcc_finance_settings_v1',
  'bcc_monthly_dues_v2',
  'bcc_dynamic_collections_v2',
  'bcc_security_settings_v1',
  'bcc_finance_yearly_archives_v1',
  'bcc_treasurer_requests_v1',
  'bcc_deleted_membership_fee_user_ids',
  'bcc_deleted_finance_record_ids',
  'bcc_registration_form_draft_v1',
  'bcc_membership_registration_draft_v1',
  'bcc_events_v2',
  'bcc_logs_v2',
  'bcc_posts_v2',
  'bcc_routes_v2',
  'bcc_notifs_v2',
  'bcc_announcements_v3',
  'bcc_active_tab',
  'bcc_settings_subtab',
  'bcc_finances_tab',
  'bcc_activity_sync_time',
  'bcc_activities_cache_v1',
  'bcc_attendance_logs_cache_v1',
];

// Persistent device settings & credentials that must survive user logout
export const PERSISTENT_STORAGE_KEYS = [
  'bcc_biometric_credentials_v1',
  'bcc_device_pin_credentials_v1',
  'bcc_theme',
  'bcc_device_id',
  'bcc_preferred_locale',
];

/**
 * Checks if a key belongs to the application.
 */
export function isSensitiveStorageKey(key: string): boolean {
  if (!key) return false;
  if (PERSISTENT_STORAGE_KEYS.includes(key)) return false;
  if (key.includes('biometric')) return false;
  if (key.includes('pin_credential')) return false;
  if (key.includes('firebase')) return false;

  const lower = key.toLowerCase();
  return (
    lower.startsWith('bcc_') ||
    lower.startsWith('brc_') ||
    lower.includes('draft') ||
    lower.includes('finance') ||
    lower.includes('user') ||
    lower.includes('member') ||
    lower.includes('auth') ||
    SENSITIVE_STORAGE_KEYS.includes(key)
  );
}

/**
 * Removes all application keys from localStorage and sessionStorage on explicit logout.
 */
export function clearSensitiveStorage(): void {
  try {
    if (typeof window === 'undefined') return;

    if (window.localStorage) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && isSensitiveStorageKey(key)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => {
        try {
          window.localStorage.removeItem(k);
        } catch {}
      });
    }

    if (window.sessionStorage) {
      try {
        window.sessionStorage.clear();
      } catch {}
    }
  } catch (err) {
    console.warn('Notice while clearing storage:', err);
  }
}

/**
 * Local storage loader with fallback to sessionStorage and default value
 */
export function loadFromLocal<T>(key: string, initialFallback: T): T {
  try {
    if (typeof window !== 'undefined') {
      if (window.localStorage) {
        const item = window.localStorage.getItem(key);
        if (item !== null && item !== undefined && item !== '') {
          return JSON.parse(item);
        }
      }
      if (window.sessionStorage) {
        const sItem = window.sessionStorage.getItem(key);
        if (sItem !== null && sItem !== undefined && sItem !== '') {
          return JSON.parse(sItem);
        }
      }
    }
  } catch (err) {
    console.warn(`Error reading ${key} from storage:`, err);
  }
  return initialFallback;
}

/**
 * Local storage saver - mirrors to localStorage and sessionStorage
 */
export function saveToLocal<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;

  let json: string;
  try {
    json = JSON.stringify(data);
  } catch (err) {
    console.warn(`Error serializing ${key} for storage:`, err);
    return;
  }

  // Large payloads (member lists carry base64 avatars) are compacted up front rather than
  // attempting a write that is certain to blow the ~5MB per-origin quota.
  //
  // Only the disposable API cache is compacted. The authoritative stores (bcc_users_v2,
  // bcc_user_profile_v2, …) are hydrated straight into `store` on cold start and can be written
  // back to MongoDB by a mutation, so stripping avatars there could blank them server-side.
  // Those keys instead rely on the quota guard below, and fall back to memory-only if too large.
  if (json.length > COMPACT_THRESHOLD_BYTES && key.startsWith(API_CACHE_PREFIX)) {
    try {
      json = JSON.stringify(compactForStorage(data));
    } catch {
      // Keep the original json; the quota guard below will still try to make room.
    }
  }

  // Written independently so a full localStorage does not also skip the sessionStorage mirror.
  persistToStore('localStorage', key, json);
  persistToStore('sessionStorage', key, json);
}

/** Above this serialized size, strip base64 blobs before persisting. */
const COMPACT_THRESHOLD_BYTES = 512 * 1024;

/** Prefix used by lib/apiCache.ts. Entries under it are disposable — the server is authoritative. */
const API_CACHE_PREFIX = 'bcc_cached_api_';

/** Any string longer than this inside a known image field is treated as an inline blob. */
const BLOB_STRING_THRESHOLD = 2048;

/**
 * Fields that hold base64 data URLs in this app (avatars, signatures, receipts). Short values
 * — a real `https://` URL, an empty string — are preserved; only inline blobs are dropped.
 */
const HEAVY_FIELDS = new Set([
  'avatar',
  'authorAvatar',
  'applicantSignature',
  'signature',
  'photoUrl',
  'receiptUrl',
  'receiptImage',
  'qrCode',
  'image',
  'attachments',
]);

/** Keys already reported as unwritable, so a failing write warns once instead of every call. */
const quotaWarnedKeys = new Set<string>();

function isQuotaError(err: any): boolean {
  if (!err) return false;
  return (
    err.name === 'QuotaExceededError' ||
    err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    err.code === 22 ||
    err.code === 1014
  );
}

/**
 * Returns a copy of `data` with inline base64 blobs removed. The in-memory copy keeps the
 * originals, so this only degrades what survives a page reload — images are refetched from the
 * server on the next load anyway. Far better than the whole cache entry failing to persist.
 */
function compactForStorage(value: any, depth = 0): any {
  if (depth > 6 || value === null || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map((item) => compactForStorage(item, depth + 1));
  }

  const out: Record<string, any> = {};
  for (const [field, fieldValue] of Object.entries(value)) {
    if (typeof fieldValue === 'string') {
      const isBlob =
        (HEAVY_FIELDS.has(field) && fieldValue.length > BLOB_STRING_THRESHOLD) ||
        (fieldValue.length > 4096 && fieldValue.startsWith('data:'));
      out[field] = isBlob ? '' : fieldValue;
      continue;
    }
    out[field] = compactForStorage(fieldValue, depth + 1);
  }
  return out;
}

/** Evicts API cache entries to make room. They are disposable — the server is the source of truth. */
function evictApiCache(store: Storage, exceptKey: string): number {
  const doomed: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k && k !== exceptKey && k.startsWith(API_CACHE_PREFIX)) doomed.push(k);
  }
  doomed.forEach((k) => {
    try {
      store.removeItem(k);
    } catch {}
  });
  return doomed.length;
}

/**
 * Writes one key to one store, recovering from a full quota by evicting disposable API cache
 * entries and retrying once. Gives up quietly rather than throwing — storage is a cache here.
 */
function persistToStore(storeName: 'localStorage' | 'sessionStorage', key: string, json: string): void {
  let store: Storage | null = null;
  try {
    store = window[storeName];
  } catch {
    return; // Storage disabled (private mode, blocked cookies)
  }
  if (!store) return;

  try {
    // Skip no-op rewrites. Real-time resyncs re-persist the same collections on every reconnect,
    // and an identical write still costs a full serialization pass against the quota.
    if (store.getItem(key) === json) return;
  } catch {}

  try {
    store.setItem(key, json);
    quotaWarnedKeys.delete(`${storeName}:${key}`);
    return;
  } catch (err) {
    if (!isQuotaError(err)) {
      const warnId = `${storeName}:${key}`;
      if (!quotaWarnedKeys.has(warnId)) {
        quotaWarnedKeys.add(warnId);
        console.warn(`Error saving ${key} to ${storeName}:`, err);
      }
      return;
    }
  }

  // Quota hit: drop the disposable API cache and try once more.
  try {
    const evicted = evictApiCache(store, key);
    store.setItem(key, json);
    if (evicted > 0) {
      console.info(`[Storage] Evicted ${evicted} cached API entries from ${storeName} to store ${key}.`);
    }
    quotaWarnedKeys.delete(`${storeName}:${key}`);
    return;
  } catch (err) {
    // Genuinely out of room. Drop this key so a stale oversized value is not left behind, and
    // keep going — the in-memory cache still serves this session.
    try {
      store.removeItem(key);
    } catch {}
    const warnId = `${storeName}:${key}`;
    if (!quotaWarnedKeys.has(warnId)) {
      quotaWarnedKeys.add(warnId);
      console.warn(
        `[Storage] ${key} is too large for ${storeName} (${Math.round(json.length / 1024)}KB) — ` +
          `keeping it in memory only for this session.`
      );
    }
  }
}

/**
 * Session storage loader with fallback - checks localStorage & sessionStorage
 */
export function loadFromSession<T>(key: string, initialFallback: T): T {
  return loadFromLocal<T>(key, initialFallback);
}

/**
 * Session storage saver - saves to both localStorage and sessionStorage
 */
export function saveToSession<T>(key: string, data: T): void {
  saveToLocal<T>(key, data);
}

/**
 * Storage remover
 */
export function removeFromSession(key: string): void {
  removeFromLocal(key);
}

export function removeFromLocal(key: string): void {
  try {
    if (typeof window !== 'undefined') {
      if (window.localStorage) {
        window.localStorage.removeItem(key);
      }
      if (window.sessionStorage) {
        window.sessionStorage.removeItem(key);
      }
    }
  } catch (err) {
    console.warn(`Error removing ${key} from storage:`, err);
  }
}

/**
 * Auth Token Management
 */
export function getAuthToken(): string {
  try {
    if (typeof window !== 'undefined') {
      if (window.localStorage) {
        const tok =
          window.localStorage.getItem(AUTH_TOKEN_KEY) ||
          window.localStorage.getItem('token') ||
          window.localStorage.getItem('bcc_session_token') ||
          window.localStorage.getItem('bcc_admin_token');
        if (tok && typeof tok === 'string' && tok.trim() !== '') return tok.trim();
      }
      if (window.sessionStorage) {
        const tok =
          window.sessionStorage.getItem(AUTH_TOKEN_KEY) ||
          window.sessionStorage.getItem('token') ||
          window.sessionStorage.getItem('bcc_session_token') ||
          window.sessionStorage.getItem('bcc_admin_token');
        if (tok && typeof tok === 'string' && tok.trim() !== '') return tok.trim();
      }
    }
  } catch {}
  return '';
}

export function setAuthToken(token: string): void {
  try {
    if (typeof window !== 'undefined') {
      if (token) {
        if (window.localStorage) window.localStorage.setItem(AUTH_TOKEN_KEY, token);
        if (window.sessionStorage) window.sessionStorage.setItem(AUTH_TOKEN_KEY, token);
      } else {
        clearAuthToken();
      }
    }
  } catch (err) {
    console.warn('Error saving auth token:', err);
  }
}

export function clearAuthToken(): void {
  try {
    if (typeof window !== 'undefined') {
      if (window.localStorage) window.localStorage.removeItem(AUTH_TOKEN_KEY);
      if (window.sessionStorage) window.sessionStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch {}
}

/**
 * Helper to check whether there is currently an active authenticated session.
 *
 * A session is the server-signed token and nothing else. A leftover
 * `bcc_current_user_id_v2` entry used to be enough to count as "signed in",
 * which meant anyone could hand themselves a session by writing one key in
 * devtools. The server will only ever accept the token, so the client's idea of
 * "signed in" now matches what the API will actually authorize.
 */
export function hasActiveUserSession(): boolean {
  try {
    if (typeof window !== 'undefined') {
      const token =
        (window.localStorage && window.localStorage.getItem(AUTH_TOKEN_KEY)) ||
        (window.sessionStorage && window.sessionStorage.getItem(AUTH_TOKEN_KEY));
      return Boolean(token && token.trim().length > 0);
    }
  } catch {}
  return false;
}
