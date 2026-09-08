import type { LocalPos } from '@/core/court/coordinates';
import { distanceLocal } from '@/core/court/coordinates';
import type { MovementMode, PlayStep } from './types';

/** Speed caps per mode, in meters/second. */
export const SPEED_CAP_MPS: Record<Exclude<MovementMode, 'hold'>, number> = {
  sprint: 6.5,
  run: 4.8,
  approach: 5.5,
  crossover: 4.2,
  shuffle: 2.8,
  backpedal: 2.6,
};

export const REACTION_TIME_S = 0.22;

/** Straight-line path length through waypoints, in meters. */
export const pathLength = (from: LocalPos, via: LocalPos[], to: LocalPos): number => {
  const points = [from, ...via, to];
  let length = 0;
  for (let i = 1; i < points.length; i++) length += distanceLocal(points[i - 1], points[i]);
  return length;
};

export interface SpeedCapDiagnostic {
  code: 'SPEED_CAP_EXCEEDED';
  severity: 'error';
  onCourtId: string;
  /** The step this violation's segment came from — lets a "fix it" UI apply suggestedDurationS to the right step directly, without the caller having to re-derive which step produced this segment. */
  stepId: string;
  requiredMps: number;
  capMps: number;
  message: string;
  /** The step duration that would bring this back under the cap. */
  suggestedDurationS: number;
}

/**
 * The highest-value diagnostic in player motion: if a move's average speed
 * exceeds its mode's cap, the play is physically impossible. Stops coaches
 * from designing plays no human could execute.
 */
export const checkSpeedCap = (
  onCourtId: string,
  stepId: string,
  mode: Exclude<MovementMode, 'hold'>,
  distanceM: number,
  durationS: number,
): SpeedCapDiagnostic | null => {
  if (durationS <= 0) return null;
  const requiredMps = distanceM / durationS;
  const capMps = SPEED_CAP_MPS[mode];
  if (requiredMps <= capMps) return null;

  const suggestedDurationS = Math.ceil((distanceM / capMps) * 100) / 100;
  return {
    code: 'SPEED_CAP_EXCEEDED',
    severity: 'error',
    onCourtId,
    stepId,
    requiredMps,
    capMps,
    suggestedDurationS,
    message: `${onCourtId} must cover ${distanceM.toFixed(1)} m in ${durationS.toFixed(2)} s (${requiredMps.toFixed(1)} m/s); ${mode} cap is ${capMps} m/s.`,
  };
};

/**
 * The shortest a step's own `duration` can be without cutting off its ball
 * segment's flight or a movement inside it — the same invariant
 * commitContactAction already maintains for guided-built steps (a step
 * stretches to cover its own ball's `startOffset + duration`), surfaced here
 * so the Advanced editor's manual duration field can't be shrunk below it
 * either. Only segments with an EXPLICIT duration impose a floor: a
 * movement with no `duration` of its own is elastic by design (compile.ts
 * resolves it to "however long is left in the step"), so it can never be
 * the thing constraining the step — shrinking the step just shrinks that
 * movement along with it.
 */
export const minStepDuration = (step: PlayStep): number => {
  let min = 0;
  if (step.ball?.duration != null) {
    const end = (step.ball.startOffset ?? 0) + step.ball.duration;
    if (end > min) min = end;
  }
  for (const mv of step.movements) {
    if (mv.duration == null) continue;
    const end = (mv.startOffset ?? 0) + mv.duration;
    if (end > min) min = end;
  }
  return min;
};

/** Vertical offset for a jump, zero outside its [atT - hangS/2, atT + hangS/2] window within the segment. */
export const jumpOffsetY = (
  segmentElapsedS: number,
  jump: { atT: number; heightM: number; hangS: number },
): number => {
  const start = jump.atT - jump.hangS / 2;
  const end = jump.atT + jump.hangS / 2;
  if (segmentElapsedS < start || segmentElapsedS > end || end <= start) return 0;
  const u = (segmentElapsedS - start) / (end - start);
  return 4 * jump.heightM * u * (1 - u);
};
