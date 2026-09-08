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

/** `atPlayer`'s contact kind for each non-serve action — mirrors refs.ts's CONTACT_HEIGHT_M so the reach/hands height matches what the guided defaults were tuned against. */
const CONTACT_KIND_BY_ACTION: Record<Exclude<GuidedContactAction, 'serve'>, 'hands' | 'reach'> = {
  pass: 'reach',
  set: 'hands',
  attack: 'reach',
  tip: 'reach',
};

/**
 * Scales a jump's timing to an actual movement duration instead of the fixed
 * numbers `defaults.jump` was authored with (which assumed the old, always-
 * short hold-movement duration). The peak lands just before the movement
 * ends — contact happens near the top of the jump, just as the player
 * finishes arriving — so an attacker jumps *while the set is still in the
 * air* and hits it at the peak, instead of waiting for the ball to stop
 * moving first. Returns undefined when there's no jump to scale (every
 * guided action except attack).
 */
const scaledJump = (
  jump: { atT: number; heightM: number; hangS: number } | undefined,
  movementDurationS: number,
): Movement['jump'] => {
  if (!jump) return undefined;
  const hangS = Math.min(jump.hangS, Math.max(movementDurationS * 0.6, 0.1));
  const atT = Math.max(hangS / 2, movementDurationS - hangS / 2);
  return { atT, heightM: jump.heightM, hangS };
};

/**
 * Appends a new step for a ball-contact action, closing whatever step was
 * previously open.
 *
 * A serve has nothing to react to — it starts the rally — so it keeps the
 * simple sequential shape: walk to the service line (never inside the
 * court), then serve, both within its own new step, the ball's flight
 * offset to start only once the walk finishes (contact can't happen before
 * the player gets there).
 *
 * Every other contact action reacts to an incoming ball instead: the walk to
 * the arrival spot is injected as an *additional* movement into the
 * PREVIOUS step (the one whose ball is what's incoming), timed to start
 * exactly when that ball is launched and end exactly when it lands —
 * matching the ball's own flight, not a moment before or after. This is
 * what lets several players move at once (e.g. a libero passing while the
 * setter is already moving into position for the set that follows) instead
 * of queuing up one at a time, and it's why a hitter now jumps while the
 * set is still in flight (see `scaledJump`) rather than standing still
 * until it lands. The new step itself then needs no movement of its own for
 * the actor — they already arrived — so its ball starts immediately at
 * `atPlayer`, which compile.ts resolves against this step's start-of-step
 * snapshot: correct precisely because the actor isn't moving THIS step.
 * Falls back to the old self-contained (hold, then contact) shape only when
 * there's nothing incoming yet — the play's very first ball touch.
 */
export const commitContactAction = (play: Play, params: CommitContactParams): Play => {
  const who = onCourtIdToPlayerRef(params.onCourtId);
  const defaults = GUIDED_CONTACT_DEFAULTS[params.action];

  if (params.action === 'serve') {
    const movement = moveMovement(who, params.side, SERVE_READY_TARGET, defaults.movementMode, defaults.pose, defaults.movementDurationS, defaults.jump);
    const from: BallSegment['from'] = {
      kind: 'local',
      side: params.side,
      pos: { lat: SERVE_READY_TARGET.lat, depth: SERVE_READY_TARGET.depth },
      y: CONTACT_HEIGHT_M.hands,
    };
    const contactAtS = movement.duration ?? 0;
    if (!params.target) throw new Error('commitContactAction: "serve" requires target');
    const apexM = params.target.apexM ?? defaults.apexM;
    const ball: BallSegment = {
      kind: 'serve',
      profile: defaults.profile,
      from,
      to: { kind: 'local', side: params.side, pos: { lat: params.target.lat, depth: params.target.depth }, y: params.target.y ?? 0 },
      apexM,
      apexU: defaults.apexU,
      duration: defaults.ballDurationS,
      startOffset: contactAtS,
    };
    const step: PlayStep = {
      id: crypto.randomUUID(),
      name: 'Serve',
      duration: params.stepDurationS ?? contactAtS + (ball.duration ?? 1),
      ball,
      movements: [movement],
    };
    return { ...play, steps: [...play.steps, step] };
  }

  const previousStep = play.steps[play.steps.length - 1];
  const arrival = resolveIncomingArrival(previousStep, params.side);
  const contactKind = CONTACT_KIND_BY_ACTION[params.action];

  let steps = play.steps;
  let ownMovement: Movement | undefined;

  if (arrival && previousStep?.ball) {
    const reactDurationS = previousStep.ball.duration ?? previousStep.duration;
    const approach = moveMovement(
      who,
      params.side,
      arrival,
      defaults.movementMode,
      defaults.pose,
      reactDurationS,
      scaledJump(defaults.jump, reactDurationS),
    );
    approach.startOffset = previousStep.ball.startOffset ?? 0;
    steps = play.steps.map((s, i) => (i === play.steps.length - 1 ? { ...s, movements: [...s.movements, approach] } : s));
  } else {
    // Nothing incoming yet (the play's first ball touch) — no arrival to
    // react to, so this contact stays self-contained: a brief wind-up hold,
    // then contact, both within this one new step.
    ownMovement = holdMovement(who, defaults.pose, defaults.movementMode, defaults.movementDurationS, defaults.jump);
  }

  const from: BallSegment['from'] = { kind: 'atPlayer', who, contact: contactKind };
  const contactAtS = ownMovement?.duration ?? 0;

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
      startOffset: contactAtS,
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
      startOffset: contactAtS,
    };
  }

  const step: PlayStep = {
    id: crypto.randomUUID(),
    name: params.action[0].toUpperCase() + params.action.slice(1),
    duration: params.stepDurationS ?? contactAtS + (ball.duration ?? 1),
    ball,
    movements: ownMovement ? [ownMovement] : [],
  };

  return { ...play, steps: [...steps, step] };
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

const playerRefEquals = (a: PlayerRef, b: PlayerRef): boolean =>
  a.kind === 'slot' && b.kind === 'slot' && a.side === b.side && a.index === b.index;

/**
 * Whoever this step's own ball contact belongs to — from `ball.from` when
 * it's an atPlayer reference (the normal case now: the actor already
 * arrived during the previous step, so they have no movement of their own
 * here), falling back to this step's own FIRST movement for the
 * self-contained shape (a serve, or the play's first-ever ball touch,
 * neither of which resolve `ball.from` via atPlayer). The first movement is
 * reliable, not just the only one: `commitContactAction` always pushes the
 * actor's own movement as `movements[0]` at the moment this step is
 * created, and any later step's reactive approach for what comes NEXT is
 * only ever *appended* after that (see the "concurrent movement" doc
 * comment on `commitContactAction`) — so `movements.length === 1` was
 * actually wrong the instant a reactor got appended (i.e. almost always,
 * since something reacts to nearly every serve), silently hiding a serve
 * step from Edit/description lookups. Not the same as "whoever has a
 * movement in this step" in general — the array may ALSO hold a *different*
 * player's reactive approach for whatever comes next, which is exactly what
 * the length check used to trip over.
 */
const contactActorOf = (step: PlayStep): PlayerRef | null => {
  if (step.ball?.from.kind === 'atPlayer') return step.ball.from.who;
  return step.movements[0]?.who ?? null;
};

/**
 * Drops one step from the guided Review list entirely (the "minus" case).
 * Also strips that step's own contact actor out of the *previous* step's
 * movements, if a reactive approach was injected there for them (see
 * commitContactAction) — otherwise removing a step would leave that player
 * still walking toward a target that no longer has a corresponding action,
 * a harmless but confusing orphan.
 */
export const removeGuidedStep = (play: Play, stepId: string): Play => {
  const index = play.steps.findIndex((s) => s.id === stepId);
  if (index === -1) return play;
  const actor = contactActorOf(play.steps[index]);
  const withoutStep = play.steps.filter((s) => s.id !== stepId);
  if (!actor || index === 0) return { ...play, steps: withoutStep };

  const previousId = play.steps[index - 1].id;
  const steps = withoutStep.map((s) =>
    s.id === previousId ? { ...s, movements: s.movements.filter((m) => !playerRefEquals(m.who, actor)) } : s,
  );
  return { ...play, steps };
};

export interface GuidedStepReplacement {
  action: GuidedContactAction;
  onCourtId: string;
  side: Side;
  target?: GuidedTarget;
  setTarget?: SetTarget;
}

/**
 * Re-authors an existing step in place, not just the play's last one.
 * `removeGuidedStep` already strips the reactive-approach movement the
 * target step injected into its predecessor; this goes further by also
 * truncating everything *after* it, recommitting the edited step fresh
 * (via commitContactAction, against just the untouched prefix — which
 * lands it back at the right index automatically, since commitContactAction
 * always appends to whatever play it's given), then replaying each
 * following step's own choice through the same commit path in order. That
 * replay matters: a later step's "walk to the incoming ball" target
 * (resolveIncomingArrival) depends on the step before it, so if the edited
 * step's ball target changed, everything downstream needs to re-resolve
 * against the new version, not the old one. A tail step whose shape
 * guidedEditFromStep can't describe (a bare position action — block/dig/
 * move) is carried forward unchanged rather than dropped: its own targets
 * may end up very slightly stale relative to the edit above it, the same
 * limitation non-contact steps already had before per-step editing existed
 * at all, but no step is ever silently lost.
 */
export const replaceGuidedStep = (play: Play, stepId: string, replacement: GuidedStepReplacement): Play => {
  const index = play.steps.findIndex((s) => s.id === stepId);
  if (index === -1) return play;

  const withoutStep = removeGuidedStep(play, stepId);
  const tail = withoutStep.steps.slice(index);
  const tailEdits = tail.map((s) => guidedEditFromStep(s));

  let working: Play = { ...withoutStep, steps: withoutStep.steps.slice(0, index) };
  working = commitContactAction(working, {
    action: replacement.action,
    onCourtId: replacement.onCourtId,
    side: replacement.side,
    target: replacement.target,
    setTarget: replacement.setTarget,
  });

  tailEdits.forEach((edit, i) => {
    if (edit) {
      working = commitContactAction(working, {
        action: edit.action,
        onCourtId: edit.onCourtId,
        side: edit.side,
        target: edit.target,
        setTarget: edit.setTarget,
      });
    } else {
      working = { ...working, steps: [...working.steps, tail[i]] };
    }
  });

  return working;
};

export interface GuidedStepEdit {
  onCourtId: string;
  side: Side;
  action: GuidedContactAction;
  target?: GuidedTarget;
  setTarget?: SetTarget;
}

/**
 * Reverses commitContactAction so "Edit" can reopen a step with its choices
 * pre-filled instead of starting over. The acting player comes from
 * `contactActorOf` (usually `ball.from`'s atPlayer reference now, since they
 * no longer have a movement of their own in this same step — see
 * commitContactAction) rather than assuming this step's one-and-only
 * movement belongs to them, since this step's movements array may instead
 * (or additionally) hold a *different* player's reactive approach for
 * whatever comes next. Returns null for anything the guided flow itself
 * wouldn't have produced this way — a step with no ball (a bare position
 * action), an unrecognized ball kind, or one whose actor can't be
 * determined — those are removable but not guided-editable.
 */
export const guidedEditFromStep = (step: PlayStep): GuidedStepEdit | null => {
  if (!step.ball) return null;
  if (!GUIDED_CONTACT_BALL_KINDS.has(step.ball.kind)) return null;
  const who = contactActorOf(step);
  if (!who || who.kind !== 'slot') return null;
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
