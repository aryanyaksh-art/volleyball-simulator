import { create } from 'zustand';
import type { CameraPresetId } from '@/render/cameraPresets';
import { DEFAULT_THEME_ID } from '@/render/theme/presets';
import type { PoseId } from '@/core/play/poses';
import type { Vec3 } from '@/core/math/vec';
import type { CameraRig } from '@/render/CameraRig';

interface AppState {
  themeId: string;
  setThemeId: (id: string) => void;

  /** Bumped on every camera-preset request so SceneCanvas's effect re-fires
   *  even if the same preset is clicked twice in a row. */
  cameraPreset: CameraPresetId;
  cameraRequestToken: number;
  goToCameraPreset: (id: CameraPresetId) => void;

  /** Same token-bump pattern as goToCameraPreset, but for looking at an
   *  arbitrary world point (an overlap violation) instead of a named preset. */
  focusCameraTarget: Vec3 | null;
  focusCameraToken: number;
  focusCameraOn: (target: Vec3) => void;

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

  /** The live renderer's camera rig, registered by SceneCanvas on mount — same pattern as sceneCanvasEl, exposed for the same reason: the rotation-sheet export needs to drive the camera to a specific angle for each captured frame, then restore exactly where the user left it. */
  sceneCameraRig: CameraRig | null;
  setSceneCameraRig: (rig: CameraRig | null) => void;

  /** The Advanced/Simple split, shared by author mode, formation mode, and the bottom ControlBar (theme/camera/pose-preview). Off (simple) by default: author mode hides the timeline/step-inspector sidebar in favor of the guided panel, formation mode hides the Roster/Lineup/Rotation/Validation/Formation/Bench sidebar entirely, and ControlBar itself doesn't render at all. */
  authorAdvancedMode: boolean;
  toggleAuthorAdvancedMode: () => void;

  /** Toggles the saved-plays library panel, available from formation/play mode. */
  showPlayLibrary: boolean;
  toggleShowPlayLibrary: () => void;

  /** Gates the drag-to-reposition gesture in formation mode and Design Play (guided author mode). Off by default so an ordinary click can't accidentally move someone; turning it on is what lets BenchDragController (formation) and GuidedPlayController's drag path (author) actually move a player. */
  movePlayersMode: boolean;
  toggleMovePlayersMode: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  themeId: DEFAULT_THEME_ID,
  setThemeId: (id) => set({ themeId: id }),

  cameraPreset: 'angledA',
  cameraRequestToken: 0,
  goToCameraPreset: (id) => set((s) => ({ cameraPreset: id, cameraRequestToken: s.cameraRequestToken + 1 })),

  focusCameraTarget: null,
  focusCameraToken: 0,
  focusCameraOn: (target) => set((s) => ({ focusCameraTarget: target, focusCameraToken: s.focusCameraToken + 1 })),

  previewPlayerId: 'A:1',
  setPreviewPlayerId: (id) => set({ previewPlayerId: id }),
  previewPose: 'idle',
  setPreviewPose: (pose) => set({ previewPose: pose }),

  presentationMode: false,
  togglePresentationMode: () => set((s) => ({ presentationMode: !s.presentationMode })),

  sceneCanvasEl: null,
  setSceneCanvasEl: (el) => set({ sceneCanvasEl: el }),

  sceneCameraRig: null,
  setSceneCameraRig: (rig) => set({ sceneCameraRig: rig }),

  authorAdvancedMode: false,
  toggleAuthorAdvancedMode: () => set((s) => ({ authorAdvancedMode: !s.authorAdvancedMode })),

  showPlayLibrary: false,
  toggleShowPlayLibrary: () => set((s) => ({ showPlayLibrary: !s.showPlayLibrary })),

  movePlayersMode: false,
  toggleMovePlayersMode: () => set((s) => ({ movePlayersMode: !s.movePlayersMode })),
}));

// Dev-only escape hatch for driving the store from devtools/automation
// without depending on clicking the actual UI controls (which can race with
// a person interacting with the same page). Never included in a prod build.
if (import.meta.env.DEV) {
  (window as unknown as { __appStore: typeof useAppStore }).__appStore = useAppStore;
}
