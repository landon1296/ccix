import { supabase } from '../lib/supabase';
import { CROWN_JEWEL_TRACKS } from '../utils/scoring';

export interface UserSeasonStats {
  userId: string;
  displayName: string;
  carNumber?: string | null;
  avatarStyle?: string | null;
  totalPoints: number;
  wins: number;
  top5s: number;
  top10s: number;
  fastLapCount: number;
  racesCompleted: number;
  averageFinish: number;
  isChampion?: boolean;
  championshipsWon?: number;
  grandSlams?: number;
  crownJewelWins?: number;
}

export interface TrackStats {
  trackName: string;
  totalPoints: number;
  wins: number;
  top5s: number;
  top10s: number;
  fastLapCount: number;
  racesCompleted: number;
  averageFinish: number;
}

/** Fetch car_number + avatar_style for a list of user IDs in one query.
 *  Silently fails (returns empty map) if migration 021 hasn't been applied yet. */
async function fetchCarProfiles(userIds: string[]): Promise<Map<string, { car_number: string | null; avatar_style: string | null }>> {
  const map = new Map<string, { car_number: string | null; avatar_style: string | null }>();
  if (userIds.length === 0) return map;
  try {
    const { data } = await supabase
      .from('users')
      .select('id, car_number, avatar_style')
      .in('id', userIds);
    for (const u of (data ?? []) as any[]) {
      map.set(u.id, { car_number: u.car_number ?? null, avatar_style: u.avatar_style ?? null });
    }
  } catch {
    // Migration 021 may not be applied yet — degrade gracefully, avatars show defaults
  }
  return map;
}

/** Try aggregates first; fall back to computing from raw race_results. */
export async function getSeasonStandings(
  seasonId: string
): Promise<{ standings: UserSeasonStats[]; error: Error | null }> {
  const { standings: agg, error: aggErr } = await getSeasonStandingsFromAggregates(seasonId);
  if (!aggErr && agg.length > 0) return { standings: agg, error: null };

  // Fallback: compute from raw race_results
  try {
    // Use get_races RPC to bypass RLS on races table
    const { data: racesData, error: racesError } = await supabase.rpc('get_races', { p_season_id: seasonId });
    if (racesError) throw racesError;
    const races = (Array.isArray(racesData) ? racesData : []) as { id: string }[];
    if (races.length === 0) return { standings: [], error: null };

    const raceIds = races.map((r) => r.id);

    // Fetch results — join only display_name to avoid car_number/avatar_style column errors
    const { data: results, error: resultsError } = await supabase
      .from('race_results')
      .select('*, user:users(display_name)')
      .in('race_id', raceIds);
    if (resultsError) throw resultsError;

    const userStatsMap = new Map<string, UserSeasonStats>();
    for (const result of (results as any[])) {
      const uid = result.user_id;
      if (!userStatsMap.has(uid)) {
        userStatsMap.set(uid, {
          userId: uid,
          displayName: result.user?.display_name || 'Unknown',
          totalPoints: 0, wins: 0, top5s: 0, top10s: 0,
          fastLapCount: 0, racesCompleted: 0, averageFinish: 0,
        });
      }
      const stats = userStatsMap.get(uid)!;
      stats.totalPoints += result.total_points || 0;
      stats.racesCompleted += 1;
      if (result.finish_pos === 1) stats.wins += 1;
      if (result.finish_pos <= 5) stats.top5s += 1;
      if (result.finish_pos <= 10) stats.top10s += 1;
      if (result.fastest_lap) stats.fastLapCount += 1;
    }

    const standings = Array.from(userStatsMap.values()).map((stats) => {
      const userResults = (results as any[]).filter((r) => r.user_id === stats.userId);
      const totalFinishPos = userResults.reduce((sum: number, r: any) => sum + (r.finish_pos || 0), 0);
      stats.averageFinish = stats.racesCompleted > 0
        ? Math.round((totalFinishPos / stats.racesCompleted) * 10) / 10 : 0;
      return stats;
    });
    standings.sort((a, b) => b.totalPoints !== a.totalPoints ? b.totalPoints - a.totalPoints : b.wins - a.wins);

    // Enrich with car/avatar (safe — won't break standings if columns missing)
    const carProfiles = await fetchCarProfiles(standings.map((s) => s.userId));
    for (const s of standings) {
      const p = carProfiles.get(s.userId);
      if (p) { s.carNumber = p.car_number; s.avatarStyle = p.avatar_style; }
    }

    return { standings, error: null };
  } catch (error) {
    return { standings: [], error: error as Error };
  }
}

export async function getSeasonStandingsFromAggregates(
  seasonId: string
): Promise<{ standings: UserSeasonStats[]; error: Error | null }> {
  try {
    // Fetch aggregate stats — only display_name in the join (safe if migration 021 not yet applied)
    const { data: rows, error } = await supabase
      .from('user_season_stats')
      .select('*, user:users(display_name)')
      .eq('season_id', seasonId)
      .order('total_points', { ascending: false })
      .order('wins', { ascending: false });
    if (error) throw error;

    const standings: UserSeasonStats[] = ((rows ?? []) as any[]).map((r) => ({
      userId: r.user_id,
      displayName: r.user?.display_name ?? 'Unknown',
      totalPoints: r.total_points ?? 0,
      wins: r.wins ?? 0,
      top5s: r.top5s ?? 0,
      top10s: r.top10s ?? 0,
      fastLapCount: r.fast_lap_count ?? 0,
      racesCompleted: r.races_completed ?? 0,
      averageFinish: Number(r.average_finish) || 0,
      isChampion: !!r.is_champion,
    }));

    // Enrich with car/avatar separately (safe fallback if columns missing)
    if (standings.length > 0) {
      const carProfiles = await fetchCarProfiles(standings.map((s) => s.userId));
      for (const s of standings) {
        const p = carProfiles.get(s.userId);
        if (p) { s.carNumber = p.car_number; s.avatarStyle = p.avatar_style; }
      }
    }

    return { standings, error: null };
  } catch (e) {
    return { standings: [], error: e as Error };
  }
}

export async function getCareerStats(
  userId: string
): Promise<{ stats: UserSeasonStats | null; error: Error | null }> {
  try {
    const { data: row, error } = await supabase
      .from('user_career_stats')
      .select('*, user:users(display_name)')
      .eq('user_id', userId)
      .single();
    if (error || !row) return getUserAllTimeStats(userId);
    const r = row as any;
    const carProfiles = await fetchCarProfiles([userId]);
    const p = carProfiles.get(userId);
    return {
      stats: {
        userId: r.user_id,
        displayName: r.user?.display_name ?? 'You',
        carNumber: p?.car_number ?? null,
        avatarStyle: p?.avatar_style ?? null,
        totalPoints: r.total_points ?? 0,
        wins: r.wins ?? 0,
        top5s: r.top5s ?? 0,
        top10s: r.top10s ?? 0,
        fastLapCount: r.fast_lap_count ?? 0,
        racesCompleted: r.races_completed ?? 0,
        averageFinish: Number(r.average_finish) || 0,
        championshipsWon: r.championships_won ?? 0,
      },
      error: null,
    };
  } catch (e) {
    return { stats: null, error: e as Error };
  }
}

export async function getUserAllTimeStats(
  userId: string,
  displayName?: string
): Promise<{ stats: UserSeasonStats; error: Error | null }> {
  try {
    const { data: results, error } = await supabase
      .from('race_results').select('*').eq('user_id', userId);
    if (error) throw error;
    const list = (results as any[]) ?? [];
    let totalPoints = 0, wins = 0, top5s = 0, top10s = 0, fastLapCount = 0, totalFinishPos = 0;
    for (const r of list) {
      totalPoints += r.total_points || 0;
      if (r.finish_pos === 1) wins += 1;
      if (r.finish_pos <= 5) top5s += 1;
      if (r.finish_pos <= 10) top10s += 1;
      if (r.fastest_lap) fastLapCount += 1;
      totalFinishPos += r.finish_pos || 0;
    }
    const racesCompleted = list.length;
    const averageFinish = racesCompleted > 0
      ? Math.round((totalFinishPos / racesCompleted) * 10) / 10 : 0;
    return {
      stats: { userId, displayName: displayName ?? 'You', totalPoints, wins, top5s, top10s, fastLapCount, racesCompleted, averageFinish },
      error: null,
    };
  } catch (err) {
    return {
      stats: { userId, displayName: displayName ?? 'You', totalPoints: 0, wins: 0, top5s: 0, top10s: 0, fastLapCount: 0, racesCompleted: 0, averageFinish: 0 },
      error: err as Error,
    };
  }
}

export async function getSeasonStats(
  seasonId: string,
  userId: string
): Promise<{ stats: UserSeasonStats | null; error: Error | null }> {
  try {
    const { data: row, error } = await supabase
      .from('user_season_stats')
      .select('*, user:users(display_name)')
      .eq('season_id', seasonId)
      .eq('user_id', userId)
      .single();
    if (error || !row) return { stats: null, error: null };
    const r = row as any;
    return {
      stats: {
        userId: r.user_id,
        displayName: r.user?.display_name ?? 'Unknown',
        totalPoints: r.total_points ?? 0,
        wins: r.wins ?? 0,
        top5s: r.top5s ?? 0,
        top10s: r.top10s ?? 0,
        fastLapCount: r.fast_lap_count ?? 0,
        racesCompleted: r.races_completed ?? 0,
        averageFinish: Number(r.average_finish) || 0,
        isChampion: !!r.is_champion,
      },
      error: null,
    };
  } catch (e) {
    return { stats: null, error: e as Error };
  }
}

export async function getMyStatsByTrack(
  userId: string
): Promise<{ tracks: TrackStats[]; error: Error | null }> {
  try {
    const { data: rows, error } = await supabase
      .from('user_track_stats').select('*').eq('user_id', userId).order('track_name');
    if (error) throw error;
    const tracks: TrackStats[] = ((rows ?? []) as any[]).map((r) => ({
      trackName: r.track_name,
      totalPoints: r.total_points ?? 0,
      wins: r.wins ?? 0, top5s: r.top5s ?? 0, top10s: r.top10s ?? 0,
      fastLapCount: r.fast_lap_count ?? 0, racesCompleted: r.races_completed ?? 0,
      averageFinish: Number(r.average_finish) || 0,
    }));
    return { tracks, error: null };
  } catch (e) {
    return { tracks: [], error: e as Error };
  }
}

export async function getLeagueMemberStats(
  leagueId: string
): Promise<{ members: UserSeasonStats[]; error: Error | null }> {
  try {
    const { data: memberRows } = await supabase
      .from('league_members').select('user_id').eq('league_id', leagueId);
    const userIds = ((memberRows ?? []) as any[]).map((m) => m.user_id as string);
    if (userIds.length === 0) return { members: [], error: null };

    const [{ data: users }, { data: careerRows }, carProfiles] = await Promise.all([
      supabase.from('users').select('id, display_name').in('id', userIds),
      supabase.from('user_career_stats').select('*').in('user_id', userIds),
      fetchCarProfiles(userIds),
    ]);

    const userMap = new Map(((users ?? []) as any[]).map((u) => [u.id, u.display_name ?? 'Unknown']));
    const careerMap = new Map(((careerRows ?? []) as any[]).map((r) => [r.user_id, r]));

    const out: UserSeasonStats[] = userIds.map((uid) => {
      const c = careerMap.get(uid) as any;
      const p = carProfiles.get(uid);
      return {
        userId: uid,
        displayName: userMap.get(uid) ?? 'Unknown',
        carNumber: p?.car_number ?? null,
        avatarStyle: p?.avatar_style ?? null,
        totalPoints: c?.total_points ?? 0,
        wins: c?.wins ?? 0, top5s: c?.top5s ?? 0, top10s: c?.top10s ?? 0,
        fastLapCount: c?.fast_lap_count ?? 0, racesCompleted: c?.races_completed ?? 0,
        averageFinish: Number(c?.average_finish) || 0,
        championshipsWon: c?.championships_won ?? 0,
      };
    });
    out.sort((a, b) => b.totalPoints - a.totalPoints || b.wins - a.wins);
    return { members: out, error: null };
  } catch (e) {
    return { members: [], error: e as Error };
  }
}

export async function getLeagueMemberStatsByTrack(
  leagueId: string
): Promise<{ tracks: (TrackStats & { userId: string; displayName: string })[]; error: Error | null }> {
  try {
    const { data: rows, error } = await supabase
      .from('user_league_track_stats').select('*').eq('league_id', leagueId);
    if (error) throw error;
    const list = (rows ?? []) as any[];
    const userIds = [...new Set(list.map((r) => r.user_id))];
    const { data: users } = await supabase.from('users').select('id, display_name').in('id', userIds);
    const userMap = new Map(((users ?? []) as any[]).map((u) => [u.id, u.display_name ?? 'Unknown']));
    return {
      tracks: list.map((r) => ({
        userId: r.user_id,
        displayName: userMap.get(r.user_id) ?? 'Unknown',
        trackName: r.track_name,
        totalPoints: r.total_points ?? 0, wins: r.wins ?? 0,
        top5s: r.top5s ?? 0, top10s: r.top10s ?? 0,
        fastLapCount: r.fast_lap_count ?? 0, racesCompleted: r.races_completed ?? 0,
        averageFinish: Number(r.average_finish) || 0,
      })),
      error: null,
    };
  } catch (e) {
    return { tracks: [], error: e as Error };
  }
}

/**
 * Compute grand slam and crown jewel win counts for a list of users.
 * Queries race_results + races directly — works across all seasons.
 * Silently returns empty map on any error.
 */
export async function getBonusStats(
  userIds: string[]
): Promise<Map<string, { grandSlams: number; crownJewelWins: number }>> {
  const map = new Map<string, { grandSlams: number; crownJewelWins: number }>();
  if (userIds.length === 0) return map;
  try {
    const { data: results } = await supabase
      .from('race_results')
      .select('user_id, race_id, stage1_pos, stage2_pos, stage3_pos, finish_pos, fastest_lap')
      .in('user_id', userIds);
    if (!results || (results as any[]).length === 0) return map;

    const raceIds = [...new Set((results as any[]).map((r: any) => r.race_id as string))];
    const { data: races } = await supabase
      .from('races').select('id, track_name').in('id', raceIds);
    const trackMap = new Map(((races ?? []) as any[]).map((r: any) => [r.id as string, r.track_name as string]));

    for (const r of results as any[]) {
      const track = trackMap.get(r.race_id) ?? '';
      // Grand slam: won every stage (that has a recorded position) + won the race + fastest lap
      const stagesWon =
        r.stage1_pos === 1 && r.stage2_pos === 1 &&
        (r.stage3_pos == null || r.stage3_pos === 1);
      const isGrandSlam = stagesWon && r.finish_pos === 1 && r.fastest_lap === true;
      const isCrownJewelWin = r.finish_pos === 1 && CROWN_JEWEL_TRACKS.includes(track);

      if (isGrandSlam || isCrownJewelWin) {
        const entry = map.get(r.user_id) ?? { grandSlams: 0, crownJewelWins: 0 };
        if (isGrandSlam) entry.grandSlams += 1;
        if (isCrownJewelWin) entry.crownJewelWins += 1;
        map.set(r.user_id, entry);
      }
    }
  } catch {
    // optional enrichment — never break standings
  }
  return map;
}

// ─── Lap Times ────────────────────────────────────────────────────────────────

export interface TrackLapTimes {
  trackName: string;
  /** Fastest recorded lap at this track */
  bestLap: string;
  /** All lap times sorted fastest → slowest */
  allLaps: { lapTime: string }[];
}

function parseLapTime(lapTime: string): number {
  const parts = lapTime.split(':');
  if (parts.length === 2) return parseInt(parts[0], 10) * 60 + parseFloat(parts[1]);
  return parseFloat(lapTime);
}

/** Return the current user's recorded fastest lap times grouped by track. */
export async function getMyLapTimesByTrack(
  userId: string
): Promise<{ tracks: TrackLapTimes[]; error: Error | null }> {
  try {
    const { data: results, error } = await supabase
      .from('race_results')
      .select('fastest_lap_time, race_id')
      .eq('user_id', userId)
      .not('fastest_lap_time', 'is', null);
    if (error) throw error;
    const list = (results ?? []) as any[];
    if (list.length === 0) return { tracks: [], error: null };

    const raceIds = [...new Set(list.map((r) => r.race_id as string))];
    const { data: races } = await supabase
      .from('races').select('id, track_name').in('id', raceIds);
    const trackMap = new Map(((races ?? []) as any[]).map((r) => [r.id as string, r.track_name as string]));

    const trackLaps = new Map<string, string[]>();
    for (const r of list) {
      const track = trackMap.get(r.race_id);
      if (!track || !r.fastest_lap_time) continue;
      const laps = trackLaps.get(track) ?? [];
      laps.push(r.fastest_lap_time as string);
      trackLaps.set(track, laps);
    }

    const tracks: TrackLapTimes[] = [];
    for (const [trackName, laps] of trackLaps) {
      const sorted = [...laps].sort((a, b) => parseLapTime(a) - parseLapTime(b));
      tracks.push({
        trackName,
        bestLap: sorted[0],
        allLaps: sorted.map((l) => ({ lapTime: l })),
      });
    }
    tracks.sort((a, b) => a.trackName.localeCompare(b.trackName));
    return { tracks, error: null };
  } catch (e) {
    return { tracks: [], error: e as Error };
  }
}

/**
 * Return each league member's best lap time at every track they've raced.
 * Result: Map<trackName, Map<userId, bestLapTime>>
 */
export async function getLeagueLapTimesByTrack(
  leagueId: string
): Promise<{ lapMap: Map<string, Map<string, string>>; error: Error | null }> {
  try {
    const { data: memberRows } = await supabase
      .from('league_members').select('user_id').eq('league_id', leagueId);
    const userIds = ((memberRows ?? []) as any[]).map((m) => m.user_id as string);
    if (userIds.length === 0) return { lapMap: new Map(), error: null };

    const { data: results, error } = await supabase
      .from('race_results')
      .select('user_id, race_id, fastest_lap_time')
      .in('user_id', userIds)
      .not('fastest_lap_time', 'is', null);
    if (error) throw error;
    const list = (results ?? []) as any[];
    if (list.length === 0) return { lapMap: new Map(), error: null };

    const raceIds = [...new Set(list.map((r) => r.race_id as string))];
    const { data: races } = await supabase
      .from('races').select('id, track_name').in('id', raceIds);
    const trackMap = new Map(((races ?? []) as any[]).map((r) => [r.id as string, r.track_name as string]));

    // Map<trackName, Map<userId, bestLapTime>>
    const lapMap = new Map<string, Map<string, string>>();
    for (const r of list) {
      const track = trackMap.get(r.race_id);
      if (!track || !r.fastest_lap_time) continue;
      const byUser = lapMap.get(track) ?? new Map<string, string>();
      const existing = byUser.get(r.user_id);
      if (!existing || parseLapTime(r.fastest_lap_time as string) < parseLapTime(existing)) {
        byUser.set(r.user_id, r.fastest_lap_time as string);
      }
      lapMap.set(track, byUser);
    }
    return { lapMap, error: null };
  } catch (e) {
    return { lapMap: new Map(), error: e as Error };
  }
}

export async function getSeasonWinner(
  seasonId: string
): Promise<{ winnerId: string | null; winnerName: string | null }> {
  try {
    const { data } = await supabase
      .from('season_winners').select('user_id, users(display_name)').eq('season_id', seasonId).single();
    if (!data) return { winnerId: null, winnerName: null };
    const d = data as any;
    return { winnerId: d.user_id, winnerName: d.users?.display_name ?? null };
  } catch {
    return { winnerId: null, winnerName: null };
  }
}
