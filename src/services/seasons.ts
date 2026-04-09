import { supabase, Season } from '../lib/supabase';

export async function createSeason(leagueId: string): Promise<{ season: Season | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('create_season', { p_league_id: leagueId });
    if (error) return { season: null, error: new Error(error?.message ?? 'Failed to create season') };
    const out = data as { ok?: boolean; error?: string; season?: Season } | null;
    if (!out || out.ok !== true) return { season: null, error: new Error(out?.error ?? 'Failed to create season') };
    return { season: out.season ?? null, error: null };
  } catch (e) {
    return { season: null, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

export async function getActiveSeason(leagueId: string): Promise<{ season: Season | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('get_active_season', { p_league_id: leagueId });
    if (error) return { season: null, error: new Error(error?.message ?? 'Failed to fetch active season') };
    return { season: (data as Season | null) ?? null, error: null };
  } catch (e) {
    return { season: null, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

export async function getSeasons(leagueId: string): Promise<{ seasons: Season[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('seasons').select('*').eq('league_id', leagueId).order('season_number', { ascending: false });
    if (error) throw error;
    return { seasons: data as Season[], error: null };
  } catch (error) {
    return { seasons: [], error: error as Error };
  }
}

export async function getArchivedSeasons(leagueId: string): Promise<{ seasons: Season[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('seasons').select('*').eq('league_id', leagueId).eq('is_archived', true)
      .order('season_number', { ascending: false });
    if (error) throw error;
    return { seasons: data as Season[], error: null };
  } catch (error) {
    return { seasons: [], error: error as Error };
  }
}

export async function getArchivedSeasonsWithResults(leagueId: string): Promise<{ seasons: Season[]; error: Error | null }> {
  try {
    const { seasons, error } = await getArchivedSeasons(leagueId);
    if (error) return { seasons: [], error };
    if (!seasons.length) return { seasons: [], error: null };
    const seasonIds = seasons.map((s) => s.id);
    const { data: rows, error: aggError } = await supabase
      .from('user_season_stats').select('season_id').in('season_id', seasonIds);
    if (aggError) return { seasons: [], error: aggError as Error };
    const idsWithResults = new Set(((rows ?? []) as { season_id: string }[]).map((r) => r.season_id));
    return { seasons: seasons.filter((s) => idsWithResults.has(s.id)), error: null };
  } catch (e) {
    return { seasons: [], error: e as Error };
  }
}

export async function finishSeason(seasonId: string): Promise<{ error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('finish_season', { p_season_id: seasonId });
    if (error) return { error };
    const out = data as { ok?: boolean; error?: string } | null;
    if (out && out.ok === false) return { error: new Error(out.error ?? 'Failed to finish season') };
    return { error: null };
  } catch (e) {
    return { error: e as Error };
  }
}

export async function updateSeasonName(seasonId: string, name: string): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.from('seasons').update({ name }).eq('id', seasonId);
    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

export async function deleteSeason(seasonId: string): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.from('seasons').delete().eq('id', seasonId);
    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}
