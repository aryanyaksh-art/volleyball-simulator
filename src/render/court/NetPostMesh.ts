import * as THREE from 'three';
import type { CourtSpec } from '@/core/court/courtSpec';
import type { Theme } from '../theme/Theme';

/**
 * The padded support posts the net actually hangs from — standing just
 * outside each sideline, floor to just above net height. Separate from
 * the thin antenna rods (AntennaMesh.ts), which sit at the sideline
 * itself on top of the net's edge, not out at the post.
 */
export function buildNetPostGroup(spec: CourtSpec, theme: Theme): THREE.Group {
  const group = new THREE.Group();
  const halfWidth = spec.widthM / 2;
  const postHeight = spec.netHeightM + spec.netPostAboveNetM;
  const x = halfWidth + spec.netPostOffsetM;

  for (const sign of [1, -1] as const) {
    const post = new THREE.Mesh(
      new THREE.CapsuleGeometry(spec.netPostRadiusM, Math.max(postHeight - spec.netPostRadiusM * 2, 0.02), 4, 8),
      new THREE.MeshBasicMaterial({ color: theme.net.postColor }),
    );
    post.position.set(sign * x, postHeight / 2, 0);
    group.add(post);
  }

  return group;
}
