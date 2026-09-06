import type { LocalPos, Side } from '@/core/court/coordinates';
import type { ZoneNumber } from '@/core/court/zones';
import type { EasingId } from '@/core/math/easing';
import type { PlayerRole } from '@/core/roster/types';
import type { PoseId } from './poses';

export type BallProfileId =
  | 'floatServe'
  | 'jumpServe'
  | 'pass'
  | 'dig'
  | 'roll'
  | 'free'
  | 'quick'
  | '31'
  | 'shoot'
  | 'go'
  | 'high'
  | 'pipe'
  | 'bic'
  | 'attack'
  | 'tip'
  | 'block';

export type MovementMode = 'sprint' | 'run' | 'shuffle' | 'backpedal' | 'approach' | 'crossover' | 'hold';

/** Symbolic reference to a player — readable across rotations instead of a fixed onCourtId. */
export type PlayerRef =
  | { side: Side; kind: 'slot'; index: number }
  | { side: Side; kind: 'role'; role: PlayerRole; ordinal?: 1 | 2 }
  | { side: Side; kind: 'zone'; zone: ZoneNumber }
  | { side: Side; kind: 'libero' };

/** Symbolic reference to a court position — resolved against the scenario at compile time. */
export type PositionRef =
  | { kind: 'local'; side: Side; pos: LocalPos; y?: number }
  | { kind: 'zoneAnchor'; side: Side; zone: ZoneNumber; y?: number }
  | { kind: 'atPlayer'; who: PlayerRef; contact?: 'feet' | 'platform' | 'hands' | 'reach' }
  | { kind: 'ballAt'; t: 'segmentEnd' };

export interface Movement {
  who: PlayerRef;
  to: PositionRef;
  via?: PositionRef[];
  startOffset?: number;
  duration?: number;
  easing?: EasingId;
  mode?: MovementMode;
  pose?: PoseId;
  facing?: { atPlayer: PlayerRef } | { rad: number };
  jump?: { atT: number; heightM: number; hangS: number };
}

export interface BallSegment {
  kind: 'serve' | 'pass' | 'set' | 'attack' | 'tip' | 'roll' | 'block' | 'dig' | 'free';
  profile?: BallProfileId;
  from: PositionRef;
  to: PositionRef;
  apexM?: number;
  /** Where in the flight (0-1) the apex falls. Defaults to mid-flight; a spike wants it near contact (~0.15). */
  apexU?: number;
  startOffset?: number;
  duration?: number;
}

export interface PlayStep {
  id: string;
  name: string;
  duration: number;
  ball?: BallSegment;
  movements: Movement[];
}

export interface PlayScenario {
  lineupIds: Record<Side, string>;
  rotations: Record<Side, number>;
}

export interface InitialPlayerState {
  who: PlayerRef;
  pos: LocalPos;
  pose?: PoseId;
  facingRad?: number;
}

export interface InitialFormation {
  players: InitialPlayerState[];
  ball: { side: Side; pos: LocalPos; y?: number; heldBy?: PlayerRef };
}

export interface Play {
  id: string;
  name: string;
  schemaVersion: 1;
  scenario: PlayScenario;
  initial: InitialFormation;
  serveContactStepId?: string;
  steps: PlayStep[];
}
