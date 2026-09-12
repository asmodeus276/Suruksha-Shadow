import { useState, useEffect, useRef, useCallback } from "react";

const STORAGE_KEY = "suraksha_checkin";
const WARNING_MS = 2 * 60 * 1000; // 2-minute warning before auto-fire
const TICK_MS = 1000;

/**
 * Scheduled Check-In — "dead man's switch" for walking home alone.
 * Set a timer; if you don't tap "I'm safe" before it expires, SOS fires.
 *
 * Timer state is persisted to localStorage so a page reload (or the
 * browser's tab recycler on mobile) doesn't silently cancel it.
 */
export function useScheduledCheckIn({ onExpire }) {
  const [isActive, setIsActive] = useState(false);
  const [remainingMs, setRemainingMs] = useState(0);
  const [expiresAt, setExpiresAt] = useState(null);
  const intervalRef = useRef(null);
  const expiredRef = useRef(false);

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved?.expiresAt) {
        const remaining = saved.expiresAt - Date.now();
        if (remaining > 0) {
          setExpiresAt(saved.expiresAt);
          setRemainingMs(remaining);
          setIsActive(true);
          expiredRef.current = false;
        } else {
          // Timer expired while the page was closed — fire immediately
          localStorage.removeItem(STORAGE_KEY);
          expiredRef.current = true;
          onExpire?.();
        }
      }
    } catch {
      /* corrupt or unavailable localStorage — non-fatal */
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Countdown tick
  useEffect(() => {
    if (!isActive || !expiresAt) return;

    intervalRef.current = setInterval(() => {
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        clearInterval(intervalRef.current);
        setRemainingMs(0);
        setIsActive(false);
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch { /* */ }
        if (!expiredRef.current) {
          expiredRef.current = true;
          onExpire?.();
        }
      } else {
        setRemainingMs(remaining);
      }
    }, TICK_MS);

    return () => clearInterval(intervalRef.current);
  }, [isActive, expiresAt, onExpire]);

  const start = useCallback((durationMinutes) => {
    const expires = Date.now() + durationMinutes * 60 * 1000;
    setExpiresAt(expires);
    setRemainingMs(durationMinutes * 60 * 1000);
    setIsActive(true);
    expiredRef.current = false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ expiresAt: expires }));
    } catch { /* */ }
  }, []);

  const cancel = useCallback(() => {
    setIsActive(false);
    setRemainingMs(0);
    setExpiresAt(null);
    expiredRef.current = false;
    if (intervalRef.current) clearInterval(intervalRef.current);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch { /* */ }
  }, []);

  const isWarning = isActive && remainingMs > 0 && remainingMs <= WARNING_MS;

  return { start, cancel, isActive, remainingMs, isWarning };
}
