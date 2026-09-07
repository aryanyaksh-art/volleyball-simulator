import { create } from 'zustand';
import type { GuidedAction } from '@/core/play/guidedDefaults';
import type { GuidedTarget } from '@/app/guidedAuthoring';

interface GuidedAuthorState {
  /** The player last clicked in the 3D view, `side:slot`, or null once their action is committed. */
  selectedOnCourtId: string | null;
  /** The action chosen for the selected player, awaiting a target click (or, for 'set', awaiting the target/tempo choice). */
  pendingAction: GuidedAction | null;
  /** The floor position clicked for the pending action, awaiting height confirmation via the side-view picker. */
  pendingTarget: GuidedTarget | null;

  selectPlayer: (onCourtId: string | null) => void;
  choosePendingAction: (action: GuidedAction | null) => void;
  setPendingTarget: (target: GuidedTarget | null) => void;
  reset: () => void;
}

export const useGuidedAuthorStore = create<GuidedAuthorState>((set) => ({
  selectedOnCourtId: null,
  pendingAction: null,
  pendingTarget: null,

  selectPlayer: (onCourtId) => set({ selectedOnCourtId: onCourtId, pendingAction: null, pendingTarget: null }),
  choosePendingAction: (action) => set({ pendingAction: action, pendingTarget: null }),
  setPendingTarget: (target) => set({ pendingTarget: target }),
  reset: () => set({ selectedOnCourtId: null, pendingAction: null, pendingTarget: null }),
}));

if (import.meta.env.DEV) {
  (window as unknown as { __guidedAuthorStore: typeof useGuidedAuthorStore }).__guidedAuthorStore = useGuidedAuthorStore;
}
