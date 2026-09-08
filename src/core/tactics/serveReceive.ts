import type { LocalPos, Side } from '@/core/court/coordinates';
import { distanceLocal, toWorld } from '@/core/court/coordinates';
import { DEFAULT_COURT_SPEC, type CourtSpec } from '@/core/court/courtSpec';
import { effectivePosition } from '@/core/court/anchors';
import type { ZoneNumber } from '@/core/court/zones';
import type { Vec3 } from '@/core/math/vec';
import { distance3 } from '@/core/math/vec';
import { ballHeightAt } from '@/core/play/ballFlight';
import { REACTION_TIME_S, SPEED_CAP_MPS } from '@/core/play/playerMotion';
import type { LineupBreakdown } from '@/core/lineup/systems';

/** A receiving-team player assigned to pass, with their court position and effective range. */
export interface Passer {
  onCourtId: string;
  pos: LocalPos;
  /** >1 widens this passer's effective range (the libero, or a team's best passer). 1 = normal. */
  weight: number;
}

/**
 * Builds the Passer[] list `analyzeServeReceive` needs from live app state —
 * previously built independently (and identically) in both
 * ServeReceivePanel.tsx and SceneCanvas.tsx's serve-receive effect. `slots`
 * is whichever serve-order slots are checked as passers; a slot with no
 * on-court player yet (a not-fully-seated lineup) is silently skipped
 * rather than producing a broken entry.
 */
export const buildPassers = (
  breakdown: LineupBreakdown,
  overrides: Partial<Record<ZoneNumber, LocalPos>> | undefined,
  passerSlots: number[],
  passerWeights: Record<number, number>,
): Passer[] =>
  passerSlots
    .map((slot) => {
      const p = breakdown.onCourt.find((oc) => oc.slot === slot);
      if (!p || p.zone == null) return null;
      return { onCourtId: p.onCourtId, pos: effectivePosition(p.zone, overrides), weight: passerWeights[slot] ?? 1 };
    })
    .filter((p): p is Passer => p !== null);

/**
 * Speed/apex presets for the two serve types a coach can pick in guided
 * serve-receive planning — a float serve (slower, no spin, a floatier arc)
 * versus a jump (topspin) serve (harder, flatter). Reasonable coaching
 * approximations, not measured data, same spirit as the rest of this
 * module's defaults (serveSpeedMps/serveApexM below).
 */
export const SERVE_PROFILES = {
  float: { speedMps: 12, apexM: 3.2 },
  jump: { speedMps: 19, apexM: 2.6 },
} as const;

export type ServeType = keyof typeof SERVE_PROFILES;

export interface ResponsibilityResult {
  bestId: string;
  bestDistance: number;
  secondId: string | null;
  secondDistance: number | null;
  /** True when the top two passers are close enough that either could reasonably take it. */
  isSeam: boolean;
}

/** Multiplicatively-weighted "distance" — smaller wins. A higher weight shrinks it, extending that passer's practical range. */
const weightedDistance = (a: LocalPos, b: LocalPos, weight: number): number => distanceLocal(a, b) / weight;

/**
 * Nearest passer to `point` by weighted distance — a multiplicatively
 * weighted Voronoi assignment. `seamThresholdM` is the plan's "cells where
 * best and second-best differ by < 0.4m" band: neither passer clearly owns
 * that spot.
 */
export const assignResponsibility = (passers: Passer[], point: LocalPos, seamThresholdM = 0.4): ResponsibilityResult => {
  const scored = passers
    .map((p) => ({ id: p.onCourtId, d: weightedDistance(point, p.pos, p.weight) }))
    .sort((a, b) => a.d - b.d);

  const best = scored[0];
  const second = scored[1] ?? null;
  return {
    bestId: best.id,
    bestDistance: best.d,
    secondId: second?.id ?? null,
    secondDistance: second?.d ?? null,
    isSeam: second != null && second.d - best.d < seamThresholdM,
  };
};

export interface GridBounds {
  latMin: number;
  latMax: number;
  depthMin: number;
  depthMax: number;
}

/** The receiving half plus the free zone behind the endline — where a serve can legally land. */
export const defaultReceivingBounds = (courtSpec: CourtSpec = DEFAULT_COURT_SPEC): GridBounds => ({
  latMin: -courtSpec.widthM / 2,
  latMax: courtSpec.widthM / 2,
  depthMin: 0,
  depthMax: courtSpec.halfLengthM + courtSpec.freeZoneM,
});

export type CoverageSeverity = 'safe' | 'tight' | 'uncovered';

export interface ServeReceiveCell {
  center: LocalPos;
  responsibility: ResponsibilityResult;
  /** Time the serve takes to descend through the playable height, minus the fastest passer's reach time. Null if the serve's apex never reaches that height at all (physically can't happen with sane defaults). */
  marginS: number | null;
  severity: CoverageSeverity;
}

/**
 * Finds the largest u in [0,1] where the ball's height descends through
 * `targetHeightM` — the plan's "honest deadline": the moment the ball
 * passes through a playable contact height, not when it hits the floor.
 * Assumes a normal serve arc (apex above both endpoints); returns null if
 * the arc's apex never reaches that height.
 */
export const solveTimeToHeight = (
  y0: number,
  y1: number,
  apexM: number,
  targetHeightM: number,
  totalDurationS: number,
  apexU = 0.5,
): number | null => {
  if (ballHeightAt(y0, y1, apexM, apexU) < targetHeightM) return null;
  let lo = apexU;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (ballHeightAt(y0, y1, apexM, mid, apexU) > targetHeightM) lo = mid;
    else hi = mid;
  }
  return hi * totalDurationS;
};

const SAFE_MARGIN_S = 0.35;

const classifySeverity = (marginS: number | null): CoverageSeverity => {
  if (marginS == null) return 'safe';
  if (marginS > SAFE_MARGIN_S) return 'safe';
  if (marginS >= 0) return 'tight';
  return 'uncovered';
};

export interface ServeReceiveParams {
  side: Side;
  passers: Passer[];
  serveOriginWorld: Vec3;
  courtSpec?: CourtSpec;
  cellSizeM?: number;
  seamThresholdM?: number;
  serveApexM?: number;
  serveSpeedMps?: number;
  passerSpeedMps?: number;
  contactHeightM?: number;
  playableHeightM?: number;
}

interface ResolvedServeReceiveParams {
  side: Side;
  passers: Passer[];
  serveOriginWorld: Vec3;
  seamThresholdM: number;
  serveApexM: number;
  serveSpeedMps: number;
  passerSpeedMps: number;
  contactHeightM: number;
  playableHeightM: number;
}

/** The per-point computation shared by the whole-grid analysis and a single aimed-serve query: responsibility plus the flight-time-minus-reach-time margin at exactly `center`. */
const evaluateCell = (params: ResolvedServeReceiveParams, center: LocalPos): ServeReceiveCell => {
  const responsibility = assignResponsibility(params.passers, center, params.seamThresholdM);

  const targetWorld = toWorld(center, params.side, 0);
  const distM = distance3(params.serveOriginWorld, targetWorld);
  const totalDurationS = distM / params.serveSpeedMps;
  const flightTimeS = solveTimeToHeight(params.contactHeightM, 0, params.serveApexM, params.playableHeightM, totalDurationS);

  let bestReachS = Infinity;
  for (const p of params.passers) {
    const reach = REACTION_TIME_S + distanceLocal(p.pos, center) / params.passerSpeedMps;
    if (reach < bestReachS) bestReachS = reach;
  }

  const marginS = flightTimeS == null || !Number.isFinite(bestReachS) ? null : flightTimeS - bestReachS;
  return { center, responsibility, marginS, severity: classifySeverity(marginS) };
};

const resolveParams = (params: ServeReceiveParams): ResolvedServeReceiveParams => ({
  side: params.side,
  passers: params.passers,
  serveOriginWorld: params.serveOriginWorld,
  seamThresholdM: params.seamThresholdM ?? 0.4,
  serveApexM: params.serveApexM ?? 3.0,
  serveSpeedMps: params.serveSpeedMps ?? 15,
  passerSpeedMps: params.passerSpeedMps ?? SPEED_CAP_MPS.shuffle,
  contactHeightM: params.contactHeightM ?? 2.2,
  playableHeightM: params.playableHeightM ?? 1.0,
});

/**
 * The responsibility grid plus the uncovered-area time-margin analysis in
 * one pass — the plan calls this the payoff of the whole serve-receive
 * planner: "can we handle a short serve to zone 2 in this rotation" is a
 * margin sign, not a guess. Assumes a single serve speed/apex for every
 * cell (a real serve could vary these — no per-cell profile customization
 * yet, see HANDOFF), so the deep corners of a hard, flat serve will read
 * more generously covered than a real one would be.
 */
export const analyzeServeReceive = (params: ServeReceiveParams): ServeReceiveCell[] => {
  const courtSpec = params.courtSpec ?? DEFAULT_COURT_SPEC;
  const cellSizeM = params.cellSizeM ?? 0.25;
  const resolved = resolveParams(params);

  const bounds = defaultReceivingBounds(courtSpec);
  const cells: ServeReceiveCell[] = [];

  for (let depth = bounds.depthMin + cellSizeM / 2; depth < bounds.depthMax; depth += cellSizeM) {
    for (let lat = bounds.latMin + cellSizeM / 2; lat < bounds.latMax; lat += cellSizeM) {
      cells.push(evaluateCell(resolved, { lat, depth }));
    }
  }

  return cells;
};

/**
 * The same margin analysis as a single point — "this exact aimed serve,"
 * not the whole grid. Used for a coach-placed serve target instead of only
 * an origin zone: the grid answers "how covered is this rotation in
 * general," this answers "is THIS specific serve safe."
 */
export const analyzeSingleServe = (params: ServeReceiveParams & { target: LocalPos }): ServeReceiveCell =>
  evaluateCell(resolveParams(params), params.target);

/** The setter's release point falls in a seam nobody clearly owns — the plan's SETTER_IN_SEAM check. */
export const checkSetterInSeam = (cells: ServeReceiveCell[], setterPos: LocalPos): boolean => {
  let nearest: ServeReceiveCell | null = null;
  let nearestD = Infinity;
  for (const cell of cells) {
    const d = distanceLocal(cell.center, setterPos);
    if (d < nearestD) {
      nearestD = d;
      nearest = cell;
    }
  }
  return nearest?.responsibility.isSeam ?? false;
};

/** Whether the setter can reach their release target in the time available — the plan's LATE_RELEASE check. */
export const checkLateRelease = (
  setterPos: LocalPos,
  releaseTargetPos: LocalPos,
  availableTimeS: number,
  setterSpeedMps: number = SPEED_CAP_MPS.sprint,
): boolean => {
  const travelTimeS = REACTION_TIME_S + distanceLocal(setterPos, releaseTargetPos) / setterSpeedMps;
  return travelTimeS > availableTimeS;
};
