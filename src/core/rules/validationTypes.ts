import type { Side } from '@/core/court/coordinates';
import type { ZoneNumber } from '@/core/court/zones';
import type { LocalPos } from '@/core/court/coordinates';

export type OverlapAxis = 'depth' | 'lateral';
export type OverlapViolationCode = 'OVERLAP_DEPTH' | 'OVERLAP_LATERAL' | 'OVERLAP_TIE';

export interface OverlapViolation {
  code: OverlapViolationCode;
  severity: 'error' | 'warning';
  axis: OverlapAxis;
  pair: [ZoneNumber, ZoneNumber];
  players: [string, string]; // onCourtId
  actualMarginM: number;
  requiredMarginM: number;
  message: string;
  fixHint: { who: string; move: LocalPos; deltaM: number };
}

export interface PairMargin {
  pair: [ZoneNumber, ZoneNumber];
  axis: OverlapAxis;
  players: [string, string];
  /** Positive = legal margin, zero/negative = tie or violation. */
  marginM: number;
}

export type AlignmentSkipReason = 'NOT_SIX_PLAYERS' | 'NO_LINEUP' | 'NO_SERVE_CONTACT_STEP';

export interface AlignmentReport {
  side: Side;
  rotation: number;
  checked: boolean;
  skippedReason?: AlignmentSkipReason;
  legal: boolean;
  serverExempt: string | null; // onCourtId
  violations: OverlapViolation[];
  margins: PairMargin[];
}
