import React, { createContext, useState, useEffect, useContext } from 'react';
import { User } from '../lib/supabase';
import * as AuthService from '../services/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<{ error: Error | null }>;
  updateCarProfile: (carNumber: string, avatarStyle: string) => Promise<{ error: Error | null }>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const session = await Promise.race([
          AuthService.getSession(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
        ]);
        if (!session?.user) {
          if (!cancelled) { setUser(null); setLoading(false); }
          return;
        }
        const currentUser = await Promise.race([
          AuthService.getCurrentUser(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
        ]);
        if (!cancelled) setUser(currentUser ?? null);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();

    const unsubscribe = AuthService.onAuthStateChange((u) => {
      if (!cancelled) { setUser(u); setLoading(false); }
    });

    return () => { cancelled = true; unsubscribe(); };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { user: newUser, error } = await AuthService.signIn(email, password);
    if (!error && newUser) setUser(newUser);
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const { user: newUser, error } = await AuthService.signUp(email, password);
    if (!error && newUser) setUser(newUser);
    return { error };
  };

  const signOut = async () => {
    await AuthService.signOut();
    setUser(null);
  };

  const updateDisplayName = async (name: string) => {
    if (!user) return { error: new Error('No user logged in') };
    const { error } = await AuthService.updateDisplayName(user.id, name);
    if (!error) setUser({ ...user, display_name: name });
    return { error };
  };

  const updateCarProfile = async (carNumber: string, avatarStyle: string) => {
    if (!user) return { error: new Error('No user logged in') };
    const { error } = await AuthService.updateCarProfile(user.id, carNumber, avatarStyle);
    if (!error) setUser({ ...user, car_number: carNumber, avatar_style: avatarStyle });
    return { error };
  };

  const refreshUser = async () => {
    const u = await AuthService.getCurrentUser();
    if (u) setUser(u);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, updateDisplayName, updateCarProfile, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
