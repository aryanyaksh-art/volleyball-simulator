import { breakdown, type LineupBreakdown } from '@/core/lineup/systems';
import { checkAlignment, type AlignedPlayer } from '@/core/rules/overlap';
import type { AlignmentReport } from '@/core/rules/validationTypes';
import { effectivePosition } from '@/core/court/anchors';
import type { Roster } from '@/core/roster/types';
import type { Lineup } from '@/core/lineup/types';
import type { LocalPos, Side } from '@/core/court/coordinates';
import type { ZoneNumber } from '@/core/court/zones';

export { effectivePosition };

export interface RotationState {
  breakdown: LineupBreakdown;
  alignment: AlignmentReport;
}

/**
 * The one place that turns a Lineup + Roster + rotation into everything the
 * UI and renderer need: the per-zone breakdown and the overlap legality
 * check. Positions default to the ZONE_BASE anchors, but `overrides` lets a
 * caller displace individual zones (used today by the formation panel to
 * demonstrate an actual illegal alignment; Phase 3's real formation/play
 * editor will feed this the same way instead of ZONE_BASE).
 */
export const deriveRotationState = (
  lineup: Lineup,
  roster: Roster,
  side: Side,
  rotation: number,
  overrides?: Partial<Record<ZoneNumber, LocalPos>>,
): RotationState => {
  const derived = breakdown(lineup, roster, side, rotation);

  const allPlaced = derived.onCourt.length === 6 && derived.onCourt.every((p) => p.zone != null);
  const alignedPlayers: AlignedPlayer[] | null = allPlaced
    ? derived.onCourt.map((p) => ({
        onCourtId: p.onCourtId,
        zone: p.zone!,
        pos: effectivePosition(p.zone!, overrides),
        isServer: p.isServer,
      }))
    : null;

  return {
    breakdown: derived,
    alignment: checkAlignment(side, rotation, alignedPlayers),
  };
};
