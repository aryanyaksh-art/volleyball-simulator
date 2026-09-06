import type { ZoneNumber } from '@/core/court/zones';

export const ROTATION_COUNT = 6;

/**
 * A player travels 1 -> 6 -> 5 -> 4 -> 3 -> 2 -> 1 as the team rotates.
 * `slot` is the serve-order index (0-5), fixed for a lineup; `rotation`
 * (0-5) is how many times the team has rotated since the base state
 * where slot j sits in zone j+1.
 */
export const playerSlotInZone = (rotation: number, zone: ZoneNumber): number =>
  (rotation + zone - 1) % 6;

export const zoneOfSlot = (rotation: number, slot: number): ZoneNumber =>
  (((((slot - rotation) % 6) + 6) % 6) + 1) as ZoneNumber;

/** Whichever slot currently occupies zone 1 is the server for that rotation. */
export const serverSlot = (rotation: number): number => ((rotation % 6) + 6) % 6;
