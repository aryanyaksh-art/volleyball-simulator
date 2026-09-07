import { create } from 'zustand';
import type { PlayDiagnostics } from '@/core/play/diagnostics';

export type PlaybackMode = 'formation' | 'play' | 'author' | 'serve-receive' | 'matchup';

const EMPTY_DIAGNOSTICS: PlayDiagnostics = { speedCapViolations: [], ballFlightIssues: [] };

interface PlaybackState {
  mode: PlaybackMode;
  selectedPlayId: string;
  playing: boolean;
  /** Seconds. While playing, updated from the render loop at a throttled rate for display. */
  t: number;
  durationS: number;
  speed: number;
  loop: boolean;
  /** Recomputed whenever the compiled schedule changes — see SceneCanvas's compile effect. */
  diagnostics: PlayDiagnostics;

  setMode: (mode: PlaybackMode) => void;
  setSelectedPlayId: (id: string) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  /** Used both by the scrub UI and by the render loop's throttled sync-back. */
  setT: (t: number) => void;
  setSpeed: (speed: number) => void;
  setLoop: (loop: boolean) => void;
  setDuration: (durationS: number) => void;
  setDiagnostics: (diagnostics: PlayDiagnostics) => void;
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  mode: 'formation',
  selectedPlayId: 'demo-serve-attack',
  playing: false,
  t: 0,
  durationS: 0,
  speed: 1,
  loop: true,
  diagnostics: EMPTY_DIAGNOSTICS,

  setMode: (mode) => set({ mode, playing: false, t: 0 }),
  setSelectedPlayId: (id) => set({ selectedPlayId: id, playing: false, t: 0 }),
  play: () => set({ playing: true }),
  pause: () => set({ playing: false }),
  toggle: () => set((s) => ({ playing: !s.playing })),
  setT: (t) => set({ t: Math.min(Math.max(t, 0), Math.max(get().durationS, 0)) }),
  setSpeed: (speed) => set({ speed }),
  setLoop: (loop) => set({ loop }),
  setDuration: (durationS) => set({ durationS }),
  setDiagnostics: (diagnostics) => set({ diagnostics }),
}));

// Dev-only escape hatch, same pattern as the other stores.
if (import.meta.env.DEV) {
  (window as unknown as { __playbackStore: typeof usePlaybackStore }).__playbackStore = usePlaybackStore;
}
