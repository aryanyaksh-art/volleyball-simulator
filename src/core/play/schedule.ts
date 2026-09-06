import type { LocalPos, Side } from '@/core/court/coordinates';
import type { Vec3 } from '@/core/math/vec';
import type { EasingId } from '@/core/math/easing';
import type { PoseId } from './poses';
import type { BallSegment, MovementMode } from './types';

/**
 * The two structs that make up the whole core -> render contract: WorldState
 * (per frame, written into by evaluate.ts) and PlaySchedule (per edit,
 * produced by compile.ts). Nothing in render/ ever touches a Play or a
 * PlayStep directly — only these.
 */

export interface WorldPlayerFrame {
  onCourtId: string;
  side: Side;
  pos: LocalPos;
  y: number;
  facingRad: number;
  pose: PoseId;
}

export interface WorldBallFrame {
  worldPos: Vec3;
  visible: boolean;
}

export interface WorldState {
  t: number;
  players: WorldPlayerFrame[];
  ball: WorldBallFrame;
}

export const createWorldState = (): WorldState => ({
  t: 0,
  players: [],
  ball: { worldPos: { x: 0, y: 0, z: 0 }, visible: false },
});

export interface PlayerTrackSegment {
  onCourtId: string;
  side: Side;
  startS: number;
  endS: number;
  from: LocalPos;
  to: LocalPos;
  fromY: number;
  toY: number;
  easing: EasingId;
  pose: PoseId;
  facingFromRad: number;
  facingToRad: number;
  mode: MovementMode;
  jump?: { atT: number; heightM: number; hangS: number };
}

export interface BallTrackSegment {
  startS: number;
  endS: number;
  from: Vec3;
  to: Vec3;
  apexM: number;
  apexU: number;
  kind: BallSegment['kind'];
}

export interface PlaySchedule {
  durationS: number;
  playerTracks: Record<string, PlayerTrackSegment[]>;
  ballTrack: BallTrackSegment[];
  serveContactAtS: number | null;
}
