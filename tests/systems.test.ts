import { describe, expect, it } from 'vitest';
import { breakdown, validateLineupComposition } from '@/core/lineup/systems';
import type { Lineup } from '@/core/lineup/types';
import type { Roster } from '@/core/roster/types';

// Serve order: S, OH1, MB1, [OPP or S2], OH2, MB2 — setter/opposite (or the
// two setters in 6-2/4-2) sit 3 apart in slots, same for each OH/MB pair.
const rosterWith = (fourthRole: 'OPP' | 'S'): Roster => ({
  id: 'r1',
  name: 'Test roster',
  players: [
    { id: 'p1', name: 'Setter', number: 1, primaryRole: 'S', handedness: 'R' },
    { id: 'p2', name: 'OH1', number: 2, primaryRole: 'OH', handedness: 'R' },
    { id: 'p3', name: 'MB1', number: 3, primaryRole: 'MB', handedness: 'R' },
    { id: 'p4', name: 'Fourth', number: 4, primaryRole: fourthRole, handedness: 'R' },
    { id: 'p5', name: 'OH2', number: 5, primaryRole: 'OH', handedness: 'R' },
    { id: 'p6', name: 'MB2', number: 6, primaryRole: 'MB', handedness: 'R' },
  ],
});

const lineupWith = (system: Lineup['system']): Lineup => ({
  id: 'l1',
  name: 'Test lineup',
  rosterId: 'r1',
  system,
  order: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'],
  liberos: [],
  playerCount: 6,
});

describe('lineup breakdown', () => {
  it('5-1: setter is front row in exactly 3 of 6 rotations, dropping to 2 front-row attackers there', () => {
    const roster = rosterWith('OPP');
    const lineup = lineupWith('5-1');
    const expectedSetterRow: Array<'front' | 'back'> = ['back', 'back', 'back', 'front', 'front', 'front'];
    const expectedAttackers = [3, 3, 3, 2, 2, 2];

    for (let rotation = 0; rotation < 6; rotation++) {
      const b = breakdown(lineup, roster, 'A', rotation);
      expect(b.setterRow).toBe(expectedSetterRow[rotation]);
      expect(b.frontRowAttackerCount).toBe(expectedAttackers[rotation]);
    }
  });

  it('6-2: the back-row setter always runs the offense, leaving 3 front-row attackers every rotation', () => {
    const roster = rosterWith('S');
    const lineup = lineupWith('6-2');

    for (let rotation = 0; rotation < 6; rotation++) {
      const b = breakdown(lineup, roster, 'A', rotation);
      expect(b.setterRow).toBe('back');
      expect(b.frontRowAttackerCount).toBe(3);
    }
  });

  it('4-2: the front-row setter always sets, leaving 2 front-row attackers every rotation', () => {
    const roster = rosterWith('S');
    const lineup = lineupWith('4-2');

    for (let rotation = 0; rotation < 6; rotation++) {
      const b = breakdown(lineup, roster, 'A', rotation);
      expect(b.setterRow).toBe('front');
      expect(b.frontRowAttackerCount).toBe(2);
    }
  });

  it('server is always whoever currently occupies zone 1', () => {
    const roster = rosterWith('OPP');
    const lineup = lineupWith('5-1');
    for (let rotation = 0; rotation < 6; rotation++) {
      const b = breakdown(lineup, roster, 'A', rotation);
      const server = b.onCourt.find((p) => p.onCourtId === b.serverOnCourtId);
      expect(server?.zone).toBe(1);
    }
  });

  it('a well-formed 5-1 order (S/OPP, OH, MB each 3 apart) has no composition warnings', () => {
    const roster = rosterWith('OPP');
    const lineup = lineupWith('5-1');
    expect(validateLineupComposition(lineup, roster)).toHaveLength(0);
  });

  it('flags a setter/opposite pairing that is not 3 apart in serve order', () => {
    const roster = rosterWith('OPP');
    const lineup: Lineup = { ...lineupWith('5-1'), order: ['p1', 'p4', 'p3', 'p2', 'p5', 'p6'] };
    const warnings = validateLineupComposition(lineup, roster);
    expect(warnings.some((w) => w.code === 'SETTER_OPPOSITE_NOT_OPPOSITE')).toBe(true);
  });

  it('drops to null zones when playerCount is not 6 (drill mode)', () => {
    const roster = rosterWith('OPP');
    const lineup: Lineup = { ...lineupWith('5-1'), playerCount: 5 };
    const b = breakdown(lineup, roster, 'A', 0);
    expect(b.onCourt.every((p) => p.zone === null && p.row === null && !p.isServer)).toBe(true);
  });
});
