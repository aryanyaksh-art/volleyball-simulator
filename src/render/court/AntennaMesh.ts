import * as THREE from 'three';
import type { CourtSpec } from '@/core/court/courtSpec';
import type { Theme } from '../theme/Theme';

const RADIUS = 0.01;
const DASH_SEGMENTS = 8;

function buildAntenna(x: number, spec: CourtSpec, theme: Theme): THREE.Group {
  const group = new THREE.Group();
  const totalHeight = spec.antennaAboveNetM;

  if (!theme.antenna.dashed) {
    const geo = new THREE.CylinderGeometry(RADIUS, RADIUS, totalHeight, 8);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: theme.antenna.colorA }));
    mesh.position.set(x, spec.netHeightM + totalHeight / 2, 0);
    group.add(mesh);
    return group;
  }

  const segH = totalHeight / DASH_SEGMENTS;
  for (let i = 0; i < DASH_SEGMENTS; i++) {
    const color = i % 2 === 0 ? theme.antenna.colorA : theme.antenna.colorB;
    const geo = new THREE.CylinderGeometry(RADIUS, RADIUS, segH, 8);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color }));
    mesh.position.set(x, spec.netHeightM + segH * (i + 0.5), 0);
    group.add(mesh);
  }
  return group;
}

/** Both antennas, sitting on the sideline planes at the outer edge of the net. */
export function buildAntennaGroup(spec: CourtSpec, theme: Theme): THREE.Group {
  const group = new THREE.Group();
  const halfSpan = spec.antennaSpanM / 2;
  group.add(buildAntenna(-halfSpan, spec, theme));
  group.add(buildAntenna(halfSpan, spec, theme));
  return group;
}
