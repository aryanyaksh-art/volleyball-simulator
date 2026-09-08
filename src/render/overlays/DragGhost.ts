import * as THREE from 'three';
import type { Vec3 } from '@/core/math/vec';

/**
 * A dimmed ring marking a movement's original position, plus a dashed line
 * to wherever it's currently being dragged — visible only while a player
 * drag is in progress. A simple floor marker rather than a full duplicate
 * humanoid: consistent with the rest of this app's overlay language (rings
 * and lines — see BlockShadow's tip ring, ViolationOverlay's connector),
 * cheap to build and tear down every frame of a drag without needing a
 * second HumanoidFactory instance.
 */
export function buildDragGhostGroup(originalPos: Vec3, currentPos: Vec3, color: string): THREE.Group {
  const group = new THREE.Group();

  const ringGeometry = new THREE.RingGeometry(0.28, 0.34, 24);
  ringGeometry.rotateX(-Math.PI / 2);
  const ringMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.position.set(originalPos.x, 0.02, originalPos.z);
  group.add(ring);

  const lineMaterial = new THREE.LineDashedMaterial({ color, dashSize: 0.15, gapSize: 0.1, transparent: true, opacity: 0.6 });
  const lineGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(originalPos.x, 0.02, originalPos.z),
    new THREE.Vector3(currentPos.x, 0.02, currentPos.z),
  ]);
  const line = new THREE.Line(lineGeometry, lineMaterial);
  line.computeLineDistances(); // required for LineDashedMaterial to render dashes at all
  group.add(line);

  return group;
}
