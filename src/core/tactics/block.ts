import type { Vec3 } from '@/core/math/vec';
import { add3, scale3, sub3 } from '@/core/math/vec';

/** Where the ray from `contact` through `edgePoint` crosses the floor plane y=0. */
export const projectToFloor = (contact: Vec3, edgePoint: Vec3): Vec3 => {
  const dir = sub3(edgePoint, contact);
  if (Math.abs(dir.y) < 1e-9) return { ...edgePoint, y: 0 };
  const u = -contact.y / dir.y;
  return add3(contact, scale3(dir, u));
};

export interface BlockTopEdge {
  a: Vec3;
  b: Vec3;
}

/**
 * The block shadow: a quadrilateral on the floor cast from the hitter's
 * contact point over both ends of the block's top edge. The near side is
 * the block's own footprint (straight down from each hand, at the net);
 * the far side is where the contact-to-hand rays continue on to the floor.
 * A ball hit over the block, inside its width, lands somewhere in this
 * region if nothing touches it. Clipped to the court by clamping each
 * corner's coordinates — good enough for a coaching overlay, not full
 * polygon clipping.
 */
export const computeBlockShadow = (
  contact: Vec3,
  edge: BlockTopEdge,
  courtHalfWidthM: number,
  courtHalfLengthM: number,
): Vec3[] => {
  const nearA: Vec3 = { x: edge.a.x, y: 0, z: edge.a.z };
  const nearB: Vec3 = { x: edge.b.x, y: 0, z: edge.b.z };
  const farA = projectToFloor(contact, edge.a);
  const farB = projectToFloor(contact, edge.b);

  const clamp = (p: Vec3): Vec3 => ({
    x: Math.max(-courtHalfWidthM, Math.min(courtHalfWidthM, p.x)),
    y: 0,
    z: Math.max(-courtHalfLengthM, Math.min(courtHalfLengthM, p.z)),
  });

  return [nearA, nearB, farB, farA].map(clamp);
};

/** Standard ray-casting point-in-polygon test on the x/z (floor) plane. Works for the block shadow's quadrilateral or any simple polygon. */
export const isPointInPolygon = (point: { x: number; z: number }, polygon: Vec3[]): boolean => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i];
    const pj = polygon[j];
    const intersects = pi.z > point.z !== pj.z > point.z && point.x < ((pj.x - pi.x) * (point.z - pi.z)) / (pj.z - pi.z) + pi.x;
    if (intersects) inside = !inside;
  }
  return inside;
};

export interface ShadowDefenderCheck {
  onCourtId: string;
  inShadow: boolean;
}

/** DEFENDER_IN_SHADOW — flags defenders standing inside the block shadow. Correct positioning under some systems (bunch-read commits defenders there on purpose), wrong under others (perimeter wants them out); the caller decides which reading applies. */
export const checkDefendersInShadow = (
  polygon: Vec3[],
  defenders: { onCourtId: string; pos: Vec3 }[],
): ShadowDefenderCheck[] => defenders.map((d) => ({ onCourtId: d.onCourtId, inShadow: isPointInPolygon(d.pos, polygon) }));

export interface OpenCone {
  id: string;
  apex: Vec3;
  edgeA: Vec3;
  edgeB: Vec3;
}

export interface OpenAngleCones {
  left: OpenCone;
  right: OpenCone;
}

/**
 * Two open-angle cones flanking the block shadow — a shot down each
 * sideline from the hitter's contact point, around the OUTSIDE of the
 * block, to that side's deep corner. Labeled left/right by world x rather
 * than "line"/"angle": which physical shot ("down the line" vs
 * "cross-court") each one reads as depends on which direction the hitter
 * approached from, which this pure geometry function doesn't know — the
 * caller/UI maps that if it has the context (lateralSign). Reuses
 * computeBlockShadow's own polygon as the inner boundary, so the cones and
 * the shadow always agree on where the block actually is. Returns null
 * when there's no block up (an empty shadow polygon) — with no block, the
 * "gap around it" framing doesn't apply.
 */
export const computeOpenAngleCones = (
  contact: Vec3,
  blockShadowPolygon: Vec3[],
  courtHalfWidthM: number,
  courtHalfLengthM: number,
): OpenAngleCones | null => {
  if (blockShadowPolygon.length < 4) return null;
  // computeBlockShadow returns [nearA, nearB, farB, farA].
  const farB = blockShadowPolygon[2];
  const farA = blockShadowPolygon[3];
  const deepZ = farA.z >= 0 ? courtHalfLengthM : -courtHalfLengthM;
  const leftCorner: Vec3 = { x: -courtHalfWidthM, y: 0, z: deepZ };
  const rightCorner: Vec3 = { x: courtHalfWidthM, y: 0, z: deepZ };
  return {
    left: { id: 'left', apex: contact, edgeA: leftCorner, edgeB: farA },
    right: { id: 'right', apex: contact, edgeA: farB, edgeB: rightCorner },
  };
};

export interface ReachCheck {
  covered: boolean;
  marginM: number;
}

/**
 * Whether a defender is within reach of an open angle (line/angle/seam)
 * cone — approximated as distance from the defender to the cone's far
 * edge midpoint versus their reach. A cheap stand-in for "is anyone
 * covering this angle", not a full geometric coverage solve.
 */
export const checkOpenAngle = (cone: OpenCone, defenderPos: Vec3, reachM: number): ReachCheck => {
  const mid: Vec3 = { x: (cone.edgeA.x + cone.edgeB.x) / 2, y: 0, z: (cone.edgeA.z + cone.edgeB.z) / 2 };
  const distM = Math.hypot(defenderPos.x - mid.x, defenderPos.z - mid.z);
  const marginM = reachM - distM;
  return { covered: marginM >= 0, marginM };
};

export interface TipRegion {
  center: Vec3;
  radiusM: number;
}

/** A tip drops just past the block, near the net — modeled as a circle centered on the attacker's contact point. */
export const computeTipRegion = (contact: Vec3, radiusM = 1.5): TipRegion => ({ center: contact, radiusM });

/** TIP_UNCOVERED — the assigned defender's reach circle doesn't overlap the tip region. */
export const checkTipCoverage = (region: TipRegion, defenderPos: Vec3, defenderReachM: number): ReachCheck => {
  const distM = Math.hypot(defenderPos.x - region.center.x, defenderPos.z - region.center.z);
  const marginM = defenderReachM + region.radiusM - distM;
  return { covered: marginM >= 0, marginM };
};
