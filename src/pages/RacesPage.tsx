import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Spinner } from '../components/Spinner';
import { CarAvatar } from '../utils/avatar';
import * as LeagueService from '../services/leagues';
import * as SeasonService from '../services/seasons';
import * as RaceService from '../services/races';
import { getBonusEarners } from '../utils/scoring';
import { supabase } from '../lib/supabase';
import { League, Season, Race } from '../lib/supabase';

interface RaceRowResult {
  race_id: string;
  user_id: string;
  stage1_pos: number | null;
  stage2_pos: number | null;
  stage3_pos: number | null;
  finish_pos: number;
  fastest_lap: boolean;
  total_points: number;
  users?: { display_name: string | null; email: string } | null;
}

export function RacesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [season, setSeason] = useState<Season | null>(null);
  const [races, setRaces] = useState<Race[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [resultsByRace, setResultsByRace] = useState<Map<string, RaceRowResult[]>>(new Map());
  const [completedRaceIds, setCompletedRaceIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (leagueOverride?: League) => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      let league = leagueOverride;
      if (!league) {
        const { leagues: ls, error: leagueErr } = await LeagueService.getUserLeagues(user.id);
        if (leagueErr) throw leagueErr;
        setLeagues(ls);
        league = ls[0];
        if (league) setSelectedLeague(league);
      }
      if (!league) { setLoading(false); return; }

      const [{ season: s }, membersRes] = await Promise.all([
        SeasonService.getActiveSeason(league.id),
        LeagueService.getLeagueMembers(league.id),
      ]);

      setSeason(s);
      const mCount = membersRes.members.length;
      setMemberCount(mCount);

      if (s) {
        const { races: r } = await RaceService.getRaces(s.id);
        setRaces(r);

        if (r.length > 0 && mCount > 0) {
          const raceIds = r.map(rc => rc.id);
          // Single batch query — much faster than N individual fetches
          const { data: allResults } = await supabase
            .from('race_results')
            .select('race_id, user_id, stage1_pos, stage2_pos, stage3_pos, finish_pos, fastest_lap, total_points, users(display_name, email)')
            .in('race_id', raceIds);

          const byRace = new Map<string, RaceRowResult[]>();
          for (const res of (allResults ?? []) as unknown as RaceRowResult[]) {
            const list = byRace.get(res.race_id) ?? [];
            list.push(res);
            byRace.set(res.race_id, list);
          }
          setResultsByRace(byRace);

          const completed = new Set(raceIds.filter(id => (byRace.get(id)?.length ?? 0) >= mCount));
          setCompletedRaceIds(completed);
        } else {
          setResultsByRace(new Map());
          setCompletedRaceIds(new Set());
        }
      } else {
        setRaces([]);
        setResultsByRace(new Map());
        setCompletedRaceIds(new Set());
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const handleLeagueChange = async (leagueId: string) => {
    const league = leagues.find(l => l.id === leagueId);
    if (!league) return;
    setSelectedLeague(league);
    await load(league);
  };

  const handleStartSeason = async () => {
    if (!selectedLeague) return;
    setLoading(true);
    const { season: s, error: err } = await SeasonService.createSeason(selectedLeague.id);
    if (err) { setError(err.message); setLoading(false); return; }
    setSeason(s); setRaces([]); setLoading(false);
  };

  if (loading) return <div className="flex items-center justify-center h-48"><Spinner size={28} className="text-accent" /></div>;

  if (leagues.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <div className="text-4xl mb-3">🏁</div>
        <h2 className="text-lg font-bold mb-2">No Leagues Yet</h2>
        <p className="text-gray-400 text-sm mb-6">Create or join a league to get started.</p>
        <div className="flex gap-3 justify-center">
          <button className="btn-primary" onClick={() => navigate('/app/settings/league/create')}>Create League</button>
          <button className="btn-secondary" onClick={() => navigate('/app/settings/league/join')}>Join League</button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      {/* League selector */}
      {leagues.length > 1 && (
        <div className="mb-4">
          <select className="input-field" value={selectedLeague?.id ?? ''} onChange={e => handleLeagueChange(e.target.value)}>
            {leagues.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
      )}

      {/* League / season header */}
      {selectedLeague && (
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-lg">{selectedLeague.name}</h2>
            {season && <p className="text-gray-400 text-sm">{season.name}</p>}
          </div>
          {season && (
            <button className="btn-secondary text-sm py-1.5 px-3" onClick={() => navigate(`/app/races/manage/${season.id}`)}>
              Manage
            </button>
          )}
        </div>
      )}

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      {/* No active season */}
      {!season ? (
        <div className="card text-center py-8">
          <div className="text-3xl mb-2">🏎️</div>
          <h3 className="font-bold mb-1">No Active Season</h3>
          <p className="text-gray-400 text-sm mb-4">Start a new season to begin tracking races.</p>
          {selectedLeague?.owner_id === user?.id && (
            <button className="btn-primary" onClick={handleStartSeason}>Start Season</button>
          )}
        </div>
      ) : races.length === 0 ? (
        <div className="card text-center py-8">
          <div className="text-3xl mb-2">📋</div>
          <h3 className="font-bold mb-1">No Races Scheduled</h3>
          <p className="text-gray-400 text-sm mb-4">Add races to the season schedule.</p>
          <button className="btn-primary" onClick={() => navigate(`/app/races/manage/${season.id}`)}>Add Races</button>
        </div>
      ) : (
        <div className="space-y-2">
          {races.map((race, idx) => {
            const isComplete = completedRaceIds.has(race.id);
            const results = resultsByRace.get(race.id) ?? [];
            const config = selectedLeague?.scoring_config;
            const submittedCount = results.length;

            // Compute bonus earners for completed races
            const earners = isComplete && config && results.length > 0
              ? getBonusEarners({
                  results: results.map(r => ({
                    stage1_pos: r.stage1_pos,
                    stage2_pos: r.stage2_pos,
                    stage3_pos: r.stage3_pos,
                    finish_pos: r.finish_pos,
                    fastest_lap: r.fastest_lap,
                    displayName: r.users?.display_name ?? r.users?.email ?? 'Unknown',
                  })),
                  config,
                  trackName: race.canonical_track_name ?? race.track_name,
                })
              : null;

            const hasBonuses = earners && (earners.allStagesWin || earners.grandSlam || earners.crownJewel);

            return (
              <button
                key={race.id}
                className={`w-full text-left rounded-xl border px-4 py-3 transition-all flex items-start gap-3 ${
                  isComplete
                    ? 'bg-green-600/25 border-green-500/60 hover:bg-green-600/35'
                    : 'bg-surface border-border hover:border-accent/50'
                }`}
                onClick={() => navigate(`/app/races/${race.id}`)}
              >
                {/* Race number */}
                <span className="text-gray-500 text-sm font-mono w-6 text-right flex-shrink-0 mt-0.5">{idx + 1}</span>

                {/* Center content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium truncate ${isComplete ? 'text-green-300' : ''}`}>
                      {race.race_name || race.track_name}
                    </span>
                    {isComplete && <span className="text-base leading-none flex-shrink-0">🏁</span>}
                  </div>
                  {race.race_name && (
                    <div className="text-[11px] text-gray-500">{race.track_name}</div>
                  )}
                  <div className="text-xs text-gray-500 mt-0.5">
                    {isComplete
                      ? `All ${memberCount} results submitted`
                      : submittedCount > 0
                        ? `${submittedCount} / ${memberCount} submitted`
                        : race.race_id}
                  </div>

                  {/* Submitted avatars row */}
                  {submittedCount > 0 && (
                    <div className="flex items-center gap-1 mt-1.5">
                      {results.slice(0, 8).map(r => (
                        <CarAvatar key={r.user_id} userId={r.user_id} size={18} className="rounded" />
                      ))}
                      {results.length > 8 && <span className="text-xs text-gray-500">+{results.length - 8}</span>}
                    </div>
                  )}

                  {/* Bonus earners */}
                  {hasBonuses && (
                    <div className="mt-1.5 space-y-0.5">
                      {earners!.grandSlam && (
                        <div className="text-xs text-yellow-400">🌟 Grand Slam: {earners!.grandSlam.displayName}</div>
                      )}
                      {earners!.allStagesWin && !earners!.grandSlam && (
                        <div className="text-xs text-orange-400">⭐ All Stages Win: {earners!.allStagesWin.displayName}</div>
                      )}
                      {earners!.crownJewel && (
                        <div className="text-xs text-yellow-300">👑 Crown Jewel: {earners!.crownJewel.displayName}</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Checkered flag pattern stripe on the right when complete */}
                {isComplete ? (
                  <CheckeredBadge />
                ) : (
                  <svg className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Small inline checkered flag SVG badge */
function CheckeredBadge() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" className="flex-shrink-0 mt-0.5">
      {/* 4x4 checkered grid */}
      {[0,1,2,3].flatMap(row =>
        [0,1,2,3].map(col => (
          <rect
            key={`${row}-${col}`}
            x={col * 5} y={row * 5} width="5" height="5"
            fill={(row + col) % 2 === 0 ? '#ffffff' : '#111111'}
          />
        ))
      )}
    </svg>
  );
}
