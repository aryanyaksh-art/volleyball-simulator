import * as THREE from 'three';

export interface GuidedClickableRoot {
  /** `side:slot`, the onCourtId scheme play/author mode placements already use. */
  id: string;
  root: THREE.Object3D;
}

export interface GuidedPlayControllerParams {
  domElement: HTMLElement;
  camera: THREE.Camera;
  getClickables: () => GuidedClickableRoot[];
  isEnabled: () => boolean;
  /** A player was clicked directly. */
  onSelectPlayer: (id: string) => void;
  /** Open floor was clicked (no player under the pointer) — the pending action's target, in world space. */
  onSelectFloor: (worldPos: THREE.Vector3) => void;
}

const FLOOR_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

/**
 * Click-only (no drag) selection for the guided workflow: click a player to
 * select them, click open floor to place the pending action's target. A
 * plain click, not a drag, so it doesn't fight OrbitControls the way
 * PlayerDragController/BenchDragController's pointerdown-drag does — those
 * two disable orbiting mid-drag; this one only ever fires on pointerup with
 * no meaningful movement in between, which OrbitControls already treats as
 * "not a drag" and leaves alone.
 */
export class GuidedPlayController {
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private downAt: { x: number; y: number } | null = null;
  private params: GuidedPlayControllerParams;

  constructor(params: GuidedPlayControllerParams) {
    this.params = params;
    params.domElement.addEventListener('pointerdown', this.handlePointerDown);
    params.domElement.addEventListener('pointerup', this.handlePointerUp);
  }

  private updatePointer(clientX: number, clientY: number): void {
    const rect = this.params.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  private handlePointerDown = (e: PointerEvent): void => {
    this.downAt = { x: e.clientX, y: e.clientY };
  };

  private handlePointerUp = (e: PointerEvent): void => {
    if (!this.params.isEnabled() || !this.downAt) {
      this.downAt = null;
      return;
    }
    const movedPx = Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y);
    this.downAt = null;
    if (movedPx > 6) return; // an orbit drag, not a click

    this.updatePointer(e.clientX, e.clientY);
    this.raycaster.setFromCamera(this.pointer, this.params.camera);

    const clickables = this.params.getClickables();
    let closest: { id: string; distance: number } | null = null;
    for (const c of clickables) {
      const hits = this.raycaster.intersectObject(c.root, true);
      if (hits.length > 0 && (!closest || hits[0].distance < closest.distance)) {
        closest = { id: c.id, distance: hits[0].distance };
      }
    }
    if (closest) {
      this.params.onSelectPlayer(closest.id);
      return;
    }

    const hit = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(FLOOR_PLANE, hit)) {
      this.params.onSelectFloor(hit);
    }
  };

  dispose(): void {
    this.params.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.params.domElement.removeEventListener('pointerup', this.handlePointerUp);
  }
}
