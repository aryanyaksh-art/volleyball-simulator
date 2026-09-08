import { otherSide, toWorld, type LocalPos, type Side } from '@/core/court/coordinates';
import type { ZoneNumber } from '@/core/court/zones';
import { effectivePosition } from '@/core/court/anchors';
import { DEFAULT_COURT_SPEC } from '@/core/court/courtSpec';
import type { Lineup } from '@/core/lineup/types';
import { breakdown } from '@/core/lineup/systems';
import type { Roster } from '@/core/roster/types';
import {
  ATTACK_CONTACT_BY_ZONE,
  computeApproachLane,
  computeBlockFeasibility,
  SET_TEMPO_S,
  ZONE_TO_ROLE,
  type AttackZone,
  type ApproachLane,
  type BlockFeasibility,
  type BlockScheme,
  type SetCall,
} from '@/core/tactics/attack';
import {
  checkDefendersInShadow,
  checkTipCoverage,
  computeBlockShadow,
  computeTipRegion,
  type ShadowDefenderCheck,
  type TipRegion,
} from '@/core/tactics/block';
import type { DefensiveSystem } from '@/core/tactics/defense';
import { defensiveBase } from '@/core/tactics/defense.presets';
import type { Vec3 } from '@/core/math/vec';

const ATTACK_CONTACT_HEIGHT_M = 3.1;
const BLOCK_REACH_ABOVE_NET_M = 0.25;
const SINGLE_BLOCKER_WIDTH_M = 0.9;

/** Which blocking-side zone lines up with each attacking zone at the net (their zones mirror: 4<->2, 3<->3, 2<->4; pipe is taken by the middle). */
const ATTACK_ZONE_TO_BLOCK_ZONE: Record<AttackZone, ZoneNumber> = { 4: 2, 3: 3, 2: 4, 6: 3 };
const BLOCKER_COUNT_BY_SCHEME: Record<BlockScheme, number> = { spread: 1, 'bunch-read': 1, 'bunch-commit': 2, release: 0 };

export interface MatchupInputs {
  attackingSide: Side;
  attackZone: AttackZone;
  setCall: SetCall;
  lateralSign: 1 | -1;
  blockScheme: BlockScheme;
  defensiveSystem: DefensiveSystem;
  tipDefenderSlot: number | null;
  rosters: Record<Side, Roster>;
  lineups: Record<Side, Lineup>;
  rotations: Record<Side, number>;
  /** A coach's manual per-zone nudge (FormationPanel) — takes priority over the defensive system's own base position for that zone, matching how every other mode already treats an override as the more specific, more intentional choice. */
  positionOverrides: Record<Side, Partial<Record<ZoneNumber, LocalPos>>>;
}

export interface MatchupState {
  approachLane: ApproachLane;
  contactWorld: Vec3;
  blockFeasibility: BlockFeasibility[];
  blockShadowPolygon: Vec3[];
  shadowDefenders: ShadowDefenderCheck[];
  tipRegion: TipRegion | null;
  tipCoverage: { covered: boolean; marginM: number } | null;
}

/**
 * Everything the matchup panel and scene overlays need for one attack/block
 * scenario: approach geometry for the hitter, whether the assigned block(s)
 * can get there before the set arrives, the resulting block shadow and who
 * (if anyone) is standing in it, and tip coverage for the assigned defender.
 * Mirrors deriveRotationState's role: the one place app state turns into
 * something both the panel and the 3D scene can read directly.
 */
export const deriveMatchupState = (inputs: MatchupInputs): MatchupState => {
  const {
    attackingSide,
    attackZone,
    setCall,
    lateralSign,
    blockScheme,
    defensiveSystem,
    tipDefenderSlot,
    rosters,
    lineups,
    rotations,
    positionOverrides,
  } = inputs;
  const defendingSide = otherSide(attackingSide);
  const courtSpec = DEFAULT_COURT_SPEC;

  const hitterRole = ZONE_TO_ROLE[attackZone];
  const contactLocal = ATTACK_CONTACT_BY_ZONE[attackZone];
  const approachLane = computeApproachLane(hitterRole, contactLocal, lateralSign);
  const contactWorld = toWorld(contactLocal, attackingSide, ATTACK_CONTACT_HEIGHT_M);

  const defenseBreakdown = breakdown(lineups[defendingSide], rosters[defendingSide], defendingSide, rotations[defendingSide]);
  // The chosen defensive system repositions the defending side (see
  // SceneCanvas, which applies the same override to what's actually
  // rendered) — block/tip math has to read the same positions the coach
  // sees on screen, not the plain rotation anchors. A manual FormationPanel
  // override for a given zone wins over the system's own default for that
  // zone: it's the more specific, more intentional choice, same as every
  // other mode already treats it.
  const basePositions: Partial<Record<ZoneNumber, LocalPos>> = {
    ...defensiveBase(defensiveSystem, attackZone),
    ...positionOverrides[defendingSide],
  };
  const positionForZone = (zone: ZoneNumber): Vec3 => toWorld(effectivePosition(zone, basePositions), defendingSide, 0);

  const primaryBlockZone = ATTACK_ZONE_TO_BLOCK_ZONE[attackZone];
  const blockerCount = BLOCKER_COUNT_BY_SCHEME[blockScheme];
  const setTempoS = SET_TEMPO_S[setCall];

  const blockFeasibility: BlockFeasibility[] = [];
  const blockerXs: number[] = [];
  if (blockerCount > 0) {
    const blockZones: ZoneNumber[] = blockerCount === 2 ? [primaryBlockZone, primaryBlockZone === 3 ? 2 : 3] : [primaryBlockZone];
    for (const zone of blockZones) {
      const blockerWorld = positionForZone(zone);
      blockerXs.push(blockerWorld.x);
      const distanceM = Math.abs(contactWorld.x - blockerWorld.x);
      const mode = distanceM > 1.5 ? 'crossover' : 'shuffle';
      blockFeasibility.push(computeBlockFeasibility(blockerWorld.x, contactWorld.x, setTempoS, mode));
    }
  }

  const blockHeightM = courtSpec.netHeightM + BLOCK_REACH_ABOVE_NET_M;
  const blockHalfWidthM = (SINGLE_BLOCKER_WIDTH_M * Math.max(blockerCount, 1)) / 2;
  const blockCenterX = blockerXs.length > 0 ? blockerXs.reduce((a, b) => a + b, 0) / blockerXs.length : contactWorld.x;
  const blockEdge = {
    a: { x: blockCenterX - blockHalfWidthM, y: blockHeightM, z: 0 },
    b: { x: blockCenterX + blockHalfWidthM, y: blockHeightM, z: 0 },
  };

  const blockShadowPolygon =
    blockerCount > 0 ? computeBlockShadow(contactWorld, blockEdge, courtSpec.widthM / 2, courtSpec.lengthM / 2) : [];

  const defenders = defenseBreakdown.onCourt
    .filter((p) => p.zone != null)
    .map((p) => ({ onCourtId: p.onCourtId, pos: positionForZone(p.zone!) }));
  const shadowDefenders = blockShadowPolygon.length > 0 ? checkDefendersInShadow(blockShadowPolygon, defenders) : [];

  // A tip drops just past the block, on the DEFENDING side of the net near
  // the 3m line — not centered on the hitter's own contact point, which
  // sits on the attacking side.
  const tipTargetWorld = toWorld({ lat: contactLocal.lat, depth: 1.2 }, defendingSide, 0);
  const tipRegion = computeTipRegion(tipTargetWorld);
  const tipDefender = tipDefenderSlot != null ? defenseBreakdown.onCourt.find((p) => p.slot === tipDefenderSlot) : undefined;
  const tipCoverage =
    tipDefender?.zone != null ? checkTipCoverage(tipRegion, positionForZone(tipDefender.zone), 1.2) : null;

  return {
    approachLane,
    contactWorld,
    blockFeasibility,
    blockShadowPolygon,
    shadowDefenders,
    tipRegion,
    tipCoverage,
  };
};
