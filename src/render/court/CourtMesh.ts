import * as THREE from 'three';
import type { CourtSpec } from '@/core/court/courtSpec';
import type { Theme } from '../theme/Theme';

const LINE_Y = 0.002; // sits just above y=0 so it never z-fights with the floor

/** A flat rectangular strip from p0 to p1, built directly (no rotation math). */
function lineStripGeometry(
  p0: { x: number; z: number },
  p1: { x: number; z: number },
  widthM: number,
): THREE.BufferGeometry {
  const dx = p1.x - p0.x;
  const dz = p1.z - p0.z;
  const len = Math.hypot(dx, dz) || 1e-6;
  const nx = (-dz / len) * (widthM / 2);
  const nz = (dx / len) * (widthM / 2);

  const positions = new Float32Array([
    p0.x + nx, LINE_Y, p0.z + nz,
    p0.x - nx, LINE_Y, p0.z - nz,
    p1.x - nx, LINE_Y, p1.z - nz,
    p1.x + nx, LINE_Y, p1.z + nz,
  ]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.computeVertexNormals();
  return geo;
}

function line(p0: { x: number; z: number }, p1: { x: number; z: number }, theme: Theme): THREE.Mesh {
  const geo = lineStripGeometry(p0, p1, theme.court.lineWidthM);
  const mat = new THREE.MeshBasicMaterial({ color: theme.court.lineColor, side: THREE.DoubleSide });
  return new THREE.Mesh(geo, mat);
}

/**
 * Builds the court: perimeter, center (net) line, both attack lines, and
 * short extension ticks beyond the sidelines at the net and attack lines
 * (the small marks referees sight along). Line-art only for now — a
 * `solidFloor` theme additionally gets a colored floor plane underneath.
 */
export function buildCourtGroup(spec: CourtSpec, theme: Theme): THREE.Group {
  const group = new THREE.Group();
  const halfW = spec.widthM / 2;
  const halfL = spec.halfLengthM;
  const attackZ = spec.attackLineM;

  if (theme.court.mode === 'solidFloor' && theme.court.floorColor) {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(spec.widthM, spec.lengthM),
      new THREE.MeshBasicMaterial({ color: theme.court.floorColor }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.001;
    group.add(floor);

    if (theme.court.attackZoneColor) {
      for (const sign of [1, -1] as const) {
        const strip = new THREE.Mesh(
          new THREE.PlaneGeometry(spec.widthM, attackZ),
          new THREE.MeshBasicMaterial({ color: theme.court.attackZoneColor }),
        );
        strip.rotation.x = -Math.PI / 2;
        strip.position.set(0, -0.0005, sign * (attackZ / 2));
        group.add(strip);
      }
    }
  }

  const perimeter: [{ x: number; z: number }, { x: number; z: number }][] = [
    [{ x: -halfW, z: -halfL }, { x: halfW, z: -halfL }],
    [{ x: halfW, z: -halfL }, { x: halfW, z: halfL }],
    [{ x: halfW, z: halfL }, { x: -halfW, z: halfL }],
    [{ x: -halfW, z: halfL }, { x: -halfW, z: -halfL }],
  ];
  for (const [a, b] of perimeter) group.add(line(a, b, theme));

  // Center (net) line and both attack lines.
  for (const z of [0, attackZ, -attackZ]) {
    group.add(line({ x: -halfW, z }, { x: halfW, z }, theme));
  }

  // Short extension ticks beyond each sideline at net + attack lines.
  const tick = 0.15;
  for (const z of [0, attackZ, -attackZ]) {
    for (const sign of [1, -1] as const) {
      const x0 = sign * halfW;
      const x1 = sign * (halfW + tick);
      group.add(line({ x: x0, z }, { x: x1, z }, theme));
    }
  }

  return group;
}
