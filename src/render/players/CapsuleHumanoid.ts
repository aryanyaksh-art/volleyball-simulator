import * as THREE from 'three';
import type { Vec3 } from '@/core/math/vec';
import type { PoseId } from '@/core/play/poses';
import type { PlayerVisual } from './PlayerVisual';
import type { HumanoidFactory } from './HumanoidFactory';
import { resolvePose, type PoseJoints } from './poseRig';

const JOINT_KEYS: (keyof PoseJoints)[] = [
  'spine',
  'shoulderL',
  'elbowL',
  'shoulderR',
  'elbowR',
  'hipL',
  'kneeL',
  'hipR',
  'kneeR',
];

/** Time constant for the pose crossfade — ~3x this is roughly how long a transition takes to settle. */
const POSE_BLEND_TAU_S = 0.08;

const lerpNum = (a: number, b: number, t: number): number => a + (b - a) * t;

const P = {
  pelvisHeight: 0.92,
  torsoLength: 0.46,
  neckLength: 0.05,
  headRadius: 0.11,
  shoulderOffsetX: 0.21,
  upperArmLength: 0.3,
  lowerArmLength: 0.27,
  handLength: 0.09,
  hipOffsetX: 0.1,
  hipWidthX: 0.16,
  upperLegLength: 0.45,
  lowerLegLength: 0.43,
  footLength: 0.13,
  limbRadius: 0.055,
  waistRadius: 0.115,
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
 * A torso as a solid of revolution: narrow at the waist, flaring out through
 * the ribs and chest, then pulling back in at the shoulder line. This one
 * shape is what reads as an actual human torso instead of a tube, since a
 * plain capsule silhouettes as a lightbulb, not a body.
 */
function buildTorsoGeometry(): THREE.LatheGeometry {
  const profile = [
    new THREE.Vector2(P.waistRadius * 0.92, 0),
    new THREE.Vector2(P.waistRadius, P.torsoLength * 0.12),
    new THREE.Vector2(P.waistRadius * 1.2, P.torsoLength * 0.42),
    new THREE.Vector2(P.waistRadius * 1.5, P.torsoLength * 0.72),
    new THREE.Vector2(P.waistRadius * 1.62, P.torsoLength * 0.92),
    new THREE.Vector2(P.waistRadius * 1.25, P.torsoLength),
  ];
  return new THREE.LatheGeometry(profile, 12);
}

/** A flattened, widened sphere standing in for the pelvis and hip girdle. */
function buildHipGeometry(): THREE.SphereGeometry {
  const geo = new THREE.SphereGeometry(P.waistRadius * 1.15, 12, 8);
  geo.scale(1.55, 0.62, 0.85);
  return geo;
}

/**
 * A small elongated blob for a hand or foot, enough to read as an
 * extremity without needing separate fingers or toes at this scale.
 */
function buildExtremityGeometry(radius: number, scaleX: number, scaleY: number, scaleZ: number): THREE.SphereGeometry {
  const geo = new THREE.SphereGeometry(radius, 10, 8);
  geo.scale(scaleX, scaleY, scaleZ);
  return geo;
}

/**
 * A flat-shaded, unlit humanoid built from about 15 primitives on a small
 * named skeleton (spine, shoulders/elbows, hips/knees). A tapered torso,
 * hip girdle, neck, and small hand/foot extremities give it a human
 * silhouette instead of a stick-of-capsules look, while staying pure flat
 * color: MeshBasicMaterial means it renders as a solid silhouette in team
 * color from any orbit angle, matching the reference look, without needing
 * scene lighting at all.
 *
 * This is the v1 implementation of PlayerVisual. A future look (once
 * reference art lands) is a new class implementing the same interface -
 * SceneBridge and everything in core/ stays untouched.
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

  private currentJoints: PoseJoints = resolvePose('idle');
  private targetJoints: PoseJoints = resolvePose('idle');

  constructor(color: string) {
    this.root = new THREE.Group();

    this.pelvis = new THREE.Group();
    this.pelvis.position.y = P.pelvisHeight;
    this.root.add(this.pelvis);

    const hip = new THREE.Mesh(buildHipGeometry(), new THREE.MeshBasicMaterial({ color }));
    this.pelvis.add(hip);
    this.meshes.push(hip);

    this.spine = new THREE.Group();
    this.pelvis.add(this.spine);

    const torso = new THREE.Mesh(buildTorsoGeometry(), new THREE.MeshBasicMaterial({ color }));
    this.spine.add(torso);
    this.meshes.push(torso);

    const neck = hangingCapsule(P.neckLength, P.waistRadius * 0.55, color);
    neck.position.y = P.torsoLength + P.neckLength / 2;
    this.spine.add(neck);
    this.meshes.push(neck);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(P.headRadius, 12, 10),
      new THREE.MeshBasicMaterial({ color }),
    );
    head.position.y = P.torsoLength + P.neckLength + P.headRadius;
    this.spine.add(head);
    this.meshes.push(head);

    [this.shoulderL, this.elbowL] = this.buildArm(-1, color);
    [this.shoulderR, this.elbowR] = this.buildArm(1, color);
    [this.hipL, this.kneeL] = this.buildLeg(-1, color);
    [this.hipR, this.kneeR] = this.buildLeg(1, color);

    this.applyJoints(this.currentJoints);
  }

  private buildArm(side: -1 | 1, color: string): [THREE.Group, THREE.Group] {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * P.shoulderOffsetX, P.torsoLength * 0.88, 0);
    this.spine.add(shoulder);

    const upperArm = hangingCapsule(P.upperArmLength, P.limbRadius, color);
    shoulder.add(upperArm);
    this.meshes.push(upperArm);

    const elbow = new THREE.Group();
    elbow.position.y = -P.upperArmLength;
    shoulder.add(elbow);

    const lowerArm = hangingCapsule(P.lowerArmLength, P.limbRadius * 0.85, color);
    elbow.add(lowerArm);
    this.meshes.push(lowerArm);

    const hand = new THREE.Mesh(
      buildExtremityGeometry(P.limbRadius * 0.85, 0.85, 1.35, 0.6),
      new THREE.MeshBasicMaterial({ color }),
    );
    hand.position.y = -P.lowerArmLength - P.handLength * 0.3;
    elbow.add(hand);
    this.meshes.push(hand);

    return [shoulder, elbow];
  }

  private buildLeg(side: -1 | 1, color: string): [THREE.Group, THREE.Group] {
    const hip = new THREE.Group();
    hip.position.set(side * P.hipOffsetX, -0.02, 0);
    this.pelvis.add(hip);

    const upperLeg = hangingCapsule(P.upperLegLength, P.limbRadius * 1.3, color);
    hip.add(upperLeg);
    this.meshes.push(upperLeg);

    const knee = new THREE.Group();
    knee.position.y = -P.upperLegLength;
    hip.add(knee);

    const lowerLeg = hangingCapsule(P.lowerLegLength, P.limbRadius, color);
    knee.add(lowerLeg);
    this.meshes.push(lowerLeg);

    const foot = new THREE.Mesh(
      buildExtremityGeometry(P.limbRadius * 1.1, 0.9, 0.55, 1.7),
      new THREE.MeshBasicMaterial({ color }),
    );
    foot.position.set(0, -P.lowerLegLength + 0.015, P.footLength * 0.32);
    knee.add(foot);
    this.meshes.push(foot);

    return [hip, knee];
  }

  setPosition(p: Vec3): void {
    this.root.position.set(p.x, p.y, p.z);
  }

  setFacing(rad: number): void {
    this.root.rotation.y = rad;
  }

  /** Sets the target pose. The skeleton crossfades toward it over subsequent update() calls — see poseRig.ts's blend note. */
  setPose(pose: PoseId): void {
    this.targetJoints = resolvePose(pose);
  }

  /** Advances the pose crossfade by dtSeconds using framerate-independent exponential smoothing, then applies it. */
  update(dtSeconds: number): void {
    const alpha = 1 - Math.exp(-Math.max(dtSeconds, 0) / POSE_BLEND_TAU_S);
    for (const key of JOINT_KEYS) {
      const from = this.currentJoints[key];
      const to = this.targetJoints[key];
      this.currentJoints[key] = {
        x: lerpNum(from.x, to.x, alpha),
        y: lerpNum(from.y, to.y, alpha),
        z: lerpNum(from.z, to.z, alpha),
      };
    }
    this.applyJoints(this.currentJoints);
  }

  // poseRig.ts is authored so a positive x means "swing forward" (spine
  // lean, shoulder/hip reach toward the net) and a positive z means
  // "swing outward, away from the midline" — the intuitive way to read a
  // pose table. Three.js's actual rotation math swings a hanging limb the
  // other way for both axes (confirmed empirically: a positive x-rotation
  // reaches AWAY from the model's facing direction, and a positive
  // z-rotation swings toward the midline, not away from it). Negate x and
  // z here to realize the authored intent. The knee is the one joint that
  // needs no correction: its natural "shin swings behind the thigh" bend
  // already matches this math with a positive angle.
  private applyJoints(joints: PoseJoints): void {
    this.spine.rotation.set(-joints.spine.x, joints.spine.y, -joints.spine.z);
    this.shoulderL.rotation.set(-joints.shoulderL.x, joints.shoulderL.y, -joints.shoulderL.z);
    this.elbowL.rotation.set(-joints.elbowL.x, joints.elbowL.y, -joints.elbowL.z);
    this.shoulderR.rotation.set(-joints.shoulderR.x, joints.shoulderR.y, -joints.shoulderR.z);
    this.elbowR.rotation.set(-joints.elbowR.x, joints.elbowR.y, -joints.elbowR.z);
    this.hipL.rotation.set(-joints.hipL.x, joints.hipL.y, -joints.hipL.z);
    this.kneeL.rotation.set(joints.kneeL.x, joints.kneeL.y, joints.kneeL.z);
    this.hipR.rotation.set(-joints.hipR.x, joints.hipR.y, -joints.hipR.z);
    this.kneeR.rotation.set(joints.kneeR.x, joints.kneeR.y, joints.kneeR.z);
  }

  setTeamColor(color: string): void {
    const c = new THREE.Color(color);
    for (const mesh of this.meshes) {
      (mesh.material as THREE.MeshBasicMaterial).color.copy(c);
    }
  }

  setLabel(_jerseyNumber?: number): void {
    // Jersey-number billboard sprite - added when the roster/lineup UI
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
