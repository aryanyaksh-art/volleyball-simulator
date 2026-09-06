import * as THREE from 'three';
import type { Vec3 } from '@/core/math/vec';
import type { Theme } from '../theme/Theme';

const BALL_RADIUS_M = 0.105;

export class BallVisual {
  readonly mesh: THREE.Mesh;

  constructor(theme: Theme) {
    const geometry = new THREE.SphereGeometry(BALL_RADIUS_M, 16, 16);
    const material = new THREE.MeshBasicMaterial({ color: theme.ball.color });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.visible = false;
  }

  setTheme(theme: Theme): void {
    (this.mesh.material as THREE.MeshBasicMaterial).color.set(theme.ball.color);
  }

  setState(pos: Vec3, visible: boolean): void {
    this.mesh.visible = visible;
    if (visible) this.mesh.position.set(pos.x, pos.y, pos.z);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
