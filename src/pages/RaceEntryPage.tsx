import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Spinner } from '../components/Spinner';
import { CarAvatar } from '../utils/avatar';
import * as RaceService from '../services/races';
import * as LeagueService from '../services/leagues';
import { getEffectiveStages } from '../utils/scoring';
import { Race } from '../lib/supabase';
import { playBoogity } from '../utils/boogity';

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

  // Navigation: prev/next race in the season
  const [prevRaceId, setPrevRaceId] = useState<string | null>(null);
  const [nextRaceId, setNextRaceId] = useState<string | null>(null);

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
      const [{ league: lg }, { races: seasonRaces }] = await Promise.all([
        LeagueService.getLeague(r.league_id),
        RaceService.getRaces(r.season_id),
      ]);
      setLeague(lg);

      // Find prev/next race by race_number
      const sorted = seasonRaces.sort((a: Race, b: Race) => a.race_number - b.race_number);
      const idx = sorted.findIndex((sr: Race) => sr.id === raceId);
      setPrevRaceId(idx > 0 ? sorted[idx - 1].id : null);
      setNextRaceId(idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1].id : null);
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
    const canonicalName = race.canonical_track_name ?? race.track_name;
    const effectiveStages = getEffectiveStages(stagesEnabled, canonicalName);
    const s1 = effectiveStages >= 1 && stage1 ? parseInt(stage1) : null;
    const s2 = effectiveStages >= 2 && stage2 ? parseInt(stage2) : null;
    const s3 = effectiveStages >= 3 && stage3 ? parseInt(stage3) : null;

    const { error: err } = await RaceService.submitRaceResult(
      raceId, user.id, s1, s2, s3, finishPos, fastestLap,
      league.scoring_config, effectiveStages, canonicalName,
      fastestLapTime || null
    );
    setSaving(false);
    if (err) { setError(err.message); return; }

    // 🏁 Grand slam easter egg: won every stage + race win + fastest lap
    const finPos = parseInt(finish);
    const wonFinish = finPos === 1;
    const wonS1 = effectiveStages >= 1 ? parseInt(stage1) === 1 : true;
    const wonS2 = effectiveStages >= 2 ? parseInt(stage2) === 1 : true;
    const wonS3 = effectiveStages >= 3 ? parseInt(stage3) === 1 : true;
    const isGrandSlam = effectiveStages >= 2 && wonS1 && wonS2 && wonS3 && wonFinish && fastestLap;
    if (isGrandSlam) {
      playBoogity();
    }

    setSuccess(isGrandSlam ? 'GRAND SLAM! Boogity boogity boogity!' : 'Result saved!');
    setTimeout(() => setSuccess(''), isGrandSlam ? 5000 : 2500);
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
  const canonicalTrackName = race.canonical_track_name ?? race.track_name;
  const effectiveStages = getEffectiveStages(stagesEnabled, canonicalTrackName);
  const fastestLapBonus = league?.scoring_config?.fastestLapBonus ?? 1;

  return (
    <div className="px-4 py-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-lg truncate">{race.race_name || race.track_name}</h1>
          {race.race_name && (
            <p className="text-xs text-accent truncate">{race.track_name}</p>
          )}
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
                <input type="number" inputMode="numeric" pattern="[0-9]*" min="1" max="40" className="input-field" placeholder="Pos" value={stage1} onChange={e => setStage1(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Stage 2</label>
                <input type="number" inputMode="numeric" pattern="[0-9]*" min="1" max="40" className="input-field" placeholder="Pos" value={stage2} onChange={e => setStage2(e.target.value)} />
              </div>
              {effectiveStages >= 3 && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Stage 3</label>
                  <input type="number" inputMode="numeric" pattern="[0-9]*" min="1" max="40" className="input-field" placeholder="Pos" value={stage3} onChange={e => setStage3(e.target.value)} />
                </div>
              )}
            </div>
          )}

          {/* Finish position */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Finish Position *</label>
            <input
              type="number" inputMode="numeric" pattern="[0-9]*" min="1" max="40"
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
              Fastest Lap Time
              <span className="text-gray-600 ml-1">(optional, e.g. 1:23.456)</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
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

      {/* Prev / Next race navigation */}
      <div className="flex gap-2 mb-5">
        <button
          className="btn-secondary flex-1 flex items-center justify-center gap-1.5 py-2.5"
          disabled={!prevRaceId}
          onClick={() => prevRaceId && navigate(`/app/races/${prevRaceId}`, { replace: true })}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
          Prev Race
        </button>
        <button
          className="btn-secondary flex-1 flex items-center justify-center gap-1.5 py-2.5"
          disabled={!nextRaceId}
          onClick={() => nextRaceId && navigate(`/app/races/${nextRaceId}`, { replace: true })}
        >
          Next Race
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>

      {/* Results table */}
      {results.length > 0 && (
        <div className="card">
          <h2 className="font-bold mb-3">All Results</h2>
          <div className="space-y-2">
            {results.map((r, idx) => {
              const name = r.users?.display_name ?? r.users?.email ?? 'Unknown';
              const isMe = r.user_id === user?.id;
              // Build stage position display
              const stageParts: string[] = [];
              if (r.stage1_pos != null) stageParts.push(`S1: P${r.stage1_pos}`);
              if (r.stage2_pos != null) stageParts.push(`S2: P${r.stage2_pos}`);
              if (r.stage3_pos != null) stageParts.push(`S3: P${r.stage3_pos}`);

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
                    <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">P{r.finish_pos}</span>
                      {stageParts.length > 0 && (
                        <span className="text-gray-600">{stageParts.join(' · ')}</span>
                      )}
                      {r.fastest_lap && <span className="text-yellow-400">FL</span>}
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
