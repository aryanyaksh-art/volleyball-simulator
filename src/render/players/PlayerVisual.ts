import type * as THREE from 'three';
import type { Vec3 } from '@/core/math/vec';
import type { PoseId } from '@/core/play/poses';

/**
 * What the rest of the renderer (SceneBridge) needs from a player's visual
 * representation, independent of how it's actually built. Swapping in a
 * different look later means writing a new HumanoidFactory/PlayerVisual
 * pair — nothing else in render/ or core/ has to change.
 */
export interface PlayerVisual {
  readonly root: THREE.Object3D;
  setPosition(p: Vec3): void;
  setFacing(rad: number): void;
  /** Sets the target pose — the visual crossfades toward it over subsequent update() calls, not instantly. */
  setPose(pose: PoseId): void;
  /** Advances any in-progress pose crossfade by `dtSeconds`. Called every render frame regardless of playback mode. */
  update(dtSeconds: number): void;
  setTeamColor(color: string): void;
  setLabel(number?: number): void;
  dispose(): void;
}
