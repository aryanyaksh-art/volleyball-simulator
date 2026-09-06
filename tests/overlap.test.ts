import { describe, expect, it } from 'vitest';
import { checkAlignment, nudgeToLegal, type AlignedPlayer } from '@/core/rules/overlap';
import { ZONE_BASE } from '@/core/court/anchors';
import type { LocalPos } from '@/core/court/coordinates';
import type { ZoneNumber } from '@/core/court/zones';

const ZONES: ZoneNumber[] = [1, 2, 3, 4, 5, 6];

/** Six on-court players, one per zone, at rotation 0 (zone === slot + 1). */
const playersFrom = (positions: Partial<Record<ZoneNumber, LocalPos>>): AlignedPlayer[] =>
  ZONES.map((zone) => ({
    onCourtId: `A:${zone}`,
    zone,
    pos: positions[zone] ?? ZONE_BASE[zone],
    isServer: zone === 1,
  }));

describe('overlap validator', () => {
  it('ZONE_BASE anchors are legal for every rotation (overlap-legal by construction)', () => {
    for (let rotation = 0; rotation < 6; rotation++) {
      const players = ZONES.map((zone) => ({
        onCourtId: `A:${zone}`,
        zone,
        pos: ZONE_BASE[zone],
        isServer: zone === 1,
      }));
      const report = checkAlignment('A', rotation, players);
      expect(report.checked).toBe(true);
      expect(report.legal).toBe(true);
      expect(report.violations.filter((v) => v.severity === 'error')).toHaveLength(0);
    }
  });

  it('flags a swapped 4/5 depth as OVERLAP_DEPTH on pair [4,5]', () => {
    const players = playersFrom({
      4: { lat: ZONE_BASE[4].lat, depth: ZONE_BASE[5].depth },
      5: { lat: ZONE_BASE[5].lat, depth: ZONE_BASE[4].depth },
    });
    const report = checkAlignment('A', 0, players);
    expect(report.legal).toBe(false);
    const violation = report.violations.find((v) => v.axis === 'depth' && v.pair[0] === 4 && v.pair[1] === 5);
    expect(violation).toBeDefined();
    expect(violation?.code).toBe('OVERLAP_DEPTH');
    expect(violation?.severity).toBe('error');
  });

  it('exempts the server from any pair they are part of', () => {
    // Zone 1 is always the server. Push it nearer the net than zone 2,
    // which would normally violate depth(2) < depth(1).
    const players = playersFrom({ 1: { lat: ZONE_BASE[1].lat, depth: 0.5 } });
    const report = checkAlignment('A', 0, players);
    expect(report.serverExempt).toBe('A:1');
    expect(report.violations.some((v) => v.pair.includes(1))).toBe(false);
    expect(report.legal).toBe(true);
  });

  it('skips the check entirely when the side is not exactly 6 legal players', () => {
    const players = playersFrom({}).slice(0, 5);
    const report = checkAlignment('A', 0, players);
    expect(report.checked).toBe(false);
    expect(report.skippedReason).toBe('NOT_SIX_PLAYERS');
    expect(report.legal).toBe(true);
  });

  it('a legal stacked serve-receive formation passes even though it looks unusual', () => {
    // Stack everyone far left, but keep the required depth/lateral orderings intact.
    const stacked: Partial<Record<ZoneNumber, LocalPos>> = {
      4: { lat: -4.0, depth: 1.0 },
      3: { lat: -3.5, depth: 1.5 },
      2: { lat: -3.0, depth: 2.0 },
      5: { lat: -4.0, depth: 6.0 },
      6: { lat: -3.5, depth: 6.5 },
      1: { lat: -3.0, depth: 7.0 },
    };
    const report = checkAlignment('A', 0, playersFrom(stacked));
    expect(report.legal).toBe(true);
  });

  it('nudgeToLegal iteratively fixes error violations until the report is legal', () => {
    const badPositions: Partial<Record<ZoneNumber, LocalPos>> = {
      4: { lat: ZONE_BASE[4].lat, depth: ZONE_BASE[5].depth },
      5: { lat: ZONE_BASE[5].lat, depth: ZONE_BASE[4].depth },
    };
    const { report } = nudgeToLegal(badPositions, playersFrom, 'A', 0);
    expect(report.legal).toBe(true);
  });
});
