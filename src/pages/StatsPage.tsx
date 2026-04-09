import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Spinner } from '../components/Spinner';
import { CarAvatar } from '../utils/avatar';
import * as LeagueService from '../services/leagues';
import * as SeasonService from '../services/seasons';
import * as StatsService from '../services/stats';
import { League, Season } from '../lib/supabase';

type Tab = 'my' | 'league' | 'bytrack';
type TrackView = 'mine' | 'league';

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-surface-2 rounded-lg p-3 text-center">
      <div className="text-xl font-black text-accent">{value}</div>
      <div className="text-xs text-gray-400 mt-0.5">{label}</div>
    </div>
  );
}

/** Group league track stats by track name, sorted by avg finish within each track */
function groupByTrack(
  data: (StatsService.TrackStats & { userId: string; displayName: string })[]
): Map<string, (StatsService.TrackStats & { userId: string; displayName: string })[]> {
  const map = new Map<string, (StatsService.TrackStats & { userId: string; displayName: string })[]>();
  for (const row of data) {
    const list = map.get(row.trackName) ?? [];
    list.push(row);
    map.set(row.trackName, list);
  }
  // Sort each track's members by totalPoints desc, then wins desc
  for (const [, members] of map) {
    members.sort((a, b) => b.totalPoints !== a.totalPoints ? b.totalPoints - a.totalPoints : b.wins - a.wins);
  }
  return map;
}

export function StatsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('my');
  const [trackView, setTrackView] = useState<TrackView>('league');

  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);
  const [archivedSeasons, setArchivedSeasons] = useState<Season[]>([]);

  // My Stats
  const [careerStats, setCareerStats] = useState<StatsService.UserSeasonStats | null>(null);
  const [currentSeasonStats, setCurrentSeasonStats] = useState<StatsService.UserSeasonStats | null>(null);
  const [loadingMy, setLoadingMy] = useState(true);

  // League tab (lazy)
  const [leagueMembers, setLeagueMembers] = useState<StatsService.UserSeasonStats[]>([]);
  const [loadingLeague, setLoadingLeague] = useState(false);
  const leagueLoaded = useRef(false);

  // By Track tab (lazy) — both mine and league data
  const [myTracks, setMyTracks] = useState<StatsService.TrackStats[]>([]);
  const [leagueTracks, setLeagueTracks] = useState<
    (StatsService.TrackStats & { userId: string; displayName: string })[]
  >([]);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const tracksLoaded = useRef(false);

  const loadMyStats = useCallback(async () => {
    if (!user) return;
    setLoadingMy(true);
    try {
      const { leagues: ls } = await LeagueService.getUserLeagues(user.id);
      setLeagues(ls);
      const lg = ls[0] ?? null;
      setSelectedLeague(lg);

      const [{ stats: career }, activeSeasonRes, bonusMap] = await Promise.all([
        StatsService.getCareerStats(user.id),
        lg ? SeasonService.getActiveSeason(lg.id) : Promise.resolve({ season: null, error: null }),
        StatsService.getBonusStats([user.id]),
      ]);

      const bonusMe = bonusMap.get(user.id);
      const careerWithBonus = career ? {
        ...career,
        grandSlams: bonusMe?.grandSlams ?? 0,
        crownJewelWins: bonusMe?.crownJewelWins ?? 0,
      } : career;
      setCareerStats(careerWithBonus);
      const active = (activeSeasonRes as any).season as Season | null;
      setActiveSeason(active);

      if (active) {
        const { standings } = await StatsService.getSeasonStandings(active.id);
        const mine = standings.find(s => s.userId === user.id) ?? null;
        setCurrentSeasonStats(mine);
      }

      if (lg) {
        const { seasons } = await SeasonService.getArchivedSeasonsWithResults(lg.id);
        setArchivedSeasons(seasons);
      }
    } finally {
      setLoadingMy(false);
    }
  }, [user]);

  useEffect(() => { loadMyStats(); }, [loadMyStats]);

  const loadLeagueTab = useCallback(async () => {
    if (!selectedLeague || leagueLoaded.current) return;
    setLoadingLeague(true);
    leagueLoaded.current = true;
    const { members } = await StatsService.getLeagueMemberStats(selectedLeague.id);
    const bonusMap = await StatsService.getBonusStats(members.map(m => m.userId));
    const enriched = members.map(m => {
      const b = bonusMap.get(m.userId);
      return { ...m, grandSlams: b?.grandSlams ?? 0, crownJewelWins: b?.crownJewelWins ?? 0 };
    });
    setLeagueMembers(enriched);
    setLoadingLeague(false);
  }, [selectedLeague]);

  const loadTracksTab = useCallback(async () => {
    if (!user || tracksLoaded.current) return;
    setLoadingTracks(true);
    tracksLoaded.current = true;
    const results = await Promise.all([
      StatsService.getMyStatsByTrack(user.id),
      selectedLeague ? StatsService.getLeagueMemberStatsByTrack(selectedLeague.id) : Promise.resolve({ tracks: [], error: null }),
    ]);
    setMyTracks(results[0].tracks);
    setLeagueTracks((results[1] as any).tracks ?? []);
    setLoadingTracks(false);
  }, [user, selectedLeague]);

  const handleTabChange = (t: Tab) => {
    setTab(t);
    if (t === 'league') loadLeagueTab();
    if (t === 'bytrack') loadTracksTab();
  };

  const handleLeagueChange = async (leagueId: string) => {
    const lg = leagues.find(l => l.id === leagueId) ?? null;
    setSelectedLeague(lg);
    leagueLoaded.current = false;
    tracksLoaded.current = false;
    if (!lg || !user) return;
    setLoadingMy(true);
    const [activeRes, archivedRes, careerRes] = await Promise.all([
      SeasonService.getActiveSeason(lg.id),
      SeasonService.getArchivedSeasonsWithResults(lg.id),
      StatsService.getCareerStats(user.id),
    ]);
    setActiveSeason(activeRes.season);
    setArchivedSeasons(archivedRes.seasons);
    setCareerStats(careerRes.stats);
    if (activeRes.season) {
      const { standings } = await StatsService.getSeasonStandings(activeRes.season.id);
      setCurrentSeasonStats(standings.find(s => s.userId === user.id) ?? null);
    } else {
      setCurrentSeasonStats(null);
    }
    setLoadingMy(false);
    if (tab === 'league') { setLeagueMembers([]); loadLeagueTab(); }
    if (tab === 'bytrack') { setMyTracks([]); setLeagueTracks([]); loadTracksTab(); }
  };

  // Grouped league track data (memoized inline)
  const leagueTrackMap = groupByTrack(leagueTracks);
  const sortedTrackNames = Array.from(leagueTrackMap.keys()).sort();

  return (
    <div className="flex flex-col">
      {/* League selector */}
      {leagues.length > 1 && (
        <div className="px-4 pt-4">
          <select className="input-field" value={selectedLeague?.id ?? ''} onChange={e => handleLeagueChange(e.target.value)}>
            {leagues.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex border-b border-border mt-3 px-4">
        {(['my', 'league', 'bytrack'] as Tab[]).map(t => (
          <button
            key={t}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tab === t ? 'tab-active' : 'tab-inactive'}`}
            onClick={() => handleTabChange(t)}
          >
            {t === 'my' ? 'My Stats' : t === 'league' ? 'League' : 'By Track'}
          </button>
        ))}
      </div>

      <div className="px-4 py-4">
        {/* My Stats Tab */}
        {tab === 'my' && (
          loadingMy ? <div className="flex justify-center py-8"><Spinner size={24} className="text-accent" /></div> : (
            <div className="space-y-5">
              {/* Career Stats */}
              <section>
                <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-2">Career Stats</h3>
                {careerStats ? (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <StatCard label="Total Pts" value={careerStats.totalPoints} />
                      <StatCard label="Wins" value={careerStats.wins} />
                      <StatCard label="Races" value={careerStats.racesCompleted} />
                      <StatCard label="Top 5s" value={careerStats.top5s} />
                      <StatCard label="Top 10s" value={careerStats.top10s} />
                      <StatCard label="Avg Finish" value={`P${careerStats.averageFinish}`} />
                      <StatCard label="Fast Laps" value={careerStats.fastLapCount} />
                      <StatCard label="Pts / Race" value={careerStats.racesCompleted > 0 ? (careerStats.totalPoints / careerStats.racesCompleted).toFixed(1) : '—'} />
                      <StatCard label="Win Rate" value={careerStats.racesCompleted > 0 ? `${((careerStats.wins / careerStats.racesCompleted) * 100).toFixed(1)}%` : '—'} />
                    </div>
                    {((careerStats.championshipsWon ?? 0) > 0 || (careerStats.grandSlams ?? 0) > 0 || (careerStats.crownJewelWins ?? 0) > 0) && (
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        {(careerStats.championshipsWon ?? 0) > 0 && (
                          <StatCard label="Championships" value={careerStats.championshipsWon!} />
                        )}
                        {(careerStats.grandSlams ?? 0) > 0 && (
                          <StatCard label="Grand Slams" value={careerStats.grandSlams!} />
                        )}
                        {(careerStats.crownJewelWins ?? 0) > 0 && (
                          <StatCard label="Crown Jewels" value={careerStats.crownJewelWins!} />
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-gray-400 text-sm">No career stats yet.</p>
                )}
              </section>

              {/* Current Season */}
              {currentSeasonStats && (
                <section>
                  <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                    {activeSeason?.name ?? 'Current Season'}
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    <StatCard label="Points" value={currentSeasonStats.totalPoints} />
                    <StatCard label="Wins" value={currentSeasonStats.wins} />
                    <StatCard label="Races" value={currentSeasonStats.racesCompleted} />
                    <StatCard label="Top 5s" value={currentSeasonStats.top5s} />
                    <StatCard label="Top 10s" value={currentSeasonStats.top10s} />
                    <StatCard label="Avg Finish" value={`P${currentSeasonStats.averageFinish}`} />
                  </div>
                </section>
              )}

              {/* Archived Seasons */}
              {archivedSeasons.length > 0 && (
                <section>
                  <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-2">Archived Seasons</h3>
                  <div className="space-y-1">
                    {archivedSeasons.map(s => (
                      <button
                        key={s.id}
                        className="w-full text-left card hover:border-accent/50 transition-colors flex items-center justify-between py-3"
                        onClick={() => navigate(`/app/stats/season/${s.id}`)}
                      >
                        <span className="text-sm font-medium">{s.name}</span>
                        <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {leagues.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-400 text-sm mb-4">Join a league to track your stats.</p>
                  <button className="btn-primary" onClick={() => navigate('/app/settings/league/join')}>Join League</button>
                </div>
              )}
            </div>
          )
        )}

        {/* League Stats Tab */}
        {tab === 'league' && (
          loadingLeague ? <div className="flex justify-center py-8"><Spinner size={24} className="text-accent" /></div> : (
            leagueMembers.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No member stats available.</p>
            ) : (
              <div className="space-y-2">
                {leagueMembers.map((m, idx) => {
                  const isMe = m.userId === user?.id;
                  return (
                    <div key={m.userId} className={`card flex items-center gap-3 ${isMe ? 'border-accent/40' : ''}`}>
                      <span className="text-gray-500 text-sm w-5">{idx + 1}</span>
                      <CarAvatar carNumber={m.carNumber} avatarStyle={m.avatarStyle} userId={m.userId} size={32} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{m.displayName}{isMe && <span className="text-accent text-xs ml-1">(you)</span>}</div>
                        <div className="text-xs text-gray-400">{m.wins}W · {m.racesCompleted} races · avg P{m.averageFinish}</div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                          {(m.championshipsWon ?? 0) > 0 && <span className="text-xs text-yellow-400">{m.championshipsWon} title{m.championshipsWon !== 1 ? 's' : ''}</span>}
                          {(m.grandSlams ?? 0) > 0 && <span className="text-xs text-purple-400">{m.grandSlams} grand slam{(m.grandSlams ?? 0) !== 1 ? 's' : ''}</span>}
                          {(m.crownJewelWins ?? 0) > 0 && <span className="text-xs text-yellow-300">{m.crownJewelWins} crown jewel{(m.crownJewelWins ?? 0) !== 1 ? 's' : ''}</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-accent">{m.totalPoints}</div>
                        <div className="text-xs text-gray-500">pts</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )
        )}

        {/* By Track Tab */}
        {tab === 'bytrack' && (
          loadingTracks
            ? <div className="flex justify-center py-8"><Spinner size={24} className="text-accent" /></div>
            : (
              <div>
                {/* Mine / League toggle */}
                <div className="flex rounded-lg bg-surface-2 p-0.5 mb-4">
                  <button
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${trackView === 'league' ? 'bg-accent text-white' : 'text-gray-400 hover:text-white'}`}
                    onClick={() => setTrackView('league')}
                  >
                    League
                  </button>
                  <button
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${trackView === 'mine' ? 'bg-accent text-white' : 'text-gray-400 hover:text-white'}`}
                    onClick={() => setTrackView('mine')}
                  >
                    My Stats
                  </button>
                </div>

                {/* League by-track view */}
                {trackView === 'league' && (
                  sortedTrackNames.length === 0
                    ? <p className="text-gray-400 text-sm text-center py-8">No track stats yet. Enter race results to see per-track breakdowns.</p>
                    : (
                      <div className="space-y-3">
                        {sortedTrackNames.map(trackName => {
                          const members = leagueTrackMap.get(trackName)!;
                          return (
                            <div key={trackName} className="card">
                              {/* Track header */}
                              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                                <span className="font-semibold text-sm text-white">{trackName}</span>
                                <span className="text-xs text-gray-500 ml-auto">{members[0]?.racesCompleted ?? 0} race{(members[0]?.racesCompleted ?? 0) !== 1 ? 's' : ''}</span>
                              </div>

                              {/* Member rows */}
                              <div className="space-y-2">
                                {members.map((m, idx) => {
                                  const isMe = m.userId === user?.id;
                                  return (
                                    <div
                                      key={m.userId}
                                      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${isMe ? 'bg-accent/10 border border-accent/30' : 'bg-surface-2'}`}
                                    >
                                      <span className="text-gray-500 text-xs w-4 text-right flex-shrink-0">{idx + 1}</span>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium truncate">
                                          {m.displayName}
                                          {isMe && <span className="text-accent text-xs ml-1">(you)</span>}
                                        </div>
                                        <div className="text-xs text-gray-500 flex flex-wrap gap-x-2 mt-0.5">
                                          <span>avg P{m.averageFinish}</span>
                                          <span>{m.wins}W</span>
                                          <span>{m.top5s} top‑5</span>
                                          <span>{m.top10s} top‑10</span>
                                          {m.fastLapCount > 0 && <span className="text-yellow-400">⚡{m.fastLapCount} FL</span>}
                                        </div>
                                      </div>
                                      <div className="text-right flex-shrink-0">
                                        <div className="font-black text-accent text-sm">{m.totalPoints}</div>
                                        <div className="text-xs text-gray-500">pts</div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                )}

                {/* My by-track view */}
                {trackView === 'mine' && (
                  myTracks.length === 0
                    ? <p className="text-gray-400 text-sm text-center py-8">No track stats yet. Enter race results to see per-track breakdowns.</p>
                    : (
                      <div className="space-y-2">
                        {myTracks.map(t => (
                          <div key={t.trackName} className="card">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-medium text-sm">{t.trackName}</span>
                            </div>
                            <div className="grid grid-cols-5 gap-2 text-center">
                              <div><div className="text-accent font-bold text-sm">{t.totalPoints}</div><div className="text-xs text-gray-500">pts</div></div>
                              <div><div className="font-bold text-sm">{t.wins}</div><div className="text-xs text-gray-500">wins</div></div>
                              <div><div className="font-bold text-sm">{t.top5s}</div><div className="text-xs text-gray-500">top‑5</div></div>
                              <div><div className="font-bold text-sm">{t.top10s}</div><div className="text-xs text-gray-500">top‑10</div></div>
                              <div><div className="font-bold text-sm">P{t.averageFinish}</div><div className="text-xs text-gray-500">avg</div></div>
                            </div>
                            {t.fastLapCount > 0 && (
                              <div className="mt-1.5 text-xs text-yellow-400">⚡ {t.fastLapCount} fastest lap{t.fastLapCount !== 1 ? 's' : ''}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                )}
              </div>
            )
        )}
      </div>
    </div>
  );
}
