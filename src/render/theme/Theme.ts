import type { Side } from '@/core/court/coordinates';

/**
 * Everything the renderer draws reads its colors from a Theme — no color
 * literal should appear anywhere else in src/render. This is what lets the
 * visual style be swapped (or user-authored) without touching any court,
 * player, or overlay geometry code.
 */
export interface Theme {
  id: string;
  label: string;
  background: string;
  grid: {
    visible: boolean;
    color: string;
    opacity: number;
    spacingM: number;
  };
  court: {
    mode: 'lineArt' | 'solidFloor';
    lineColor: string;
    lineWidthM: number;
    floorColor?: string;
    attackZoneColor?: string;
  };
  net: {
    meshColor: string;
    bandColor: string;
    bottomBandColor: string;
    postColor: string;
    opacity: number;
  };
  antenna: {
    colorA: string;
    colorB: string;
    dashed: boolean;
  };
  teams: Record<Side, { body: string; accent: string; label: string }>;
  ball: {
    color: string;
    trailColor: string;
  };
  /** One color, not per-team: a libero should stand out from their own teammates on either side, the way a real libero jersey contrasts with the rest of the team. */
  liberoColor: string;
  /** Dimmed color for players on the bench, in every theme. */
  benchColor: string;
  /** Guided authoring only: a player who already has an action somewhere in the play being built turns this color, so a coach can see who's covered at a glance. */
  guidedDoneColor: string;
  overlays: {
    violation: string;
    responsibility: string[];
    seam: string;
    blockShadow: string;
    approachLane: string;
    openCone: string;
  };
  bloom: {
    enabled: boolean;
    strength: number;
  };
  groundShadow: {
    enabled: boolean;
    opacity: number;
  };
}
