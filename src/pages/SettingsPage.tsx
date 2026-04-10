import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Spinner } from '../components/Spinner';
import { CarAvatar, AvatarStyle } from '../utils/avatar';
import { useWakeLock } from '../hooks/useWakeLock';
import * as LeagueService from '../services/leagues';
import { League } from '../lib/supabase';

const AVATAR_STYLES: { value: AvatarStyle; label: string; desc: string }[] = [
  { value: 'classic', label: 'Classic', desc: 'Bold number on solid color' },
  { value: 'fire', label: 'Fire', desc: 'Orange/red gradient' },
  { value: 'chrome', label: 'Chrome', desc: 'Silver metallic' },
  { value: 'neon', label: 'Neon', desc: 'Glowing effect' },
];

export function SettingsPage() {
  const { user, signOut, updateDisplayName, updateCarProfile } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [carNumber, setCarNumber] = useState(user?.car_number ?? '');
  const [avatarStyle, setAvatarStyle] = useState<AvatarStyle>((user?.avatar_style as AvatarStyle) ?? 'classic');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  const [leagues, setLeagues] = useState<League[]>([]);
  const [loadingLeagues, setLoadingLeagues] = useState(true);
  const wakeLock = useWakeLock();

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { leagues: ls } = await LeagueService.getUserLeagues(user.id);
      setLeagues(ls);
      setLoadingLeagues(false);
    })();
  }, [user]);

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg('');
    const carNum = carNumber.slice(0, 2);
    const [nameRes, carRes] = await Promise.all([
      updateDisplayName(displayName.trim()),
      updateCarProfile(carNum, avatarStyle),
    ]);
    setSavingProfile(false);
    if (nameRes.error || carRes.error) {
      setProfileMsg((nameRes.error ?? carRes.error)!.message);
    } else {
      setProfileMsg('Saved!');
      setTimeout(() => setProfileMsg(''), 2000);
    }
  };

  return (
    <div className="px-4 py-4 space-y-5">
      {/* Profile */}
      <section className="card">
        <h2 className="font-bold mb-4">Profile</h2>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Display Name</label>
            <input
              className="input-field"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder={user?.email ?? 'Your name'}
              maxLength={30}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Car Number (1–2 digits)</label>
            <input
              className="input-field"
              value={carNumber}
              onChange={e => setCarNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
              placeholder="e.g. 48"
              maxLength={2}
              pattern="[0-9]{1,2}"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-2">Avatar Style</label>
            <div className="grid grid-cols-2 gap-2">
              {AVATAR_STYLES.map(s => (
                <button
                  key={s.value}
                  type="button"
                  className={`flex items-center gap-2.5 rounded-lg p-2.5 border transition-colors text-left ${
                    avatarStyle === s.value ? 'border-accent bg-accent/10' : 'border-border bg-surface-2 hover:border-gray-500'
                  }`}
                  onClick={() => setAvatarStyle(s.value)}
                >
                  <CarAvatar carNumber={carNumber || '48'} avatarStyle={s.value} userId={user?.id ?? ''} size={32} />
                  <div>
                    <div className="text-sm font-medium">{s.label}</div>
                    <div className="text-xs text-gray-400">{s.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
          {profileMsg && <p className={`text-sm ${profileMsg === 'Saved!' ? 'text-green-400' : 'text-red-400'}`}>{profileMsg}</p>}
          <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2" disabled={savingProfile}>
            {savingProfile ? <Spinner size={16} /> : null}
            Save Profile
          </button>
        </form>
        <div className="mt-3 text-xs text-gray-500 text-center">{user?.email}</div>
      </section>

      {/* Leagues */}
      <section className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold">My Leagues</h2>
          <div className="flex gap-2">
            <button className="btn-secondary text-xs py-1.5 px-2.5" onClick={() => navigate('/app/settings/league/create')}>+ Create</button>
            <button className="btn-secondary text-xs py-1.5 px-2.5" onClick={() => navigate('/app/settings/league/join')}>Join</button>
          </div>
        </div>
        {loadingLeagues ? (
          <div className="flex justify-center py-4"><Spinner size={20} className="text-accent" /></div>
        ) : leagues.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-3">No leagues yet.</p>
        ) : (
          <div className="space-y-2">
            {leagues.map(l => (
              <button
                key={l.id}
                className="w-full text-left flex items-center justify-between rounded-lg px-3 py-2.5 bg-surface-2 hover:bg-[#2d2d2d] transition-colors"
                onClick={() => navigate(`/app/settings/league/${l.id}`)}
              >
                <div>
                  <div className="font-medium text-sm">{l.name}</div>
                  <div className="text-xs text-gray-500">Code: {l.league_code}{l.owner_id === user?.id ? ' · Owner' : ''}</div>
                </div>
                <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Trophy Room */}
      <button
        className="w-full card hover:border-accent/50 transition-colors flex items-center justify-between"
        onClick={() => navigate('/app/trophy-room')}
      >
        <span className="font-medium flex items-center gap-2"><span>🏆</span> Trophy Room</span>
        <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
      </button>

      {/* Screen Wake Lock */}
      {wakeLock.supported && (
        <section className="card">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-sm">Keep Screen On</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Prevents your screen from sleeping while using CCIX
                {wakeLock.active && <span className="text-green-400 ml-1">(active)</span>}
              </p>
            </div>
            <button
              onClick={wakeLock.toggle}
              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                wakeLock.enabled ? 'bg-accent' : 'bg-gray-600'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  wakeLock.enabled ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>
        </section>
      )}

      {/* Sign Out */}
      <button className="btn-danger w-full" onClick={signOut}>Sign Out</button>

      <p className="text-center text-xs text-gray-600 pb-2">CCIX v1.0</p>
    </div>
  );
}
