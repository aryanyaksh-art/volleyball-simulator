import { describe, expect, it } from 'vitest';
import { checkSpeedCap, jumpOffsetY, minStepDuration, pathLength } from '@/core/play/playerMotion';
import type { PlayStep } from '@/core/play/types';

describe('pathLength', () => {
  it('sums straight-line distance through waypoints', () => {
    const length = pathLength({ lat: 0, depth: 0 }, [{ lat: 3, depth: 0 }], { lat: 3, depth: 4 });
    expect(length).toBeCloseTo(3 + 4, 10);
  });
});

describe('checkSpeedCap', () => {
  it('flags a move that is physically impossible for its mode', () => {
    // 6.2 m in 0.80 s = 7.75 m/s, well over the 6.5 m/s sprint cap.
    const diagnostic = checkSpeedCap('B:MB1', 'sprint', 6.2, 0.8);
    expect(diagnostic).not.toBeNull();
    expect(diagnostic?.code).toBe('SPEED_CAP_EXCEEDED');
    expect(diagnostic?.capMps).toBe(6.5);
    expect(diagnostic?.suggestedDurationS).toBeGreaterThan(0.8);
  });

  it('does not flag a move within the mode cap', () => {
    expect(checkSpeedCap('B:MB1', 'sprint', 3.0, 1.0)).toBeNull();
  });

  it('the suggested duration brings the move back under the cap', () => {
    const diagnostic = checkSpeedCap('B:MB1', 'sprint', 6.2, 0.8)!;
    expect(6.2 / diagnostic.suggestedDurationS).toBeLessThanOrEqual(6.5);
  });
});

describe('minStepDuration', () => {
  const baseStep: PlayStep = { id: 's', name: 'Step', duration: 1, movements: [] };

  it('is zero for a step with no ball and no timed movements', () => {
    expect(minStepDuration(baseStep)).toBe(0);
  });

  it('covers the ball segment\'s own startOffset + duration', () => {
    const step: PlayStep = {
      ...baseStep,
      ball: { kind: 'serve', from: { kind: 'local', side: 'A', pos: { lat: 0, depth: 0 } }, to: { kind: 'local', side: 'A', pos: { lat: 0, depth: 0 } }, startOffset: 2.2, duration: 1.1 },
    };
    expect(minStepDuration(step)).toBeCloseTo(3.3);
  });

  it('covers a movement with an explicit duration', () => {
    const step: PlayStep = {
      ...baseStep,
      movements: [{ who: { side: 'A', kind: 'slot', index: 0 }, to: { kind: 'local', side: 'A', pos: { lat: 0, depth: 0 } }, startOffset: 0.5, duration: 2.0 }],
    };
    expect(minStepDuration(step)).toBeCloseTo(2.5);
  });

  it('ignores a movement with no explicit duration — it is elastic, not a floor', () => {
    const step: PlayStep = {
      ...baseStep,
      movements: [{ who: { side: 'A', kind: 'slot', index: 0 }, to: { kind: 'local', side: 'A', pos: { lat: 0, depth: 0 } } }],
    };
    expect(minStepDuration(step)).toBe(0);
  });

  it('takes the max across the ball and every timed movement', () => {
    const step: PlayStep = {
      ...baseStep,
      ball: { kind: 'pass', from: { kind: 'local', side: 'A', pos: { lat: 0, depth: 0 } }, to: { kind: 'local', side: 'A', pos: { lat: 0, depth: 0 } }, duration: 0.9 },
      movements: [{ who: { side: 'A', kind: 'slot', index: 0 }, to: { kind: 'local', side: 'A', pos: { lat: 0, depth: 0 } }, duration: 2.5 }],
    };
    expect(minStepDuration(step)).toBeCloseTo(2.5);
  });
});

describe('jumpOffsetY', () => {
  it('is zero outside the jump window', () => {
    const jump = { atT: 0.5, heightM: 0.6, hangS: 0.4 };
    expect(jumpOffsetY(0, jump)).toBe(0);
    expect(jumpOffsetY(1.0, jump)).toBe(0);
  });

  it('peaks at the jump height at the middle of the window', () => {
    const jump = { atT: 0.5, heightM: 0.6, hangS: 0.4 };
    expect(jumpOffsetY(0.5, jump)).toBeCloseTo(0.6, 10);
  });

  it('is exactly zero at the window edges', () => {
    const jump = { atT: 0.5, heightM: 0.6, hangS: 0.4 };
    expect(jumpOffsetY(0.3, jump)).toBeCloseTo(0, 10);
    expect(jumpOffsetY(0.7, jump)).toBeCloseTo(0, 10);
  });
});
