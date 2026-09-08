import type { LocalPos } from '@/core/court/coordinates';
import type { ZoneNumber } from '@/core/court/zones';

export type ServeReceivePresetId = 'w' | 'threePasser' | 'twoPasser' | 'stackLeft' | 'stackRight';

export interface ServeReceivePreset {
  id: ServeReceivePresetId;
  label: string;
  /** Which physical zones become passers — the caller translates each to a serve-order slot via the current rotation (playerSlotInZone), same as every other zone-keyed control in this app. */
  passerZones: ZoneNumber[];
  /** Optional position nudges, in the same zone-keyed override shape FormationPanel already writes to positionOverrides. Omitted presets leave positions at their normal rotation anchors. */
  positions?: Partial<Record<ZoneNumber, LocalPos>>;
}

/**
 * Named serve-receive formation starting points — a coaching-tool sketch of
 * "roughly how many receive and roughly where," not a rulebook of real
 * systems. A coach applies one, then fine-tunes with the existing
 * FormationPanel overrides and per-passer weight fields, same as
 * defense.presets.ts's own base positions are a starting point for
 * defensive systems.
 */
export const SERVE_RECEIVE_PRESETS: Record<ServeReceivePresetId, ServeReceivePreset> = {
  w: {
    id: 'w',
    label: 'W (5-receiver)',
    passerZones: [5, 6, 1, 4, 2],
  },
  threePasser: {
    id: 'threePasser',
    label: '3-passer',
    passerZones: [5, 6, 1],
  },
  twoPasser: {
    id: 'twoPasser',
    label: '2-passer',
    passerZones: [5, 1],
  },
  stackLeft: {
    id: 'stackLeft',
    label: 'Stack left',
    passerZones: [5, 6, 1],
    positions: {
      5: { lat: -3.5, depth: 6.2 },
      6: { lat: -1.0, depth: 6.8 },
      1: { lat: 1.5, depth: 6.4 },
    },
  },
  stackRight: {
    id: 'stackRight',
    label: 'Stack right',
    passerZones: [5, 6, 1],
    positions: {
      5: { lat: -1.5, depth: 6.4 },
      6: { lat: 1.0, depth: 6.8 },
      1: { lat: 3.5, depth: 6.2 },
    },
  },
};

export const SERVE_RECEIVE_PRESET_IDS: ServeReceivePresetId[] = ['w', 'threePasser', 'twoPasser', 'stackLeft', 'stackRight'];
