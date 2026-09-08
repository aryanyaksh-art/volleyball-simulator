import { create } from 'zustand';
import type { CameraPresetId } from '@/render/cameraPresets';
import { DEFAULT_THEME_ID } from '@/render/theme/presets';
import type { PoseId } from '@/core/play/poses';
import type { BenchDropTarget } from '@/render/BenchDragController';

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

  /** The Advanced/Simple split, shared by author mode, formation mode, and the bottom ControlBar (theme/camera/pose-preview). Off (simple) by default: author mode hides the timeline/step-inspector sidebar in favor of the guided panel, formation mode hides the Roster/Lineup/Rotation/Validation/Formation/Bench sidebar entirely, and ControlBar itself doesn't render at all. */
  authorAdvancedMode: boolean;
  toggleAuthorAdvancedMode: () => void;

  /**
   * Resolves a raw pointer position (clientX/clientY) to a court drop
   * target, registered by SceneCanvas on mount. This is what lets an HTML
   * element entirely outside the 3D canvas (the on-screen bench chips
   * flanking the court) participate in a real drag-and-drop onto the
   * court: the chip itself owns the pointer capture, so it never sees a
   * dragover/drop event from the canvas, but on release it can still ask
   * "what's under this screen position" without needing to reach into
   * SceneCanvas's internal renderer/camera refs directly.
   */
  resolveCourtDropTarget: ((clientX: number, clientY: number) => BenchDropTarget) | null;
  setResolveCourtDropTarget: (fn: ((clientX: number, clientY: number) => BenchDropTarget) | null) => void;
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

  resolveCourtDropTarget: null,
  setResolveCourtDropTarget: (fn) => set({ resolveCourtDropTarget: fn }),
}));

// Dev-only escape hatch for driving the store from devtools/automation
// without depending on clicking the actual UI controls (which can race with
// a person interacting with the same page). Never included in a prod build.
if (import.meta.env.DEV) {
  (window as unknown as { __appStore: typeof useAppStore }).__appStore = useAppStore;
}
