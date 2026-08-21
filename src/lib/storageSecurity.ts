/**
 * Storage Security & Sensitive Data Cleansing Utilities
 * Ensures sensitive user data (financial records, membership drafts, user IDs)
 * are stored in secure session/in-memory storage and completely wiped on logout or landing page.
 */

// All known sensitive storage keys
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
];

/**
 * Checks if a key is sensitive or belongs to the application.
 */
export function isSensitiveStorageKey(key: string): boolean {
  if (!key) return false;
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
 * Removes all sensitive keys from localStorage and sessionStorage.
 */
export function clearSensitiveStorage(): void {
  try {
    if (typeof window === 'undefined') return;

    // 1. Clean localStorage for all bcc_ / brc_ and sensitive keys
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

    // 2. Wipe sessionStorage
    if (window.sessionStorage) {
      try {
        window.sessionStorage.clear();
      } catch {}
    }
  } catch (err) {
    console.warn('Notice while clearing sensitive storage:', err);
  }
}

/**
 * Session storage loader with fallback
 */
export function loadFromSession<T>(key: string, initialFallback: T): T {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const item = window.sessionStorage.getItem(key);
      if (item) {
        return JSON.parse(item);
      }
    }
  } catch (err) {
    console.warn(`Error reading ${key} from sessionStorage:`, err);
  }
  return initialFallback;
}

/**
 * Session storage saver
 */
export function saveToSession<T>(key: string, data: T): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(key, JSON.stringify(data));
    }
  } catch (err) {
    console.warn(`Error saving ${key} to sessionStorage:`, err);
  }
}

/**
 * Session storage remover
 */
export function removeFromSession(key: string): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(key);
    }
  } catch (err) {
    console.warn(`Error removing ${key} from sessionStorage:`, err);
  }
}

/**
 * Auth Token Management
 */
export function getAuthToken(): string {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage.getItem(AUTH_TOKEN_KEY) || '';
    }
  } catch {}
  return '';
}

export function setAuthToken(token: string): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      if (token) {
        window.sessionStorage.setItem(AUTH_TOKEN_KEY, token);
      } else {
        window.sessionStorage.removeItem(AUTH_TOKEN_KEY);
      }
    }
  } catch (err) {
    console.warn('Error saving auth token to sessionStorage:', err);
  }
}

export function clearAuthToken(): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch {}
}

/**
 * Helper to check whether there is currently an active authenticated session
 */
export function hasActiveUserSession(): boolean {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const current = window.sessionStorage.getItem('bcc_current_user_id_v2');
      const token = window.sessionStorage.getItem(AUTH_TOKEN_KEY);
      return Boolean(current && current.trim().length > 0 && token && token.trim().length > 0);
    }
  } catch {}
  return false;
}
