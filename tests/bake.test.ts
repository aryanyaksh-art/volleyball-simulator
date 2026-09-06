import { describe, expect, it } from 'vitest';
import { bakePlayForEditing } from '@/core/play/bake';
import { compilePlay } from '@/core/play/compile';
import { DEMO_PLAY } from '@/fixtures/demoPlay';
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

describe('bakePlayForEditing', () => {
  it('resolves every movement to a slot-based PlayerRef and a local PositionRef', () => {
    const baked = bakePlayForEditing(DEMO_PLAY, ctx);
    for (const step of baked.steps) {
      for (const mv of step.movements) {
        expect(mv.who.kind).toBe('slot');
        expect(mv.to.kind).toBe('local');
      }
    }
  });

  it('is behavior-preserving: the baked play compiles to identical player tracks as the original', () => {
    const original = compilePlay(DEMO_PLAY, ctx);
    const baked = compilePlay(bakePlayForEditing(DEMO_PLAY, ctx), ctx);

    expect(baked.durationS).toBeCloseTo(original.durationS, 10);
    for (const onCourtId of Object.keys(original.playerTracks)) {
      const originalSegs = original.playerTracks[onCourtId];
      const bakedSegs = baked.playerTracks[onCourtId];
      expect(bakedSegs).toHaveLength(originalSegs.length);
      for (let i = 0; i < originalSegs.length; i++) {
        expect(bakedSegs[i].from).toEqual(originalSegs[i].from);
        expect(bakedSegs[i].to).toEqual(originalSegs[i].to);
        expect(bakedSegs[i].startS).toBeCloseTo(originalSegs[i].startS, 10);
        expect(bakedSegs[i].endS).toBeCloseTo(originalSegs[i].endS, 10);
      }
    }
  });

  it('leaves ball segments untouched (v1 authoring scope: player movement, not ball flight)', () => {
    const baked = bakePlayForEditing(DEMO_PLAY, ctx);
    for (let i = 0; i < baked.steps.length; i++) {
      expect(baked.steps[i].ball).toEqual(DEMO_PLAY.steps[i].ball);
    }
  });

  it('baking twice is idempotent', () => {
    const once = bakePlayForEditing(DEMO_PLAY, ctx);
    const twice = bakePlayForEditing(once, ctx);
    expect(twice).toEqual(once);
  });
});
