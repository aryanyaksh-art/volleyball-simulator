import type { LocalPos } from '@/core/court/coordinates';
import type { ZoneNumber } from '@/core/court/zones';
import type { AttackZone, DefensiveSystem } from './defense';

/**
 * Base back-row (and, for six-back, front-row-off-block) positions per
 * defensive system, keyed by which zone the opponent is attacking from.
 * Simplified relative to real defensive schemes — a coaching-tool sketch
 * of "roughly where everyone starts," not a full read-and-react system —
 * good enough to compare "man-up vs six-back" at a glance and then hand-
 * adjust with the existing FormationPanel overrides.
 */
const SYSTEM_ADJUSTMENTS: Record<DefensiveSystem, (attackZone: AttackZone) => Partial<Record<ZoneNumber, LocalPos>>> = {
  perimeter: () => ({
    1: { lat: 3.8, depth: 7.5 },
    5: { lat: -3.8, depth: 7.5 },
    6: { lat: 0, depth: 6.5 },
  }),

  rotation: (attackZone) => {
    // Zone 6 shifts under the attack's angle; the far corner opens up to compensate.
    const shift = attackZone === 4 ? -1.0 : attackZone === 2 ? 1.0 : 0;
    return {
      1: { lat: 3.5, depth: 7.0 },
      5: { lat: -3.5, depth: 7.0 },
      6: { lat: shift, depth: 4.5 },
    };
  },

  'man-up': () => ({
    1: { lat: 3.5, depth: 7.5 },
    5: { lat: -3.5, depth: 7.5 },
    6: { lat: 0, depth: 3.5 }, // crashes up to cover the tip/short zone
  }),

  'six-back': () => ({
    1: { lat: 3.5, depth: 8.0 },
    5: { lat: -3.5, depth: 8.0 },
    6: { lat: 0, depth: 7.5 },
    4: { lat: -3.0, depth: 2.5 }, // blockers drop off deep too — used against a weaker attack
    3: { lat: 0, depth: 2.5 },
    2: { lat: 3.0, depth: 2.5 },
  }),
};

export const DEFENSIVE_SYSTEMS: readonly DefensiveSystem[] = ['perimeter', 'rotation', 'man-up', 'six-back'];

export const defensiveBase = (system: DefensiveSystem, attackZone: AttackZone): Partial<Record<ZoneNumber, LocalPos>> =>
  SYSTEM_ADJUSTMENTS[system](attackZone);
