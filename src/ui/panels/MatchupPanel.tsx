import { useMemo } from 'react';
import { useLineupStore } from '@/app/store/useLineupStore';
import { useMatchupStore } from '@/app/store/useMatchupStore';
import { deriveMatchupState } from '@/app/deriveMatchupState';
import type { Side } from '@/core/court/coordinates';
import type { AttackZone, BlockScheme, SetCall } from '@/core/tactics/attack';
import { SET_TEMPO_S, ZONE_TO_ROLE } from '@/core/tactics/attack';
import type { DefensiveSystem } from '@/core/tactics/defense';
import { otherSide } from '@/core/court/coordinates';
import { findPlayer } from '@/core/roster/types';
import { breakdown } from '@/core/lineup/systems';

const ATTACK_ZONES: AttackZone[] = [4, 3, 2, 6];
const SET_CALLS = Object.keys(SET_TEMPO_S) as SetCall[];
const BLOCK_SCHEMES: BlockScheme[] = ['spread', 'bunch-read', 'bunch-commit', 'release'];
const DEFENSIVE_SYSTEMS: DefensiveSystem[] = ['perimeter', 'rotation', 'man-up', 'six-back'];

export function MatchupPanel() {
  const attackingSide = useMatchupStore((s) => s.attackingSide);
  const attackZone = useMatchupStore((s) => s.attackZone);
  const setCall = useMatchupStore((s) => s.setCall);
  const lateralSign = useMatchupStore((s) => s.lateralSign);
  const blockScheme = useMatchupStore((s) => s.blockScheme);
  const defensiveSystem = useMatchupStore((s) => s.defensiveSystem);
  const tipDefenderSlot = useMatchupStore((s) => s.tipDefenderSlot);
  const setAttackingSide = useMatchupStore((s) => s.setAttackingSide);
  const setAttackZone = useMatchupStore((s) => s.setAttackZone);
  const setSetCall = useMatchupStore((s) => s.setSetCall);
  const setLateralSign = useMatchupStore((s) => s.setLateralSign);
  const setBlockScheme = useMatchupStore((s) => s.setBlockScheme);
  const setDefensiveSystem = useMatchupStore((s) => s.setDefensiveSystem);
  const setTipDefenderSlot = useMatchupStore((s) => s.setTipDefenderSlot);

  const rosters = useLineupStore((s) => s.rosters);
  const lineups = useLineupStore((s) => s.lineups);
  const rotations = useLineupStore((s) => s.rotations);

  const defendingSide: Side = otherSide(attackingSide);

  const matchup = useMemo(
    () =>
      deriveMatchupState({
        attackingSide,
        attackZone,
        setCall,
        lateralSign,
        blockScheme,
        defensiveSystem,
        tipDefenderSlot,
        rosters,
        lineups,
        rotations,
      }),
    [attackingSide, attackZone, setCall, lateralSign, blockScheme, defensiveSystem, tipDefenderSlot, rosters, lineups, rotations],
  );

  const defenderSlots = useMemo(
    () => breakdown(lineups[defendingSide], rosters[defendingSide], defendingSide, rotations[defendingSide]).onCourt,
    [lineups, rosters, rotations, defendingSide],
  );

  const inShadowIds = new Set(matchup.shadowDefenders.filter((d) => d.inShadow).map((d) => d.onCourtId));

  return (
    <div className="panel">
      <div className="panel-title-row">
        <h3 className="panel-title">Attack/defense matchup</h3>
        <div className="control-group">
          <span className="control-label">Attacking</span>
          <button className={attackingSide === 'A' ? 'chip chip-active' : 'chip'} onClick={() => setAttackingSide('A')}>
            A
          </button>
          <button className={attackingSide === 'B' ? 'chip chip-active' : 'chip'} onClick={() => setAttackingSide('B')}>
            B
          </button>
        </div>
      </div>

      <div className="control-group">
        <span className="control-label">Attack zone</span>
        {ATTACK_ZONES.map((z) => (
          <button key={z} className={attackZone === z ? 'chip chip-active' : 'chip'} onClick={() => setAttackZone(z)}>
            {z} ({ZONE_TO_ROLE[z]})
          </button>
        ))}
      </div>

      <div className="control-group">
        <span className="control-label">Set call</span>
        {SET_CALLS.map((call) => (
          <button key={call} className={setCall === call ? 'chip chip-active' : 'chip'} onClick={() => setSetCall(call)}>
            {call} ({SET_TEMPO_S[call].toFixed(2)}s)
          </button>
        ))}
      </div>

      <div className="control-group">
        <span className="control-label">Approach from</span>
        <button className={lateralSign === -1 ? 'chip chip-active' : 'chip'} onClick={() => setLateralSign(-1)}>
          Left
        </button>
        <button className={lateralSign === 1 ? 'chip chip-active' : 'chip'} onClick={() => setLateralSign(1)}>
          Right
        </button>
      </div>

      <div className="control-group">
        <span className="control-label">Block scheme</span>
        {BLOCK_SCHEMES.map((scheme) => (
          <button key={scheme} className={blockScheme === scheme ? 'chip chip-active' : 'chip'} onClick={() => setBlockScheme(scheme)}>
            {scheme}
          </button>
        ))}
      </div>

      <div className="control-group">
        <span className="control-label">Defense</span>
        {DEFENSIVE_SYSTEMS.map((system) => (
          <button
            key={system}
            className={defensiveSystem === system ? 'chip chip-active' : 'chip'}
            onClick={() => setDefensiveSystem(system)}
          >
            {system}
          </button>
        ))}
      </div>

      <div className="control-group">
        <span className="control-label">Tip coverage</span>
        <select value={tipDefenderSlot ?? ''} onChange={(e) => setTipDefenderSlot(e.target.value === '' ? null : Number(e.target.value))}>
          <option value="">none assigned</option>
          {defenderSlots.map((p) => {
            const player = findPlayer(rosters[defendingSide], p.playerId);
            const label = player ? `#${player.number} ${player.name}` : `slot ${p.slot + 1}`;
            return (
              <option key={p.slot} value={p.slot}>
                {label} (zone {p.zone ?? '-'})
              </option>
            );
          })}
        </select>
      </div>

      <p className="panel-note">
        {ZONE_TO_ROLE[attackZone]} approach: {matchup.approachLane.steps}-step, {matchup.approachLane.lengthM.toFixed(1)} m at{' '}
        {matchup.approachLane.angleDeg}°.
      </p>

      {matchup.blockFeasibility.length === 0 ? (
        <p className="panel-note">Release scheme: no block up, defense drops straight to coverage.</p>
      ) : (
        <table className="panel-table">
          <thead>
            <tr>
              <th>Blocker</th>
              <th>Mode</th>
              <th>Feasible</th>
            </tr>
          </thead>
          <tbody>
            {matchup.blockFeasibility.map((bf, i) => (
              <tr key={i}>
                <td>{bf.mode === 'crossover' ? 'long travel' : 'short travel'}</td>
                <td>{bf.mode}</td>
                <td className={bf.feasible ? 'margin-ok' : 'violation-error'}>{bf.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {matchup.blockShadowPolygon.length > 0 && (
        <p className="panel-note">
          Defenders in block shadow:{' '}
          {inShadowIds.size === 0 ? 'none' : Array.from(inShadowIds).join(', ')}
          {blockScheme !== 'bunch-read' && blockScheme !== 'bunch-commit' && inShadowIds.size > 0 && (
            <span className="violation-warning"> (DEFENDER_IN_SHADOW under {blockScheme})</span>
          )}
        </p>
      )}

      {matchup.tipCoverage && (
        <p className={matchup.tipCoverage.covered ? 'panel-note margin-ok' : 'panel-note violation-error'}>
          {matchup.tipCoverage.covered
            ? `Tip covered (margin ${matchup.tipCoverage.marginM.toFixed(2)} m).`
            : `TIP_UNCOVERED: short by ${Math.abs(matchup.tipCoverage.marginM).toFixed(2)} m.`}
        </p>
      )}
      {!matchup.tipCoverage && tipDefenderSlot == null && <p className="panel-note">Assign a tip defender to check tip coverage.</p>}
    </div>
  );
}
