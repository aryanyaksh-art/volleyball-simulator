import type { Vec3 } from '@/core/math/vec';

export type Side = 'A' | 'B';

export const otherSide = (side: Side): Side => (side === 'A' ? 'B' : 'A');

/**
 * Team-local court position. depth = meters from the net (0 at the net,
 * 9 at the endline). lat = signed left-right FROM THAT TEAM'S OWN
 * PERSPECTIVE facing the net. This is what makes zone 4 always "lat < 0"
 * regardless of which physical end of the court a team is playing from,
 * and what keeps the overlap validator symmetric and unbranched for
 * both sides.
 */
export interface LocalPos {
  lat: number;
  depth: number;
}

export const lerpLocal = (a: LocalPos, b: LocalPos, t: number): LocalPos => ({
  lat: a.lat + (b.lat - a.lat) * t,
  depth: a.depth + (b.depth - a.depth) * t,
});

export const distanceLocal = (a: LocalPos, b: LocalPos): number =>
  Math.hypot(b.lat - a.lat, b.depth - a.depth);

/**
 * World frame (what the renderer uses): meters, Y-up. The net plane sits
 * at z = 0. Side A occupies z in (0, 9], side B occupies z in [-9, 0).
 * Sidelines sit at x = +-4.5. The floor is y = 0.
 */
export const toLocal = (p: Vec3, side: Side): LocalPos =>
  side === 'A' ? { lat: p.x, depth: p.z } : { lat: -p.x, depth: -p.z };

export const toWorld = (l: LocalPos, side: Side, y = 0): Vec3 =>
  side === 'A' ? { x: l.lat, y, z: l.depth } : { x: -l.lat, y, z: -l.depth };
