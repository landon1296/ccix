import { useState, useEffect, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Spinner } from '../../components/Spinner';
import * as LeagueService from '../../services/leagues';
import { DEFAULT_SCORING_CONFIG } from '../../utils/scoring';
import { ScoringConfig, League } from '../../lib/supabase';

export function ScoringEditorPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();

  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [stagesEnabled, setStagesEnabled] = useState(true);
  const [fastestLapBonus, setFastestLapBonus] = useState(1);
  const [allStagesWinBonus, setAllStagesWinBonus] = useState(0);
  const [grandSlamBonus, setGrandSlamBonus] = useState(0);
  const [crownJewelEnabled, setCrownJewelEnabled] = useState(false);
  const [crownJewelAmount, setCrownJewelAmount] = useState(5);
  const [stagePointsStr, setStagePointsStr] = useState('');
  const [finishPointsStr, setFinishPointsStr] = useState('');

  useEffect(() => {
    if (!leagueId) return;
    (async () => {
      const { league: lg } = await LeagueService.getLeague(leagueId);
      setLeague(lg);
      if (lg) {
        const cfg: ScoringConfig = lg.scoring_config ?? DEFAULT_SCORING_CONFIG;
        setStagesEnabled(cfg.stagesEnabled ?? true);
        setFastestLapBonus(cfg.fastestLapBonus ?? 1);
        setAllStagesWinBonus(cfg.allStagesWinBonus ?? 0);
        setGrandSlamBonus(cfg.grandSlamBonus ?? 0);
        setCrownJewelEnabled(cfg.crownJewelBonusEnabled ?? false);
        setCrownJewelAmount(cfg.crownJewelBonusAmount ?? 5);
        setStagePointsStr((cfg.stagePoints ?? DEFAULT_SCORING_CONFIG.stagePoints).join(', '));
        setFinishPointsStr((cfg.finishPoints ?? DEFAULT_SCORING_CONFIG.finishPoints).join(', '));
      }
      setLoading(false);
    })();
  }, [leagueId]);

  const parsePoints = (str: string): number[] => {
    return str.split(/[,\s]+/).map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n >= 0);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!leagueId) return;
    const stagePoints = parsePoints(stagePointsStr);
    const finishPoints = parsePoints(finishPointsStr);
    if (stagePoints.length === 0 || finishPoints.length === 0) {
      setError('Points arrays cannot be empty'); return;
    }
    setSaving(true);
    setError('');
    const cfg: ScoringConfig = {
      stagePoints, finishPoints, fastestLapBonus,
      stagesEnabled, allStagesWinBonus, grandSlamBonus,
      crownJewelBonusEnabled: crownJewelEnabled, crownJewelBonusAmount: crownJewelAmount,
    };
    const { error: err } = await LeagueService.updateLeague(leagueId, { scoring_config: cfg });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    const d = DEFAULT_SCORING_CONFIG;
    setStagesEnabled(d.stagesEnabled ?? true);
    setFastestLapBonus(d.fastestLapBonus);
    setAllStagesWinBonus(d.allStagesWinBonus ?? 0);
    setGrandSlamBonus(d.grandSlamBonus ?? 0);
    setCrownJewelEnabled(d.crownJewelBonusEnabled ?? false);
    setCrownJewelAmount(d.crownJewelBonusAmount ?? 5);
    setStagePointsStr(d.stagePoints.join(', '));
    setFinishPointsStr(d.finishPoints.join(', '));
  };

  if (loading) return <div className="flex items-center justify-center h-48"><Spinner size={28} className="text-accent" /></div>;

  return (
    <div className="px-4 py-4">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div>
          <h1 className="font-bold text-lg">Scoring Settings</h1>
          {league && <p className="text-xs text-gray-400">{league.name}</p>}
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="card space-y-4">
          <h2 className="font-bold">Stage Settings</h2>
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="text-sm font-medium">Stages Enabled</div>
              <div className="text-xs text-gray-400">Award stage points (S1/S2, S3 at Charlotte)</div>
            </div>
            <div
              className={`w-11 h-6 rounded-full transition-colors cursor-pointer ${stagesEnabled ? 'bg-accent' : 'bg-surface-2 border border-border'}`}
              onClick={() => setStagesEnabled(!stagesEnabled)}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform m-0.5 ${stagesEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </div>
          </label>

          {stagesEnabled && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Stage Points (top 10, comma-separated)</label>
              <input
                className="input-field font-mono text-sm"
                value={stagePointsStr}
                onChange={e => setStagePointsStr(e.target.value)}
                placeholder="10, 9, 8, 7, 6, 5, 4, 3, 2, 1"
              />
            </div>
          )}
        </div>

        <div className="card space-y-4">
          <h2 className="font-bold">Finish Points</h2>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Points by finish position (comma-separated, P1 first)</label>
            <textarea
              className="input-field font-mono text-sm resize-none"
              rows={3}
              value={finishPointsStr}
              onChange={e => setFinishPointsStr(e.target.value)}
              placeholder="40, 35, 34, ..."
            />
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="font-bold">Bonuses</h2>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Fastest Lap Bonus</label>
            <input type="number" min="0" max="10" className="input-field" value={fastestLapBonus} onChange={e => setFastestLapBonus(parseInt(e.target.value) || 0)} />
          </div>
          {stagesEnabled && (
            <>
              <div>
                <label className="block text-xs text-gray-400 mb-1">All-Stages + Win Bonus (0 = off)</label>
                <input type="number" min="0" max="50" className="input-field" value={allStagesWinBonus} onChange={e => setAllStagesWinBonus(parseInt(e.target.value) || 0)} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Grand Slam Bonus (all stages + win + fastest lap, 0 = off)</label>
                <input type="number" min="0" max="50" className="input-field" value={grandSlamBonus} onChange={e => setGrandSlamBonus(parseInt(e.target.value) || 0)} />
              </div>
            </>
          )}
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="text-sm font-medium">Crown Jewel Bonus</div>
              <div className="text-xs text-gray-400">Extra pts for winning Daytona, Indy, Darlington, Charlotte</div>
            </div>
            <div
              className={`w-11 h-6 rounded-full transition-colors cursor-pointer ${crownJewelEnabled ? 'bg-accent' : 'bg-surface-2 border border-border'}`}
              onClick={() => setCrownJewelEnabled(!crownJewelEnabled)}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform m-0.5 ${crownJewelEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </div>
          </label>
          {crownJewelEnabled && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Crown Jewel Bonus Amount</label>
              <input type="number" min="1" max="50" className="input-field" value={crownJewelAmount} onChange={e => setCrownJewelAmount(parseInt(e.target.value) || 5)} />
            </div>
          )}
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {saved && <p className="text-green-400 text-sm">Settings saved!</p>}

        <div className="flex gap-3">
          <button type="button" className="btn-secondary flex-1" onClick={handleReset}>Reset to Default</button>
          <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2" disabled={saving}>
            {saving ? <Spinner size={16} /> : null}
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
