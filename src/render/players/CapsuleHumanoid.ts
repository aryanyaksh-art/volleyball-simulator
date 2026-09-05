import * as THREE from 'three';
import type { Vec3 } from '@/core/math/vec';
import type { PoseId } from '@/core/play/poses';
import type { PlayerVisual } from './PlayerVisual';
import type { HumanoidFactory } from './HumanoidFactory';
import { resolvePose } from './poseRig';

const P = {
  pelvisHeight: 0.95,
  torsoLength: 0.5,
  headRadius: 0.11,
  shoulderOffsetX: 0.2,
  upperArmLength: 0.3,
  lowerArmLength: 0.28,
  hipOffsetX: 0.1,
  upperLegLength: 0.45,
  lowerLegLength: 0.45,
  limbRadius: 0.06,
  torsoRadius: 0.14,
};

/** A capsule mesh whose pivot is at its TOP, hanging length `len` downward. */
function hangingCapsule(len: number, radius: number, color: string): THREE.Mesh {
  const geo = new THREE.CapsuleGeometry(radius, Math.max(len - radius * 2, 0.02), 4, 8);
  const mat = new THREE.MeshBasicMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = -len / 2;
  return mesh;
}

/**
 * A flat-shaded, unlit humanoid built from ~9 primitives on a small named
 * skeleton (spine, shoulders/elbows, hips/knees). MeshBasicMaterial means it
 * renders as a solid silhouette in team color from any orbit angle, matching
 * the reference look, without needing scene lighting at all.
 *
 * This is the v1 implementation of PlayerVisual. A future look (once the
 * user's reference images are in) is a new class implementing the same
 * interface — SceneBridge and everything in core/ stays untouched.
 */
export class CapsuleHumanoid implements PlayerVisual {
  readonly root: THREE.Group;

  private pelvis: THREE.Group;
  private spine: THREE.Group;
  private shoulderL: THREE.Group;
  private elbowL: THREE.Group;
  private shoulderR: THREE.Group;
  private elbowR: THREE.Group;
  private hipL: THREE.Group;
  private kneeL: THREE.Group;
  private hipR: THREE.Group;
  private kneeR: THREE.Group;

  private meshes: THREE.Mesh[] = [];
  private labelSprite: THREE.Sprite | null = null;

  constructor(color: string) {
    this.root = new THREE.Group();

    this.pelvis = new THREE.Group();
    this.pelvis.position.y = P.pelvisHeight;
    this.root.add(this.pelvis);

    this.spine = new THREE.Group();
    this.pelvis.add(this.spine);

    const torso = new THREE.Mesh(
      new THREE.CapsuleGeometry(P.torsoRadius, Math.max(P.torsoLength - P.torsoRadius * 2, 0.02), 4, 8),
      new THREE.MeshBasicMaterial({ color }),
    );
    torso.position.y = P.torsoLength / 2; // grows upward from the spine pivot
    this.spine.add(torso);
    this.meshes.push(torso);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(P.headRadius, 12, 10),
      new THREE.MeshBasicMaterial({ color }),
    );
    head.position.y = P.torsoLength + P.headRadius + 0.03;
    this.spine.add(head);
    this.meshes.push(head);

    [this.shoulderL, this.elbowL] = this.buildArm(-1, color);
    [this.shoulderR, this.elbowR] = this.buildArm(1, color);
    [this.hipL, this.kneeL] = this.buildLeg(-1, color);
    [this.hipR, this.kneeR] = this.buildLeg(1, color);

    this.setPose('idle');
  }

  private buildArm(side: -1 | 1, color: string): [THREE.Group, THREE.Group] {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * P.shoulderOffsetX, P.torsoLength - 0.05, 0);
    this.spine.add(shoulder);

    const upperArm = hangingCapsule(P.upperArmLength, P.limbRadius, color);
    shoulder.add(upperArm);
    this.meshes.push(upperArm);

    const elbow = new THREE.Group();
    elbow.position.y = -P.upperArmLength;
    shoulder.add(elbow);

    const lowerArm = hangingCapsule(P.lowerArmLength, P.limbRadius * 0.9, color);
    elbow.add(lowerArm);
    this.meshes.push(lowerArm);

    return [shoulder, elbow];
  }

  private buildLeg(side: -1 | 1, color: string): [THREE.Group, THREE.Group] {
    const hip = new THREE.Group();
    hip.position.set(side * P.hipOffsetX, 0, 0);
    this.pelvis.add(hip);

    const upperLeg = hangingCapsule(P.upperLegLength, P.limbRadius * 1.2, color);
    hip.add(upperLeg);
    this.meshes.push(upperLeg);

    const knee = new THREE.Group();
    knee.position.y = -P.upperLegLength;
    hip.add(knee);

    const lowerLeg = hangingCapsule(P.lowerLegLength, P.limbRadius, color);
    knee.add(lowerLeg);
    this.meshes.push(lowerLeg);

    return [hip, knee];
  }

  setPosition(p: Vec3): void {
    this.root.position.set(p.x, p.y, p.z);
  }

  setFacing(rad: number): void {
    this.root.rotation.y = rad;
  }

  setPose(pose: PoseId): void {
    const joints = resolvePose(pose);
    this.spine.rotation.set(joints.spine.x, joints.spine.y, joints.spine.z);
    this.shoulderL.rotation.set(joints.shoulderL.x, joints.shoulderL.y, joints.shoulderL.z);
    this.elbowL.rotation.set(joints.elbowL.x, joints.elbowL.y, joints.elbowL.z);
    this.shoulderR.rotation.set(joints.shoulderR.x, joints.shoulderR.y, joints.shoulderR.z);
    this.elbowR.rotation.set(joints.elbowR.x, joints.elbowR.y, joints.elbowR.z);
    this.hipL.rotation.set(joints.hipL.x, joints.hipL.y, joints.hipL.z);
    this.kneeL.rotation.set(joints.kneeL.x, joints.kneeL.y, joints.kneeL.z);
    this.hipR.rotation.set(joints.hipR.x, joints.hipR.y, joints.hipR.z);
    this.kneeR.rotation.set(joints.kneeR.x, joints.kneeR.y, joints.kneeR.z);
  }

  setTeamColor(color: string): void {
    const c = new THREE.Color(color);
    for (const mesh of this.meshes) {
      (mesh.material as THREE.MeshBasicMaterial).color.copy(c);
    }
  }

  setLabel(_jerseyNumber?: number): void {
    // Jersey-number billboard sprite — added when the roster/lineup UI
    // (Phase 2) has real numbers to show.
  }

  dispose(): void {
    for (const mesh of this.meshes) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    if (this.labelSprite) {
      this.labelSprite.material.map?.dispose();
      this.labelSprite.material.dispose();
    }
  }
}

export const capsuleHumanoidFactory: HumanoidFactory = {
  create: (color: string) => new CapsuleHumanoid(color),
};
