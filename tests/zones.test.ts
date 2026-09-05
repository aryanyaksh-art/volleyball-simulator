import { describe, expect, it } from 'vitest';
import { isFrontRowZone, nextZone, FRONT_ROW_ZONES, BACK_ROW_ZONES, type ZoneNumber } from '@/core/court/zones';

describe('zones', () => {
  it('classifies front row as 4, 3, 2 and back row as 5, 6, 1', () => {
    for (const z of FRONT_ROW_ZONES) expect(isFrontRowZone(z)).toBe(true);
    for (const z of BACK_ROW_ZONES) expect(isFrontRowZone(z)).toBe(false);
  });

  it('rotates in serve order 1 -> 6 -> 5 -> 4 -> 3 -> 2 -> 1', () => {
    let z: ZoneNumber = 1;
    const order: ZoneNumber[] = [z];
    for (let i = 0; i < 5; i++) {
      z = nextZone(z);
      order.push(z);
    }
    expect(order).toEqual([1, 6, 5, 4, 3, 2]);
    expect(nextZone(2)).toBe(1); // closes the loop
  });
});
