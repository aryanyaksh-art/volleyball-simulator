import { describe, expect, it } from 'vitest';
import {
  APPROACH_PROFILES,
  ATTACK_CONTACT_BY_ZONE,
  computeApproachLane,
  computeBlockFeasibility,
  SET_TEMPO_S,
  ZONE_TO_ROLE,
} from '@/core/tactics/attack';
import { SPEED_CAP_MPS, REACTION_TIME_S } from '@/core/play/playerMotion';

describe('computeApproachLane', () => {
  it('pipe runs straight back from the contact point (zero angle, no lateral bend)', () => {
    const lane = computeApproachLane('pipe', { lat: 0, depth: 6 });
    expect(lane.approachStart.lat).toBeCloseTo(lane.takeoff.lat, 6);
    expect(lane.approachStart.depth).toBeGreaterThan(lane.takeoff.depth);
  });

  it('takeoff sits behind (further from the net than) the contact point', () => {
    const lane = computeApproachLane('OH', { lat: -3, depth: 1.6 });
    expect(lane.takeoff.depth).toBeGreaterThan(1.6);
  });

  it('a negative lateralSign bends the approach the opposite way from a positive one', () => {
    const contact = { lat: 3, depth: 1.6 };
    const right = computeApproachLane('OH', contact, 1);
    const left = computeApproachLane('OH', contact, -1);
    expect(right.approachStart.lat).toBeGreaterThan(right.takeoff.lat);
    expect(left.approachStart.lat).toBeLessThan(left.takeoff.lat);
  });

  it('carries the role\'s step count and profile geometry through', () => {
    const lane = computeApproachLane('MB', { lat: 0, depth: 1.6 });
    expect(lane.steps).toBe(APPROACH_PROFILES.MB.steps);
    expect(lane.angleDeg).toBe(APPROACH_PROFILES.MB.angleDeg);
    expect(lane.lengthM).toBe(APPROACH_PROFILES.MB.lengthM);
  });
});

describe('zone/role convention', () => {
  it('maps each attack zone to the standard hitter role', () => {
    expect(ZONE_TO_ROLE[4]).toBe('OH');
    expect(ZONE_TO_ROLE[3]).toBe('MB');
    expect(ZONE_TO_ROLE[2]).toBe('RS');
    expect(ZONE_TO_ROLE[6]).toBe('pipe');
  });

  it('a pipe contact point sits well back from the net; pin zones sit close to it', () => {
    expect(ATTACK_CONTACT_BY_ZONE[6].depth).toBeGreaterThan(ATTACK_CONTACT_BY_ZONE[4].depth);
  });
});

describe('computeBlockFeasibility', () => {
  it('matches the plan\'s worked example shape: a middle who cannot reach the pin', () => {
    // ~3m lateral travel at shuffle speed (2.8 m/s) plus reaction time is well over a 0.45s quick tempo.
    const result = computeBlockFeasibility(0, 3, SET_TEMPO_S.quick, 'shuffle');
    expect(result.feasible).toBe(false);
    expect(result.requiredTimeS).toBeCloseTo(REACTION_TIME_S + 3 / SPEED_CAP_MPS.shuffle, 5);
  });

  it('is feasible for a short distance against a slow (high) tempo', () => {
    const result = computeBlockFeasibility(3, 3.5, SET_TEMPO_S.high, 'shuffle');
    expect(result.feasible).toBe(true);
  });

  it('crossover covers more ground per second than shuffle', () => {
    const shuffle = computeBlockFeasibility(0, 3, 1, 'shuffle');
    const crossover = computeBlockFeasibility(0, 3, 1, 'crossover');
    expect(crossover.requiredTimeS).toBeLessThan(shuffle.requiredTimeS);
  });

  it('required time is symmetric in the sign of the lateral gap', () => {
    const a = computeBlockFeasibility(-1, 2, 1);
    const b = computeBlockFeasibility(1, -2, 1);
    expect(a.requiredTimeS).toBeCloseTo(b.requiredTimeS, 6);
  });
});
