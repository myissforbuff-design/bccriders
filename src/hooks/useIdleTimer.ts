import { useEffect, useRef, useCallback } from 'react';

interface UseIdleTimerOptions {
  timeoutMs?: number; // default 5 minutes (300,000 ms)
  onIdle: () => void;
  enabled?: boolean;
}

export function useIdleTimer({
  timeoutMs = 5 * 60 * 1000,
  onIdle,
  enabled = true,
}: UseIdleTimerOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (!enabled) return;

    timerRef.current = setTimeout(() => {
      onIdleRef.current();
    }, timeoutMs);
  }, [enabled, timeoutMs]);

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      return;
    }

    // Start timer initially
    resetTimer();

    // Activity event listeners
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'wheel',
      'click',
    ];

    let lastActivity = Date.now();
    const handleActivity = () => {
      const now = Date.now();
      // Throttle resetting the timer to once every 1000ms during continuous mousemove/scroll
      if (now - lastActivity > 1000) {
        lastActivity = now;
        resetTimer();
      }
    };

    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [enabled, resetTimer]);
}
