import { describe, expect, it } from 'vitest';
import { benchDepthForOverrides, benchSlotPosition, nearestZone, ZONE_BASE } from '@/core/court/anchors';

describe('ZONE_BASE default anchors', () => {
  it('is overlap-legal by construction: every front-row zone sits closer to the net', () => {
    expect(ZONE_BASE[4].depth).toBeLessThan(ZONE_BASE[5].depth);
    expect(ZONE_BASE[3].depth).toBeLessThan(ZONE_BASE[6].depth);
    expect(ZONE_BASE[2].depth).toBeLessThan(ZONE_BASE[1].depth);
  });

  it('preserves lateral order within each row: 4 < 3 < 2 and 5 < 6 < 1', () => {
    expect(ZONE_BASE[4].lat).toBeLessThan(ZONE_BASE[3].lat);
    expect(ZONE_BASE[3].lat).toBeLessThan(ZONE_BASE[2].lat);
    expect(ZONE_BASE[5].lat).toBeLessThan(ZONE_BASE[6].lat);
    expect(ZONE_BASE[6].lat).toBeLessThan(ZONE_BASE[1].lat);
  });
});

describe('benchSlotPosition', () => {
  it('centers a single bench player on lat 0', () => {
    const pos = benchSlotPosition(0, 1);
    expect(pos.lat).toBeCloseTo(0, 6);
  });

  it('spaces players 1m apart, centered around lat 0', () => {
    const a = benchSlotPosition(0, 3);
    const b = benchSlotPosition(1, 3);
    const c = benchSlotPosition(2, 3);
    expect(b.lat).toBeCloseTo(0, 6);
    expect(a.lat).toBeCloseTo(-1, 6);
    expect(c.lat).toBeCloseTo(1, 6);
  });

  it('sits past the endline, at the given depth', () => {
    const pos = benchSlotPosition(0, 1, 10.5);
    expect(pos.depth).toBe(10.5);
  });

  it('defaults to a depth past the free zone', () => {
    const pos = benchSlotPosition(0, 1);
    expect(pos.depth).toBeGreaterThan(9);
  });
});

describe('nearestZone', () => {
  it('finds the exact anchor when given its own position', () => {
    expect(nearestZone(ZONE_BASE[4])).toBe(4);
    expect(nearestZone(ZONE_BASE[1])).toBe(1);
  });

  it('finds the closest anchor for an in-between position', () => {
    // Between zone 4 (lat -3, depth 1.6) and zone 3 (lat 0, depth 1.6), closer to 4.
    expect(nearestZone({ lat: -2, depth: 1.6 })).toBe(4);
  });
});

describe('benchDepthForOverrides', () => {
  it('keeps the default depth when there are no overrides', () => {
    expect(benchDepthForOverrides(undefined)).toBe(10.5);
    expect(benchDepthForOverrides({})).toBe(10.5);
  });

  it('keeps the default depth when every override sits well inside the default bench row', () => {
    expect(benchDepthForOverrides({ 1: { lat: 3, depth: 6.6 } })).toBe(10.5);
  });

  it('pulls the bench row back when a manual override pushes a zone past it', () => {
    const depth = benchDepthForOverrides({ 1: { lat: 3, depth: 10.2 } });
    expect(depth).toBeGreaterThan(10.5);
    expect(depth).toBe(10.2 + 1.0);
  });

  it('never pulls the row closer than the default', () => {
    expect(benchDepthForOverrides({ 1: { lat: 3, depth: -5 } })).toBe(10.5);
  });
});
