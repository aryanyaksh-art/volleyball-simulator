import { useLineupStore } from '@/app/store/useLineupStore';
import { deriveRotationState } from '@/app/deriveRotationState';

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

  const { alignment } = deriveRotationState(lineup, roster, focusSide, rotation, overrides);

  return (
    <div className="panel">
      <h3 className="panel-title">Validation: R{rotation + 1}</h3>

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
              [{v.pair[0]}, {v.pair[1]}] {v.message}
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
