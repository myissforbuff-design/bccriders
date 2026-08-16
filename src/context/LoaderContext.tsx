import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { OfficialLoader } from '../components/OfficialLoader';

export interface LoaderOptions {
  message?: string;
  duration?: number;
  onComplete?: () => void;
}

interface LoaderContextType {
  isLoading: boolean;
  message: string;
  showLoader: (message?: string) => void;
  hideLoader: () => void;
  /**
   * Universal mutation helper:
   * Displays the official dot spinner loader, executes the async or sync mutation action (modify, update, delete, etc.),
   * refreshes local/global data state, and smoothly hides the loader.
   */
  runWithLoader: <T = any>(
    action: () => Promise<T> | T,
    options?: LoaderOptions
  ) => Promise<T>;
  /**
   * Version ticker that increments on every data mutation/refresh,
   * allowing any component to subscribe and automatically re-render or re-fetch data.
   */
  refreshTick: number;
  triggerRefresh: () => void;
}

const LoaderContext = createContext<LoaderContextType | undefined>(undefined);

export const LoaderProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('Processing update...');
  const [refreshTick, setRefreshTick] = useState(0);

  const showLoader = useCallback((msg?: string) => {
    if (msg) setMessage(msg);
    setIsLoading(true);
  }, []);

  const hideLoader = useCallback(() => {
    setIsLoading(false);
  }, []);

  const triggerRefresh = useCallback(() => {
    setRefreshTick((prev) => prev + 1);
    // Also dispatch a global window event for cross-component and legacy event listeners
    try {
      window.dispatchEvent(new CustomEvent('bcc_data_refreshed'));
    } catch (e) {
      // ignore
    }
  }, []);

  const runWithLoader = useCallback(
    async <T = any>(action: () => Promise<T> | T, options?: LoaderOptions): Promise<T> => {
      const msg = options?.message || 'Processing update...';
      setMessage(msg);
      setIsLoading(true);

      try {
        // Execute the mutating action
        const result = await action();

        // Ensure minimum visual feedback (350ms) for a polished, smooth UX
        const duration = options?.duration !== undefined ? options.duration : 400;
        if (duration > 0) {
          await new Promise((resolve) => setTimeout(resolve, duration));
        }

        // Trigger reactive update across the entire app
        triggerRefresh();

        if (options?.onComplete) {
          options.onComplete();
        }

        return result;
      } finally {
        setIsLoading(false);
      }
    },
    [triggerRefresh]
  );

  return (
    <LoaderContext.Provider
      value={{
        isLoading,
        message,
        showLoader,
        hideLoader,
        runWithLoader,
        refreshTick,
        triggerRefresh,
      }}
    >
      {children}
      <OfficialLoader isLoading={isLoading} message={message} />
    </LoaderContext.Provider>
  );
};

export const useLoader = (): LoaderContextType => {
  const context = useContext(LoaderContext);
  if (!context) {
    throw new Error('useLoader must be used within a LoaderProvider');
  }
  return context;
};
