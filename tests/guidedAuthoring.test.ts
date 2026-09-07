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

describe('commitContactAction — walking to the ball instead of standing still', () => {
  it('places a serve behind the endline, not at the player\'s on-court spot', () => {
    const play = commitContactAction(blankPlay(), { action: 'serve', onCourtId: 'A:1', side: 'A', target: { lat: 0, depth: -6.6 } });
    const movement = play.steps[0].movements[0];
    expect(movement.to).toMatchObject({ kind: 'local', side: 'A' });
    if (movement.to.kind !== 'local') throw new Error('expected a local target');
    expect(movement.to.pos.depth).toBeGreaterThan(9); // past halfLengthM (9) — outside the court
    const ball = play.steps[0].ball!;
    expect(ball.from).toEqual({ kind: 'local', side: 'A', pos: movement.to.pos, y: expect.any(Number) });
  });

  it('walks the next contact player to wherever the previous ball actually lands', () => {
    let play = commitContactAction(blankPlay(), { action: 'serve', onCourtId: 'A:1', side: 'A', target: { lat: 0.5, depth: -4.2 } });
    play = commitContactAction(play, { action: 'pass', onCourtId: 'B:5', side: 'B', target: { lat: 1.5, depth: 2.0 } });

    const passMovement = play.steps[1].movements[0];
    expect(passMovement.to).toMatchObject({ kind: 'local', side: 'B' });
    if (passMovement.to.kind !== 'local') throw new Error('expected a local target');
    // The serve landed at side A's (lat 0.5, depth -4.2); from side B's own
    // frame (toLocal negates both axes) that's (lat -0.5, depth 4.2).
    expect(passMovement.to.pos.lat).toBeCloseTo(-0.5);
    expect(passMovement.to.pos.depth).toBeCloseTo(4.2);

    const passBall = play.steps[1].ball!;
    expect(passBall.from).toMatchObject({ kind: 'local', side: 'B', pos: passMovement.to.pos });
  });

  it('walks an attacker to the set\'s zone anchor', () => {
    let play = commitContactAction(blankPlay(), { action: 'set', onCourtId: 'B:0', side: 'B', setTarget: { role: 'OH', tempo: '31' } });
    play = commitContactAction(play, { action: 'attack', onCourtId: 'B:1', side: 'B', target: { lat: -3, depth: -1 } });

    const attackMovement = play.steps[1].movements[0];
    expect(attackMovement.to).toMatchObject({ kind: 'local', side: 'B', pos: { lat: -3, depth: 1.6 } }); // zone 4 anchor
  });

  it("stretches the step to cover a movement longer than the ball's own flight, so the track segment can't overrun the step boundary", () => {
    const play = commitContactAction(blankPlay(), { action: 'serve', onCourtId: 'A:1', side: 'A', target: { lat: 0, depth: -6.6 } });
    const step = play.steps[0];
    expect(step.duration).toBeGreaterThanOrEqual(step.movements[0].duration ?? 0);
    expect(step.duration).toBeGreaterThanOrEqual(step.ball?.duration ?? 0);
  });

  it('falls back to holding position for the very first ball touch (nothing incoming yet)', () => {
    const play = commitContactAction(blankPlay(), { action: 'pass', onCourtId: 'B:5', side: 'B', target: { lat: 1.5, depth: 2.0 } });
    expect(play.steps[0].movements[0].to).toEqual({ kind: 'atPlayer', who: { side: 'B', kind: 'slot', index: 5 }, contact: 'feet' });
  });
});

describe('describeStep', () => {
  it('describes a serve in plain language', () => {
    const play = commitContactAction(blankPlay(), { action: 'serve', onCourtId: 'A:1', side: 'A', target: { lat: 0, depth: -6.6 } });
    expect(describeStep(play.steps[0])).toContain('serves');
  });
});
