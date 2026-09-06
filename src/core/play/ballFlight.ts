import type { Vec3 } from '@/core/math/vec';
import { clamp01 } from '@/core/math/easing';

/**
 * Deterministic parabola, closed form. Horizontal lerps from->to; vertical
 * pins an exact apex height at the midpoint (or at apexU if given, for a
 * spike's peak near contact rather than mid-flight). Endpoints exact, apex
 * exact, one multiply-add per frame.
 */
export const ballHeightAt = (y0: number, y1: number, apexM: number, u: number, apexU = 0.5): number => {
  const uc = clamp01(u);
  // Solve for the height formula's asymmetric peak at apexU instead of always 0.5:
  // treat it as two joined parabolic halves that meet at (apexU, apexM).
  if (apexU <= 0 || apexU >= 1 || Math.abs(apexU - 0.5) < 1e-9) {
    const k = 4 * apexM - 2 * (y0 + y1);
    return y0 + (y1 - y0) * uc + k * uc * (1 - uc);
  }
  if (uc <= apexU) {
    // Quadratic ease-up from y0 to apexM over [0, apexU], exact at both ends.
    const uu = uc / apexU;
    return y0 + (apexM - y0) * (2 * uu - uu * uu);
  }
  // Quadratic ease-down from apexM to y1 over [apexU, 1], exact at both ends.
  const uu = (uc - apexU) / (1 - apexU);
  return apexM - (apexM - y1) * (2 * uu - uu * uu);
};

export const ballPositionAt = (from: Vec3, to: Vec3, apexM: number, u: number, apexU = 0.5): Vec3 => {
  const uc = clamp01(u);
  return {
    x: from.x + (to.x - from.x) * uc,
    y: ballHeightAt(from.y, to.y, apexM, uc, apexU),
    z: from.z + (to.z - from.z) * uc,
  };
};

/** Where the ball's horizontal path crosses the net plane (world z = 0), or null if it never does. */
export const solveNetCrossingU = (from: Vec3, to: Vec3): number | null => {
  if (from.z === to.z) return null;
  const u = -from.z / (to.z - from.z);
  return u >= 0 && u <= 1 ? u : null;
};

export type BallFlightDiagnosticCode = 'BALL_INTO_NET' | 'BALL_OUTSIDE_ANTENNA' | 'BALL_OUT';

export interface BallFlightDiagnostic {
  code: BallFlightDiagnosticCode;
  severity: 'error' | 'warning';
  message: string;
}

export interface BallFlightCheckParams {
  from: Vec3;
  to: Vec3;
  apexM: number;
  apexU?: number;
  netHeightM: number;
  antennaHalfSpanM: number;
  courtHalfWidthM: number;
  courtHalfLengthM: number;
  /** Only serve/attack/tip/roll segments are checked for landing out — a defensive dig sailing out isn't a fault. */
  checkLanding: boolean;
}

/**
 * Flight diagnostics — where the tool earns trust. Net clearance and
 * antenna crossing are checked wherever the ball's path crosses the net
 * plane; landing out of bounds is a warning, not an error, since a serve
 * aimed at a passer's shoulder can legitimately land out.
 */
export const checkBallFlight = (params: BallFlightCheckParams): BallFlightDiagnostic[] => {
  const { from, to, apexM, apexU = 0.5, netHeightM, antennaHalfSpanM, courtHalfWidthM, courtHalfLengthM, checkLanding } = params;
  const diagnostics: BallFlightDiagnostic[] = [];

  const netU = solveNetCrossingU(from, to);
  if (netU != null) {
    const heightAtNet = ballHeightAt(from.y, to.y, apexM, netU, apexU);
    if (heightAtNet < netHeightM) {
      const shortfallCm = Math.round((netHeightM - heightAtNet) * 100);
      diagnostics.push({
        code: 'BALL_INTO_NET',
        severity: 'error',
        message: `Ball crosses the net ${shortfallCm} cm below net height.`,
      });
    }

    const xAtNet = from.x + (to.x - from.x) * netU;
    if (Math.abs(xAtNet) > antennaHalfSpanM) {
      diagnostics.push({
        code: 'BALL_OUTSIDE_ANTENNA',
        severity: 'error',
        message: `Ball crosses the net ${(Math.abs(xAtNet) - antennaHalfSpanM).toFixed(2)} m outside the antenna.`,
      });
    }
  }

  if (checkLanding && Math.abs(to.y) < 1e-6) {
    const outOfBounds = Math.abs(to.x) > courtHalfWidthM || Math.abs(to.z) > courtHalfLengthM;
    if (outOfBounds) {
      diagnostics.push({
        code: 'BALL_OUT',
        severity: 'warning',
        message: 'Ball lands outside the court.',
      });
    }
  }

  return diagnostics;
};
