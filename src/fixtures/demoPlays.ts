import { SETTER_TARGET } from '@/core/court/anchors';
import type { Play } from '@/core/play/types';
import { DEMO_PLAY } from './demoPlay';

/**
 * Rotation 3: the setter (5-1) is front row here, which the plan calls out
 * specifically — only 2 front-row attackers, so the third option is a
 * back-row pipe. At rotation 3, slot 2 (MB1) sits in zone 6, well behind
 * the 3m line, so this play has them run the pipe.
 */
const PIPE_PLAY: Play = {
  id: 'demo-pipe-attack',
  name: 'Pipe attack (setter front row)',
  schemaVersion: 1,
  scenario: {
    lineupIds: { A: 'lineup-A', B: 'lineup-B' },
    rotations: { A: 0, B: 3 },
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
          who: { side: 'B', kind: 'role', role: 'S' },
          to: { kind: 'local', side: 'B', pos: SETTER_TARGET },
          mode: 'sprint',
          pose: 'ready',
        },
      ],
    },
    {
      id: 'set',
      name: 'Pipe set',
      duration: 0.85,
      ball: {
        kind: 'set',
        profile: 'pipe',
        from: { kind: 'atPlayer', who: { side: 'B', kind: 'role', role: 'S' }, contact: 'hands' },
        to: { kind: 'zoneAnchor', side: 'B', zone: 6, y: 2.4 },
        apexM: 4.2,
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
      name: 'Pipe attack',
      duration: 0.5,
      ball: {
        kind: 'attack',
        profile: 'attack',
        from: { kind: 'zoneAnchor', side: 'B', zone: 6, y: 2.4 },
        to: { kind: 'local', side: 'A', pos: { lat: 0, depth: 6 }, y: 0 },
        apexM: 3.0,
      },
      movements: [
        {
          who: { side: 'B', kind: 'zone', zone: 6 },
          to: { kind: 'zoneAnchor', side: 'B', zone: 6 },
          mode: 'approach',
          pose: 'attack',
          jump: { atT: 0.22, heightM: 0.6, hangS: 0.32 },
        },
      ],
    },
  ],
};

/**
 * A 1st-tempo quick set to the middle, fast enough that the hitter's
 * approach and the set happen almost simultaneously — the plan's ~0.45s
 * "quick" tempo. Also exercises `Movement.via`: the middle's approach
 * angles slightly off a straight line, the way a real 3-step approach does.
 */
const QUICK_MIDDLE_PLAY: Play = {
  id: 'demo-quick-middle',
  name: 'Quick middle (1st tempo)',
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
      duration: 1.0,
      ball: {
        kind: 'serve',
        profile: 'floatServe',
        from: { kind: 'local', side: 'A', pos: { lat: 3, depth: 8.7 }, y: 1.3 },
        to: { kind: 'zoneAnchor', side: 'B', zone: 6 },
        apexM: 3.0,
      },
      movements: [
        {
          who: { side: 'A', kind: 'zone', zone: 1 },
          to: { kind: 'local', side: 'A', pos: { lat: 3, depth: 8.5 } },
          mode: 'approach',
          pose: 'serveContact',
          duration: 0.4,
        },
      ],
    },
    {
      id: 'pass',
      name: 'Pass',
      duration: 1.1,
      ball: {
        kind: 'pass',
        profile: 'pass',
        from: { kind: 'zoneAnchor', side: 'B', zone: 6, y: 0.9 },
        to: { kind: 'local', side: 'B', pos: SETTER_TARGET, y: 2.6 },
        apexM: 2.8,
        duration: 0.75,
      },
      movements: [
        {
          who: { side: 'B', kind: 'zone', zone: 6 },
          to: { kind: 'local', side: 'B', pos: { lat: 0, depth: 5.6 } },
          mode: 'shuffle',
          pose: 'passLow',
        },
        {
          who: { side: 'B', kind: 'role', role: 'S' },
          to: { kind: 'local', side: 'B', pos: SETTER_TARGET },
          mode: 'sprint',
          pose: 'ready',
        },
        {
          who: { side: 'B', kind: 'role', role: 'MB', ordinal: 1 },
          to: { kind: 'local', side: 'B', pos: { lat: -0.4, depth: 1.5 } },
          via: [{ kind: 'local', side: 'B', pos: { lat: -1.1, depth: 2.4 } }],
          mode: 'approach',
          pose: 'load',
        },
      ],
    },
    {
      id: 'set',
      name: 'Quick set',
      duration: 0.45,
      ball: {
        kind: 'set',
        profile: 'quick',
        from: { kind: 'atPlayer', who: { side: 'B', kind: 'role', role: 'S' }, contact: 'hands' },
        to: { kind: 'atPlayer', who: { side: 'B', kind: 'role', role: 'MB', ordinal: 1 }, contact: 'reach' },
        apexM: 2.7,
      },
      movements: [
        {
          who: { side: 'B', kind: 'role', role: 'S' },
          to: { kind: 'local', side: 'B', pos: SETTER_TARGET },
          mode: 'hold',
          pose: 'set',
        },
        {
          who: { side: 'B', kind: 'role', role: 'MB', ordinal: 1 },
          to: { kind: 'local', side: 'B', pos: { lat: -0.4, depth: 1.5 } },
          mode: 'hold',
          pose: 'attack',
          jump: { atT: 0.18, heightM: 0.55, hangS: 0.28 },
        },
      ],
    },
    {
      id: 'attack',
      name: 'Quick attack',
      duration: 0.3,
      ball: {
        kind: 'attack',
        profile: 'attack',
        from: { kind: 'atPlayer', who: { side: 'B', kind: 'role', role: 'MB', ordinal: 1 }, contact: 'reach' },
        to: { kind: 'local', side: 'A', pos: { lat: -1.5, depth: 5 }, y: 0 },
        apexM: 3.3,
        apexU: 0.15,
      },
      movements: [],
    },
  ],
};

export const DEMO_PLAYS: Play[] = [DEMO_PLAY, PIPE_PLAY, QUICK_MIDDLE_PLAY];
