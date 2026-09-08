import * as THREE from 'three';
import type { OpenAngleCones } from '@/core/tactics/block';
import type { Theme } from '../theme/Theme';

/** Two filled triangles (apex + edgeA + edgeB, per cone) flanking the block shadow, in the theme's own open-cone color — same flat-floor-overlay pattern as buildBlockShadowMesh. Pass null to render nothing. */
export function buildOpenAngleConesMesh(cones: OpenAngleCones | null, theme: Theme, opacity = 0.18): THREE.Mesh | null {
  if (!cones) return null;

  const positions: number[] = [];
  for (const cone of [cones.left, cones.right]) {
    for (const p of [cone.apex, cone.edgeA, cone.edgeB]) positions.push(p.x, p.y + 0.01, p.z);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.MeshBasicMaterial({
    color: theme.overlays.openCone,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  return new THREE.Mesh(geometry, material);
}
