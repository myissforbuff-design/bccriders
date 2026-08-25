/**
 * RealtimeStatusPill — tiny header indicator for the live-sync channel.
 *
 * Subscribes directly to the realtime client so it re-renders on connection changes without
 * threading state through App. Clicking it forces a full resync, which is the manual escape hatch
 * that used to require reloading the page.
 */

import React, { useEffect, useState } from 'react';
import { RadioTower, RefreshCw, WifiOff } from 'lucide-react';
import {
  getRealtimeSnapshot,
  requestRealtimeResync,
  subscribeRealtimeStatus,
  type RealtimeSnapshot,
} from '../lib/realtimeSync';

export function RealtimeStatusPill() {
  const [snapshot, setSnapshot] = useState<RealtimeSnapshot>(() => getRealtimeSnapshot());

  useEffect(() => subscribeRealtimeStatus(setSnapshot), []);

  const isLive = snapshot.status === 'connected';
  const isRetrying = snapshot.status === 'reconnecting' || snapshot.status === 'connecting';

  const label = isLive
    ? 'Live'
    : snapshot.status === 'connecting'
    ? 'Connecting'
    : snapshot.status === 'reconnecting'
    ? 'Reconnecting'
    : snapshot.status === 'offline'
    ? 'Offline'
    : 'Idle';

  const title = isLive
    ? `Live sync active${snapshot.mode !== 'unknown' ? ` (${snapshot.mode} change stream)` : ''}${
        snapshot.lastChangeAt ? ` — last update ${new Date(snapshot.lastChangeAt).toLocaleTimeString()}` : ''
      }. Click to force a refresh.`
    : isRetrying
    ? `Reconnecting to live sync${snapshot.reconnectAttempts ? ` (attempt ${snapshot.reconnectAttempts})` : ''}. Showing cached data. Click to retry now.`
    : `Live sync unavailable — showing cached data.${snapshot.lastError ? ` ${snapshot.lastError}.` : ''} Click to retry.`;

  const tone = isLive
    ? 'bg-[#f7f9f7] border-[#e2ece2] text-[#1b4332]'
    : isRetrying
    ? 'bg-[#fff8e6] border-[#f0e0b0] text-[#8a6b12]'
    : 'bg-[#fdf1f1] border-[#f0cfcf] text-[#8a2020]';

  return (
    <button
      type="button"
      onClick={() => requestRealtimeResync('manual refresh')}
      title={title}
      aria-label={title}
      className={`shrink-0 flex items-center gap-1.5 rounded-xl border px-1.5 py-1 sm:px-2.5 sm:py-1.5 text-[10px] sm:text-xs font-bold transition-colors cursor-pointer ${tone}`}
    >
      {isLive ? (
        <>
          <span className="relative flex w-1.5 h-1.5 sm:w-2 sm:h-2">
            <span className="absolute inline-flex w-full h-full rounded-full bg-[#74c69d] opacity-70 animate-ping" />
            <span className="relative inline-flex w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#2d6a4f]" />
          </span>
          <RadioTower className="w-3.5 h-3.5 text-[#2d6a4f] hidden sm:inline" />
        </>
      ) : isRetrying ? (
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <WifiOff className="w-3.5 h-3.5" />
      )}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

export default RealtimeStatusPill;
