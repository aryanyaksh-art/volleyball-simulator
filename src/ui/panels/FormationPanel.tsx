import { useLineupStore } from '@/app/store/useLineupStore';
import { effectivePosition } from '@/app/deriveRotationState';
import type { ZoneNumber } from '@/core/court/zones';

const ZONES: ZoneNumber[] = [4, 3, 2, 5, 6, 1]; // front row then back row, matching the court layout

/**
 * Manual per-zone position editor. There's no drag-to-position play editor
 * until Phase 3, so this is the stand-in for now: the only way to actually
 * push a formation out of legal alignment and watch the validator react.
 */
export function FormationPanel() {
  const focusSide = useLineupStore((s) => s.focusSide);
  const overrides = useLineupStore((s) => s.positionOverrides[focusSide]);
  const setPositionOverride = useLineupStore((s) => s.setPositionOverride);
  const resetPositionOverrides = useLineupStore((s) => s.resetPositionOverrides);

  const hasOverrides = Object.keys(overrides).length > 0;

  return (
    <div className="panel">
      <div className="panel-title-row">
        <h3 className="panel-title">Formation (zone positions)</h3>
        <button className="chip" onClick={() => resetPositionOverrides(focusSide)} disabled={!hasOverrides}>
          Reset to anchors
        </button>
      </div>
      <table className="panel-table">
        <thead>
          <tr>
            <th>Zone</th>
            <th>Lateral (m)</th>
            <th>Depth (m)</th>
          </tr>
        </thead>
        <tbody>
          {ZONES.map((zone) => {
            const pos = effectivePosition(zone, overrides);
            return (
              <tr key={zone}>
                <td>{zone}</td>
                <td>
                  <input
                    type="number"
                    step={0.1}
                    value={pos.lat}
                    onChange={(e) => setPositionOverride(focusSide, zone, { ...pos, lat: Number(e.target.value) })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step={0.1}
                    value={pos.depth}
                    onChange={(e) => setPositionOverride(focusSide, zone, { ...pos, depth: Number(e.target.value) })}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
