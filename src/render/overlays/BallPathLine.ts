import * as THREE from 'three';
import type { Vec3 } from '@/core/math/vec';
import { ballPositionAt } from '@/core/play/ballFlight';
import type { Theme } from '../theme/Theme';

const SAMPLES_PER_SEGMENT = 24;

/**
 * A persistent, dashed preview of one or more ball flights (from PlaySchedule's
 * ballTrack, already resolved to world Vec3 with apex data) -- the actual shape
 * the ball will take, visible while authoring instead of only appearing as a
 * short fading trail during playback. Dashed and semi-transparent on purpose,
 * so it reads as "the planned route" and never gets mistaken for the live
 * BallTrail (solid, chases the ball itself, only exists while it's moving).
 */
export interface BallArcInput {
  from: Vec3;
  to: Vec3;
  apexM: number;
  apexU?: number;
}

export function buildBallPathGroup(arcs: BallArcInput[], theme: Theme): THREE.Group {
  const group = new THREE.Group();
  if (arcs.length === 0) return group;

  const material = new THREE.LineDashedMaterial({
    color: theme.ball.trailColor,
    transparent: true,
    opacity: 0.85,
    dashSize: 0.15,
    gapSize: 0.1,
  });

  for (const arc of arcs) {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= SAMPLES_PER_SEGMENT; i++) {
      const u = i / SAMPLES_PER_SEGMENT;
      const p = ballPositionAt(arc.from, arc.to, arc.apexM, u, arc.apexU);
      points.push(new THREE.Vector3(p.x, p.y, p.z));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    group.add(line);
  }

  return group;
}
