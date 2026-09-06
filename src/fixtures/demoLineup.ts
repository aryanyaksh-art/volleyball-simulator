import type { Lineup } from '@/core/lineup/types';

/**
 * Serve order: S, OH1, MB1, OPP, OH2, MB2 — setter and opposite sit 3 apart
 * in slots, same for each OH/MB pair, so this passes validateLineupComposition
 * with zero warnings. The libero replaces MB1 (slot 2) whenever that slot
 * rotates into the back row.
 */
const buildLineup = (side: 'A' | 'B'): Lineup => ({
  id: `lineup-${side}`,
  name: side === 'A' ? 'Home 5-1' : 'Visitors 5-1',
  rosterId: `roster-${side}`,
  system: '5-1',
  order: [`${side}-S`, `${side}-OH1`, `${side}-MB1`, `${side}-OPP`, `${side}-OH2`, `${side}-MB2`],
  liberos: [{ liberoPlayerId: `${side}-L`, replacesSlot: 2 }],
  playerCount: 6,
});

export const DEMO_LINEUP_A = buildLineup('A');
export const DEMO_LINEUP_B = buildLineup('B');
