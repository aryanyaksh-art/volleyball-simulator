import { useLineupStore } from '@/app/store/useLineupStore';
import { useAppStore } from '@/app/store/useAppStore';
import { deriveRotationState, effectivePosition } from '@/app/deriveRotationState';
import { breakdown } from '@/core/lineup/systems';
import { nudgeToLegal, type AlignedPlayer } from '@/core/rules/overlap';
import { toWorld, type LocalPos } from '@/core/court/coordinates';
import type { ZoneNumber } from '@/core/court/zones';

const marginClass = (marginM: number): string => {
  if (marginM <= 0) return 'margin-bad';
  if (marginM < 0.15) return 'margin-tight';
  return 'margin-ok';
};

export function ValidationPanel() {
  const focusSide = useLineupStore((s) => s.focusSide);
  const roster = useLineupStore((s) => s.rosters[focusSide]);
  const lineup = useLineupStore((s) => s.lineups[focusSide]);
  const rotation = useLineupStore((s) => s.rotations[focusSide]);
  const overrides = useLineupStore((s) => s.positionOverrides[focusSide]);
  const setPositionOverride = useLineupStore((s) => s.setPositionOverride);
  const focusCameraOn = useAppStore((s) => s.focusCameraOn);

  const { breakdown: rotationBreakdown, alignment } = deriveRotationState(lineup, roster, focusSide, rotation, overrides);

  const zoneById = new Map(rotationBreakdown.onCourt.filter((p) => p.zone != null).map((p) => [p.onCourtId, p.zone!]));

  const handleFixAlignment = () => {
    const buildPlayers = (positions: Partial<Record<ZoneNumber, LocalPos>>): AlignedPlayer[] => {
      const b = breakdown(lineup, roster, focusSide, rotation);
      return b.onCourt
        .filter((p) => p.zone != null)
        .map((p) => ({ onCourtId: p.onCourtId, zone: p.zone!, pos: effectivePosition(p.zone!, positions), isServer: p.isServer }));
    };
    const { positions } = nudgeToLegal(overrides, buildPlayers, focusSide, rotation);
    for (const zoneStr of Object.keys(positions)) {
      const zone = Number(zoneStr) as ZoneNumber;
      const pos = positions[zone];
      if (pos) setPositionOverride(focusSide, zone, pos);
    }
  };

  const handleFocusViolation = (players: [string, string]) => {
    const zones = players.map((id) => zoneById.get(id)).filter((z): z is ZoneNumber => z != null);
    if (zones.length === 0) return;
    const points = zones.map((z) => toWorld(effectivePosition(z, overrides), focusSide));
    const midpoint = {
      x: points.reduce((a, p) => a + p.x, 0) / points.length,
      y: points.reduce((a, p) => a + p.y, 0) / points.length,
      z: points.reduce((a, p) => a + p.z, 0) / points.length,
    };
    focusCameraOn(midpoint);
  };

  return (
    <div className="panel">
      <div className="panel-title-row">
        <h3 className="panel-title">Validation: R{rotation + 1}</h3>
        {alignment.checked && !alignment.legal && (
          <button className="chip" onClick={handleFixAlignment}>
            Fix alignment
          </button>
        )}
      </div>

      {!alignment.checked && (
        <p className="panel-note">Not checked: {alignment.skippedReason}</p>
      )}

      {alignment.checked && (
        <p className={alignment.legal ? 'validation-status validation-legal' : 'validation-status validation-illegal'}>
          {alignment.legal ? 'Legal alignment' : 'Overlap violation'}
        </p>
      )}

      {alignment.violations.length > 0 && (
        <ul className="panel-warnings">
          {alignment.violations.map((v, i) => (
            <li key={i} className={v.severity === 'error' ? 'violation-error' : 'violation-warning'}>
              [{v.pair[0]}, {v.pair[1]}] {v.message}{' '}
              <button className="chip chip-small" onClick={() => handleFocusViolation(v.players)}>
                Focus
              </button>
            </li>
          ))}
        </ul>
      )}

      {alignment.margins.length > 0 && (
        <table className="panel-table">
          <thead>
            <tr>
              <th>Pair</th>
              <th>Axis</th>
              <th>Margin</th>
            </tr>
          </thead>
          <tbody>
            {alignment.margins.map((m, i) => (
              <tr key={i} className={marginClass(m.marginM)}>
                <td>
                  {m.pair[0]}–{m.pair[1]}
                </td>
                <td>{m.axis}</td>
                <td>{m.marginM.toFixed(2)} m</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
