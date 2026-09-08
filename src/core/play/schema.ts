import { z } from 'zod';
import type { Play } from './types';

/**
 * A Zod mirror of core/play/types.ts, for validating a Play coming back out
 * of localStorage — untyped JSON that was written by some earlier version
 * of this app (possibly a future one, possibly corrupted by hand-editing
 * devtools, possibly just stale). `zod` has been an installed dependency
 * since Phase 2 but was never actually used anywhere until this file.
 */

const sideSchema = z.enum(['A', 'B']);
const zoneNumberSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]);
const playerRoleSchema = z.enum(['S', 'OPP', 'OH', 'MB', 'L', 'DS']);
const easingIdSchema = z.enum(['linear', 'easeInOutQuad', 'easeInOutCubic', 'approachRamp']);
const poseIdSchema = z.enum([
  'idle',
  'ready',
  'passLow',
  'passHigh',
  'set',
  'jumpSet',
  'approach',
  'load',
  'attack',
  'followThrough',
  'block',
  'dig',
  'sprawl',
  'serveToss',
  'serveContact',
  'transition',
  'bench',
]);
const ballProfileIdSchema = z.enum([
  'floatServe',
  'jumpServe',
  'pass',
  'dig',
  'roll',
  'free',
  'quick',
  '31',
  'shoot',
  'go',
  'high',
  'pipe',
  'bic',
  'attack',
  'tip',
  'block',
]);
const movementModeSchema = z.enum(['sprint', 'run', 'shuffle', 'backpedal', 'approach', 'crossover', 'hold']);

const localPosSchema = z.object({ lat: z.number(), depth: z.number() });

const playerRefSchema = z.discriminatedUnion('kind', [
  z.object({ side: sideSchema, kind: z.literal('slot'), index: z.number() }),
  z.object({ side: sideSchema, kind: z.literal('role'), role: playerRoleSchema, ordinal: z.union([z.literal(1), z.literal(2)]).optional() }),
  z.object({ side: sideSchema, kind: z.literal('zone'), zone: zoneNumberSchema }),
  z.object({ side: sideSchema, kind: z.literal('libero') }),
]);

const positionRefSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('local'), side: sideSchema, pos: localPosSchema, y: z.number().optional() }),
  z.object({ kind: z.literal('zoneAnchor'), side: sideSchema, zone: zoneNumberSchema, y: z.number().optional() }),
  z.object({ kind: z.literal('atPlayer'), who: playerRefSchema, contact: z.enum(['feet', 'platform', 'hands', 'reach']).optional() }),
  z.object({ kind: z.literal('ballAt'), t: z.literal('segmentEnd') }),
]);

const movementSchema = z.object({
  who: playerRefSchema,
  to: positionRefSchema,
  via: z.array(positionRefSchema).optional(),
  startOffset: z.number().optional(),
  duration: z.number().optional(),
  easing: easingIdSchema.optional(),
  mode: movementModeSchema.optional(),
  pose: poseIdSchema.optional(),
  facing: z.union([z.object({ atPlayer: playerRefSchema }), z.object({ rad: z.number() })]).optional(),
  jump: z.object({ atT: z.number(), heightM: z.number(), hangS: z.number() }).optional(),
});

const ballSegmentSchema = z.object({
  kind: z.enum(['serve', 'pass', 'set', 'attack', 'tip', 'roll', 'block', 'dig', 'free']),
  profile: ballProfileIdSchema.optional(),
  from: positionRefSchema,
  to: positionRefSchema,
  apexM: z.number().optional(),
  apexU: z.number().optional(),
  startOffset: z.number().optional(),
  duration: z.number().optional(),
});

const playStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  duration: z.number(),
  ball: ballSegmentSchema.optional(),
  movements: z.array(movementSchema),
});

const playScenarioSchema = z.object({
  lineupIds: z.object({ A: z.string(), B: z.string() }),
  rotations: z.object({ A: z.number(), B: z.number() }),
});

const initialPlayerStateSchema = z.object({
  who: playerRefSchema,
  pos: localPosSchema,
  pose: poseIdSchema.optional(),
  facingRad: z.number().optional(),
});

const initialFormationSchema = z.object({
  players: z.array(initialPlayerStateSchema),
  ball: z.object({ side: sideSchema, pos: localPosSchema, y: z.number().optional(), heldBy: playerRefSchema.optional() }),
});

const playSchemaV1 = z.object({
  id: z.string(),
  name: z.string(),
  schemaVersion: z.literal(1),
  scenario: playScenarioSchema,
  initial: initialFormationSchema,
  serveContactStepId: z.string().optional(),
  steps: z.array(playStepSchema),
});

/** Validates a single, already-current-version Play. Returns null (not a thrown error) on failure — a bad localStorage entry should be silently dropped, not crash the app. */
export const parsePlay = (data: unknown): Play | null => {
  const result = playSchemaV1.safeParse(data);
  return result.success ? (result.data as Play) : null;
};

/**
 * Migrates a raw parsed JSON value to the current schema version before
 * validating it. Only schemaVersion 1 exists today, so this is a straight
 * passthrough to parsePlay — but it's structured with an explicit
 * version-branch switch so a real future migration (e.g. a schemaVersion 2
 * that renames or restructures a field) has an obvious slot to fill in,
 * instead of the loader needing to be rewritten from scratch when that day
 * comes. Deliberately out of scope beyond this: no versioned migration
 * chain exists yet because there's nothing to migrate FROM yet.
 */
export const migratePlay = (data: unknown): Play | null => {
  if (typeof data !== 'object' || data === null || !('schemaVersion' in data)) return null;
  const version = (data as { schemaVersion: unknown }).schemaVersion;
  switch (version) {
    case 1:
      return parsePlay(data);
    default:
      return null;
  }
};
