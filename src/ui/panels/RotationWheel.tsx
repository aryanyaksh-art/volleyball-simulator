import { useLineupStore } from '@/app/store/useLineupStore';
import { deriveRotationState } from '@/app/deriveRotationState';

const ROTATIONS = [0, 1, 2, 3, 4, 5];

export function RotationWheel() {
  const focusSide = useLineupStore((s) => s.focusSide);
  const roster = useLineupStore((s) => s.rosters[focusSide]);
  const lineup = useLineupStore((s) => s.lineups[focusSide]);
  const rotation = useLineupStore((s) => s.rotations[focusSide]);
  const setRotation = useLineupStore((s) => s.setRotation);
  const overrides = useLineupStore((s) => s.positionOverrides[focusSide]);

  return (
    <div className="panel">
      <h3 className="panel-title">Rotation</h3>
      <div className="rotation-wheel">
        {ROTATIONS.map((r) => {
          const { breakdown, alignment } = deriveRotationState(lineup, roster, focusSide, r, overrides);
          const active = r === rotation;
          return (
            <button
              key={r}
              className={active ? 'rotation-tile rotation-tile-active' : 'rotation-tile'}
              onClick={() => setRotation(focusSide, r)}
            >
              <div className="rotation-tile-header">
                <span>R{r + 1}</span>
                <span className={alignment.checked && !alignment.legal ? 'legality-dot legality-bad' : 'legality-dot legality-ok'} />
              </div>
              <div className="rotation-tile-body">
                <div>Setter: zone {breakdown.setterZone ?? '—'} ({breakdown.setterRow ?? '—'})</div>
                <div>Front-row attackers: {breakdown.frontRowAttackerCount}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
