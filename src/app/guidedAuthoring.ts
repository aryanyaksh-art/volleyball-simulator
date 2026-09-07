import { toLocal, toWorld, type Side } from '@/core/court/coordinates';
import { DEFAULT_COURT_SPEC } from '@/core/court/courtSpec';
import { effectivePosition } from '@/core/court/anchors';
import { CONTACT_HEIGHT_M } from '@/core/play/refs';
import type { BallSegment, Movement, Play, PlayerRef, PlayStep } from '@/core/play/types';
import { GUIDED_CONTACT_DEFAULTS, GUIDED_POSITION_DEFAULTS, type GuidedContactAction, type GuidedPositionAction } from '@/core/play/guidedDefaults';
import { ROLE_TO_ZONE, ZONE_TO_ROLE, SET_TEMPO_APEX_M, SET_TEMPO_S, type HitterRole, type SetCall } from '@/core/tactics/attack';

const GUIDED_CONTACT_BALL_KINDS: ReadonlySet<string> = new Set<GuidedContactAction>(['serve', 'pass', 'set', 'attack', 'tip']);

/** Where a guided serve places its server: centered, standing in the service zone behind their own endline — never inside the court. */
const SERVE_READY_TARGET: GuidedTarget = { lat: 0, depth: DEFAULT_COURT_SPEC.halfLengthM + DEFAULT_COURT_SPEC.serviceZoneDepthM / 2 };

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

const moveMovement = (
  who: PlayerRef,
  side: Side,
  target: GuidedTarget,
  mode: Movement['mode'],
  pose: Movement['pose'],
  durationS: number,
  jump?: Movement['jump'],
): Movement => ({
  who,
  to: { kind: 'local', side, pos: { lat: target.lat, depth: target.depth }, y: target.y },
  mode,
  pose,
  duration: durationS,
  jump,
});

/**
 * Where the ball the previous step put in play actually lands, expressed in
 * `forSide`'s own local frame — so the next player to touch it can walk
 * there instead of freezing at their starting zone while the ball arrives
 * somewhere else on screen. Handles a 'set' segment's zone-anchor target
 * (an attacker moves to the pin) and a plain local target (everything else,
 * serve included — a serve's landing side differs from the server's own,
 * which toWorld/toLocal's round trip through world space resolves correctly).
 * Returns null when there's nothing incoming yet (the play's first step).
 */
const resolveIncomingArrival = (previousStep: PlayStep | undefined, forSide: Side): GuidedTarget | null => {
  const ball = previousStep?.ball;
  if (!ball) return null;
  const to = ball.to;
  if (to.kind === 'local') {
    const world = toWorld(to.pos, to.side, to.y ?? 0);
    const local = toLocal(world, forSide);
    return { lat: local.lat, depth: local.depth, y: to.y };
  }
  if (to.kind === 'zoneAnchor') {
    const world = toWorld(effectivePosition(to.zone), to.side, to.y ?? 0);
    const local = toLocal(world, forSide);
    return { lat: local.lat, depth: local.depth, y: to.y };
  }
  return null;
};

/** Contact height per guided action, meters — mirrors refs.ts's CONTACT_HEIGHT_M so a position expressed directly in local coordinates (see `buildFrom` below) still looks the same as the `atPlayer` resolution it replaces. */
const CONTACT_HEIGHT_BY_ACTION: Record<GuidedContactAction, number> = {
  serve: CONTACT_HEIGHT_M.hands,
  pass: CONTACT_HEIGHT_M.reach,
  set: CONTACT_HEIGHT_M.hands,
  attack: CONTACT_HEIGHT_M.reach,
  tip: CONTACT_HEIGHT_M.reach,
};

/**
 * Appends a new step for a ball-contact action, closing whatever step was
 * previously open. The acting player's own movement is no longer a
 * self-referencing hold: a serve always starts from behind the endline
 * (never inside the court), and every other contact action walks to wherever
 * the previous step's ball actually lands, so the player visibly meets the
 * ball instead of standing frozen at their starting zone while it arrives
 * somewhere else.
 *
 * The ball's own `from` has to move with them: compile.ts resolves an
 * `atPlayer` ref against the snapshot from the START of this step, before
 * this step's own movement has applied — so if the player is walking
 * somewhere new this step, `atPlayer` would still describe the ball
 * departing from their OLD spot. Once we know where they're walking to, the
 * ball's `from` is given that same explicit local position instead, at the
 * usual contact height for the action. Only when there's nothing to walk to
 * yet (the play's very first step) does either fall back to a plain hold —
 * `atPlayer` is then correct, since the player truly isn't moving.
 */
export const commitContactAction = (play: Play, params: CommitContactParams): Play => {
  const who = onCourtIdToPlayerRef(params.onCourtId);
  const defaults = GUIDED_CONTACT_DEFAULTS[params.action];
  const previousStep = play.steps[play.steps.length - 1];
  const contactHeight = CONTACT_HEIGHT_BY_ACTION[params.action];

  const walkTo = params.action === 'serve' ? SERVE_READY_TARGET : resolveIncomingArrival(previousStep, params.side);

  const movement = walkTo
    ? moveMovement(who, params.side, walkTo, defaults.movementMode, defaults.pose, defaults.movementDurationS, defaults.jump)
    : holdMovement(who, defaults.pose, defaults.movementMode, defaults.movementDurationS, defaults.jump);

  const from: BallSegment['from'] = walkTo
    ? { kind: 'local', side: params.side, pos: { lat: walkTo.lat, depth: walkTo.depth }, y: contactHeight }
    : { kind: 'atPlayer', who, contact: params.action === 'serve' ? 'hands' : 'reach' };

  let ball: BallSegment;

  if (params.action === 'set') {
    if (!params.setTarget) throw new Error('commitContactAction: "set" requires setTarget');
    const zone = ROLE_TO_ZONE[params.setTarget.role];
    const apexM = SET_TEMPO_APEX_M[params.setTarget.tempo];
    ball = {
      kind: 'set',
      profile: params.setTarget.tempo,
      from,
      to: { kind: 'zoneAnchor', side: params.side, zone },
      apexM,
      duration: SET_TEMPO_S[params.setTarget.tempo],
    };
  } else {
    if (!params.target) throw new Error(`commitContactAction: "${params.action}" requires target`);
    const apexM = params.target.apexM ?? defaults.apexM;
    ball = {
      kind: params.action === 'tip' ? 'tip' : params.action,
      profile: defaults.profile,
      from,
      to: { kind: 'local', side: params.side, pos: { lat: params.target.lat, depth: params.target.depth }, y: params.target.y ?? 0 },
      apexM,
      apexU: defaults.apexU,
      duration: defaults.ballDurationS,
    };
  }

  // A step's duration has to cover its longest movement, or that movement's
  // track segment runs past the step boundary compile.ts advances by,
  // overlapping into the next step's own time range. Ball duration and
  // movement duration used to always satisfy this by construction (a hold
  // movement never took longer than its ball's flight); now that a serve or
  // an arrival-chasing contact action can need a multi-second walk, the step
  // has to explicitly stretch to fit it.
  const step: PlayStep = {
    id: crypto.randomUUID(),
    name: params.action[0].toUpperCase() + params.action.slice(1),
    duration: params.stepDurationS ?? Math.max(ball.duration ?? 1, movement.duration ?? 0),
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
  steps[steps.length - 1] = {
    ...last,
    duration: Math.max(last.duration, movement.duration ?? 0),
    movements: [...last.movements, movement],
  };
  return { ...play, steps };
};

/** Every on-court player (`side:slot`) who has at least one movement anywhere in the play — used to color in guided authoring's "already assigned" players. Guided-built movements always reference a slot, never a role/zone/libero ref, so this only ever needs to handle that one PlayerRef kind. */
export const guidedDoneOnCourtIds = (play: Play): Set<string> => {
  const done = new Set<string>();
  for (const step of play.steps) {
    for (const m of step.movements) {
      if (m.who.kind === 'slot') done.add(`${m.who.side}:${m.who.index}`);
    }
  }
  return done;
};

/** Drops one step from the guided Review list entirely (the "minus" case). */
export const removeGuidedStep = (play: Play, stepId: string): Play => ({
  ...play,
  steps: play.steps.filter((s) => s.id !== stepId),
});

/** After re-authoring a step via the guided flow's normal commit path (which always appends), puts the freshly appended step back at the position the one it replaces used to occupy, instead of leaving it at the end. */
export const spliceGuidedStepReplacement = (before: Play, after: Play, replacedStepId: string): Play => {
  const oldIndex = before.steps.findIndex((s) => s.id === replacedStepId);
  const newStep = after.steps[after.steps.length - 1];
  const rest = after.steps.filter((s) => s.id !== replacedStepId && s.id !== newStep.id);
  const insertAt = Math.min(oldIndex === -1 ? rest.length : oldIndex, rest.length);
  const steps = [...rest];
  steps.splice(insertAt, 0, newStep);
  return { ...after, steps };
};

export interface GuidedStepEdit {
  onCourtId: string;
  side: Side;
  action: GuidedContactAction;
  target?: GuidedTarget;
  setTarget?: SetTarget;
}

/**
 * Reverses commitContactAction for the common case (exactly one movement, a
 * ball segment whose kind is one of the five guided contact actions) so
 * "Edit" can reopen a step with its choices pre-filled instead of starting
 * over. Returns null for anything the guided flow itself wouldn't have
 * produced this way — a step with no ball (a bare position action) or one
 * bundling more than one movement (a position action appended onto an
 * existing step) — those are removable but not guided-editable.
 */
export const guidedEditFromStep = (step: PlayStep): GuidedStepEdit | null => {
  if (!step.ball || step.movements.length !== 1) return null;
  if (!GUIDED_CONTACT_BALL_KINDS.has(step.ball.kind)) return null;
  const who = step.movements[0].who;
  if (who.kind !== 'slot') return null;
  const onCourtId = `${who.side}:${who.index}`;
  const action = step.ball.kind as GuidedContactAction;

  if (action === 'set') {
    const to = step.ball.to;
    if (to.kind !== 'zoneAnchor' || !(to.zone in ZONE_TO_ROLE)) return null;
    const role = ZONE_TO_ROLE[to.zone as keyof typeof ZONE_TO_ROLE];
    const tempo = step.ball.profile as SetCall;
    if (!role || !tempo) return null;
    return { onCourtId, side: who.side, action, setTarget: { role, tempo } };
  }

  const to = step.ball.to;
  if (to.kind !== 'local') return null;
  return {
    onCourtId,
    side: who.side,
    action,
    target: { lat: to.pos.lat, depth: to.pos.depth, y: to.y, apexM: step.ball.apexM },
  };
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
