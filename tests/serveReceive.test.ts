import { describe, expect, it } from 'vitest';
import {
  analyzeServeReceive,
  assignResponsibility,
  checkLateRelease,
  checkSetterInSeam,
  defaultReceivingBounds,
  solveTimeToHeight,
  type Passer,
} from '@/core/tactics/serveReceive';
import { ballHeightAt } from '@/core/play/ballFlight';
import { toWorld } from '@/core/court/coordinates';

describe('assignResponsibility', () => {
  const passers: Passer[] = [
    { onCourtId: 'left', pos: { lat: -3, depth: 5 }, weight: 1 },
    { onCourtId: 'right', pos: { lat: 3, depth: 5 }, weight: 1 },
  ];

  it('assigns a point to the nearer passer when weights are equal', () => {
    const result = assignResponsibility(passers, { lat: -2.9, depth: 5 });
    expect(result.bestId).toBe('left');
  });

  it('a higher weight extends a passer\'s effective range past a nearer, lower-weight passer', () => {
    const weighted: Passer[] = [
      { onCourtId: 'nearby', pos: { lat: -1, depth: 5 }, weight: 1 },
      { onCourtId: 'libero', pos: { lat: 3, depth: 5 }, weight: 3 },
    ];
    // Roughly the midpoint by raw distance, but the libero's weight should still win.
    const result = assignResponsibility(weighted, { lat: 1, depth: 5 });
    expect(result.bestId).toBe('libero');
  });

  it('flags a seam when the top two passers are within the threshold', () => {
    const result = assignResponsibility(passers, { lat: 0, depth: 5 }, 0.4);
    expect(result.isSeam).toBe(true);
    expect(result.secondId).not.toBeNull();
  });

  it('does not flag a seam when one passer is clearly closer', () => {
    const result = assignResponsibility(passers, { lat: -2.9, depth: 5 }, 0.4);
    expect(result.isSeam).toBe(false);
  });
});

describe('solveTimeToHeight', () => {
  it('matches the exact analytic crossing for a known symmetric parabola', () => {
    // y0=0, y1=0, apex=1 at u=0.5: y(u) = 4u(1-u). y=0.5 at u = (2±sqrt(2))/4;
    // the descending (larger) root is (2+sqrt(2))/4.
    const totalDurationS = 2.0;
    const expectedU = (2 + Math.sqrt(2)) / 4;
    const result = solveTimeToHeight(0, 0, 1, 0.5, totalDurationS);
    expect(result).not.toBeNull();
    expect(result!).toBeCloseTo(expectedU * totalDurationS, 3);
  });

  it('returns null when the arc never reaches the target height', () => {
    const result = solveTimeToHeight(0.5, 0, 0.8, 5.0, 2.0); // apex 0.8m, asking for 5m
    expect(result).toBeNull();
  });

  it('the returned time is exactly where ballHeightAt crosses the target height', () => {
    const y0 = 2.2;
    const y1 = 0;
    const apexM = 3.0;
    const targetHeightM = 1.0;
    const totalDurationS = 1.2;
    const t = solveTimeToHeight(y0, y1, apexM, targetHeightM, totalDurationS)!;
    const u = t / totalDurationS;
    expect(ballHeightAt(y0, y1, apexM, u)).toBeCloseTo(targetHeightM, 2);
  });
});

describe('analyzeServeReceive', () => {
  it('produces a grid covering the receiving half plus the free zone', () => {
    const bounds = defaultReceivingBounds();
    const passers: Passer[] = [{ onCourtId: 'p1', pos: { lat: 0, depth: 5 }, weight: 1 }];
    const cells = analyzeServeReceive({
      side: 'B',
      passers,
      serveOriginWorld: toWorld({ lat: 0, depth: 9 }, 'A'),
      cellSizeM: 1,
    });
    for (const cell of cells) {
      expect(cell.center.lat).toBeGreaterThanOrEqual(bounds.latMin);
      expect(cell.center.lat).toBeLessThanOrEqual(bounds.latMax);
      expect(cell.center.depth).toBeGreaterThanOrEqual(bounds.depthMin);
      expect(cell.center.depth).toBeLessThanOrEqual(bounds.depthMax);
    }
    expect(cells.length).toBeGreaterThan(0);
  });

  it('marks a spot right next to a passer as safely covered', () => {
    const passers: Passer[] = [{ onCourtId: 'p1', pos: { lat: 0, depth: 5 }, weight: 1 }];
    const cells = analyzeServeReceive({
      side: 'B',
      passers,
      serveOriginWorld: toWorld({ lat: 0, depth: 9 }, 'A'),
      cellSizeM: 0.25,
    });
    const cell = cells.reduce((closest, c) =>
      Math.hypot(c.center.lat - 0, c.center.depth - 5) < Math.hypot(closest.center.lat - 0, closest.center.depth - 5) ? c : closest,
    );
    expect(cell.severity).toBe('safe');
    expect(cell.marginS).not.toBeNull();
    expect(cell.marginS!).toBeGreaterThan(0);
  });

  it('marks a spot far from every passer as uncovered', () => {
    // All passers clustered on the left; check the far right corner.
    const passers: Passer[] = [
      { onCourtId: 'p1', pos: { lat: -4, depth: 5 }, weight: 1 },
      { onCourtId: 'p2', pos: { lat: -3.5, depth: 6 }, weight: 1 },
    ];
    const cells = analyzeServeReceive({
      side: 'B',
      passers,
      serveOriginWorld: toWorld({ lat: 4, depth: 9 }, 'A'),
      cellSizeM: 0.25,
    });
    const farCorner = cells.reduce((closest, c) =>
      Math.hypot(c.center.lat - 4, c.center.depth - 3) < Math.hypot(closest.center.lat - 4, closest.center.depth - 3) ? c : closest,
    );
    expect(farCorner.severity).toBe('uncovered');
    expect(farCorner.marginS!).toBeLessThan(0);
  });
});

describe('checkSetterInSeam', () => {
  it('is true when the setter releases into a seam between two passers', () => {
    const passers: Passer[] = [
      { onCourtId: 'left', pos: { lat: -3, depth: 5 }, weight: 1 },
      { onCourtId: 'right', pos: { lat: 3, depth: 5 }, weight: 1 },
    ];
    const cells = analyzeServeReceive({ side: 'B', passers, serveOriginWorld: toWorld({ lat: 0, depth: 9 }, 'A'), cellSizeM: 0.25 });
    expect(checkSetterInSeam(cells, { lat: 0, depth: 5 })).toBe(true);
  });

  it('is false when the setter releases well within one passer\'s zone', () => {
    const passers: Passer[] = [
      { onCourtId: 'left', pos: { lat: -3, depth: 5 }, weight: 1 },
      { onCourtId: 'right', pos: { lat: 3, depth: 5 }, weight: 1 },
    ];
    const cells = analyzeServeReceive({ side: 'B', passers, serveOriginWorld: toWorld({ lat: 0, depth: 9 }, 'A'), cellSizeM: 0.25 });
    expect(checkSetterInSeam(cells, { lat: -3, depth: 5 })).toBe(false);
  });
});

describe('checkLateRelease', () => {
  it('flags a release the setter cannot reach in time', () => {
    expect(checkLateRelease({ lat: -3, depth: 6 }, { lat: 3, depth: 2 }, 0.3)).toBe(true);
  });

  it('does not flag a release comfortably within reach', () => {
    expect(checkLateRelease({ lat: 1, depth: 2 }, { lat: 1.5, depth: 2 }, 1.0)).toBe(false);
  });
});
