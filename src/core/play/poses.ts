/**
 * Opaque pose identifiers shared by the domain and the renderer. The
 * domain only ever refers to a pose by this id — the actual joint
 * geometry lives in render/players/poseRig.ts, so this file stays pure
 * and the visual style stays swappable without touching play logic.
 */
export type PoseId =
  | 'idle'
  | 'ready'
  | 'passLow'
  | 'passHigh'
  | 'set'
  | 'jumpSet'
  | 'approach'
  | 'load'
  | 'attack'
  | 'followThrough'
  | 'block'
  | 'dig'
  | 'sprawl'
  | 'serveToss'
  | 'serveContact'
  | 'transition'
  | 'bench';

export const ALL_POSES: readonly PoseId[] = [
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
];
