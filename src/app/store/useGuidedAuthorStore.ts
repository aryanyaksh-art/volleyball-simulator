import { create } from 'zustand';
import type { Side } from '@/core/court/coordinates';
import type { GuidedAction } from '@/core/play/guidedDefaults';
import type { GuidedStepEdit, GuidedTarget } from '@/app/guidedAuthoring';

export interface PendingBenchSwap {
  side: Side;
  playerId: string;
}

interface GuidedAuthorState {
  /** The player last clicked in the 3D view, `side:slot`, or null once their action is committed. */
  selectedOnCourtId: string | null;
  /** The action chosen for the selected player, awaiting a target click (or, for 'set', awaiting the target/tempo choice). */
  pendingAction: GuidedAction | null;
  /** The floor position clicked for the pending action, awaiting height confirmation via the side-view picker. */
  pendingTarget: GuidedTarget | null;
  /** Set while re-authoring an existing step via "Edit" in the Review list — confirming replaces this step in place instead of appending a new one. */
  editingStepId: string | null;
  /** A bench player picked to swap onto the court, awaiting a click on the on-court player they'll replace. Mutually exclusive with the action-assignment flow above. */
  pendingBenchSwap: PendingBenchSwap | null;

  selectPlayer: (onCourtId: string | null) => void;
  choosePendingAction: (action: GuidedAction | null) => void;
  setPendingTarget: (target: GuidedTarget | null) => void;
  /** Pre-fills selection/action/target from a previously-committed step so its choices can be adjusted instead of re-entered from scratch. */
  startEditingStep: (stepId: string, edit: GuidedStepEdit) => void;
  /** Picks (or, clicked again, un-picks) a bench player to bring on for whichever on-court player is clicked next. */
  toggleBenchSwap: (swap: PendingBenchSwap) => void;
  reset: () => void;
}

export const useGuidedAuthorStore = create<GuidedAuthorState>((set, get) => ({
  selectedOnCourtId: null,
  pendingAction: null,
  pendingTarget: null,
  editingStepId: null,
  pendingBenchSwap: null,

  selectPlayer: (onCourtId) =>
    set({ selectedOnCourtId: onCourtId, pendingAction: null, pendingTarget: null, editingStepId: null, pendingBenchSwap: null }),
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
      pendingBenchSwap: null,
    }),
  toggleBenchSwap: (swap) => {
    const current = get().pendingBenchSwap;
    const alreadyPicked = current && current.playerId === swap.playerId;
    set({
      pendingBenchSwap: alreadyPicked ? null : swap,
      selectedOnCourtId: null,
      pendingAction: null,
      pendingTarget: null,
      editingStepId: null,
    });
  },
  reset: () =>
    set({ selectedOnCourtId: null, pendingAction: null, pendingTarget: null, editingStepId: null, pendingBenchSwap: null }),
}));

if (import.meta.env.DEV) {
  (window as unknown as { __guidedAuthorStore: typeof useGuidedAuthorStore }).__guidedAuthorStore = useGuidedAuthorStore;
}
