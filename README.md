# Volleyball Strategy Simulator

A 3D volleyball strategy tool for coaches, not a game. Build a roster and lineup, step through the six rotations with live overlap-legality checking, author a play by dragging players around a real court, and watch it animate with real ball physics from any camera angle. Built to help plan actual game plans: "here's what we run in rotation 3 against a short serve."

![Volleyball Strategy Simulator, court view](docs/screenshot.png)

## What it does today

- **Rotation engine.** A real 5-1/6-2/4-2 roster, drag-and-drop lineup editing (bench players on and off the serve order), and all six rotations with overlap-rule validation — illegal alignments are flagged live, with a 3D connector drawn between the offending pair and a margin shown for every pair, not just violations.
- **Play authoring.** Script a sequence of steps (serve, pass, set, attack) and either type exact coordinates or grab a player in the 3D view and drop them where you want — the primary editing gesture. Undo/redo, save to your browser, diagnostics that catch a move no human could physically make or a ball that would clip the net before you even hit play.
- **Deterministic playback.** Real closed-form ball arcs, pose-blended player movement, scrub/play/loop/speed controls. The same play looks identical every time — no randomness, no drift.

Players render as flat, orbit-camera-friendly humanoid silhouettes holding real volleyball stances (dig, block, attack, set, and more) on a real net (padded posts, a visible gap above the floor, banded top and bottom edges) and court you can freely rotate, pan, and zoom, plus five one-click camera presets (top-down, sideline, behind the endline, and two angled views), all reading from a swappable theme.

**Not built yet:** serve-receive responsibility zones/seam coverage and attack/defense matchup analysis (block feasibility, approach lanes, tip coverage) — see [Roadmap](#roadmap).

## Status

Phases 0-4 are done: scaffold, court/camera/silhouettes, the rotation engine, the play model and deterministic playback, and a full authoring UI (timeline editor, step inspector, 3D drag-to-position, undo/redo, save). Phase 5 (serve-receive planning) is next. See [Roadmap](#roadmap) below, and [HANDOFF.md](HANDOFF.md) for a working session's worth of context on where things stand, decisions made, and pitfalls already worked through.

## Tech stack

- [Vite](https://vitejs.dev/) + [React 19](https://react.dev/) + TypeScript (strict)
- [Three.js](https://threejs.org/) for the 3D scene, driven imperatively (not react-three-fiber) so the frame loop stays independent of React's render cycle
- [Zustand](https://github.com/pmndrs/zustand) for UI state — one store per concern (lineup/roster, playback, the play being authored)
- [Vitest](https://vitest.dev/) for the domain layer, which runs headless in Node. The volleyball rules — rotation math, overlap validation, ball flight, deterministic playback — have zero dependency on a browser or a renderer, and are proven so by the test suite itself: if any of them could even import `three`, the run fails.

The codebase draws a hard line between `src/core` (pure volleyball domain logic: rotations, overlap rules, ball physics, with no rendering imports at all) and `src/render` (the Three.js scene, which reads a swappable `Theme` object). That boundary is enforced by an ESLint rule, not just convention, which is what makes the visual style fully replaceable without touching any game logic.

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL. Other useful commands:

```bash
npm test      # run the domain test suite (Vitest, headless)
npm run lint  # ESLint, including the core/render boundary rule
npm run build # production build
```

## Roadmap

- [x] **Phase 0.** Project scaffold.
- [x] **Phase 1.** Court, net, orbit camera, pose-able silhouettes, theme system.
- [x] **Phase 2.** Rotation engine (roster, lineups, 5-1/6-2/4-2 systems, overlap validation).
- [x] **Phase 3.** Play model and deterministic playback — ball flight, compile/evaluate, diagnostics, pose-blended animation, 3 demo plays.
- [x] **Phase 4.** Play authoring UI (timeline editor, step inspector, 3D drag-to-position, undo/redo, save). Ball-path editing and a full play library view are still open.
- [ ] **Phase 5.** Serve-receive planner (responsibility zones, seam coverage, uncovered-area warnings).
- [ ] **Phase 6.** Attack/defense matchups (approach lanes, block feasibility, block shadow, tip coverage).
- [ ] **Phase 7.** Polish and deploy (presentation mode, PNG export, static hosting).

## License

MIT. See [LICENSE](LICENSE).
