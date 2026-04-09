import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Spinner } from '../components/Spinner';
import { supabase } from '../lib/supabase';

interface Championship {
  seasonId: string;
  seasonName: string;
  leagueName: string;
  archivedAt: string;
}

export function TrophyRoomPage() {
  const { user } = useAuth();
  const [championships, setChampionships] = useState<Championship[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalWins, setTotalWins] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: winnerRows } = await supabase
        .from('season_winners')
        .select('season_id')
        .eq('user_id', user.id);

      if (!winnerRows || winnerRows.length === 0) {
        setLoading(false);
        return;
      }

      const seasonIds = winnerRows.map((r: any) => r.season_id);
      const { data: seasons } = await supabase
        .from('seasons')
        .select('id, name, archived_at, leagues(name)')
        .in('id', seasonIds)
        .order('archived_at', { ascending: false });

      const champs: Championship[] = ((seasons ?? []) as any[]).map(s => ({
        seasonId: s.id,
        seasonName: s.name,
        leagueName: s.leagues?.name ?? 'Unknown League',
        archivedAt: s.archived_at ?? '',
      }));

      setChampionships(champs);
      setTotalWins(champs.length);
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <div className="flex items-center justify-center h-48"><Spinner size={28} className="text-accent" /></div>;

  return (
    <div className="px-4 py-4">
      <h1 className="font-bold text-xl mb-1">Trophy Room</h1>
      <p className="text-gray-400 text-sm mb-5">Your championship victories</p>

      {totalWins > 0 && (
        <div className="card mb-5 flex items-center gap-4 border-yellow-500/30 bg-yellow-500/5">
          <span className="text-4xl">🏆</span>
          <div>
            <div className="text-2xl font-black text-yellow-400">{totalWins}</div>
            <div className="text-sm text-gray-400">Championship{totalWins !== 1 ? 's' : ''} Won</div>
          </div>
        </div>
      )}

      {championships.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-5xl mb-3">🏁</div>
          <h2 className="font-bold mb-2">No Championships Yet</h2>
          <p className="text-gray-400 text-sm">Win a season to earn a trophy!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {championships.map(c => (
            <div key={c.seasonId} className="card flex items-center gap-4">
              <div className="text-3xl">🏆</div>
              <div className="flex-1 min-w-0">
                <div className="font-bold">{c.seasonName}</div>
                <div className="text-sm text-gray-400">{c.leagueName}</div>
                {c.archivedAt && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    {new Date(c.archivedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}
                  </div>
                )}
              </div>
              <svg className="w-5 h-5 text-yellow-400" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
              </svg>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
