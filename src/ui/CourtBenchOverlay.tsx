import { useState } from 'react';
import { useAppStore } from '@/app/store/useAppStore';
import { useLineupStore } from '@/app/store/useLineupStore';
import { usePlaybackStore } from '@/app/store/usePlaybackStore';
import { playerSlotInZone } from '@/core/lineup/rotation';
import type { Side } from '@/core/court/coordinates';

/**
 * An on-screen bench flanking the court, one per side, positioned by fixed
 * screen space rather than anywhere in the 3D world — so it's always
 * visible and always the same size regardless of camera angle or zoom,
 * unlike the on-court 3D bench silhouettes (see HANDOFF's note on their
 * discoverability problem). Drag a chip onto the court to bring them on;
 * the chip owns the pointer capture for the whole gesture, so pointerup
 * still fires on it even though the cursor ends up over the WebGL canvas —
 * `useAppStore.resolveCourtDropTarget` (registered by SceneCanvas) is what
 * lets this plain HTML element ask "what's under this screen position"
 * without reaching into the renderer's internals directly.
 */
function SideBench({ side, position }: { side: Side; position: 'top' | 'bottom' }) {
  const roster = useLineupStore((s) => s.rosters[side]);
  const lineup = useLineupStore((s) => s.lineups[side]);
  const rotation = useLineupStore((s) => s.rotations[side]);
  const setOrderSlot = useLineupStore((s) => s.setOrderSlot);
  const addPlayer = useLineupStore((s) => s.addPlayer);
  const removePlayer = useLineupStore((s) => s.removePlayer);
  const resolveCourtDropTarget = useAppStore((s) => s.resolveCourtDropTarget);

  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const onCourtIds = new Set(lineup.order.filter((id): id is string => id != null));
  const bench = roster.players.filter((p) => p.primaryRole !== 'L' && !onCourtIds.has(p.id));

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, playerId: string) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggingId(playerId);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>, playerId: string) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDraggingId(null);
    const target = resolveCourtDropTarget?.(e.clientX, e.clientY);
    if (!target || target.kind !== 'zone' || target.side !== side) return;
    const slot = playerSlotInZone(rotation, target.zone);
    setOrderSlot(side, slot, playerId);
  };

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const taken = new Set(roster.players.map((p) => p.number));
    let number = 1;
    while (taken.has(number)) number++;
    addPlayer(side, { name: trimmed, number, primaryRole: 'OH', handedness: 'R' });
    setName('');
    setShowAdd(false);
  };

  return (
    <div className={`court-bench court-bench-${position}`}>
      <div className="court-bench-header">
        <span className="control-label">Bench {side}</span>
        <button className="chip chip-small" onClick={() => setShowAdd((v) => !v)} title="Add a sub to this roster">
          +
        </button>
      </div>
      {showAdd && (
        <div className="court-bench-add">
          <input
            className="roster-add-input"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <button className="chip chip-small chip-active" onClick={handleAdd}>
            Add
          </button>
        </div>
      )}
      {bench.length === 0 ? (
        <p className="panel-note">Everyone's on the court.</p>
      ) : (
        bench.map((p) => (
          <div
            key={p.id}
            className={draggingId === p.id ? 'court-bench-chip court-bench-chip-dragging' : 'court-bench-chip'}
            onPointerDown={(e) => handlePointerDown(e, p.id)}
            onPointerUp={(e) => handlePointerUp(e, p.id)}
          >
            <span>
              #{p.number} {p.name}
            </span>
            <button
              className="court-bench-remove"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => removePlayer(side, p.id)}
              title="Remove from roster"
            >
              x
            </button>
          </div>
        ))
      )}
    </div>
  );
}

export function CourtBenchOverlay() {
  const mode = usePlaybackStore((s) => s.mode);
  if (mode !== 'formation' && mode !== 'author') return null;
  return (
    <>
      <SideBench side="B" position="top" />
      <SideBench side="A" position="bottom" />
    </>
  );
}
