import { lerpLocal } from '@/core/court/coordinates';
import { ease, clamp01 } from '@/core/math/easing';
import { ballPositionAt } from './ballFlight';
import { jumpOffsetY } from './playerMotion';
import type { PlaySchedule, PlayerTrackSegment, BallTrackSegment, WorldState } from './schedule';

interface TimedSegment {
  startS: number;
  endS: number;
}

/**
 * The segment covering `t`, clamped to the first segment if `t` precedes
 * everything. If `t` falls in a genuine gap between segments — a ball
 * segment can end before its own step does, now that a step's duration can
 * be stretched to fit a movement longer than the ball's flight — this holds
 * at the most recent segment that already started, not whichever segment
 * happens to be last in the array. Returning `segments[length - 1]`
 * unconditionally (the old behavior) meant a mid-play gap made the ball (or
 * a player) jump to wherever the *final* segment of the whole track put
 * them, before snapping back once the real next segment began: exactly the
 * "lags, teleports away, comes back" bug this was written to fix.
 */
const findActiveSegment = <T extends TimedSegment>(segments: readonly T[], t: number): T | null => {
  if (segments.length === 0) return null;
  let mostRecentlyStarted: T | null = null;
  for (const seg of segments) {
    if (t >= seg.startS && t <= seg.endS) return seg;
    if (seg.startS <= t && (!mostRecentlyStarted || seg.startS > mostRecentlyStarted.startS)) {
      mostRecentlyStarted = seg;
    }
  }
  return mostRecentlyStarted ?? segments[0];
};

const segmentU = (seg: TimedSegment, t: number): number => {
  const span = seg.endS - seg.startS;
  return span <= 0 ? 1 : clamp01((t - seg.startS) / span);
};

/** Shortest-path angle interpolation so a facing lerp never spins the long way around. */
const lerpAngle = (a: number, b: number, u: number): number => {
  const twoPi = Math.PI * 2;
  let diff = ((b - a + Math.PI) % twoPi) - Math.PI;
  if (diff < -Math.PI) diff += twoPi;
  return a + diff * u;
};

const evaluatePlayerSegment = (seg: PlayerTrackSegment, t: number): { pos: ReturnType<typeof lerpLocal>; y: number; facingRad: number } => {
  const u = segmentU(seg, t);
  const eased = ease(seg.easing, u);
  const pos = lerpLocal(seg.from, seg.to, eased);
  const y = seg.jump ? jumpOffsetY(t - seg.startS, seg.jump) : seg.fromY + (seg.toY - seg.fromY) * eased;
  const facingRad = lerpAngle(seg.facingFromRad, seg.facingToRad, u);
  return { pos, y, facingRad };
};

const evaluateBallSegment = (seg: BallTrackSegment, t: number): ReturnType<typeof ballPositionAt> => {
  const u = segmentU(seg, t);
  return ballPositionAt(seg.from, seg.to, seg.apexM, u, seg.apexU);
};

/**
 * Writes the world state at time `t` into `out`, mutating its arrays in
 * place rather than allocating, so the 60 fps playback loop doesn't churn
 * garbage. Pure function of `t` — no dt accumulation, no RNG — so scrubbing
 * to a time and playing through to it produce identical states.
 */
export const evaluateInto = (schedule: PlaySchedule, t: number, out: WorldState): void => {
  out.t = t;

  let cursor = 0;
  for (const onCourtId of Object.keys(schedule.playerTracks)) {
    const segments = schedule.playerTracks[onCourtId];
    const seg = findActiveSegment(segments, t);
    if (!seg) continue;
    const { pos, y, facingRad } = evaluatePlayerSegment(seg, t);

    const existing = out.players[cursor];
    if (existing) {
      existing.onCourtId = onCourtId;
      existing.side = seg.side;
      existing.pos = pos;
      existing.y = y;
      existing.facingRad = facingRad;
      existing.pose = seg.pose;
    } else {
      out.players.push({ onCourtId, side: seg.side, pos, y, facingRad, pose: seg.pose });
    }
    cursor++;
  }
  out.players.length = cursor;

  const ballSeg = findActiveSegment(schedule.ballTrack, t);
  if (ballSeg) {
    out.ball.worldPos = evaluateBallSegment(ballSeg, t);
    out.ball.visible = true;
  } else {
    out.ball.visible = false;
  }
};
