import { create } from 'zustand';
import type { CameraPresetId } from '@/render/cameraPresets';
import { DEFAULT_THEME_ID } from '@/render/theme/presets';
import type { PoseId } from '@/core/play/poses';

interface AppState {
  themeId: string;
  setThemeId: (id: string) => void;

  /** Bumped on every camera-preset request so SceneCanvas's effect re-fires
   *  even if the same preset is clicked twice in a row. */
  cameraPreset: CameraPresetId;
  cameraRequestToken: number;
  goToCameraPreset: (id: CameraPresetId) => void;

  previewPlayerId: string;
  setPreviewPlayerId: (id: string) => void;
  previewPose: PoseId;
  setPreviewPose: (pose: PoseId) => void;
}

export const useAppStore = create<AppState>((set) => ({
  themeId: DEFAULT_THEME_ID,
  setThemeId: (id) => set({ themeId: id }),

  cameraPreset: 'angledA',
  cameraRequestToken: 0,
  goToCameraPreset: (id) => set((s) => ({ cameraPreset: id, cameraRequestToken: s.cameraRequestToken + 1 })),

  previewPlayerId: 'A:1',
  setPreviewPlayerId: (id) => set({ previewPlayerId: id }),
  previewPose: 'idle',
  setPreviewPose: (pose) => set({ previewPose: pose }),
}));
