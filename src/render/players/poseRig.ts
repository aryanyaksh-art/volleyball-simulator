import type { PoseId } from '@/core/play/poses';

/**
 * Maps each PoseId to joint rotations for CapsuleHumanoid's skeleton. Pure
 * data, no geometry — a different HumanoidFactory (once the user's reference
 * images are in) can ignore this file entirely and define its own rig.
 *
 * Angle convention (all radians, applied as Euler(x, y, z) on each joint
 * group, which hangs its child limb downward at rotation 0):
 *   x — forward/back swing (flexion). Positive rotates the limb from
 *       hanging down toward the model's forward (+Z) facing direction.
 *       180 deg points a limb straight up.
 *   z — sideways swing (abduction). Positive on the left side / negative
 *       on the right raises the limb out to that side.
 *   y — twist. Used sparingly (e.g. torso rotation through a swing).
 */
export interface JointAngles {
  x: number;
  y: number;
  z: number;
}

export interface PoseJoints {
  spine: JointAngles;
  shoulderL: JointAngles;
  elbowL: JointAngles;
  shoulderR: JointAngles;
  elbowR: JointAngles;
  hipL: JointAngles;
  kneeL: JointAngles;
  hipR: JointAngles;
  kneeR: JointAngles;
}

type PartialPoseJoints = Partial<Record<keyof PoseJoints, Partial<JointAngles>>>;

const DEG = Math.PI / 180;
const j = (x = 0, y = 0, z = 0): JointAngles => ({ x, y, z });

/** Relaxed standing position — the base every pose overrides from. */
const NEUTRAL: PoseJoints = {
  spine: j(),
  shoulderL: j(8 * DEG, 0, 10 * DEG),
  elbowL: j(8 * DEG),
  shoulderR: j(8 * DEG, 0, -10 * DEG),
  elbowR: j(8 * DEG),
  hipL: j(0, 0, 3 * DEG),
  kneeL: j(4 * DEG),
  hipR: j(0, 0, -3 * DEG),
  kneeR: j(4 * DEG),
};

export const POSES: Record<PoseId, PartialPoseJoints> = {
  idle: {},

  // Athletic ready stance — knees bent, arms hanging forward and loose.
  ready: {
    spine: j(15 * DEG),
    shoulderL: j(45 * DEG, 0, 18 * DEG),
    elbowL: j(20 * DEG),
    shoulderR: j(45 * DEG, 0, -18 * DEG),
    elbowR: j(20 * DEG),
    hipL: j(18 * DEG, 0, 5 * DEG),
    kneeL: j(38 * DEG),
    hipR: j(18 * DEG, 0, -5 * DEG),
    kneeR: j(38 * DEG),
  },

  // Forearm-pass platform — arms extended forward together, low and wide stance.
  passLow: {
    spine: j(28 * DEG),
    shoulderL: j(75 * DEG, 0, 6 * DEG),
    elbowL: j(4 * DEG),
    shoulderR: j(75 * DEG, 0, -6 * DEG),
    elbowR: j(4 * DEG),
    hipL: j(25 * DEG, 0, 8 * DEG),
    kneeL: j(48 * DEG),
    hipR: j(25 * DEG, 0, -8 * DEG),
    kneeR: j(48 * DEG),
  },

  // Overhead pass — hands up in front of the forehead, elbows starting to flare.
  passHigh: {
    spine: j(6 * DEG),
    shoulderL: j(108 * DEG, 0, 15 * DEG),
    elbowL: j(85 * DEG),
    shoulderR: j(108 * DEG, 0, -15 * DEG),
    elbowR: j(85 * DEG),
    hipL: j(14 * DEG),
    kneeL: j(28 * DEG),
    hipR: j(14 * DEG),
    kneeR: j(28 * DEG),
  },

  // Classic set — hands above the forehead, elbows out wide.
  set: {
    spine: j(4 * DEG),
    shoulderL: j(100 * DEG, 0, 35 * DEG),
    elbowL: j(95 * DEG),
    shoulderR: j(100 * DEG, 0, -35 * DEG),
    elbowR: j(95 * DEG),
    hipL: j(12 * DEG),
    kneeL: j(24 * DEG),
    hipR: j(12 * DEG),
    kneeR: j(24 * DEG),
  },

  // Same hands as `set`, legs trailing/extended — airborne jump set.
  jumpSet: {
    spine: j(2 * DEG),
    shoulderL: j(100 * DEG, 0, 30 * DEG),
    elbowL: j(90 * DEG),
    shoulderR: j(100 * DEG, 0, -30 * DEG),
    elbowR: j(90 * DEG),
    hipL: j(-10 * DEG),
    kneeL: j(15 * DEG),
    hipR: j(-10 * DEG),
    kneeR: j(15 * DEG),
  },

  // Running stride, contralateral arm/leg swing — right leg forward, left arm forward.
  approach: {
    spine: j(10 * DEG, 8 * DEG),
    shoulderL: j(55 * DEG, 0, 8 * DEG),
    elbowL: j(70 * DEG),
    shoulderR: j(-45 * DEG, 0, -8 * DEG),
    elbowR: j(60 * DEG),
    hipL: j(-30 * DEG),
    kneeL: j(20 * DEG),
    hipR: j(45 * DEG),
    kneeR: j(70 * DEG),
  },

  // Pre-jump load — deep crouch, arms swung back to drive upward.
  load: {
    spine: j(25 * DEG),
    shoulderL: j(-60 * DEG, 0, 10 * DEG),
    elbowL: j(15 * DEG),
    shoulderR: j(-60 * DEG, 0, -10 * DEG),
    elbowR: j(15 * DEG),
    hipL: j(35 * DEG),
    kneeL: j(75 * DEG),
    hipR: j(35 * DEG),
    kneeR: j(75 * DEG),
  },

  // Contact moment — hitting arm (right) raised high, off arm down for balance, airborne.
  attack: {
    spine: j(-10 * DEG, -10 * DEG),
    shoulderL: j(20 * DEG, 0, 25 * DEG),
    elbowL: j(30 * DEG),
    shoulderR: j(165 * DEG, 0, -10 * DEG),
    elbowR: j(15 * DEG),
    hipL: j(-15 * DEG),
    kneeL: j(15 * DEG),
    hipR: j(-15 * DEG),
    kneeR: j(15 * DEG),
  },

  // After the swing — hitting arm down and across the body, landing crouch.
  followThrough: {
    spine: j(15 * DEG, 25 * DEG),
    shoulderL: j(-30 * DEG, 0, -15 * DEG),
    elbowL: j(20 * DEG),
    shoulderR: j(-20 * DEG, 0, 30 * DEG),
    elbowR: j(45 * DEG),
    hipL: j(25 * DEG),
    kneeL: j(45 * DEG),
    hipR: j(25 * DEG),
    kneeR: j(45 * DEG),
  },

  // Both arms straight up together, legs together and extended — airborne.
  block: {
    spine: j(-5 * DEG),
    shoulderL: j(175 * DEG, 0, 8 * DEG),
    elbowL: j(5 * DEG),
    shoulderR: j(175 * DEG, 0, -8 * DEG),
    elbowR: j(5 * DEG),
    hipL: j(-5 * DEG),
    kneeL: j(8 * DEG),
    hipR: j(-5 * DEG),
    kneeR: j(8 * DEG),
  },

  // The reference stance — low, wide, arms extended forward together, deep lean.
  dig: {
    spine: j(45 * DEG),
    shoulderL: j(85 * DEG, 0, 6 * DEG),
    elbowL: j(3 * DEG),
    shoulderR: j(85 * DEG, 0, -6 * DEG),
    elbowR: j(3 * DEG),
    hipL: j(30 * DEG, 0, 10 * DEG),
    kneeL: j(60 * DEG),
    hipR: j(30 * DEG, 0, -10 * DEG),
    kneeR: j(60 * DEG),
  },

  // Emergency dive — one leg extended out to the side, reaching low and forward.
  sprawl: {
    spine: j(55 * DEG, 15 * DEG),
    shoulderL: j(20 * DEG, 0, 60 * DEG),
    elbowL: j(40 * DEG),
    shoulderR: j(100 * DEG, 0, -20 * DEG),
    elbowR: j(10 * DEG),
    hipL: j(10 * DEG, 0, 45 * DEG),
    kneeL: j(10 * DEG),
    hipR: j(20 * DEG),
    kneeR: j(30 * DEG),
  },

  // Toss arm raised, hitting arm cocked back, standing tall.
  serveToss: {
    spine: j(-8 * DEG),
    shoulderL: j(165 * DEG, 0, 10 * DEG),
    elbowL: j(8 * DEG),
    shoulderR: j(15 * DEG, 0, -15 * DEG),
    elbowR: j(15 * DEG),
    hipL: j(0),
    kneeL: j(8 * DEG),
    hipR: j(-10 * DEG),
    kneeR: j(8 * DEG),
  },

  // Toss arm dropped, hitting arm extended up at contact, slight jump.
  serveContact: {
    spine: j(-15 * DEG, -10 * DEG),
    shoulderL: j(-20 * DEG, 0, 15 * DEG),
    elbowL: j(20 * DEG),
    shoulderR: j(160 * DEG, 0, -8 * DEG),
    elbowR: j(10 * DEG),
    hipL: j(-15 * DEG),
    kneeL: j(12 * DEG),
    hipR: j(-15 * DEG),
    kneeR: j(12 * DEG),
  },

  // Relaxed repositioning between contacts — upright, arms loose.
  transition: {
    spine: j(5 * DEG),
    shoulderL: j(20 * DEG, 0, 12 * DEG),
    elbowL: j(12 * DEG),
    shoulderR: j(20 * DEG, 0, -12 * DEG),
    elbowR: j(12 * DEG),
    hipL: j(-8 * DEG),
    kneeL: j(15 * DEG),
    hipR: j(-8 * DEG),
    kneeR: j(15 * DEG),
  },
};

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

export function resolvePose(pose: PoseId): PoseJoints {
  const overrides = POSES[pose];
  const out = {} as PoseJoints;
  for (const key of JOINT_KEYS) {
    out[key] = { ...NEUTRAL[key], ...(overrides[key] ?? {}) };
  }
  return out;
}
