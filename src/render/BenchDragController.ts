import * as THREE from 'three';
import type { Side } from '@/core/court/coordinates';
import { toLocal } from '@/core/court/coordinates';
import { DEFAULT_COURT_SPEC } from '@/core/court/courtSpec';
import type { ZoneNumber } from '@/core/court/zones';
import { ZONE_BASE } from '@/core/court/anchors';

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
  onDrop: (sourceId: string, target: BenchDropTarget) => void;
}

const FLOOR_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

/** Resolves a floor-plane hit to a drop target: the nearest zone anchor if it's within the court, the bench strip if it's past that side's endline, or null (too far from anything sensible) otherwise. */
export function resolveDropTarget(hit: THREE.Vector3): BenchDropTarget {
  const side: Side = hit.z >= 0 ? 'A' : 'B';
  const local = toLocal({ x: hit.x, y: 0, z: hit.z }, side);
  if (local.depth > DEFAULT_COURT_SPEC.halfLengthM) return { kind: 'bench', side };
  if (local.depth < 0) return null;

  let closestZone: ZoneNumber | null = null;
  let closestDist = Infinity;
  for (const [zoneStr, pos] of Object.entries(ZONE_BASE)) {
    const d = Math.hypot(pos.lat - local.lat, pos.depth - local.depth);
    if (d < closestDist) {
      closestDist = d;
      closestZone = Number(zoneStr) as ZoneNumber;
    }
  }
  return closestZone ? { kind: 'zone', side, zone: closestZone } : null;
}

/**
 * Formation-mode-only sibling of PlayerDragController: drags a player (from
 * the bench or the court) and drops them onto a zone or the bench, instead
 * of dragging an already-on-court player to a new movement target within an
 * authored step. Same raycast-to-floor-plane approach, different drop
 * semantics — this one never touches Movement/BallSegment data at all.
 */
export class BenchDragController {
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private draggingId: string | null = null;
  private params: BenchDragControllerParams;

  constructor(params: BenchDragControllerParams) {
    this.params = params;
    params.domElement.addEventListener('pointerdown', this.handlePointerDown);
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

  private handlePointerUp = (e: PointerEvent): void => {
    if (!this.draggingId) return;
    const id = this.draggingId;
    this.draggingId = null;
    this.params.setOrbitEnabled(true);
    this.params.domElement.releasePointerCapture(e.pointerId);

    this.updatePointer(e);
    const hit = this.floorHit();
    this.params.onDrop(id, hit ? resolveDropTarget(hit) : null);
  };

  dispose(): void {
    this.params.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.params.domElement.removeEventListener('pointerup', this.handlePointerUp);
    this.params.domElement.removeEventListener('pointercancel', this.handlePointerUp);
  }
}
