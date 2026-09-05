import { describe, expect, it } from 'vitest';

// Placeholder — proves the headless test harness runs before the domain
// modules exist. Replace/remove once rotation.test.ts etc. land in Phase 2.
describe('test harness', () => {
  it('runs in a node environment (no DOM globals)', () => {
    expect('window' in globalThis).toBe(false);
  });
});
