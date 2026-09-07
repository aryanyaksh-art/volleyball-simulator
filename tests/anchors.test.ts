import { describe, expect, it } from 'vitest';
import { benchSlotPosition, ZONE_BASE } from '@/core/court/anchors';

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
