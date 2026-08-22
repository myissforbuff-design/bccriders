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
  try {
    if (typeof window !== 'undefined') {
      const json = JSON.stringify(data);
      if (window.localStorage) {
        window.localStorage.setItem(key, json);
      }
      if (window.sessionStorage) {
        window.sessionStorage.setItem(key, json);
      }
    }
  } catch (err) {
    console.warn(`Error saving ${key} to storage:`, err);
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
        const tok = window.localStorage.getItem(AUTH_TOKEN_KEY);
        if (tok) return tok;
      }
      if (window.sessionStorage) {
        const tok = window.sessionStorage.getItem(AUTH_TOKEN_KEY);
        if (tok) return tok;
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
 * Helper to check whether there is currently an active authenticated session
 */
export function hasActiveUserSession(): boolean {
  try {
    if (typeof window !== 'undefined') {
      const current =
        (window.localStorage && window.localStorage.getItem('bcc_current_user_id_v2')) ||
        (window.sessionStorage && window.sessionStorage.getItem('bcc_current_user_id_v2'));
      const token =
        (window.localStorage && window.localStorage.getItem(AUTH_TOKEN_KEY)) ||
        (window.sessionStorage && window.sessionStorage.getItem(AUTH_TOKEN_KEY));
      return Boolean(current && current.trim().length > 0) || Boolean(token && token.trim().length > 0);
    }
  } catch {}
  return false;
}
