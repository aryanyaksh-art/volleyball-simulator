# Handoff

Context for picking this project back up in a fresh session: what's done, why it's built the way it is, and the non-obvious things already worked through so they don't get re-discovered the hard way.

## Current status (read this first)

**Phases 0-5 are done and pushed.** Rotation engine, play model + deterministic playback, a full authoring UI (timeline, step inspector, 3D drag-to-position, ball-path editing, undo/redo, save), and serve-receive coverage analysis. Phase 6 (attack/defense matchups) is next — nothing in it exists yet.

- 83 tests passing (`npm test`), clean `tsc -b --noEmit`, clean `npm run lint`.
- Working tree is clean; local `main` and `origin/main` are in sync — verify with `git status` and `git log origin/main..HEAD` before assuming otherwise.
- The dev server may already be running at `http://localhost:5173` from a prior session (check with `curl localhost:5173` before starting another with `npm run dev` — a second instance on the same port will just fail to bind, harmless but noisy).
- [README.md](README.md) has the current feature list and roadmap checkboxes — it's kept in sync with reality, trust it for a quick external-facing summary. This file has the internal detail README doesn't.

## Where everything lives

- **Repo:** https://github.com/aryanyaksh-art/volleyball-simulator
- **Local checkout:** `C:\dev\volleyball-simulator`, deliberately not under `OneDrive`. OneDrive tries to sync `node_modules` (tens of thousands of files) and its file-locking breaks Vite's watcher. Don't move it back.
- **Original plan doc:** `C:\Users\aryan\.claude\plans\i-have-this-random-bright-knuth.md` on this machine has the full original architecture plan (data model, rotation math, overlap-validation spec, ball flight math, all four feature areas including the two not started yet). Read it before designing Phase 6 from scratch.
- Nothing about this project's state depends on any chat's memory — everything real lives in the repo, committed and pushed.

## Load-bearing gotchas (from Phase 0/1, still relevant)

### The pose rotation sign convention (already fixed, don't re-break it)

`poseRig.ts` is authored so a positive `x` means "swing forward, toward the net" and a positive `z` means "swing outward, away from the midline" — the intuitive way to read a pose table. Three.js's actual rotation math does the opposite for both axes on a hanging limb. This was empirically verified, not derived on paper (paper derivation got the sign wrong twice before empirical testing settled it), by directly reading a joint's world-space direction via its `matrixWorld` and checking it against the net/midline.

The fix lives in `CapsuleHumanoid`'s `applyJoints()`: it negates `x` and `z` for `spine`, `shoulderL/R`, and `hipL/R` before calling `rotation.set(...)`. The knees are the one joint that needed no correction. If you add new poses or new joints, verify the direction empirically (set a single joint, read `matrixWorld`, check world position against something you know) before trusting a hand-derived sign.

### Shoulder rotation compounds with spine lean

`shoulderL/R` are children of `spine`, so a spine forward lean adds to the shoulder's own forward swing — exactly like a real shoulder moving with a leaning torso. Each pose's authored shoulder angle is (desired total forward reach) minus (that pose's spine.x). If you tune a pose's spine lean, the shoulder angle needs to move with it. Hip angles don't need this treatment: the hip is a child of the pelvis, which never rotates.

### `preserveDrawingBuffer: true` is intentional

`SceneRenderer.ts` sets this on the WebGL context so `canvas.toDataURL()` works (used repeatedly this project to capture reference screenshots and the README's images) and so a future PNG rotation-sheet export (Phase 7) will work. Cheap for this scene's complexity. Don't remove it as a "perf cleanup."

### Dev-only debug hooks exist

`import.meta.env.DEV`-gated globals: `window.__appStore`, `window.__lineupStore`, `window.__playbackStore`, `window.__playEditorStore`, `window.__serveReceiveStore`, `window.__sceneBridge`, `window.__sceneRenderer`. Never ship in a prod build. Use these for anything that needs precise verification (reading exact joint rotations, driving state without racing a person clicking the UI, dispatching synthetic events) rather than guessing from a screenshot.

### Testing in an automated browser: render-loop stalls

When the browser pane isn't the foreground/visible surface, `requestAnimationFrame` can stall — application state updates correctly and instantly, but the Three.js render loop stops advancing, so a screenshot can look pixel-identical to the previous one even though the underlying state genuinely changed. Taking a `computer` screenshot action forces a repaint; do it in the same batched call as the state change when you need to observe something reliably. This also means sub-200ms animations (like the pose crossfade) can't be cleanly sampled this way — `SceneRenderer`'s dt-cap (0.25s per frame) collapses a stalled-then-resumed blend into 1-2 big steps instead of the ~15 a real focused tab would show. Verify fast transitions by code review + regression tests instead of trying to screenshot them mid-flight.

### Stale Vite dep cache can look exactly like a real bug

If you hit a `ReferenceError` for an identifier that's clearly imported correctly in the source — especially after several rapid edits or new-file additions to a heavily-imported file's dependency graph — don't trust it as a real bug before ruling out a stale cache: kill the dev server, `rm -rf node_modules/.vite`, restart, and load the page in a **fresh tab** (an already-open tab can hold a stale module graph too). This wasted real time once before the cache turned out to be the actual cause.

### `left_click_drag` doesn't fire real HTML5 drag-and-drop

Confirmed by testing: the browser automation's mouse-drag simulation moves the cursor but doesn't trigger native `dragstart`/`dragover`/`drop` events. To exercise HTML5 DnD handlers (the lineup bench, e.g.) from this environment, dispatch real `DragEvent`s with a `DataTransfer` via `javascript_tool` instead. Plain pointer-event-based drag (no native DnD — see `PlayerDragController`) works fine with `left_click_drag`.

## What's built

**Phase 0-1 — scaffold, court, camera, silhouettes.** Vite + React 19 + TypeScript strict, Vitest for the domain layer, ESLint boundary rule (`src/core` cannot import `three`/`react`/anything from `render`/`ui`). Court geometry and the team-local↔world coordinate transform (`core/court/coordinates.ts` — get familiar with `toLocal`/`toWorld` before touching anything rotation-related). Free-orbit camera + 5 tweened presets. A net with a real ~1m panel and a visible gap above the floor (not a floor-to-ceiling rectangle), padded posts, banded edges, dashed antennas. Humanoid silhouettes (tapered torso via `LatheGeometry`, hip girdle, hands, feet) with all 16 poses, now **pose-crossfaded** (`PlayerVisual.update(dt)` exponentially blends toward whatever pose was last requested, tau≈0.08s — poses no longer snap instantly). 3 theme presets, zero color literals outside `Theme`.

**Phase 2 — rotation engine.** `core/roster/`, `core/lineup/` (types, rotation math verified for all 36 rotation×zone combos, `breakdown()` derives on-court zone/row/server/functional-setter per rotation with automatic libero substitution), `core/rules/overlap.ts` (`checkAlignment()` — the exact 7 adjacent-pair comparisons, server-exempt, margins for every pair not just violations; `nudgeToLegal()` iteratively fixes violations, implemented and tested but not wired to any UI button yet). UI: `RosterPanel`/`LineupPanel`/`RotationWheel`/`ValidationPanel`/`FormationPanel`/`BenchPanel`, backed by `useLineupStore`. `LineupPanel` supports drag-and-drop between a bench and the 6 serve-order slots (plain HTML5 DnD, `ui/dragPlayer.ts`). `FormationPanel` is a manual per-zone position override — the only way to actually push a formation illegal in the running app (Phase 3+ real position data doesn't exist as an editable target here, since a play's own formation now serves that role once you're authoring a play). A 3D `ViolationOverlay` connector line draws between offending players live. No camera auto-focus on a violation yet.

**Phase 3 — play model + deterministic playback.** `core/play/types.ts` (symbolic `PlayerRef`/`PositionRef` refs), `compile.ts` (flattens `Play.steps` into absolute-time tracks, "hold" segments for anyone not given a movement, supports `Movement.via` waypoints split into proportional straight-line legs), `evaluate.ts` (pure function of `t` — no `dt` accumulation, verified deterministic by sampling 200 values of `t` twice and asserting identical results), `ballFlight.ts` (exact closed-form parabola, exact at both endpoints and the apex, supports an asymmetric `apexU` for a spike's near-contact peak), `diagnostics.ts` (`diagnosePlay()` surfaces the two checks the plan calls highest-value: `checkSpeedCap` — a move faster than a human can physically make — and `checkBallFlight` — net clip, antenna miss, landing out). Render wiring: `BallVisual`, `SceneRenderer.start()` takes a per-frame callback (the one seam playback ticks through — React never drives the render loop). 3 demo plays in `fixtures/demoPlays.ts` (serve/pass/set/attack; a pipe attack for the rotation where the setter's front row; a 1st-tempo quick middle), selectable via `TransportBar`. `core/play/bake.ts` resolves any play's symbolic refs down to concrete `{kind:'slot'}`/`{kind:'local'}` refs (including ball segments) — this is what makes a play safely editable in Phase 4, proven behavior-preserving by compiling a play before and after baking and asserting identical tracks.

**Phase 4 — play authoring.** `usePlayEditorStore` (the play being edited, `selectedStepId`, undo/redo history capped at 50 snapshots, `saveCurrentPlay()` to `localStorage`). `TimelineEditor` (step chips, reorder/resize/rename/add/remove) + `StepInspector` (per-step: every on-court player either "holds position" with a one-click "+ Move," or editable lat/depth/mode/pose; the ball's kind/apex/duration/from/to are editable too). `PlayerDragController` — the plan's primary authoring gesture: grab a player in the 3D view, drag across the floor plane (temporarily disables `OrbitControls`), snaps to 0.1m, Shift for free placement; only `pointerup` commits, via `moveOrAddMovement`. Editing a built-in demo forks it into a new saved play on first save rather than colliding with the demo's own id in the play picker.

**Phase 5 — serve-receive planning.** `core/tactics/serveReceive.ts`: `assignResponsibility()` is a multiplicatively-weighted Voronoi assignment (a libero/primary passer's higher weight extends their range past a nearer, lower-weight teammate), `isSeam` when the top two are within 0.4m. `solveTimeToHeight()` finds where a serve's parabola descends through a playable contact height (not floor contact) via bisection on `ballHeightAt()`. `analyzeServeReceive()` rasterizes the receiving half + free zone and combines both into a per-cell margin (flight time minus the fastest passer's reach time), classified safe/tight/uncovered. `CoverageHeatmap.ts` bakes the whole grid into one `BufferGeometry` (one draw call, not one mesh per cell). `ServeReceivePanel` + `useServeReceiveStore`: check passers, set weights, pick a serve origin zone, watch the heatmap and summary counts update live. Verified from a top-down camera with a real 3-passer system — the result is legible (green rings around passers, red in the seams/corners), not a uniform wash.

## Honest gaps, by area

**Rotation/lineup:** no camera auto-focus on a violation; `nudgeToLegal()` unused by any UI button.

**Play model:** `Movement.facing = {atPlayer: ...}` is typed but `compile.ts` only honors `{rad: ...}` (facing-toward-a-player silently holds the previous angle — never fixed because verifying the yaw convention needed the same kind of empirical check as the pose-sign issue above, and there wasn't time). No `TrajectoryLine`/`MotionTrail` — the ball is a plain sphere with no visual flight path. No persistence beyond raw JSON in `localStorage` — no zod schema, no versioned migration.

**Authoring:** no 3D drag for the ball (form fields only); no ghost-silhouette/dashed-path preview while dragging; no Alt-modifier snap-to-zone-anchor (only the 0.1m grid snap and Shift-for-free exist); `setStepDuration`'s minimum is a hardcoded 0.05s floor with no validation against its own ball segment's duration; no "extend this step" one-click apply from a speed-cap diagnostic (the suggested duration is computed and shown, just not clickable); no play library view (the picker dropdown shows one entry per saved play, no dedicated manage/browse panel).

**Serve-receive:** no serve type/target picker or click-to-place target — only a serve *origin* zone; the analysis covers the whole grid for that origin, not one aimed serve. No marching-squares contour outlines (flat per-cell color). Serve profile (speed/apex/contact height) is hardcoded, not derived from a serve-type choice — see the modeling-choice note below. `ServeReceivePanel.tsx` and `SceneCanvas.tsx` each independently build the same `Passer[]` list and call `analyzeServeReceive()` — works, verified consistent, but is real duplication a shared hook should replace. No formation presets (W, 3-passer, 2-passer, stack-left/right) or auto-nudge-to-legal.

**One serve-receive modeling choice worth knowing about, not a bug:** the default passer speed (`SPEED_CAP_MPS.shuffle`, 2.8 m/s) makes the uncovered fraction read larger than a coach might expect on first look (497 of 660 cells in one live test) — mathematically consistent with the inputs, just more pessimistic than real match footage might support, since there's no way yet to say "she'll run for it" instead of shuffle. Tune `serveSpeedMps`/`passerSpeedMps`/`serveApexM` in `ServeReceivePanel.tsx` and `SceneCanvas.tsx`'s serve-receive effect if the balance feels off.

## What's next: Phase 6, attack/defense matchups

Per the original plan: approach lanes (OH/MB/RS/pipe takeoff geometry), block feasibility (travel time vs. set tempo — "MB cannot reach the pin: needs 1.05s, has 0.62s"), block shadow (cast rays from the hitter's contact point over the block's top edge, flag defenders inside it), and tip coverage. None of this exists yet. True persistence (a zod schema + versioned migration) and Phase 7 (polish/deploy: presentation mode, PNG export, static hosting) are further out still.
