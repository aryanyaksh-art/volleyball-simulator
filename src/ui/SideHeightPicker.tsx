import { useRef } from 'react';

interface SideHeightPickerProps {
  apexM: number;
  onChange: (apexM: number) => void;
  maxM?: number;
}

const WIDTH = 90;
const HEIGHT = 160;
const FLOOR_Y = HEIGHT - 12;
const TOP_Y = 12;

/** A simple side-on diagram (floor line, draggable dot for the arc's peak) for adjusting a ball segment's apex height without typing a number. */
export function SideHeightPicker({ apexM, onChange, maxM = 5 }: SideHeightPickerProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const clampedApex = Math.min(Math.max(apexM, 0), maxM);
  const markerY = FLOOR_Y - (clampedApex / maxM) * (FLOOR_Y - TOP_Y);

  const yToApex = (clientY: number): number => {
    const svg = svgRef.current;
    if (!svg) return clampedApex;
    const rect = svg.getBoundingClientRect();
    const y = clientY - rect.top;
    const t = 1 - (y - TOP_Y) / (FLOOR_Y - TOP_Y);
    return Math.min(Math.max(t * maxM, 0), maxM);
  };

  const handlePointerDown = (e: React.PointerEvent<SVGCircleElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    onChange(yToApex(e.clientY));
  };

  const handlePointerMove = (e: React.PointerEvent<SVGCircleElement>) => {
    if (e.buttons === 0) return;
    onChange(yToApex(e.clientY));
  };

  return (
    <div className="side-height-picker">
      <svg ref={svgRef} width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <line x1={10} y1={FLOOR_Y} x2={WIDTH - 10} y2={FLOOR_Y} className="side-height-floor" />
        <line x1={20} y1={markerY} x2={WIDTH - 20} y2={FLOOR_Y} className="side-height-arc" />
        <line x1={20} y1={markerY} x2={WIDTH - 20} y2={markerY} className="side-height-guide" />
        <circle
          cx={WIDTH / 2}
          cy={markerY}
          r={7}
          className="side-height-handle"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
        />
      </svg>
      <span className="side-height-label">{clampedApex.toFixed(1)} m</span>
    </div>
  );
}
