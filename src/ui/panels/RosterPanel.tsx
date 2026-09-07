import { useState } from 'react';
import { useLineupStore } from '@/app/store/useLineupStore';
import type { PlayerRole } from '@/core/roster/types';

const ROLES: PlayerRole[] = ['S', 'OPP', 'OH', 'MB', 'L', 'DS'];

const nextAvailableNumber = (taken: Set<number>): number => {
  let n = 1;
  while (taken.has(n)) n++;
  return n;
};

export function RosterPanel() {
  const focusSide = useLineupStore((s) => s.focusSide);
  const roster = useLineupStore((s) => s.rosters[focusSide]);
  const addPlayer = useLineupStore((s) => s.addPlayer);
  const removePlayer = useLineupStore((s) => s.removePlayer);

  const takenNumbers = new Set(roster.players.map((p) => p.number));
  const [name, setName] = useState('');
  const [number, setNumber] = useState(() => nextAvailableNumber(takenNumbers));
  const [role, setRole] = useState<PlayerRole>('OH');
  const [handedness, setHandedness] = useState<'R' | 'L'>('R');
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setName('');
    setNumber(nextAvailableNumber(new Set(roster.players.map((p) => p.number))));
    setRole('OH');
    setHandedness('R');
    setError(null);
  };

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required.');
      return;
    }
    if (!Number.isInteger(number) || number <= 0) {
      setError('Number must be a positive whole number.');
      return;
    }
    if (takenNumbers.has(number)) {
      setError(`#${number} is already on this roster.`);
      return;
    }
    addPlayer(focusSide, { name: trimmed, number, primaryRole: role, handedness });
    resetForm();
  };

  return (
    <div className="panel">
      <h3 className="panel-title">Roster: {roster.name}</h3>
      <table className="panel-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Role</th>
            <th>Hand</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {roster.players.map((p) => (
            <tr key={p.id}>
              <td>{p.number}</td>
              <td>{p.name}</td>
              <td>
                {p.primaryRole}
                {p.secondaryRoles?.length ? ` (${p.secondaryRoles.join(', ')})` : ''}
              </td>
              <td>{p.handedness}</td>
              <td>
                <button className="chip chip-small" onClick={() => removePlayer(focusSide, p.id)}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="roster-add-form">
        <input
          className="roster-add-input roster-add-name"
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="roster-add-input roster-add-number"
          type="number"
          min={1}
          value={number}
          onChange={(e) => setNumber(Number(e.target.value))}
        />
        <select className="roster-add-input" value={role} onChange={(e) => setRole(e.target.value as PlayerRole)}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select className="roster-add-input" value={handedness} onChange={(e) => setHandedness(e.target.value as 'R' | 'L')}>
          <option value="R">R</option>
          <option value="L">L</option>
        </select>
        <button className="chip chip-active" onClick={handleAdd}>
          + Add player
        </button>
      </div>
      {error && <p className="roster-add-error">{error}</p>}
    </div>
  );
}
