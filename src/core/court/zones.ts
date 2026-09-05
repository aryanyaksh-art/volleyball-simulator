export type ZoneNumber = 1 | 2 | 3 | 4 | 5 | 6;

export const FRONT_ROW_ZONES: readonly ZoneNumber[] = [4, 3, 2];
export const BACK_ROW_ZONES: readonly ZoneNumber[] = [5, 6, 1];

export const isFrontRowZone = (z: ZoneNumber): boolean => z === 2 || z === 3 || z === 4;
export const rowOfZone = (z: ZoneNumber): 'front' | 'back' => (isFrontRowZone(z) ? 'front' : 'back');

/** A player travels 1 -> 6 -> 5 -> 4 -> 3 -> 2 -> 1 as the team rotates. */
export const NEXT_ZONE: Readonly<Record<ZoneNumber, ZoneNumber>> = {
  1: 6,
  6: 5,
  5: 4,
  4: 3,
  3: 2,
  2: 1,
};

export const nextZone = (z: ZoneNumber): ZoneNumber => NEXT_ZONE[z];
