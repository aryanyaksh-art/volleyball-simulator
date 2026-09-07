import { describe, expect, it } from 'vitest';
import { commitContactAction, commitPositionAction, describeStep } from '@/app/guidedAuthoring';
import type { Play } from '@/core/play/types';

const blankPlay = (): Play => ({
  id: 'test-play',
  name: 'Test',
  schemaVersion: 1,
  scenario: { lineupIds: { A: 'a', B: 'b' }, rotations: { A: 0, B: 0 } },
  initial: { players: [], ball: { side: 'A', pos: { lat: 3, depth: 8.7 }, y: 1.3 } },
  steps: [],
});

describe('commitContactAction', () => {
  it('appends a new step with a ball segment for a serve', () => {
    const play = commitContactAction(blankPlay(), {
      action: 'serve',
      onCourtId: 'A:1',
      side: 'A',
      target: { lat: 0, depth: -6.6 },
    });
    expect(play.steps).toHaveLength(1);
    expect(play.steps[0].ball?.kind).toBe('serve');
    expect(play.steps[0].movements[0].who).toEqual({ side: 'A', kind: 'slot', index: 1 });
  });

  it('closes the previously open step and starts a new one for a second contact', () => {
    let play = commitContactAction(blankPlay(), { action: 'serve', onCourtId: 'A:1', side: 'A', target: { lat: 0, depth: -6.6 } });
    play = commitContactAction(play, { action: 'pass', onCourtId: 'B:5', side: 'B', target: { lat: 1.5, depth: 2.0 } });
    expect(play.steps).toHaveLength(2);
    expect(play.steps[1].ball?.kind).toBe('pass');
  });

  it('a set resolves its target from the chosen hitter role, not a click', () => {
    const play = commitContactAction(blankPlay(), {
      action: 'set',
      onCourtId: 'B:0',
      side: 'B',
      setTarget: { role: 'OH', tempo: '31' },
    });
    const ball = play.steps[0].ball!;
    expect(ball.profile).toBe('31');
    expect(ball.to).toEqual({ kind: 'zoneAnchor', side: 'B', zone: 4 });
  });
});

describe('commitPositionAction', () => {
  it('appends a movement to the currently open step, not a new one', () => {
    let play = commitContactAction(blankPlay(), { action: 'serve', onCourtId: 'A:1', side: 'A', target: { lat: 0, depth: -6.6 } });
    play = commitPositionAction(play, { action: 'move', onCourtId: 'B:6', side: 'B', target: { lat: -1, depth: 5 } });
    expect(play.steps).toHaveLength(1);
    expect(play.steps[0].movements).toHaveLength(2);
  });

  it('starts a fresh step when nothing is open yet', () => {
    const play = commitPositionAction(blankPlay(), { action: 'move', onCourtId: 'B:6', side: 'B', target: { lat: -1, depth: 5 } });
    expect(play.steps).toHaveLength(1);
    expect(play.steps[0].ball).toBeUndefined();
  });
});

describe('describeStep', () => {
  it('describes a serve in plain language', () => {
    const play = commitContactAction(blankPlay(), { action: 'serve', onCourtId: 'A:1', side: 'A', target: { lat: 0, depth: -6.6 } });
    expect(describeStep(play.steps[0])).toContain('serves');
  });
});
