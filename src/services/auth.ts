import { supabase, User } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';

/** Build a minimal User from Supabase auth data (no DB query needed). */
function authUserToMinimal(authUser: { id: string; email?: string; created_at?: string }): User {
  return {
    id: authUser.id,
    email: authUser.email ?? '',
    display_name: null,
    car_number: null,
    avatar_style: null,
    created_at: authUser.created_at ?? new Date().toISOString(),
  };
}

export async function signUp(email: string, password: string): Promise<{ user: User | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error('No user returned from signup');
    return { user: authUserToMinimal(data.user), error: null };
  } catch (error) {
    return { user: null, error: error as Error };
  }
}

export async function signIn(email: string, password: string): Promise<{ user: User | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error('No user returned from signin');
    // Return immediately from auth data — profile is loaded in background by onAuthStateChange
    return { user: authUserToMinimal(data.user), error: null };
  } catch (error) {
    return { user: null, error: error as Error };
  }
}

export async function signOut(): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Fetch the full profile row. Returns null on any error — callers should fall back to auth data. */
export async function fetchProfile(userId: string): Promise<User | null> {
  try {
    const { data } = await supabase
      .from('users').select('*').eq('id', userId).maybeSingle();
    return data as User | null;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const profile = await fetchProfile(session.user.id);
  return profile ?? authUserToMinimal(session.user);
}

export async function updateDisplayName(userId: string, displayName: string): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.from('users').update({ display_name: displayName }).eq('id', userId);
    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

export async function updateCarProfile(userId: string, carNumber: string, avatarStyle: string): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.from('users').update({ car_number: carNumber, avatar_style: avatarStyle }).eq('id', userId);
    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

export function onAuthStateChange(callback: (user: User | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      // Set minimal user immediately so the app unblocks, then enrich with profile
      const minimal = authUserToMinimal(session.user);
      callback(minimal);
      // Fire-and-forget profile enrichment
      fetchProfile(session.user.id).then(profile => {
        if (profile) callback(profile);
      });
    } else {
      callback(null);
    }
  });
  return () => { data.subscription.unsubscribe(); };
}
