import { create } from 'zustand';
import type { GuidedAction } from '@/core/play/guidedDefaults';
import type { GuidedStepEdit, GuidedTarget, SetTarget } from '@/app/guidedAuthoring';
import type { ZoneNumber } from '@/core/court/zones';

interface GuidedAuthorState {
  /** The player last clicked in the 3D view, `side:slot`, or null once their action is committed. */
  selectedOnCourtId: string | null;
  /** The action chosen for the selected player, awaiting a target click (or, for 'set', awaiting the target/tempo choice). */
  pendingAction: GuidedAction | null;
  /** The floor position clicked for the pending action, awaiting height confirmation via the side-view picker. Not used by 'set' — see pendingSetTarget. */
  pendingTarget: GuidedTarget | null;
  /** The role/tempo choice for a pending 'set' action — a dedicated field rather than overloading pendingTarget (which used to carry {role, tempo} via `as never` casts). */
  pendingSetTarget: Partial<SetTarget> | null;
  /** Set while re-authoring an existing step via "Edit" in the Review list — confirming replaces this step in place instead of appending a new one. */
  editingStepId: string | null;
  /** The zone a floor click landed nearest to when nothing was selected and that zone has no on-court player — a one-line hint, not an error state. Cleared on the next selection or a click near an occupied zone. */
  emptySlotHint: ZoneNumber | null;

  selectPlayer: (onCourtId: string | null) => void;
  choosePendingAction: (action: GuidedAction | null) => void;
  setPendingTarget: (target: GuidedTarget | null) => void;
  setPendingSetTarget: (target: Partial<SetTarget> | null) => void;
  /** Pre-fills selection/action/target from a previously-committed step so its choices can be adjusted instead of re-entered from scratch. */
  startEditingStep: (stepId: string, edit: GuidedStepEdit) => void;
  setEmptySlotHint: (zone: ZoneNumber | null) => void;
  reset: () => void;
}

export const useGuidedAuthorStore = create<GuidedAuthorState>((set) => ({
  selectedOnCourtId: null,
  pendingAction: null,
  pendingTarget: null,
  pendingSetTarget: null,
  editingStepId: null,
  emptySlotHint: null,

  selectPlayer: (onCourtId) =>
    set({
      selectedOnCourtId: onCourtId,
      pendingAction: null,
      pendingTarget: null,
      pendingSetTarget: null,
      editingStepId: null,
      emptySlotHint: null,
    }),
  choosePendingAction: (action) => set({ pendingAction: action, pendingTarget: null, pendingSetTarget: null }),
  setPendingTarget: (target) => set({ pendingTarget: target }),
  setPendingSetTarget: (target) => set({ pendingSetTarget: target }),
  startEditingStep: (stepId, edit) =>
    set({
      selectedOnCourtId: edit.onCourtId,
      pendingAction: edit.action,
      pendingTarget: edit.target ?? null,
      pendingSetTarget: edit.setTarget ?? null,
      editingStepId: stepId,
    }),
  setEmptySlotHint: (zone) => set({ emptySlotHint: zone }),
  reset: () =>
    set({
      selectedOnCourtId: null,
      pendingAction: null,
      pendingTarget: null,
      pendingSetTarget: null,
      editingStepId: null,
      emptySlotHint: null,
    }),
}));

if (import.meta.env.DEV) {
  (window as unknown as { __guidedAuthorStore: typeof useGuidedAuthorStore }).__guidedAuthorStore = useGuidedAuthorStore;
}
