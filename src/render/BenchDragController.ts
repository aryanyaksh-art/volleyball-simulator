import * as THREE from 'three';
import type { Side } from '@/core/court/coordinates';
import { toLocal } from '@/core/court/coordinates';
import { DEFAULT_COURT_SPEC } from '@/core/court/courtSpec';
import type { ZoneNumber } from '@/core/court/zones';
import { nearestZone } from '@/core/court/anchors';

export interface BenchDraggableRoot {
  /** `"bench:<side>:<playerId>"` for a bench player, or `"<side>:<zone>"` for an on-court player — the same id scheme formation mode already places players under. */
  id: string;
  root: THREE.Object3D;
}

export type BenchDropTarget = { kind: 'zone'; side: Side; zone: ZoneNumber } | { kind: 'bench'; side: Side } | null;

export interface BenchDragControllerParams {
  domElement: HTMLElement;
  camera: THREE.Camera;
  getDraggables: () => BenchDraggableRoot[];
  isEnabled: () => boolean;
  setOrbitEnabled: (enabled: boolean) => void;
  /** Live visual feedback while dragging — no store writes, just moving the object. */
  onDragMove: (id: string, worldPos: THREE.Vector3) => void;
  /** `worldPos` is the drop point itself (0.1m grid-snapped unless Shift is held) — the caller decides whether that's a zone/bench swap or a free reposition. */
  onDrop: (sourceId: string, target: BenchDropTarget, worldPos: THREE.Vector3 | null) => void;
}

const FLOOR_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

/** Resolves a floor-plane hit to a drop target: the nearest zone anchor if it's within the court, the bench strip if it's past that side's endline, or null (too far from anything sensible) otherwise. */
export function resolveDropTarget(hit: THREE.Vector3): BenchDropTarget {
  const side: Side = hit.z >= 0 ? 'A' : 'B';
  const local = toLocal({ x: hit.x, y: 0, z: hit.z }, side);
  if (local.depth > DEFAULT_COURT_SPEC.halfLengthM) return { kind: 'bench', side };
  if (local.depth < 0) return null;

  return { kind: 'zone', side, zone: nearestZone(local) };
}

/**
 * Formation-mode-only sibling of PlayerDragController: drags a player from
 * the bench or the court across the floor plane, live, and reports the drop
 * point back to the caller instead of writing to a Movement/BallSegment the
 * way PlayerDragController does. `resolveDropTarget` still classifies a drop
 * as a zone or the bench so the caller can offer a swap or a bench transfer,
 * but the raw drop position is also passed through so an on-court player can
 * land anywhere on the floor, not just on one of the 6 zone anchors.
 */
export class BenchDragController {
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private draggingId: string | null = null;
  private params: BenchDragControllerParams;

  constructor(params: BenchDragControllerParams) {
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

    // Stops the browser's own native drag/text-selection gesture from ever
    // starting on a real mouse press over the canvas, which can otherwise
    // interrupt the pointermove/pointerup sequence mid-drag.
    e.preventDefault();
    this.draggingId = closest.id;
    this.params.setOrbitEnabled(false);
    this.params.domElement.setPointerCapture(e.pointerId);
  };

  private handlePointerMove = (e: PointerEvent): void => {
    if (!this.draggingId) return;
    this.updatePointer(e);
    const hit = this.floorHit();
    if (hit) this.params.onDragMove(this.draggingId, this.snap(hit, e.shiftKey));
  };

  private handlePointerUp = (e: PointerEvent): void => {
    if (!this.draggingId) return;
    const id = this.draggingId;
    this.draggingId = null;
    this.params.setOrbitEnabled(true);
    this.params.domElement.releasePointerCapture(e.pointerId);

    this.updatePointer(e);
    const hit = this.floorHit();
    const snapped = hit ? this.snap(hit, e.shiftKey) : null;
    this.params.onDrop(id, snapped ? resolveDropTarget(snapped) : null, snapped);
  };

  dispose(): void {
    this.params.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.params.domElement.removeEventListener('pointermove', this.handlePointerMove);
    this.params.domElement.removeEventListener('pointerup', this.handlePointerUp);
    this.params.domElement.removeEventListener('pointercancel', this.handlePointerUp);
  }
}
