import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY = 'ccix-wake-lock-enabled';

// Known-working silent MP4 from NoSleep.js — properly encoded with video track.
// This is a ~20-second silent H.264 video that iOS Safari will happily loop,
// preventing the screen from sleeping.
const NOSLEEP_VIDEO_WEBM = 'data:video/webm;base64,GkXfo0AgQoaBAUL3gQFC8oEEQvOBCEKCQAR3ZWJtQoeBAkKFgQIYU4BnQI0VSalmQCgq17FAAw9CQE2AQAZ3aGFtbXlXQUAGd2hhbW15RIlACECPQAAAAAAAFlSua0AxrkAu14EBY8WBAZyBACK1nEADdW5NhkZzZWVkUmVzb3VyY2VJZBjUYQBNb3ppbGxhKzUuMCsoV2luZG93cytOVCsxMC4wOytXaW42NDsreDY0KStBcHBsZVdlYktpdC81MzcuMzYrKEtIVE1MLCtsaWtlK0dlY2tvKStDaHJvbWUvODEuMC40MDQ0LjEyOStTYWZhcmkvNTM3LjM2V0GGZUNocm9tZUFGQ29wZXILAQAAAAAAABARAAAAAAAAEBAAAAAAAAARYXWIgQCIgQABYAEB';
const NOSLEEP_VIDEO_MP4 = 'data:video/mp4;base64,AAAAIGZ0eXBtcDQyAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAACKBtZGF0AAAC8wYF///vAAABtBuAGCZmAAEAAAABAAAA/xIAIYA1//Hz/8HzBf/6+BX/9dBl//Xg1f/6fBn/9fDl//pUHf/y/An/7Pgn//J4K//siDv//gAAAE1u/8CCjWF0AWQBbAFkAaQBZAFsAWQBpAFkAWwBZAGkAWQBbAFkAaQBZAFsAWQBpAFkAWwBZAGkAWQBbAFkAaQBZAFsAWQBpAFkAWwBZAGk/8CCjWF0AWQBbAFkAaQBZAFsAWQBpAFkAWwBZAGkAWQBbAFkAaQBZAFsAWQBpAFkAWwBZAGkAWQBbAFkAaQBZAFsAWQBpAFkAWwBZAGk/8CCjWF0AWQBbAFkAaQBZAFsAWQBpAFkAWwBZAGkAWQBbAFkAaQBZAFsAWQBpAFkAWwBZAGkAWQBbAFkAaQBZAFsAWQBpAFkAWwBZAGk/8CCjWF0AWQBbAFkAaQBZAFsAWQBpAFkAWwBZAGkAWQBbAFkAaQBZAFsAWQBpAFkAWwBZAGkAWQBbAFkAaQBZAFsAWQBpAFkAWwBZAGk/8CCjWF0AWQBbAFkAaQBZAFsAWQBpAFkAWwBZAGkAWQBbAFkAaQBZAFsAWQBpAFkAWwBZAGkAWQBbAFkAaQBZAFsAWQBpAFkAWwBZAGk/8CCjWF0AWQBbAFkAaQBZAFsAWQBpAFkAWwBZAGkAWQBbAFkAaQBZAFsAWQBpAFkAWwBZAGkAWQBbAFkAaQBZAFsAWQBpAFkAWwBZAGkAAAAr21vb3YAAABsbXZoZAAAAAAAAAAAAAAAAAAAA+gAAAPoAAEAAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAACYdHJhawAAAFx0a2hkAAAAAwAAAAAAAAAAAAAAAQAAAAAAAAPoAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAIAAAACAAAAAAAbm1kaWEAAAAgbWRoZAAAAAAAAAAAAAAAAABAAAAARFXEAAAAAAAtaGRscgAAAAAAAAAAdmlkZQAAAAAAAAAAAAAAAAVWaWRlbwAAAAE0bWluZgAAABR2bWhkAAAAAQAAAAAAAAAAAAAAJGRpbmYAAAAcZHJlZgAAAAAAAAABAAAADHVybCAAAAABAAAA9HN0YmwAAACYc3RzZAAAAAAAAAABAAAAiGF2YzEAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAACAAIAEgAAABIAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY//8AAAAyYXZjQwFkAAr/4QAYZ2QACqzZCWhAAAADAEAAAA8DxIllgAEABmjr48siwAAAABhzdHRzAAAAAAAAAAEAAAABAAAEQAAAABRzdHNzAAAAAAAAAAEAAAABAAAAGHN0c2MAAAAAAAAAAQAAAAEAAAABAAAAAAAAAFN0c3oAAAAAAAAAAAAAAgAAAiMAAAE6AAAAFHVkdGEAAAAMdHJleAAAAAAAAAAsbWV0YQAAAAB0YWdzAAAAAAAAAAAAAAAAABRkYXRhAAAAAAQAAAAA';

export function useWakeLock() {
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
  });
  const [active, setActive] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const nativeSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  const isIOS = typeof navigator !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const supported = nativeSupported || isIOS;

  // ─── Create the video element once (but don't play yet) ───
  const getOrCreateVideo = useCallback(() => {
    if (videoRef.current) return videoRef.current;
    const video = document.createElement('video');
    video.setAttribute('playsinline', '');
    video.setAttribute('muted', '');
    video.setAttribute('loop', '');
    video.muted = true;
    video.playsInline = true;
    video.style.position = 'fixed';
    video.style.top = '-1px';
    video.style.left = '-1px';
    video.style.width = '1px';
    video.style.height = '1px';
    video.style.opacity = '0.01';
    video.style.pointerEvents = 'none';

    // Try webm first, mp4 fallback
    const sourceWebm = document.createElement('source');
    sourceWebm.src = NOSLEEP_VIDEO_WEBM;
    sourceWebm.type = 'video/webm';
    video.appendChild(sourceWebm);

    const sourceMp4 = document.createElement('source');
    sourceMp4.src = NOSLEEP_VIDEO_MP4;
    sourceMp4.type = 'video/mp4';
    video.appendChild(sourceMp4);

    document.body.appendChild(video);
    videoRef.current = video;
    return video;
  }, []);

  const stopVideo = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      if (videoRef.current.parentNode) {
        videoRef.current.parentNode.removeChild(videoRef.current);
      }
      videoRef.current = null;
    }
  }, []);

  // ─── Native Wake Lock (Android / Desktop) ───
  const acquireNative = useCallback(async () => {
    if (!nativeSupported) return false;
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      wakeLockRef.current.addEventListener('release', () => {
        setActive(false);
        wakeLockRef.current = null;
      });
      setActive(true);
      return true;
    } catch {
      return false;
    }
  }, [nativeSupported]);

  const releaseNative = useCallback(async () => {
    if (wakeLockRef.current) {
      try { await wakeLockRef.current.release(); } catch {}
      wakeLockRef.current = null;
    }
  }, []);

  // ─── Toggle — MUST call video.play() synchronously from tap ───
  const toggle = useCallback(() => {
    const next = !enabled;
    setEnabled(next);
    try { localStorage.setItem(STORAGE_KEY, String(next)); } catch {}

    if (next) {
      // Enabling — acquire lock NOW, in the user gesture call stack
      if (nativeSupported) {
        acquireNative();
      } else if (isIOS) {
        // CRITICAL: play() must be called directly from the tap handler
        const video = getOrCreateVideo();
        video.play().then(() => setActive(true)).catch(() => {});
      }
    } else {
      // Disabling
      releaseNative();
      stopVideo();
      setActive(false);
    }
  }, [enabled, nativeSupported, isIOS, acquireNative, releaseNative, getOrCreateVideo, stopVideo]);

  // On mount: if previously enabled, try to acquire (native only — iOS needs a gesture)
  useEffect(() => {
    if (!enabled) return;
    if (nativeSupported) {
      acquireNative();
    }
    // For iOS: we can't auto-play without a gesture, but we set up for
    // the next visibility change which counts as a user activation in some cases
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-acquire on visibility change (e.g. switching back to the tab)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible' || !enabled) return;
      if (nativeSupported) {
        acquireNative();
      } else if (isIOS && videoRef.current) {
        // Video exists from the original tap — just resume it
        videoRef.current.play().then(() => setActive(true)).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [enabled, nativeSupported, isIOS, acquireNative]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      releaseNative();
      stopVideo();
    };
  }, [releaseNative, stopVideo]);

  return { supported, enabled, active, toggle };
}
