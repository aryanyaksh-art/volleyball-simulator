import { describe, expect, it } from 'vitest';
import { GUIDED_CONTACT_DEFAULTS, GUIDED_POSITION_DEFAULTS } from '@/core/play/guidedDefaults';
import { DEFAULT_COURT_SPEC } from '@/core/court/courtSpec';

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

  it("jumps high enough that a standing attacker's own reach clears the net with real margin, not just barely touching it", () => {
    // A CapsuleHumanoid's own standing height, measured empirically via its
    // bounding box (see HANDOFF) — the jump offset alone has to add enough
    // on top of that to clear DEFAULT_COURT_SPEC's net height with visible
    // daylight, or a spike looks like it's brushing the tape rather than
    // rising clearly above it.
    const STANDING_HEIGHT_M = 1.95;
    const jump = GUIDED_CONTACT_DEFAULTS.attack.jump;
    expect(jump).toBeDefined();
    expect(STANDING_HEIGHT_M + jump!.heightM).toBeGreaterThan(DEFAULT_COURT_SPEC.netHeightM + 0.3);
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
