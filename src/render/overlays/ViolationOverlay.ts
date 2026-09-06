import * as THREE from 'three';
import type { Vec3 } from '@/core/math/vec';
import type { Theme } from '../theme/Theme';

export interface ViolationLink {
  id: string;
  a: Vec3;
  b: Vec3;
}

const MARKER_HEIGHT = 0.05;

/** A connector line plus end markers between each pair of offending players, colored via the theme. */
export function buildViolationOverlayGroup(links: ViolationLink[], theme: Theme): THREE.Group {
  const group = new THREE.Group();
  const lineMaterial = new THREE.LineBasicMaterial({ color: theme.overlays.violation });
  const markerMaterial = new THREE.MeshBasicMaterial({ color: theme.overlays.violation });
  const markerGeometry = new THREE.SphereGeometry(0.09, 10, 10);

  for (const link of links) {
    const a = new THREE.Vector3(link.a.x, link.a.y + MARKER_HEIGHT, link.a.z);
    const b = new THREE.Vector3(link.b.x, link.b.y + MARKER_HEIGHT, link.b.z);

    const lineGeometry = new THREE.BufferGeometry().setFromPoints([a, b]);
    group.add(new THREE.Line(lineGeometry, lineMaterial));

    const markerA = new THREE.Mesh(markerGeometry, markerMaterial);
    markerA.position.copy(a);
    const markerB = new THREE.Mesh(markerGeometry, markerMaterial);
    markerB.position.copy(b);
    group.add(markerA, markerB);
  }

  return group;
}
