/**
 * Global Client-Side Data Cache with Stale-While-Revalidate (SWR) Pattern
 * Prevents UI values from dropping to 0 or flashing empty when switching tabs.
 */

import { loadFromSession, saveToSession } from './storageSecurity';

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry>();

// Cache key prefix
const CACHE_PREFIX = 'bcc_cached_api_';

function getStorageKey(key: string): string {
  const cleanKey = key.replace(/[^a-zA-Z0-9_]/g, '_');
  return `${CACHE_PREFIX}${cleanKey}`;
}

/**
 * Synchronously retrieves cached data from Memory -> SessionStorage -> Fallback.
 * Guarantees zero latency and instantaneous display on component mount.
 */
export function getCachedData<T>(key: string, fallback: T): T {
  // 1. Check in-memory Map
  const inMem = memoryCache.get(key);
  if (inMem && inMem.data !== undefined && inMem.data !== null) {
    if (Array.isArray(inMem.data) && inMem.data.length > 0) {
      return inMem.data as unknown as T;
    }
    if (!Array.isArray(inMem.data)) {
      return inMem.data as unknown as T;
    }
  }

  // 2. Check Session Storage
  const storageKey = getStorageKey(key);
  const fromSession = loadFromSession<T | null>(storageKey, null);
  if (fromSession !== null && fromSession !== undefined) {
    if (Array.isArray(fromSession) && fromSession.length > 0) {
      memoryCache.set(key, { data: fromSession, timestamp: Date.now() });
      return fromSession;
    }
    if (!Array.isArray(fromSession)) {
      memoryCache.set(key, { data: fromSession, timestamp: Date.now() });
      return fromSession;
    }
  }

  // 3. Fallback
  return fallback;
}

/**
 * Sets data into both Memory Cache and Session Storage.
 */
export function setCachedData<T>(key: string, data: T): void {
  if (data === undefined || data === null) return;
  memoryCache.set(key, { data, timestamp: Date.now() });
  const storageKey = getStorageKey(key);
  saveToSession(storageKey, data);
}

/**
 * Removes a specific cache key.
 */
export function removeCachedData(key: string): void {
  memoryCache.delete(key);
  const storageKey = getStorageKey(key);
  try {
    if (typeof window !== 'undefined') {
      if (window.localStorage) window.localStorage.removeItem(storageKey);
      if (window.sessionStorage) window.sessionStorage.removeItem(storageKey);
    }
  } catch {}
}

/**
 * Clears all cached API items (e.g. on logout).
 */
export function clearAllApiCache(): void {
  memoryCache.clear();
  try {
    if (typeof window !== 'undefined') {
      if (window.localStorage) {
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k && k.startsWith(CACHE_PREFIX)) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => window.localStorage.removeItem(k));
      }
      if (window.sessionStorage) {
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const k = window.sessionStorage.key(i);
          if (k && k.startsWith(CACHE_PREFIX)) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => window.sessionStorage.removeItem(k));
      }
    }
  } catch {}
}
