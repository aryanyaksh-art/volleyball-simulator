import { useMemo } from 'react';
import { usePlayEditorStore } from '@/app/store/usePlayEditorStore';
import { useGuidedAuthorStore } from '@/app/store/useGuidedAuthorStore';
import {
  commitContactAction,
  commitPositionAction,
  describeStep,
  guidedEditFromStep,
  removeGuidedStep,
  spliceGuidedStepReplacement,
  type SetTarget,
} from '@/app/guidedAuthoring';
import type { GuidedAction, GuidedContactAction } from '@/core/play/guidedDefaults';
import type { HitterRole, SetCall } from '@/core/tactics/attack';
import { SET_TEMPO_S } from '@/core/tactics/attack';
import { SideHeightPicker } from '@/ui/SideHeightPicker';
import { TopDownTargetPicker } from '@/ui/TopDownTargetPicker';
import { GUIDED_CONTACT_DEFAULTS } from '@/core/play/guidedDefaults';
import { usePlaybackStore } from '@/app/store/usePlaybackStore';
import { breakdown } from '@/core/lineup/systems';
import { useLineupStore } from '@/app/store/useLineupStore';
import { findPlayer } from '@/core/roster/types';
import type { Side } from '@/core/court/coordinates';

const CONTACT_ACTIONS: GuidedContactAction[] = ['serve', 'pass', 'set', 'attack', 'tip'];
const POSITION_ACTIONS: GuidedAction[] = ['block', 'dig', 'move'];
const isContactAction = (action: GuidedAction): action is GuidedContactAction => (CONTACT_ACTIONS as GuidedAction[]).includes(action);
const HITTER_ROLES: HitterRole[] = ['OH', 'MB', 'RS', 'pipe'];
const SET_CALLS = Object.keys(SET_TEMPO_S) as SetCall[];
const SIDES: Side[] = ['A', 'B'];

/** "A:1" -> "#3 Outside 1" style label, falling back to the raw id if the roster/lineup lookup comes up empty (e.g. a slot with no one assigned). */
function playerLabel(onCourtId: string, rosters: ReturnType<typeof useLineupStore.getState>['rosters'], lineups: ReturnType<typeof useLineupStore.getState>['lineups'], rotations: ReturnType<typeof useLineupStore.getState>['rotations']): string {
  const [side, slotStr] = onCourtId.split(':') as [Side, string];
  const slot = Number(slotStr);
  const b = breakdown(lineups[side], rosters[side], side, rotations[side]);
  const onCourt = b.onCourt.find((p) => p.slot === slot);
  const player = onCourt ? findPlayer(rosters[side], onCourt.playerId) : undefined;
  return player ? `#${player.number} ${player.name}` : onCourtId;
}

export function GuidedAuthorPanel() {
  const play = usePlayEditorStore((s) => s.play);
  const applyGuidedAction = usePlayEditorStore((s) => s.applyGuidedAction);

  const rosters = useLineupStore((s) => s.rosters);
  const lineups = useLineupStore((s) => s.lineups);
  const rotations = useLineupStore((s) => s.rotations);

  const selectedOnCourtId = useGuidedAuthorStore((s) => s.selectedOnCourtId);
  const pendingAction = useGuidedAuthorStore((s) => s.pendingAction);
  const pendingTarget = useGuidedAuthorStore((s) => s.pendingTarget);
  const editingStepId = useGuidedAuthorStore((s) => s.editingStepId);
  const pendingBenchSwap = useGuidedAuthorStore((s) => s.pendingBenchSwap);
  const choosePendingAction = useGuidedAuthorStore((s) => s.choosePendingAction);
  const setPendingTarget = useGuidedAuthorStore((s) => s.setPendingTarget);
  const startEditingStep = useGuidedAuthorStore((s) => s.startEditingStep);
  const toggleBenchSwap = useGuidedAuthorStore((s) => s.toggleBenchSwap);
  const reset = useGuidedAuthorStore((s) => s.reset);

  const side = useMemo(() => (selectedOnCourtId ? (selectedOnCourtId.split(':')[0] as Side) : null), [selectedOnCourtId]);

  // Liberos are left off, same rule BenchPanel uses: they swap in automatically
  // via the lineup's rotation-driven assignment, never manually benched.
  const benchBySide = useMemo(() => {
    const out: Record<Side, { id: string; number: number; name: string }[]> = { A: [], B: [] };
    for (const s of SIDES) {
      const onCourtIds = new Set(lineups[s].order.filter((id): id is string => id != null));
      out[s] = rosters[s].players.filter((p) => p.primaryRole !== 'L' && !onCourtIds.has(p.id));
    }
    return out;
  }, [rosters, lineups]);

  if (!play) return null;

  const confirmContact = (setTarget?: SetTarget) => {
    if (!selectedOnCourtId || !side || !pendingAction) return;
    const replacingStepId = editingStepId;
    if (pendingAction === 'block' || pendingAction === 'dig' || pendingAction === 'move') {
      if (!pendingTarget) return;
      applyGuidedAction((p) => {
        const next = commitPositionAction(p, { action: pendingAction, onCourtId: selectedOnCourtId, side, target: pendingTarget });
        return replacingStepId ? spliceGuidedStepReplacement(p, next, replacingStepId) : next;
      });
    } else {
      if (pendingAction !== 'set' && !pendingTarget) return;
      applyGuidedAction((p) => {
        const next = commitContactAction(p, {
          action: pendingAction,
          onCourtId: selectedOnCourtId,
          side,
          target: pendingTarget ?? undefined,
          setTarget,
        });
        return replacingStepId ? spliceGuidedStepReplacement(p, next, replacingStepId) : next;
      });
    }
    reset();
  };

  const editStep = (stepId: string) => {
    const step = play.steps.find((s) => s.id === stepId);
    if (!step) return;
    const edit = guidedEditFromStep(step);
    if (!edit) return;
    startEditingStep(stepId, edit);
  };

  const removeStep = (stepId: string) => {
    applyGuidedAction((p) => removeGuidedStep(p, stepId));
    if (editingStepId === stepId) reset();
  };

  return (
    <div className="panel guided-author-panel">
      <h3 className="panel-title">Design play</h3>

      {selectedOnCourtId && (
        <p className="panel-note">
          {editingStepId ? 'Editing' : 'Selected'}: {playerLabel(selectedOnCourtId, rosters, lineups, rotations)}
        </p>
      )}
      {!selectedOnCourtId && !pendingBenchSwap && <p className="panel-note">Click a player in the 3D view to choose their action.</p>}
      {pendingBenchSwap && (
        <p className="panel-note">
          Click an on-court side {pendingBenchSwap.side} player to bring on{' '}
          {findPlayer(rosters[pendingBenchSwap.side], pendingBenchSwap.playerId)?.name ?? 'this player'}.
        </p>
      )}

      {selectedOnCourtId && !pendingAction && (
        <div className="control-group">
          {[...CONTACT_ACTIONS, ...POSITION_ACTIONS].map((action) => (
            <button key={action} className="chip" onClick={() => choosePendingAction(action)}>
              {action}
            </button>
          ))}
          <button className="chip" onClick={reset}>
            Cancel
          </button>
        </div>
      )}

      {selectedOnCourtId && pendingAction && pendingAction !== 'set' && (
        <div className="control-group guided-target-group">
          <div>
            <p className="panel-note">Click a spot on the court, or place it on the map.</p>
            <TopDownTargetPicker
              lat={pendingTarget?.lat ?? 0}
              depth={pendingTarget?.depth ?? 0}
              onChange={(lat, depth) => setPendingTarget({ ...(pendingTarget ?? {}), lat, depth })}
            />
          </div>
          {pendingTarget && (
            <div className="guided-target-confirm">
              {isContactAction(pendingAction) && (
                <SideHeightPicker
                  apexM={pendingTarget.apexM ?? GUIDED_CONTACT_DEFAULTS[pendingAction as GuidedContactAction]?.apexM ?? 2}
                  onChange={(apexM) => setPendingTarget({ ...pendingTarget, apexM })}
                />
              )}
              <button className="chip chip-active" onClick={() => confirmContact()}>
                Confirm
              </button>
              <button className="chip" onClick={reset}>
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {selectedOnCourtId && pendingAction === 'set' && <SetChooser onConfirm={confirmContact} onCancel={reset} />}

      <hr className="guided-divider" />

      <div className="guided-bench">
        <h4 className="panel-subtitle">Bench</h4>
        {SIDES.map((s) => (
          <div key={s} className="control-group">
            <span className="control-label">{s}</span>
            {benchBySide[s].length === 0 ? (
              <span className="panel-note">Everyone's on the court.</span>
            ) : (
              benchBySide[s].map((p) => (
                <button
                  key={p.id}
                  className={pendingBenchSwap?.playerId === p.id ? 'chip chip-small chip-active' : 'chip chip-small'}
                  onClick={() => toggleBenchSwap({ side: s, playerId: p.id })}
                >
                  #{p.number} {p.name}
                </button>
              ))
            )}
          </div>
        ))}
      </div>

      <hr className="guided-divider" />

      <div className="control-group">
        <button
          className="chip"
          onClick={() => {
            usePlayEditorStore.getState().saveCurrentPlay();
            usePlaybackStore.getState().setSelectedPlayId(play.id);
            usePlaybackStore.getState().setMode('play');
          }}
        >
          ▶ Save & Play
        </button>
      </div>

      <div className="guided-review">
        {play.steps.map((step) => {
          const editable = guidedEditFromStep(step) != null;
          return (
            <div key={step.id} className={editingStepId === step.id ? 'guided-review-row guided-review-row-active' : 'guided-review-row'}>
              <p className="panel-note">{describeStep(step)}</p>
              <div className="control-group">
                {editable && (
                  <button className="chip chip-small" onClick={() => editStep(step.id)}>
                    Edit
                  </button>
                )}
                <button
                  className="chip chip-small"
                  disabled={play.steps.length === 1}
                  title={play.steps.length === 1 ? 'A play needs at least one step' : undefined}
                  onClick={() => removeStep(step.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// TODO(follow-up): pendingTarget is being overloaded to carry {role, tempo} for
// the 'set' action's two-choice flow. Works, but a dedicated pendingSetTarget
// field on useGuidedAuthorStore would be cleaner. See plan Task 12.
function SetChooser({ onConfirm, onCancel }: { onConfirm: (setTarget: SetTarget) => void; onCancel: () => void }) {
  const pendingTarget = useGuidedAuthorStore((s) => s.pendingTarget);
  const setPendingTarget = useGuidedAuthorStore((s) => s.setPendingTarget);
  const role = (pendingTarget as unknown as { role?: HitterRole })?.role ?? null;
  const tempo = (pendingTarget as unknown as { tempo?: SetCall })?.tempo ?? null;

  return (
    <div className="control-group">
      <span className="control-label">Target</span>
      {HITTER_ROLES.map((r) => (
        <button
          key={r}
          className={role === r ? 'chip chip-active' : 'chip'}
          onClick={() => setPendingTarget({ lat: 0, depth: 0, ...(pendingTarget ?? {}), role: r } as never)}
        >
          {r}
        </button>
      ))}
      <span className="control-label">Tempo</span>
      {SET_CALLS.map((call) => (
        <button
          key={call}
          className={tempo === call ? 'chip chip-active' : 'chip'}
          onClick={() => setPendingTarget({ lat: 0, depth: 0, ...(pendingTarget ?? {}), tempo: call } as never)}
        >
          {call}
        </button>
      ))}
      <button className="chip" onClick={onCancel}>
        Cancel
      </button>
      <button className="chip chip-active" disabled={!role || !tempo} onClick={() => role && tempo && onConfirm({ role, tempo })}>
        Confirm
      </button>
    </div>
  );
}
