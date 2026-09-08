import { describe, expect, it } from 'vitest';
import { commitContactAction, commitPositionAction, describeStep, guidedEditFromStep, replaceGuidedStep } from '@/app/guidedAuthoring';
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

  it('injects the next contact player\'s approach into the PREVIOUS step, timed to its ball\'s flight — not a movement of their own in the new step', () => {
    let play = commitContactAction(blankPlay(), { action: 'serve', onCourtId: 'A:1', side: 'A', target: { lat: 0.5, depth: -4.2 } });
    play = commitContactAction(play, { action: 'pass', onCourtId: 'B:5', side: 'B', target: { lat: 1.5, depth: 2.0 } });

    const serveStep = play.steps[0];
    const passStep = play.steps[1];
    const passerRef = { side: 'B', kind: 'slot', index: 5 };

    const approach = serveStep.movements.find((m) => m.who.kind === 'slot' && m.who.side === 'B' && m.who.index === 5);
    expect(approach).toBeDefined();
    expect(approach!.to).toMatchObject({ kind: 'local', side: 'B' });
    if (approach!.to.kind !== 'local') throw new Error('expected a local target');
    // The serve landed at side A's (lat 0.5, depth -4.2); from side B's own
    // frame (toLocal negates both axes) that's (lat -0.5, depth 4.2).
    expect(approach!.to.pos.lat).toBeCloseTo(-0.5);
    expect(approach!.to.pos.depth).toBeCloseTo(4.2);
    // Timed to the serve's own ball flight: starts when it's launched, lasts
    // exactly as long as the flight, so arrival lines up with landing.
    expect(approach!.startOffset).toBe(serveStep.ball!.startOffset);
    expect(approach!.duration).toBe(serveStep.ball!.duration);

    // The passer has no movement of their own in the pass step — they
    // already arrived — so contact resolves via atPlayer, immediately.
    expect(passStep.movements.some((m) => m.who.kind === 'slot' && m.who.side === 'B' && m.who.index === 5)).toBe(false);
    expect(passStep.ball!.from).toEqual({ kind: 'atPlayer', who: passerRef, contact: 'reach' });
    expect(passStep.ball!.startOffset).toBeFalsy();
  });

  it('walks an attacker to the set\'s zone anchor, with a jump scaled to the approach duration', () => {
    let play = commitContactAction(blankPlay(), { action: 'set', onCourtId: 'B:0', side: 'B', setTarget: { role: 'OH', tempo: '31' } });
    play = commitContactAction(play, { action: 'attack', onCourtId: 'B:1', side: 'B', target: { lat: -3, depth: -1 } });

    const setStep = play.steps[0];
    const approach = setStep.movements.find((m) => m.who.kind === 'slot' && m.who.side === 'B' && m.who.index === 1);
    expect(approach).toBeDefined();
    expect(approach!.to).toMatchObject({ kind: 'local', side: 'B', pos: { lat: -3, depth: 1.6 } }); // zone 4 anchor
    expect(approach!.duration).toBe(setStep.ball!.duration);
    // The jump peaks near the end of the approach (contact, near arrival),
    // not at some fixed offset tuned for a much shorter hold-movement.
    expect(approach!.jump).toBeDefined();
    expect(approach!.jump!.atT).toBeGreaterThan(approach!.duration! * 0.5);
  });

  it('lets two players move within the same step at once — a reacting player and the one reacting to THEM', () => {
    let play = commitContactAction(blankPlay(), { action: 'serve', onCourtId: 'A:1', side: 'A', target: { lat: 0, depth: -6.6 } });
    play = commitContactAction(play, { action: 'pass', onCourtId: 'B:5', side: 'B', target: { lat: 1.5, depth: 2.0 } });
    play = commitContactAction(play, { action: 'set', onCourtId: 'B:0', side: 'B', setTarget: { role: 'OH', tempo: '31' } });

    // The pass step now carries both the passer's own contact (via
    // ball.from, no movement) AND the setter's concurrent approach for the
    // set that follows — two players active in the same step's time range.
    const passStep = play.steps[1];
    const setterApproach = passStep.movements.find((m) => m.who.kind === 'slot' && m.who.side === 'B' && m.who.index === 0);
    expect(setterApproach).toBeDefined();
    expect(passStep.ball!.from).toEqual({ kind: 'atPlayer', who: { side: 'B', kind: 'slot', index: 5 }, contact: 'reach' });
  });

  it("stretches the step to cover a movement longer than the ball's own flight, so the track segment can't overrun the step boundary", () => {
    const play = commitContactAction(blankPlay(), { action: 'serve', onCourtId: 'A:1', side: 'A', target: { lat: 0, depth: -6.6 } });
    const step = play.steps[0];
    expect(step.duration).toBeGreaterThanOrEqual(step.movements[0].duration ?? 0);
    expect(step.duration).toBeGreaterThanOrEqual(step.ball?.duration ?? 0);
  });

  it("delays contact until the walk finishes, instead of the ball flying while the player is still mid-approach", () => {
    const play = commitContactAction(blankPlay(), { action: 'serve', onCourtId: 'A:1', side: 'A', target: { lat: 0, depth: -6.6 } });
    const step = play.steps[0];
    const movementDuration = step.movements[0].duration ?? 0;
    expect(movementDuration).toBeGreaterThan(0); // a real walk, not a no-op hold
    expect(step.ball?.startOffset).toBe(movementDuration);
    // The two run back-to-back, not overlapping: the step is exactly long
    // enough for the walk, then the flight, with no slack either way.
    expect(step.duration).toBe(movementDuration + (step.ball?.duration ?? 0));
  });

  it('falls back to holding position for the very first ball touch (nothing incoming yet)', () => {
    const play = commitContactAction(blankPlay(), { action: 'pass', onCourtId: 'B:5', side: 'B', target: { lat: 1.5, depth: 2.0 } });
    expect(play.steps[0].movements[0].to).toEqual({ kind: 'atPlayer', who: { side: 'B', kind: 'slot', index: 5 }, contact: 'feet' });
  });
});

describe('guidedEditFromStep — a serve step with a reactor appended', () => {
  it('is still recognized as editable once something reacts to it (regression: contactActorOf used to require exactly one movement)', () => {
    let play = commitContactAction(blankPlay(), { action: 'serve', onCourtId: 'A:1', side: 'A', target: { lat: 0, depth: -6.6 } });
    // The pass's own commit injects the passer's reactive approach into the
    // serve step above — the serve step's movements array now holds TWO
    // entries (the server's own walk, then the passer's approach), which
    // used to defeat contactActorOf's `movements.length === 1` check.
    play = commitContactAction(play, { action: 'pass', onCourtId: 'B:5', side: 'B', target: { lat: 1.5, depth: 2.0 } });

    const serveStep = play.steps[0];
    expect(serveStep.movements).toHaveLength(2);
    const edit = guidedEditFromStep(serveStep);
    expect(edit).not.toBeNull();
    expect(edit).toMatchObject({ onCourtId: 'A:1', side: 'A', action: 'serve' });
  });
});

describe('replaceGuidedStep — editing a non-last step', () => {
  it("re-derives every step after the edited one, not just the one being replaced", () => {
    let play = commitContactAction(blankPlay(), { action: 'serve', onCourtId: 'A:1', side: 'A', target: { lat: 0, depth: -6.6 } });
    play = commitContactAction(play, { action: 'pass', onCourtId: 'B:5', side: 'B', target: { lat: 1.5, depth: 2.0 } });
    play = commitContactAction(play, { action: 'set', onCourtId: 'B:0', side: 'B', setTarget: { role: 'OH', tempo: '31' } });
    play = commitContactAction(play, { action: 'attack', onCourtId: 'B:1', side: 'B', target: { lat: -3, depth: -1 } });
    expect(play.steps).toHaveLength(4);

    const passStepId = play.steps[1].id;
    const edited = replaceGuidedStep(play, passStepId, {
      action: 'pass',
      onCourtId: 'B:5',
      side: 'B',
      target: { lat: -1.0, depth: 3.5 },
    });

    expect(edited.steps).toHaveLength(4);
    const newPassStep = edited.steps[1];
    expect(newPassStep.ball!.to).toMatchObject({ kind: 'local', side: 'B', pos: { lat: -1.0, depth: 3.5 } });

    // The setter's reactive approach (injected into the pass step) now
    // targets the NEW pass landing spot, not the old one — both are side B,
    // so the local-frame round trip is the identity, no sign flip.
    const setterApproach = newPassStep.movements.find((m) => m.who.kind === 'slot' && m.who.side === 'B' && m.who.index === 0);
    expect(setterApproach).toBeDefined();
    if (setterApproach!.to.kind !== 'local') throw new Error('expected a local target');
    expect(setterApproach!.to.pos.lat).toBeCloseTo(-1.0);
    expect(setterApproach!.to.pos.depth).toBeCloseTo(3.5);

    // Everything downstream of the edit survives the replay, in order.
    expect(edited.steps[2].ball?.kind).toBe('set');
    expect(edited.steps[3].ball?.kind).toBe('attack');
  });

  it('returns the play unchanged if the stepId does not exist', () => {
    const play = commitContactAction(blankPlay(), { action: 'serve', onCourtId: 'A:1', side: 'A', target: { lat: 0, depth: -6.6 } });
    const result = replaceGuidedStep(play, 'nonexistent', { action: 'serve', onCourtId: 'A:1', side: 'A', target: { lat: 0, depth: -6.6 } });
    expect(result).toBe(play);
  });
});

describe('describeStep', () => {
  it('describes a serve in plain language', () => {
    const play = commitContactAction(blankPlay(), { action: 'serve', onCourtId: 'A:1', side: 'A', target: { lat: 0, depth: -6.6 } });
    expect(describeStep(play.steps[0])).toContain('serves');
  });
});
