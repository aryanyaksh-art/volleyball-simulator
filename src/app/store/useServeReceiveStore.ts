import { create } from 'zustand';
import type { LocalPos, Side } from '@/core/court/coordinates';
import type { ZoneNumber } from '@/core/court/zones';
import type { ServeType } from '@/core/tactics/serveReceive';

interface ServeReceiveState {
  receivingSide: Side;
  /** Serve-order slots (0-5) designated as passers for the current rotation. */
  passerSlots: number[];
  /** Per-slot weight multiplier — >1 widens that passer's effective range (libero, primary passer). */
  passerWeights: Record<number, number>;
  serveOriginZone: ZoneNumber;
  /** A specific aimed serve, in the SERVING side's own local frame — separate from serveOriginZone, which only picks where the whole-grid analysis originates from. Null until the coach places one. */
  serveTargetOverride: LocalPos | null;
  serveType: ServeType;

  setReceivingSide: (side: Side) => void;
  togglePasserSlot: (slot: number) => void;
  /** Bulk-replaces the passer slots — used by formation presets, which pick a whole set at once rather than one toggle at a time. */
  setPasserSlots: (slots: number[]) => void;
  setPasserWeight: (slot: number, weight: number) => void;
  setServeOriginZone: (zone: ZoneNumber) => void;
  setServeTargetOverride: (target: LocalPos | null) => void;
  setServeType: (type: ServeType) => void;
}

export const useServeReceiveStore = create<ServeReceiveState>((set) => ({
  receivingSide: 'B',
  passerSlots: [],
  passerWeights: {},
  serveOriginZone: 1,
  serveTargetOverride: null,
  serveType: 'float',

  setReceivingSide: (side) => set({ receivingSide: side, passerSlots: [], passerWeights: {} }),

  togglePasserSlot: (slot) =>
    set((s) => ({
      passerSlots: s.passerSlots.includes(slot) ? s.passerSlots.filter((x) => x !== slot) : [...s.passerSlots, slot],
    })),

  setPasserSlots: (slots) => set({ passerSlots: slots }),

  setPasserWeight: (slot, weight) => set((s) => ({ passerWeights: { ...s.passerWeights, [slot]: weight } })),

  setServeOriginZone: (zone) => set({ serveOriginZone: zone }),
  setServeTargetOverride: (target) => set({ serveTargetOverride: target }),
  setServeType: (type) => set({ serveType: type }),
}));

if (import.meta.env.DEV) {
  (window as unknown as { __serveReceiveStore: typeof useServeReceiveStore }).__serveReceiveStore = useServeReceiveStore;
}
