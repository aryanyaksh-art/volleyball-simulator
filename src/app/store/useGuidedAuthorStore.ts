import { create } from 'zustand';
import type { GuidedAction } from '@/core/play/guidedDefaults';
import type { GuidedStepEdit, GuidedTarget } from '@/app/guidedAuthoring';

interface GuidedAuthorState {
  /** The player last clicked in the 3D view, `side:slot`, or null once their action is committed. */
  selectedOnCourtId: string | null;
  /** The action chosen for the selected player, awaiting a target click (or, for 'set', awaiting the target/tempo choice). */
  pendingAction: GuidedAction | null;
  /** The floor position clicked for the pending action, awaiting height confirmation via the side-view picker. */
  pendingTarget: GuidedTarget | null;
  /** Set while re-authoring an existing step via "Edit" in the Review list — confirming replaces this step in place instead of appending a new one. */
  editingStepId: string | null;

  selectPlayer: (onCourtId: string | null) => void;
  choosePendingAction: (action: GuidedAction | null) => void;
  setPendingTarget: (target: GuidedTarget | null) => void;
  /** Pre-fills selection/action/target from a previously-committed step so its choices can be adjusted instead of re-entered from scratch. */
  startEditingStep: (stepId: string, edit: GuidedStepEdit) => void;
  reset: () => void;
}

export const useGuidedAuthorStore = create<GuidedAuthorState>((set) => ({
  selectedOnCourtId: null,
  pendingAction: null,
  pendingTarget: null,
  editingStepId: null,

  selectPlayer: (onCourtId) => set({ selectedOnCourtId: onCourtId, pendingAction: null, pendingTarget: null, editingStepId: null }),
  choosePendingAction: (action) => set({ pendingAction: action, pendingTarget: null }),
  setPendingTarget: (target) => set({ pendingTarget: target }),
  startEditingStep: (stepId, edit) =>
    set({
      selectedOnCourtId: edit.onCourtId,
      pendingAction: edit.action,
      pendingTarget: edit.setTarget
        ? ({ lat: 0, depth: 0, ...edit.setTarget } as unknown as GuidedTarget)
        : (edit.target ?? null),
      editingStepId: stepId,
    }),
  reset: () => set({ selectedOnCourtId: null, pendingAction: null, pendingTarget: null, editingStepId: null }),
}));

if (import.meta.env.DEV) {
  (window as unknown as { __guidedAuthorStore: typeof useGuidedAuthorStore }).__guidedAuthorStore = useGuidedAuthorStore;
}
