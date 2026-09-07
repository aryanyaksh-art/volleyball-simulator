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

  /** Panels hidden, large touch-first transport — for showing a play to a team at practice, not editing it. */
  presentationMode: boolean;
  togglePresentationMode: () => void;

  /** The live renderer's canvas element, registered by SceneCanvas on mount — what the PNG rotation-sheet export reads pixels from. */
  sceneCanvasEl: HTMLCanvasElement | null;
  setSceneCanvasEl: (el: HTMLCanvasElement | null) => void;

  /** Author mode's Advanced/Simple split. Off (simple) by default: the timeline/step-inspector sidebar is hidden and the guided panel shows instead. */
  authorAdvancedMode: boolean;
  toggleAuthorAdvancedMode: () => void;
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

  presentationMode: false,
  togglePresentationMode: () => set((s) => ({ presentationMode: !s.presentationMode })),

  sceneCanvasEl: null,
  setSceneCanvasEl: (el) => set({ sceneCanvasEl: el }),

  authorAdvancedMode: false,
  toggleAuthorAdvancedMode: () => set((s) => ({ authorAdvancedMode: !s.authorAdvancedMode })),
}));

// Dev-only escape hatch for driving the store from devtools/automation
// without depending on clicking the actual UI controls (which can race with
// a person interacting with the same page). Never included in a prod build.
if (import.meta.env.DEV) {
  (window as unknown as { __appStore: typeof useAppStore }).__appStore = useAppStore;
}
