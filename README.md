# Volleyball Strategy Simulator

[![Live demo](https://img.shields.io/badge/demo-live-3ecf5c?style=flat-square)](https://volleyball-simulator.vercel.app)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Built with Vite](https://img.shields.io/badge/build-vite-646cff?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![React 19](https://img.shields.io/badge/react-19-149eca?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![Three.js](https://img.shields.io/badge/three.js-black?style=flat-square&logo=three.js&logoColor=white)](https://threejs.org)
[![TypeScript](https://img.shields.io/badge/typescript-strict-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)

A 3D volleyball strategy tool for coaches, not a game. Build a roster and lineup, step through the six rotations with live overlap-legality checking, author a play by dragging players around a real court, and watch it animate with real ball physics from any camera angle.

**[Try it live](https://volleyball-simulator.vercel.app)**. No install needed.

![Volleyball Strategy Simulator, court view](docs/screenshot.png)

## What it does today

- **Rotation engine.** Build a real 5-1, 6-2, or 4-2 roster, edit the lineup by drag-and-drop, and step through all six rotations with overlap-rule validation. An illegal alignment draws a 3D connector between the offending pair and shows a margin for every pair, not just violations, plus a one-click fix and a camera focus on the problem. The libero gets its own color so it's never confused with a starter. An on-court bench lets you drag a player onto the field or back off it directly in 3D. Turn on "Move players" and drop a player anywhere on the court, not just on one of six fixed spots, with a Reset positions button to snap everyone back; a moved player keeps that position when you switch into Design Play.
- **Guided play authoring.** Click a player, pick what they do (serve, pass, set, attack, tip, block, dig, or reposition), then place where the ball goes on a to-scale top-down court map or in the 3D view, and drag a side-view marker to set how high it arcs. A serve starts from behind the endline. Every other contact walks the player to wherever the previous step's ball actually lands. Edit any step in the list, not just the last one, and everything after it re-resolves against the change. It's the same play data the advanced editor uses, so you can flip to Advanced at any point and fine-tune the same play by hand.
- **Play authoring (advanced).** Script a sequence of steps, then type exact coordinates or grab a player (or the ball) in the 3D view and drop it where you want, with a ghost marker showing the start point and Alt held to snap to the nearest zone. Undo, redo, save to your browser, and catch a move no human could make or a ball that would clip the net before you even hit play. A play library panel lists every saved play with its step count and duration.
- **Deterministic playback.** Real closed-form ball arcs, pose-blended player movement, a short fading trail behind the ball in flight, scrub/play/loop/speed controls. The same play looks identical every time.
- **Serve-receive planning.** Pick your passers, a serve origin, and watch a live coverage heatmap over the receiving court: green where a passer can get there in time, red where no one can. Five formation presets set up a starting look in one click, and you can place an exact serve target on the court map to get a straight answer for that one aimed serve.
- **Attack/defense matchups.** Pick an attack zone, a set tempo, and optionally a specific roster player to hit it. See the hitter's approach lane, whether the block can actually get there in time, the block shadow on the defending team's court with any exposed defender flagged, open-angle cones showing which side is uncovered, and tip coverage for an assigned defender. Four defensive systems reposition the defending team, and a manual override always wins over the system's default.
- **Presentation mode.** One click hides every editing panel and enlarges the transport for showing a play to a team at practice, keeps the screen awake on a tablet, and Esc gets you back out.
- **PNG rotation sheet export.** One click captures all six rotations as one labeled image, from whichever camera angle you pick, ready to print or share.

Players render as flat, orbit-camera-friendly humanoid silhouettes holding real volleyball stances. The net has padded posts, a visible gap above the floor, and banded top and bottom edges. Rotate, pan, and zoom freely, or jump to one of five camera presets. Every color reads from a swappable theme, so the whole look can change without touching a line of game logic.

## Status

All seven planned phases are done, plus several rounds of usability work and a full backlog-closure pass driven by live coaching use. See [Roadmap](#roadmap) below for the checklist, and [HANDOFF.md](HANDOFF.md) for the full session-by-session history: decisions made, bugs found and fixed, and pitfalls already worked through. The app is live on Vercel, deployed straight from `main`.

## Tech stack

- [Vite](https://vitejs.dev/) + [React 19](https://react.dev/) + TypeScript (strict)
- [Three.js](https://threejs.org/) for the 3D scene, driven imperatively (not react-three-fiber), so the frame loop stays independent of React's render cycle
- [Zustand](https://github.com/pmndrs/zustand) for UI state: one store per concern (lineup/roster, playback, the play being authored, serve-receive config, matchup config)
- [Vitest](https://vitest.dev/) for the domain layer, which runs headless in Node. The volleyball rules (rotation math, overlap validation, ball flight, deterministic playback) have zero dependency on a browser or a renderer. If any of them even imported `three`, the test suite would fail the run.

The codebase draws a hard line between `src/core` (pure volleyball domain logic, no rendering imports) and `src/render` (the Three.js scene, which reads a swappable `Theme` object). An ESLint rule enforces that boundary, which is what makes the visual style fully replaceable without touching any game logic.

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
- [x] **Phase 2.** Rotation engine: roster, lineups, 5-1/6-2/4-2 systems, overlap validation.
- [x] **Phase 3.** Play model and deterministic playback: ball flight, compile/evaluate, diagnostics, pose-blended animation, demo plays.
- [x] **Phase 4.** Play authoring UI: timeline editor, step inspector, 3D drag-to-position, ball-path editing, undo/redo, save, and a play library panel.
- [x] **Phase 5.** Serve-receive planner: weighted responsibility zones, seam detection, the uncovered-area heatmap, five formation presets, and click-to-aim single-serve reads.
- [x] **Phase 6.** Attack/defense matchups: approach lanes, block feasibility, block shadow with defender flagging, open-angle cones, tip coverage, player-based hitter contact height, and four defensive base formations.
- [x] **Phase 7.** Polish and deploy: presentation mode, PNG rotation-sheet export, live on Vercel.
- [x] **Post-v1.** Simple mode by default, a distinct libero color, an on-court bench, and a guided click-through workflow for building a play without touching a coordinate field.
- [x] **Guided authoring polish, several rounds.** Editable step list, a to-scale top-down target picker, players who walk to meet the ball instead of standing still, concurrent player movement, uniform-speed ball flight, roster add/remove, and a raft of real bugs found and fixed along the way.
- [x] **Backlog closure.** Every item the project had documented as unfinished, closed out in eight tested stages: position-override consistency everywhere, one-click alignment fixes, a play library, `Movement.facing`, a ball trail, deduplicated and click-to-aim serve-receive, block-scheme realism, open-angle cones, 3D ball dragging, a sitting bench pose, and versioned save-file persistence.
- [x] **Live-feedback fixes.** Free-form drag-to-position on the court (not locked to six anchors), a Reset positions button, a fix for the bench "Add" flow always asking for a replacement even with an open slot, and shorter player labels throughout the UI.
- [x] **Move players toggle and a formation snap-back fix.** A player moved in Formation mode now keeps that position when you switch to Design Play, instead of reverting to the default anchor. Dragging itself is now gated behind an explicit "Move players" button in both Formation and Design Play, so an ordinary click can't move someone by accident.

See [HANDOFF.md](HANDOFF.md) for the full story behind every line above.

## License

MIT. See [LICENSE](LICENSE).
