import type { LocalPos } from '@/core/court/coordinates';
import type { ZoneNumber } from '@/core/court/zones';
export type { AttackZone } from './attack';

export type DefensiveSystem = 'perimeter' | 'rotation' | 'man-up' | 'six-back';

export interface DefensivePosition {
  zone: ZoneNumber;
  pos: LocalPos;
}
