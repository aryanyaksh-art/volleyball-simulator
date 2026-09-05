import * as THREE from 'three';
import type { CourtSpec } from '@/core/court/courtSpec';
import type { Theme } from '../theme/Theme';

function netFabricTexture(color: string): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  const step = size / 4;
  ctx.beginPath();
  for (let i = 0; i <= 4; i++) {
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step, size);
    ctx.moveTo(0, i * step);
    ctx.lineTo(size, i * step);
  }
  ctx.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(18, 5);
  return tex;
}

/** The net panel (meshed fabric) plus its solid top tape band. */
export function buildNetGroup(spec: CourtSpec, theme: Theme): THREE.Group {
  const group = new THREE.Group();
  const width = spec.antennaSpanM;

  const fabric = new THREE.Mesh(
    new THREE.PlaneGeometry(width, spec.netDepthM),
    new THREE.MeshBasicMaterial({
      color: theme.net.meshColor,
      map: netFabricTexture(theme.net.meshColor),
      transparent: true,
      opacity: theme.net.opacity,
      side: THREE.DoubleSide,
    }),
  );
  fabric.position.set(0, spec.netHeightM - spec.netDepthM / 2 - spec.netTopBandM, 0);
  group.add(fabric);

  const band = new THREE.Mesh(
    new THREE.PlaneGeometry(width, spec.netTopBandM),
    new THREE.MeshBasicMaterial({ color: theme.net.bandColor, side: THREE.DoubleSide }),
  );
  band.position.set(0, spec.netHeightM - spec.netTopBandM / 2, 0);
  group.add(band);

  return group;
}
