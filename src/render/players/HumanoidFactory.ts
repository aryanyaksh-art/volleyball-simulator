import type { PlayerVisual } from './PlayerVisual';

export interface HumanoidFactory {
  create(color: string): PlayerVisual;
}
