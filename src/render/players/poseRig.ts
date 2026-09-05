import type { PoseId } from '@/core/play/poses';

/**
 * Maps each PoseId to joint rotations for CapsuleHumanoid's skeleton. Pure
 * data, no geometry — a different HumanoidFactory (once reference art lands)
 * can ignore this file entirely and define its own rig.
 *
 * Angle convention (all radians, applied as Euler(x, y, z) on each joint
 * group, which hangs its child limb downward at rotation 0). This is the
 * INTENDED, visual convention — CapsuleHumanoid.setPose negates x and z for
 * the joints where it matters (spine, shoulders, hips) to realize it,
 * because Three.js's own rotation math swings the opposite way; see the
 * comment there for the empirically-verified reasoning:
 *   x — forward/back swing (flexion). Positive swings the limb from
 *       hanging down toward the model's forward-facing direction (toward
 *       the net, in play). 90 deg is horizontal-forward; 180 deg points
 *       a limb straight up.
 *   z — sideways swing (abduction). Positive on the left side / negative
 *       on the right raises the limb OUTWARD, away from the midline.
 *   y — twist. Used sparingly (e.g. torso rotation through a swing).
 *
 * Compounding note: shoulderL/R are children of spine, so a spine forward
 * lean ADDS to the shoulder's own forward swing (exactly like a real
 * shoulder moving with a leaning torso, plus its own additional reach).
 * Each pose's shoulder.x below is chosen as (desired total forward angle
 * of the arm) minus spine.x, so the two compound to the intended result.
 * hipL/R are children of the pelvis, which never rotates, so no such
 * adjustment is needed there. elbowL/R and kneeL/R are simple flexion
 * joints relative to whatever the parent limb is already doing, which is
 * how real elbows and knees work, so they need no adjustment either.
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
  // Total arm-forward ~45 deg; spine leans 15, so shoulder carries 30.
  ready: {
    spine: j(15 * DEG),
    shoulderL: j(30 * DEG, 0, 18 * DEG),
    elbowL: j(20 * DEG),
    shoulderR: j(30 * DEG, 0, -18 * DEG),
    elbowR: j(20 * DEG),
    hipL: j(18 * DEG, 0, 5 * DEG),
    kneeL: j(38 * DEG),
    hipR: j(18 * DEG, 0, -5 * DEG),
    kneeR: j(38 * DEG),
  },

  // Forearm-pass platform — arms extended forward and down together, low
  // wide stance, deep forward hip-hinge. Total arm-forward ~75; spine
  // leans 28, so shoulder carries 47. Reference: a real passer's platform
  // sits roughly in line with (or a touch below) the leaning torso.
  passLow: {
    spine: j(28 * DEG),
    shoulderL: j(47 * DEG, 0, 6 * DEG),
    elbowL: j(4 * DEG),
    shoulderR: j(47 * DEG, 0, -6 * DEG),
    elbowR: j(4 * DEG),
    hipL: j(25 * DEG, 0, 8 * DEG),
    kneeL: j(48 * DEG),
    hipR: j(25 * DEG, 0, -8 * DEG),
    kneeR: j(48 * DEG),
  },

  // Overhead pass — hands up in front of the forehead, elbows starting to
  // flare. Total ~108 (arms raised well past horizontal); spine leans 6.
  passHigh: {
    spine: j(6 * DEG),
    shoulderL: j(102 * DEG, 0, 15 * DEG),
    elbowL: j(85 * DEG),
    shoulderR: j(102 * DEG, 0, -15 * DEG),
    elbowR: j(85 * DEG),
    hipL: j(14 * DEG),
    kneeL: j(28 * DEG),
    hipR: j(14 * DEG),
    kneeR: j(28 * DEG),
  },

  // Classic set — hands above the forehead forming the window, elbows out
  // wide. Total ~100; spine leans 4.
  set: {
    spine: j(4 * DEG),
    shoulderL: j(96 * DEG, 0, 35 * DEG),
    elbowL: j(95 * DEG),
    shoulderR: j(96 * DEG, 0, -35 * DEG),
    elbowR: j(95 * DEG),
    hipL: j(12 * DEG),
    kneeL: j(24 * DEG),
    hipR: j(12 * DEG),
    kneeR: j(24 * DEG),
  },

  // Same hands as `set`, legs trailing/extended — airborne jump set.
  jumpSet: {
    spine: j(2 * DEG),
    shoulderL: j(98 * DEG, 0, 30 * DEG),
    elbowL: j(90 * DEG),
    shoulderR: j(98 * DEG, 0, -30 * DEG),
    elbowR: j(90 * DEG),
    hipL: j(-10 * DEG),
    kneeL: j(15 * DEG),
    hipR: j(-10 * DEG),
    kneeR: j(15 * DEG),
  },

  // Running stride, contralateral arm/leg swing: left leg drives forward,
  // right arm swings forward to match (opposite arm/leg, real running
  // form); right leg and left arm trail behind.
  approach: {
    spine: j(10 * DEG, 8 * DEG),
    shoulderL: j(45 * DEG, 0, 8 * DEG),
    elbowL: j(70 * DEG),
    shoulderR: j(-55 * DEG, 0, -8 * DEG),
    elbowR: j(60 * DEG),
    hipL: j(30 * DEG),
    kneeL: j(20 * DEG),
    hipR: j(-45 * DEG),
    kneeR: j(70 * DEG),
  },

  // Pre-jump load — deep crouch, arms swing down and back to counter-swing
  // upward on takeoff. Total arm-back ~-60; spine leans forward 25 (hip
  // hinge), so shoulder carries the rest of the backward swing, -85.
  load: {
    spine: j(25 * DEG),
    shoulderL: j(-85 * DEG, 0, 10 * DEG),
    elbowL: j(15 * DEG),
    shoulderR: j(-85 * DEG, 0, -10 * DEG),
    elbowR: j(15 * DEG),
    hipL: j(35 * DEG),
    kneeL: j(75 * DEG),
    hipR: j(35 * DEG),
    kneeR: j(75 * DEG),
  },

  // Contact moment — hitting arm (right) raised high and forward at the
  // measured optimal ~165 deg shoulder angle, off arm (left) down and
  // out for balance, airborne with legs trailing back.
  attack: {
    spine: j(-10 * DEG, -10 * DEG),
    shoulderL: j(30 * DEG, 0, 25 * DEG),
    elbowL: j(30 * DEG),
    shoulderR: j(175 * DEG, 0, -10 * DEG),
    elbowR: j(15 * DEG),
    hipL: j(-15 * DEG),
    kneeL: j(15 * DEG),
    hipR: j(-15 * DEG),
    kneeR: j(15 * DEG),
  },

  // After the swing — hitting arm snaps down and across the body, landing
  // crouch.
  followThrough: {
    spine: j(15 * DEG, 25 * DEG),
    shoulderL: j(-45 * DEG, 0, -15 * DEG),
    elbowL: j(20 * DEG),
    shoulderR: j(-35 * DEG, 0, 30 * DEG),
    elbowR: j(45 * DEG),
    hipL: j(25 * DEG),
    kneeL: j(45 * DEG),
    hipR: j(25 * DEG),
    kneeR: j(45 * DEG),
  },

  // Both arms straight up and slightly forward together (penetrating over
  // the net, per coaching technique — not straight overhead), legs
  // together and extended, airborne.
  block: {
    spine: j(-5 * DEG),
    shoulderL: j(178 * DEG, 0, 8 * DEG),
    elbowL: j(5 * DEG),
    shoulderR: j(178 * DEG, 0, -8 * DEG),
    elbowR: j(5 * DEG),
    hipL: j(-5 * DEG),
    kneeL: j(8 * DEG),
    hipR: j(-5 * DEG),
    kneeR: j(8 * DEG),
  },

  // The reference stance — low, wide, arms extended forward and down
  // together, deep forward lean over bent knees. Total arm-forward ~85;
  // spine leans 45 (a genuinely deep dig lean), shoulder carries 40.
  dig: {
    spine: j(45 * DEG),
    shoulderL: j(40 * DEG, 0, 6 * DEG),
    elbowL: j(3 * DEG),
    shoulderR: j(40 * DEG, 0, -6 * DEG),
    elbowR: j(3 * DEG),
    hipL: j(30 * DEG, 0, 10 * DEG),
    kneeL: j(60 * DEG),
    hipR: j(30 * DEG, 0, -10 * DEG),
    kneeR: j(60 * DEG),
  },

  // Emergency dive — one leg extended out to the side, reaching low and
  // forward with the lead arm; trailing arm out for balance.
  sprawl: {
    spine: j(55 * DEG, 15 * DEG),
    shoulderL: j(-35 * DEG, 0, 60 * DEG),
    elbowL: j(40 * DEG),
    shoulderR: j(45 * DEG, 0, -20 * DEG),
    elbowR: j(10 * DEG),
    hipL: j(10 * DEG, 0, 45 * DEG),
    kneeL: j(10 * DEG),
    hipR: j(20 * DEG),
    kneeR: j(30 * DEG),
  },

  // Toss arm raised overhead holding the ball, hitting arm cocked back,
  // standing tall.
  serveToss: {
    spine: j(-8 * DEG),
    shoulderL: j(173 * DEG, 0, 10 * DEG),
    elbowL: j(8 * DEG),
    shoulderR: j(23 * DEG, 0, -15 * DEG),
    elbowR: j(15 * DEG),
    hipL: j(0),
    kneeL: j(8 * DEG),
    hipR: j(-10 * DEG),
    kneeR: j(8 * DEG),
  },

  // Toss arm dropped, hitting arm extended up and forward at contact
  // (matching the ~165 deg measured optimal spike/serve contact angle),
  // slight jump.
  serveContact: {
    spine: j(-15 * DEG, -10 * DEG),
    shoulderL: j(-5 * DEG, 0, 15 * DEG),
    elbowL: j(20 * DEG),
    shoulderR: j(175 * DEG, 0, -8 * DEG),
    elbowR: j(10 * DEG),
    hipL: j(-15 * DEG),
    kneeL: j(12 * DEG),
    hipR: j(-15 * DEG),
    kneeR: j(12 * DEG),
  },

  // Relaxed repositioning between contacts — upright, arms loose.
  transition: {
    spine: j(5 * DEG),
    shoulderL: j(15 * DEG, 0, 12 * DEG),
    elbowL: j(12 * DEG),
    shoulderR: j(15 * DEG, 0, -12 * DEG),
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
