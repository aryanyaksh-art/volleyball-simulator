import { useMemo } from 'react';
import { useLineupStore } from '@/app/store/useLineupStore';
import { useServeReceiveStore } from '@/app/store/useServeReceiveStore';
import { breakdown } from '@/core/lineup/systems';
import { findPlayer } from '@/core/roster/types';
import { effectivePosition } from '@/core/court/anchors';
import { otherSide, toLocal, toWorld } from '@/core/court/coordinates';
import type { ZoneNumber } from '@/core/court/zones';
import { playerSlotInZone } from '@/core/lineup/rotation';
import { analyzeServeReceive, analyzeSingleServe, buildPassers, checkSetterInSeam, SERVE_PROFILES } from '@/core/tactics/serveReceive';
import { SERVE_RECEIVE_PRESETS, SERVE_RECEIVE_PRESET_IDS } from '@/core/tactics/serveReceivePresets';
import { TopDownTargetPicker } from '@/ui/TopDownTargetPicker';

const ORIGIN_ZONES: ZoneNumber[] = [1, 5, 6];
const CONTACT_HEIGHT_M = 2.2;

export function ServeReceivePanel() {
  const receivingSide = useServeReceiveStore((s) => s.receivingSide);
  const passerSlots = useServeReceiveStore((s) => s.passerSlots);
  const passerWeights = useServeReceiveStore((s) => s.passerWeights);
  const serveOriginZone = useServeReceiveStore((s) => s.serveOriginZone);
  const serveTargetOverride = useServeReceiveStore((s) => s.serveTargetOverride);
  const serveType = useServeReceiveStore((s) => s.serveType);
  const setReceivingSide = useServeReceiveStore((s) => s.setReceivingSide);
  const togglePasserSlot = useServeReceiveStore((s) => s.togglePasserSlot);
  const setPasserSlots = useServeReceiveStore((s) => s.setPasserSlots);
  const setPasserWeight = useServeReceiveStore((s) => s.setPasserWeight);
  const setServeOriginZone = useServeReceiveStore((s) => s.setServeOriginZone);
  const setServeTargetOverride = useServeReceiveStore((s) => s.setServeTargetOverride);
  const setServeType = useServeReceiveStore((s) => s.setServeType);

  const rosters = useLineupStore((s) => s.rosters);
  const lineups = useLineupStore((s) => s.lineups);
  const rotations = useLineupStore((s) => s.rotations);
  const positionOverrides = useLineupStore((s) => s.positionOverrides);

  const servingSide = otherSide(receivingSide);
  const b = breakdown(lineups[receivingSide], rosters[receivingSide], receivingSide, rotations[receivingSide]);
  const profile = SERVE_PROFILES[serveType];

  const applyPreset = (presetId: (typeof SERVE_RECEIVE_PRESET_IDS)[number]) => {
    const preset = SERVE_RECEIVE_PRESETS[presetId];
    const rotation = rotations[receivingSide];
    setPasserSlots(preset.passerZones.map((zone) => playerSlotInZone(rotation, zone)));
    if (preset.positions) {
      for (const [zoneStr, pos] of Object.entries(preset.positions)) {
        if (pos) useLineupStore.getState().setPositionOverride(receivingSide, Number(zoneStr) as ZoneNumber, pos);
      }
    }
  };

  const analysis = useMemo(() => {
    if (passerSlots.length === 0) return null;

    const passers = buildPassers(b, positionOverrides[receivingSide], passerSlots, passerWeights);
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

    let singleServe = null as ReturnType<typeof analyzeSingleServe> | null;
    if (serveTargetOverride) {
      // serveTargetOverride is placed in the SERVING side's own frame (the
      // natural "I'm the server, aiming at the opponent's court" framing
      // guided authoring's own serve UI already uses) — convert to the
      // receiving side's frame, which is what analyzeSingleServe's `side`
      // and every cell in `cells` are already expressed in.
      const targetInReceivingFrame = toLocal(toWorld(serveTargetOverride, servingSide, 0), receivingSide);
      singleServe = analyzeSingleServe({
        side: receivingSide,
        passers,
        serveOriginWorld,
        target: targetInReceivingFrame,
        serveApexM: profile.apexM,
        serveSpeedMps: profile.speedMps,
      });
    }

    return { cells, counts, setterInSeam, singleServe };
  }, [passerSlots, passerWeights, b, positionOverrides, receivingSide, servingSide, serveOriginZone, serveTargetOverride, profile]);

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

      <div className="control-group">
        <span className="control-label">Formation</span>
        {SERVE_RECEIVE_PRESET_IDS.map((id) => (
          <button key={id} className="chip chip-small" onClick={() => applyPreset(id)}>
            {SERVE_RECEIVE_PRESETS[id].label}
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

      <div className="control-group">
        <span className="control-label">Aim a specific serve</span>
        <button className={serveType === 'float' ? 'chip chip-active' : 'chip'} onClick={() => setServeType('float')}>
          Float
        </button>
        <button className={serveType === 'jump' ? 'chip chip-active' : 'chip'} onClick={() => setServeType('jump')}>
          Jump
        </button>
        {serveTargetOverride && (
          <button className="chip chip-small" onClick={() => setServeTargetOverride(null)}>
            Clear
          </button>
        )}
      </div>
      <TopDownTargetPicker
        lat={serveTargetOverride?.lat ?? 0}
        depth={serveTargetOverride?.depth ?? 0}
        onChange={(lat, depth) => setServeTargetOverride({ lat, depth })}
      />
      {analysis?.singleServe && (
        <p
          className={
            analysis.singleServe.severity === 'safe'
              ? 'panel-note margin-ok'
              : analysis.singleServe.severity === 'tight'
                ? 'panel-note violation-warning'
                : 'panel-note violation-error'
          }
        >
          This exact serve:{' '}
          {analysis.singleServe.marginS == null
            ? 'never descends to a playable height (too flat/high for this apex).'
            : analysis.singleServe.marginS >= 0
              ? `safe, +${analysis.singleServe.marginS.toFixed(2)}s to spare.`
              : `uncovered by ${Math.abs(analysis.singleServe.marginS).toFixed(2)}s.`}
        </p>
      )}

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
