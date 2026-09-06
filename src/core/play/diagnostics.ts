import { distanceLocal } from '@/core/court/coordinates';
import { DEFAULT_COURT_SPEC, type CourtSpec } from '@/core/court/courtSpec';
import { checkBallFlight, type BallFlightDiagnostic } from './ballFlight';
import { checkSpeedCap, type SpeedCapDiagnostic } from './playerMotion';
import type { MovementMode } from './types';
import type { PlaySchedule } from './schedule';

/** Ball contacts that can end a rally outright — the only ones a landing-out check applies to. */
const TERMINAL_BALL_KINDS = new Set(['serve', 'attack', 'tip', 'roll']);

export interface BallFlightIssue extends BallFlightDiagnostic {
  atS: number;
  kind: string;
}

export interface PlayDiagnostics {
  speedCapViolations: SpeedCapDiagnostic[];
  ballFlightIssues: BallFlightIssue[];
}

export const hasErrors = (diagnostics: PlayDiagnostics): boolean =>
  diagnostics.speedCapViolations.length > 0 || diagnostics.ballFlightIssues.some((i) => i.severity === 'error');

/**
 * Walks a compiled schedule and surfaces the two diagnostics the plan calls
 * out as the highest-value checks in the whole tool: a move no human could
 * physically make in the time given, and a ball that would clip the net,
 * cross outside the antenna, or land out. Both are pure post-compile
 * analysis — they don't change what gets rendered, only what a coach is
 * warned about.
 */
export const diagnosePlay = (schedule: PlaySchedule, courtSpec: CourtSpec = DEFAULT_COURT_SPEC): PlayDiagnostics => {
  const speedCapViolations: SpeedCapDiagnostic[] = [];

  for (const onCourtId of Object.keys(schedule.playerTracks)) {
    for (const seg of schedule.playerTracks[onCourtId]) {
      if (seg.mode === 'hold') continue;
      const distanceM = distanceLocal(seg.from, seg.to);
      const durationS = seg.endS - seg.startS;
      const diagnostic = checkSpeedCap(onCourtId, seg.mode as Exclude<MovementMode, 'hold'>, distanceM, durationS);
      if (diagnostic) speedCapViolations.push(diagnostic);
    }
  }

  const ballFlightIssues: BallFlightIssue[] = [];
  for (const seg of schedule.ballTrack) {
    const diagnostics = checkBallFlight({
      from: seg.from,
      to: seg.to,
      apexM: seg.apexM,
      apexU: seg.apexU,
      netHeightM: courtSpec.netHeightM,
      antennaHalfSpanM: courtSpec.antennaSpanM / 2,
      courtHalfWidthM: courtSpec.widthM / 2,
      courtHalfLengthM: courtSpec.lengthM / 2,
      checkLanding: TERMINAL_BALL_KINDS.has(seg.kind),
    });
    for (const d of diagnostics) ballFlightIssues.push({ ...d, atS: seg.startS, kind: seg.kind });
  }

  return { speedCapViolations, ballFlightIssues };
};
