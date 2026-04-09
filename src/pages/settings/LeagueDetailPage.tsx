import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Spinner } from '../../components/Spinner';
import { CarAvatar } from '../../utils/avatar';
import * as LeagueService from '../../services/leagues';
import * as SeasonService from '../../services/seasons';
import { League, LeagueMemberWithUser, Season } from '../../lib/supabase';

export function LeagueDetailPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<LeagueMemberWithUser[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [showLeave, setShowLeave] = useState(false);
  const [showStartSeason, setShowStartSeason] = useState(false);

  const load = useCallback(async () => {
    if (!leagueId) return;
    setLoading(true);
    const [{ league: lg }, { members: mem }, { season: active }, { seasons: ss }] = await Promise.all([
      LeagueService.getLeague(leagueId),
      LeagueService.getLeagueMembers(leagueId),
      SeasonService.getActiveSeason(leagueId),
      SeasonService.getSeasons(leagueId),
    ]);
    setLeague(lg);
    setMembers(mem);
    setActiveSeason(active);
    setSeasons(ss);
    setLoading(false);
  }, [leagueId]);

  useEffect(() => { load(); }, [load]);

  const isOwner = league?.owner_id === user?.id;

  const handleKick = async (memberId: string) => {
    if (!leagueId) return;
    setActionLoading(memberId);
    await LeagueService.kickMember(leagueId, memberId);
    setMembers(prev => prev.filter(m => m.user_id !== memberId));
    setActionLoading('');
  };

  const handleLeave = async () => {
    if (!leagueId || !user) return;
    setActionLoading('leave');
    const { error: err } = await LeagueService.leaveLeague(user.id, leagueId);
    setActionLoading('');
    if (err) { setError(err.message); return; }
    navigate('/app/settings', { replace: true });
  };

  const handleDelete = async () => {
    if (!leagueId) return;
    setActionLoading('delete');
    const { error: err } = await LeagueService.deleteLeague(leagueId);
    setActionLoading('');
    if (err) { setError(err.message); return; }
    navigate('/app/settings', { replace: true });
  };

  const handleStartSeason = async () => {
    if (!leagueId) return;
    setActionLoading('season');
    const { season: s, error: err } = await SeasonService.createSeason(leagueId);
    setActionLoading('');
    if (err) { setError(err.message); return; }
    setActiveSeason(s);
    setShowStartSeason(false);
    navigate(`/app/races/manage/${s?.id}`);
  };

  if (loading) return <div className="flex items-center justify-center h-48"><Spinner size={28} className="text-accent" /></div>;
  if (!league) return <div className="px-4 py-8 text-center text-gray-400">League not found.</div>;

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <h1 className="font-bold text-lg">{league.name}</h1>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {/* League info */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Join Code</div>
            <div className="font-mono font-bold text-xl text-accent tracking-widest">{league.league_code}</div>
          </div>
          <div className="text-right text-xs text-gray-500">
            <div>{members.length} member{members.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
      </div>

      {/* Active Season */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold text-sm">Active Season</h2>
          {isOwner && !activeSeason && (
            <button className="btn-primary text-xs py-1.5 px-3" onClick={() => setShowStartSeason(true)}>Start Season</button>
          )}
        </div>
        {activeSeason ? (
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">{activeSeason.name}</div>
              <div className="text-xs text-gray-400">{activeSeason.season_id}</div>
            </div>
            <button
              className="btn-secondary text-xs py-1.5 px-3"
              onClick={() => navigate(`/app/races/manage/${activeSeason.id}`)}
            >
              Manage
            </button>
          </div>
        ) : (
          <p className="text-gray-400 text-sm">No active season.</p>
        )}
      </div>

      {/* Scoring */}
      {isOwner && (
        <button
          className="w-full card hover:border-accent/50 transition-colors flex items-center justify-between"
          onClick={() => navigate(`/app/settings/scoring/${leagueId}`)}
        >
          <span className="font-medium text-sm">Scoring Settings</span>
          <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      )}

      {/* Members */}
      <div className="card">
        <h2 className="font-bold mb-3">Members</h2>
        <div className="space-y-2">
          {members.map(m => {
            const u = m.user;
            const isMe = u.id === user?.id;
            const isLeagueOwner = u.id === league.owner_id;
            return (
              <div key={m.user_id} className="flex items-center gap-3">
                <CarAvatar carNumber={u.car_number} avatarStyle={u.avatar_style} userId={u.id} size={32} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {u.display_name ?? u.email}
                    {isMe && <span className="text-accent text-xs ml-1">(you)</span>}
                    {isLeagueOwner && <span className="text-yellow-400 text-xs ml-1">👑</span>}
                  </div>
                  <div className="text-xs text-gray-500">{u.email}</div>
                </div>
                {isOwner && !isMe && (
                  <button
                    className="text-red-500 hover:text-red-400 text-xs px-2 py-1 rounded border border-red-500/30"
                    onClick={() => handleKick(m.user_id)}
                    disabled={actionLoading === m.user_id}
                  >
                    {actionLoading === m.user_id ? '...' : 'Kick'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Season History */}
      {seasons.filter(s => s.is_archived).length > 0 && (
        <div className="card">
          <h2 className="font-bold mb-3">Season History</h2>
          <div className="space-y-1">
            {seasons.filter(s => s.is_archived).map(s => (
              <button
                key={s.id}
                className="w-full text-left flex items-center justify-between rounded-lg px-3 py-2.5 bg-surface-2 hover:bg-[#2d2d2d] transition-colors"
                onClick={() => navigate(`/app/stats/season/${s.id}`)}
              >
                <span className="text-sm">{s.name}</span>
                <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Leave / Delete */}
      <div className="space-y-2">
        {!isOwner && (
          <button className="btn-danger w-full" onClick={() => setShowLeave(true)}>Leave League</button>
        )}
        {isOwner && (
          <button className="btn-danger w-full" onClick={() => setShowDelete(true)}>Delete League</button>
        )}
      </div>

      {/* Confirm modals */}
      {showLeave && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4">
          <div className="bg-surface rounded-xl p-5 w-full max-w-sm border border-border">
            <h3 className="font-bold text-lg mb-2">Leave League?</h3>
            <p className="text-gray-400 text-sm mb-5">You'll lose access to this league's races and standings.</p>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setShowLeave(false)}>Cancel</button>
              <button className="btn-danger flex-1" onClick={handleLeave} disabled={actionLoading === 'leave'}>
                {actionLoading === 'leave' ? <Spinner size={16} /> : 'Leave'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDelete && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4">
          <div className="bg-surface rounded-xl p-5 w-full max-w-sm border border-border">
            <h3 className="font-bold text-lg mb-2">Delete League?</h3>
            <p className="text-gray-400 text-sm mb-5">This permanently deletes the league, all seasons, and all race results. This cannot be undone.</p>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setShowDelete(false)}>Cancel</button>
              <button className="btn-danger flex-1" onClick={handleDelete} disabled={actionLoading === 'delete'}>
                {actionLoading === 'delete' ? <Spinner size={16} /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showStartSeason && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4">
          <div className="bg-surface rounded-xl p-5 w-full max-w-sm border border-border">
            <h3 className="font-bold text-lg mb-2">Start New Season?</h3>
            <p className="text-gray-400 text-sm mb-5">A new season will be created for {league.name}. You can add races afterward.</p>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setShowStartSeason(false)}>Cancel</button>
              <button className="btn-primary flex-1" onClick={handleStartSeason} disabled={actionLoading === 'season'}>
                {actionLoading === 'season' ? <Spinner size={16} /> : 'Start Season'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
