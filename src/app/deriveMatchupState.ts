import { otherSide, toWorld, type LocalPos, type Side } from '@/core/court/coordinates';
import type { ZoneNumber } from '@/core/court/zones';
import { effectivePosition } from '@/core/court/anchors';
import { DEFAULT_COURT_SPEC } from '@/core/court/courtSpec';
import type { Lineup } from '@/core/lineup/types';
import { breakdown } from '@/core/lineup/systems';
import type { Roster } from '@/core/roster/types';
import { findPlayer } from '@/core/roster/types';
import {
  ATTACK_CONTACT_BY_ZONE,
  BLOCK_SCHEME_CONVERGENCE,
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
  checkOpenAngle,
  checkTipCoverage,
  computeBlockShadow,
  computeOpenAngleCones,
  computeTipRegion,
  type OpenAngleCones,
  type ReachCheck,
  type ShadowDefenderCheck,
  type TipRegion,
} from '@/core/tactics/block';
import type { DefensiveSystem } from '@/core/tactics/defense';
import { defensiveBase } from '@/core/tactics/defense.presets';
import type { Vec3 } from '@/core/math/vec';

const ATTACK_CONTACT_HEIGHT_M = 3.1;
const BLOCK_REACH_ABOVE_NET_M = 0.25;
const SINGLE_BLOCKER_WIDTH_M = 0.9;
const DEFENDER_REACH_M = 1.2;

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
  /** The specific attacking-side on-court slot doing the hitting, if the coach picked one — feeds their real standingReachM/approachJumpM into the contact height instead of the flat default. Null uses the zone-only default, same as before this existed. */
  hitterSlot: number | null;
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
  openAngleCones: OpenAngleCones | null;
  /** Best coverage found among every defending-side on-court player for each cone — no separate manual assignment needed, unlike tip coverage (which is deliberately assigned to one specific defender). */
  openAngleCoverage: { left: ReachCheck | null; right: ReachCheck | null } | null;
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
    hitterSlot,
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

  const attackBreakdown = breakdown(lineups[attackingSide], rosters[attackingSide], attackingSide, rotations[attackingSide]);
  const hitterPlayer =
    hitterSlot != null
      ? findPlayer(rosters[attackingSide], attackBreakdown.onCourt.find((p) => p.slot === hitterSlot)?.playerId)
      : undefined;
  const attackContactHeightM =
    hitterPlayer?.standingReachM != null && hitterPlayer?.approachJumpM != null
      ? hitterPlayer.standingReachM + hitterPlayer.approachJumpM
      : ATTACK_CONTACT_HEIGHT_M;
  const contactWorld = toWorld(contactLocal, attackingSide, attackContactHeightM);

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

  const convergence = BLOCK_SCHEME_CONVERGENCE[blockScheme];
  const blockFeasibility: BlockFeasibility[] = [];
  const blockerXs: number[] = [];
  if (blockerCount > 0) {
    const blockZones: ZoneNumber[] = blockerCount === 2 ? [primaryBlockZone, primaryBlockZone === 3 ? 2 : 3] : [primaryBlockZone];
    for (const zone of blockZones) {
      const blockerWorld = positionForZone(zone);
      // blockerXs (below) is where the block ENDS UP if it succeeds — used
      // for the shadow/width geometry. The feasibility check instead needs
      // where the blocker actually STARTS, pre-read, which is what the
      // scheme's convergence factor pulls toward center — the real
      // mechanical difference between spread and a bunch read/commit block.
      blockerXs.push(blockerWorld.x);
      const startX = blockerWorld.x * (1 - convergence);
      const distanceM = Math.abs(contactWorld.x - startX);
      const mode = distanceM > 1.5 ? 'crossover' : 'shuffle';
      blockFeasibility.push(computeBlockFeasibility(startX, contactWorld.x, setTempoS, mode));
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

  const openAngleCones = computeOpenAngleCones(contactWorld, blockShadowPolygon, courtSpec.widthM / 2, courtSpec.lengthM / 2);
  const bestCoverage = (cone: OpenAngleCones['left']): ReachCheck | null => {
    let best: ReachCheck | null = null;
    for (const d of defenders) {
      const check = checkOpenAngle(cone, d.pos, DEFENDER_REACH_M);
      if (!best || check.marginM > best.marginM) best = check;
    }
    return best;
  };
  const openAngleCoverage = openAngleCones
    ? { left: bestCoverage(openAngleCones.left), right: bestCoverage(openAngleCones.right) }
    : null;

  // A tip drops just past the block, on the DEFENDING side of the net near
  // the 3m line — not centered on the hitter's own contact point, which
  // sits on the attacking side.
  const tipTargetWorld = toWorld({ lat: contactLocal.lat, depth: 1.2 }, defendingSide, 0);
  const tipRegion = computeTipRegion(tipTargetWorld);
  const tipDefender = tipDefenderSlot != null ? defenseBreakdown.onCourt.find((p) => p.slot === tipDefenderSlot) : undefined;
  const tipCoverage =
    tipDefender?.zone != null ? checkTipCoverage(tipRegion, positionForZone(tipDefender.zone), DEFENDER_REACH_M) : null;

  return {
    approachLane,
    contactWorld,
    blockFeasibility,
    blockShadowPolygon,
    shadowDefenders,
    tipRegion,
    tipCoverage,
    openAngleCones,
    openAngleCoverage,
  };
};
