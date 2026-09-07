import { describe, expect, it } from 'vitest';
import { GUIDED_CONTACT_DEFAULTS, GUIDED_POSITION_DEFAULTS } from '@/core/play/guidedDefaults';

describe('GUIDED_CONTACT_DEFAULTS', () => {
  const actions = ['serve', 'pass', 'set', 'attack', 'tip'] as const;

  it('has a complete, positive entry for every contact action', () => {
    for (const action of actions) {
      const d = GUIDED_CONTACT_DEFAULTS[action];
      expect(d.apexM).toBeGreaterThan(0);
      expect(d.ballDurationS).toBeGreaterThan(0);
      expect(d.movementDurationS).toBeGreaterThan(0);
    }
  });

  it('an attack peaks near contact, not mid-flight', () => {
    expect(GUIDED_CONTACT_DEFAULTS.attack.apexU).toBeLessThan(0.5);
  });

  it('an attack is faster than a serve', () => {
    expect(GUIDED_CONTACT_DEFAULTS.attack.ballDurationS).toBeLessThan(GUIDED_CONTACT_DEFAULTS.serve.ballDurationS);
  });
});

describe('GUIDED_POSITION_DEFAULTS', () => {
  const actions = ['block', 'dig', 'move'] as const;

  it('has a complete, positive entry for every position-only action', () => {
    for (const action of actions) {
      const d = GUIDED_POSITION_DEFAULTS[action];
      expect(d.movementDurationS).toBeGreaterThan(0);
    }
  });
});
