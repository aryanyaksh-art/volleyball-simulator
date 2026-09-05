export type CameraPresetId = 'topDown' | 'sidelineA' | 'endlineA' | 'angledA' | 'angledB';

export interface CameraPreset {
  id: CameraPresetId;
  label: string;
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
}

export const CAMERA_PRESETS: Record<CameraPresetId, CameraPreset> = {
  topDown: {
    id: 'topDown',
    label: 'Top-down',
    position: { x: 0, y: 20, z: 0.01 },
    target: { x: 0, y: 0, z: 0 },
  },
  sidelineA: {
    id: 'sidelineA',
    label: 'Sideline',
    position: { x: 16, y: 3.5, z: 0 },
    target: { x: 0, y: 1, z: 0 },
  },
  endlineA: {
    id: 'endlineA',
    label: 'Behind endline',
    position: { x: 0, y: 3, z: 13 },
    target: { x: 0, y: 1, z: 0 },
  },
  angledA: {
    id: 'angledA',
    label: 'Angled',
    position: { x: 9, y: 7, z: 11 },
    target: { x: 0, y: 0.5, z: 0 },
  },
  angledB: {
    id: 'angledB',
    label: 'Angled (far end)',
    position: { x: -9, y: 7, z: -11 },
    target: { x: 0, y: 0.5, z: 0 },
  },
};

export const CAMERA_PRESET_IDS: CameraPresetId[] = ['topDown', 'sidelineA', 'endlineA', 'angledA', 'angledB'];
