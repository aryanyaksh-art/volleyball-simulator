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
import { buildCoverageHeatmap } from './overlays/CoverageHeatmap';
import type { ServeReceiveCell } from '@/core/tactics/serveReceive';

export interface PlayerPlacement {
  id: string;
  side: Side;
  pos: Vec3;
  teamColor: string;
  pose: PoseId;
  /** World-space yaw in radians. Defaults to facing the net for the given side. */
  facingRad?: number;
}

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
  private violationGroup: THREE.Group | null = null;
  private coverageMesh: THREE.Mesh | null = null;
  private ball: BallVisual;

  constructor(scene: THREE.Scene, theme: Theme, factory: HumanoidFactory, courtSpec: CourtSpec = DEFAULT_COURT_SPEC) {
    this.scene = scene;
    this.theme = theme;
    this.factory = factory;
    this.courtSpec = courtSpec;
    this.ball = new BallVisual(theme);
    this.scene.add(this.ball.mesh);
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
    this.rebuildStatic();
  }

  setBallState(pos: Vec3, visible: boolean): void {
    this.ball.setState(pos, visible);
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

  /** Live visual feedback while dragging a player — moves the mesh without touching pose/color/facing. */
  setPlayerPosition(id: string, pos: Vec3): void {
    this.players.get(id)?.setPosition(pos);
  }

  setPose(id: string, pose: PoseId): void {
    this.players.get(id)?.setPose(pose);
  }

  /** Advances every player's pose crossfade. Called every render frame, in both formation and play mode. */
  update(dtSeconds: number): void {
    for (const visual of this.players.values()) visual.update(dtSeconds);
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

  dispose(): void {
    for (const visual of this.players.values()) {
      this.scene.remove(visual.root);
      visual.dispose();
    }
    this.players.clear();

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
    this.scene.remove(this.ball.mesh);
    this.ball.dispose();
  }
}
