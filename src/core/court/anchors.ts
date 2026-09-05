import type { ZoneNumber } from './zones';
import type { LocalPos } from './coordinates';

/**
 * Default starting position for each zone, in team-local coordinates.
 * Overlap-legal by construction: front row (4, 3, 2) all sit closer to
 * the net than their back-row counterpart (5, 6, 1), and the lateral
 * order within each row holds (4 < 3 < 2, 5 < 6 < 1). See
 * core/rules/overlap.ts (Phase 2) for the validator these anchors
 * are designed to satisfy.
 */
export const ZONE_BASE: Readonly<Record<ZoneNumber, LocalPos>> = {
  4: { lat: -3.0, depth: 1.6 },
  3: { lat: 0.0, depth: 1.6 },
  2: { lat: 3.0, depth: 1.6 },
  5: { lat: -3.0, depth: 6.6 },
  6: { lat: 0.0, depth: 6.6 },
  1: { lat: 3.0, depth: 6.6 },
};

/** Where a front-row setter releases to on a standard serve-receive. */
export const SETTER_TARGET: Readonly<LocalPos> = { lat: 1.5, depth: 2.0 };
