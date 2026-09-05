# Handoff

Context for picking this project back up in a fresh session: what's done, why it's built the way it is, and the non-obvious things already worked through so they don't get re-discovered the hard way.

## Where everything lives

- **Repo:** https://github.com/aryanyaksh-art/volleyball-simulator
- **Local checkout:** `C:\dev\volleyball-simulator`, deliberately not under `OneDrive`. OneDrive tries to sync `node_modules` (tens of thousands of files) and its file-locking breaks Vite's watcher. Don't move it back.
- **Original plan doc:** `C:\Users\aryan\.claude\plans\i-have-this-random-bright-knuth.md` on this machine has the full original architecture plan (data model, rotation math, overlap-validation spec, ball flight math, the four feature areas). It's still accurate for Phase 2 onward. Read it before designing Phase 2 from scratch.
- Everything below is already committed and pushed. Nothing about this project's state depends on any chat's memory.

## What's actually done (Phase 0 + Phase 1)

- Vite + React 19 + TypeScript strict scaffold, Vitest for the domain layer, ESLint with a hard boundary rule: `src/core` cannot import `three`, `react`, or anything from `src/render`/`src/ui`. That's what keeps the volleyball rules unit-testable headless and the visual style swappable.
- Court geometry, team-local to world coordinate transform (`core/court/coordinates.ts`, the one abstraction that keeps rotation/overlap logic symmetric for both sides; get familiar with it before touching Phase 2 rotation code).
- Free-orbit camera (drag/zoom) plus 5 tweened presets.
- A real-looking net: translucent panel running floor-to-band (not just a strip near the top), padded support posts, banded top and bottom edges, dashed antenna.
- Humanoid silhouettes: tapered torso (via `THREE.LatheGeometry`), hip girdle, neck, hands, feet, not a stick of uniform capsules. Flat `MeshBasicMaterial`, no scene lighting needed.
- All 16 poses (`idle`, `ready`, `passLow`, `passHigh`, `set`, `jumpSet`, `approach`, `load`, `attack`, `followThrough`, `block`, `dig`, `sprawl`, `serveToss`, `serveContact`, `transition`) authored and verified against real technique.
- 3 theme presets (`blueprint`, `court`, `whiteboard`). The user picks/tunes the real one later; every renderer module reads from `Theme`, no color literal lives outside it.

## Things that will bite you if you don't know them

### The pose rotation sign convention (already fixed, don't re-break it)

`poseRig.ts` is authored so a positive `x` means "swing forward, toward the net" and a positive `z` means "swing outward, away from the midline," the intuitive way to read a pose table. Three.js's actual rotation math does the opposite for both axes on a hanging limb. This was empirically verified, not derived on paper (paper derivation got the sign wrong twice before empirical testing settled it), by directly reading a joint's world-space direction via its `matrixWorld` and checking it against the net/midline.

The fix lives in `CapsuleHumanoid.setPose()`: it negates `x` and `z` for `spine`, `shoulderL/R`, and `hipL/R` before calling `rotation.set(...)`. The knees are the one joint that needed no correction: their natural "shin swings behind the thigh" bend already matched Three.js's math with a positive angle unchanged. If you add new poses or new joints, verify the direction empirically (set a single joint, read `matrixWorld`, check world position against something you know) before trusting a hand-derived sign.

### Shoulder rotation compounds with spine lean

`shoulderL/R` are children of `spine` in the hierarchy, so a spine forward lean adds to the shoulder's own forward swing, correctly, exactly like a real shoulder moving with a leaning torso. Each pose's authored shoulder angle is (desired total forward reach) minus (that pose's spine.x). If you tune a pose's spine lean, the shoulder angle needs to move with it or the arm will reach further (or less far) than intended. Hip angles do not need this treatment: the hip is a child of the pelvis, which never rotates.

### `preserveDrawingBuffer: true` is intentional

`SceneRenderer.ts` sets this on the WebGL context so `canvas.toDataURL()` works (used this session to capture reference screenshots) and so the Phase 7 PNG rotation-sheet export will work. Cheap for this scene's complexity. Don't remove it as a "perf cleanup."

### Dev-only debug hooks exist

`SceneCanvas.tsx` attaches `window.__appStore`, `window.__sceneBridge`, and `window.__sceneRenderer` to the page, gated behind `import.meta.env.DEV` (never ships in a prod build). These made it possible to drive poses/camera/theme and read back exact joint rotations from outside React, which is how the sign-convention bug above actually got found and fixed instead of just eyeballed. Keep using them for anything that needs precise verification rather than guessing from a screenshot.

### Testing in an automated browser: render-loop stalls

If you're driving the dev server through a headless/automated browser tool (as this session did), be aware: when the browser pane isn't the foreground/visible surface, `requestAnimationFrame` can stall, so the Three.js render loop stops advancing even though application state (Zustand store, Three.js object rotations) updates correctly and instantly. Symptom: you change a pose, take a screenshot, and it's pixel-identical to the previous one. The scene graph is right, the canvas just never repainted. Two things that reliably force a repaint: taking a `computer` screenshot action (not a JS-only call), and doing it inside the same batched call as the state change rather than as a separate subsequent tool call. Manually setting `camera.position` / calling `controls.update()` directly (bypassing the store's `goToCameraPreset`) seemed to make the stalling worse. Prefer driving the camera through the store when you need a reliable re-render during testing.

## What's next: Phase 2, the rotation engine

Per the original plan: roster (`core/roster/types.ts`), lineups and the 5-1/6-2/4-2 systems (`core/lineup/`), the overlap/alignment validator (`core/rules/overlap.ts`, checked only at serve contact, 7 adjacent-pair comparisons, server exempt), and the UI surface (`RosterPanel`, `LineupPanel`, `RotationWheel`, `ValidationPanel`, `ViolationOverlay`). The `ZONE_BASE` anchors already in `core/court/anchors.ts` are overlap-legal by construction; the validator should confirm that as its first test case.

Ship target: build a real 5-1 roster, click through all 6 rotations, see live overlap legality with the illegal pair highlighted and the camera focusing on it.
