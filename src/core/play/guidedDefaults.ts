import type { BallProfileId, MovementMode } from './types';
import type { PoseId } from './poses';

export type GuidedContactAction = 'serve' | 'pass' | 'set' | 'attack' | 'tip';
export type GuidedPositionAction = 'block' | 'dig' | 'move';
export type GuidedAction = GuidedContactAction | GuidedPositionAction;

export interface GuidedContactDefaults {
  profile: BallProfileId;
  apexM: number;
  apexU?: number;
  ballDurationS: number;
  movementMode: MovementMode;
  movementDurationS: number;
  pose: PoseId;
  jump?: { atT: number; heightM: number; hangS: number };
}

/**
 * Starting-point numbers for each ball-contact action in the guided
 * workflow, seeded from the same values the hand-authored demo plays
 * already use (fixtures/demoPlay.ts, demoPlays.ts) so a guided play looks
 * and times the same as a hand-tuned one. The coach adjusts the arc height
 * via the side-view picker; everything else here is a reasonable default,
 * still editable afterward in Advanced mode.
 */
export const GUIDED_CONTACT_DEFAULTS: Record<GuidedContactAction, GuidedContactDefaults> = {
  // movementDurationS is generous (unlike the other contact actions' short
  // hold-turned-move durations) because a serve now genuinely walks from
  // wherever the server's zone is to behind the endline — up to ~11m for a
  // front-row zone — instead of a near-instant repositioning.
  serve: { profile: 'floatServe', apexM: 3.2, ballDurationS: 1.1, movementMode: 'approach', movementDurationS: 2.2, pose: 'serveContact' },
  pass: { profile: 'pass', apexM: 3.0, ballDurationS: 0.9, movementMode: 'shuffle', movementDurationS: 0.5, pose: 'passLow' },
  set: { profile: 'quick', apexM: 2.7, ballDurationS: 0.75, movementMode: 'sprint', movementDurationS: 0.4, pose: 'set' },
  attack: {
    profile: 'attack',
    apexM: 3.3,
    apexU: 0.15,
    ballDurationS: 0.4,
    movementMode: 'approach',
    movementDurationS: 0.5,
    pose: 'attack',
    jump: { atT: 0.2, heightM: 0.55, hangS: 0.3 },
  },
  tip: { profile: 'tip', apexM: 1.6, ballDurationS: 0.35, movementMode: 'approach', movementDurationS: 0.4, pose: 'attack' },
};

export interface GuidedPositionDefaults {
  movementMode: MovementMode;
  movementDurationS: number;
  pose: PoseId;
}

/** Position-only guided actions: no ball segment, just a pose and (optionally, if the coach also drags them) a movement. */
export const GUIDED_POSITION_DEFAULTS: Record<GuidedPositionAction, GuidedPositionDefaults> = {
  block: { movementMode: 'shuffle', movementDurationS: 0.4, pose: 'block' },
  dig: { movementMode: 'shuffle', movementDurationS: 0.4, pose: 'dig' },
  move: { movementMode: 'run', movementDurationS: 0.5, pose: 'ready' },
};
