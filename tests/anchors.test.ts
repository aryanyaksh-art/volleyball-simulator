import { describe, expect, it } from 'vitest';
import { ZONE_BASE } from '@/core/court/anchors';

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
