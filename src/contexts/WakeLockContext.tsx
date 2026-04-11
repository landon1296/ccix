import { createContext, useContext, type ReactNode } from 'react';
import { useWakeLock } from '../hooks/useWakeLock';

type WakeLockState = ReturnType<typeof useWakeLock>;

const WakeLockContext = createContext<WakeLockState | null>(null);

export function WakeLockProvider({ children }: { children: ReactNode }) {
  const wakeLock = useWakeLock();
  return (
    <WakeLockContext.Provider value={wakeLock}>
      {children}
    </WakeLockContext.Provider>
  );
}

export function useWakeLockContext(): WakeLockState {
  const ctx = useContext(WakeLockContext);
  if (!ctx) throw new Error('useWakeLockContext must be used within WakeLockProvider');
  return ctx;
}
