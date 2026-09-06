import { usePlayEditorStore } from '@/app/store/usePlayEditorStore';
import { useLineupStore } from '@/app/store/useLineupStore';
import { breakdown } from '@/core/lineup/systems';
import { findPlayer } from '@/core/roster/types';
import { positionBeforeStep } from '@/core/play/bake';
import { ALL_POSES, type PoseId } from '@/core/play/poses';
import type { Side } from '@/core/court/coordinates';
import type { MovementMode } from '@/core/play/types';

const MODES: MovementMode[] = ['sprint', 'run', 'shuffle', 'backpedal', 'approach', 'crossover', 'hold'];
const SIDES: Side[] = ['A', 'B'];

export function StepInspector() {
  const play = usePlayEditorStore((s) => s.play);
  const selectedStepId = usePlayEditorStore((s) => s.selectedStepId);
  const addMovement = usePlayEditorStore((s) => s.addMovement);
  const removeMovement = usePlayEditorStore((s) => s.removeMovement);
  const setMovementPosition = usePlayEditorStore((s) => s.setMovementPosition);
  const setMovementMode = usePlayEditorStore((s) => s.setMovementMode);
  const setMovementPose = usePlayEditorStore((s) => s.setMovementPose);

  const rosters = useLineupStore((s) => s.rosters);
  const lineups = useLineupStore((s) => s.lineups);
  const positionOverrides = useLineupStore((s) => s.positionOverrides);

  const step = play?.steps.find((s) => s.id === selectedStepId);
  if (!play || !step) {
    return (
      <div className="panel">
        <h3 className="panel-title">Step</h3>
        <p className="panel-note">Select a step in the timeline to edit it.</p>
      </div>
    );
  }

  const ctx = { rosters, lineups, positions: positionOverrides };

  return (
    <div className="panel">
      <h3 className="panel-title">Step — {step.name}</h3>

      {SIDES.map((side) => {
        const b = breakdown(lineups[side], rosters[side], side, play.scenario.rotations[side]);
        return (
          <div key={side} className="step-inspector-side">
            <h4 className="step-inspector-side-title">Side {side}</h4>
            <table className="panel-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Lat</th>
                  <th>Depth</th>
                  <th>Mode</th>
                  <th>Pose</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {b.onCourt.map((p) => {
                  const player = findPlayer(rosters[side], p.playerId);
                  const mv = step.movements.find((m) => m.who.kind === 'slot' && m.who.side === side && m.who.index === p.slot);
                  const label = player ? `#${player.number} ${player.name}` : `slot ${p.slot + 1}`;

                  if (!mv) {
                    return (
                      <tr key={p.onCourtId}>
                        <td>{label}</td>
                        <td colSpan={4} className="panel-note">
                          holds position
                        </td>
                        <td>
                          <button
                            className="chip"
                            onClick={() => addMovement(step.id, side, p.slot, positionBeforeStep(play, ctx, step.id, side, p.slot))}
                          >
                            + Move
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  const pos = mv.to.kind === 'local' ? mv.to.pos : { lat: 0, depth: 0 };

                  return (
                    <tr key={p.onCourtId}>
                      <td>{label}</td>
                      <td>
                        <input
                          type="number"
                          step={0.1}
                          value={pos.lat}
                          onChange={(e) => setMovementPosition(step.id, side, p.slot, { ...pos, lat: Number(e.target.value) })}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step={0.1}
                          value={pos.depth}
                          onChange={(e) => setMovementPosition(step.id, side, p.slot, { ...pos, depth: Number(e.target.value) })}
                        />
                      </td>
                      <td>
                        <select value={mv.mode ?? 'run'} onChange={(e) => setMovementMode(step.id, side, p.slot, e.target.value as MovementMode)}>
                          {MODES.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          value={mv.pose ?? ''}
                          onChange={(e) => setMovementPose(step.id, side, p.slot, (e.target.value || undefined) as PoseId | undefined)}
                        >
                          <option value="">(unchanged)</option>
                          {ALL_POSES.map((pose) => (
                            <option key={pose} value={pose}>
                              {pose}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <button className="chip" onClick={() => removeMovement(step.id, side, p.slot)}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
