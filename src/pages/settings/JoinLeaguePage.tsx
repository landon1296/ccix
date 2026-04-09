import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Spinner } from '../../components/Spinner';
import * as LeagueService from '../../services/leagues';

export function JoinLeaguePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !code.trim()) return;
    setLoading(true);
    setError('');
    const { league, error: err } = await LeagueService.joinLeague(user.id, code.trim().toUpperCase());
    setLoading(false);
    if (err) { setError(err.message); return; }
    if (league) navigate(`/app/settings/league/${league.id}`, { replace: true });
  };

  return (
    <div className="px-4 py-4">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <h1 className="font-bold text-lg">Join League</h1>
      </div>
      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">League Code</label>
            <input
              className="input-field text-center text-xl font-mono tracking-widest uppercase"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="ABC123"
              required
              maxLength={6}
              autoFocus
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2" disabled={loading || code.length < 6}>
            {loading ? <Spinner size={16} /> : null}
            {loading ? 'Joining...' : 'Join League'}
          </button>
        </form>
        <p className="text-xs text-gray-500 mt-3 text-center">
          Ask your league admin for the 6-character join code.
        </p>
      </div>
    </div>
  );
}
