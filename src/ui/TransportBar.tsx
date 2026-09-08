import { usePlaybackStore } from '@/app/store/usePlaybackStore';
import { usePlayEditorStore } from '@/app/store/usePlayEditorStore';
import { useLineupStore } from '@/app/store/useLineupStore';
import { useAppStore } from '@/app/store/useAppStore';
import { DEMO_PLAYS } from '@/fixtures/demoPlays';
import type { Play } from '@/core/play/types';

const SPEEDS = [0.25, 0.5, 1, 1.5, 2];

const createBlankPlay = (): Play => ({
  id: crypto.randomUUID(),
  name: 'New play',
  schemaVersion: 1,
  scenario: { lineupIds: { A: '', B: '' }, rotations: { A: 0, B: 0 } },
  initial: { players: [], ball: { side: 'A', pos: { lat: 3, depth: 8.7 }, y: 1.3 } },
  steps: [{ id: crypto.randomUUID(), name: 'Step 1', duration: 1, movements: [] }],
});

function editorBakeContext() {
  const { rosters, lineups, positionOverrides } = useLineupStore.getState();
  return { rosters, lineups, positions: positionOverrides };
}

export function TransportBar() {
  const mode = usePlaybackStore((s) => s.mode);
  const setMode = usePlaybackStore((s) => s.setMode);
  const selectedPlayId = usePlaybackStore((s) => s.selectedPlayId);
  const setSelectedPlayId = usePlaybackStore((s) => s.setSelectedPlayId);
  const playing = usePlaybackStore((s) => s.playing);
  const toggle = usePlaybackStore((s) => s.toggle);
  const t = usePlaybackStore((s) => s.t);
  const durationS = usePlaybackStore((s) => s.durationS);
  const setT = usePlaybackStore((s) => s.setT);
  const speed = usePlaybackStore((s) => s.speed);
  const setSpeed = usePlaybackStore((s) => s.setSpeed);
  const loop = usePlaybackStore((s) => s.loop);
  const setLoop = usePlaybackStore((s) => s.setLoop);
  const togglePresentationMode = useAppStore((s) => s.togglePresentationMode);
  const showPlayLibrary = useAppStore((s) => s.showPlayLibrary);
  const toggleShowPlayLibrary = useAppStore((s) => s.toggleShowPlayLibrary);

  const editorPlay = usePlayEditorStore((s) => s.play);
  const loadPlay = usePlayEditorStore((s) => s.loadPlay);
  const saveCurrentPlay = usePlayEditorStore((s) => s.saveCurrentPlay);
  const savedPlays = usePlayEditorStore((s) => s.savedPlays);

  const editSelectedPlay = () => {
    const source = DEMO_PLAYS.find((p) => p.id === selectedPlayId) ?? savedPlays[selectedPlayId] ?? DEMO_PLAYS[0];
    // Editing a built-in demo forks into a new custom play on save, rather
    // than colliding with the demo's own id (and its option in this same
    // dropdown) the first time it's saved.
    const isBuiltIn = DEMO_PLAYS.some((p) => p.id === source.id);
    const forEditing = isBuiltIn ? { ...source, id: crypto.randomUUID(), name: `${source.name} (copy)` } : source;
    loadPlay(forEditing, editorBakeContext());
    setMode('author');
  };

  const startNewPlay = () => {
    loadPlay(createBlankPlay(), editorBakeContext());
    setMode('author');
  };

  const transportControls = (
    <>
      <div className="control-group">
        <button className="chip chip-active" onClick={toggle}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <input
          type="range"
          min={0}
          max={durationS}
          step={0.01}
          value={Math.min(t, durationS)}
          onChange={(e) => setT(Number(e.target.value))}
          style={{ width: 240 }}
        />
        <span className="control-label">
          {t.toFixed(2)}s / {durationS.toFixed(2)}s
        </span>
      </div>
      <div className="control-group">
        <span className="control-label">Speed</span>
        {SPEEDS.map((s) => (
          <button key={s} className={s === speed ? 'chip chip-active' : 'chip'} onClick={() => setSpeed(s)}>
            {s}×
          </button>
        ))}
      </div>
      <div className="control-group">
        <button className={loop ? 'chip chip-active' : 'chip'} onClick={() => setLoop(!loop)}>
          Loop
        </button>
      </div>
    </>
  );

  if (mode === 'author') {
    return (
      <div className="control-bar">
        <div className="control-group">
          <button className="chip" onClick={() => setMode('formation')}>
            Back to formation
          </button>
          <button className="chip" onClick={saveCurrentPlay} disabled={!editorPlay}>
            Save play
          </button>
          {editorPlay && savedPlays[editorPlay.id] && <span className="control-label">(saved)</span>}
        </div>
        {transportControls}
      </div>
    );
  }

  if (mode === 'serve-receive' || mode === 'matchup') {
    return (
      <div className="control-bar">
        <div className="control-group">
          <button className="chip" onClick={() => setMode('formation')}>
            Back to formation
          </button>
        </div>
      </div>
    );
  }

  if (mode !== 'play') {
    return (
      <div className="control-bar">
        <div className="control-group">
          <button className="chip" onClick={() => setMode('play')}>
            Preview demo play
          </button>
          <button className="chip" onClick={startNewPlay}>
            Design play
          </button>
          <button className="chip" onClick={() => setMode('serve-receive')}>
            Serve-receive
          </button>
          <button className="chip" onClick={() => setMode('matchup')}>
            Matchups
          </button>
          <button className={showPlayLibrary ? 'chip chip-active' : 'chip'} onClick={toggleShowPlayLibrary}>
            Play library
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="control-bar">
      <div className="control-group">
        <button className="chip" onClick={() => setMode('formation')}>
          ← Back to formation
        </button>
        <button className="chip" onClick={editSelectedPlay}>
          Edit this play
        </button>
        <button className="chip" onClick={togglePresentationMode}>
          Present
        </button>
        <button className={showPlayLibrary ? 'chip chip-active' : 'chip'} onClick={toggleShowPlayLibrary}>
          Play library
        </button>
      </div>
      <div className="control-group">
        <span className="control-label">Play</span>
        <select value={selectedPlayId} onChange={(e) => setSelectedPlayId(e.target.value)}>
          {DEMO_PLAYS.map((play) => (
            <option key={play.id} value={play.id}>
              {play.name}
            </option>
          ))}
          {Object.values(savedPlays).map((play) => (
            <option key={play.id} value={play.id}>
              {play.name} (saved)
            </option>
          ))}
        </select>
      </div>
      {transportControls}
    </div>
  );
}
