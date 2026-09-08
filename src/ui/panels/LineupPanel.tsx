import { useLineupStore } from '@/app/store/useLineupStore';
import { validateLineupComposition } from '@/core/lineup/systems';
import type { LineupSystem } from '@/core/lineup/types';
import { isPlayerDrag, readPlayerDragPayload, writePlayerDragPayload } from '@/ui/dragPlayer';

const SYSTEMS: LineupSystem[] = ['5-1', '6-2', '4-2'];

export function LineupPanel() {
  const focusSide = useLineupStore((s) => s.focusSide);
  const roster = useLineupStore((s) => s.rosters[focusSide]);
  const lineup = useLineupStore((s) => s.lineups[focusSide]);
  const setSystem = useLineupStore((s) => s.setSystem);
  const setOrderSlot = useLineupStore((s) => s.setOrderSlot);

  const warnings = validateLineupComposition(lineup, roster);

  const handleSlotDrop = (targetSlot: number, dataTransfer: DataTransfer) => {
    const payload = readPlayerDragPayload(dataTransfer);
    if (!payload) return;
    if (payload.source === 'bench') {
      setOrderSlot(focusSide, targetSlot, payload.playerId);
    } else if (payload.slot != null && payload.slot !== targetSlot) {
      const targetCurrent = lineup.order[targetSlot];
      setOrderSlot(focusSide, targetSlot, payload.playerId);
      setOrderSlot(focusSide, payload.slot, targetCurrent);
    }
  };

  return (
    <div className="panel">
      <h3 className="panel-title">Lineup: {lineup.name}</h3>

      <div className="control-group">
        <span className="control-label">System</span>
        {SYSTEMS.map((system) => (
          <button
            key={system}
            className={system === lineup.system ? 'chip chip-active' : 'chip'}
            onClick={() => setSystem(focusSide, system)}
          >
            {system}
          </button>
        ))}
      </div>

      <table className="panel-table">
        <thead>
          <tr>
            <th>Slot</th>
            <th>Player (serve order)</th>
          </tr>
        </thead>
        <tbody>
          {lineup.order.map((playerId, slot) => (
            <tr
              key={slot}
              className="lineup-slot-row"
              draggable={playerId != null}
              onDragStart={(e) => playerId && writePlayerDragPayload(e.dataTransfer, { source: 'slot', playerId, slot })}
              onDragOver={(e) => {
                if (isPlayerDrag(e.dataTransfer)) e.preventDefault();
              }}
              onDrop={(e) => handleSlotDrop(slot, e.dataTransfer)}
            >
              <td>{slot + 1}</td>
              <td>
                <select value={playerId ?? ''} onChange={(e) => setOrderSlot(focusSide, slot, e.target.value || null)}>
                  <option value="">(empty)</option>
                  {roster.players
                    .filter((p) => p.primaryRole !== 'L')
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {warnings.length > 0 && (
        <ul className="panel-warnings">
          {warnings.map((w) => (
            <li key={w.code}>{w.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
