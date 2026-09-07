import type { Side } from '@/core/court/coordinates';
import type { BallSegment, Movement, Play, PlayerRef, PlayStep } from '@/core/play/types';
import { GUIDED_CONTACT_DEFAULTS, GUIDED_POSITION_DEFAULTS, type GuidedContactAction, type GuidedPositionAction } from '@/core/play/guidedDefaults';
import { ROLE_TO_ZONE, SET_TEMPO_APEX_M, SET_TEMPO_S, type HitterRole, type SetCall } from '@/core/tactics/attack';

export interface GuidedTarget {
  lat: number;
  depth: number;
  y?: number;
  apexM?: number;
}

export interface SetTarget {
  role: HitterRole;
  tempo: SetCall;
}

export interface CommitContactParams {
  action: GuidedContactAction;
  /** `side:slot`, matching author-mode's onCourtId scheme. */
  onCourtId: string;
  side: Side;
  /** Required for every contact action except 'set', which derives its own target from `setTarget`. */
  target?: GuidedTarget;
  setTarget?: SetTarget;
  stepDurationS?: number;
}

export interface CommitPositionParams {
  action: GuidedPositionAction;
  onCourtId: string;
  side: Side;
  target: GuidedTarget;
}

const onCourtIdToPlayerRef = (onCourtId: string): PlayerRef => {
  const [side, slotStr] = onCourtId.split(':') as [Side, string];
  return { side, kind: 'slot', index: Number(slotStr) };
};

const holdMovement = (who: PlayerRef, pose: Movement['pose'], mode: Movement['mode'], durationS: number, jump?: Movement['jump']): Movement => ({
  who,
  to: { kind: 'atPlayer', who, contact: 'feet' },
  mode,
  pose,
  duration: durationS,
  jump,
});

const moveMovement = (who: PlayerRef, side: Side, target: GuidedTarget, mode: Movement['mode'], pose: Movement['pose'], durationS: number): Movement => ({
  who,
  to: { kind: 'local', side, pos: { lat: target.lat, depth: target.depth }, y: target.y },
  mode,
  pose,
  duration: durationS,
});

/** Appends a new step for a ball-contact action, closing whatever step was previously open. */
export const commitContactAction = (play: Play, params: CommitContactParams): Play => {
  const who = onCourtIdToPlayerRef(params.onCourtId);
  const defaults = GUIDED_CONTACT_DEFAULTS[params.action];

  let ball: BallSegment;
  let movement: Movement;

  if (params.action === 'set') {
    if (!params.setTarget) throw new Error('commitContactAction: "set" requires setTarget');
    const zone = ROLE_TO_ZONE[params.setTarget.role];
    const apexM = SET_TEMPO_APEX_M[params.setTarget.tempo];
    ball = {
      kind: 'set',
      profile: params.setTarget.tempo,
      from: { kind: 'atPlayer', who, contact: 'hands' },
      to: { kind: 'zoneAnchor', side: params.side, zone },
      apexM,
      duration: SET_TEMPO_S[params.setTarget.tempo],
    };
    movement = holdMovement(who, defaults.pose, defaults.movementMode, defaults.movementDurationS);
  } else {
    if (!params.target) throw new Error(`commitContactAction: "${params.action}" requires target`);
    const apexM = params.target.apexM ?? defaults.apexM;
    ball = {
      kind: params.action === 'tip' ? 'tip' : params.action,
      profile: defaults.profile,
      from: { kind: 'atPlayer', who, contact: params.action === 'serve' ? 'hands' : 'reach' },
      to: { kind: 'local', side: params.side, pos: { lat: params.target.lat, depth: params.target.depth }, y: params.target.y ?? 0 },
      apexM,
      apexU: defaults.apexU,
      duration: defaults.ballDurationS,
    };
    movement = holdMovement(who, defaults.pose, defaults.movementMode, defaults.movementDurationS, defaults.jump);
  }

  const step: PlayStep = {
    id: crypto.randomUUID(),
    name: params.action[0].toUpperCase() + params.action.slice(1),
    duration: params.stepDurationS ?? ball.duration ?? 1,
    ball,
    movements: [movement],
  };

  return { ...play, steps: [...play.steps, step] };
};

// Note for whoever runs Task 8's manual/browser check (Task 12, Step 7):
// holdMovement's `to: { kind: 'atPlayer', who, contact: 'feet' }` is a
// self-reference — "resolve to wherever this same player already is." This
// relies on compile.ts resolving a step's movements against a snapshot taken
// at STEP START, before any of that step's own movements apply (see
// compile.ts's `snapshot` variable) — so a self-reference doesn't create a
// circular/stale read. This is inferred from reading compile.ts, not proven
// by a test in this plan. If a guided serve/attack/tip contact shows the
// player teleporting or freezing in the wrong pose during Task 12's browser
// check, this is the first place to look.

/** Adds a movement to the currently open (last) step, or starts a fresh no-ball step if none is open yet. "Open" here just means "the last step in the list" — there's no separate closed/open flag on PlayStep itself. */
export const commitPositionAction = (play: Play, params: CommitPositionParams): Play => {
  const who = onCourtIdToPlayerRef(params.onCourtId);
  const defaults = GUIDED_POSITION_DEFAULTS[params.action];
  const movement = moveMovement(who, params.side, params.target, defaults.movementMode, defaults.pose, defaults.movementDurationS);

  if (play.steps.length === 0) {
    const step: PlayStep = {
      id: crypto.randomUUID(),
      name: params.action[0].toUpperCase() + params.action.slice(1),
      duration: defaults.movementDurationS,
      movements: [movement],
    };
    return { ...play, steps: [step] };
  }

  const steps = [...play.steps];
  const last = steps[steps.length - 1];
  steps[steps.length - 1] = { ...last, movements: [...last.movements, movement] };
  return { ...play, steps };
};

const ZONE_NAME: Record<number, string> = { 1: 'zone 1', 2: 'zone 2', 3: 'zone 3', 4: 'zone 4', 5: 'zone 5', 6: 'zone 6' };

/** A step, rendered as one plain-language sentence for the guided workflow's Review list. */
export const describeStep = (step: PlayStep): string => {
  if (!step.ball) return `${step.name}: repositioning only.`;
  const to = step.ball.to;
  const target = to.kind === 'zoneAnchor' ? ZONE_NAME[to.zone] : to.kind === 'local' ? `(${to.pos.lat.toFixed(1)}, ${to.pos.depth.toFixed(1)})` : 'a teammate';
  const verb: Record<BallSegment['kind'], string> = {
    serve: 'serves to',
    pass: 'passes to',
    set: 'sets to',
    attack: 'attacks to',
    tip: 'tips to',
    roll: 'rolls to',
    block: 'blocks at',
    dig: 'digs to',
    free: 'sends the ball to',
  };
  return `${step.name}: ${verb[step.ball.kind]} ${target}.`;
};
