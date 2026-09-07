import { create } from 'zustand';
import type { LocalPos, Side } from '@/core/court/coordinates';
import type { Play, PlayStep, Movement, MovementMode, BallSegment } from '@/core/play/types';
import type { PoseId } from '@/core/play/poses';
import { bakePlayForEditing, ballPositionBeforeStep, type BakeContext } from '@/core/play/bake';

const LOCAL_STORAGE_KEY = 'vb-saved-plays';
const MAX_HISTORY = 50;

const findMovementIndex = (step: PlayStep, side: Side, slot: number): number =>
  step.movements.findIndex((mv) => mv.who.kind === 'slot' && mv.who.side === side && mv.who.index === slot);

const updateStep = (play: Play, stepId: string, updater: (step: PlayStep) => PlayStep): Play => ({
  ...play,
  steps: play.steps.map((step) => (step.id === stepId ? updater(step) : step)),
});

const updateMovement = (
  play: Play,
  stepId: string,
  side: Side,
  slot: number,
  updater: (mv: Movement) => Movement,
): Play =>
  updateStep(play, stepId, (step) => {
    const idx = findMovementIndex(step, side, slot);
    if (idx === -1) return step;
    const movements = [...step.movements];
    movements[idx] = updater(movements[idx]);
    return { ...step, movements };
  });

const updateBall = (play: Play, stepId: string, updater: (ball: BallSegment) => BallSegment): Play =>
  updateStep(play, stepId, (step) => (step.ball ? { ...step, ball: updater(step.ball) } : step));

const loadSavedPlays = (): Record<string, Play> => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Play>) : {};
  } catch {
    return {};
  }
};

interface PlayEditorState {
  play: Play | null;
  selectedStepId: string | null;
  past: Play[];
  future: Play[];
  savedPlays: Record<string, Play>;

  loadPlay: (play: Play, ctx: BakeContext) => void;
  selectStep: (stepId: string | null) => void;

  addStep: () => void;
  removeStep: (stepId: string) => void;
  moveStep: (stepId: string, direction: -1 | 1) => void;
  renameStep: (stepId: string, name: string) => void;
  setStepDuration: (stepId: string, duration: number) => void;

  addMovement: (stepId: string, side: Side, slot: number, pos: LocalPos) => void;
  removeMovement: (stepId: string, side: Side, slot: number) => void;
  setMovementPosition: (stepId: string, side: Side, slot: number, pos: LocalPos) => void;
  /** Like setMovementPosition, but creates the movement first if the player was still holding. Used by 3D drag. */
  moveOrAddMovement: (stepId: string, side: Side, slot: number, pos: LocalPos) => void;
  setMovementMode: (stepId: string, side: Side, slot: number, mode: MovementMode) => void;
  setMovementPose: (stepId: string, side: Side, slot: number, pose: PoseId | undefined) => void;

  addBallSegment: (stepId: string) => void;
  removeBallSegment: (stepId: string) => void;
  setBallKind: (stepId: string, kind: BallSegment['kind']) => void;
  setBallFromPosition: (stepId: string, pos: LocalPos, y: number) => void;
  setBallToPosition: (stepId: string, pos: LocalPos, y: number) => void;
  setBallApex: (stepId: string, apexM: number) => void;
  setBallDuration: (stepId: string, duration: number | undefined) => void;

  undo: () => void;
  redo: () => void;

  saveCurrentPlay: () => void;
  deleteSavedPlay: (id: string) => void;

  /** Applies any whole-play mutation (e.g. guided authoring's commitContactAction/commitPositionAction) through the same undo/redo history every other edit here goes through. */
  applyGuidedAction: (mutator: (play: Play) => Play) => void;
}

/** Pushes the current play onto the undo stack, clears redo, then applies a mutation. */
const withHistory =
  (set: (fn: (s: PlayEditorState) => Partial<PlayEditorState>) => void) =>
  (mutator: (play: Play) => Play): void =>
    set((s) => {
      if (!s.play) return {};
      const past = [...s.past, s.play].slice(-MAX_HISTORY);
      return { play: mutator(s.play), past, future: [] };
    });

export const usePlayEditorStore = create<PlayEditorState>((set, get) => {
  const mutate = withHistory(set);

  return {
    play: null,
    selectedStepId: null,
    past: [],
    future: [],
    savedPlays: loadSavedPlays(),

    loadPlay: (play, ctx) => {
      const baked = bakePlayForEditing(play, ctx);
      set(() => ({ play: baked, selectedStepId: baked.steps[0]?.id ?? null, past: [], future: [] }));
    },

    selectStep: (stepId) => set({ selectedStepId: stepId }),

    addStep: () =>
      mutate((play) => {
        const newStep: PlayStep = { id: crypto.randomUUID(), name: `Step ${play.steps.length + 1}`, duration: 1, movements: [] };
        return { ...play, steps: [...play.steps, newStep] };
      }),

    removeStep: (stepId) =>
      mutate((play) => ({ ...play, steps: play.steps.filter((s) => s.id !== stepId) })),

    moveStep: (stepId, direction) =>
      mutate((play) => {
        const idx = play.steps.findIndex((s) => s.id === stepId);
        const target = idx + direction;
        if (idx === -1 || target < 0 || target >= play.steps.length) return play;
        const steps = [...play.steps];
        [steps[idx], steps[target]] = [steps[target], steps[idx]];
        return { ...play, steps };
      }),

    renameStep: (stepId, name) => mutate((play) => updateStep(play, stepId, (step) => ({ ...step, name }))),

    setStepDuration: (stepId, duration) =>
      mutate((play) => updateStep(play, stepId, (step) => ({ ...step, duration: Math.max(duration, 0.05) }))),

    addMovement: (stepId, side, slot, pos) =>
      mutate((play) =>
        updateStep(play, stepId, (step) => {
          if (findMovementIndex(step, side, slot) !== -1) return step;
          const movement: Movement = { who: { side, kind: 'slot', index: slot }, to: { kind: 'local', side, pos }, mode: 'run' };
          return { ...step, movements: [...step.movements, movement] };
        }),
      ),

    removeMovement: (stepId, side, slot) =>
      mutate((play) =>
        updateStep(play, stepId, (step) => ({
          ...step,
          movements: step.movements.filter((mv) => !(mv.who.kind === 'slot' && mv.who.side === side && mv.who.index === slot)),
        })),
      ),

    setMovementPosition: (stepId, side, slot, pos) =>
      mutate((play) => updateMovement(play, stepId, side, slot, (mv) => ({ ...mv, to: { kind: 'local', side, pos } }))),

    moveOrAddMovement: (stepId, side, slot, pos) =>
      mutate((play) =>
        updateStep(play, stepId, (step) => {
          const idx = findMovementIndex(step, side, slot);
          if (idx === -1) {
            const movement: Movement = { who: { side, kind: 'slot', index: slot }, to: { kind: 'local', side, pos }, mode: 'run' };
            return { ...step, movements: [...step.movements, movement] };
          }
          const movements = [...step.movements];
          movements[idx] = { ...movements[idx], to: { kind: 'local', side, pos } };
          return { ...step, movements };
        }),
      ),

    setMovementMode: (stepId, side, slot, mode) =>
      mutate((play) => updateMovement(play, stepId, side, slot, (mv) => ({ ...mv, mode }))),

    setMovementPose: (stepId, side, slot, pose) =>
      mutate((play) => updateMovement(play, stepId, side, slot, (mv) => ({ ...mv, pose }))),

    addBallSegment: (stepId) =>
      mutate((play) =>
        updateStep(play, stepId, (step) => {
          if (step.ball) return step;
          const { pos, y } = ballPositionBeforeStep(play, stepId);
          const ball: BallSegment = {
            kind: 'pass',
            from: { kind: 'local', side: 'A', pos, y },
            to: { kind: 'local', side: 'A', pos, y },
            apexM: 2.5,
          };
          return { ...step, ball };
        }),
      ),

    removeBallSegment: (stepId) => mutate((play) => updateStep(play, stepId, (step) => ({ ...step, ball: undefined }))),

    setBallKind: (stepId, kind) => mutate((play) => updateBall(play, stepId, (ball) => ({ ...ball, kind }))),

    setBallFromPosition: (stepId, pos, y) =>
      mutate((play) => updateBall(play, stepId, (ball) => ({ ...ball, from: { kind: 'local', side: 'A', pos, y } }))),

    setBallToPosition: (stepId, pos, y) =>
      mutate((play) => updateBall(play, stepId, (ball) => ({ ...ball, to: { kind: 'local', side: 'A', pos, y } }))),

    setBallApex: (stepId, apexM) => mutate((play) => updateBall(play, stepId, (ball) => ({ ...ball, apexM }))),

    setBallDuration: (stepId, duration) => mutate((play) => updateBall(play, stepId, (ball) => ({ ...ball, duration }))),

    undo: () =>
      set((s) => {
        if (s.past.length === 0 || !s.play) return {};
        const previous = s.past[s.past.length - 1];
        return { play: previous, past: s.past.slice(0, -1), future: [s.play, ...s.future] };
      }),

    redo: () =>
      set((s) => {
        if (s.future.length === 0 || !s.play) return {};
        const next = s.future[0];
        return { play: next, past: [...s.past, s.play], future: s.future.slice(1) };
      }),

    saveCurrentPlay: () => {
      const play = get().play;
      if (!play) return;
      const savedPlays = { ...get().savedPlays, [play.id]: play };
      set({ savedPlays });
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(savedPlays));
      } catch {
        // localStorage unavailable (private browsing, quota) — the play stays in memory for this session.
      }
    },

    deleteSavedPlay: (id) => {
      const savedPlays = { ...get().savedPlays };
      delete savedPlays[id];
      set({ savedPlays });
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(savedPlays));
      } catch {
        // ignore
      }
    },

    applyGuidedAction: (mutator) => mutate(mutator),
  };
});

if (import.meta.env.DEV) {
  (window as unknown as { __playEditorStore: typeof usePlayEditorStore }).__playEditorStore = usePlayEditorStore;
}
