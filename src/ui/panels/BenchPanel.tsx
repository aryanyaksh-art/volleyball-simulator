import { useState } from 'react';
import { useLineupStore } from '@/app/store/useLineupStore';
import { isPlayerDrag, readPlayerDragPayload, writePlayerDragPayload } from '@/ui/dragPlayer';

/**
 * Roster players not currently in the lineup's serve order — drag one onto
 * a LineupPanel slot to put them on the court, or drag a slot's player back
 * here to bench them. The libero is left off this list on purpose: they're
 * not a normal starter slot, they swap in automatically via the lineup's
 * liberos assignment whenever that slot rotates back row (see
 * core/lineup/systems.ts) rather than being manually placed.
 */
export function BenchPanel() {
  const focusSide = useLineupStore((s) => s.focusSide);
  const roster = useLineupStore((s) => s.rosters[focusSide]);
  const lineup = useLineupStore((s) => s.lineups[focusSide]);
  const setOrderSlot = useLineupStore((s) => s.setOrderSlot);
  const [dragOver, setDragOver] = useState(false);

  const onCourtIds = new Set(lineup.order.filter((id): id is string => id != null));
  const bench = roster.players.filter((p) => p.primaryRole !== 'L' && !onCourtIds.has(p.id));

  return (
    <div
      className={dragOver ? 'panel bench-panel bench-panel-dragover' : 'panel bench-panel'}
      onDragOver={(e) => {
        if (!isPlayerDrag(e.dataTransfer)) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        setDragOver(false);
        const payload = readPlayerDragPayload(e.dataTransfer);
        if (payload?.source === 'slot' && payload.slot != null) {
          setOrderSlot(focusSide, payload.slot, null);
        }
      }}
    >
      <h3 className="panel-title">Bench</h3>
      {bench.length === 0 ? (
        <p className="panel-note">Everyone's on the court. Drag a player here to bench them.</p>
      ) : (
        <div className="bench-chips">
          {bench.map((p) => (
            <div
              key={p.id}
              className="bench-chip"
              draggable
              onDragStart={(e) => writePlayerDragPayload(e.dataTransfer, { source: 'bench', playerId: p.id })}
            >
              #{p.number} {p.name} <span className="bench-chip-role">{p.primaryRole}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
