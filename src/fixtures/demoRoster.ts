import type { Roster } from '@/core/roster/types';

/**
 * A real 5-1 roster per side: setter, opposite, two outsides, two middles,
 * and a libero who swaps in for MB1 whenever that slot rotates back row.
 * Used as the Phase 2 ship-target fixture — build a real lineup, click
 * through all 6 rotations, see live overlap legality.
 */
const buildRoster = (side: 'A' | 'B'): Roster => ({
  id: `roster-${side}`,
  name: side === 'A' ? 'Home' : 'Visitors',
  players: [
    { id: `${side}-S`, name: 'Setter', number: 1, primaryRole: 'S', handedness: 'R' },
    // Also tagged as a secondary setter so switching the lineup's system
    // selector to 6-2/4-2 has a real second setter to alternate with — see
    // core/lineup/systems.ts's pickFunctionalSetter.
    { id: `${side}-OPP`, name: 'Opposite', number: 2, primaryRole: 'OPP', secondaryRoles: ['S'], handedness: 'R' },
    { id: `${side}-OH1`, name: 'Outside 1', number: 3, primaryRole: 'OH', handedness: 'R' },
    { id: `${side}-OH2`, name: 'Outside 2', number: 4, primaryRole: 'OH', handedness: 'L' },
    { id: `${side}-MB1`, name: 'Middle 1', number: 5, primaryRole: 'MB', handedness: 'R' },
    { id: `${side}-MB2`, name: 'Middle 2', number: 6, primaryRole: 'MB', handedness: 'R' },
    { id: `${side}-L`, name: 'Libero', number: 7, primaryRole: 'L', handedness: 'R' },
  ],
});

export const DEMO_ROSTER_A = buildRoster('A');
export const DEMO_ROSTER_B = buildRoster('B');
