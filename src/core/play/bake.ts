import { toLocal, toWorld, type LocalPos, type Side } from '@/core/court/coordinates';
import type { ZoneNumber } from '@/core/court/zones';
import type { Vec3 } from '@/core/math/vec';
import type { Roster } from '@/core/roster/types';
import type { Lineup } from '@/core/lineup/types';
import { breakdown, type LineupBreakdown } from '@/core/lineup/systems';
import { effectivePosition } from '@/core/court/anchors';
import type { Play, PlayerRef, PositionRef, Movement, PlayStep, BallSegment } from './types';
import { resolvePlayerRef, resolvePositionRef, resolvePositionToWorld, type RefContext, type RefSnapshot } from './refs';

export interface BakeContext {
  rosters: Record<Side, Roster>;
  lineups: Record<Side, Lineup>;
  positions?: Record<Side, Partial<Record<ZoneNumber, LocalPos>>>;
}

const SIDES: Side[] = ['A', 'B'];

/**
 * Resolves every player/movement-target ref in a Play into concrete
 * `{kind:'slot',...}` and `{kind:'local',...}` refs, against the play's own
 * scenario. This is what makes a play editable by direct manipulation: the
 * authoring UI only ever reads/writes slot+local refs, so there's never
 * ambiguity about which existing movement a drag or form edit should
 * update, regardless of whether the play was originally authored with
 * `zoneAnchor`/`atPlayer`/`role` refs. Ball segments are baked the same
 * way, into `{kind:'local', side:'A', pos, y}` — side A is just a fixed
 * canonical frame for expressing a world point as a LocalPos; it doesn't
 * imply the ball "belongs" to side A.
 */
export const bakePlayForEditing = (play: Play, ctx: BakeContext): Play => {
  const positions = ctx.positions ?? { A: {}, B: {} };
  const breakdowns: Record<Side, LineupBreakdown> = {
    A: breakdown(ctx.lineups.A, ctx.rosters.A, 'A', play.scenario.rotations.A),
    B: breakdown(ctx.lineups.B, ctx.rosters.B, 'B', play.scenario.rotations.B),
  };
  const refCtx: RefContext = { breakdowns, rosters: ctx.rosters, positions };

  const bakePlayerRef = (ref: PlayerRef): PlayerRef => {
    if (ref.kind === 'slot') return ref;
    const onCourtId = resolvePlayerRef(ref, refCtx);
    const slot = onCourtId ? Number(onCourtId.split(':')[1]) : 0;
    return { side: ref.side, kind: 'slot', index: slot };
  };

  const bakeLocalRef = (ref: PositionRef, side: Side, snapshot: RefSnapshot): PositionRef => {
    if (ref.kind === 'local' && ref.side === side) return ref;
    const pos = resolvePositionRef(ref, side, refCtx, snapshot);
    return { kind: 'local', side, pos: pos ?? { lat: 0, depth: 0 } };
  };

  const bakeBallRef = (ref: PositionRef, snapshot: RefSnapshot): PositionRef => {
    const world = resolvePositionToWorld(ref, refCtx, snapshot);
    return { kind: 'local', side: 'A', pos: toLocal(world, 'A'), y: world.y };
  };

  const onCourt: { onCourtId: string; side: Side; zone: ZoneNumber | null }[] = [];
  for (const side of SIDES) {
    for (const p of breakdowns[side].onCourt) onCourt.push({ onCourtId: p.onCourtId, side, zone: p.zone });
  }

  const currentPos: Record<string, LocalPos> = {};
  for (const p of onCourt) {
    currentPos[p.onCourtId] = p.zone != null ? effectivePosition(p.zone, positions[p.side]) : { lat: 0, depth: 1.6 };
  }
  for (const init of play.initial.players) {
    const onCourtId = resolvePlayerRef(init.who, refCtx);
    if (onCourtId) currentPos[onCourtId] = init.pos;
  }

  let ballWorldPos: Vec3 = toWorld(play.initial.ball.pos, play.initial.ball.side, play.initial.ball.y ?? 0);

  const bakedSteps: PlayStep[] = play.steps.map((step) => {
    const snapshot: RefSnapshot = { positions: { ...currentPos }, ballWorldPos };

    const bakedMovements: Movement[] = step.movements.map((mv) => {
      const bakedTo = bakeLocalRef(mv.to, mv.who.side, snapshot);
      const onCourtId = resolvePlayerRef(mv.who, refCtx);
      if (onCourtId && bakedTo.kind === 'local') currentPos[onCourtId] = bakedTo.pos;
      return {
        ...mv,
        who: bakePlayerRef(mv.who),
        to: bakedTo,
        via: mv.via?.map((v) => bakeLocalRef(v, mv.who.side, snapshot)),
      };
    });

    let bakedBall: BallSegment | undefined;
    if (step.ball) {
      bakedBall = { ...step.ball, from: bakeBallRef(step.ball.from, snapshot), to: bakeBallRef(step.ball.to, snapshot) };
      ballWorldPos = resolvePositionToWorld(step.ball.to, refCtx, snapshot);
    }

    return { ...step, movements: bakedMovements, ball: bakedBall };
  });

  const bakedInitialPlayers = play.initial.players.map((init) => ({ ...init, who: bakePlayerRef(init.who) }));

  return { ...play, initial: { ...play.initial, players: bakedInitialPlayers }, steps: bakedSteps };
};

/**
 * Where a player is standing just before `stepId` starts, in a play that's
 * already been through bakePlayForEditing (so every movement is a slot ref
 * with a local target). Used to seed a sensible starting point when the
 * editor adds a brand-new movement for a player who wasn't moving yet.
 */
export const positionBeforeStep = (play: Play, ctx: BakeContext, stepId: string, side: Side, slot: number): LocalPos => {
  const positions = ctx.positions ?? { A: {}, B: {} };
  const b = breakdown(ctx.lineups[side], ctx.rosters[side], side, play.scenario.rotations[side]);
  const onCourt = b.onCourt.find((p) => p.slot === slot);
  let pos: LocalPos = onCourt?.zone != null ? effectivePosition(onCourt.zone, positions[side]) : { lat: 0, depth: 1.6 };

  for (const step of play.steps) {
    if (step.id === stepId) break;
    const mv = step.movements.find((m) => m.who.kind === 'slot' && m.who.side === side && m.who.index === slot);
    if (mv && mv.to.kind === 'local') pos = mv.to.pos;
  }
  return pos;
};

/**
 * Where the ball is just before `stepId` starts, in a play that's already
 * been through bakePlayForEditing. Used to seed a sensible starting point
 * when the editor adds a brand-new ball segment to a step that doesn't
 * have one yet. Returned in the same side-A local frame bakePlayForEditing
 * uses for ball refs.
 */
export const ballPositionBeforeStep = (play: Play, stepId: string): { pos: LocalPos; y: number } => {
  let world = toWorld(play.initial.ball.pos, play.initial.ball.side, play.initial.ball.y ?? 0);
  for (const step of play.steps) {
    if (step.id === stepId) break;
    if (step.ball && step.ball.to.kind === 'local') {
      world = toWorld(step.ball.to.pos, step.ball.to.side, step.ball.to.y ?? 0);
    }
  }
  return { pos: toLocal(world, 'A'), y: world.y };
};
