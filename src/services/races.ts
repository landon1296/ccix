import { supabase, Race, RaceResult, ScoringConfig } from '../lib/supabase';
import { calculateTotalPoints } from '../utils/scoring';

export async function createRace(seasonId: string, trackName: string): Promise<{ race: Race | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('create_race', { p_season_id: seasonId, p_track_name: trackName });
    if (error) return { race: null, error: new Error(error?.message ?? 'Failed to add race') };
    const out = data as { ok?: boolean; error?: string; race?: Race } | null;
    if (!out || out.ok !== true) return { race: null, error: new Error(out?.error ?? 'Failed to add race') };
    return { race: out.race ?? null, error: null };
  } catch (e) {
    return { race: null, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

export async function bulkCreateRaces(seasonId: string, trackNames: string[]): Promise<{ error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('bulk_create_races', { p_season_id: seasonId, p_track_names: trackNames });
    if (error) return { error: new Error(error?.message ?? 'Failed to add races') };
    const out = data as { ok?: boolean; error?: string } | null;
    if (!out || out.ok !== true) return { error: new Error(out?.error ?? 'Failed to add races') };
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}

export async function getRaces(seasonId: string): Promise<{ races: Race[]; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('get_races', { p_season_id: seasonId });
    if (error) return { races: [], error: new Error(error?.message ?? 'Failed to fetch races') };
    const arr = (Array.isArray(data) ? data : []) as Race[];
    return { races: arr, error: null };
  } catch (e) {
    return { races: [], error: e instanceof Error ? e : new Error(String(e)) };
  }
}

export async function getRace(raceId: string): Promise<{ race: (Race & { league_id?: string }) | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('get_race', { p_race_id: raceId });
    if (error) return { race: null, error: new Error(error?.message ?? 'Failed to fetch race') };
    return { race: (data as Race & { league_id?: string }) ?? null, error: null };
  } catch (e) {
    return { race: null, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

export async function updateRace(raceId: string, trackName: string): Promise<{ error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('update_race', { p_race_id: raceId, p_track_name: trackName });
    if (error) return { error: new Error(error?.message ?? 'Failed to update race') };
    const out = data as { ok?: boolean; error?: string } | null;
    if (!out || out.ok !== true) return { error: new Error(out?.error ?? 'Failed to update race') };
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}

export async function reorderRaces(seasonId: string, raceIds: string[]): Promise<{ error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('reorder_races', { p_season_id: seasonId, p_race_ids: raceIds });
    if (error) return { error: new Error(error?.message ?? 'Failed to reorder') };
    const out = data as { ok?: boolean; error?: string } | null;
    if (!out || out.ok !== true) return { error: new Error(out?.error ?? 'Failed to reorder') };
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}

export async function deleteRace(raceId: string): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.from('races').delete().eq('id', raceId);
    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

export async function bulkDeleteRaces(seasonId: string, raceIds: string[]): Promise<{ error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('bulk_delete_races', { p_season_id: seasonId, p_race_ids: raceIds });
    if (error) return { error: new Error(error?.message ?? 'Failed to delete races') };
    const out = data as { ok?: boolean; error?: string } | null;
    if (!out || out.ok !== true) return { error: new Error(out?.error ?? 'Failed to delete races') };
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}

export async function copyScheduleFromSeason(sourceSeasonId: string, targetSeasonId: string): Promise<{ error: Error | null }> {
  try {
    const { races, error: fetchErr } = await getRaces(sourceSeasonId);
    if (fetchErr) return { error: fetchErr };
    if (races.length === 0) return { error: null };
    return bulkCreateRaces(targetSeasonId, races.map((r) => r.track_name));
  } catch (e) {
    return { error: e as Error };
  }
}

export async function submitRaceResult(
  raceId: string, userId: string,
  stage1Pos: number | null, stage2Pos: number | null, stage3Pos: number | null,
  finishPos: number, fastestLap: boolean,
  scoringConfig: ScoringConfig, effectiveStages?: number, trackName?: string,
  fastestLapTime?: string | null
): Promise<{ result: RaceResult | null; error: Error | null }> {
  try {
    const points = calculateTotalPoints(stage1Pos, stage2Pos, stage3Pos, finishPos, fastestLap, scoringConfig, effectiveStages, trackName);
    const { data: existing } = await supabase
      .from('race_results').select('id').eq('race_id', raceId).eq('user_id', userId).single();

    const payload = {
      stage1_pos: stage1Pos, stage2_pos: stage2Pos, stage3_pos: stage3Pos,
      finish_pos: finishPos, fastest_lap: fastestLap,
      fastest_lap_time: fastestLapTime?.trim() || null,
      stage1_points: points.stage1Points, stage2_points: points.stage2Points,
      stage3_points: points.stage3Points, finish_points: points.finishPoints,
      fastest_lap_points: points.fastestLapPoints, total_points: points.totalPoints,
    };

    let result;
    if (existing) {
      const { data, error } = await supabase.from('race_results').update(payload).eq('id', existing.id).select().single();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase.from('race_results').insert({ race_id: raceId, user_id: userId, ...payload }).select().single();
      if (error) throw error;
      result = data;
    }
    return { result: result as RaceResult, error: null };
  } catch (error) {
    return { result: null, error: error as Error };
  }
}

export async function getRaceResults(raceId: string): Promise<{ results: RaceResult[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('race_results').select('*').eq('race_id', raceId).order('finish_pos', { ascending: true });
    if (error) throw error;
    return { results: data as RaceResult[], error: null };
  } catch (error) {
    return { results: [], error: error as Error };
  }
}

export interface RaceResultWithUser extends RaceResult {
  users?: { display_name: string | null; email: string; car_number?: string | null; avatar_style?: string | null } | null;
}

export async function getRaceResultsWithUsers(raceId: string): Promise<{ results: RaceResultWithUser[]; error: Error | null }> {
  try {
    // Fetch results without the car/avatar join first (avoids failures if migration 021 not applied)
    const { data, error } = await supabase
      .from('race_results')
      .select('*, users(display_name, email)')
      .eq('race_id', raceId)
      .order('finish_pos', { ascending: true });
    if (error) throw error;
    const results = (data ?? []) as RaceResultWithUser[];

    // Enrich with car/avatar in a separate safe query
    if (results.length > 0) {
      const userIds = [...new Set(results.map(r => r.user_id))];
      try {
        const { data: profiles } = await supabase
          .from('users').select('id, car_number, avatar_style').in('id', userIds);
        if (profiles) {
          const profileMap = new Map((profiles as any[]).map(p => [p.id, p]));
          for (const r of results) {
            const p = profileMap.get(r.user_id);
            if (p && r.users) {
              (r.users as any).car_number = p.car_number ?? null;
              (r.users as any).avatar_style = p.avatar_style ?? null;
            }
          }
        }
      } catch {
        // Migration 021 not applied yet — avatars will show defaults
      }
    }

    return { results, error: null };
  } catch (error) {
    return { results: [], error: error as Error };
  }
}

export async function getUserRaceResult(raceId: string, userId: string): Promise<{ result: RaceResult | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('race_results').select('*').eq('race_id', raceId).eq('user_id', userId).single();
    if (error && error.code !== 'PGRST116') throw error;
    return { result: data as RaceResult | null, error: null };
  } catch (error) {
    return { result: null, error: error as Error };
  }
}

export async function deleteRaceResult(resultId: string): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.from('race_results').delete().eq('id', resultId);
    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}
