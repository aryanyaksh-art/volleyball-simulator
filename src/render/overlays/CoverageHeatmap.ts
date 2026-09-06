import * as THREE from 'three';
import type { Side } from '@/core/court/coordinates';
import { toWorld } from '@/core/court/coordinates';
import type { ServeReceiveCell } from '@/core/tactics/serveReceive';

const SEVERITY_COLOR: Record<ServeReceiveCell['severity'], THREE.Color> = {
  safe: new THREE.Color('#3ecf5c'),
  tight: new THREE.Color('#e0b95c'),
  uncovered: new THREE.Color('#e05c5c'),
};

/**
 * One merged mesh (single draw call, per-vertex color) for the whole
 * uncovered-area heatmap — the plan's payoff visual. Building a separate
 * THREE.Mesh per grid cell would mean hundreds of draw calls for a normal
 * 0.25-0.5m grid over a full court half, so cells are baked into one
 * non-indexed BufferGeometry instead.
 */
export function buildCoverageHeatmap(cells: ServeReceiveCell[], side: Side, cellSizeM: number, opacity = 0.55): THREE.Mesh {
  const positions: number[] = [];
  const colors: number[] = [];
  const half = cellSizeM / 2;

  for (const cell of cells) {
    const center = toWorld(cell.center, side, 0.02); // just above the floor to avoid z-fighting with court lines
    const color = SEVERITY_COLOR[cell.severity];
    const x0 = center.x - half;
    const x1 = center.x + half;
    const z0 = center.z - half;
    const z1 = center.z + half;

    const quad: [number, number, number][] = [
      [x0, center.y, z0],
      [x1, center.y, z0],
      [x1, center.y, z1],
      [x0, center.y, z0],
      [x1, center.y, z1],
      [x0, center.y, z1],
    ];
    for (const [x, y, z] of quad) {
      positions.push(x, y, z);
      colors.push(color.r, color.g, color.b);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  return new THREE.Mesh(geometry, material);
}
