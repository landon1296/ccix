import { supabase, League, LeagueMemberWithUser, ScoringConfig } from '../lib/supabase';

export async function createLeague(_userId: string, name: string): Promise<{ league: League | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('create_league', { p_name: name.trim() });
    if (error) return { league: null, error };
    const out = data as { ok?: boolean; error?: string; league?: League } | null;
    if (!out || out.ok !== true) return { league: null, error: new Error(out?.error ?? 'Failed to create league') };
    return { league: out.league ?? null, error: null };
  } catch (e) {
    return { league: null, error: e as Error };
  }
}

export async function joinLeague(_userId: string, leagueCodeOrId: string): Promise<{ league: League | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('join_league', { p_code_or_id: leagueCodeOrId.trim() });
    if (error) return { league: null, error };
    const out = data as { ok?: boolean; error?: string; league?: League } | null;
    if (!out || out.ok !== true) return { league: null, error: new Error(out?.error ?? 'Failed to join league') };
    return { league: out.league ?? null, error: null };
  } catch (e) {
    return { league: null, error: e as Error };
  }
}

export async function getUserLeagues(_userId: string): Promise<{ leagues: League[]; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('get_my_leagues');
    if (error) throw error;
    const arr = (data as League[] | null) ?? [];
    return { leagues: Array.isArray(arr) ? arr : [], error: null };
  } catch (e) {
    return { leagues: [], error: e as Error };
  }
}

export async function getLeague(leagueId: string): Promise<{ league: League | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('get_league', { p_league_id: leagueId });
    if (error) throw error;
    return { league: (data as League | null) ?? null, error: null };
  } catch (e) {
    return { league: null, error: e as Error };
  }
}

export async function getLeagueMembers(leagueId: string): Promise<{ members: LeagueMemberWithUser[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('league_members').select('*, user:users(*)').eq('league_id', leagueId);
    if (error) throw error;
    return { members: data as LeagueMemberWithUser[], error: null };
  } catch (error) {
    return { members: [], error: error as Error };
  }
}

export async function updateLeague(leagueId: string, updates: { name?: string; scoring_config?: ScoringConfig }): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.from('leagues').update(updates).eq('id', leagueId);
    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

export async function leaveLeague(userId: string, leagueId: string): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.from('league_members').delete().eq('league_id', leagueId).eq('user_id', userId);
    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

export async function deleteLeague(leagueId: string): Promise<{ error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('delete_league', { p_league_id: leagueId });
    if (error) return { error };
    const out = data as { ok?: boolean; error?: string } | null;
    if (!out || out.ok !== true) return { error: new Error(out?.error ?? 'Failed to delete league') };
    return { error: null };
  } catch (e) {
    return { error: e as Error };
  }
}

export async function kickMember(leagueId: string, userId: string): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.from('league_members').delete().eq('league_id', leagueId).eq('user_id', userId);
    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}
