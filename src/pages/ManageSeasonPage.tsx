import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAuth } from '../contexts/AuthContext';
import { Spinner } from '../components/Spinner';
import * as RaceService from '../services/races';
import * as SeasonService from '../services/seasons';
import * as LeagueService from '../services/leagues';
import { NASCAR_25_TRACKS, NASCAR_2025_CUP_SCHEDULE } from '../utils/tracks';
import { Race } from '../lib/supabase';

function SortableRace({ race, onDelete }: { race: Race; onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: race.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-3">
      <button {...attributes} {...listeners} className="text-gray-500 hover:text-gray-300 cursor-grab active:cursor-grabbing p-1 -ml-1">
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="16" x2="20" y2="16"/>
        </svg>
      </button>
      <span className="flex-1 text-sm font-medium">{race.track_name}</span>
      <button onClick={() => onDelete(race.id)} className="text-red-500 hover:text-red-400 p-1">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
  );
}

export function ManageSeasonPage() {
  const { seasonId } = useParams<{ seasonId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [races, setRaces] = useState<Race[]>([]);
  const [season, setSeason] = useState<any>(null);
  const [league, setLeague] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddTrack, setShowAddTrack] = useState(false);
  const [trackSearch, setTrackSearch] = useState('');
  const [error, setError] = useState('');
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);

  const load = useCallback(async () => {
    if (!seasonId) return;
    setLoading(true);
    const [{ races: r }, { seasons }] = await Promise.all([
      RaceService.getRaces(seasonId),
      supabaseSeasonQuery(seasonId),
    ]);
    setRaces(r);
    setSeason(seasons);
    setLoading(false);
  }, [seasonId]);

  async function supabaseSeasonQuery(id: string) {
    const { supabase } = await import('../lib/supabase');
    const { data } = await supabase.from('seasons').select('*, leagues(*)').eq('id', id).single();
    if (data) {
      setSeason(data);
      setLeague((data as any).leagues);
    }
    return { seasons: data };
  }

  useEffect(() => { load(); }, [load]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = races.findIndex(r => r.id === active.id);
    const newIndex = races.findIndex(r => r.id === over.id);
    const newRaces = arrayMove(races, oldIndex, newIndex);
    setRaces(newRaces);
    setSaving(true);
    await RaceService.reorderRaces(seasonId!, newRaces.map(r => r.id));
    setSaving(false);
  };

  const handleDelete = async (raceId: string) => {
    setRaces(prev => prev.filter(r => r.id !== raceId));
    await RaceService.deleteRace(raceId);
  };

  const handleAddTrack = async (trackName: string) => {
    if (!seasonId) return;
    setSaving(true);
    const { race, error: err } = await RaceService.createRace(seasonId, trackName);
    if (err) { setError(err.message); } else if (race) { setRaces(prev => [...prev, race]); }
    setSaving(false);
    setShowAddTrack(false);
    setTrackSearch('');
  };

  const handleAddSchedule = async (tracks: string[]) => {
    if (!seasonId) return;
    setSaving(true);
    const { error: err } = await RaceService.bulkCreateRaces(seasonId, tracks);
    if (err) { setError(err.message); } else { await load(); }
    setSaving(false);
  };

  const handleFinishSeason = async () => {
    if (!seasonId) return;
    setSaving(true);
    const { error: err } = await SeasonService.finishSeason(seasonId);
    setSaving(false);
    if (err) { setError(err.message); return; }
    navigate('/app/races');
  };

  const filteredTracks = NASCAR_25_TRACKS.filter(t =>
    t.toLowerCase().includes(trackSearch.toLowerCase())
  );

  const isOwner = league?.owner_id === user?.id;

  if (loading) return <div className="flex items-center justify-center h-48"><Spinner size={28} className="text-accent" /></div>;

  return (
    <div className="px-4 py-4">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div>
          <h1 className="font-bold text-lg">{season?.name ?? 'Season'}</h1>
          <p className="text-xs text-gray-400">{league?.name}</p>
        </div>
        {saving && <Spinner size={16} className="text-accent ml-auto" />}
      </div>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      {isOwner && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <button className="btn-secondary text-sm py-2" onClick={() => setShowAddTrack(true)}>+ Add Race</button>
          <button className="btn-secondary text-sm py-2" onClick={() => handleAddSchedule(NASCAR_2025_CUP_SCHEDULE)}>
            Use 2025 Schedule
          </button>
          {races.length > 0 && (
            <button className="btn-danger text-sm py-2 ml-auto" onClick={() => setShowFinishConfirm(true)}>
              Finish Season
            </button>
          )}
        </div>
      )}

      {races.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-gray-400">No races scheduled. Add races to get started.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={races.map(r => r.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {races.map(race => (
                <SortableRace key={race.id} race={race} onDelete={isOwner ? handleDelete : () => {}} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Add Track Modal */}
      {showAddTrack && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center">
          <div className="bg-surface w-full max-w-lg rounded-t-2xl p-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold">Add Race</h3>
              <button onClick={() => { setShowAddTrack(false); setTrackSearch(''); }} className="text-gray-400 hover:text-white">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <input
              className="input-field mb-3"
              placeholder="Search tracks..."
              value={trackSearch}
              onChange={(e) => setTrackSearch(e.target.value)}
              autoFocus
            />
            <div className="overflow-y-auto flex-1 space-y-1">
              {filteredTracks.map(track => (
                <button
                  key={track}
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-surface-2 text-sm transition-colors"
                  onClick={() => handleAddTrack(track)}
                >
                  {track}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Finish Season Confirm */}
      {showFinishConfirm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4">
          <div className="bg-surface rounded-xl p-5 w-full max-w-sm border border-border">
            <h3 className="font-bold text-lg mb-2">Finish Season?</h3>
            <p className="text-gray-400 text-sm mb-5">
              This will archive the season, calculate the champion, and allow starting a new season. Race results are preserved.
            </p>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setShowFinishConfirm(false)}>Cancel</button>
              <button className="btn-danger flex-1" onClick={() => { setShowFinishConfirm(false); handleFinishSeason(); }} disabled={saving}>
                {saving ? <Spinner size={16} /> : 'Finish Season'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
