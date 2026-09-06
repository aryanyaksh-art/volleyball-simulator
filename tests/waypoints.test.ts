import { describe, expect, it } from 'vitest';
import { compilePlay } from '@/core/play/compile';
import { evaluateInto } from '@/core/play/evaluate';
import { createWorldState } from '@/core/play/schedule';
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

// Zone 4 (slot 3) starts at ZONE_BASE {lat:-3, depth:1.6}. Two waypoints at
// depth 2.6 and 5.6 split the move to depth 7.6 into three legs: 1m, 3m,
// 2m — 6m total.
const buildPlay = (): Play => ({
  id: 'waypoint-test',
  name: 'Waypoint test',
  schemaVersion: 1,
  scenario: { lineupIds: { A: 'lineup-A', B: 'lineup-B' }, rotations: { A: 0, B: 0 } },
  initial: { players: [], ball: { side: 'A', pos: { lat: 0, depth: 8 }, y: 1.2 } },
  steps: [
    {
      id: 'step1',
      name: 'Route around',
      duration: 3.0,
      movements: [
        {
          who: { side: 'A', kind: 'zone', zone: 4 },
          to: { kind: 'local', side: 'A', pos: { lat: -3, depth: 7.6 } },
          via: [
            { kind: 'local', side: 'A', pos: { lat: -3, depth: 2.6 } },
            { kind: 'local', side: 'A', pos: { lat: -3, depth: 5.6 } },
          ],
          mode: 'run',
        },
      ],
    },
  ],
});

const MOVER_ID = 'A:3'; // zone 4 at rotation 0 is slot 3

describe('compilePlay: via waypoints', () => {
  it('splits a movement with N waypoints into N+1 contiguous legs', () => {
    const schedule = compilePlay(buildPlay(), ctx);
    const legs = schedule.playerTracks[MOVER_ID];
    expect(legs).toHaveLength(3);

    expect(legs[0].startS).toBeCloseTo(0, 10);
    for (let i = 1; i < legs.length; i++) {
      expect(legs[i].startS).toBeCloseTo(legs[i - 1].endS, 10);
    }
    expect(legs[legs.length - 1].endS).toBeCloseTo(3.0, 10);
  });

  it('each leg runs from one waypoint to the next, ending exactly at the final target', () => {
    const schedule = compilePlay(buildPlay(), ctx);
    const legs = schedule.playerTracks[MOVER_ID];

    expect(legs[0].from).toEqual({ lat: -3, depth: 1.6 });
    expect(legs[0].to).toEqual({ lat: -3, depth: 2.6 });
    expect(legs[1].to).toEqual({ lat: -3, depth: 5.6 });
    expect(legs[2].to).toEqual({ lat: -3, depth: 7.6 });
  });

  it('allocates leg duration proportional to leg distance (1m : 3m : 2m of 6m total)', () => {
    const schedule = compilePlay(buildPlay(), ctx);
    const legs = schedule.playerTracks[MOVER_ID];
    const [leg1, leg2, leg3] = legs.map((l) => l.endS - l.startS);

    expect(leg1).toBeCloseTo(3.0 * (1 / 6), 10);
    expect(leg2).toBeCloseTo(3.0 * (3 / 6), 10);
    expect(leg3).toBeCloseTo(3.0 * (2 / 6), 10);
  });

  it('only rotates facing during the final leg, holding steady through transit', () => {
    const schedule = compilePlay(buildPlay(), ctx);
    const legs = schedule.playerTracks[MOVER_ID];
    expect(legs[0].facingFromRad).toBe(legs[0].facingToRad);
    expect(legs[1].facingFromRad).toBe(legs[1].facingToRad);
  });

  it('evaluated position passes exactly through each waypoint at its leg boundary', () => {
    const schedule = compilePlay(buildPlay(), ctx);
    const legs = schedule.playerTracks[MOVER_ID];
    const out = createWorldState();

    evaluateInto(schedule, legs[0].endS, out);
    const atFirstWaypoint = out.players.find((p) => p.onCourtId === MOVER_ID)!;
    expect(atFirstWaypoint.pos).toEqual({ lat: -3, depth: 2.6 });

    evaluateInto(schedule, legs[1].endS, out);
    const atSecondWaypoint = out.players.find((p) => p.onCourtId === MOVER_ID)!;
    expect(atSecondWaypoint.pos).toEqual({ lat: -3, depth: 5.6 });
  });

  it('with no via, behaves exactly like a single straight-line leg', () => {
    const play = buildPlay();
    play.steps[0].movements[0].via = undefined;
    const schedule = compilePlay(play, ctx);
    expect(schedule.playerTracks[MOVER_ID]).toHaveLength(1);
  });
});
