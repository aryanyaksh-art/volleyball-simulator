import * as THREE from 'three';
import type { CourtSpec } from '@/core/court/courtSpec';
import type { Theme } from '../theme/Theme';

/** A faint floor grid extending past the court into the free zone. */
export function buildGridMesh(spec: CourtSpec, theme: Theme): THREE.Object3D | null {
  if (!theme.grid.visible) return null;

  const size = spec.lengthM + spec.freeZoneM * 4;
  const divisions = Math.max(Math.round(size / theme.grid.spacingM), 1);
  const grid = new THREE.GridHelper(size, divisions, theme.grid.color, theme.grid.color);
  const mat = grid.material as THREE.Material & { opacity: number; transparent: boolean };
  mat.opacity = theme.grid.opacity;
  mat.transparent = true;
  grid.position.y = -0.003; // just under the court lines
  return grid;
}
