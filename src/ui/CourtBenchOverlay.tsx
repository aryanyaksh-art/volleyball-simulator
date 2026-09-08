import { useState } from 'react';
import { useLineupStore } from '@/app/store/useLineupStore';
import { usePlaybackStore } from '@/app/store/usePlaybackStore';
import { breakdown } from '@/core/lineup/systems';
import { findPlayer, type RosterPlayer } from '@/core/roster/types';
import type { Side } from '@/core/court/coordinates';

type PendingMode = null | 'add' | 'remove';

/**
 * An on-screen bench flanking the court, one per side, positioned by fixed
 * screen space rather than anywhere in the 3D world — so it's always
 * visible regardless of camera angle or zoom, unlike the on-court 3D bench
 * silhouettes (see HANDOFF's note on their discoverability problem).
 *
 * Deliberately click-only, not drag: an earlier drag-based version (still
 * in HANDOFF's history) tested fine synthetically but read as confusing in
 * practice, and its own roster "+ new player" shortcut had a real bug — one
 * text field doubling as both name and (if left blank) an accidental
 * number, so a stray click could silently create a player literally named
 * "1". Add/Remove now just walk through two clear picks: who, then (for
 * Add) who they're replacing. Creating a brand new roster player stays in
 * RosterPanel (Advanced formation mode), which already has a proper
 * name/number/role form — this overlay only ever operates on players who
 * already exist on the roster.
 */
function SideBench({ side, position }: { side: Side; position: 'top' | 'bottom' }) {
  const roster = useLineupStore((s) => s.rosters[side]);
  const lineup = useLineupStore((s) => s.lineups[side]);
  const rotation = useLineupStore((s) => s.rotations[side]);
  const setOrderSlot = useLineupStore((s) => s.setOrderSlot);

  const [pendingMode, setPendingMode] = useState<PendingMode>(null);
  const [addingPlayerId, setAddingPlayerId] = useState<string | null>(null);

  const onCourtIds = new Set(lineup.order.filter((id): id is string => id != null));
  const bench = roster.players.filter((p) => p.primaryRole !== 'L' && !onCourtIds.has(p.id));

  const b = breakdown(lineup, roster, side, rotation);
  const onCourtPlayers = b.onCourt
    .filter((oc) => !oc.isLibero) // liberos swap in/out automatically — not manually removable here
    .map((oc) => ({ slot: oc.slot, player: findPlayer(roster, oc.playerId) }))
    .filter((x): x is { slot: number; player: RosterPlayer } => x.player != null);

  const cancel = () => {
    setPendingMode(null);
    setAddingPlayerId(null);
  };

  return (
    <div className={`court-bench court-bench-${position}`}>
      <div className="court-bench-header">
        <span className="control-label">Bench {side}</span>
      </div>

      {pendingMode === null && (
        <>
          <div className="control-group">
            <button className="chip chip-small" disabled={bench.length === 0} onClick={() => setPendingMode('add')}>
              Add
            </button>
            <button className="chip chip-small" disabled={onCourtPlayers.length === 0} onClick={() => setPendingMode('remove')}>
              Remove
            </button>
          </div>
          <p className="panel-note">{bench.length === 0 ? "Everyone's on the court." : bench.map((p) => `#${p.number} ${p.name}`).join(', ')}</p>
        </>
      )}

      {pendingMode === 'add' && !addingPlayerId && (
        <div className="court-bench-picker">
          <p className="panel-note">Bring on:</p>
          {bench.map((p) => (
            <button key={p.id} className="chip chip-small court-bench-option" onClick={() => setAddingPlayerId(p.id)}>
              #{p.number} {p.name}
            </button>
          ))}
          <button className="chip chip-small" onClick={cancel}>
            Cancel
          </button>
        </div>
      )}

      {pendingMode === 'add' && addingPlayerId && (
        <div className="court-bench-picker">
          <p className="panel-note">Replace who?</p>
          {onCourtPlayers.map(({ slot, player }) => (
            <button
              key={slot}
              className="chip chip-small court-bench-option"
              onClick={() => {
                setOrderSlot(side, slot, addingPlayerId);
                cancel();
              }}
            >
              #{player.number} {player.name}
            </button>
          ))}
          <button className="chip chip-small" onClick={cancel}>
            Cancel
          </button>
        </div>
      )}

      {pendingMode === 'remove' && (
        <div className="court-bench-picker">
          <p className="panel-note">Send to bench:</p>
          {onCourtPlayers.map(({ slot, player }) => (
            <button
              key={slot}
              className="chip chip-small court-bench-option"
              onClick={() => {
                setOrderSlot(side, slot, null);
                cancel();
              }}
            >
              #{player.number} {player.name}
            </button>
          ))}
          <button className="chip chip-small" onClick={cancel}>
            Cancel
          </button>
        </div>
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
