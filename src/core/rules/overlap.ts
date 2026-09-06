import type { Side, LocalPos } from '@/core/court/coordinates';
import type { ZoneNumber } from '@/core/court/zones';
import type { AlignmentReport, OverlapViolation, PairMargin } from './validationTypes';

/** A single on-court player's position, as needed by the overlap check. */
export interface AlignedPlayer {
  onCourtId: string;
  zone: ZoneNumber;
  pos: LocalPos;
  isServer: boolean;
}

/** [nearZone, farZone] — nearZone must sit at a smaller depth (closer to the net). */
const DEPTH_PAIRS: [ZoneNumber, ZoneNumber][] = [
  [4, 5],
  [3, 6],
  [2, 1],
];

/** [leftZone, rightZone] — leftZone must sit at a smaller lat. */
const LATERAL_PAIRS: [ZoneNumber, ZoneNumber][] = [
  [4, 3],
  [3, 2],
  [5, 6],
  [6, 1],
];

const TIE_EPSILON = 1e-6;

const emptyReport = (side: Side, rotation: number, skippedReason: NonNullable<AlignmentReport['skippedReason']>): AlignmentReport => ({
  side,
  rotation,
  checked: false,
  skippedReason,
  legal: true,
  serverExempt: null,
  violations: [],
  margins: [],
});

const buildPair = (
  axis: 'depth' | 'lateral',
  pair: [ZoneNumber, ZoneNumber],
  a: AlignedPlayer,
  b: AlignedPlayer,
): { margin: PairMargin; violation: OverlapViolation | null } => {
  const marginM = axis === 'depth' ? b.pos.depth - a.pos.depth : b.pos.lat - a.pos.lat;

  const margin: PairMargin = { pair, axis, players: [a.onCourtId, b.onCourtId], marginM };

  const serverInvolved = a.isServer || b.isServer;
  if (serverInvolved) return { margin, violation: null };

  if (Math.abs(marginM) <= TIE_EPSILON) {
    return {
      margin,
      violation: {
        code: 'OVERLAP_TIE',
        severity: 'warning',
        axis,
        pair,
        players: [a.onCourtId, b.onCourtId],
        actualMarginM: marginM,
        requiredMarginM: 0,
        message: `Zone ${pair[0]} and zone ${pair[1]} are tied on the ${axis} axis.`,
        fixHint: {
          who: b.onCourtId,
          move: axis === 'depth' ? { lat: b.pos.lat, depth: b.pos.depth + 0.05 } : { lat: b.pos.lat + 0.05, depth: b.pos.depth },
          deltaM: 0.05,
        },
      },
    };
  }

  if (marginM < 0) {
    const deltaM = -marginM + 0.02;
    return {
      margin,
      violation: {
        code: axis === 'depth' ? 'OVERLAP_DEPTH' : 'OVERLAP_LATERAL',
        severity: 'error',
        axis,
        pair,
        players: [a.onCourtId, b.onCourtId],
        actualMarginM: marginM,
        requiredMarginM: 0,
        message:
          axis === 'depth'
            ? `Zone ${pair[1]} is ${Math.abs(marginM).toFixed(2)} m in front of zone ${pair[0]}.`
            : `Zone ${pair[1]} is ${Math.abs(marginM).toFixed(2)} m to the wrong side of zone ${pair[0]}.`,
        fixHint: {
          who: b.onCourtId,
          move: axis === 'depth' ? { lat: b.pos.lat, depth: b.pos.depth + deltaM } : { lat: b.pos.lat + deltaM, depth: b.pos.depth },
          deltaM,
        },
      },
    };
  }

  return { margin, violation: null };
};

/**
 * Checked only at the moment of serve contact, adjacent pairs only. The
 * server is exempt from every pair they're part of. If the side isn't
 * exactly 6 legal players the whole check is skipped (drill mode).
 */
export const checkAlignment = (side: Side, rotation: number, players: AlignedPlayer[] | null): AlignmentReport => {
  if (players == null) return emptyReport(side, rotation, 'NO_LINEUP');
  if (players.length !== 6) return emptyReport(side, rotation, 'NOT_SIX_PLAYERS');

  const byZone = new Map(players.map((p) => [p.zone, p]));
  const violations: OverlapViolation[] = [];
  const margins: PairMargin[] = [];

  for (const pair of DEPTH_PAIRS) {
    const a = byZone.get(pair[0]);
    const b = byZone.get(pair[1]);
    if (!a || !b) continue;
    const { margin, violation } = buildPair('depth', pair, a, b);
    margins.push(margin);
    if (violation) violations.push(violation);
  }

  for (const pair of LATERAL_PAIRS) {
    const a = byZone.get(pair[0]);
    const b = byZone.get(pair[1]);
    if (!a || !b) continue;
    const { margin, violation } = buildPair('lateral', pair, a, b);
    margins.push(margin);
    if (violation) violations.push(violation);
  }

  const server = players.find((p) => p.isServer);

  return {
    side,
    rotation,
    checked: true,
    legal: !violations.some((v) => v.severity === 'error'),
    serverExempt: server?.onCourtId ?? null,
    violations,
    margins,
  };
};

/**
 * Applies each error violation's fixHint and revalidates, up to `maxPasses`
 * times, since fixing one pair can tighten another. `positionsByZone` and
 * the returned positions are keyed by zone; `buildPlayers` reconstructs the
 * AlignedPlayer list for a given position map so this stays independent of
 * where those positions actually come from (fixture anchors today, a play's
 * formation later).
 */
export const nudgeToLegal = (
  positionsByZone: Partial<Record<ZoneNumber, LocalPos>>,
  buildPlayers: (positions: Partial<Record<ZoneNumber, LocalPos>>) => AlignedPlayer[],
  side: Side,
  rotation: number,
  maxPasses = 8,
): { positions: Partial<Record<ZoneNumber, LocalPos>>; report: AlignmentReport } => {
  let positions = { ...positionsByZone };
  let players = buildPlayers(positions);
  let report = checkAlignment(side, rotation, players);

  for (let pass = 0; pass < maxPasses && !report.legal; pass++) {
    const errors = report.violations.filter((v) => v.severity === 'error');
    if (errors.length === 0) break;
    const next = { ...positions };
    for (const v of errors) {
      const target = players.find((p) => p.onCourtId === v.fixHint.who);
      if (target) next[target.zone] = v.fixHint.move;
    }
    positions = next;
    players = buildPlayers(positions);
    report = checkAlignment(side, rotation, players);
  }

  return { positions, report };
};
