import type { LocalPos, Side } from '@/core/court/coordinates';
import { toLocal, toWorld } from '@/core/court/coordinates';
import type { ZoneNumber } from '@/core/court/zones';
import type { Vec3 } from '@/core/math/vec';
import type { LineupBreakdown } from '@/core/lineup/systems';
import type { Roster } from '@/core/roster/types';
import { findPlayer, hasRole } from '@/core/roster/types';
import { effectivePosition } from '@/core/court/anchors';
import type { PlayerRef, PositionRef } from './types';

export interface RefContext {
  breakdowns: Record<Side, LineupBreakdown>;
  rosters: Record<Side, Roster>;
  positions: Record<Side, Partial<Record<ZoneNumber, LocalPos>>>;
}

/**
 * A point-in-time snapshot compile.ts carries forward while walking steps
 * sequentially: every on-court player's current position (in their own
 * side's local frame) and the ball's current world position. `atPlayer` and
 * `ballAt` refs resolve against whatever this snapshot holds at the start
 * of the step being compiled — not "wherever they'll end up this same
 * step" — which keeps ref resolution a single deterministic pass instead of
 * needing iterative fixpoint solving.
 */
export interface RefSnapshot {
  positions: Record<string, LocalPos>; // by onCourtId, local to that player's own side
  ballWorldPos: Vec3 | null;
}

export const resolvePlayerRef = (ref: PlayerRef, ctx: RefContext): string | null => {
  const breakdown = ctx.breakdowns[ref.side];
  const roster = ctx.rosters[ref.side];

  if (ref.kind === 'slot') {
    return breakdown.onCourt.find((p) => p.slot === ref.index)?.onCourtId ?? null;
  }
  if (ref.kind === 'zone') {
    return breakdown.onCourt.find((p) => p.zone === ref.zone)?.onCourtId ?? null;
  }
  if (ref.kind === 'libero') {
    return breakdown.onCourt.find((p) => p.isLibero)?.onCourtId ?? null;
  }
  // role
  const matches = breakdown.onCourt
    .filter((p) => hasRole(findPlayer(roster, p.playerId), ref.role))
    .sort((a, b) => a.slot - b.slot);
  const ordinal = ref.ordinal ?? 1;
  return matches[ordinal - 1]?.onCourtId ?? null;
};

/** Resolves a PositionRef into a LocalPos expressed in `sideContext`'s own frame. */
export const resolvePositionRef = (
  ref: PositionRef,
  sideContext: Side,
  ctx: RefContext,
  snapshot: RefSnapshot,
): LocalPos | null => {
  switch (ref.kind) {
    case 'local': {
      if (ref.side === sideContext) return ref.pos;
      return toLocal(toWorld(ref.pos, ref.side, 0), sideContext);
    }
    case 'zoneAnchor': {
      const pos = effectivePosition(ref.zone, ctx.positions[ref.side]);
      return ref.side === sideContext ? pos : toLocal(toWorld(pos, ref.side, 0), sideContext);
    }
    case 'atPlayer': {
      const onCourtId = resolvePlayerRef(ref.who, ctx);
      if (!onCourtId) return null;
      const pos = snapshot.positions[onCourtId];
      if (!pos) return null;
      return ref.who.side === sideContext ? pos : toLocal(toWorld(pos, ref.who.side, 0), sideContext);
    }
    case 'ballAt': {
      if (!snapshot.ballWorldPos) return null;
      return toLocal(snapshot.ballWorldPos, sideContext);
    }
  }
};

/**
 * Approximate contact heights, in meters, for `atPlayer` position refs.
 * `reach` means a jumping attacker's contact point (well above net height,
 * not a standing reach) — used for both a set's arrival point and an
 * attack's origin, since those are physically the same point.
 */
export const CONTACT_HEIGHT_M: Record<NonNullable<Extract<PositionRef, { kind: 'atPlayer' }>['contact']>, number> = {
  feet: 0,
  platform: 0.9,
  hands: 1.9,
  reach: 3.0,
};

/**
 * World-space yaw (radians) for a player standing at `fromWorld` to face
 * `who` — the `Movement.facing = { atPlayer }` option. Derived from
 * Three.js's standard, unmodified Y-axis rotation matrix on `root.rotation.y`
 * (PlayerVisual.setFacing sets it directly, no correction layered on top,
 * unlike the pose rig's joint rotations): rotY(theta) maps a local +Z unit
 * vector to the world direction (sin(theta), 0, cos(theta)). That's
 * consistent with the already-established defaultFacing convention in
 * compile.ts (side A, sitting at positive world z, faces the net at
 * theta=PI, i.e. -Z; side B faces it at theta=0, i.e. +Z) — both anchor
 * points land exactly on this formula, so this rig's forward axis is local
 * +Z. Solving sin(theta)=dx/r, cos(theta)=dz/r for an arbitrary direction
 * gives theta = atan2(dx, dz). Returns null if the target can't be resolved
 * or the two points coincide (no defined direction to face).
 */
export const resolveFacingToward = (
  fromWorld: Vec3,
  who: PlayerRef,
  ctx: RefContext,
  snapshot: RefSnapshot,
): number | null => {
  const onCourtId = resolvePlayerRef(who, ctx);
  const pos = onCourtId ? snapshot.positions[onCourtId] : null;
  if (!pos) return null;
  const targetWorld = toWorld(pos, who.side, 0);
  const dx = targetWorld.x - fromWorld.x;
  const dz = targetWorld.z - fromWorld.z;
  if (Math.abs(dx) < 1e-9 && Math.abs(dz) < 1e-9) return null;
  return Math.atan2(dx, dz);
};

/**
 * Resolves a PositionRef to a world-space point — used for the ball, which
 * (unlike a player) inherently crosses between sides, so there's no single
 * "local frame" to express it in.
 */
export const resolvePositionToWorld = (ref: PositionRef, ctx: RefContext, snapshot: RefSnapshot): Vec3 => {
  switch (ref.kind) {
    case 'local':
      return toWorld(ref.pos, ref.side, ref.y ?? 0);
    case 'zoneAnchor':
      return toWorld(effectivePosition(ref.zone, ctx.positions[ref.side]), ref.side, ref.y ?? 0);
    case 'atPlayer': {
      const onCourtId = resolvePlayerRef(ref.who, ctx);
      const pos = onCourtId ? snapshot.positions[onCourtId] : null;
      if (!pos) return { x: 0, y: 0, z: 0 };
      return toWorld(pos, ref.who.side, CONTACT_HEIGHT_M[ref.contact ?? 'feet']);
    }
    case 'ballAt':
      return snapshot.ballWorldPos ?? { x: 0, y: 0, z: 0 };
  }
};
