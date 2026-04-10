import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY = 'ccix-wake-lock-enabled';

export function useWakeLock() {
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
  });
  const [active, setActive] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  const requestWakeLock = useCallback(async () => {
    if (!supported || !enabled) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      setActive(true);
      wakeLockRef.current.addEventListener('release', () => {
        setActive(false);
        wakeLockRef.current = null;
      });
    } catch {
      // Wake lock request failed (e.g. page not visible)
      setActive(false);
    }
  }, [supported, enabled]);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try { await wakeLockRef.current.release(); } catch {}
      wakeLockRef.current = null;
      setActive(false);
    }
  }, []);

  const toggle = useCallback(() => {
    const next = !enabled;
    setEnabled(next);
    try { localStorage.setItem(STORAGE_KEY, String(next)); } catch {}
  }, [enabled]);

  // Acquire/release based on enabled state
  useEffect(() => {
    if (enabled) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
    return () => { releaseWakeLock(); };
  }, [enabled, requestWakeLock, releaseWakeLock]);

  // Re-acquire on visibility change (iOS releases wake lock when tab is backgrounded)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && enabled) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [enabled, requestWakeLock]);

  return { supported, enabled, active, toggle };
}
