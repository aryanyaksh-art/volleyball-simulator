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
