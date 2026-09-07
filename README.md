# Volleyball Strategy Simulator

[![Live demo](https://img.shields.io/badge/demo-live-3ecf5c?style=flat-square)](https://volleyball-simulator.vercel.app)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Built with Vite](https://img.shields.io/badge/build-vite-646cff?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![React 19](https://img.shields.io/badge/react-19-149eca?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![Three.js](https://img.shields.io/badge/three.js-black?style=flat-square&logo=three.js&logoColor=white)](https://threejs.org)
[![TypeScript](https://img.shields.io/badge/typescript-strict-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)

A 3D volleyball strategy tool for coaches, not a game. Build a roster and lineup, step through the six rotations with live overlap-legality checking, author a play by dragging players around a real court, and watch it animate with real ball physics from any camera angle. It plans an actual game plan: "here's what we run in rotation 3 against a short serve."

**[Try it live](https://volleyball-simulator.vercel.app)**. No install needed.

![Volleyball Strategy Simulator, court view](docs/screenshot.png)

## What it does today

- **Rotation engine.** A real 5-1/6-2/4-2 roster, drag-and-drop lineup editing, and all six rotations with overlap-rule validation. Illegal alignments get flagged live: a 3D connector draws between the offending pair, and a margin shows for every pair, not just violations. The libero renders in its own color so it's never confused with a regular starter, and an on-court bench (past each team's own endline) lets you drag a player onto the field or back off it directly in 3D.
- **Guided play authoring.** Click a player, pick what they do (serve, pass, set, attack, tip, block, dig, or just reposition), click where the ball goes, and drag a simple side-view marker to set how high it arcs. A setter's "set" picks a target hitter and a tempo instead of a raw coordinate. Every step reads back as a plain sentence in a running list, and it's the exact same play data the advanced editor uses underneath: flip "Advanced" on at any point to fine-tune the same play by hand. Advanced is the older, denser timeline editor (below), now opt-in rather than the default.
- **Play authoring (advanced).** Script a sequence of steps (serve, pass, set, attack), then either type exact coordinates or grab a player in the 3D view and drop them where you want. That drag is the primary editing gesture. Undo/redo, save to your browser, and diagnostics catch a move no human could physically make, or a ball that would clip the net, before you even hit play.
- **Deterministic playback.** Real closed-form ball arcs, pose-blended player movement, scrub/play/loop/speed controls. The same play looks identical every time. No randomness, no drift.
- **Serve-receive planning.** Pick your passers (with adjustable range for a libero or primary passer), a serve origin, and watch a live coverage heatmap over the whole receiving court: green where a passer can get there in time, red where no one can. It answers "can we handle a short serve to zone 2 in this rotation" with a real time-margin calculation, not a guess.
- **Attack/defense matchups.** Pick an attack zone (4/3/2 for OH/MB/RS, or 6 for a back-row pipe) and a set tempo, and see the hitter's approach lane, whether the assigned block can actually get there in time ("blocker cannot reach: needs 1.05s, has 0.45s"), the block shadow drawn live on the defending team's court with any defender caught standing in it flagged, and tip coverage for an assigned defender. Four defensive systems (perimeter, rotation, man-up, six-back) reposition the defending team on court and feed the same feasibility math.
- **Presentation mode.** One click hides every editing panel and enlarges the transport into big, touch-friendly controls for showing a play to a team at practice. It keeps the screen awake on a tablet while it's up, where the browser supports that, and Esc gets back out.
- **PNG rotation sheet export.** One click captures all six rotations of the focused team as one labeled image, ready to print or share. No server involved: it's the same canvas already on screen.

Players render as flat, orbit-camera-friendly humanoid silhouettes holding real volleyball stances (dig, block, attack, set, and more). The net has padded posts, a visible gap above the floor, and banded top and bottom edges. Rotate, pan, and zoom freely, or jump to one of five camera presets (top-down, sideline, behind the endline, two angled views). Every color reads from a swappable theme, so the whole look can change without touching a line of game logic.

## Status

All seven planned phases are done: scaffold, court/camera/silhouettes, the rotation engine, the play model and deterministic playback, a full authoring UI (timeline editor, step inspector, 3D drag-to-position, ball-path editing, undo/redo, save), serve-receive coverage analysis, attack/defense matchup analysis, and presentation/export polish. A guided authoring mode, an on-court bench, and a distinct libero color landed after that, aimed squarely at making the tool approachable on the first sit-down, not just powerful. The app is live on Vercel, deployed straight from `main`. See [Roadmap](#roadmap) below, and [HANDOFF.md](HANDOFF.md) for a working session's worth of context on where things stand, decisions made, and pitfalls already worked through.

## Tech stack

- [Vite](https://vitejs.dev/) + [React 19](https://react.dev/) + TypeScript (strict)
- [Three.js](https://threejs.org/) for the 3D scene, driven imperatively (not react-three-fiber), so the frame loop stays independent of React's render cycle
- [Zustand](https://github.com/pmndrs/zustand) for UI state: one store per concern (lineup/roster, playback, the play being authored, serve-receive config, matchup config)
- [Vitest](https://vitest.dev/) for the domain layer, which runs headless in Node. The volleyball rules (rotation math, overlap validation, ball flight, deterministic playback) have zero dependency on a browser or a renderer. The test suite proves it: if any of them could even import `three`, the run fails.

The codebase draws a hard line between `src/core` (pure volleyball domain logic, with no rendering imports at all) and `src/render` (the Three.js scene, which reads a swappable `Theme` object). An ESLint rule enforces that boundary, not just convention, which is what makes the visual style fully replaceable without touching any game logic.

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
- [x] **Phase 3.** Play model and deterministic playback: ball flight, compile/evaluate, diagnostics, pose-blended animation, 3 demo plays.
- [x] **Phase 4.** Play authoring UI (timeline editor, step inspector, 3D drag-to-position, ball-path editing, undo/redo, save). A full play library view is still open: today's picker is a dropdown, not a browse/manage panel.
- [x] **Phase 5.** Serve-receive planner: weighted responsibility zones, seam detection, and the uncovered-area time-margin heatmap. No serve type/target picker yet; the analysis covers the whole grid for a given serve origin rather than one aimed serve.
- [x] **Phase 6.** Attack/defense matchups: approach lanes by role, block feasibility diagnostics, block shadow with defender-in-shadow flagging, tip coverage, and four defensive base formations. Open-angle (line/angle/seam) cone checks are implemented and tested in `core/tactics/block.ts` but not yet wired into a live overlay.
- [x] **Phase 7.** Polish and deploy: presentation mode (panels hidden, large touch-first transport, screen wake lock) and a one-click PNG rotation-sheet export. Deployed to Vercel from `main`.
- [x] **Post-v1.** Simple mode by default for author view (the timeline/step-inspector sidebar moves behind an "Advanced" toggle), a distinct libero color, an on-court bench for dragging players on and off the field, and a guided click-through workflow for building a play without touching a coordinate field. A rough edge worth knowing about: the guided workflow's set-target chooser overloads one internal field to carry both the chosen hitter and tempo rather than using two dedicated fields; it works, but a fresh implementation would split it. See [HANDOFF.md](HANDOFF.md) for the rest.

## License

MIT. See [LICENSE](LICENSE).
