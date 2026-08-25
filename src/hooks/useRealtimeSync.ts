/**
 * useRealtimeSync — mounts the Socket.io push channel for the whole app.
 *
 * Mount this once (App.tsx). It opens the socket on load, re-handshakes whenever the signed-in
 * identity changes so the socket joins the right broadcast room, and exposes the live connection
 * state for the header indicator.
 */

import { useEffect, useState } from 'react';
import {
  connectRealtime,
  disconnectRealtime,
  getRealtimeSnapshot,
  installRealtimeBackstops,
  refreshRealtimeAuth,
  requestRealtimeResync,
  subscribeRealtimeStatus,
  type RealtimeSnapshot,
} from '../lib/realtimeSync';

export interface UseRealtimeSyncResult extends RealtimeSnapshot {
  /** True while the push channel is live — i.e. no refresh needed to see other devices' writes. */
  isLive: boolean;
  /** Force a full refetch of every synced collection. */
  resync: (reason?: string) => void;
}

/**
 * @param sessionKey Anything that changes when the signed-in user changes (e.g. `currentUser?.id`).
 *                   Used to re-run the socket handshake so the server can re-evaluate the token.
 */
export function useRealtimeSync(sessionKey?: string | null): UseRealtimeSyncResult {
  const [snapshot, setSnapshot] = useState<RealtimeSnapshot>(() => getRealtimeSnapshot());

  // Connect on app load. `connectRealtime()` is a no-op until a session token exists, since the
  // server refuses tokenless sockets — the sign-in effect below is what actually opens it.
  useEffect(() => {
    installRealtimeBackstops();
    connectRealtime();
    const unsubscribe = subscribeRealtimeStatus(setSnapshot);

    return () => {
      unsubscribe();
      // Only tear the socket down when the whole app unmounts (page navigation / HMR).
      disconnectRealtime();
    };
  }, []);

  // Sign-in opens the socket, sign-out tears it down, and a switched identity re-runs the
  // server handshake so the token is verified again.
  useEffect(() => {
    refreshRealtimeAuth();
  }, [sessionKey]);

  return {
    ...snapshot,
    isLive: snapshot.status === 'connected',
    resync: requestRealtimeResync,
  };
}

export default useRealtimeSync;
