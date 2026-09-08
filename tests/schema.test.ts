import { describe, expect, it } from 'vitest';
import { migratePlay, parsePlay } from '@/core/play/schema';
import { DEMO_PLAY } from '@/fixtures/demoPlay';
import { DEMO_PLAYS } from '@/fixtures/demoPlays';
import type { Play } from '@/core/play/types';

const minimalPlay: Play = {
  id: 'p1',
  name: 'Minimal',
  schemaVersion: 1,
  scenario: { lineupIds: { A: 'a', B: 'b' }, rotations: { A: 0, B: 0 } },
  initial: { players: [], ball: { side: 'A', pos: { lat: 0, depth: 9 }, y: 1.2 } },
  steps: [{ id: 's1', name: 'Step 1', duration: 1, movements: [] }],
};

describe('parsePlay', () => {
  it('accepts a minimal valid play', () => {
    expect(parsePlay(minimalPlay)).toEqual(minimalPlay);
  });

  it('round-trips every real demo/hand-authored play unchanged, including the full range of ref kinds and optional fields they use', () => {
    for (const play of [DEMO_PLAY, ...DEMO_PLAYS]) {
      const roundTripped = JSON.parse(JSON.stringify(play)) as unknown; // simulate a real localStorage round trip
      expect(parsePlay(roundTripped)).toEqual(play);
    }
  });

  it('rejects a play missing a required field', () => {
    const { id: _id, ...withoutId } = minimalPlay;
    expect(parsePlay(withoutId)).toBeNull();
  });

  it('rejects a play with the wrong schemaVersion', () => {
    expect(parsePlay({ ...minimalPlay, schemaVersion: 2 })).toBeNull();
  });

  it('rejects a play with an invalid PositionRef kind', () => {
    const bad = {
      ...minimalPlay,
      initial: { ...minimalPlay.initial, ball: { ...minimalPlay.initial.ball, heldBy: { side: 'A', kind: 'nonsense' } } },
    };
    expect(parsePlay(bad)).toBeNull();
  });

  it('rejects completely unrelated data (not an object shaped like a Play at all)', () => {
    expect(parsePlay('not a play')).toBeNull();
    expect(parsePlay(null)).toBeNull();
    expect(parsePlay(42)).toBeNull();
    expect(parsePlay({})).toBeNull();
  });
});

describe('migratePlay', () => {
  it('passes a current-version play straight through to parsePlay', () => {
    expect(migratePlay(minimalPlay)).toEqual(minimalPlay);
  });

  it('rejects data with no schemaVersion at all', () => {
    const { schemaVersion: _v, ...withoutVersion } = minimalPlay;
    expect(migratePlay(withoutVersion)).toBeNull();
  });

  it('rejects an unrecognized future schemaVersion (nothing to migrate FROM yet)', () => {
    expect(migratePlay({ ...minimalPlay, schemaVersion: 99 })).toBeNull();
  });

  it('rejects non-object data before even looking for schemaVersion', () => {
    expect(migratePlay('garbage')).toBeNull();
    expect(migratePlay(null)).toBeNull();
  });
});
