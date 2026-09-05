import { describe, expect, it } from 'vitest';
import { toLocal, toWorld, otherSide, type Side } from '@/core/court/coordinates';

describe('coordinates', () => {
  it('round-trips through world space for both sides', () => {
    const local = { lat: 2, depth: 5 };
    for (const side of ['A', 'B'] as Side[]) {
      const world = toWorld(local, side);
      expect(toLocal(world, side)).toEqual(local);
    }
  });

  it('places side A on the positive-z half, facing the net at z=0', () => {
    const world = toWorld({ lat: 0, depth: 5 }, 'A');
    expect(world.z).toBeGreaterThan(0);
  });

  it('places side B on the negative-z half', () => {
    const world = toWorld({ lat: 0, depth: 5 }, 'B');
    expect(world.z).toBeLessThan(0);
  });

  it('mirrors lat sign between sides for the same physical world x', () => {
    // A player standing at world x = 3 is "zone 2 side" (lat > 0) for side A,
    // but "zone 4 side" (lat < 0) for side B, because lat is relative to each
    // team's own perspective facing the net.
    const worldPoint = { x: 3, y: 0, z: 0 };
    expect(toLocal(worldPoint, 'A').lat).toBeGreaterThan(0);
    expect(toLocal(worldPoint, 'B').lat).toBeLessThan(0);
  });

  it('otherSide toggles A/B', () => {
    expect(otherSide('A')).toBe('B');
    expect(otherSide('B')).toBe('A');
  });
});
