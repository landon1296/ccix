import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Spinner } from '../components/Spinner';
import { supabase } from '../lib/supabase';

type Tab = 'championships' | 'alltime';

interface Championship {
  seasonId: string;
  seasonName: string;
  leagueName: string;
  archivedAt: string;
}

interface WinsEntry {
  name: string;
  wins: number;
  isActive: boolean;
  /** true = this row is a CCIX league member, not a real NASCAR driver */
  isLeagueMember: boolean;
  /** true = this is the currently logged-in user */
  isCurrentUser: boolean;
}

export function TrophyRoomPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('championships');

  // Championships state
  const [championships, setChampionships] = useState<Championship[]>([]);
  const [champsLoading, setChampsLoading] = useState(true);
  const [totalChamps, setTotalChamps] = useState(0);

  // All-time wins state
  const [winsEntries, setWinsEntries] = useState<WinsEntry[]>([]);
  const [winsLoading, setWinsLoading] = useState(false);
  const winsLoadedRef = useRef(false);

  // Load championships on mount
  useEffect(() => {
    if (!user) return;
    (async () => {
      setChampsLoading(true);
      const { data: winnerRows } = await supabase
        .from('season_winners')
        .select('season_id')
        .eq('user_id', user.id);

      if (!winnerRows || winnerRows.length === 0) {
        setChampsLoading(false);
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
      setTotalChamps(champs.length);
      setChampsLoading(false);
    })();
  }, [user]);

  // Load all-time wins when that tab is selected
  useEffect(() => {
    if (tab !== 'alltime' || winsLoadedRef.current || !user) return;
    winsLoadedRef.current = true;
    (async () => {
      setWinsLoading(true);
      try {
        // Fetch NASCAR Cup drivers
        const { data: nascarDrivers } = await supabase
          .from('nascar_cup_drivers')
          .select('name, wins, is_active')
          .order('wins', { ascending: false });

        // Fetch all CCIX users' career wins across all leagues
        const { data: careerRows } = await supabase
          .from('user_career_stats')
          .select('user_id, wins, user:users(display_name)');

        // Build entries list
        const entries: WinsEntry[] = [];

        // Add all NASCAR drivers
        for (const d of (nascarDrivers ?? []) as any[]) {
          entries.push({
            name: d.name,
            wins: d.wins,
            isActive: d.is_active,
            isLeagueMember: false,
            isCurrentUser: false,
          });
        }

        // Add league members with at least 1 win
        for (const r of (careerRows ?? []) as any[]) {
          const memberWins = r.wins ?? 0;
          if (memberWins === 0) continue;
          entries.push({
            name: r.user?.display_name ?? 'Unknown',
            wins: memberWins,
            isActive: true,
            isLeagueMember: true,
            isCurrentUser: r.user_id === user.id,
          });
        }

        // Also add the current user even if 0 wins so they can see themselves
        const currentUserInList = (careerRows ?? [] as any[]).find((r: any) => r.user_id === user.id);
        if (!currentUserInList || (currentUserInList as any).wins === 0) {
          const { data: me } = await supabase
            .from('users')
            .select('display_name')
            .eq('id', user.id)
            .single();
          entries.push({
            name: (me as any)?.display_name ?? 'You',
            wins: (currentUserInList as any)?.wins ?? 0,
            isActive: true,
            isLeagueMember: true,
            isCurrentUser: true,
          });
        }

        // Sort by wins descending, then name ascending
        entries.sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name));

        setWinsEntries(entries);
      } catch (err) {
        console.error('Failed to load wins leaderboard:', err);
      }
      setWinsLoading(false);
    })();
  }, [tab, user]);

  return (
    <div className="px-4 py-4">
      <h1 className="font-bold text-xl mb-1">Trophy Room</h1>
      <p className="text-gray-400 text-sm mb-4">Your legacy, immortalized</p>

      {/* Tabs */}
      <div className="flex border-b border-border mb-4">
        {([
          ['championships', 'Championships'],
          ['alltime', 'All-Time Wins'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            className={`flex-1 pb-2 text-sm font-semibold transition-colors ${
              tab === key ? 'tab-active' : 'tab-inactive'
            }`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Championships tab */}
      {tab === 'championships' && (
        champsLoading ? (
          <div className="flex items-center justify-center h-48">
            <Spinner size={28} className="text-accent" />
          </div>
        ) : (
          <>
            {totalChamps > 0 && (
              <div className="card mb-5 flex items-center gap-4 border-yellow-500/30 bg-yellow-500/5">
                <span className="text-4xl">🏆</span>
                <div>
                  <div className="text-2xl font-black text-yellow-400">{totalChamps}</div>
                  <div className="text-sm text-gray-400">Championship{totalChamps !== 1 ? 's' : ''} Won</div>
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
          </>
        )
      )}

      {/* All-Time Wins tab */}
      {tab === 'alltime' && (
        winsLoading ? (
          <div className="flex items-center justify-center h-48">
            <Spinner size={28} className="text-accent" />
          </div>
        ) : (
          <AllTimeWinsList entries={winsEntries} />
        )
      )}
    </div>
  );
}

/** The wins leaderboard list component */
function AllTimeWinsList({ entries }: { entries: WinsEntry[] }) {
  // Find the current user entry to scroll to
  const currentUserRef = useRef<HTMLDivElement>(null);
  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    if (!hasScrolled && currentUserRef.current) {
      // Small delay so layout settles
      setTimeout(() => {
        currentUserRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHasScrolled(true);
      }, 300);
    }
  }, [entries, hasScrolled]);

  if (entries.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-3">🏁</div>
        <h2 className="font-bold mb-2">No Data Yet</h2>
        <p className="text-gray-400 text-sm">Win some races to appear on the board!</p>
      </div>
    );
  }

  // Assign ranks (handle ties)
  let rank = 1;
  const ranked = entries.map((entry, i) => {
    if (i > 0 && entry.wins < entries[i - 1].wins) {
      rank = i + 1;
    }
    return { ...entry, rank };
  });

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex items-center px-3 py-2 text-xs text-gray-500 font-semibold uppercase tracking-wider">
        <div className="w-10 text-center">#</div>
        <div className="flex-1">Driver</div>
        <div className="w-16 text-right">Wins</div>
      </div>

      {/* Entries */}
      {ranked.map((entry, i) => {
        const isHighlighted = entry.isLeagueMember;
        const isMe = entry.isCurrentUser;

        return (
          <div
            key={`${entry.name}-${i}`}
            ref={isMe ? currentUserRef : undefined}
            className={`flex items-center px-3 py-2.5 rounded-lg transition-colors ${
              isMe
                ? 'bg-accent/15 border border-accent/30'
                : isHighlighted
                  ? 'bg-accent/10 border border-accent/20'
                  : i % 2 === 0
                    ? 'bg-surface/50'
                    : ''
            }`}
          >
            {/* Rank */}
            <div className={`w-10 text-center font-bold text-sm ${
              entry.rank <= 3 ? 'text-yellow-400' : 'text-gray-500'
            }`}>
              {entry.rank}
            </div>

            {/* Driver info */}
            <div className="flex-1 min-w-0">
              <div className={`font-semibold text-sm truncate ${
                isMe ? 'text-accent' : isHighlighted ? 'text-accent' : 'text-white'
              }`}>
                {entry.name}
                {isMe && (
                  <span className="ml-2 text-[10px] font-bold bg-accent text-white px-1.5 py-0.5 rounded-full uppercase">
                    You
                  </span>
                )}
              </div>
              <div className="text-[11px] text-gray-500">
                {isHighlighted
                  ? 'CCIX League'
                  : entry.isActive
                    ? 'Active'
                    : 'Retired'}
              </div>
            </div>

            {/* Wins count */}
            <div className={`w-16 text-right font-black text-lg ${
              isMe ? 'text-accent' : isHighlighted ? 'text-accent' : 'text-white'
            }`}>
              {entry.wins}
            </div>
          </div>
        );
      })}

      {/* Footer note */}
      <div className="text-center text-[11px] text-gray-600 pt-4 pb-2">
        NASCAR Cup Series all-time wins · Auto-updates after each race
      </div>
    </div>
  );
}
