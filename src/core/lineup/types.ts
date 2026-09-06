import type { Side } from '@/core/court/coordinates';
import type { ZoneNumber } from '@/core/court/zones';

export type LineupSystem = '5-1' | '6-2' | '4-2';

/** A player as they exist in a specific rotation, not their durable roster identity. */
export interface OnCourtPlayer {
  onCourtId: string;
  side: Side;
  slot: number; // 0-5, index into Lineup.order; also the serve-order position
  playerId: string | null; // null = anonymous drill body
  zone: ZoneNumber | null; // null when the side isn't a legal 6
  row: 'front' | 'back' | null;
  isServer: boolean;
  isLibero: boolean;
}

export interface LiberoAssignment {
  liberoPlayerId: string;
  /** Which serve-order slot this libero swaps in for while that slot is back row. */
  replacesSlot: number;
}

export interface Lineup {
  id: string;
  name: string;
  rosterId: string;
  system: LineupSystem;
  /** order[j] starts in zone j+1 at rotation 0; also the serve order. null = empty slot (drill mode). */
  order: (string | null)[];
  liberos: LiberoAssignment[];
  /** Overlap is enforced only when this is exactly 6. */
  playerCount: number;
}

export const isLegalSix = (lineup: Lineup): boolean => lineup.playerCount === 6 && lineup.order.length === 6;

export const createEmptyLineup = (rosterId: string, system: LineupSystem = '5-1'): Lineup => ({
  id: crypto.randomUUID(),
  name: 'New lineup',
  rosterId,
  system,
  order: [null, null, null, null, null, null],
  liberos: [],
  playerCount: 6,
});
