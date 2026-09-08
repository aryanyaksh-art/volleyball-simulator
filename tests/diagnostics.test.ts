import { describe, expect, it } from 'vitest';
import { compilePlay } from '@/core/play/compile';
import { diagnosePlay, hasErrors } from '@/core/play/diagnostics';
import type { Play } from '@/core/play/types';
import type { Roster } from '@/core/roster/types';
import type { Lineup } from '@/core/lineup/types';

const roster = (side: 'A' | 'B'): Roster => ({
  id: `roster-${side}`,
  name: side,
  players: [
    { id: `${side}-S`, name: 'Setter', number: 1, primaryRole: 'S', handedness: 'R' },
    { id: `${side}-OH1`, name: 'OH1', number: 2, primaryRole: 'OH', handedness: 'R' },
    { id: `${side}-MB1`, name: 'MB1', number: 3, primaryRole: 'MB', handedness: 'R' },
    { id: `${side}-OPP`, name: 'OPP', number: 4, primaryRole: 'OPP', handedness: 'R' },
    { id: `${side}-OH2`, name: 'OH2', number: 5, primaryRole: 'OH', handedness: 'R' },
    { id: `${side}-MB2`, name: 'MB2', number: 6, primaryRole: 'MB', handedness: 'R' },
  ],
});

const lineup = (side: 'A' | 'B'): Lineup => ({
  id: `lineup-${side}`,
  name: side,
  rosterId: `roster-${side}`,
  system: '5-1',
  order: [`${side}-S`, `${side}-OH1`, `${side}-MB1`, `${side}-OPP`, `${side}-OH2`, `${side}-MB2`],
  liberos: [],
  playerCount: 6,
});

const ctx = {
  rosters: { A: roster('A'), B: roster('B') },
  lineups: { A: lineup('A'), B: lineup('B') },
};

const basePlay = (): Play => ({
  id: 'diag-test',
  name: 'Diagnostics test',
  schemaVersion: 1,
  scenario: { lineupIds: { A: 'lineup-A', B: 'lineup-B' }, rotations: { A: 0, B: 0 } },
  initial: { players: [], ball: { side: 'A', pos: { lat: 0, depth: 8 }, y: 1.2 } },
  steps: [
    {
      id: 'step1',
      name: 'Step 1',
      duration: 1.0,
      movements: [
        {
          who: { side: 'A', kind: 'zone', zone: 4 },
          to: { kind: 'local', side: 'A', pos: { lat: -2.9, depth: 1.5 } },
          mode: 'shuffle',
        },
      ],
    },
  ],
});

describe('diagnosePlay: speed-cap violations', () => {
  it('flags a move no human could make in the time given', () => {
    const play = basePlay();
    play.steps[0].movements[0] = {
      who: { side: 'A', kind: 'zone', zone: 4 },
      to: { kind: 'local', side: 'A', pos: { lat: -3, depth: 9 } }, // ~6+ m away
      mode: 'sprint',
      duration: 0.3, // way under the 6.5 m/s sprint cap for that distance
    };
    const schedule = compilePlay(play, ctx);
    const diagnostics = diagnosePlay(schedule);

    expect(diagnostics.speedCapViolations.length).toBeGreaterThan(0);
    expect(diagnostics.speedCapViolations[0].onCourtId).toBe('A:3'); // zone 4 at rotation 0 is slot 3
    expect(hasErrors(diagnostics)).toBe(true);
  });

  it('does not flag a move within the mode cap', () => {
    const schedule = compilePlay(basePlay(), ctx);
    const diagnostics = diagnosePlay(schedule);
    expect(diagnostics.speedCapViolations).toHaveLength(0);
  });

  it('does not flag hold segments (players not given a movement)', () => {
    const schedule = compilePlay(basePlay(), ctx);
    const diagnostics = diagnosePlay(schedule);
    // Every other on-court player just holds this step — none should ever appear.
    const flaggedIds = new Set(diagnostics.speedCapViolations.map((v) => v.onCourtId));
    expect(flaggedIds.has('A:0')).toBe(false);
    expect(flaggedIds.has('B:0')).toBe(false);
  });
});

describe('diagnosePlay: ball flight issues', () => {
  it('flags a serve that would clip the net', () => {
    const play = basePlay();
    play.serveContactStepId = 'step1';
    play.steps[0].ball = {
      kind: 'serve',
      from: { kind: 'local', side: 'A', pos: { lat: 0, depth: 9 }, y: 1.0 },
      to: { kind: 'local', side: 'B', pos: { lat: 0, depth: 9 }, y: 1.0 },
      apexM: 1.0, // well below net height (2.43m) the whole way
    };
    const schedule = compilePlay(play, ctx);
    const diagnostics = diagnosePlay(schedule);
    expect(diagnostics.ballFlightIssues.some((i) => i.code === 'BALL_INTO_NET')).toBe(true);
    expect(hasErrors(diagnostics)).toBe(true);
  });

  it('a clean serve produces no ball flight issues', () => {
    const play = basePlay();
    play.serveContactStepId = 'step1';
    play.steps[0].ball = {
      kind: 'serve',
      from: { kind: 'local', side: 'A', pos: { lat: 0, depth: 9 }, y: 1.2 },
      to: { kind: 'local', side: 'B', pos: { lat: 0, depth: 6 }, y: 0 },
      // 3.6, not 3.0: the net crossing here falls just past the apex, in the
      // descending half. ballFlight.ts's height ramp is a straight line on
      // each side now (uniform speed, not an easing parabola that lingers
      // near the top), so it loses height faster right after the peak than
      // the old curve did — 3.0 cleared the net under the old shape but
      // clips it under this one. A real coach retuning a marginal play
      // after this change would do the same thing: raise the apex a bit.
      apexM: 3.6,
    };
    const schedule = compilePlay(play, ctx);
    const diagnostics = diagnosePlay(schedule);
    expect(diagnostics.ballFlightIssues).toHaveLength(0);
    expect(hasErrors(diagnostics)).toBe(false);
  });

  it('does not check landing for a non-terminal contact like a pass', () => {
    const play = basePlay();
    play.steps[0].ball = {
      kind: 'pass',
      from: { kind: 'local', side: 'A', pos: { lat: 0, depth: 1 }, y: 1.0 },
      to: { kind: 'local', side: 'A', pos: { lat: 6, depth: 20 }, y: 1.5 }, // wildly out, but a pass isn't a terminal contact
      apexM: 2.0,
    };
    const schedule = compilePlay(play, ctx);
    const diagnostics = diagnosePlay(schedule);
    expect(diagnostics.ballFlightIssues.some((i) => i.code === 'BALL_OUT')).toBe(false);
  });
});
