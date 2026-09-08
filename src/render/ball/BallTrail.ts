import * as THREE from 'three';
import type { Vec3 } from '@/core/math/vec';
import type { Theme } from '../theme/Theme';

const MAX_POINTS = 12;

/**
 * A short fading trail behind the ball during playback, using the theme's
 * own `ball.trailColor` (defined from Phase 0 but never actually used until
 * now). A strip of small flat-shaded spheres shrinking and fading toward
 * the oldest point, rather than a single vertex-colored line — this
 * material stack (MeshBasicMaterial, matching the rest of the renderer's
 * unlit look) can't easily fade alpha per-vertex along one line geometry,
 * and a chain of markers is cheap enough at this size (12 tiny spheres).
 */
export class BallTrail {
  readonly group: THREE.Group;
  private markers: THREE.Mesh[] = [];
  private points: Vec3[] = [];

  constructor(theme: Theme) {
    this.group = new THREE.Group();
    for (let i = 0; i < MAX_POINTS; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 8, 8),
        new THREE.MeshBasicMaterial({ color: theme.ball.trailColor, transparent: true, opacity: 0, depthWrite: false }),
      );
      mesh.visible = false;
      this.markers.push(mesh);
      this.group.add(mesh);
    }
  }

  setTheme(theme: Theme): void {
    for (const m of this.markers) (m.material as THREE.MeshBasicMaterial).color.set(theme.ball.trailColor);
  }

  /** Called once per frame with the ball's current world position while it's visible — appends to the trail history and re-lays-out the markers. */
  push(pos: Vec3): void {
    this.points.push(pos);
    if (this.points.length > MAX_POINTS) this.points.shift();
    this.layout();
  }

  /** Drops the whole trail instantly — whenever the ball becomes invisible, and whenever playback jumps discontinuously (a loop wrap or a manual scrub), so a stale trail never draws a nonsense streak across the gap. */
  clear(): void {
    this.points = [];
    for (const m of this.markers) m.visible = false;
  }

  private layout(): void {
    const n = this.points.length;
    for (let i = 0; i < MAX_POINTS; i++) {
      const mesh = this.markers[i];
      if (i >= n) {
        mesh.visible = false;
        continue;
      }
      // points[0] is the oldest, points[n-1] the newest.
      const point = this.points[i];
      const age = n - 1 - i;
      const freshness = 1 - age / MAX_POINTS;
      mesh.visible = true;
      mesh.position.set(point.x, point.y, point.z);
      mesh.scale.setScalar(0.35 + 0.65 * freshness);
      (mesh.material as THREE.MeshBasicMaterial).opacity = 0.5 * freshness;
    }
  }

  dispose(): void {
    for (const m of this.markers) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
  }
}
