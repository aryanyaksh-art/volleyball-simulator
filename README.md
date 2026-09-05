# Volleyball Strategy Simulator

A 3D volleyball strategy tool for coaches, not a game. Build a lineup, step through the six rotations, script a play (serve → pass → set → attack), and watch it animate on a real court from any camera angle. Built to help plan actual game plans: "here's what we run in rotation 3 against a short serve."

![Volleyball Strategy Simulator, court view](docs/screenshot.png)

## What it does

- **Rotation engine.** All six rotations for 5-1 / 6-2 / 4-2 systems, with overlap-rule validation that flags illegal alignments before they cost a point.
- **Play authoring + animation.** Script a sequence of steps (serve, pass, set, attack) with real ball arcs and player movement, then scrub or play it back. Deterministic: the same play looks the same every time.
- **Serve-receive planning.** Passer responsibility zones, seam coverage, and warnings when an area is left open against a given serve.
- **Attack/defense matchups.** Approach lanes, block setup, diggers behind the block, and tip coverage.

Players render as flat, orbit-camera-friendly humanoid silhouettes holding real volleyball stances (dig, block, attack, set, and more) on a real net (padded posts, banded top and bottom edges) and court you can freely rotate, pan, and zoom, plus five one-click camera presets (top-down, sideline, behind the endline, and two angled views).

## Status

Phase 1 is done: court, net, free-orbit camera, and pose-able silhouettes, all reading from a swappable theme. The rotation engine (Phase 2) is next. See [Roadmap](#roadmap) below, and [HANDOFF.md](HANDOFF.md) for a working session's worth of context on where things stand, decisions made, and pitfalls already worked through.

## Tech stack

- [Vite](https://vitejs.dev/) + [React 19](https://react.dev/) + TypeScript (strict)
- [Three.js](https://threejs.org/) for the 3D scene, driven imperatively (not react-three-fiber) so the frame loop stays independent of React's render cycle
- [Zustand](https://github.com/pmndrs/zustand) for UI state
- [Vitest](https://vitest.dev/) for the domain layer, which runs headless in Node. The volleyball rules have zero dependency on a browser or a renderer.

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
- [ ] **Phase 2.** Rotation engine (roster, lineups, 5-1/6-2/4-2 systems, overlap validation).
- [ ] **Phase 3.** Play model and deterministic playback (this is where jump/serve/approach sequences actually animate, smoothly, between poses).
- [ ] **Phase 4.** Play authoring UI (timeline editor, direct 3D manipulation, play library).
- [ ] **Phase 5.** Serve-receive planner (responsibility zones, seam coverage, uncovered-area warnings).
- [ ] **Phase 6.** Attack/defense matchups (approach lanes, block feasibility, block shadow, tip coverage).
- [ ] **Phase 7.** Polish and deploy (presentation mode, PNG export, static hosting).

## License

MIT. See [LICENSE](LICENSE).
