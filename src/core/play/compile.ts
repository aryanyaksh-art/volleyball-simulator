import type { LocalPos, Side } from '@/core/court/coordinates';
import { distanceLocal, toWorld } from '@/core/court/coordinates';
import type { ZoneNumber } from '@/core/court/zones';
import { effectivePosition } from '@/core/court/anchors';
import type { Vec3 } from '@/core/math/vec';
import type { Roster } from '@/core/roster/types';
import type { Lineup } from '@/core/lineup/types';
import { breakdown, type LineupBreakdown } from '@/core/lineup/systems';
import type { PoseId } from './poses';
import type { Play } from './types';
import type { PlaySchedule, PlayerTrackSegment, BallTrackSegment } from './schedule';
import {
  resolveFacingToward,
  resolvePlayerRef,
  resolvePositionRef,
  resolvePositionToWorld,
  type RefContext,
  type RefSnapshot,
} from './refs';

const SIDES: Side[] = ['A', 'B'];
const DEFAULT_APEX_M = 2.5;

export interface CompileContext {
  rosters: Record<Side, Roster>;
  lineups: Record<Side, Lineup>;
  positions?: Record<Side, Partial<Record<ZoneNumber, LocalPos>>>;
}

const defaultFacing = (side: Side): number => (side === 'A' ? Math.PI : 0);

/**
 * Flattens a Play's ordered steps into absolute-time tracks. Playback state
 * is then a pure function of `t` — no dt accumulation, no integration —
 * which is what makes scrubbing and playing through produce identical
 * states (see tests/compile.test.ts).
 */
export const compilePlay = (play: Play, ctx: CompileContext): PlaySchedule => {
  const positions = ctx.positions ?? { A: {}, B: {} };
  const breakdowns: Record<Side, LineupBreakdown> = {
    A: breakdown(ctx.lineups.A, ctx.rosters.A, 'A', play.scenario.rotations.A),
    B: breakdown(ctx.lineups.B, ctx.rosters.B, 'B', play.scenario.rotations.B),
  };
  const refCtx: RefContext = { breakdowns, rosters: ctx.rosters, positions };

  const onCourt: { onCourtId: string; side: Side; zone: ZoneNumber | null }[] = [];
  for (const side of SIDES) {
    for (const p of breakdowns[side].onCourt) onCourt.push({ onCourtId: p.onCourtId, side, zone: p.zone });
  }

  const currentPos: Record<string, LocalPos> = {};
  const currentPose: Record<string, PoseId> = {};
  const currentFacing: Record<string, number> = {};

  for (const p of onCourt) {
    currentPos[p.onCourtId] = p.zone != null ? effectivePosition(p.zone, positions[p.side]) : { lat: 0, depth: 1.6 };
    currentPose[p.onCourtId] = 'ready';
    currentFacing[p.onCourtId] = defaultFacing(p.side);
  }

  for (const init of play.initial.players) {
    const onCourtId = resolvePlayerRef(init.who, refCtx);
    if (!onCourtId) continue;
    currentPos[onCourtId] = init.pos;
    if (init.pose) currentPose[onCourtId] = init.pose;
    if (init.facingRad != null) currentFacing[onCourtId] = init.facingRad;
  }

  let ballWorldPos: Vec3 = toWorld(play.initial.ball.pos, play.initial.ball.side, play.initial.ball.y ?? 0);

  const playerTracks: Record<string, PlayerTrackSegment[]> = {};
  for (const p of onCourt) playerTracks[p.onCourtId] = [];
  const ballTrack: BallTrackSegment[] = [];

  let tCursor = 0;
  let serveContactAtS: number | null = null;

  for (const step of play.steps) {
    const stepStart = tCursor;
    const stepEnd = tCursor + step.duration;
    const snapshot: RefSnapshot = { positions: { ...currentPos }, ballWorldPos };
    const movedThisStep = new Set<string>();

    for (const mv of step.movements) {
      const onCourtId = resolvePlayerRef(mv.who, refCtx);
      if (!onCourtId) continue;
      const toPos = resolvePositionRef(mv.to, mv.who.side, refCtx, snapshot);
      if (!toPos) continue;

      const fromPos = currentPos[onCourtId];
      const segStart = stepStart + (mv.startOffset ?? 0);
      const segDuration = mv.duration ?? step.duration - (mv.startOffset ?? 0);
      const segEnd = segStart + Math.max(segDuration, 0);
      const pose = mv.pose ?? currentPose[onCourtId];
      const facingFrom = currentFacing[onCourtId];
      const facingTo = mv.facing
        ? 'rad' in mv.facing
          ? mv.facing.rad
          : (resolveFacingToward(toWorld(fromPos, mv.who.side, 0), mv.facing.atPlayer, refCtx, snapshot) ?? facingFrom)
        : facingFrom;

      // Waypoints (mv.via) resolve against the same step-start snapshot as
      // `to`, then split the movement's total duration into consecutive
      // straight-line legs — one PlayerTrackSegment per leg — proportional
      // to each leg's share of the total path length, so speed stays
      // roughly uniform without needing a spline. No via = one leg, which
      // is exactly the old single-segment behavior.
      const viaPositions: LocalPos[] = [];
      for (const viaRef of mv.via ?? []) {
        const p = resolvePositionRef(viaRef, mv.who.side, refCtx, snapshot);
        if (p) viaPositions.push(p);
      }
      const waypoints = [fromPos, ...viaPositions, toPos];

      const legDistances = waypoints.slice(1).map((p, i) => distanceLocal(waypoints[i], p));
      const totalDistance = legDistances.reduce((a, b) => a + b, 0);
      const totalDuration = segEnd - segStart;

      let legCursor = segStart;
      for (let i = 0; i < legDistances.length; i++) {
        const isLast = i === legDistances.length - 1;
        const share = totalDistance > 0 ? legDistances[i] / totalDistance : 1 / legDistances.length;
        const legEnd = isLast ? segEnd : legCursor + totalDuration * share;

        playerTracks[onCourtId].push({
          onCourtId,
          side: mv.who.side,
          startS: legCursor,
          endS: legEnd,
          from: waypoints[i],
          to: waypoints[i + 1],
          fromY: 0,
          toY: 0,
          easing: mv.easing ?? 'easeInOutCubic',
          pose,
          facingFromRad: facingFrom,
          facingToRad: isLast ? facingTo : facingFrom,
          mode: mv.mode ?? 'run',
          // A mid-path jump's own timing (atT/hangS) is defined relative to
          // the whole movement, which only maps cleanly onto a single leg —
          // not supported in combination with `via` yet.
          jump: viaPositions.length === 0 ? mv.jump : undefined,
        });

        legCursor = legEnd;
      }

      currentPos[onCourtId] = toPos;
      currentPose[onCourtId] = pose;
      currentFacing[onCourtId] = facingTo;
      movedThisStep.add(onCourtId);
    }

    for (const p of onCourt) {
      if (movedThisStep.has(p.onCourtId)) continue;
      const pos = currentPos[p.onCourtId];
      playerTracks[p.onCourtId].push({
        onCourtId: p.onCourtId,
        side: p.side,
        startS: stepStart,
        endS: stepEnd,
        from: pos,
        to: pos,
        fromY: 0,
        toY: 0,
        easing: 'linear',
        pose: currentPose[p.onCourtId],
        facingFromRad: currentFacing[p.onCourtId],
        facingToRad: currentFacing[p.onCourtId],
        mode: 'hold',
      });
    }

    if (step.ball) {
      const from = resolvePositionToWorld(step.ball.from, refCtx, snapshot);
      const to = resolvePositionToWorld(step.ball.to, refCtx, snapshot);
      const segStart = stepStart + (step.ball.startOffset ?? 0);
      const segDuration = step.ball.duration ?? step.duration - (step.ball.startOffset ?? 0);
      const segEnd = segStart + Math.max(segDuration, 0);

      ballTrack.push({
        startS: segStart,
        endS: segEnd,
        from,
        to,
        apexM: step.ball.apexM ?? DEFAULT_APEX_M,
        apexU: step.ball.apexU ?? 0.5,
        kind: step.ball.kind,
      });

      ballWorldPos = to;
      if (step.id === play.serveContactStepId) serveContactAtS = segStart;
    }

    tCursor = stepEnd;
  }

  return { durationS: tCursor, playerTracks, ballTrack, serveContactAtS };
};
