import * as THREE from 'three';
import { DEFAULT_COURT_SPEC, type CourtSpec } from '@/core/court/courtSpec';
import type { Side } from '@/core/court/coordinates';
import type { Vec3 } from '@/core/math/vec';
import type { PoseId } from '@/core/play/poses';
import type { Theme } from './theme/Theme';
import type { HumanoidFactory } from './players/HumanoidFactory';
import type { PlayerVisual } from './players/PlayerVisual';
import { buildCourtGroup } from './court/CourtMesh';
import { buildNetGroup } from './court/NetMesh';
import { buildNetPostGroup } from './court/NetPostMesh';
import { buildAntennaGroup } from './court/AntennaMesh';
import { buildGridMesh } from './court/GridMesh';
import { buildViolationOverlayGroup, type ViolationLink } from './overlays/ViolationOverlay';
import { BallVisual } from './ball/BallVisual';
import { BallTrail } from './ball/BallTrail';
import { buildCoverageHeatmap } from './overlays/CoverageHeatmap';
import type { ServeReceiveCell } from '@/core/tactics/serveReceive';
import { buildApproachLaneGroup } from './overlays/ApproachLanes';
import { buildBlockShadowMesh, buildTipRegionRing } from './overlays/BlockShadow';
import { buildOpenAngleConesMesh } from './overlays/OpenAngleCones';
import type { OpenAngleCones } from '@/core/tactics/block';
import { buildDragGhostGroup } from './overlays/DragGhost';

export interface PlayerPlacement {
  id: string;
  side: Side;
  pos: Vec3;
  teamColor: string;
  pose: PoseId;
  /** World-space yaw in radians. Defaults to facing the net for the given side. */
  facingRad?: number;
}

const BENCH_SCALE = 0.75;

function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else mat?.dispose();
  });
}

/**
 * The single coupling point between the domain/UI state and the Three.js
 * scene. Everything here reads a Theme and a plain PlayerPlacement list —
 * nothing three-specific leaks back out. In Phase 3 this gains a method
 * that consumes a per-frame WorldState from core/play/evaluate; the static
 * court-building and player-registry logic here stays the same.
 */
export class SceneBridge {
  private scene: THREE.Scene;
  private factory: HumanoidFactory;
  private theme: Theme;
  private courtSpec: CourtSpec;

  private courtGroup: THREE.Group | null = null;
  private netGroup: THREE.Group | null = null;
  private netPostGroup: THREE.Group | null = null;
  private antennaGroup: THREE.Group | null = null;
  private gridMesh: THREE.Object3D | null = null;

  private players = new Map<string, PlayerVisual>();
  private benchPlayers = new Map<string, PlayerVisual>();
  private violationGroup: THREE.Group | null = null;
  private coverageMesh: THREE.Mesh | null = null;
  private approachLaneGroup: THREE.Group | null = null;
  private blockShadowMesh: THREE.Mesh | null = null;
  private tipRegionMesh: THREE.Mesh | null = null;
  private openAngleMesh: THREE.Mesh | null = null;
  private dragGhostGroup: THREE.Group | null = null;
  private ball: BallVisual;
  private ballTrail: BallTrail;

  constructor(scene: THREE.Scene, theme: Theme, factory: HumanoidFactory, courtSpec: CourtSpec = DEFAULT_COURT_SPEC) {
    this.scene = scene;
    this.theme = theme;
    this.factory = factory;
    this.courtSpec = courtSpec;
    this.ball = new BallVisual(theme);
    this.scene.add(this.ball.mesh);
    this.ballTrail = new BallTrail(theme);
    this.scene.add(this.ballTrail.group);
    this.rebuildStatic();
  }

  private rebuildStatic(): void {
    if (this.courtGroup) {
      this.scene.remove(this.courtGroup);
      disposeObject(this.courtGroup);
    }
    if (this.netGroup) {
      this.scene.remove(this.netGroup);
      disposeObject(this.netGroup);
    }
    if (this.netPostGroup) {
      this.scene.remove(this.netPostGroup);
      disposeObject(this.netPostGroup);
    }
    if (this.antennaGroup) {
      this.scene.remove(this.antennaGroup);
      disposeObject(this.antennaGroup);
    }
    if (this.gridMesh) {
      this.scene.remove(this.gridMesh);
      disposeObject(this.gridMesh);
    }

    this.gridMesh = buildGridMesh(this.courtSpec, this.theme);
    if (this.gridMesh) this.scene.add(this.gridMesh);

    this.courtGroup = buildCourtGroup(this.courtSpec, this.theme);
    this.scene.add(this.courtGroup);

    this.netPostGroup = buildNetPostGroup(this.courtSpec, this.theme);
    this.scene.add(this.netPostGroup);

    this.netGroup = buildNetGroup(this.courtSpec, this.theme);
    this.scene.add(this.netGroup);

    this.antennaGroup = buildAntennaGroup(this.courtSpec, this.theme);
    this.scene.add(this.antennaGroup);

    this.scene.background = new THREE.Color(this.theme.background);
  }

  setTheme(theme: Theme): void {
    this.theme = theme;
    this.ball.setTheme(theme);
    this.ballTrail.setTheme(theme);
    this.rebuildStatic();
  }

  setBallState(pos: Vec3, visible: boolean): void {
    this.ball.setState(pos, visible);
    if (visible) this.ballTrail.push(pos);
    else this.ballTrail.clear();
  }

  /** The ball's own mesh for hit-testing (BallDragController's raycasts), in the same {id, root} shape PlayerDragController's getDraggables already expects — lets the ball reuse that controller directly instead of a near-duplicate class. */
  getBallRoot(): { id: string; root: THREE.Object3D }[] {
    return [{ id: 'ball', root: this.ball.mesh }];
  }

  /** Live visual feedback while dragging the ball — moves the mesh directly, no store write (mirrors setPlayerPosition). */
  setBallPosition(pos: Vec3): void {
    this.ball.mesh.position.set(pos.x, pos.y, pos.z);
  }

  /** Shows (or updates) the drag-ghost marker + dashed path — a movement's original position and a line from there to wherever it's currently being dragged. Rebuilt every call rather than mutated in place; cheap enough for a drag's frame rate and simpler than tracking two separate sub-objects. */
  setDragGhost(originalPos: Vec3, currentPos: Vec3, color: string): void {
    this.clearDragGhost();
    this.dragGhostGroup = buildDragGhostGroup(originalPos, currentPos, color);
    this.scene.add(this.dragGhostGroup);
  }

  clearDragGhost(): void {
    if (this.dragGhostGroup) {
      this.scene.remove(this.dragGhostGroup);
      disposeObject(this.dragGhostGroup);
      this.dragGhostGroup = null;
    }
  }

  /** Drops the ball trail without touching the ball's own visibility — used when playback jumps discontinuously (a loop wrap, a manual scrub) so the trail doesn't draw a streak across the gap. */
  clearBallTrail(): void {
    this.ballTrail.clear();
  }

  setFormation(placements: PlayerPlacement[]): void {
    const seen = new Set<string>();
    for (const p of placements) {
      seen.add(p.id);
      let visual = this.players.get(p.id);
      if (!visual) {
        visual = this.factory.create(p.teamColor);
        this.players.set(p.id, visual);
        this.scene.add(visual.root);
      }
      visual.setPosition(p.pos);
      visual.setFacing(p.facingRad ?? (p.side === 'A' ? Math.PI : 0));
      visual.setPose(p.pose);
      visual.setTeamColor(p.teamColor);
    }
    for (const [id, visual] of this.players) {
      if (!seen.has(id)) {
        this.scene.remove(visual.root);
        visual.dispose();
        this.players.delete(id);
      }
    }
  }

  /** Player roots for hit-testing (e.g. PlayerDragController's raycasts) — not for mutating directly. */
  getPlayerRoots(): { id: string; root: THREE.Object3D }[] {
    return Array.from(this.players.entries()).map(([id, visual]) => ({ id, root: visual.root }));
  }

  /** The on-court bench: dimmed, smaller silhouettes standing past each team's own endline. Same placement shape as setFormation, minus pose/facing nuance — bench players just face their own net. */
  setBench(placements: PlayerPlacement[]): void {
    const seen = new Set<string>();
    for (const p of placements) {
      seen.add(p.id);
      let visual = this.benchPlayers.get(p.id);
      if (!visual) {
        visual = this.factory.create(this.theme.benchColor);
        visual.root.scale.setScalar(BENCH_SCALE);
        this.benchPlayers.set(p.id, visual);
        this.scene.add(visual.root);
      }
      visual.setPosition(p.pos);
      visual.setFacing(p.facingRad ?? (p.side === 'A' ? Math.PI : 0));
      visual.setPose(p.pose);
    }
    for (const [id, visual] of this.benchPlayers) {
      if (!seen.has(id)) {
        this.scene.remove(visual.root);
        visual.dispose();
        this.benchPlayers.delete(id);
      }
    }
  }

  /** Bench roots for hit-testing (BenchDragController's raycasts) — not for mutating directly. */
  getBenchRoots(): { id: string; root: THREE.Object3D }[] {
    return Array.from(this.benchPlayers.entries()).map(([id, visual]) => ({ id, root: visual.root }));
  }

  /** Live visual feedback while dragging a player — moves the mesh without touching pose/color/facing. */
  setPlayerPosition(id: string, pos: Vec3): void {
    this.players.get(id)?.setPosition(pos);
  }

  setPose(id: string, pose: PoseId): void {
    this.players.get(id)?.setPose(pose);
  }

  /**
   * Advances every player's pose crossfade. Called every render frame, in
   * both formation and play mode. Also advances bench players — a real
   * gap until now (they were only ever set to the 'idle' pose, which has
   * zero joint overrides and so exactly matches CapsuleHumanoid's initial
   * currentJoints, making the missing update() call invisible; the moment
   * bench players got a genuinely different pose — 'bench', a sitting
   * approximation — this stopped being a no-op and the omission became a
   * real visible bug: the target pose was set but never actually blended
   * toward, so they stayed standing).
   */
  update(dtSeconds: number): void {
    for (const visual of this.players.values()) visual.update(dtSeconds);
    for (const visual of this.benchPlayers.values()) visual.update(dtSeconds);
  }

  /** Draws a connector + end markers between each pair of players in an overlap violation. */
  setViolationLinks(links: ViolationLink[]): void {
    if (this.violationGroup) {
      this.scene.remove(this.violationGroup);
      disposeObject(this.violationGroup);
      this.violationGroup = null;
    }
    if (links.length === 0) return;
    this.violationGroup = buildViolationOverlayGroup(links, this.theme);
    this.scene.add(this.violationGroup);
  }

  /** The serve-receive uncovered-area heatmap — one merged mesh, colored per cell. Pass null/empty to clear it. */
  setCoverageHeatmap(cells: ServeReceiveCell[], side: Side, cellSizeM: number): void {
    if (this.coverageMesh) {
      this.scene.remove(this.coverageMesh);
      disposeObject(this.coverageMesh);
      this.coverageMesh = null;
    }
    if (cells.length === 0) return;
    this.coverageMesh = buildCoverageHeatmap(cells, side, cellSizeM);
    this.scene.add(this.coverageMesh);
  }

  /** Approach lane line (approach start -> takeoff -> contact). Pass an empty array to clear it. */
  setApproachLane(points: Vec3[]): void {
    if (this.approachLaneGroup) {
      this.scene.remove(this.approachLaneGroup);
      disposeObject(this.approachLaneGroup);
      this.approachLaneGroup = null;
    }
    if (points.length === 0) return;
    this.approachLaneGroup = buildApproachLaneGroup(points, this.theme);
    this.scene.add(this.approachLaneGroup);
  }

  /** The block shadow quadrilateral plus an optional tip-coverage ring. Pass an empty polygon (and null center) to clear both. */
  setMatchupShadow(polygon: Vec3[], tip: { center: Vec3; radiusM: number } | null): void {
    if (this.blockShadowMesh) {
      this.scene.remove(this.blockShadowMesh);
      disposeObject(this.blockShadowMesh);
      this.blockShadowMesh = null;
    }
    if (this.tipRegionMesh) {
      this.scene.remove(this.tipRegionMesh);
      disposeObject(this.tipRegionMesh);
      this.tipRegionMesh = null;
    }
    const mesh = buildBlockShadowMesh(polygon, this.theme);
    if (mesh) {
      this.blockShadowMesh = mesh;
      this.scene.add(mesh);
    }
    if (tip) {
      this.tipRegionMesh = buildTipRegionRing(tip.center, tip.radiusM, this.theme);
      this.scene.add(this.tipRegionMesh);
    }
  }

  /** The two open-angle cones flanking the block shadow. Pass null to clear it. */
  setOpenAngleCones(cones: OpenAngleCones | null): void {
    if (this.openAngleMesh) {
      this.scene.remove(this.openAngleMesh);
      disposeObject(this.openAngleMesh);
      this.openAngleMesh = null;
    }
    const mesh = buildOpenAngleConesMesh(cones, this.theme);
    if (mesh) {
      this.openAngleMesh = mesh;
      this.scene.add(mesh);
    }
  }

  dispose(): void {
    for (const visual of this.players.values()) {
      this.scene.remove(visual.root);
      visual.dispose();
    }
    this.players.clear();

    for (const visual of this.benchPlayers.values()) {
      this.scene.remove(visual.root);
      visual.dispose();
    }
    this.benchPlayers.clear();

    if (this.courtGroup) {
      this.scene.remove(this.courtGroup);
      disposeObject(this.courtGroup);
      this.courtGroup = null;
    }
    if (this.netGroup) {
      this.scene.remove(this.netGroup);
      disposeObject(this.netGroup);
      this.netGroup = null;
    }
    if (this.netPostGroup) {
      this.scene.remove(this.netPostGroup);
      disposeObject(this.netPostGroup);
      this.netPostGroup = null;
    }
    if (this.antennaGroup) {
      this.scene.remove(this.antennaGroup);
      disposeObject(this.antennaGroup);
      this.antennaGroup = null;
    }
    if (this.gridMesh) {
      this.scene.remove(this.gridMesh);
      disposeObject(this.gridMesh);
      this.gridMesh = null;
    }
    if (this.violationGroup) {
      this.scene.remove(this.violationGroup);
      disposeObject(this.violationGroup);
      this.violationGroup = null;
    }
    if (this.coverageMesh) {
      this.scene.remove(this.coverageMesh);
      disposeObject(this.coverageMesh);
      this.coverageMesh = null;
    }
    if (this.approachLaneGroup) {
      this.scene.remove(this.approachLaneGroup);
      disposeObject(this.approachLaneGroup);
      this.approachLaneGroup = null;
    }
    if (this.blockShadowMesh) {
      this.scene.remove(this.blockShadowMesh);
      disposeObject(this.blockShadowMesh);
      this.blockShadowMesh = null;
    }
    if (this.tipRegionMesh) {
      this.scene.remove(this.tipRegionMesh);
      disposeObject(this.tipRegionMesh);
      this.tipRegionMesh = null;
    }
    if (this.openAngleMesh) {
      this.scene.remove(this.openAngleMesh);
      disposeObject(this.openAngleMesh);
      this.openAngleMesh = null;
    }
    this.clearDragGhost();
    this.scene.remove(this.ball.mesh);
    this.ball.dispose();
    this.scene.remove(this.ballTrail.group);
    this.ballTrail.dispose();
  }
}
