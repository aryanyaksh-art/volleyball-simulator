import * as THREE from 'three';

export interface DraggableRoot {
  id: string;
  root: THREE.Object3D;
}

export interface PlayerDragControllerParams {
  domElement: HTMLElement;
  camera: THREE.Camera;
  /** Called on every pointerdown to decide the current draggable set — cheap to recompute, called rarely. */
  getDraggables: () => DraggableRoot[];
  /** Gate: dragging only does anything when this returns true (e.g. author mode, not currently playing). */
  isEnabled: () => boolean;
  setOrbitEnabled: (enabled: boolean) => void;
  /** Live visual feedback while dragging — no store writes, just moving the object. */
  onDragMove: (id: string, worldPos: THREE.Vector3) => void;
  /** Committed on release — this is what should actually write into the play. */
  onDragEnd: (id: string, worldPos: THREE.Vector3) => void;
}

const FLOOR_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

/**
 * Raycasts pointer events against a set of draggable player roots and, on a
 * hit, drags them across the floor plane instead of letting OrbitControls
 * orbit the camera. This is the primary authoring gesture from the plan:
 * grab a player, drop them somewhere, done — no coordinate-entry form
 * required, though StepInspector's number fields still work as the
 * precise/accessible alternative.
 */
export class PlayerDragController {
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private draggingId: string | null = null;
  private params: PlayerDragControllerParams;

  constructor(params: PlayerDragControllerParams) {
    this.params = params;
    params.domElement.addEventListener('pointerdown', this.handlePointerDown);
    params.domElement.addEventListener('pointermove', this.handlePointerMove);
    params.domElement.addEventListener('pointerup', this.handlePointerUp);
    params.domElement.addEventListener('pointercancel', this.handlePointerUp);
  }

  private updatePointer(e: PointerEvent): void {
    const rect = this.params.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
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

  private handlePointerDown = (e: PointerEvent): void => {
    if (!this.params.isEnabled()) return;
    this.updatePointer(e);
    this.raycaster.setFromCamera(this.pointer, this.params.camera);

    const draggables = this.params.getDraggables();
    let closest: { id: string; distance: number } | null = null;
    for (const d of draggables) {
      const hits = this.raycaster.intersectObject(d.root, true);
      if (hits.length > 0 && (!closest || hits[0].distance < closest.distance)) {
        closest = { id: d.id, distance: hits[0].distance };
      }
    }
    if (!closest) return;

    this.draggingId = closest.id;
    this.params.setOrbitEnabled(false);
    this.params.domElement.setPointerCapture(e.pointerId);
  };

  private handlePointerMove = (e: PointerEvent): void => {
    if (!this.draggingId) return;
    this.updatePointer(e);
    const hit = this.floorHit();
    if (!hit) return;
    this.params.onDragMove(this.draggingId, this.snap(hit, e.shiftKey));
  };

  private handlePointerUp = (e: PointerEvent): void => {
    if (!this.draggingId) return;
    const id = this.draggingId;
    this.draggingId = null;
    this.params.setOrbitEnabled(true);
    this.params.domElement.releasePointerCapture(e.pointerId);

    this.updatePointer(e);
    const hit = this.floorHit();
    if (hit) this.params.onDragEnd(id, this.snap(hit, e.shiftKey));
  };

  dispose(): void {
    this.params.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.params.domElement.removeEventListener('pointermove', this.handlePointerMove);
    this.params.domElement.removeEventListener('pointerup', this.handlePointerUp);
    this.params.domElement.removeEventListener('pointercancel', this.handlePointerUp);
  }
}
