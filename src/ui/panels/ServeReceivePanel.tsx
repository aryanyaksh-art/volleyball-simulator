import { useMemo } from 'react';
import { useLineupStore } from '@/app/store/useLineupStore';
import { useServeReceiveStore } from '@/app/store/useServeReceiveStore';
import { breakdown } from '@/core/lineup/systems';
import { findPlayer } from '@/core/roster/types';
import { effectivePosition } from '@/core/court/anchors';
import { otherSide, toWorld } from '@/core/court/coordinates';
import type { ZoneNumber } from '@/core/court/zones';
import { analyzeServeReceive, checkSetterInSeam, type Passer } from '@/core/tactics/serveReceive';

const ORIGIN_ZONES: ZoneNumber[] = [1, 5, 6];
const CONTACT_HEIGHT_M = 2.2;

export function ServeReceivePanel() {
  const receivingSide = useServeReceiveStore((s) => s.receivingSide);
  const passerSlots = useServeReceiveStore((s) => s.passerSlots);
  const passerWeights = useServeReceiveStore((s) => s.passerWeights);
  const serveOriginZone = useServeReceiveStore((s) => s.serveOriginZone);
  const setReceivingSide = useServeReceiveStore((s) => s.setReceivingSide);
  const togglePasserSlot = useServeReceiveStore((s) => s.togglePasserSlot);
  const setPasserWeight = useServeReceiveStore((s) => s.setPasserWeight);
  const setServeOriginZone = useServeReceiveStore((s) => s.setServeOriginZone);

  const rosters = useLineupStore((s) => s.rosters);
  const lineups = useLineupStore((s) => s.lineups);
  const rotations = useLineupStore((s) => s.rotations);
  const positionOverrides = useLineupStore((s) => s.positionOverrides);

  const servingSide = otherSide(receivingSide);
  const b = breakdown(lineups[receivingSide], rosters[receivingSide], receivingSide, rotations[receivingSide]);

  const analysis = useMemo(() => {
    if (passerSlots.length === 0) return null;

    const passers: Passer[] = passerSlots
      .map((slot) => {
        const p = b.onCourt.find((oc) => oc.slot === slot);
        if (!p || p.zone == null) return null;
        return {
          onCourtId: p.onCourtId,
          pos: effectivePosition(p.zone, positionOverrides[receivingSide]),
          weight: passerWeights[slot] ?? 1,
        };
      })
      .filter((p): p is Passer => p !== null);

    if (passers.length === 0) return null;

    const serveOriginWorld = toWorld(
      effectivePosition(serveOriginZone, positionOverrides[servingSide]),
      servingSide,
      CONTACT_HEIGHT_M,
    );

    const cells = analyzeServeReceive({ side: receivingSide, passers, serveOriginWorld, cellSizeM: 0.4 });

    const setter = b.onCourt.find((p) => p.onCourtId === b.setterOnCourtId);
    const setterInSeam =
      setter?.zone != null ? checkSetterInSeam(cells, effectivePosition(setter.zone, positionOverrides[receivingSide])) : false;

    const counts = { safe: 0, tight: 0, uncovered: 0 };
    for (const cell of cells) counts[cell.severity]++;

    return { cells, counts, setterInSeam };
  }, [passerSlots, passerWeights, b, positionOverrides, receivingSide, servingSide, serveOriginZone]);

  return (
    <div className="panel">
      <div className="panel-title-row">
        <h3 className="panel-title">Serve-receive</h3>
        <div className="control-group">
          <span className="control-label">Receiving</span>
          <button className={receivingSide === 'A' ? 'chip chip-active' : 'chip'} onClick={() => setReceivingSide('A')}>
            A
          </button>
          <button className={receivingSide === 'B' ? 'chip chip-active' : 'chip'} onClick={() => setReceivingSide('B')}>
            B
          </button>
        </div>
      </div>

      <div className="control-group">
        <span className="control-label">Serve from (side {servingSide}, zone)</span>
        {ORIGIN_ZONES.map((z) => (
          <button key={z} className={serveOriginZone === z ? 'chip chip-active' : 'chip'} onClick={() => setServeOriginZone(z)}>
            {z}
          </button>
        ))}
      </div>

      <table className="panel-table">
        <thead>
          <tr>
            <th>Passer</th>
            <th>Zone</th>
            <th>Weight</th>
          </tr>
        </thead>
        <tbody>
          {b.onCourt.map((p) => {
            const player = findPlayer(rosters[receivingSide], p.playerId);
            const label = player ? `#${player.number} ${player.name}` : `slot ${p.slot + 1}`;
            const isPasser = passerSlots.includes(p.slot);
            return (
              <tr key={p.onCourtId}>
                <td>
                  <label>
                    <input type="checkbox" checked={isPasser} onChange={() => togglePasserSlot(p.slot)} /> {label}
                  </label>
                </td>
                <td>{p.zone}</td>
                <td>
                  {isPasser && (
                    <input
                      type="number"
                      step={0.1}
                      min={0.5}
                      value={passerWeights[p.slot] ?? 1}
                      onChange={(e) => setPasserWeight(p.slot, Number(e.target.value))}
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {passerSlots.length === 0 && <p className="panel-note">Check at least one passer to see coverage.</p>}

      {analysis && (
        <>
          <div className="coverage-summary">
            <span className="coverage-safe">{analysis.counts.safe} safe</span>
            <span className="coverage-tight">{analysis.counts.tight} tight</span>
            <span className="coverage-uncovered">{analysis.counts.uncovered} uncovered</span>
          </div>
          {analysis.counts.uncovered > 0 && (
            <p className="panel-note violation-error">
              This serve origin can reach {analysis.counts.uncovered} spot{analysis.counts.uncovered === 1 ? '' : 's'} faster than
              any passer can get there.
            </p>
          )}
          {analysis.setterInSeam && <p className="panel-note violation-warning">SETTER_IN_SEAM: the setter's own zone sits in a seam.</p>}
        </>
      )}
    </div>
  );
}
