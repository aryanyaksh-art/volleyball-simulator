import type { Side } from '@/core/court/coordinates';
import type { ZoneNumber } from '@/core/court/zones';
import { rowOfZone } from '@/core/court/zones';
import type { Roster } from '@/core/roster/types';
import { findPlayer, hasRole } from '@/core/roster/types';
import type { Lineup, OnCourtPlayer } from './types';
import { zoneOfSlot } from './rotation';

/**
 * Everything about a lineup at a given rotation is derived here, never
 * stored: which roster player sits in which zone (with libero substitution
 * applied), who is functionally "the setter" this rotation, how many
 * front-row attackers that leaves, and who serves.
 */
export interface LineupBreakdown {
  side: Side;
  rotation: number;
  onCourt: OnCourtPlayer[];
  setterOnCourtId: string | null;
  setterZone: ZoneNumber | null;
  setterRow: 'front' | 'back' | null;
  /** Front-row players other than the functional setter. */
  frontRowAttackerCount: number;
  serverOnCourtId: string | null;
}

const resolvePlayerId = (lineup: Lineup, rotation: number, slot: number): { playerId: string | null; isLibero: boolean } => {
  const basePlayerId = lineup.order[slot];
  const assignment = lineup.liberos.find((l) => l.replacesSlot === slot);
  if (!assignment || basePlayerId == null) return { playerId: basePlayerId, isLibero: false };
  const zone = zoneOfSlot(rotation, slot);
  const inBackRow = rowOfZone(zone) === 'back';
  return inBackRow
    ? { playerId: assignment.liberoPlayerId, isLibero: true }
    : { playerId: basePlayerId, isLibero: false };
};

/** Which of the on-court candidates with an S role is functionally "the setter" this rotation. */
const pickFunctionalSetter = (lineup: Lineup, candidates: OnCourtPlayer[]): OnCourtPlayer | undefined => {
  if (candidates.length <= 1) return candidates[0];
  if (lineup.system === '6-2') return candidates.find((p) => p.row === 'back') ?? candidates[0];
  if (lineup.system === '4-2') return candidates.find((p) => p.row === 'front') ?? candidates[0];
  return candidates[0];
};

export const breakdown = (lineup: Lineup, roster: Roster, side: Side, rotation: number): LineupBreakdown => {
  const isSix = lineup.playerCount === 6;
  const onCourt: OnCourtPlayer[] = [];

  for (let slot = 0; slot < lineup.order.length && slot < 6; slot++) {
    if (lineup.order[slot] == null) continue;
    const zone = isSix ? zoneOfSlot(rotation, slot) : null;
    const { playerId, isLibero } = resolvePlayerId(lineup, rotation, slot);
    onCourt.push({
      onCourtId: `${side}:${slot}`,
      side,
      slot,
      playerId,
      zone,
      row: zone ? rowOfZone(zone) : null,
      isServer: zone === 1,
      isLibero,
    });
  }

  const setterCandidates = onCourt.filter((p) => hasRole(findPlayer(roster, p.playerId), 'S'));
  const setter = pickFunctionalSetter(lineup, setterCandidates);

  const frontRowCount = onCourt.filter((p) => p.row === 'front').length;
  const frontRowAttackerCount = frontRowCount - (setter?.row === 'front' ? 1 : 0);

  const server = onCourt.find((p) => p.isServer);

  return {
    side,
    rotation,
    onCourt,
    setterOnCourtId: setter?.onCourtId ?? null,
    setterZone: setter?.zone ?? null,
    setterRow: setter?.row ?? null,
    frontRowAttackerCount,
    serverOnCourtId: server?.onCourtId ?? null,
  };
};

export interface CompositionWarning {
  code: 'SETTER_OPPOSITE_NOT_OPPOSITE' | 'OH_NOT_OPPOSITE' | 'MB_NOT_OPPOSITE';
  message: string;
}

const slotsWithRole = (lineup: Lineup, roster: Roster, role: 'S' | 'OPP' | 'OH' | 'MB'): number[] => {
  const slots: number[] = [];
  lineup.order.forEach((playerId, slot) => {
    if (findPlayer(roster, playerId)?.primaryRole === role) slots.push(slot);
  });
  return slots;
};

/** Two slots are "3 apart in serve order" when they're always in opposite rows together. */
const threeApart = (slots: number[]): boolean => slots.length !== 2 || Math.abs(slots[0] - slots[1]) % 6 === 3;

/** Advisory checks only — a non-standard lineup is legal, just flagged. */
export const validateLineupComposition = (lineup: Lineup, roster: Roster): CompositionWarning[] => {
  const warnings: CompositionWarning[] = [];

  const sSlots = slotsWithRole(lineup, roster, 'S');
  const oppSlots = slotsWithRole(lineup, roster, 'OPP');
  if (sSlots.length === 1 && oppSlots.length === 1 && !threeApart([sSlots[0], oppSlots[0]])) {
    warnings.push({
      code: 'SETTER_OPPOSITE_NOT_OPPOSITE',
      message: 'Setter and opposite are not 3 apart in serve order.',
    });
  }
  if (!threeApart(slotsWithRole(lineup, roster, 'OH'))) {
    warnings.push({ code: 'OH_NOT_OPPOSITE', message: 'Outside hitters are not 3 apart in serve order.' });
  }
  if (!threeApart(slotsWithRole(lineup, roster, 'MB'))) {
    warnings.push({ code: 'MB_NOT_OPPOSITE', message: 'Middle blockers are not 3 apart in serve order.' });
  }

  return warnings;
};
