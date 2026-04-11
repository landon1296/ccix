import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY = 'ccix-wake-lock-enabled';

// Tiny base64-encoded silent MP4 video used as iOS wake lock workaround.
// Safari doesn't support the Screen Wake Lock API, but keeps the screen on
// while a video is playing — even if it's silent and invisible.
const SILENT_MP4 =
  'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAChtZGF0AAACrwYF//+r' +
  '3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE1NyByMjk2OSA1NjhlMjIwIC0gSC4yNjQvTVBF' +
  'Ry00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAxOSAtIGh0dHA6Ly93d3cudmlkZW9sYW4u' +
  'b3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTMgZGVibG9jaz0xOjA6MCBhbmFs' +
  'eXNlPTB4MzoweDExMyBtZT1oZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVk' +
  'X3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MSA4eDhkY3Q9MSBjcW09MCBk' +
  'ZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tMiB0aHJlYWRzPTEg' +
  'bG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRl' +
  'cmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0zIGJf' +
  'cHlyYW1pZD0yIGJfYWRhcHQ9MSBiX2JpYXM9MCBkaXJlY3Q9MSB3ZWlnaHRiPTEgb3Blbl9nb3A9' +
  'MCB3ZWlnaHRwPTIga2V5aW50PTI1MCBrZXlpbnRfbWluPTI1IHNjZW5lY3V0PTQwIGludHJhX3Jl' +
  'ZnJlc2g9MCByY19sb29rYWhlYWQ9NDAgcmM9Y3JmIG1idHJlZT0xIGNyZj0yMy4wIHFjb21wPTAu' +
  'NjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAAAAD2' +
  'WIhAAz//727L4FNf2f0AAAAAv0BAADwZWxzdA==';

export function useWakeLock() {
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
  });
  const [active, setActive] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const nativeSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  // iOS Safari doesn't support Wake Lock API — use video fallback
  const isIOS = typeof navigator !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const supported = nativeSupported || isIOS;

  // ─── Native Wake Lock (Android / Desktop) ───
  const requestNativeWakeLock = useCallback(async () => {
    if (!nativeSupported || !enabled) return false;
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      wakeLockRef.current.addEventListener('release', () => {
        setActive(false);
        wakeLockRef.current = null;
      });
      return true;
    } catch {
      return false;
    }
  }, [nativeSupported, enabled]);

  const releaseNativeWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try { await wakeLockRef.current.release(); } catch {}
      wakeLockRef.current = null;
    }
  }, []);

  // ─── iOS Video Fallback ───
  const startVideoWakeLock = useCallback(() => {
    if (!isIOS || !enabled) return;
    if (!videoRef.current) {
      const video = document.createElement('video');
      video.setAttribute('playsinline', '');
      video.setAttribute('muted', '');
      video.setAttribute('loop', '');
      video.muted = true;
      video.style.position = 'fixed';
      video.style.top = '-9999px';
      video.style.left = '-9999px';
      video.style.width = '1px';
      video.style.height = '1px';
      video.style.opacity = '0.01';
      video.src = SILENT_MP4;
      document.body.appendChild(video);
      videoRef.current = video;
    }
    videoRef.current.play().catch(() => {});
  }, [isIOS, enabled]);

  const stopVideoWakeLock = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      if (videoRef.current.parentNode) {
        videoRef.current.parentNode.removeChild(videoRef.current);
      }
      videoRef.current = null;
    }
  }, []);

  // ─── Combined acquire/release ───
  const requestWakeLock = useCallback(async () => {
    if (!enabled) return;
    if (nativeSupported) {
      const ok = await requestNativeWakeLock();
      if (ok) { setActive(true); return; }
    }
    if (isIOS) {
      startVideoWakeLock();
      setActive(true);
    }
  }, [enabled, nativeSupported, isIOS, requestNativeWakeLock, startVideoWakeLock]);

  const releaseWakeLock = useCallback(async () => {
    await releaseNativeWakeLock();
    stopVideoWakeLock();
    setActive(false);
  }, [releaseNativeWakeLock, stopVideoWakeLock]);

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
