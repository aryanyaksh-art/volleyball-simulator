import type { LocalPos } from '@/core/court/coordinates';
import { REACTION_TIME_S, SPEED_CAP_MPS } from '@/core/play/playerMotion';

export type HitterRole = 'OH' | 'MB' | 'RS' | 'pipe';

/** Which zone the attack originates from — 2, 3, or 4 for a pin/quick attack, 6 for a back-row pipe. */
export type AttackZone = 2 | 3 | 4 | 6;

/** The standard zone-to-role convention this tool assumes: 4 outside, 3 middle, 2 right side/opposite, 6 pipe. */
export const ZONE_TO_ROLE: Record<AttackZone, HitterRole> = { 4: 'OH', 3: 'MB', 2: 'RS', 6: 'pipe' };

/** Approximate contact point by attack zone, team-local: front-row zones contact close to the net, a pipe contacts from depth. */
export const ATTACK_CONTACT_BY_ZONE: Record<AttackZone, LocalPos> = {
  4: { lat: -3.0, depth: 0.5 },
  3: { lat: 0.0, depth: 0.5 },
  2: { lat: 3.0, depth: 0.5 },
  6: { lat: 0.0, depth: 3.0 },
};

export interface ApproachProfile {
  steps: number;
  lengthM: number;
  angleDeg: number;
}

/** Per-role approach geometry from the plan: step count, run-up length, and angle off a straight line back from the net. Pipe runs straight from depth (0 degrees). */
export const APPROACH_PROFILES: Record<HitterRole, ApproachProfile> = {
  OH: { steps: 4, lengthM: 3.2, angleDeg: 35 },
  MB: { steps: 3, lengthM: 2.6, angleDeg: 20 },
  RS: { steps: 4, lengthM: 3.0, angleDeg: 30 },
  pipe: { steps: 3, lengthM: 3.0, angleDeg: 0 },
};

/** Takeoff sits this far behind (further from the net than) the contact point. */
export const TAKEOFF_OFFSET_M = 0.4;
const TAKEOFF_LATERAL_OFFSET_M = 0.15;

export interface ApproachLane {
  role: HitterRole;
  contactPoint: LocalPos;
  takeoff: LocalPos;
  approachStart: LocalPos;
  steps: number;
  angleDeg: number;
  lengthM: number;
}

/**
 * Approach lane geometry for a hitter's swing at `contactPoint`. `lateralSign`
 * (+1 or -1) picks which way the run-up bends away from a straight line back
 * from the net — an OH coming from outside-in bends one way, an RS the
 * other. This is a simplified planning model: a single straight run-up
 * segment at a fixed angle, not real curved footwork — enough for a coach to
 * see the takeoff spot and general angle, not to reproduce exact steps.
 */
export const computeApproachLane = (role: HitterRole, contactPoint: LocalPos, lateralSign: 1 | -1 = 1): ApproachLane => {
  const profile = APPROACH_PROFILES[role];
  const angleRad = (profile.angleDeg * Math.PI) / 180;

  const takeoff: LocalPos = {
    lat: contactPoint.lat + lateralSign * TAKEOFF_LATERAL_OFFSET_M,
    depth: contactPoint.depth + TAKEOFF_OFFSET_M,
  };

  const approachStart: LocalPos = {
    lat: takeoff.lat + lateralSign * profile.lengthM * Math.sin(angleRad),
    depth: takeoff.depth + profile.lengthM * Math.cos(angleRad),
  };

  return { role, contactPoint, takeoff, approachStart, steps: profile.steps, angleDeg: profile.angleDeg, lengthM: profile.lengthM };
};

/** Tempo (seconds from set contact to attack contact) per set call — what a coach thinks in, not distance. Matches the plan's own reference numbers. */
export const SET_TEMPO_S = {
  quick: 0.45,
  '31': 0.75,
  shoot: 0.95,
  go: 1.25,
  high: 1.7,
  pipe: 1.15,
  bic: 0.8,
} as const;

export type SetCall = keyof typeof SET_TEMPO_S;

export type BlockMode = 'shuffle' | 'crossover';

export type BlockScheme = 'spread' | 'bunch-read' | 'bunch-commit' | 'release';

export interface BlockFeasibility {
  requiredTimeS: number;
  availableTimeS: number;
  feasible: boolean;
  mode: BlockMode;
  message: string;
}

/**
 * The core matchup answer: can a blocker starting at `blockerLat` get to
 * `targetLat` before the set arrives? Travel time is reaction time plus
 * lateral distance over the mode's speed cap — shuffle for a short
 * distance, crossover for a longer one, same speed caps player motion
 * already uses everywhere else. Produces the plan's own example shape:
 * "MB cannot reach the pin: needs 1.05s, has 0.62s".
 */
export const computeBlockFeasibility = (
  blockerLat: number,
  targetLat: number,
  setTempoS: number,
  mode: BlockMode = 'shuffle',
): BlockFeasibility => {
  const distanceM = Math.abs(targetLat - blockerLat);
  const speedMps = mode === 'shuffle' ? SPEED_CAP_MPS.shuffle : SPEED_CAP_MPS.crossover;
  const requiredTimeS = REACTION_TIME_S + distanceM / speedMps;
  const feasible = requiredTimeS <= setTempoS;
  const message = feasible
    ? `Blocker can reach in ${requiredTimeS.toFixed(2)}s; ${setTempoS.toFixed(2)}s available.`
    : `Blocker cannot reach: needs ${requiredTimeS.toFixed(2)}s, has ${setTempoS.toFixed(2)}s.`;
  return { requiredTimeS, availableTimeS: setTempoS, feasible, mode, message };
};
