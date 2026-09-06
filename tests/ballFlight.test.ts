import { describe, expect, it } from 'vitest';
import { ballHeightAt, ballPositionAt, checkBallFlight, solveNetCrossingU } from '@/core/play/ballFlight';

describe('ballHeightAt', () => {
  it('is exact at both endpoints regardless of apex', () => {
    expect(ballHeightAt(1.0, 0.3, 3.5, 0)).toBeCloseTo(1.0, 10);
    expect(ballHeightAt(1.0, 0.3, 3.5, 1)).toBeCloseTo(0.3, 10);
  });

  it('is exact at the apex for the default mid-flight peak', () => {
    expect(ballHeightAt(1.0, 0.0, 2.5, 0.5)).toBeCloseTo(2.5, 10);
  });

  it('is exact at the apex for an asymmetric peak (e.g. a spike near contact)', () => {
    const apexU = 0.15;
    expect(ballHeightAt(2.0, 0.0, 3.0, apexU, apexU)).toBeCloseTo(3.0, 10);
    expect(ballHeightAt(2.0, 0.0, 3.0, 0, apexU)).toBeCloseTo(2.0, 10);
    expect(ballHeightAt(2.0, 0.0, 3.0, 1, apexU)).toBeCloseTo(0.0, 10);
  });
});

describe('ballPositionAt', () => {
  it('matches from/to exactly at u=0 and u=1', () => {
    const from = { x: -1, y: 1, z: 5 };
    const to = { x: 2, y: 0, z: -5 };
    expect(ballPositionAt(from, to, 3, 0)).toEqual(from);
    expect(ballPositionAt(from, to, 3, 1)).toEqual(to);
  });
});

describe('solveNetCrossingU', () => {
  it('finds the crossing point when the path spans the net plane', () => {
    expect(solveNetCrossingU({ x: 0, y: 0, z: 5 }, { x: 0, y: 0, z: -5 })).toBeCloseTo(0.5, 10);
  });

  it('returns null when the path never crosses z=0', () => {
    expect(solveNetCrossingU({ x: 0, y: 0, z: 5 }, { x: 0, y: 0, z: 3 })).toBeNull();
  });

  it('returns null when the path is parallel to the net', () => {
    expect(solveNetCrossingU({ x: 0, y: 0, z: 3 }, { x: 5, y: 0, z: 3 })).toBeNull();
  });
});

describe('checkBallFlight', () => {
  const baseParams = {
    netHeightM: 2.43,
    antennaHalfSpanM: 4.5,
    courtHalfWidthM: 4.5,
    courtHalfLengthM: 9,
    checkLanding: true,
  };

  it('flags a ball that crosses the net below net height', () => {
    const diagnostics = checkBallFlight({
      ...baseParams,
      from: { x: 0, y: 1, z: 5 },
      to: { x: 0, y: 1, z: -5 },
      apexM: 1,
    });
    expect(diagnostics.some((d) => d.code === 'BALL_INTO_NET' && d.severity === 'error')).toBe(true);
  });

  it('flags a ball that crosses the net plane outside the antenna', () => {
    const diagnostics = checkBallFlight({
      ...baseParams,
      from: { x: 0, y: 3, z: 5 },
      to: { x: 10, y: 3, z: -5 },
      apexM: 3,
    });
    expect(diagnostics.some((d) => d.code === 'BALL_OUTSIDE_ANTENNA')).toBe(true);
    expect(diagnostics.some((d) => d.code === 'BALL_INTO_NET')).toBe(false);
  });

  it('warns (not errors) when a serve lands outside the court', () => {
    const diagnostics = checkBallFlight({
      ...baseParams,
      from: { x: 3, y: 1.2, z: 9 },
      to: { x: 6, y: 0, z: -3 },
      apexM: 3,
    });
    const out = diagnostics.find((d) => d.code === 'BALL_OUT');
    expect(out?.severity).toBe('warning');
  });

  it('does not check landing for a dig or other non-terminal contact', () => {
    const diagnostics = checkBallFlight({
      ...baseParams,
      checkLanding: false,
      from: { x: 3, y: 1.2, z: 9 },
      to: { x: 6, y: 0, z: -3 },
      apexM: 3,
    });
    expect(diagnostics.some((d) => d.code === 'BALL_OUT')).toBe(false);
  });

  it('a clean legal flight produces no diagnostics', () => {
    const diagnostics = checkBallFlight({
      ...baseParams,
      from: { x: 0, y: 1.2, z: 8 },
      to: { x: 0, y: 0, z: -8 },
      apexM: 3,
    });
    expect(diagnostics).toHaveLength(0);
  });
});
