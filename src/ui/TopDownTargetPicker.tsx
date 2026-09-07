import { useRef } from 'react';
import { DEFAULT_COURT_SPEC } from '@/core/court/courtSpec';
import { ZONE_BASE } from '@/core/court/anchors';
import type { ZoneNumber } from '@/core/court/zones';

interface TopDownTargetPickerProps {
  lat: number;
  depth: number;
  onChange: (lat: number, depth: number) => void;
}

const { halfLengthM: HALF, widthM: WIDTH_M, attackLineM: ATTACK_M, freeZoneM: FREE_ZONE_M } = DEFAULT_COURT_SPEC;

const LAT_MIN = -WIDTH_M / 2;
const LAT_MAX = WIDTH_M / 2;
// depth < 0 is the opponent's half (a serve crossing the net); depth > halfLengthM
// is the free zone behind the acting side's own endline.
const DEPTH_MIN = -HALF;
const DEPTH_MAX = HALF + FREE_ZONE_M;

const PX_PER_M = 15;
const MARGIN = 10;
const SVG_W = (LAT_MAX - LAT_MIN) * PX_PER_M + MARGIN * 2;
const SVG_H = (DEPTH_MAX - DEPTH_MIN) * PX_PER_M + MARGIN * 2;

const xFor = (lat: number) => MARGIN + (lat - LAT_MIN) * PX_PER_M;
const yFor = (depth: number) => MARGIN + (depth - DEPTH_MIN) * PX_PER_M;

const ZONE_LABEL_OFFSET_Y = -4;

/**
 * A to-scale top-down (drone-view) diagram of the court, for placing a ball
 * target precisely instead of guessing from the small side-view height
 * picker alone. Shows both halves (own side below the net line, the
 * opponent's above it, since a serve's target crosses the net) plus a hint
 * of the free zone past each endline, real sidelines/attack-lines, and
 * dimmed zone-number reference dots. Click or drag anywhere to place the
 * marker; height stays a separate control (SideHeightPicker) since mixing
 * both into one gesture would make precise placement harder, not easier.
 */
export function TopDownTargetPicker({ lat, depth, onChange }: TopDownTargetPickerProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const fromPointer = (clientX: number, clientY: number): [number, number] => {
    const svg = svgRef.current;
    if (!svg) return [lat, depth];
    const rect = svg.getBoundingClientRect();
    const scaleX = SVG_W / rect.width;
    const scaleY = SVG_H / rect.height;
    const px = (clientX - rect.left) * scaleX;
    const py = (clientY - rect.top) * scaleY;
    const nextLat = Math.min(LAT_MAX, Math.max(LAT_MIN, (px - MARGIN) / PX_PER_M + LAT_MIN));
    const nextDepth = Math.min(DEPTH_MAX, Math.max(DEPTH_MIN, (py - MARGIN) / PX_PER_M + DEPTH_MIN));
    return [Math.round(nextLat * 10) / 10, Math.round(nextDepth * 10) / 10];
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    onChange(...fromPointer(e.clientX, e.clientY));
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.buttons === 0) return;
    onChange(...fromPointer(e.clientX, e.clientY));
  };

  const markerX = xFor(Math.min(LAT_MAX, Math.max(LAT_MIN, lat)));
  const markerY = yFor(Math.min(DEPTH_MAX, Math.max(DEPTH_MIN, depth)));
  const offCourt = depth < 0 || depth > HALF;

  return (
    <div className="topdown-picker">
      <svg
        ref={svgRef}
        width={SVG_W}
        height={SVG_H}
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        className="topdown-svg"
      >
        {/* Opponent's half — above the net line, for a serve's landing target. */}
        <rect
          x={xFor(LAT_MIN)}
          y={yFor(0)}
          width={xFor(LAT_MAX) - xFor(LAT_MIN)}
          height={yFor(-HALF) - yFor(0)}
          className="topdown-court-opponent"
        />
        {/* Own half. */}
        <rect
          x={xFor(LAT_MIN)}
          y={yFor(0)}
          width={xFor(LAT_MAX) - xFor(LAT_MIN)}
          height={yFor(HALF) - yFor(0)}
          className="topdown-court-own"
        />
        {/* Free zone hint past the own-side endline. */}
        <rect
          x={xFor(LAT_MIN)}
          y={yFor(HALF)}
          width={xFor(LAT_MAX) - xFor(LAT_MIN)}
          height={yFor(DEPTH_MAX) - yFor(HALF)}
          className="topdown-freezone"
        />

        <line x1={xFor(LAT_MIN)} y1={yFor(-ATTACK_M)} x2={xFor(LAT_MAX)} y2={yFor(-ATTACK_M)} className="topdown-attackline" />
        <line x1={xFor(LAT_MIN)} y1={yFor(ATTACK_M)} x2={xFor(LAT_MAX)} y2={yFor(ATTACK_M)} className="topdown-attackline" />
        <line x1={xFor(LAT_MIN)} y1={yFor(0)} x2={xFor(LAT_MAX)} y2={yFor(0)} className="topdown-net" />

        {(Object.keys(ZONE_BASE) as unknown as ZoneNumber[]).map((z) => {
          const anchor = ZONE_BASE[z];
          return (
            <g key={z}>
              <circle cx={xFor(anchor.lat)} cy={yFor(anchor.depth)} r={3} className="topdown-zone-dot" />
              <text x={xFor(anchor.lat)} y={yFor(anchor.depth) + ZONE_LABEL_OFFSET_Y} className="topdown-zone-label">
                {z}
              </text>
            </g>
          );
        })}

        <circle cx={markerX} cy={markerY} r={7} className={offCourt ? 'topdown-marker topdown-marker-off' : 'topdown-marker'} />
      </svg>
      <span className="topdown-label">
        lat {lat.toFixed(1)}m, depth {depth.toFixed(1)}m{offCourt ? ' (off own court)' : ''}
      </span>
    </div>
  );
}
