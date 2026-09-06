import { create } from 'zustand';
import type { LocalPos, Side } from '@/core/court/coordinates';
import type { ZoneNumber } from '@/core/court/zones';
import type { Roster } from '@/core/roster/types';
import type { Lineup, LineupSystem } from '@/core/lineup/types';
import { DEMO_ROSTER_A, DEMO_ROSTER_B } from '@/fixtures/demoRoster';
import { DEMO_LINEUP_A, DEMO_LINEUP_B } from '@/fixtures/demoLineup';

interface LineupState {
  rosters: Record<Side, Roster>;
  lineups: Record<Side, Lineup>;
  rotations: Record<Side, number>;
  focusSide: Side;
  /**
   * Manual per-zone position overrides, keyed by physical zone (not
   * onCourtId — a zone is a fixed spot on the court that different players
   * cycle through as rotation changes). This is the pre-Phase-3 stand-in for
   * a real formation editor: it's what lets the overlap validator actually
   * be exercised against an illegal alignment in the running app today.
   */
  positionOverrides: Record<Side, Partial<Record<ZoneNumber, LocalPos>>>;

  setFocusSide: (side: Side) => void;
  setRotation: (side: Side, rotation: number) => void;
  setSystem: (side: Side, system: LineupSystem) => void;
  setOrderSlot: (side: Side, slot: number, playerId: string | null) => void;
  setPositionOverride: (side: Side, zone: ZoneNumber, pos: LocalPos) => void;
  resetPositionOverrides: (side: Side) => void;
}

export const useLineupStore = create<LineupState>((set) => ({
  rosters: { A: DEMO_ROSTER_A, B: DEMO_ROSTER_B },
  lineups: { A: DEMO_LINEUP_A, B: DEMO_LINEUP_B },
  rotations: { A: 0, B: 0 },
  focusSide: 'A',
  positionOverrides: { A: {}, B: {} },

  setFocusSide: (side) => set({ focusSide: side }),

  setRotation: (side, rotation) =>
    set((s) => ({ rotations: { ...s.rotations, [side]: ((rotation % 6) + 6) % 6 } })),

  setSystem: (side, system) =>
    set((s) => ({ lineups: { ...s.lineups, [side]: { ...s.lineups[side], system } } })),

  setOrderSlot: (side, slot, playerId) =>
    set((s) => {
      const order = [...s.lineups[side].order];
      order[slot] = playerId;
      return { lineups: { ...s.lineups, [side]: { ...s.lineups[side], order } } };
    }),

  setPositionOverride: (side, zone, pos) =>
    set((s) => ({
      positionOverrides: { ...s.positionOverrides, [side]: { ...s.positionOverrides[side], [zone]: pos } },
    })),

  resetPositionOverrides: (side) =>
    set((s) => ({ positionOverrides: { ...s.positionOverrides, [side]: {} } })),
}));

// Dev-only escape hatch, same pattern as useAppStore — lets automation/devtools
// drive lineup state directly without racing a person clicking the real UI.
if (import.meta.env.DEV) {
  (window as unknown as { __lineupStore: typeof useLineupStore }).__lineupStore = useLineupStore;
}
