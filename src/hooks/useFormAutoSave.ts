import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Options for the useFormAutoSave hook.
 */
export interface UseFormAutoSaveOptions<T> {
  /**
   * Unique sessionStorage key to store the draft.
   */
  key: string;
  /**
   * Current state object of the form.
   */
  formData: T;
  /**
   * Keys/fields inside `formData` that MUST BE EXCLUDED from storage for security (e.g. passwords).
   */
  excludeKeys?: (keyof T | string)[];
  /**
   * Debounce delay in milliseconds for saving to sessionStorage (default: 400ms).
   */
  debounceMs?: number;
  /**
   * Optional custom validator to determine if draft contains meaningful data worth saving.
   */
  isDraftValid?: (draft: Partial<T>) => boolean;
}

export interface UseFormAutoSaveReturn<T> {
  /**
   * Restored draft data loaded from sessionStorage on mount (or null if none/invalid).
   */
  restoredData: Partial<T> | null;
  /**
   * Boolean indicating if a draft was found and successfully restored.
   */
  hasRestoredDraft: boolean;
  /**
   * Timestamp string of when the draft was last auto-saved (e.g. "Today at 2:30 PM").
   */
  lastSavedAt: string | null;
  /**
   * Clears the draft key from sessionStorage (call this upon successful form submission).
   */
  clearDraft: () => void;
  /**
   * Explicitly triggers a clear with UI indicator resetting state.
   */
  dismissDraftNotification: () => void;
}

/**
 * Custom React Hook for Form Auto-Save / State Persistence in sessionStorage.
 * Automatically saves user form inputs in real-time in session memory, excludes sensitive keys like passwords,
 * safely handles JSON parsing errors, and provides a clearDraft method on form submission or logout.
 */
export function useFormAutoSave<T extends Record<string, any>>({
  key,
  formData,
  excludeKeys = ['password', 'confirmPassword', 'passwordConfirm', 'secret'],
  debounceMs = 400,
}: UseFormAutoSaveOptions<T>): UseFormAutoSaveReturn<T> {
  const [restoredData, setRestoredData] = useState<Partial<T> | null>(null);
  const [hasRestoredDraft, setHasRestoredDraft] = useState<boolean>(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const isMounted = useRef<boolean>(false);

  // 1. Initial Load / Restoration on Component Mount (checks sessionStorage and cleans legacy localStorage)
  useEffect(() => {
    if (!key) return;
    try {
      if (typeof window !== 'undefined') {
        // Clean any legacy localStorage draft for security
        try {
          if (window.localStorage && window.localStorage.getItem(key)) {
            window.localStorage.removeItem(key);
          }
        } catch {}

        if (window.sessionStorage) {
          const savedJson = window.sessionStorage.getItem(key);
          if (savedJson) {
            const parsed = JSON.parse(savedJson);
            if (parsed && typeof parsed === 'object') {
              const { _savedAt, ...draftFields } = parsed;

              // Check if draft has any non-empty properties
              const hasContent = Object.values(draftFields).some((val) => {
                if (val === null || val === undefined) return false;
                if (typeof val === 'string') return val.trim().length > 0;
                if (typeof val === 'object') return Object.keys(val).length > 0;
                if (typeof val === 'boolean') return val;
                return true;
              });

              if (hasContent) {
                setRestoredData(draftFields as Partial<T>);
                setHasRestoredDraft(true);
                if (_savedAt) {
                  setLastSavedAt(_savedAt);
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[useFormAutoSave] Error reading draft for key "${key}" from sessionStorage:`, err);
    }
  }, [key]);

  // Helper to filter out excluded sensitive keys
  const getSanitizedData = useCallback(
    (data: T): Record<string, any> => {
      const sanitized: Record<string, any> = {};
      const excludedSet = new Set(excludeKeys as string[]);

      Object.keys(data).forEach((fieldKey) => {
        if (!excludedSet.has(fieldKey)) {
          sanitized[fieldKey] = data[fieldKey];
        }
      });

      return sanitized;
    },
    [excludeKeys]
  );

  // 2. Real-Time Auto Save with Debounce to sessionStorage
  useEffect(() => {
    // Skip initial render save to avoid overwriting stored draft with blank initial state before restoration
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }

    if (!key) return;

    const timer = setTimeout(() => {
      try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          const sanitized = getSanitizedData(formData);

          // Check if there is actual user input to save
          const hasUserInput = Object.values(sanitized).some((val) => {
            if (val === null || val === undefined) return false;
            if (typeof val === 'string') return val.trim().length > 0;
            if (typeof val === 'object') return Object.keys(val).length > 0;
            if (typeof val === 'boolean') return val === true;
            return true;
          });

          if (hasUserInput) {
            const nowFormatted = new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });
            const payload = {
              ...sanitized,
              _savedAt: `Today at ${nowFormatted}`,
            };
            window.sessionStorage.setItem(key, JSON.stringify(payload));
            setLastSavedAt(`Today at ${nowFormatted}`);
          }
        }
      } catch (err) {
        console.warn(`[useFormAutoSave] Error saving draft to sessionStorage for key "${key}":`, err);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [formData, key, debounceMs, getSanitizedData]);

  // 3. Clear Draft on Successful Submission / Discard
  const clearDraft = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        if (window.sessionStorage && key) {
          window.sessionStorage.removeItem(key);
        }
        if (window.localStorage && key) {
          window.localStorage.removeItem(key);
        }
      }
    } catch (err) {
      console.warn(`[useFormAutoSave] Error removing draft key "${key}":`, err);
    }
    setRestoredData(null);
    setHasRestoredDraft(false);
    setLastSavedAt(null);
  }, [key]);

  const dismissDraftNotification = useCallback(() => {
    setHasRestoredDraft(false);
  }, []);

  return {
    restoredData,
    hasRestoredDraft,
    lastSavedAt,
    clearDraft,
    dismissDraftNotification,
  };
}
