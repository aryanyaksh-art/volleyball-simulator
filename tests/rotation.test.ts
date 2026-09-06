import { describe, expect, it } from 'vitest';
import { playerSlotInZone, serverSlot, zoneOfSlot } from '@/core/lineup/rotation';
import type { ZoneNumber } from '@/core/court/zones';

const ZONES: ZoneNumber[] = [1, 2, 3, 4, 5, 6];

describe('rotation math', () => {
  it('playerSlotInZone and zoneOfSlot are inverses across all 36 rotation/zone combinations', () => {
    for (let rotation = 0; rotation < 6; rotation++) {
      for (const zone of ZONES) {
        const slot = playerSlotInZone(rotation, zone);
        expect(slot).toBeGreaterThanOrEqual(0);
        expect(slot).toBeLessThan(6);
        expect(zoneOfSlot(rotation, slot)).toBe(zone);
      }
    }
  });

  it('rotation 0 places slot j in zone j+1', () => {
    for (const zone of ZONES) {
      expect(playerSlotInZone(0, zone)).toBe(zone - 1);
    }
  });

  it('a player travels 1 -> 6 -> 5 -> 4 -> 3 -> 2 -> 1 as rotation advances', () => {
    const slotStartingInZone1 = playerSlotInZone(0, 1);
    const expectedSequence: ZoneNumber[] = [1, 6, 5, 4, 3, 2];
    expectedSequence.forEach((expectedZone, rotation) => {
      expect(zoneOfSlot(rotation, slotStartingInZone1)).toBe(expectedZone);
    });
    // and back to zone 1 at rotation 6 (== rotation 0)
    expect(zoneOfSlot(6, slotStartingInZone1)).toBe(1);
  });

  it('serverSlot matches whichever slot sits in zone 1 for every rotation', () => {
    for (let rotation = 0; rotation < 6; rotation++) {
      expect(playerSlotInZone(rotation, 1)).toBe(serverSlot(rotation));
    }
  });
});
