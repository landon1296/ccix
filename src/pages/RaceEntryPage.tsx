import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Spinner } from '../components/Spinner';
import { CarAvatar } from '../utils/avatar';
import * as RaceService from '../services/races';
import * as LeagueService from '../services/leagues';
import { getEffectiveStages } from '../utils/scoring';
import { Race } from '../lib/supabase';

export function RaceEntryPage() {
  const { raceId } = useParams<{ raceId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [race, setRace] = useState<(Race & { league_id?: string }) | null>(null);
  const [league, setLeague] = useState<any>(null);
  const [results, setResults] = useState<RaceService.RaceResultWithUser[]>([]);
  const [myResult, setMyResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [stage1, setStage1] = useState('');
  const [stage2, setStage2] = useState('');
  const [stage3, setStage3] = useState('');
  const [finish, setFinish] = useState('');
  const [fastestLap, setFastestLap] = useState(false);
  const [fastestLapTime, setFastestLapTime] = useState('');

  const load = useCallback(async () => {
    if (!raceId || !user) return;
    setLoading(true);
    const [{ race: r }, { results: res }] = await Promise.all([
      RaceService.getRace(raceId),
      RaceService.getRaceResultsWithUsers(raceId),
    ]);
    setRace(r);
    setResults(res);
    const mine = res.find(r2 => r2.user_id === user.id) ?? null;
    setMyResult(mine);
    if (mine) {
      setStage1(mine.stage1_pos?.toString() ?? '');
      setStage2(mine.stage2_pos?.toString() ?? '');
      setStage3(mine.stage3_pos?.toString() ?? '');
      setFinish(mine.finish_pos?.toString() ?? '');
      setFastestLap(mine.fastest_lap);
      setFastestLapTime(mine.fastest_lap_time ?? '');
    }
    if (r?.league_id) {
      const { league: lg } = await LeagueService.getLeague(r.league_id);
      setLeague(lg);
    }
    setLoading(false);
  }, [raceId, user]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    if (!raceId || !user || !race || !league) return;
    const finishPos = parseInt(finish);
    if (!finish || isNaN(finishPos) || finishPos < 1) { setError('Enter a valid finish position'); return; }
    setError('');
    setSaving(true);

    const stagesEnabled = league.scoring_config?.stagesEnabled ?? true;
    const effectiveStages = getEffectiveStages(stagesEnabled, race.track_name);
    const s1 = effectiveStages >= 1 && stage1 ? parseInt(stage1) : null;
    const s2 = effectiveStages >= 2 && stage2 ? parseInt(stage2) : null;
    const s3 = effectiveStages >= 3 && stage3 ? parseInt(stage3) : null;

    const { error: err } = await RaceService.submitRaceResult(
      raceId, user.id, s1, s2, s3, finishPos, fastestLap,
      league.scoring_config, effectiveStages, race.track_name,
      fastestLapTime || null
    );
    setSaving(false);
    if (err) { setError(err.message); return; }
    setSuccess('Result saved!');
    setTimeout(() => setSuccess(''), 2500);
    await load();
  };

  const handleDelete = async () => {
    if (!myResult) return;
    setSaving(true);
    await RaceService.deleteRaceResult(myResult.id);
    setSaving(false);
    setMyResult(null);
    setStage1(''); setStage2(''); setStage3('');
    setFinish(''); setFastestLap(false); setFastestLapTime('');
    await load();
  };

  if (loading) return <div className="flex items-center justify-center h-48"><Spinner size={28} className="text-accent" /></div>;
  if (!race) return <div className="px-4 py-8 text-center text-gray-400">Race not found.</div>;

  const stagesEnabled = league?.scoring_config?.stagesEnabled ?? true;
  const effectiveStages = getEffectiveStages(stagesEnabled, race.track_name);
  const fastestLapBonus = league?.scoring_config?.fastestLapBonus ?? 1;

  return (
    <div className="px-4 py-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div>
          <h1 className="font-bold text-lg">{race.track_name}</h1>
          <p className="text-xs text-gray-400">{race.race_id}</p>
        </div>
      </div>

      {/* Entry form */}
      <div className="card mb-5">
        <h2 className="font-bold mb-4">Your Result</h2>
        <div className="space-y-3">

          {/* Stage positions */}
          {effectiveStages >= 2 && (
            <div className={`grid gap-3 ${effectiveStages >= 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Stage 1</label>
                <input type="number" min="1" max="40" className="input-field" placeholder="Pos" value={stage1} onChange={e => setStage1(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Stage 2</label>
                <input type="number" min="1" max="40" className="input-field" placeholder="Pos" value={stage2} onChange={e => setStage2(e.target.value)} />
              </div>
              {effectiveStages >= 3 && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Stage 3</label>
                  <input type="number" min="1" max="40" className="input-field" placeholder="Pos" value={stage3} onChange={e => setStage3(e.target.value)} />
                </div>
              )}
            </div>
          )}

          {/* Finish position */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Finish Position *</label>
            <input
              type="number" min="1" max="40"
              className="input-field text-lg font-bold"
              placeholder="e.g. 3"
              value={finish}
              onChange={e => setFinish(e.target.value)}
            />
          </div>

          {/* Fastest lap checkbox + time input side by side */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2.5 cursor-pointer select-none flex-1">
              <div
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${fastestLap ? 'bg-accent border-accent' : 'border-border'}`}
                onClick={() => setFastestLap(!fastestLap)}
              >
                {fastestLap && (
                  <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M5 13l4 4L19 7"/>
                  </svg>
                )}
              </div>
              <span className="text-sm">
                Fastest Lap
                <span className="text-gray-500 text-xs ml-1">(+{fastestLapBonus} pt)</span>
              </span>
            </label>
          </div>

          {/* Fastest lap time field — always visible */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              ⚡ Fastest Lap Time
              <span className="text-gray-600 ml-1">(optional, e.g. 1:23.456)</span>
            </label>
            <input
              type="text"
              className="input-field font-mono"
              placeholder="1:23.456"
              value={fastestLapTime}
              onChange={e => setFastestLapTime(e.target.value.slice(0, 12))}
              maxLength={12}
            />
          </div>

        </div>

        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
        {success && <p className="text-green-400 text-sm mt-3">{success}</p>}

        <div className="flex gap-2 mt-4">
          <button
            className="btn-primary flex-1 flex items-center justify-center gap-2"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? <Spinner size={16} /> : null}
            {myResult ? 'Update Result' : 'Submit Result'}
          </button>
          {myResult && (
            <button className="btn-danger px-3" onClick={handleDelete} disabled={saving} title="Delete result">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4h6v2"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Results table */}
      {results.length > 0 && (
        <div className="card">
          <h2 className="font-bold mb-3">All Results</h2>
          <div className="space-y-2">
            {results.map((r, idx) => {
              const name = r.users?.display_name ?? r.users?.email ?? 'Unknown';
              const isMe = r.user_id === user?.id;
              return (
                <div
                  key={r.id}
                  className={`flex items-center gap-3 rounded-lg px-2 py-2.5 ${isMe ? 'bg-accent/10 border border-accent/30' : 'bg-surface-2'}`}
                >
                  <span className="text-gray-500 text-sm w-5 text-right flex-shrink-0">{idx + 1}</span>
                  <CarAvatar
                    carNumber={r.users?.car_number}
                    avatarStyle={r.users?.avatar_style}
                    userId={r.user_id}
                    size={28}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {name}
                      {isMe && <span className="text-accent text-xs ml-1">(you)</span>}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-2">
                      <span>P{r.finish_pos}</span>
                      {r.fastest_lap && <span className="text-yellow-400">⚡ FL</span>}
                      {r.fastest_lap_time && (
                        <span className="font-mono text-gray-400">{r.fastest_lap_time}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-black text-accent text-sm">{r.total_points}</div>
                    <div className="text-xs text-gray-500">pts</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
