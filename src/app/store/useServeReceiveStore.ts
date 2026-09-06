import { create } from 'zustand';
import type { Side } from '@/core/court/coordinates';
import type { ZoneNumber } from '@/core/court/zones';

interface ServeReceiveState {
  receivingSide: Side;
  /** Serve-order slots (0-5) designated as passers for the current rotation. */
  passerSlots: number[];
  /** Per-slot weight multiplier — >1 widens that passer's effective range (libero, primary passer). */
  passerWeights: Record<number, number>;
  serveOriginZone: ZoneNumber;

  setReceivingSide: (side: Side) => void;
  togglePasserSlot: (slot: number) => void;
  setPasserWeight: (slot: number, weight: number) => void;
  setServeOriginZone: (zone: ZoneNumber) => void;
}

export const useServeReceiveStore = create<ServeReceiveState>((set) => ({
  receivingSide: 'B',
  passerSlots: [],
  passerWeights: {},
  serveOriginZone: 1,

  setReceivingSide: (side) => set({ receivingSide: side, passerSlots: [], passerWeights: {} }),

  togglePasserSlot: (slot) =>
    set((s) => ({
      passerSlots: s.passerSlots.includes(slot) ? s.passerSlots.filter((x) => x !== slot) : [...s.passerSlots, slot],
    })),

  setPasserWeight: (slot, weight) => set((s) => ({ passerWeights: { ...s.passerWeights, [slot]: weight } })),

  setServeOriginZone: (zone) => set({ serveOriginZone: zone }),
}));

if (import.meta.env.DEV) {
  (window as unknown as { __serveReceiveStore: typeof useServeReceiveStore }).__serveReceiveStore = useServeReceiveStore;
}
