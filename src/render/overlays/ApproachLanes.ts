import * as THREE from 'three';
import type { Vec3 } from '@/core/math/vec';
import type { Theme } from '../theme/Theme';

const MARKER_HEIGHT = 0.05;

/** The hitter's run-up: approach start -> takeoff -> contact point, plus a marker at each end. */
export function buildApproachLaneGroup(points: Vec3[], theme: Theme): THREE.Group {
  const group = new THREE.Group();
  if (points.length < 2) return group;

  const material = new THREE.LineBasicMaterial({ color: theme.overlays.approachLane });
  const raised = points.map((p) => new THREE.Vector3(p.x, p.y + MARKER_HEIGHT, p.z));
  const geometry = new THREE.BufferGeometry().setFromPoints(raised);
  group.add(new THREE.Line(geometry, material));

  const markerMaterial = new THREE.MeshBasicMaterial({ color: theme.overlays.approachLane });
  const markerGeometry = new THREE.SphereGeometry(0.08, 10, 10);
  for (const p of raised) {
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.copy(p);
    group.add(marker);
  }

  return group;
}
