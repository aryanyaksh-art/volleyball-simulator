import { describe, expect, it } from 'vitest';
import {
  checkDefendersInShadow,
  checkOpenAngle,
  checkTipCoverage,
  computeBlockShadow,
  computeOpenAngleCones,
  computeTipRegion,
  isPointInPolygon,
  projectToFloor,
  type BlockTopEdge,
} from '@/core/tactics/block';

describe('projectToFloor', () => {
  it('projects straight down when the edge point is directly below the contact', () => {
    const p = projectToFloor({ x: 0, y: 3, z: 5 }, { x: 0, y: 2.6, z: 0 });
    expect(p.y).toBeCloseTo(0, 6);
    // A ray from (0,3,5) through (0,2.6,0) continues past the block toward the net side (z decreasing).
    expect(p.z).toBeLessThan(0);
  });

  it('a contact directly above the edge point in x/z lands at that x/z', () => {
    const p = projectToFloor({ x: 1, y: 3, z: 4 }, { x: 1, y: 2.43, z: 4 });
    expect(p.x).toBeCloseTo(1, 6);
    expect(p.z).toBeCloseTo(4, 6);
  });
});

describe('computeBlockShadow', () => {
  const edge: BlockTopEdge = { a: { x: -0.5, y: 2.6, z: 0 }, b: { x: 0.5, y: 2.6, z: 0 } };

  it('produces a 4-point polygon with the near edge directly under the block', () => {
    const contact = { x: 0, y: 3.2, z: 3 };
    const polygon = computeBlockShadow(contact, edge, 4.5, 9);
    expect(polygon).toHaveLength(4);
    expect(polygon[0]).toMatchObject({ x: -0.5, y: 0, z: 0 });
    expect(polygon[1]).toMatchObject({ x: 0.5, y: 0, z: 0 });
  });

  it('clips corners to the court half-dimensions', () => {
    const contact = { x: 0, y: 5, z: 8.9 }; // steep angle, would otherwise project far outside the court
    const polygon = computeBlockShadow(contact, edge, 4.5, 9);
    for (const p of polygon) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(4.5 + 1e-9);
      expect(Math.abs(p.z)).toBeLessThanOrEqual(9 + 1e-9);
    }
  });
});

describe('isPointInPolygon', () => {
  const square = [
    { x: -1, y: 0, z: -1 },
    { x: 1, y: 0, z: -1 },
    { x: 1, y: 0, z: 1 },
    { x: -1, y: 0, z: 1 },
  ];

  it('is true for a point inside', () => {
    expect(isPointInPolygon({ x: 0, z: 0 }, square)).toBe(true);
  });

  it('is false for a point outside', () => {
    expect(isPointInPolygon({ x: 5, z: 5 }, square)).toBe(false);
  });
});

describe('checkDefendersInShadow', () => {
  it('flags only the defender standing inside the shadow', () => {
    const contact = { x: 0, y: 3.2, z: 3 };
    const edge: BlockTopEdge = { a: { x: -0.5, y: 2.6, z: 0 }, b: { x: 0.5, y: 2.6, z: 0 } };
    const polygon = computeBlockShadow(contact, edge, 4.5, 9);
    const results = checkDefendersInShadow(polygon, [
      { onCourtId: 'inside', pos: { x: 0, y: 0, z: -1 } },
      { onCourtId: 'outside', pos: { x: 4, y: 0, z: 8 } },
    ]);
    expect(results.find((r) => r.onCourtId === 'inside')?.inShadow).toBe(true);
    expect(results.find((r) => r.onCourtId === 'outside')?.inShadow).toBe(false);
  });
});

describe('checkOpenAngle', () => {
  it('is covered when the defender is within reach of the cone', () => {
    const cone = { id: 'line', apex: { x: 0, y: 3, z: 3 }, edgeA: { x: 2, y: 0, z: 8 }, edgeB: { x: 2, y: 0, z: 9 } };
    const result = checkOpenAngle(cone, { x: 2, y: 0, z: 8.5 }, 1);
    expect(result.covered).toBe(true);
  });

  it('is not covered when the defender is far away', () => {
    const cone = { id: 'line', apex: { x: 0, y: 3, z: 3 }, edgeA: { x: 2, y: 0, z: 8 }, edgeB: { x: 2, y: 0, z: 9 } };
    const result = checkOpenAngle(cone, { x: -4, y: 0, z: 1 }, 1);
    expect(result.covered).toBe(false);
    expect(result.marginM).toBeLessThan(0);
  });
});

describe('computeOpenAngleCones', () => {
  const contact = { x: 0, y: 3.2, z: 3 };
  const edge: BlockTopEdge = { a: { x: -0.5, y: 2.6, z: 0 }, b: { x: 0.5, y: 2.6, z: 0 } };
  const polygon = computeBlockShadow(contact, edge, 4.5, 9); // [nearA, nearB, farB, farA]

  it('returns null when there is no block shadow (no block up)', () => {
    expect(computeOpenAngleCones(contact, [], 4.5, 9)).toBeNull();
  });

  it('anchors both cones at the hitter\'s contact point', () => {
    const cones = computeOpenAngleCones(contact, polygon, 4.5, 9)!;
    expect(cones.left.apex).toEqual(contact);
    expect(cones.right.apex).toEqual(contact);
  });

  it('the left cone runs from the far-negative-x corner to the shadow\'s own near-negative-x edge', () => {
    const cones = computeOpenAngleCones(contact, polygon, 4.5, 9)!;
    expect(cones.left.edgeA.x).toBeCloseTo(-4.5);
    expect(cones.left.edgeB).toEqual(polygon[3]); // farA
  });

  it('the right cone runs from the shadow\'s own near-positive-x edge to the far-positive-x corner', () => {
    const cones = computeOpenAngleCones(contact, polygon, 4.5, 9)!;
    expect(cones.right.edgeA).toEqual(polygon[2]); // farB
    expect(cones.right.edgeB.x).toBeCloseTo(4.5);
  });

  it('the corners sit on the same side of the net as the shadow itself, not the attacker\'s own side', () => {
    const cones = computeOpenAngleCones(contact, polygon, 4.5, 9)!;
    const shadowSign = Math.sign(polygon[3].z || 1);
    expect(Math.sign(cones.left.edgeA.z)).toBe(shadowSign);
    expect(Math.sign(cones.right.edgeB.z)).toBe(shadowSign);
  });
});

describe('tip coverage', () => {
  it('is covered when a defender\'s reach overlaps the tip region', () => {
    const region = computeTipRegion({ x: 0, y: 2.5, z: 3 }, 1.5);
    const result = checkTipCoverage(region, { x: 0, y: 0, z: 4 }, 1.0);
    expect(result.covered).toBe(true);
  });

  it('TIP_UNCOVERED when no defender is close enough', () => {
    const region = computeTipRegion({ x: 0, y: 2.5, z: 3 }, 1.5);
    const result = checkTipCoverage(region, { x: 4, y: 0, z: 8 }, 1.0);
    expect(result.covered).toBe(false);
  });
});
