# Simple Mode and Guided Play Authoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Simple/Advanced toggle to author mode, a distinct libero color, an on-court bench players can be dragged on/off of, and a guided click-through workflow for building a play, all without changing the existing play data model, compiler, or playback.

**Architecture:** Everything new is additive. Core gets a handful of small pure functions/tables (bench anchor positions, a role-to-zone reverse lookup, per-action defaults) with the same Vitest coverage every other `core/` module has. The render layer gets two new pointer controllers that follow `PlayerDragController`'s existing raycast-to-floor-plane shape. The UI layer gets two new components and a new small Zustand store for guided-mode-only state. Nothing in `core/play/compile.ts`, `evaluate.ts`, or `ballFlight.ts` changes: guided authoring writes a `Play` object through the exact same shape the advanced editor writes.

**Tech Stack:** Same as the rest of the project: Vite, React 19, TypeScript strict, Three.js (imperative), Zustand, Vitest.

## Global Constraints

- `src/core/**` must not import `three`, `react`, or anything from `render`/`ui`/`app` (ESLint-enforced; see `eslint.config.js`). All new core files must pass this.
- `npm test`, `npx tsc -b --noEmit`, and `npm run lint` must be clean after every task.
- No changes to `core/play/compile.ts`, `evaluate.ts`, `schedule.ts`, or `ballFlight.ts`.
- Colors only come from `Theme` (`src/render/theme/Theme.ts` + `presets.ts`); no color literals in `render/` or `ui/`.
- Commit after each task, push to `main` so Vercel redeploys, per the design spec's rollout order: toggle/recenter → libero color → bench → guided workflow.
- Contact actions in guided mode (serve/pass/set/attack/tip) do **not** auto-move the acting player to a new position — they change pose (and jump, for attack) at the player's current position. Actually repositioning a player is always a separate, explicit "Move only" action. This is a deliberate scope decision (see spec's Feature 4): guided mode doesn't try to infer footwork.

---

## Task 1: Advanced/Simple toggle for author mode

**Files:**
- Modify: `src/app/store/useAppStore.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Produces: `useAppStore().authorAdvancedMode: boolean`, `useAppStore().toggleAuthorAdvancedMode(): void`

- [ ] **Step 1: Add the store field**

In `src/app/store/useAppStore.ts`, add to the `AppState` interface (after `setPreviewPose`):

```ts
  /** Author mode's Advanced/Simple split. Off (simple) by default: the timeline/step-inspector sidebar is hidden and the guided panel shows instead. */
  authorAdvancedMode: boolean;
  toggleAuthorAdvancedMode: () => void;
```

And in the store body (after `setPreviewPose: (pose) => set({ previewPose: pose }),`):

```ts
  authorAdvancedMode: false,
  toggleAuthorAdvancedMode: () => set((s) => ({ authorAdvancedMode: !s.authorAdvancedMode })),
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 3: Wire it into App.tsx**

Replace the whole file `src/App.tsx` with:

```tsx
import { useEffect } from 'react';
import { SceneCanvas } from '@/ui/SceneCanvas';
import { ControlBar } from '@/ui/ControlBar';
import { TransportBar } from '@/ui/TransportBar';
import { LineupSidebar } from '@/ui/panels/LineupSidebar';
import { AuthorSidebar } from '@/ui/panels/AuthorSidebar';
import { GuidedAuthorPanel } from '@/ui/panels/GuidedAuthorPanel';
import { ServeReceiveSidebar } from '@/ui/panels/ServeReceiveSidebar';
import { MatchupSidebar } from '@/ui/panels/MatchupSidebar';
import { DiagnosticsPanel } from '@/ui/panels/DiagnosticsPanel';
import { usePlaybackStore } from '@/app/store/usePlaybackStore';
import { useAppStore } from '@/app/store/useAppStore';
import { usePresentationWakeLock } from '@/ui/usePresentationWakeLock';
import './App.css';

function App() {
  const mode = usePlaybackStore((s) => s.mode);
  const presentationMode = useAppStore((s) => s.presentationMode);
  const togglePresentationMode = useAppStore((s) => s.togglePresentationMode);
  const authorAdvancedMode = useAppStore((s) => s.authorAdvancedMode);
  const toggleAuthorAdvancedMode = useAppStore((s) => s.toggleAuthorAdvancedMode);

  usePresentationWakeLock(presentationMode);

  useEffect(() => {
    if (!presentationMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') togglePresentationMode();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [presentationMode, togglePresentationMode]);

  const showAuthorAdvancedToggle = !presentationMode && mode === 'author';

  return (
    <div className={presentationMode ? 'app app-presentation' : 'app'}>
      <div className="main-row">
        <div className="scene-viewport">
          <SceneCanvas />
          {!presentationMode && mode === 'play' && <DiagnosticsPanel />}
          {showAuthorAdvancedToggle && (
            <button className="chip advanced-toggle" onClick={toggleAuthorAdvancedMode}>
              {authorAdvancedMode ? '⚙ Advanced ✓' : '⚙ Advanced'}
            </button>
          )}
          {presentationMode && (
            <button className="chip presentation-exit" onClick={togglePresentationMode}>
              ✕ Exit presentation (Esc)
            </button>
          )}
        </div>
        {!presentationMode &&
          (mode === 'author' ? (
            authorAdvancedMode ? (
              <AuthorSidebar />
            ) : null
          ) : mode === 'serve-receive' ? (
            <ServeReceiveSidebar />
          ) : mode === 'matchup' ? (
            <MatchupSidebar />
          ) : (
            <LineupSidebar />
          ))}
        {!presentationMode && mode === 'author' && !authorAdvancedMode && <GuidedAuthorPanel />}
      </div>
      <TransportBar />
      {!presentationMode && <ControlBar />}
    </div>
  );
}

export default App;
```

Note: `DiagnosticsPanel` only rendered for `mode === 'play'` here (it already internally returns `null` outside play mode, per its own `if (mode !== 'play') return null;` — this just avoids mounting it needlessly during author mode, where the guided panel takes that visual space instead). `GuidedAuthorPanel` doesn't exist yet — it's created in Task 12; this file will fail to build until then, which is fine, later tasks in this plan run before that failure would ever ship. To keep the app running standalone right after this task, temporarily stub it: create `src/ui/panels/GuidedAuthorPanel.tsx` with:

```tsx
export function GuidedAuthorPanel() {
  return null;
}
```

(Task 12 replaces this file's contents with the real panel.)

- [ ] **Step 4: Add the toggle chip's CSS**

In `src/App.css`, after the `.presentation-exit` rule block, add:

```css
.advanced-toggle {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
}
```

- [ ] **Step 5: Verify build and lint**

Run: `npx tsc -b --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 6: Manual verification**

Run `npm run dev` (or use the already-running dev server), open the app, click "New play" to enter author mode. Confirm: no sidebar renders, the court fills the whole row, an "⚙ Advanced" chip sits top-right of the scene. Click it: the timeline/step-inspector sidebar appears and the court shrinks to make room. Click again: it's gone and the court re-expands. The bottom transport bar and theme/camera/pose-preview row are present throughout.

- [ ] **Step 7: Commit**

```bash
git add src/app/store/useAppStore.ts src/App.tsx src/App.css src/ui/panels/GuidedAuthorPanel.tsx
git commit -m "Add Advanced/Simple toggle for author mode"
git push origin main
```

---

## Task 2: Libero color

**Files:**
- Modify: `src/render/theme/Theme.ts`
- Modify: `src/render/theme/presets.ts`
- Modify: `src/ui/SceneCanvas.tsx`

**Interfaces:**
- Produces: `Theme.liberoColor: string`
- Consumes: `LineupBreakdown.onCourt[].isLibero` (existing, from `core/lineup/systems.ts`)

- [ ] **Step 1: Add the theme field**

In `src/render/theme/Theme.ts`, add to the `Theme` interface, after `ball: { color: string; trailColor: string };`:

```ts
  /** One color, not per-team: a libero should stand out from their own teammates on either side, the way a real libero jersey contrasts with the rest of the team. */
  liberoColor: string;
```

- [ ] **Step 2: Add values to all three presets**

In `src/render/theme/presets.ts`, add a `liberoColor` line to each of the three theme objects (`blueprint`, `court`, `whiteboard`), right after each one's `ball: {...}` line:

```ts
  liberoColor: '#ffffff',
```

for `blueprint` and `court` (both dark grounds, pure white reads clearly against both team colors), and for `whiteboard` (light ground):

```ts
  liberoColor: '#101113',
```

(matching `whiteboard`'s existing near-black `bandColor`/`lineColor` tone, so it reads as a strong contrast on the light background instead of disappearing).

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc -b --noEmit`
Expected: no errors (this also confirms all three presets got the new required field — TypeScript will fail the build otherwise, since `Theme` has no optional fields).

- [ ] **Step 4: Apply it in formation mode**

In `src/ui/SceneCanvas.tsx`, find `buildSceneState`'s player-placement loop (the `for (const p of breakdown.onCourt) { ... }` block that pushes into `placements`). Change:

```ts
        teamColor: isViolating ? theme.overlays.violation : theme.teams[side].body,
```

to:

```ts
        teamColor: isViolating ? theme.overlays.violation : p.isLibero ? theme.liberoColor : theme.teams[side].body,
```

- [ ] **Step 5: Apply it during play/author playback**

Playback's `world.players` (from `evaluateInto`) carry `onCourtId` (`side:slot`) but not `isLibero` — that's a lineup-level fact resolved from a play's own `scenario.rotations`, not baked into the schedule. Add a ref that's recomputed alongside the schedule.

In `src/ui/SceneCanvas.tsx`, find the `scheduleRef` declaration near the top of the component:

```ts
  const scheduleRef = useRef<PlaySchedule | null>(null);
```

Add a new ref right after it:

```ts
  const liberoOnCourtIdsRef = useRef<Set<string>>(new Set());
```

Find the "Recompile whenever the underlying roster/lineup data changes" `useEffect` (it sets `scheduleRef.current = schedule;`). Add this right after that line:

```ts
    const liberoIds = new Set<string>();
    for (const side of SIDES) {
      const b = breakdown(lineups[side], rosters[side], side, play.scenario.rotations[side]);
      for (const p of b.onCourt) if (p.isLibero) liberoIds.add(p.onCourtId);
    }
    liberoOnCourtIdsRef.current = liberoIds;
```

(`breakdown` and `SIDES` are already imported/defined in this file.)

Now find the per-frame `placements` mapping inside `renderer.start((dtSeconds) => { ... })`:

```ts
      const placements: PlayerPlacement[] = world.players.map((p) => ({
        id: p.onCourtId,
        side: p.side,
        pos: toWorld(p.pos, p.side, p.y),
        teamColor: activeTheme.teams[p.side].body,
        pose: p.pose,
        facingRad: p.facingRad,
      }));
```

Change the `teamColor` line to:

```ts
        teamColor: liberoOnCourtIdsRef.current.has(p.onCourtId) ? activeTheme.liberoColor : activeTheme.teams[p.side].body,
```

- [ ] **Step 6: Verify build, lint, tests**

Run: `npx tsc -b --noEmit && npm run lint && npm test -- --run`
Expected: all clean, 108 tests still passing (this task adds no new core logic, so no new tests).

- [ ] **Step 7: Manual verification**

In the browser: formation mode, pick a rotation where the libero is on court (any back-row rotation with the demo lineup's libero assignment) — that player renders in the theme's libero color, not the team color. Switch to Court and Whiteboard themes and confirm it still reads clearly. Then preview a demo play and confirm the same player stays the libero color through playback (not just in the static formation view).

- [ ] **Step 8: Commit**

```bash
git add src/render/theme/Theme.ts src/render/theme/presets.ts src/ui/SceneCanvas.tsx
git commit -m "Give the libero a distinct color, in formation view and playback"
git push origin main
```

---

## Task 3: Bench anchor positions (core)

**Files:**
- Modify: `src/core/court/anchors.ts`
- Test: `tests/anchors.test.ts`

**Interfaces:**
- Produces: `benchSlotPosition(index: number, count: number, depthM?: number): LocalPos`

- [ ] **Step 1: Write the failing test**

Add to `tests/anchors.test.ts` (check the existing file first for its import style; append a new `describe` block):

```ts
describe('benchSlotPosition', () => {
  it('centers a single bench player on lat 0', () => {
    const pos = benchSlotPosition(0, 1);
    expect(pos.lat).toBeCloseTo(0, 6);
  });

  it('spaces players 1m apart, centered around lat 0', () => {
    const a = benchSlotPosition(0, 3);
    const b = benchSlotPosition(1, 3);
    const c = benchSlotPosition(2, 3);
    expect(b.lat).toBeCloseTo(0, 6);
    expect(a.lat).toBeCloseTo(-1, 6);
    expect(c.lat).toBeCloseTo(1, 6);
  });

  it('sits past the endline, at the given depth', () => {
    const pos = benchSlotPosition(0, 1, 10.5);
    expect(pos.depth).toBe(10.5);
  });

  it('defaults to a depth past the free zone', () => {
    const pos = benchSlotPosition(0, 1);
    expect(pos.depth).toBeGreaterThan(9);
  });
});
```

Add the import at the top of the test file (alongside the existing `effectivePosition`/`ZONE_BASE` import line — check what's already imported and extend that line rather than duplicating it):

```ts
import { benchSlotPosition } from '@/core/court/anchors';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/anchors.test.ts`
Expected: FAIL, `benchSlotPosition is not defined` / import error.

- [ ] **Step 3: Implement it**

In `src/core/court/anchors.ts`, add at the end of the file:

```ts
const BENCH_SPACING_M = 1.0;
const BENCH_DEPTH_M = 10.5;

/** Position for the `index`-th of `count` bench players, spaced 1m apart and centered on lat 0, standing past the free zone behind the team's own endline. */
export const benchSlotPosition = (index: number, count: number, depthM = BENCH_DEPTH_M): LocalPos => ({
  lat: (index - (count - 1) / 2) * BENCH_SPACING_M,
  depth: depthM,
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/anchors.test.ts`
Expected: PASS, all tests in the file green.

- [ ] **Step 5: Run full suite, typecheck, lint**

Run: `npm test -- --run && npx tsc -b --noEmit && npm run lint`
Expected: all clean.

- [ ] **Step 6: Commit**

```bash
git add src/core/court/anchors.ts tests/anchors.test.ts
git commit -m "Add bench slot position anchors"
git push origin main
```

---

## Task 4: Render the on-court bench

**Files:**
- Modify: `src/render/SceneBridge.ts`
- Modify: `src/ui/SceneCanvas.tsx`

**Interfaces:**
- Consumes: `benchSlotPosition(index, count)` (Task 3), `PlayerVisual` (`root`, `setPosition`, `setFacing`, `setPose`, `setTeamColor`, `setLabel`, `update`, `dispose`), `HumanoidFactory.create(color)`, `Theme.benchColor` (new, added this task)
- Produces: `SceneBridge.setBench(placements: PlayerPlacement[]): void`, `SceneBridge.getBenchRoots(): { id: string; root: THREE.Object3D }[]`

- [ ] **Step 1: Add a bench color to Theme**

In `src/render/theme/Theme.ts`, add next to `liberoColor`:

```ts
  /** Dimmed color for players on the bench, in every theme. */
  benchColor: string;
```

In `src/render/theme/presets.ts`, add to all three presets:

```ts
  benchColor: '#4a5058',
```

for `blueprint` and `court` (a muted grey that reads as "inactive" against dark grounds without vanishing), and for `whiteboard`:

```ts
  benchColor: '#9a9a94',
```

(a mid grey that still contrasts against the light background while clearly reading as dimmed).

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 3: Add bench rendering to SceneBridge**

In `src/render/SceneBridge.ts`, add a new private field near the existing `private players = new Map<string, PlayerVisual>();`:

```ts
  private benchPlayers = new Map<string, PlayerVisual>();
```

Add a constant near the top of the file (after the imports, before the `disposeObject` function):

```ts
const BENCH_SCALE = 0.75;
```

Add two new public methods, right after the existing `getPlayerRoots()` method:

```ts
  /** The on-court bench: dimmed, smaller silhouettes standing past each team's own endline. Same placement shape as setFormation, minus pose/facing nuance — bench players just face their own net. */
  setBench(placements: PlayerPlacement[]): void {
    const seen = new Set<string>();
    for (const p of placements) {
      seen.add(p.id);
      let visual = this.benchPlayers.get(p.id);
      if (!visual) {
        visual = this.factory.create(this.theme.benchColor);
        visual.root.scale.setScalar(BENCH_SCALE);
        this.benchPlayers.set(p.id, visual);
        this.scene.add(visual.root);
      }
      visual.setPosition(p.pos);
      visual.setFacing(p.facingRad ?? (p.side === 'A' ? Math.PI : 0));
      visual.setPose(p.pose);
    }
    for (const [id, visual] of this.benchPlayers) {
      if (!seen.has(id)) {
        this.scene.remove(visual.root);
        visual.dispose();
        this.benchPlayers.delete(id);
      }
    }
  }

  /** Bench roots for hit-testing (BenchDragController's raycasts) — not for mutating directly. */
  getBenchRoots(): { id: string; root: THREE.Object3D }[] {
    return Array.from(this.benchPlayers.entries()).map(([id, visual]) => ({ id, root: visual.root }));
  }
```

Add bench cleanup to `dispose()`, right after the existing `for (const visual of this.players.values()) { ... } this.players.clear();` block:

```ts
    for (const visual of this.benchPlayers.values()) {
      this.scene.remove(visual.root);
      visual.dispose();
    }
    this.benchPlayers.clear();
```

Also update `setTheme()` — bench player colors need to refresh when the theme changes, the same way the court doesn't currently re-tint existing players on a theme switch (formation state gets rebuilt from scratch on theme change in `SceneCanvas`, so this isn't actually a gap in practice; no change needed here). Skip.

- [ ] **Step 4: Compute and pass bench placements from SceneCanvas**

In `src/ui/SceneCanvas.tsx`, add an import:

```ts
import { benchSlotPosition } from '@/core/court/anchors';
```

Add a new pure helper function, right after `buildSceneState`:

```ts
/** Roster players not currently in the lineup's serve order, laid out along each team's own bench row. Mirrors BenchPanel's own "who's on the bench" rule (liberos excluded — they swap in automatically, they're never manually benched). */
function buildBenchPlacements(rosters: Record<Side, Roster>, lineups: Record<Side, Lineup>): PlayerPlacement[] {
  const placements: PlayerPlacement[] = [];
  for (const side of SIDES) {
    const onCourtIds = new Set(lineups[side].order.filter((id): id is string => id != null));
    const bench = rosters[side].players.filter((p) => p.primaryRole !== 'L' && !onCourtIds.has(p.id));
    bench.forEach((p, i) => {
      placements.push({
        id: `bench:${side}:${p.id}`,
        side,
        pos: toWorld(benchSlotPosition(i, bench.length), side),
        teamColor: '', // unused by setBench's rendering (bench color comes from the theme), kept for PlayerPlacement shape compatibility
        pose: 'idle',
      });
    });
  }
  return placements;
}
```

Find the `useEffect` that rebuilds formation state on lineup/theme changes (the one ending `bridge.setFormation(scene.placements); bridge.setViolationLinks(scene.violationLinks);` for non-play/author modes). Right after `bridge.setViolationLinks(scene.violationLinks);` in that block, add:

```ts
    bridge.setBench(buildBenchPlacements(rosters, lineups));
```

- [ ] **Step 5: Verify build, lint, tests**

Run: `npx tsc -b --noEmit && npm run lint && npm test -- --run`
Expected: all clean. (`teamColor: ''` on a bench placement is unused dead data purely to satisfy `PlayerPlacement`'s shape — flag this in review as acceptable since `setBench` never reads it, but don't skip the typecheck: confirm no lint complaint about an unused-looking literal. If ESLint flags the empty string, replace the comment with `// eslint-disable-next-line` is NOT the fix — instead just leave it, empty string literals aren't flagged by this project's lint config.)

- [ ] **Step 6: Manual verification**

In the browser, formation mode: confirm a row of smaller, dimmed silhouettes appears behind each team's own endline, one per bench player (roster size minus 6 minus the libero). Switch rotations and lineups (drag someone from the court list onto the bench via the existing `BenchPanel`) and confirm the bench row updates live. Switch themes and confirm the bench color reads clearly in all three.

- [ ] **Step 7: Commit**

```bash
git add src/render/theme/Theme.ts src/render/theme/presets.ts src/render/SceneBridge.ts src/ui/SceneCanvas.tsx
git commit -m "Render the on-court bench"
git push origin main
```

---

## Task 5: Drag players on/off the court in 3D

**Files:**
- Create: `src/render/BenchDragController.ts`
- Modify: `src/ui/SceneCanvas.tsx`

**Interfaces:**
- Consumes: `SceneBridge.getPlayerRoots()`, `SceneBridge.getBenchRoots()` (Task 4), `useLineupStore.setOrderSlot(side, slot, playerId)` (existing), `playerSlotInZone(rotation, zone)` and `zoneOfSlot(rotation, slot)` (existing, `core/lineup/rotation.ts`), `effectivePosition(zone, overrides?)` (existing, `core/court/anchors.ts`)
- Produces: `BenchDragController` class with the same public shape as `PlayerDragController` (`constructor(params)`, `dispose()`)

- [ ] **Step 1: Write the controller**

Create `src/render/BenchDragController.ts`:

```ts
import * as THREE from 'three';
import type { Side } from '@/core/court/coordinates';
import { toLocal } from '@/core/court/coordinates';
import { DEFAULT_COURT_SPEC } from '@/core/court/courtSpec';
import type { ZoneNumber } from '@/core/court/zones';
import { ZONE_BASE } from '@/core/court/anchors';

export interface BenchDraggableRoot {
  /** `"bench:<side>:<playerId>"` for a bench player, or `"<side>:<zone>"` for an on-court player — the same id scheme formation mode already places players under. */
  id: string;
  root: THREE.Object3D;
}

export type BenchDropTarget = { kind: 'zone'; side: Side; zone: ZoneNumber } | { kind: 'bench'; side: Side } | null;

export interface BenchDragControllerParams {
  domElement: HTMLElement;
  camera: THREE.Camera;
  getDraggables: () => BenchDraggableRoot[];
  isEnabled: () => boolean;
  setOrbitEnabled: (enabled: boolean) => void;
  onDrop: (sourceId: string, target: BenchDropTarget) => void;
}

const FLOOR_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

/** Resolves a floor-plane hit to a drop target: the nearest zone anchor if it's within the court, the bench strip if it's past that side's endline, or null (too far from anything sensible) otherwise. */
export function resolveDropTarget(hit: THREE.Vector3): BenchDropTarget {
  const side: Side = hit.z >= 0 ? 'A' : 'B';
  const local = toLocal({ x: hit.x, y: 0, z: hit.z }, side);
  if (local.depth > DEFAULT_COURT_SPEC.halfLengthM) return { kind: 'bench', side };
  if (local.depth < 0) return null;

  let closestZone: ZoneNumber | null = null;
  let closestDist = Infinity;
  for (const [zoneStr, pos] of Object.entries(ZONE_BASE)) {
    const d = Math.hypot(pos.lat - local.lat, pos.depth - local.depth);
    if (d < closestDist) {
      closestDist = d;
      closestZone = Number(zoneStr) as ZoneNumber;
    }
  }
  return closestZone ? { kind: 'zone', side, zone: closestZone } : null;
}

/**
 * Formation-mode-only sibling of PlayerDragController: drags a player (from
 * the bench or the court) and drops them onto a zone or the bench, instead
 * of dragging an already-on-court player to a new movement target within an
 * authored step. Same raycast-to-floor-plane approach, different drop
 * semantics — this one never touches Movement/BallSegment data at all.
 */
export class BenchDragController {
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private draggingId: string | null = null;
  private params: BenchDragControllerParams;

  constructor(params: BenchDragControllerParams) {
    this.params = params;
    params.domElement.addEventListener('pointerdown', this.handlePointerDown);
    params.domElement.addEventListener('pointerup', this.handlePointerUp);
    params.domElement.addEventListener('pointercancel', this.handlePointerUp);
  }

  private updatePointer(e: PointerEvent): void {
    const rect = this.params.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private floorHit(): THREE.Vector3 | null {
    this.raycaster.setFromCamera(this.pointer, this.params.camera);
    const hit = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(FLOOR_PLANE, hit) ? hit : null;
  }

  private handlePointerDown = (e: PointerEvent): void => {
    if (!this.params.isEnabled()) return;
    this.updatePointer(e);
    this.raycaster.setFromCamera(this.pointer, this.params.camera);

    const draggables = this.params.getDraggables();
    let closest: { id: string; distance: number } | null = null;
    for (const d of draggables) {
      const hits = this.raycaster.intersectObject(d.root, true);
      if (hits.length > 0 && (!closest || hits[0].distance < closest.distance)) {
        closest = { id: d.id, distance: hits[0].distance };
      }
    }
    if (!closest) return;

    this.draggingId = closest.id;
    this.params.setOrbitEnabled(false);
    this.params.domElement.setPointerCapture(e.pointerId);
  };

  private handlePointerUp = (e: PointerEvent): void => {
    if (!this.draggingId) return;
    const id = this.draggingId;
    this.draggingId = null;
    this.params.setOrbitEnabled(true);
    this.params.domElement.releasePointerCapture(e.pointerId);

    this.updatePointer(e);
    const hit = this.floorHit();
    this.params.onDrop(id, hit ? resolveDropTarget(hit) : null);
  };

  dispose(): void {
    this.params.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.params.domElement.removeEventListener('pointerup', this.handlePointerUp);
    this.params.domElement.removeEventListener('pointercancel', this.handlePointerUp);
  }
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 3: Wire it into SceneCanvas**

In `src/ui/SceneCanvas.tsx`, add imports:

```ts
import { BenchDragController } from '@/render/BenchDragController';
import { playerSlotInZone, zoneOfSlot } from '@/core/lineup/rotation';
```

Add a new ref near `dragControllerRef`:

```ts
  const benchDragControllerRef = useRef<BenchDragController | null>(null);
```

In the mount `useEffect`, right after the existing `dragControllerRef.current = dragController;` line, add:

```ts
    const benchDragController = new BenchDragController({
      domElement: renderer.renderer.domElement,
      camera: renderer.cameraRig.camera,
      getDraggables: () => [...bridge.getPlayerRoots(), ...bridge.getBenchRoots()],
      isEnabled: () => usePlaybackStore.getState().mode === 'formation',
      setOrbitEnabled: (enabled) => {
        renderer.cameraRig.controls.enabled = enabled;
      },
      onDrop: (sourceId, target) => {
        if (!target) return;
        const lineupState = useLineupStore.getState();

        if (sourceId.startsWith('bench:')) {
          const [, side, playerId] = sourceId.split(':') as [string, Side, string];
          if (target.kind !== 'zone' || target.side !== side) return;
          const slot = playerSlotInZone(lineupState.rotations[side], target.zone);
          lineupState.setOrderSlot(side, slot, playerId);
          return;
        }

        const [side, zoneStr] = sourceId.split(':') as [Side, string];
        const sourceZone = Number(zoneStr) as ZoneNumber;
        const rotation = lineupState.rotations[side];
        const sourceSlot = playerSlotInZone(rotation, sourceZone);

        if (target.kind === 'bench') {
          if (target.side !== side) return;
          lineupState.setOrderSlot(side, sourceSlot, null);
          return;
        }

        if (target.side !== side || target.zone === sourceZone) return;
        const targetSlot = playerSlotInZone(rotation, target.zone);
        const displacedPlayerId = lineupState.lineups[side].order[targetSlot];
        const movingPlayerId = lineupState.lineups[side].order[sourceSlot];
        lineupState.setOrderSlot(side, targetSlot, movingPlayerId);
        lineupState.setOrderSlot(side, sourceSlot, displacedPlayerId);
      },
    });
    benchDragControllerRef.current = benchDragController;
```

Add `ZoneNumber` to this file's existing `@/core/court/zones` import if it isn't already imported (check the top of the file — it likely already imports `ZoneNumber` for other uses; if so, skip this).

In the mount effect's cleanup function, right after `dragController.dispose();`, add:

```ts
      benchDragController.dispose();
```

- [ ] **Step 4: Verify build, lint, tests**

Run: `npx tsc -b --noEmit && npm run lint && npm test -- --run`
Expected: all clean.

- [ ] **Step 5: Manual verification**

In the browser, formation mode: drag a bench silhouette onto an empty-looking court zone (or one with a player, to test the swap) and confirm the lineup panel's slot updates to match. Drag an on-court player back onto their own bench row and confirm they're benched (their zone becomes empty, `ValidationPanel` reflects a non-full lineup if applicable). Confirm dragging a Team A bench player onto Team B's court does nothing (the `target.side !== side` guards). Confirm this has no effect at all in author or play mode (orbit still works normally there without accidentally triggering a bench drag).

- [ ] **Step 6: Commit**

```bash
git add src/render/BenchDragController.ts src/ui/SceneCanvas.tsx
git commit -m "Drag players on and off the court from the bench"
git push origin main
```

---

## Task 6: Core additions for guided authoring — role/zone reverse lookup and set-tempo apex table

**Files:**
- Modify: `src/core/tactics/attack.ts`
- Test: `tests/attack.test.ts`

**Interfaces:**
- Produces: `ROLE_TO_ZONE: Record<HitterRole, AttackZone>`, `SET_TEMPO_APEX_M: Record<SetCall, number>`

- [ ] **Step 1: Write the failing tests**

Add to `tests/attack.test.ts`:

```ts
describe('ROLE_TO_ZONE', () => {
  it('is the exact inverse of ZONE_TO_ROLE', () => {
    for (const [zoneStr, role] of Object.entries(ZONE_TO_ROLE)) {
      expect(ROLE_TO_ZONE[role]).toBe(Number(zoneStr));
    }
  });
});

describe('SET_TEMPO_APEX_M', () => {
  it('has an entry for every set call', () => {
    for (const call of Object.keys(SET_TEMPO_S) as SetCall[]) {
      expect(SET_TEMPO_APEX_M[call]).toBeGreaterThan(0);
    }
  });

  it('a high ball arcs higher than a quick set', () => {
    expect(SET_TEMPO_APEX_M.high).toBeGreaterThan(SET_TEMPO_APEX_M.quick);
  });
});
```

Update the import line at the top of `tests/attack.test.ts` to include the new names:

```ts
import {
  APPROACH_PROFILES,
  ATTACK_CONTACT_BY_ZONE,
  computeApproachLane,
  computeBlockFeasibility,
  ROLE_TO_ZONE,
  SET_TEMPO_APEX_M,
  SET_TEMPO_S,
  ZONE_TO_ROLE,
  type SetCall,
} from '@/core/tactics/attack';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run tests/attack.test.ts`
Expected: FAIL, `ROLE_TO_ZONE`/`SET_TEMPO_APEX_M` not exported.

- [ ] **Step 3: Implement**

In `src/core/tactics/attack.ts`, right after the `ZONE_TO_ROLE` constant, add:

```ts
/** The reverse of ZONE_TO_ROLE — which zone a guided-mode "set to the outside hitter" style choice resolves to. */
export const ROLE_TO_ZONE: Record<HitterRole, AttackZone> = { OH: 4, MB: 3, RS: 2, pipe: 6 };
```

Right after the `SET_TEMPO_S` constant, add:

```ts
/** Apex height per set call, in meters — a quick set arcs low and fast, a high ball loops well above the antenna height. Paired with SET_TEMPO_S's durations for the guided workflow's set-height defaults. */
export const SET_TEMPO_APEX_M: Record<SetCall, number> = {
  quick: 2.4,
  '31': 2.7,
  shoot: 2.9,
  go: 3.2,
  high: 3.8,
  pipe: 4.2,
  bic: 3.0,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run tests/attack.test.ts`
Expected: PASS, all tests in the file green.

- [ ] **Step 5: Run full suite, typecheck, lint**

Run: `npm test -- --run && npx tsc -b --noEmit && npm run lint`
Expected: all clean.

- [ ] **Step 6: Commit**

```bash
git add src/core/tactics/attack.ts tests/attack.test.ts
git commit -m "Add role-to-zone reverse lookup and set-tempo apex table"
git push origin main
```

---

## Task 7: Core additions for guided authoring — per-action defaults

**Files:**
- Create: `src/core/play/guidedDefaults.ts`
- Test: `tests/guidedDefaults.test.ts`

**Interfaces:**
- Produces: `GuidedContactAction`, `GuidedPositionAction`, `GuidedAction` (union types), `GUIDED_CONTACT_DEFAULTS: Record<GuidedContactAction, GuidedContactDefaults>`, `GUIDED_POSITION_DEFAULTS: Record<GuidedPositionAction, GuidedPositionDefaults>`

- [ ] **Step 1: Write the failing test**

Create `tests/guidedDefaults.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { GUIDED_CONTACT_DEFAULTS, GUIDED_POSITION_DEFAULTS } from '@/core/play/guidedDefaults';

describe('GUIDED_CONTACT_DEFAULTS', () => {
  const actions = ['serve', 'pass', 'set', 'attack', 'tip'] as const;

  it('has a complete, positive entry for every contact action', () => {
    for (const action of actions) {
      const d = GUIDED_CONTACT_DEFAULTS[action];
      expect(d.apexM).toBeGreaterThan(0);
      expect(d.ballDurationS).toBeGreaterThan(0);
      expect(d.movementDurationS).toBeGreaterThan(0);
    }
  });

  it('an attack peaks near contact, not mid-flight', () => {
    expect(GUIDED_CONTACT_DEFAULTS.attack.apexU).toBeLessThan(0.5);
  });

  it('an attack is faster than a serve', () => {
    expect(GUIDED_CONTACT_DEFAULTS.attack.ballDurationS).toBeLessThan(GUIDED_CONTACT_DEFAULTS.serve.ballDurationS);
  });
});

describe('GUIDED_POSITION_DEFAULTS', () => {
  const actions = ['block', 'dig', 'move'] as const;

  it('has a complete, positive entry for every position-only action', () => {
    for (const action of actions) {
      const d = GUIDED_POSITION_DEFAULTS[action];
      expect(d.movementDurationS).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/guidedDefaults.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

Create `src/core/play/guidedDefaults.ts`:

```ts
import type { BallProfileId, MovementMode } from './types';
import type { PoseId } from './poses';

export type GuidedContactAction = 'serve' | 'pass' | 'set' | 'attack' | 'tip';
export type GuidedPositionAction = 'block' | 'dig' | 'move';
export type GuidedAction = GuidedContactAction | GuidedPositionAction;

export interface GuidedContactDefaults {
  profile: BallProfileId;
  apexM: number;
  apexU?: number;
  ballDurationS: number;
  movementMode: MovementMode;
  movementDurationS: number;
  pose: PoseId;
  jump?: { atT: number; heightM: number; hangS: number };
}

/**
 * Starting-point numbers for each ball-contact action in the guided
 * workflow, seeded from the same values the hand-authored demo plays
 * already use (fixtures/demoPlay.ts, demoPlays.ts) so a guided play looks
 * and times the same as a hand-tuned one. The coach adjusts the arc height
 * via the side-view picker; everything else here is a reasonable default,
 * still editable afterward in Advanced mode.
 */
export const GUIDED_CONTACT_DEFAULTS: Record<GuidedContactAction, GuidedContactDefaults> = {
  serve: { profile: 'floatServe', apexM: 3.2, ballDurationS: 1.1, movementMode: 'approach', movementDurationS: 0.35, pose: 'serveContact' },
  pass: { profile: 'pass', apexM: 3.0, ballDurationS: 0.9, movementMode: 'shuffle', movementDurationS: 0.5, pose: 'passLow' },
  set: { profile: 'quick', apexM: 2.7, ballDurationS: 0.75, movementMode: 'sprint', movementDurationS: 0.4, pose: 'set' },
  attack: {
    profile: 'attack',
    apexM: 3.3,
    apexU: 0.15,
    ballDurationS: 0.4,
    movementMode: 'approach',
    movementDurationS: 0.5,
    pose: 'attack',
    jump: { atT: 0.2, heightM: 0.55, hangS: 0.3 },
  },
  tip: { profile: 'tip', apexM: 1.6, ballDurationS: 0.35, movementMode: 'approach', movementDurationS: 0.4, pose: 'attack' },
};

export interface GuidedPositionDefaults {
  movementMode: MovementMode;
  movementDurationS: number;
  pose: PoseId;
}

/** Position-only guided actions: no ball segment, just a pose and (optionally, if the coach also drags them) a movement. */
export const GUIDED_POSITION_DEFAULTS: Record<GuidedPositionAction, GuidedPositionDefaults> = {
  block: { movementMode: 'shuffle', movementDurationS: 0.4, pose: 'block' },
  dig: { movementMode: 'shuffle', movementDurationS: 0.4, pose: 'dig' },
  move: { movementMode: 'run', movementDurationS: 0.5, pose: 'ready' },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/guidedDefaults.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full suite, typecheck, lint**

Run: `npm test -- --run && npx tsc -b --noEmit && npm run lint`
Expected: all clean.

- [ ] **Step 6: Commit**

```bash
git add src/core/play/guidedDefaults.ts tests/guidedDefaults.test.ts
git commit -m "Add per-action defaults for guided play authoring"
git push origin main
```

---

## Task 8: Pure play-building logic for guided authoring

**Files:**
- Create: `src/app/guidedAuthoring.ts`
- Test: `tests/guidedAuthoring.test.ts`

**Interfaces:**
- Consumes: `Play`, `PlayStep`, `Movement`, `BallSegment`, `PlayerRef`, `PositionRef` (`core/play/types.ts`), `GUIDED_CONTACT_DEFAULTS`, `GUIDED_POSITION_DEFAULTS` (Task 7), `SET_TEMPO_S`, `SET_TEMPO_APEX_M`, `ROLE_TO_ZONE`, `ATTACK_CONTACT_BY_ZONE` (Task 6 / existing), `HitterRole`, `SetCall` (`core/tactics/attack.ts`)
- Produces: `GuidedTarget`, `CommitContactParams`, `CommitPositionParams`, `commitContactAction(play: Play, params: CommitContactParams): Play`, `commitPositionAction(play: Play, params: CommitPositionParams): Play`, `describeStep(step: PlayStep): string`

This file is intentionally pure (no `zustand`/`react`/`three` imports) so it's testable the same way `core/` is, even though it lives in `app/` because it depends on `PlayerRef`/`PositionRef` resolution conventions that are specific to how this app's UI identifies players (by `onCourtId`), not a domain rule `core/` itself needs to know.

- [ ] **Step 1: Write the failing tests**

Create `tests/guidedAuthoring.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { commitContactAction, commitPositionAction, describeStep } from '@/app/guidedAuthoring';
import type { Play } from '@/core/play/types';

const blankPlay = (): Play => ({
  id: 'test-play',
  name: 'Test',
  schemaVersion: 1,
  scenario: { lineupIds: { A: 'a', B: 'b' }, rotations: { A: 0, B: 0 } },
  initial: { players: [], ball: { side: 'A', pos: { lat: 3, depth: 8.7 }, y: 1.3 } },
  steps: [],
});

describe('commitContactAction', () => {
  it('appends a new step with a ball segment for a serve', () => {
    const play = commitContactAction(blankPlay(), {
      action: 'serve',
      onCourtId: 'A:1',
      side: 'A',
      target: { lat: 0, depth: -6.6 },
    });
    expect(play.steps).toHaveLength(1);
    expect(play.steps[0].ball?.kind).toBe('serve');
    expect(play.steps[0].movements[0].who).toEqual({ side: 'A', kind: 'slot', index: 1 });
  });

  it('closes the previously open step and starts a new one for a second contact', () => {
    let play = commitContactAction(blankPlay(), { action: 'serve', onCourtId: 'A:1', side: 'A', target: { lat: 0, depth: -6.6 } });
    play = commitContactAction(play, { action: 'pass', onCourtId: 'B:5', side: 'B', target: { lat: 1.5, depth: 2.0 } });
    expect(play.steps).toHaveLength(2);
    expect(play.steps[1].ball?.kind).toBe('pass');
  });

  it('a set resolves its target from the chosen hitter role, not a click', () => {
    const play = commitContactAction(blankPlay(), {
      action: 'set',
      onCourtId: 'B:0',
      side: 'B',
      setTarget: { role: 'OH', tempo: '31' },
    });
    const ball = play.steps[0].ball!;
    expect(ball.profile).toBe('31');
    expect(ball.to).toEqual({ kind: 'zoneAnchor', side: 'B', zone: 4 });
  });
});

describe('commitPositionAction', () => {
  it('appends a movement to the currently open step, not a new one', () => {
    let play = commitContactAction(blankPlay(), { action: 'serve', onCourtId: 'A:1', side: 'A', target: { lat: 0, depth: -6.6 } });
    play = commitPositionAction(play, { action: 'move', onCourtId: 'B:6', side: 'B', target: { lat: -1, depth: 5 } });
    expect(play.steps).toHaveLength(1);
    expect(play.steps[0].movements).toHaveLength(2);
  });

  it('starts a fresh step when nothing is open yet', () => {
    const play = commitPositionAction(blankPlay(), { action: 'move', onCourtId: 'B:6', side: 'B', target: { lat: -1, depth: 5 } });
    expect(play.steps).toHaveLength(1);
    expect(play.steps[0].ball).toBeUndefined();
  });
});

describe('describeStep', () => {
  it('describes a serve in plain language', () => {
    const play = commitContactAction(blankPlay(), { action: 'serve', onCourtId: 'A:1', side: 'A', target: { lat: 0, depth: -6.6 } });
    expect(describeStep(play.steps[0])).toContain('serves');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run tests/guidedAuthoring.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

Create `src/app/guidedAuthoring.ts`:

```ts
import type { LocalPos, Side } from '@/core/court/coordinates';
import type { BallSegment, Movement, Play, PlayerRef, PlayStep } from '@/core/play/types';
import { GUIDED_CONTACT_DEFAULTS, GUIDED_POSITION_DEFAULTS, type GuidedContactAction, type GuidedPositionAction } from '@/core/play/guidedDefaults';
import { ATTACK_CONTACT_BY_ZONE, ROLE_TO_ZONE, SET_TEMPO_APEX_M, SET_TEMPO_S, type HitterRole, type SetCall } from '@/core/tactics/attack';

export interface GuidedTarget {
  lat: number;
  depth: number;
  y?: number;
  apexM?: number;
}

export interface SetTarget {
  role: HitterRole;
  tempo: SetCall;
}

export interface CommitContactParams {
  action: GuidedContactAction;
  /** `side:slot`, matching author-mode's onCourtId scheme. */
  onCourtId: string;
  side: Side;
  /** Required for every contact action except 'set', which derives its own target from `setTarget`. */
  target?: GuidedTarget;
  setTarget?: SetTarget;
  stepDurationS?: number;
}

export interface CommitPositionParams {
  action: GuidedPositionAction;
  onCourtId: string;
  side: Side;
  target: GuidedTarget;
}

const onCourtIdToPlayerRef = (onCourtId: string): PlayerRef => {
  const [side, slotStr] = onCourtId.split(':') as [Side, string];
  return { side, kind: 'slot', index: Number(slotStr) };
};

const holdMovement = (who: PlayerRef, pose: Movement['pose'], mode: Movement['mode'], durationS: number, jump?: Movement['jump']): Movement => ({
  who,
  to: { kind: 'atPlayer', who, contact: 'feet' },
  mode,
  pose,
  duration: durationS,
  jump,
});

const moveMovement = (who: PlayerRef, side: Side, target: GuidedTarget, mode: Movement['mode'], pose: Movement['pose'], durationS: number): Movement => ({
  who,
  to: { kind: 'local', side, pos: { lat: target.lat, depth: target.depth }, y: target.y },
  mode,
  pose,
  duration: durationS,
});

/** Appends a new step for a ball-contact action, closing whatever step was previously open. */
export const commitContactAction = (play: Play, params: CommitContactParams): Play => {
  const who = onCourtIdToPlayerRef(params.onCourtId);
  const defaults = GUIDED_CONTACT_DEFAULTS[params.action];

  let ball: BallSegment;
  let movement: Movement;

  if (params.action === 'set') {
    if (!params.setTarget) throw new Error('commitContactAction: "set" requires setTarget');
    const zone = ROLE_TO_ZONE[params.setTarget.role];
    const apexM = SET_TEMPO_APEX_M[params.setTarget.tempo];
    ball = {
      kind: 'set',
      profile: params.setTarget.tempo,
      from: { kind: 'atPlayer', who, contact: 'hands' },
      to: { kind: 'zoneAnchor', side: params.side, zone },
      apexM,
      duration: SET_TEMPO_S[params.setTarget.tempo],
    };
    movement = holdMovement(who, defaults.pose, defaults.movementMode, defaults.movementDurationS);
  } else {
    if (!params.target) throw new Error(`commitContactAction: "${params.action}" requires target`);
    const apexM = params.target.apexM ?? defaults.apexM;
    ball = {
      kind: params.action === 'tip' ? 'tip' : params.action,
      profile: defaults.profile,
      from: { kind: 'atPlayer', who, contact: params.action === 'serve' ? 'hands' : 'reach' },
      to: { kind: 'local', side: params.side, pos: { lat: params.target.lat, depth: params.target.depth }, y: params.target.y ?? 0 },
      apexM,
      apexU: defaults.apexU,
      duration: defaults.ballDurationS,
    };
    movement = holdMovement(who, defaults.pose, defaults.movementMode, defaults.movementDurationS, defaults.jump);
  }

  const step: PlayStep = {
    id: crypto.randomUUID(),
    name: params.action[0].toUpperCase() + params.action.slice(1),
    duration: params.stepDurationS ?? ball.duration ?? 1,
    ball,
    movements: [movement],
  };

  return { ...play, steps: [...play.steps, step] };
};

// Note for whoever runs Task 8's manual/browser check (Task 12, Step 7):
// holdMovement's `to: { kind: 'atPlayer', who, contact: 'feet' }` is a
// self-reference — "resolve to wherever this same player already is." This
// relies on compile.ts resolving a step's movements against a snapshot taken
// at STEP START, before any of that step's own movements apply (see
// compile.ts's `snapshot` variable) — so a self-reference doesn't create a
// circular/stale read. This is inferred from reading compile.ts, not proven
// by a test in this plan. If a guided serve/attack/tip contact shows the
// player teleporting or freezing in the wrong pose during Task 12's browser
// check, this is the first place to look.

/** Adds a movement to the currently open (last) step, or starts a fresh no-ball step if none is open yet. "Open" here just means "the last step in the list" — there's no separate closed/open flag on PlayStep itself. */
export const commitPositionAction = (play: Play, params: CommitPositionParams): Play => {
  const who = onCourtIdToPlayerRef(params.onCourtId);
  const defaults = GUIDED_POSITION_DEFAULTS[params.action];
  const movement = moveMovement(who, params.side, params.target, defaults.movementMode, defaults.pose, defaults.movementDurationS);

  if (play.steps.length === 0) {
    const step: PlayStep = {
      id: crypto.randomUUID(),
      name: params.action[0].toUpperCase() + params.action.slice(1),
      duration: defaults.movementDurationS,
      movements: [movement],
    };
    return { ...play, steps: [step] };
  }

  const steps = [...play.steps];
  const last = steps[steps.length - 1];
  steps[steps.length - 1] = { ...last, movements: [...last.movements, movement] };
  return { ...play, steps };
};

const ZONE_NAME: Record<number, string> = { 1: 'zone 1', 2: 'zone 2', 3: 'zone 3', 4: 'zone 4', 5: 'zone 5', 6: 'zone 6' };

/** A step, rendered as one plain-language sentence for the guided workflow's Review list. */
export const describeStep = (step: PlayStep): string => {
  if (!step.ball) return `${step.name}: repositioning only.`;
  const to = step.ball.to;
  const target = to.kind === 'zoneAnchor' ? ZONE_NAME[to.zone] : to.kind === 'local' ? `(${to.pos.lat.toFixed(1)}, ${to.pos.depth.toFixed(1)})` : 'a teammate';
  const verb: Record<BallSegment['kind'], string> = {
    serve: 'serves to',
    pass: 'passes to',
    set: 'sets to',
    attack: 'attacks to',
    tip: 'tips to',
    roll: 'rolls to',
    block: 'blocks at',
    dig: 'digs to',
    free: 'sends the ball to',
  };
  return `${step.name}: ${verb[step.ball.kind]} ${target}.`;
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run tests/guidedAuthoring.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Run full suite, typecheck, lint**

Run: `npm test -- --run && npx tsc -b --noEmit && npm run lint`
Expected: all clean.

- [ ] **Step 6: Commit**

```bash
git add src/app/guidedAuthoring.ts tests/guidedAuthoring.test.ts
git commit -m "Add pure play-building logic for guided authoring"
git push origin main
```

---

## Task 9: Guided-mode UI state store

**Files:**
- Create: `src/app/store/useGuidedAuthorStore.ts`

**Interfaces:**
- Produces: `useGuidedAuthorStore` with state `{ selectedOnCourtId: string | null; pendingAction: GuidedAction | null; pendingTarget: GuidedTarget | null }` and actions `selectPlayer(onCourtId: string | null)`, `choosePendingAction(action: GuidedAction | null)`, `setPendingTarget(target: GuidedTarget | null)`, `reset()`

- [ ] **Step 1: Implement**

Create `src/app/store/useGuidedAuthorStore.ts`:

```ts
import { create } from 'zustand';
import type { GuidedAction } from '@/core/play/guidedDefaults';
import type { GuidedTarget } from '@/app/guidedAuthoring';

interface GuidedAuthorState {
  /** The player last clicked in the 3D view, `side:slot`, or null once their action is committed. */
  selectedOnCourtId: string | null;
  /** The action chosen for the selected player, awaiting a target click (or, for 'set', awaiting the target/tempo choice). */
  pendingAction: GuidedAction | null;
  /** The floor position clicked for the pending action, awaiting height confirmation via the side-view picker. */
  pendingTarget: GuidedTarget | null;

  selectPlayer: (onCourtId: string | null) => void;
  choosePendingAction: (action: GuidedAction | null) => void;
  setPendingTarget: (target: GuidedTarget | null) => void;
  reset: () => void;
}

export const useGuidedAuthorStore = create<GuidedAuthorState>((set) => ({
  selectedOnCourtId: null,
  pendingAction: null,
  pendingTarget: null,

  selectPlayer: (onCourtId) => set({ selectedOnCourtId: onCourtId, pendingAction: null, pendingTarget: null }),
  choosePendingAction: (action) => set({ pendingAction: action, pendingTarget: null }),
  setPendingTarget: (target) => set({ pendingTarget: target }),
  reset: () => set({ selectedOnCourtId: null, pendingAction: null, pendingTarget: null }),
}));

if (import.meta.env.DEV) {
  (window as unknown as { __guidedAuthorStore: typeof useGuidedAuthorStore }).__guidedAuthorStore = useGuidedAuthorStore;
}
```

- [ ] **Step 2: Verify typecheck and lint**

Run: `npx tsc -b --noEmit && npm run lint`
Expected: no errors. (This store isn't wired to anything yet — Tasks 10-13 connect it. A store with no consumers still typechecks and lints cleanly.)

- [ ] **Step 3: Commit**

```bash
git add src/app/store/useGuidedAuthorStore.ts
git commit -m "Add guided-mode UI state store"
git push origin main
```

---

## Task 10: 3D click-to-select and click-to-place controller

**Files:**
- Create: `src/render/GuidedPlayController.ts`

**Interfaces:**
- Consumes: same raycast approach as `PlayerDragController`/`BenchDragController`
- Produces: `GuidedPlayController` class, `constructor(params)`, `dispose()`

- [ ] **Step 1: Implement**

Create `src/render/GuidedPlayController.ts`:

```ts
import * as THREE from 'three';

export interface GuidedClickableRoot {
  /** `side:slot`, the onCourtId scheme play/author mode placements already use. */
  id: string;
  root: THREE.Object3D;
}

export interface GuidedPlayControllerParams {
  domElement: HTMLElement;
  camera: THREE.Camera;
  getClickables: () => GuidedClickableRoot[];
  isEnabled: () => boolean;
  /** A player was clicked directly. */
  onSelectPlayer: (id: string) => void;
  /** Open floor was clicked (no player under the pointer) — the pending action's target, in world space. */
  onSelectFloor: (worldPos: THREE.Vector3) => void;
}

const FLOOR_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

/**
 * Click-only (no drag) selection for the guided workflow: click a player to
 * select them, click open floor to place the pending action's target. A
 * plain click, not a drag, so it doesn't fight OrbitControls the way
 * PlayerDragController/BenchDragController's pointerdown-drag does — those
 * two disable orbiting mid-drag; this one only ever fires on pointerup with
 * no meaningful movement in between, which OrbitControls already treats as
 * "not a drag" and leaves alone.
 */
export class GuidedPlayController {
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private downAt: { x: number; y: number } | null = null;
  private params: GuidedPlayControllerParams;

  constructor(params: GuidedPlayControllerParams) {
    this.params = params;
    params.domElement.addEventListener('pointerdown', this.handlePointerDown);
    params.domElement.addEventListener('pointerup', this.handlePointerUp);
  }

  private updatePointer(clientX: number, clientY: number): void {
    const rect = this.params.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  private handlePointerDown = (e: PointerEvent): void => {
    this.downAt = { x: e.clientX, y: e.clientY };
  };

  private handlePointerUp = (e: PointerEvent): void => {
    if (!this.params.isEnabled() || !this.downAt) {
      this.downAt = null;
      return;
    }
    const movedPx = Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y);
    this.downAt = null;
    if (movedPx > 6) return; // an orbit drag, not a click

    this.updatePointer(e.clientX, e.clientY);
    this.raycaster.setFromCamera(this.pointer, this.params.camera);

    const clickables = this.params.getClickables();
    let closest: { id: string; distance: number } | null = null;
    for (const c of clickables) {
      const hits = this.raycaster.intersectObject(c.root, true);
      if (hits.length > 0 && (!closest || hits[0].distance < closest.distance)) {
        closest = { id: c.id, distance: hits[0].distance };
      }
    }
    if (closest) {
      this.params.onSelectPlayer(closest.id);
      return;
    }

    const hit = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(FLOOR_PLANE, hit)) {
      this.params.onSelectFloor(hit);
    }
  };

  dispose(): void {
    this.params.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.params.domElement.removeEventListener('pointerup', this.handlePointerUp);
  }
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/render/GuidedPlayController.ts
git commit -m "Add click-to-select and click-to-place controller for guided authoring"
git push origin main
```

---

## Task 11: Side-view height picker

**Files:**
- Create: `src/ui/SideHeightPicker.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Produces: `<SideHeightPicker apexM={number} onChange={(apexM: number) => void} maxM={number} />`

- [ ] **Step 1: Implement the component**

Create `src/ui/SideHeightPicker.tsx`:

```tsx
import { useRef } from 'react';

interface SideHeightPickerProps {
  apexM: number;
  onChange: (apexM: number) => void;
  maxM?: number;
}

const WIDTH = 90;
const HEIGHT = 160;
const FLOOR_Y = HEIGHT - 12;
const TOP_Y = 12;

/** A simple side-on diagram (floor line, draggable dot for the arc's peak) for adjusting a ball segment's apex height without typing a number. */
export function SideHeightPicker({ apexM, onChange, maxM = 5 }: SideHeightPickerProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const clampedApex = Math.min(Math.max(apexM, 0), maxM);
  const markerY = FLOOR_Y - (clampedApex / maxM) * (FLOOR_Y - TOP_Y);

  const yToApex = (clientY: number): number => {
    const svg = svgRef.current;
    if (!svg) return clampedApex;
    const rect = svg.getBoundingClientRect();
    const y = clientY - rect.top;
    const t = 1 - (y - TOP_Y) / (FLOOR_Y - TOP_Y);
    return Math.min(Math.max(t * maxM, 0), maxM);
  };

  const handlePointerDown = (e: React.PointerEvent<SVGCircleElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    onChange(yToApex(e.clientY));
  };

  const handlePointerMove = (e: React.PointerEvent<SVGCircleElement>) => {
    if (e.buttons === 0) return;
    onChange(yToApex(e.clientY));
  };

  return (
    <div className="side-height-picker">
      <svg ref={svgRef} width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <line x1={10} y1={FLOOR_Y} x2={WIDTH - 10} y2={FLOOR_Y} className="side-height-floor" />
        <line x1={20} y1={markerY} x2={WIDTH - 20} y2={FLOOR_Y} className="side-height-arc" />
        <line x1={20} y1={markerY} x2={WIDTH - 20} y2={markerY} className="side-height-guide" />
        <circle
          cx={WIDTH / 2}
          cy={markerY}
          r={7}
          className="side-height-handle"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
        />
      </svg>
      <span className="side-height-label">{clampedApex.toFixed(1)} m</span>
    </div>
  );
}
```

- [ ] **Step 2: Add its CSS**

In `src/App.css`, add:

```css
.side-height-picker {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.side-height-floor {
  stroke: #4a5058;
  stroke-width: 2;
}

.side-height-arc {
  stroke: #4c74bd;
  stroke-width: 1.5;
  stroke-dasharray: 3 3;
  fill: none;
}

.side-height-guide {
  stroke: #303640;
  stroke-width: 1;
  stroke-dasharray: 2 2;
}

.side-height-handle {
  fill: #4c74bd;
  cursor: grab;
  touch-action: none;
}

.side-height-label {
  font-size: 12px;
  color: #cfd4dc;
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 3: Verify build and lint**

Run: `npx tsc -b --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/ui/SideHeightPicker.tsx src/App.css
git commit -m "Add side-view height picker widget"
git push origin main
```

---

## Task 12: Guided authoring panel and full wiring

**Files:**
- Modify: `src/ui/panels/GuidedAuthorPanel.tsx` (created as a stub in Task 1)
- Modify: `src/ui/SceneCanvas.tsx`
- Modify: `src/ui/TransportBar.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Consumes: `useGuidedAuthorStore` (Task 9), `commitContactAction`/`commitPositionAction`/`describeStep` (Task 8), `GuidedPlayController` (Task 10), `SideHeightPicker` (Task 11), `usePlayEditorStore` (existing: `play`, `updatePlay` or equivalent setter — check its actual exported action name before using it), `GUIDED_CONTACT_DEFAULTS`/`GUIDED_POSITION_DEFAULTS` (Task 7)

- [ ] **Step 1: Check `usePlayEditorStore`'s exact update API**

Run: `grep -n "export const usePlayEditorStore" -A 40 src/app/store/usePlayEditorStore.ts`

Find the action that replaces the whole in-progress `play` object (it may be called `setPlay`, `updatePlay`, or similar — use whatever actually exists; do not guess a name that isn't there). The rest of this task refers to it as `setPlay(play: Play)`; substitute the real name.

- [ ] **Step 2: Write the panel**

Replace `src/ui/panels/GuidedAuthorPanel.tsx` with:

```tsx
import { useMemo } from 'react';
import { usePlayEditorStore } from '@/app/store/usePlayEditorStore';
import { useGuidedAuthorStore } from '@/app/store/useGuidedAuthorStore';
import { commitContactAction, commitPositionAction, describeStep, type SetTarget } from '@/app/guidedAuthoring';
import type { GuidedAction, GuidedContactAction } from '@/core/play/guidedDefaults';
import type { HitterRole, SetCall } from '@/core/tactics/attack';
import { SET_TEMPO_S } from '@/core/tactics/attack';
import { SideHeightPicker } from '@/ui/SideHeightPicker';
import { GUIDED_CONTACT_DEFAULTS } from '@/core/play/guidedDefaults';
import { usePlaybackStore } from '@/app/store/usePlaybackStore';

const CONTACT_ACTIONS: GuidedContactAction[] = ['serve', 'pass', 'set', 'attack', 'tip'];
const POSITION_ACTIONS: GuidedAction[] = ['block', 'dig', 'move'];
const HITTER_ROLES: HitterRole[] = ['OH', 'MB', 'RS', 'pipe'];
const SET_CALLS = Object.keys(SET_TEMPO_S) as SetCall[];

export function GuidedAuthorPanel() {
  const play = usePlayEditorStore((s) => s.play);
  const setPlay = usePlayEditorStore((s) => s.setPlay); // see Task 12 Step 1 — replace `setPlay` with the store's real action name if different

  const selectedOnCourtId = useGuidedAuthorStore((s) => s.selectedOnCourtId);
  const pendingAction = useGuidedAuthorStore((s) => s.pendingAction);
  const pendingTarget = useGuidedAuthorStore((s) => s.pendingTarget);
  const choosePendingAction = useGuidedAuthorStore((s) => s.choosePendingAction);
  const setPendingTarget = useGuidedAuthorStore((s) => s.setPendingTarget);
  const reset = useGuidedAuthorStore((s) => s.reset);

  const side = useMemo(() => (selectedOnCourtId ? (selectedOnCourtId.split(':')[0] as 'A' | 'B') : null), [selectedOnCourtId]);

  if (!play) return null;

  const confirmContact = (setTarget?: SetTarget) => {
    if (!selectedOnCourtId || !side || !pendingAction) return;
    if (pendingAction === 'block' || pendingAction === 'dig' || pendingAction === 'move') {
      if (!pendingTarget) return;
      setPlay(commitPositionAction(play, { action: pendingAction, onCourtId: selectedOnCourtId, side, target: pendingTarget }));
    } else {
      if (pendingAction !== 'set' && !pendingTarget) return;
      setPlay(
        commitContactAction(play, {
          action: pendingAction,
          onCourtId: selectedOnCourtId,
          side,
          target: pendingTarget ?? undefined,
          setTarget,
        }),
      );
    }
    reset();
  };

  return (
    <div className="panel guided-author-panel">
      <h3 className="panel-title">Design play</h3>

      {!selectedOnCourtId && <p className="panel-note">Click a player in the 3D view to choose their action.</p>}

      {selectedOnCourtId && !pendingAction && (
        <div className="control-group">
          {[...CONTACT_ACTIONS, ...POSITION_ACTIONS].map((action) => (
            <button key={action} className="chip" onClick={() => choosePendingAction(action)}>
              {action}
            </button>
          ))}
          <button className="chip" onClick={reset}>
            Cancel
          </button>
        </div>
      )}

      {selectedOnCourtId && pendingAction && pendingAction !== 'set' && !pendingTarget && (
        <p className="panel-note">Click a spot on the court for this {pendingAction}.</p>
      )}

      {selectedOnCourtId && pendingAction && pendingAction !== 'set' && pendingTarget && (
        <div className="control-group">
          <SideHeightPicker
            apexM={pendingTarget.apexM ?? GUIDED_CONTACT_DEFAULTS[pendingAction as GuidedContactAction]?.apexM ?? 2}
            onChange={(apexM) => setPendingTarget({ ...pendingTarget, apexM })}
          />
          <button className="chip chip-active" onClick={() => confirmContact()}>
            Confirm
          </button>
        </div>
      )}

      {selectedOnCourtId && pendingAction === 'set' && (
        <SetChooser onConfirm={confirmContact} />
      )}

      <hr className="guided-divider" />

      <div className="control-group">
        <button className="chip" onClick={() => usePlaybackStore.getState().setMode('play')}>
          ▶ Save & Play
        </button>
      </div>

      <div className="guided-review">
        {play.steps.map((step) => (
          <p key={step.id} className="panel-note">
            {describeStep(step)}
          </p>
        ))}
      </div>
    </div>
  );
}

function SetChooser({ onConfirm }: { onConfirm: (setTarget: SetTarget) => void }) {
  const pendingTarget = useGuidedAuthorStore((s) => s.pendingTarget);
  const setPendingTarget = useGuidedAuthorStore((s) => s.setPendingTarget);
  const role = (pendingTarget as unknown as { role?: HitterRole })?.role ?? null;
  const tempo = (pendingTarget as unknown as { tempo?: SetCall })?.tempo ?? null;

  return (
    <div className="control-group">
      <span className="control-label">Target</span>
      {HITTER_ROLES.map((r) => (
        <button
          key={r}
          className={role === r ? 'chip chip-active' : 'chip'}
          onClick={() => setPendingTarget({ lat: 0, depth: 0, ...(pendingTarget ?? {}), role } as never)}
        >
          {r}
        </button>
      ))}
      <span className="control-label">Tempo</span>
      {SET_CALLS.map((call) => (
        <button
          key={call}
          className={tempo === call ? 'chip chip-active' : 'chip'}
          onClick={() => setPendingTarget({ lat: 0, depth: 0, ...(pendingTarget ?? {}), tempo: call } as never)}
        >
          {call}
        </button>
      ))}
      <button className="chip chip-active" disabled={!role || !tempo} onClick={() => role && tempo && onConfirm({ role, tempo })}>
        Confirm
      </button>
    </div>
  );
}
```

Note the `SetChooser`'s `as never` casts: `pendingTarget` is typed as `GuidedTarget | null` in the store, which doesn't have `role`/`tempo` fields. Rather than widen that shared type for one special case, this stashes the two choices on the same field opportunistically. **This is a known rough edge, not a final design** — flag it in review. A cleaner follow-up (not required for this task to be considered done) would give `useGuidedAuthorStore` a dedicated `pendingSetTarget: Partial<SetTarget> | null` field instead of overloading `pendingTarget`. Leave a comment to that effect in the file:

```ts
// TODO(follow-up): pendingTarget is being overloaded to carry {role, tempo} for
// the 'set' action's two-choice flow. Works, but a dedicated pendingSetTarget
// field on useGuidedAuthorStore would be cleaner. See plan Task 12.
```

Add that comment directly above the `SetChooser` function.

- [ ] **Step 3: Wire GuidedPlayController into SceneCanvas**

In `src/ui/SceneCanvas.tsx`, add imports:

```ts
import { GuidedPlayController } from '@/render/GuidedPlayController';
import { useGuidedAuthorStore } from '@/app/store/useGuidedAuthorStore';
import { useAppStore } from '@/app/store/useAppStore'; // already imported — confirm, don't duplicate
```

Add a ref near `benchDragControllerRef`:

```ts
  const guidedPlayControllerRef = useRef<GuidedPlayController | null>(null);
```

In the mount `useEffect`, after the `benchDragController` block, add:

```ts
    const guidedPlayController = new GuidedPlayController({
      domElement: renderer.renderer.domElement,
      camera: renderer.cameraRig.camera,
      getClickables: () => bridge.getPlayerRoots(),
      isEnabled: () => {
        const playback = usePlaybackStore.getState();
        return playback.mode === 'author' && !useAppStore.getState().authorAdvancedMode;
      },
      onSelectPlayer: (id) => useGuidedAuthorStore.getState().selectPlayer(id),
      onSelectFloor: (worldPos) => {
        const guided = useGuidedAuthorStore.getState();
        if (!guided.selectedOnCourtId || !guided.pendingAction) return;
        const side = guided.selectedOnCourtId.split(':')[0] as Side;
        const local = toLocal({ x: worldPos.x, y: 0, z: worldPos.z }, side);
        guided.setPendingTarget({ lat: local.lat, depth: local.depth });
      },
    });
    guidedPlayControllerRef.current = guidedPlayController;
```

In the cleanup function, after `benchDragController.dispose();`, add:

```ts
      guidedPlayController.dispose();
```

- [ ] **Step 4: Highlight the selected player and any players missing an assigned action**

This step is a polish pass, not a hard requirement — skip it if time-constrained and note it as a follow-up. If doing it: reuse the existing `setViolationLinks`-style pattern is overkill for a single highlighted player; simplest approach is to give `PlayerVisual` no new API and instead rely on the guided panel's own text ("Selected: #N Name") to confirm who's selected, since `selectedOnCourtId` is already visible in React state. Add this line inside `GuidedAuthorPanel`, right after the `<h3>`:

```tsx
      {selectedOnCourtId && <p className="panel-note">Selected: {selectedOnCourtId}</p>}
```

(A friendlier player name lookup — resolving `selectedOnCourtId` through the roster to show "#3 Outside 1" instead of "B:1" — is a reasonable fast-follow; it needs `rosters`/`lineups`/`play.scenario.rotations` plumbed into this panel, which is straightforward but adds several lines; do it if it's quick, otherwise leave the raw id and note it as a follow-up.)

- [ ] **Step 5: Add the "Design play" button**

In `src/ui/TransportBar.tsx`, the button that creates a blank play already exists (`startNewPlay`, bound to "✎ New play"). Add a second button right after it, in the same `mode !== 'play'` branch:

```tsx
          <button className="chip" onClick={startNewPlay}>
            🏐 Design play
          </button>
```

This reuses the exact same `startNewPlay` handler as "New play" — guided mode is simply "author mode with `authorAdvancedMode` at its default `false`", which is already the default from Task 1, so no new creation path is needed. Given that, **don't add a second button with the same behavior as an existing one** — instead just rename the existing "✎ New play" button's label to `"🏐 Design play"` and delete the "✎ New play" label entirely, since they'd otherwise be two identical buttons. Confirm which framing reads better in the browser during manual verification (Step 7) and pick one; don't ship both.

- [ ] **Step 6: Verify build, lint, tests**

Run: `npx tsc -b --noEmit && npm run lint && npm test -- --run`
Expected: all clean, 108+ tests passing (Tasks 6-8 added new ones).

- [ ] **Step 7: Manual verification**

In the browser: from formation mode, click "Design play" (or whatever the button ended up labeled per Step 5). Confirm you land in author mode with no sidebar, just the guided panel. Click a player: the action list appears. Choose "Serve": a prompt to click the court appears. Click a spot: the height picker appears with a sensible default height already shown; drag it, confirm the number updates; click Confirm: the panel returns to "click a player," and the Review list at the bottom shows one line describing the serve. Repeat for a Pass, then a Set (confirm the target/tempo two-step chooser works and the review sentence looks right), then an Attack. Click "Save & Play" and confirm the resulting play actually animates through the transport bar. Flip "⚙ Advanced" on mid-build at some point and confirm the exact same steps show up in the full TimelineEditor/StepInspector.

- [ ] **Step 8: Commit**

```bash
git add src/ui/panels/GuidedAuthorPanel.tsx src/ui/SceneCanvas.tsx src/ui/TransportBar.tsx src/App.css
git commit -m "Wire up the guided play authoring workflow"
git push origin main
```

---

## Task 13: GitHub presentation pass

**Files:**
- Modify: `README.md`
- Modify: `HANDOFF.md`

- [ ] **Step 1: Update README's feature list and roadmap**

Add a bullet under "What it does today" describing the Simple/Advanced toggle, on-court bench, and guided play authoring, in the same plain, em-dash-free style as the rest of the file (see the existing bullets for tone). Note in the Roadmap section that this was a post-v1 addition on top of the original seven-phase plan.

- [ ] **Step 2: Update HANDOFF.md**

Add a new "What's built" entry for this work, following the same pattern as the Phase 1-7 entries (what exists, which files, what's simplified, what's an honest gap — the `SetChooser`'s `pendingTarget` overload from Task 12 belongs here as a named gap, not silently left for someone to trip over).

- [ ] **Step 3: Verify the live site**

Confirm the latest Vercel deployment (auto-triggered by Task 12's push) is `READY` and the new features work at the production URL, not just locally.

- [ ] **Step 4: Commit**

```bash
git add README.md HANDOFF.md
git commit -m "Document simple mode and guided authoring in README/HANDOFF"
git push origin main
```

---

## Self-Review Notes

- **Spec coverage:** Feature 1 → Task 1. Feature 2 → Task 2. Feature 3 → Tasks 3-5. Feature 4 → Tasks 6-12 (core defaults, pure play-building, state store, 3D controller, height widget, panel + wiring). GitHub wrap-up → Task 13. All four spec features and the spec's closing "pretty and organized" instruction are covered.
- **Known rough edge, called out rather than hidden:** Task 12's `pendingTarget` overload for the set-target/tempo choice. A real limitation of this plan's scope, documented in-file and in HANDOFF rather than silently shipped.
- **Type consistency check:** `GuidedTarget` (Task 8) is used identically in `useGuidedAuthorStore` (Task 9), `GuidedPlayController`'s `onSelectFloor` callback (Task 10, produces raw `THREE.Vector3` that Task 12's wiring converts to `GuidedTarget` via `toLocal`), and `GuidedAuthorPanel` (Task 12). `onCourtId` as `side:slot` string is used consistently in Tasks 8, 9, 10, 12 — confirmed against the existing convention already used by `PlayerDragController`'s `onDragEnd` handler in `SceneCanvas.tsx` (`id.split(':')`).
