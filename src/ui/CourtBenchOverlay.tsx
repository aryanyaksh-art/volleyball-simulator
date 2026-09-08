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
 * "1". Add/Remove now just walk through clear picks: who, then, only if
 * the court side is already full, who they're replacing (an empty slot
 * gets the new player immediately, no replacement question asked).
 * Creating a brand new roster player stays in RosterPanel (Advanced
 * formation mode), which already has a proper name/number/role form; this
 * overlay only ever operates on players who already exist on the roster.
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
  const emptySlots = lineup.order.map((id, slot) => ({ id, slot })).filter((x) => x.id == null).map((x) => x.slot);

  const cancel = () => {
    setPendingMode(null);
    setAddingPlayerId(null);
  };

  /** An empty slot needs no one replaced — put the player straight on. Only ask who to bump when the court's genuinely full. */
  const addToCourt = (playerId: string) => {
    if (emptySlots.length > 0) {
      setOrderSlot(side, emptySlots[0], playerId);
      cancel();
      return;
    }
    setAddingPlayerId(playerId);
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
          <p className="panel-note">{bench.length === 0 ? "Everyone's on the court." : bench.map((p) => p.name).join(', ')}</p>
        </>
      )}

      {pendingMode === 'add' && !addingPlayerId && (
        <div className="court-bench-picker">
          <p className="panel-note">Bring on:</p>
          {bench.map((p) => (
            <button key={p.id} className="chip chip-small court-bench-option" onClick={() => addToCourt(p.id)}>
              {p.name}
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
              {player.name}
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
              {player.name}
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

function ResetPositionsButton() {
  const resetPositionOverrides = useLineupStore((s) => s.resetPositionOverrides);
  const hasOverrides = useLineupStore((s) => Object.keys(s.positionOverrides.A).length > 0 || Object.keys(s.positionOverrides.B).length > 0);
  return (
    <button
      className="chip reset-positions-button"
      disabled={!hasOverrides}
      onClick={() => {
        resetPositionOverrides('A');
        resetPositionOverrides('B');
      }}
    >
      Reset positions
    </button>
  );
}

export function CourtBenchOverlay() {
  const mode = usePlaybackStore((s) => s.mode);
  if (mode !== 'formation' && mode !== 'author') return null;
  return (
    <>
      <SideBench side="B" position="top" />
      <SideBench side="A" position="bottom" />
      {mode === 'formation' && <ResetPositionsButton />}
    </>
  );
}
