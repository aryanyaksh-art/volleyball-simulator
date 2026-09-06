import { describe, expect, it } from 'vitest';
import { compilePlay } from '@/core/play/compile';
import { evaluateInto } from '@/core/play/evaluate';
import { createWorldState } from '@/core/play/schedule';
import { ZONE_BASE } from '@/core/court/anchors';
import { toWorld } from '@/core/court/coordinates';
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

// Serve order slot 0 starts in zone 1 at rotation 0, so the server is "A:0".
const SERVER_ID = 'A:0';
const RECEIVER_ID = 'B:4'; // slot 4 starts in zone 5 at rotation 0

const buildPlay = (): Play => ({
  id: 'test-play',
  name: 'Test serve + pass',
  schemaVersion: 1,
  scenario: { lineupIds: { A: 'lineup-A', B: 'lineup-B' }, rotations: { A: 0, B: 0 } },
  initial: {
    players: [],
    ball: { side: 'A', pos: { lat: 3, depth: 9 }, y: 1.2 },
  },
  serveContactStepId: 'serve',
  steps: [
    {
      id: 'serve',
      name: 'Serve',
      duration: 1.0,
      ball: {
        kind: 'serve',
        from: { kind: 'local', side: 'A', pos: { lat: 3, depth: 9 }, y: 1.2 },
        to: { kind: 'zoneAnchor', side: 'B', zone: 5 },
        apexM: 3,
      },
      movements: [
        {
          who: { side: 'A', kind: 'zone', zone: 1 },
          to: { kind: 'local', side: 'A', pos: { lat: 3, depth: 8.5 } },
          pose: 'serveContact',
        },
      ],
    },
    {
      id: 'pass',
      name: 'Pass',
      duration: 1.0,
      movements: [
        {
          who: { side: 'B', kind: 'zone', zone: 5 },
          to: { kind: 'local', side: 'B', pos: { lat: -2, depth: 3 } },
          pose: 'passLow',
        },
      ],
    },
  ],
});

describe('compilePlay', () => {
  it('flattens steps into absolute-time tracks with the total duration summed', () => {
    const schedule = compilePlay(buildPlay(), ctx);
    expect(schedule.durationS).toBeCloseTo(2.0, 10);
  });

  it('resolves symbolic refs (zone/slot) to the right onCourtId and target position', () => {
    const schedule = compilePlay(buildPlay(), ctx);
    const serverTrack = schedule.playerTracks[SERVER_ID];
    expect(serverTrack).toBeDefined();
    expect(serverTrack[0].to).toEqual({ lat: 3, depth: 8.5 });

    const receiverTrack = schedule.playerTracks[RECEIVER_ID];
    // Holds through the serve step, then moves during the pass step.
    expect(receiverTrack[0].from).toEqual(receiverTrack[0].to);
    expect(receiverTrack[1].to).toEqual({ lat: -2, depth: 3 });
  });

  it('resolves a zoneAnchor ball target to the correct world position', () => {
    const schedule = compilePlay(buildPlay(), ctx);
    const serveSeg = schedule.ballTrack[0];
    expect(serveSeg.to).toEqual(toWorld(ZONE_BASE[5], 'B', 0));
  });

  it('marks serveContactAtS at the start of the designated serve step', () => {
    const schedule = compilePlay(buildPlay(), ctx);
    expect(schedule.serveContactAtS).toBeCloseTo(0, 10);
  });

  it('players not given a movement in a step hold their position for its full duration', () => {
    const schedule = compilePlay(buildPlay(), ctx);
    const untouched = schedule.playerTracks['A:1']; // OH1, never moves in this play
    for (const seg of untouched) expect(seg.from).toEqual(seg.to);
  });
});

describe('determinism: playback state is a pure function of t', () => {
  it('produces identical WorldState whether scrubbed directly or reached by stepping through', () => {
    const schedule = compilePlay(buildPlay(), ctx);
    const sampleCount = 200;

    for (let i = 0; i <= sampleCount; i++) {
      const t = (schedule.durationS * i) / sampleCount;
      const a = createWorldState();
      const b = createWorldState();
      evaluateInto(schedule, t, a);
      evaluateInto(schedule, t, b);
      expect(a).toEqual(b);
    }
  });

  it('re-evaluating the same schedule twice at 200 sampled times gives deep-equal results both passes', () => {
    const schedule = compilePlay(buildPlay(), ctx);
    const sampleCount = 200;
    const times = Array.from({ length: sampleCount + 1 }, (_, i) => (schedule.durationS * i) / sampleCount);

    const passA = times.map((t) => {
      const out = createWorldState();
      evaluateInto(schedule, t, out);
      return out;
    });
    const passB = times.map((t) => {
      const out = createWorldState();
      evaluateInto(schedule, t, out);
      return out;
    });

    expect(passA).toEqual(passB);
  });
});
