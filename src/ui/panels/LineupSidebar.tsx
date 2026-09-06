import { useLineupStore } from '@/app/store/useLineupStore';
import type { Side } from '@/core/court/coordinates';
import { RosterPanel } from './RosterPanel';
import { LineupPanel } from './LineupPanel';
import { RotationWheel } from './RotationWheel';
import { ValidationPanel } from './ValidationPanel';
import { FormationPanel } from './FormationPanel';
import { BenchPanel } from './BenchPanel';

const SIDES: Side[] = ['A', 'B'];

export function LineupSidebar() {
  const focusSide = useLineupStore((s) => s.focusSide);
  const setFocusSide = useLineupStore((s) => s.setFocusSide);

  return (
    <div className="lineup-sidebar">
      <div className="control-group">
        <span className="control-label">Side</span>
        {SIDES.map((side) => (
          <button
            key={side}
            className={side === focusSide ? 'chip chip-active' : 'chip'}
            onClick={() => setFocusSide(side)}
          >
            {side}
          </button>
        ))}
      </div>
      <RotationWheel />
      <ValidationPanel />
      <FormationPanel />
      <LineupPanel />
      <BenchPanel />
      <RosterPanel />
    </div>
  );
}
