import { SETTER_TARGET } from '@/core/court/anchors';
import type { Play } from '@/core/play/types';

/**
 * Serve -> pass -> set -> attack, at rotation 0 for both sides' 5-1 demo
 * lineups. A's setter (zone 1) serves to B's zone 5; B's OH2 passes to the
 * setter target; B's setter feeds the zone-4 opposite; the opposite attacks
 * back across the net. Exercises the whole compile/evaluate pipeline: two
 * net crossings in opposite directions, zoneAnchor/atPlayer refs, holds,
 * and a jump.
 */
export const DEMO_PLAY: Play = {
  id: 'demo-serve-attack',
  name: 'Serve, pass, set, attack',
  schemaVersion: 1,
  scenario: {
    lineupIds: { A: 'lineup-A', B: 'lineup-B' },
    rotations: { A: 0, B: 0 },
  },
  initial: {
    players: [],
    ball: { side: 'A', pos: { lat: 3, depth: 8.7 }, y: 1.3 },
  },
  serveContactStepId: 'serve',
  steps: [
    {
      id: 'serve',
      name: 'Serve',
      duration: 1.1,
      ball: {
        kind: 'serve',
        profile: 'floatServe',
        from: { kind: 'local', side: 'A', pos: { lat: 3, depth: 8.7 }, y: 1.3 },
        to: { kind: 'zoneAnchor', side: 'B', zone: 5 },
        apexM: 3.2,
      },
      movements: [
        {
          who: { side: 'A', kind: 'zone', zone: 1 },
          to: { kind: 'local', side: 'A', pos: { lat: 3, depth: 8.5 } },
          mode: 'approach',
          pose: 'serveContact',
          duration: 0.35,
        },
      ],
    },
    {
      id: 'pass',
      name: 'Pass',
      duration: 1.3,
      ball: {
        kind: 'pass',
        profile: 'pass',
        from: { kind: 'zoneAnchor', side: 'B', zone: 5, y: 0.9 },
        to: { kind: 'local', side: 'B', pos: SETTER_TARGET, y: 2.6 },
        apexM: 3.0,
        duration: 0.85,
      },
      movements: [
        {
          who: { side: 'B', kind: 'zone', zone: 5 },
          to: { kind: 'local', side: 'B', pos: { lat: -2.6, depth: 5.8 } },
          mode: 'shuffle',
          pose: 'passLow',
        },
        {
          who: { side: 'B', kind: 'zone', zone: 1 },
          to: { kind: 'local', side: 'B', pos: SETTER_TARGET },
          mode: 'sprint',
          pose: 'ready',
        },
      ],
    },
    {
      id: 'set',
      name: 'Set',
      duration: 0.75,
      ball: {
        kind: 'set',
        profile: '31',
        from: { kind: 'atPlayer', who: { side: 'B', kind: 'role', role: 'S' }, contact: 'hands' },
        to: { kind: 'zoneAnchor', side: 'B', zone: 4, y: 2.3 },
        apexM: 3.5,
      },
      movements: [
        {
          who: { side: 'B', kind: 'role', role: 'S' },
          to: { kind: 'local', side: 'B', pos: SETTER_TARGET },
          mode: 'hold',
          pose: 'set',
        },
      ],
    },
    {
      id: 'attack',
      name: 'Attack',
      duration: 0.45,
      ball: {
        kind: 'attack',
        profile: 'attack',
        from: { kind: 'zoneAnchor', side: 'B', zone: 4, y: 2.3 },
        to: { kind: 'local', side: 'A', pos: { lat: 0, depth: 6.5 }, y: 0 },
        apexM: 2.9,
        apexU: 0.15,
      },
      movements: [
        {
          who: { side: 'B', kind: 'zone', zone: 4 },
          to: { kind: 'zoneAnchor', side: 'B', zone: 4 },
          mode: 'approach',
          pose: 'attack',
          jump: { atT: 0.2, heightM: 0.65, hangS: 0.3 },
        },
      ],
    },
  ],
};
