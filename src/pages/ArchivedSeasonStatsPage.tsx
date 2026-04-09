import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Spinner } from '../components/Spinner';
import { CarAvatar } from '../utils/avatar';
import * as StatsService from '../services/stats';
import { supabase } from '../lib/supabase';

export function ArchivedSeasonStatsPage() {
  const { seasonId } = useParams<{ seasonId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [seasonName, setSeasonName] = useState('');
  const [standings, setStandings] = useState<StatsService.UserSeasonStats[]>([]);
  const [winner, setWinner] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!seasonId) return;
    (async () => {
      setLoading(true);
      const [standingsRes, seasonRes, winnerRes] = await Promise.all([
        StatsService.getSeasonStandings(seasonId),
        supabase.from('seasons').select('name').eq('id', seasonId).single(),
        StatsService.getSeasonWinner(seasonId),
      ]);
      setStandings(standingsRes.standings);
      setSeasonName((seasonRes.data as any)?.name ?? 'Season');
      if (winnerRes.winnerId) setWinner({ id: winnerRes.winnerId, name: winnerRes.winnerName ?? 'Unknown' });
      setLoading(false);
    })();
  }, [seasonId]);

  if (loading) return <div className="flex items-center justify-center h-48"><Spinner size={28} className="text-accent" /></div>;

  return (
    <div className="px-4 py-4">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <h1 className="font-bold text-lg">{seasonName}</h1>
      </div>

      {winner && (
        <div className="card mb-4 flex items-center gap-3 border-yellow-500/40 bg-yellow-500/5">
          <span className="text-2xl">🏆</span>
          <div>
            <div className="text-xs text-yellow-400 uppercase tracking-wider">Champion</div>
            <div className="font-bold">{winner.name}</div>
          </div>
        </div>
      )}

      {standings.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">No results for this season.</p>
      ) : (
        <div className="space-y-2">
          {standings.map((s, idx) => {
            const isMe = s.userId === user?.id;
            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
            return (
              <div key={s.userId} className={`flex items-center gap-3 rounded-xl px-3 py-3 border ${isMe ? 'bg-accent/10 border-accent/40' : 'bg-surface border-border'}`}>
                <span className="w-8 text-center">
                  {medal ?? <span className="text-gray-500 text-sm">{idx + 1}</span>}
                </span>
                <CarAvatar carNumber={s.carNumber} avatarStyle={s.avatarStyle} userId={s.userId} size={34} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{s.displayName}{isMe && <span className="text-accent text-xs ml-1">(you)</span>}</div>
                  <div className="text-xs text-gray-400">{s.wins}W · {s.top5s} T5 · {s.racesCompleted} races</div>
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
