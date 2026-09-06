import { useLineupStore } from '@/app/store/useLineupStore';

export function RosterPanel() {
  const focusSide = useLineupStore((s) => s.focusSide);
  const roster = useLineupStore((s) => s.rosters[focusSide]);

  return (
    <div className="panel">
      <h3 className="panel-title">Roster — {roster.name}</h3>
      <table className="panel-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Role</th>
            <th>Hand</th>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
