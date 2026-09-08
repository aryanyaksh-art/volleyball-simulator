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
  /** Gates only the drag-to-reposition gesture, not click-to-select/click-to-place. When this returns false a pointer move never starts a drag, so releasing still resolves as a plain click. */
  isDragEnabled: () => boolean;
  setOrbitEnabled: (enabled: boolean) => void;
  /** A player was clicked directly (no real drag in between). */
  onSelectPlayer: (id: string) => void;
  /** Open floor was clicked (no player under the pointer, no drag) — the pending action's target, in world space. */
  onSelectFloor: (worldPos: THREE.Vector3) => void;
  /** Live visual feedback while dragging a player across the floor — no store writes. */
  onDragMove: (id: string, worldPos: THREE.Vector3) => void;
  /** Committed on release, only once the pointer actually moved past the click threshold. */
  onDragEnd: (id: string, worldPos: THREE.Vector3) => void;
}

const FLOOR_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const DRAG_THRESHOLD_PX = 6;

/**
 * Both the guided workflow's click-to-select/click-to-place gesture AND
 * direct player dragging live here, in one controller, rather than as two
 * separate listeners racing on the same element: whether a gesture turns
 * into a click or a drag can only be known at release (or once it crosses
 * the movement threshold), so the same pointerdown/pointerup pair has to
 * arbitrate both, the same way PlayerDragController/BenchDragController each
 * independently do for their own gestures elsewhere.
 */
export class GuidedPlayController {
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private downAt: { x: number; y: number } | null = null;
  private downId: string | null = null;
  private isDragging = false;
  private params: GuidedPlayControllerParams;

  constructor(params: GuidedPlayControllerParams) {
    this.params = params;
    params.domElement.addEventListener('pointerdown', this.handlePointerDown);
    params.domElement.addEventListener('pointermove', this.handlePointerMove);
    params.domElement.addEventListener('pointerup', this.handlePointerUp);
    params.domElement.addEventListener('pointercancel', this.handlePointerUp);
  }

  private updatePointer(clientX: number, clientY: number): void {
    const rect = this.params.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  private floorHit(): THREE.Vector3 | null {
    this.raycaster.setFromCamera(this.pointer, this.params.camera);
    const hit = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(FLOOR_PLANE, hit) ? hit : null;
  }

  private snap(v: THREE.Vector3, free: boolean): THREE.Vector3 {
    if (free) return v;
    return new THREE.Vector3(Math.round(v.x * 10) / 10, 0, Math.round(v.z * 10) / 10);
  }

  private hitPlayer(clientX: number, clientY: number): string | null {
    this.updatePointer(clientX, clientY);
    this.raycaster.setFromCamera(this.pointer, this.params.camera);
    let closest: { id: string; distance: number } | null = null;
    for (const c of this.params.getClickables()) {
      const hits = this.raycaster.intersectObject(c.root, true);
      if (hits.length > 0 && (!closest || hits[0].distance < closest.distance)) {
        closest = { id: c.id, distance: hits[0].distance };
      }
    }
    return closest?.id ?? null;
  }

  private handlePointerDown = (e: PointerEvent): void => {
    if (!this.params.isEnabled()) {
      this.downAt = null;
      this.downId = null;
      return;
    }
    this.downAt = { x: e.clientX, y: e.clientY };
    this.downId = this.hitPlayer(e.clientX, e.clientY);
    this.isDragging = false;
  };

  private handlePointerMove = (e: PointerEvent): void => {
    if (!this.downId || !this.downAt) return;
    if (!this.isDragging) {
      if (!this.params.isDragEnabled()) return;
      const movedPx = Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y);
      if (movedPx <= DRAG_THRESHOLD_PX) return;
      this.isDragging = true;
      this.params.setOrbitEnabled(false);
      this.params.domElement.setPointerCapture(e.pointerId);
    }
    this.updatePointer(e.clientX, e.clientY);
    const hit = this.floorHit();
    if (hit) this.params.onDragMove(this.downId, this.snap(hit, e.shiftKey));
  };

  private handlePointerUp = (e: PointerEvent): void => {
    const downId = this.downId;
    const wasDragging = this.isDragging;
    this.downId = null;
    this.downAt = null;
    this.isDragging = false;

    if (wasDragging) {
      this.params.setOrbitEnabled(true);
      this.params.domElement.releasePointerCapture(e.pointerId);
      if (downId) {
        this.updatePointer(e.clientX, e.clientY);
        const hit = this.floorHit();
        if (hit) this.params.onDragEnd(downId, this.snap(hit, e.shiftKey));
      }
      return;
    }

    if (!this.params.isEnabled()) return;

    if (downId) {
      this.params.onSelectPlayer(downId);
      return;
    }

    this.updatePointer(e.clientX, e.clientY);
    const hit = this.floorHit();
    if (hit) this.params.onSelectFloor(hit);
  };

  dispose(): void {
    this.params.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.params.domElement.removeEventListener('pointermove', this.handlePointerMove);
    this.params.domElement.removeEventListener('pointerup', this.handlePointerUp);
    this.params.domElement.removeEventListener('pointercancel', this.handlePointerUp);
  }
}
