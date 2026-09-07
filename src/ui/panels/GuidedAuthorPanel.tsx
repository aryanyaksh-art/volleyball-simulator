import { useMemo } from 'react';
import { usePlayEditorStore } from '@/app/store/usePlayEditorStore';
import { useGuidedAuthorStore } from '@/app/store/useGuidedAuthorStore';
import { commitContactAction, commitPositionAction, describeStep, type SetTarget } from '@/app/guidedAuthoring';
import type { GuidedAction, GuidedContactAction } from '@/core/play/guidedDefaults';
import type { HitterRole, SetCall } from '@/core/tactics/attack';
import { SET_TEMPO_S } from '@/core/tactics/attack';
import { SideHeightPicker } from '@/ui/SideHeightPicker';
import { GUIDED_CONTACT_DEFAULTS } from '@/core/play/guidedDefaults';
import { usePlaybackStore } from '@/app/store/usePlaybackStore';
import { breakdown } from '@/core/lineup/systems';
import { useLineupStore } from '@/app/store/useLineupStore';
import { findPlayer } from '@/core/roster/types';
import type { Side } from '@/core/court/coordinates';

const CONTACT_ACTIONS: GuidedContactAction[] = ['serve', 'pass', 'set', 'attack', 'tip'];
const POSITION_ACTIONS: GuidedAction[] = ['block', 'dig', 'move'];
const HITTER_ROLES: HitterRole[] = ['OH', 'MB', 'RS', 'pipe'];
const SET_CALLS = Object.keys(SET_TEMPO_S) as SetCall[];

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
  const choosePendingAction = useGuidedAuthorStore((s) => s.choosePendingAction);
  const setPendingTarget = useGuidedAuthorStore((s) => s.setPendingTarget);
  const reset = useGuidedAuthorStore((s) => s.reset);

  const side = useMemo(() => (selectedOnCourtId ? (selectedOnCourtId.split(':')[0] as Side) : null), [selectedOnCourtId]);

  if (!play) return null;

  const confirmContact = (setTarget?: SetTarget) => {
    if (!selectedOnCourtId || !side || !pendingAction) return;
    if (pendingAction === 'block' || pendingAction === 'dig' || pendingAction === 'move') {
      if (!pendingTarget) return;
      applyGuidedAction((p) => commitPositionAction(p, { action: pendingAction, onCourtId: selectedOnCourtId, side, target: pendingTarget }));
    } else {
      if (pendingAction !== 'set' && !pendingTarget) return;
      applyGuidedAction((p) =>
        commitContactAction(p, {
          action: pendingAction,
          onCourtId: selectedOnCourtId,
          side,
          target: pendingTarget ?? undefined,
          setTarget,
        }),
      );
    }
    reset();
  };

  return (
    <div className="panel guided-author-panel">
      <h3 className="panel-title">Design play</h3>

      {selectedOnCourtId && <p className="panel-note">Selected: {playerLabel(selectedOnCourtId, rosters, lineups, rotations)}</p>}
      {!selectedOnCourtId && <p className="panel-note">Click a player in the 3D view to choose their action.</p>}

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

      {selectedOnCourtId && pendingAction && pendingAction !== 'set' && !pendingTarget && (
        <p className="panel-note">Click a spot on the court for this {pendingAction}.</p>
      )}

      {selectedOnCourtId && pendingAction && pendingAction !== 'set' && pendingTarget && (
        <div className="control-group">
          <SideHeightPicker
            apexM={pendingTarget.apexM ?? GUIDED_CONTACT_DEFAULTS[pendingAction as GuidedContactAction]?.apexM ?? 2}
            onChange={(apexM) => setPendingTarget({ ...pendingTarget, apexM })}
          />
          <button className="chip chip-active" onClick={() => confirmContact()}>
            Confirm
          </button>
        </div>
      )}

      {selectedOnCourtId && pendingAction === 'set' && <SetChooser onConfirm={confirmContact} />}

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
        {play.steps.map((step) => (
          <p key={step.id} className="panel-note">
            {describeStep(step)}
          </p>
        ))}
      </div>
    </div>
  );
}

// TODO(follow-up): pendingTarget is being overloaded to carry {role, tempo} for
// the 'set' action's two-choice flow. Works, but a dedicated pendingSetTarget
// field on useGuidedAuthorStore would be cleaner. See plan Task 12.
function SetChooser({ onConfirm }: { onConfirm: (setTarget: SetTarget) => void }) {
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
      <button className="chip chip-active" disabled={!role || !tempo} onClick={() => role && tempo && onConfirm({ role, tempo })}>
        Confirm
      </button>
    </div>
  );
}
