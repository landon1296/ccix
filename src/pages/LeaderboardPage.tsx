import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Spinner } from '../components/Spinner';
import { CarAvatar } from '../utils/avatar';
import * as LeagueService from '../services/leagues';
import * as SeasonService from '../services/seasons';
import * as StatsService from '../services/stats';
import { League, Season } from '../lib/supabase';

export function LeaderboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [season, setSeason] = useState<Season | null>(null);
  const [standings, setStandings] = useState<StatsService.UserSeasonStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (leagueOverride?: League) => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      let lg = leagueOverride;
      if (!lg) {
        const { leagues: ls } = await LeagueService.getUserLeagues(user.id);
        setLeagues(ls);
        lg = ls[0] ?? undefined;
        if (lg) setSelectedLeague(lg);
      }
      if (!lg) { setLoading(false); return; }
      const { season: s } = await SeasonService.getActiveSeason(lg.id);
      setSeason(s);
      if (s) {
        const { standings: st } = await StatsService.getSeasonStandings(s.id);
        setStandings(st);
      } else {
        setStandings([]);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const handleLeagueChange = async (leagueId: string) => {
    const lg = leagues.find(l => l.id === leagueId);
    if (!lg) return;
    setSelectedLeague(lg);
    await load(lg);
  };

  const handleRefresh = async () => {
    if (!selectedLeague || !season) return;
    setRefreshing(true);
    const { standings: st } = await StatsService.getSeasonStandings(season.id);
    setStandings(st);
    setRefreshing(false);
  };

  if (loading) return <div className="flex items-center justify-center h-48"><Spinner size={28} className="text-accent" /></div>;

  return (
    <div className="px-4 py-4">
      {leagues.length > 1 && (
        <div className="mb-4">
          <select className="input-field" value={selectedLeague?.id ?? ''} onChange={e => handleLeagueChange(e.target.value)}>
            {leagues.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-bold text-lg">{season?.name ?? 'Standings'}</h2>
          {selectedLeague && <p className="text-xs text-gray-400">{selectedLeague.name}</p>}
        </div>
        <button onClick={handleRefresh} disabled={refreshing} className="text-gray-400 hover:text-white p-1">
          <svg className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
          </svg>
        </button>
      </div>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      {!season ? (
        <div className="card text-center py-8">
          <p className="text-gray-400">No active season.</p>
          {leagues.length === 0 && (
            <button className="btn-primary mt-4" onClick={() => navigate('/app/settings/league/create')}>Create League</button>
          )}
        </div>
      ) : standings.length === 0 ? (
        <div className="card text-center py-8">
          <div className="text-3xl mb-2">🏎️</div>
          <p className="text-gray-400 text-sm">No results yet. Enter race results to see standings.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {standings.map((s, idx) => {
            const isMe = s.userId === user?.id;
            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
            return (
              <div
                key={s.userId}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 border ${
                  isMe ? 'bg-accent/10 border-accent/40' : 'bg-surface border-border'
                }`}
              >
                <span className="w-8 text-center">
                  {medal ?? <span className="text-gray-500 text-sm">{idx + 1}</span>}
                </span>
                <CarAvatar carNumber={s.carNumber} avatarStyle={s.avatarStyle} userId={s.userId} size={34} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">
                    {s.displayName}{isMe && <span className="text-accent text-xs ml-1">(you)</span>}
                  </div>
                  <div className="text-xs text-gray-400">
                    {s.wins}W · {s.top5s} T5 · {s.racesCompleted} races · avg P{s.averageFinish}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-accent">{s.totalPoints}</div>
                  <div className="text-xs text-gray-500">pts</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
