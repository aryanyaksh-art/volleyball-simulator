import * as THREE from 'three';
import type { Vec3 } from '@/core/math/vec';
import type { Theme } from '../theme/Theme';

/** The block shadow quadrilateral, flat on the floor, in the theme's shadow color. Pass an empty polygon to render nothing. */
export function buildBlockShadowMesh(polygon: Vec3[], theme: Theme, opacity = 0.35): THREE.Mesh | null {
  if (polygon.length < 3) return null;

  const positions: number[] = [];
  // Triangle fan from polygon[0] — correct for the convex quadrilateral computeBlockShadow produces.
  for (let i = 1; i < polygon.length - 1; i++) {
    for (const p of [polygon[0], polygon[i], polygon[i + 1]]) positions.push(p.x, p.y + 0.015, p.z);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.MeshBasicMaterial({
    color: theme.overlays.blockShadow,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  return new THREE.Mesh(geometry, material);
}

/** A ring marking the tip-coverage region — the theme's open-cone color, since it's a related-but-distinct overlay. */
export function buildTipRegionRing(center: Vec3, radiusM: number, theme: Theme): THREE.Mesh {
  const geometry = new THREE.RingGeometry(Math.max(radiusM - 0.04, 0.01), radiusM, 48);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({
    color: theme.overlays.openCone,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(center.x, 0.02, center.z);
  return mesh;
}
