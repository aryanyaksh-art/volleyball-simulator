import { create } from 'zustand';
import type { Side } from '@/core/court/coordinates';
import type { AttackZone, BlockScheme, SetCall } from '@/core/tactics/attack';
import type { DefensiveSystem } from '@/core/tactics/defense';

interface MatchupState {
  attackingSide: Side;
  attackZone: AttackZone;
  setCall: SetCall;
  /** Which way the hitter's approach bends away from a straight line back from the net. */
  lateralSign: 1 | -1;
  blockScheme: BlockScheme;
  defensiveSystem: DefensiveSystem;
  /** Defending-side serve-order slot assigned to cover the tip, if any. */
  tipDefenderSlot: number | null;

  setAttackingSide: (side: Side) => void;
  setAttackZone: (zone: AttackZone) => void;
  setSetCall: (call: SetCall) => void;
  setLateralSign: (sign: 1 | -1) => void;
  setBlockScheme: (scheme: BlockScheme) => void;
  setDefensiveSystem: (system: DefensiveSystem) => void;
  setTipDefenderSlot: (slot: number | null) => void;
}

export const useMatchupStore = create<MatchupState>((set) => ({
  attackingSide: 'B',
  attackZone: 4,
  setCall: '31',
  lateralSign: -1,
  blockScheme: 'spread',
  defensiveSystem: 'perimeter',
  tipDefenderSlot: null,

  setAttackingSide: (side) => set({ attackingSide: side }),
  setAttackZone: (zone) => set({ attackZone: zone }),
  setSetCall: (call) => set({ setCall: call }),
  setLateralSign: (sign) => set({ lateralSign: sign }),
  setBlockScheme: (scheme) => set({ blockScheme: scheme }),
  setDefensiveSystem: (system) => set({ defensiveSystem: system }),
  setTipDefenderSlot: (slot) => set({ tipDefenderSlot: slot }),
}));

if (import.meta.env.DEV) {
  (window as unknown as { __matchupStore: typeof useMatchupStore }).__matchupStore = useMatchupStore;
}
