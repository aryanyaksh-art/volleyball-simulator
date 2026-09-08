import { usePlayEditorStore } from '@/app/store/usePlayEditorStore';
import { useLineupStore } from '@/app/store/useLineupStore';
import { breakdown } from '@/core/lineup/systems';
import { findPlayer } from '@/core/roster/types';
import { positionBeforeStep } from '@/core/play/bake';
import { ALL_POSES, type PoseId } from '@/core/play/poses';
import type { Side } from '@/core/court/coordinates';
import type { BallSegment, MovementMode } from '@/core/play/types';

const MODES: MovementMode[] = ['sprint', 'run', 'shuffle', 'backpedal', 'approach', 'crossover', 'hold'];
const BALL_KINDS: BallSegment['kind'][] = ['serve', 'pass', 'set', 'attack', 'tip', 'roll', 'block', 'dig', 'free'];
const SIDES: Side[] = ['A', 'B'];

export function StepInspector() {
  const play = usePlayEditorStore((s) => s.play);
  const selectedStepId = usePlayEditorStore((s) => s.selectedStepId);
  const addMovement = usePlayEditorStore((s) => s.addMovement);
  const removeMovement = usePlayEditorStore((s) => s.removeMovement);
  const setMovementPosition = usePlayEditorStore((s) => s.setMovementPosition);
  const setMovementMode = usePlayEditorStore((s) => s.setMovementMode);
  const setMovementPose = usePlayEditorStore((s) => s.setMovementPose);
  const addBallSegment = usePlayEditorStore((s) => s.addBallSegment);
  const removeBallSegment = usePlayEditorStore((s) => s.removeBallSegment);
  const setBallKind = usePlayEditorStore((s) => s.setBallKind);
  const setBallFromPosition = usePlayEditorStore((s) => s.setBallFromPosition);
  const setBallToPosition = usePlayEditorStore((s) => s.setBallToPosition);
  const setBallApex = usePlayEditorStore((s) => s.setBallApex);
  const setBallDuration = usePlayEditorStore((s) => s.setBallDuration);

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

  const ballFrom = step.ball?.from.kind === 'local' ? { pos: step.ball.from.pos, y: step.ball.from.y ?? 0 } : null;
  const ballTo = step.ball?.to.kind === 'local' ? { pos: step.ball.to.pos, y: step.ball.to.y ?? 0 } : null;

  return (
    <div className="panel">
      <h3 className="panel-title">Step: {step.name}</h3>

      <div className="step-inspector-side">
        <h4 className="step-inspector-side-title">Ball</h4>
        {!step.ball ? (
          <button className="chip" onClick={() => addBallSegment(step.id)}>
            + Add ball segment
          </button>
        ) : (
          <>
            <table className="panel-table">
              <thead>
                <tr>
                  <th>Kind</th>
                  <th>Apex (m)</th>
                  <th>Duration (s)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <select value={step.ball.kind} onChange={(e) => setBallKind(step.id, e.target.value as BallSegment['kind'])}>
                      {BALL_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      step={0.1}
                      value={step.ball.apexM ?? 2.5}
                      onChange={(e) => setBallApex(step.id, Number(e.target.value))}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step={0.05}
                      placeholder="step"
                      value={step.ball.duration ?? ''}
                      onChange={(e) => setBallDuration(step.id, e.target.value === '' ? undefined : Number(e.target.value))}
                    />
                  </td>
                  <td>
                    <button className="chip" onClick={() => removeBallSegment(step.id)} title="Remove ball segment">
                      x
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
            <table className="panel-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Lat</th>
                  <th>Depth</th>
                  <th>Height</th>
                </tr>
              </thead>
              <tbody>
                {ballFrom && (
                  <tr>
                    <td>From</td>
                    <td>
                      <input
                        type="number"
                        step={0.1}
                        value={ballFrom.pos.lat}
                        onChange={(e) => setBallFromPosition(step.id, { ...ballFrom.pos, lat: Number(e.target.value) }, ballFrom.y)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step={0.1}
                        value={ballFrom.pos.depth}
                        onChange={(e) => setBallFromPosition(step.id, { ...ballFrom.pos, depth: Number(e.target.value) }, ballFrom.y)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step={0.1}
                        value={ballFrom.y}
                        onChange={(e) => setBallFromPosition(step.id, ballFrom.pos, Number(e.target.value))}
                      />
                    </td>
                  </tr>
                )}
                {ballTo && (
                  <tr>
                    <td>To</td>
                    <td>
                      <input
                        type="number"
                        step={0.1}
                        value={ballTo.pos.lat}
                        onChange={(e) => setBallToPosition(step.id, { ...ballTo.pos, lat: Number(e.target.value) }, ballTo.y)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step={0.1}
                        value={ballTo.pos.depth}
                        onChange={(e) => setBallToPosition(step.id, { ...ballTo.pos, depth: Number(e.target.value) }, ballTo.y)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step={0.1}
                        value={ballTo.y}
                        onChange={(e) => setBallToPosition(step.id, ballTo.pos, Number(e.target.value))}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}
      </div>

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
                        <button className="chip" onClick={() => removeMovement(step.id, side, p.slot)} title="Remove movement">
                          x
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
