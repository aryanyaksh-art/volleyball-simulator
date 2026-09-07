import { describe, expect, it } from 'vitest';
import { DEFENSIVE_SYSTEMS, defensiveBase } from '@/core/tactics/defense.presets';

describe('defensiveBase', () => {
  it('every system returns in-bounds positions for every attack zone', () => {
    for (const system of DEFENSIVE_SYSTEMS) {
      for (const attackZone of [2, 3, 4, 6] as const) {
        const base = defensiveBase(system, attackZone);
        for (const pos of Object.values(base)) {
          expect(Math.abs(pos!.lat)).toBeLessThanOrEqual(4.5);
          expect(pos!.depth).toBeGreaterThanOrEqual(0);
          expect(pos!.depth).toBeLessThanOrEqual(9);
        }
      }
    }
  });

  it('rotation shifts zone 6 toward the attack\'s side', () => {
    const fromZone4 = defensiveBase('rotation', 4);
    const fromZone2 = defensiveBase('rotation', 2);
    expect(fromZone4[6]!.lat).toBeLessThan(fromZone2[6]!.lat);
  });

  it('man-up brings zone 6 up shallower than six-back does', () => {
    const manUp = defensiveBase('man-up', 4);
    const sixBack = defensiveBase('six-back', 4);
    expect(manUp[6]!.depth).toBeLessThan(sixBack[6]!.depth);
  });

  it('six-back is the only system that also repositions the front row', () => {
    expect(defensiveBase('six-back', 4)[3]).toBeDefined();
    expect(defensiveBase('perimeter', 4)[3]).toBeUndefined();
  });
});
