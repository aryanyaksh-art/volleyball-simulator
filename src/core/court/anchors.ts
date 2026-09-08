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

/** Resolves a zone's effective position: a manual override if one is set, else the default anchor. */
export const effectivePosition = (zone: ZoneNumber, overrides?: Partial<Record<ZoneNumber, LocalPos>>): LocalPos =>
  overrides?.[zone] ?? ZONE_BASE[zone];

/** The zone whose default anchor is closest to `local` — used for drop-target resolution (BenchDragController) and for Alt-snap while dragging a player (PlayerDragController). Always the plain ZONE_BASE anchors, not a formation's own overrides: this answers "which zone is this near," not "which zone is a specific team's player standing in." */
export const nearestZone = (local: LocalPos): ZoneNumber => {
  let closest: ZoneNumber = 1;
  let closestDist = Infinity;
  for (const [zoneStr, pos] of Object.entries(ZONE_BASE)) {
    const d = Math.hypot(pos.lat - local.lat, pos.depth - local.depth);
    if (d < closestDist) {
      closestDist = d;
      closest = Number(zoneStr) as ZoneNumber;
    }
  }
  return closest;
};

const BENCH_SPACING_M = 1.0;
const BENCH_DEPTH_M = 10.5;
const BENCH_DEPTH_MARGIN_M = 1.0;

/** Position for the `index`-th of `count` bench players, spaced 1m apart and centered on lat 0, standing past the free zone behind the team's own endline. */
export const benchSlotPosition = (index: number, count: number, depthM = BENCH_DEPTH_M): LocalPos => ({
  lat: (index - (count - 1) / 2) * BENCH_SPACING_M,
  depth: depthM,
});

/**
 * The bench row's own depth, pulled back further whenever a manual
 * FormationPanel override pushes some zone deeper than the default bench
 * row would otherwise clear — purely cosmetic, but a manually-displaced
 * formation shouldn't visually collide with the bench line. Never pulls the
 * row closer than the default, only further away.
 */
export const benchDepthForOverrides = (
  overrides: Partial<Record<ZoneNumber, LocalPos>> | undefined,
  baseDepthM = BENCH_DEPTH_M,
): number => {
  if (!overrides) return baseDepthM;
  let maxDepth = baseDepthM;
  for (const pos of Object.values(overrides)) {
    if (pos && pos.depth + BENCH_DEPTH_MARGIN_M > maxDepth) maxDepth = pos.depth + BENCH_DEPTH_MARGIN_M;
  }
  return maxDepth;
};
