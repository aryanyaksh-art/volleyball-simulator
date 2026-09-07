# Simple mode and guided play authoring

Status: approved by user, pending written-spec review.
Author: Claude (session with Aryan), 2026-09-07.

## Why

The play-authoring screen (TimelineEditor + StepInspector) is built for a coach who already thinks in lat/depth coordinates, apex meters, and step durations. That's the right tool for fine control, but it's the *only* tool today, and it's the first thing anyone sees the moment they try to author a play. This spec adds a second, much simpler front door to the same underlying play data: click a player, say what they do, click where the ball goes. The existing advanced UI stays exactly as it is, one toggle away, for whoever wants it.

Four pieces, ordered smallest/lowest-risk to largest:

1. An Advanced/Simple toggle for author mode, hiding the timeline/inspector by default.
2. A distinct libero color.
3. An on-court bench: drag a player onto the field or off it, in 3D, instead of through the lineup list.
4. A guided "Design Play" workflow: click a player, pick an action, click a target, review, play.

## Non-goals

- No changes to `core/play/compile.ts`, `evaluate.ts`, `ballFlight.ts`, or any domain logic that already has test coverage. Guided authoring produces a `Play` object through the same data model the advanced editor already writes; playback doesn't know or care which UI built it.
- The existing TimelineEditor/StepInspector are not being replaced or rewritten. They become the "Advanced" state of the same toggle.
- The Advanced toggle applies to **author mode only**. Formation mode's existing sidebar (Roster/Lineup/Rotation/Validation/Formation/Bench panels) is unchanged, except for the new on-court bench interaction, which is additive.
- No new `BallProfileId` or ball-physics concepts. The setter's target/tempo choices in guided mode map onto profiles and tempos that already exist (`SET_TEMPO_S`, `ZONE_TO_ROLE`).
- No mobile/touch-specific redesign beyond what already exists. Presentation mode (Phase 7) is untouched.

## Feature 1: Advanced / Simple toggle for author mode

- New state: `useAppStore.authorAdvancedMode: boolean`, default `false`.
- A small floating chip, top-right of the scene viewport, visible whenever `playbackMode === 'author'` (same positioning pattern as the existing presentation-mode exit button): `"⚙ Advanced"` when off, `"⚙ Advanced ✓"` or similar when on.
- When `authorAdvancedMode` is `false`: `App.tsx` does not render `AuthorSidebar` at all. `.scene-viewport` (already `flex: 1`) fills the row on its own, so the court recenters with no extra CSS beyond removing the sibling element. Bottom bars (`TransportBar`, theme/camera/pose-preview row) are unaffected either way.
- When `true`: current behavior, `AuthorSidebar` (TimelineEditor + StepInspector) renders exactly as it does today.
- When `authorAdvancedMode` is `false`, the guided panel (Feature 4) renders instead, but only as a small floating panel, not a full sidebar. See Feature 4.

## Feature 2: Libero color

- Add one new field to `Theme`: `liberoColor: string`. One value per theme, not per team; a libero is visually distinct from teammates on either side, matching how a real libero jersey works (a color that contrasts with your own team, not a color that matches the opposing libero).
- Applied wherever a `PlayerPlacement`'s `teamColor` is chosen:
  - Formation mode (`buildSceneState` in `SceneCanvas.tsx`): already has `breakdown.onCourt[].isLibero` per player; use it directly.
  - Play/author playback (`world.players` from `evaluateInto`): `onCourtId` is side+slot (e.g. `"B:2"`), and libero substitution is a lineup-level fact, not baked into the schedule. Compute `breakdown(lineups[side], rosters[side], side, play.scenario.rotations[side])` once per relevant side (note: the **play's own** `scenario.rotations`, not the live global rotation state, since a play can be scoped to a different rotation than what's currently selected in formation mode) and look up `isLibero` by slot for each rendered placement.
- Three theme presets (`blueprint`, `court`, `whiteboard`) each get a `liberoColor` chosen to read clearly against that theme's background and both team colors (e.g. a bright white/near-white for the dark themes, a strong contrasting dark tone for `whiteboard`).

## Feature 3: On-court bench

- Bench players render as smaller, dimmed silhouettes (reduced opacity, ~0.85x scale) standing in a row behind each team's own endline, past the free zone (roughly `depth ≈ 10.5–11.5m` in that team's local frame, spaced ~1m apart along `lat`), for every roster player currently *not* in one of the six lineup slots.
- Dragging a bench silhouette onto a court zone assigns that player to the lineup slot for that zone at the current rotation (`playerSlotInZone(rotation, zone)`, already in `core/lineup/rotation.ts`). If that zone is already occupied, the two players swap: the previous occupant becomes benched.
- Dragging an on-court player back onto their own bench row unassigns them (`setOrderSlot(side, slot, null)`).
- Implemented as a new controller alongside `PlayerDragController` (same raycast-to-floor-plane approach), enabled only in `formation` mode, so it doesn't conflict with the existing author-mode player-drag (which sets movement targets, a different action entirely).
- The existing `LineupPanel`/`BenchPanel` HTML list stays as-is. This is an additional way to do the same thing, not a replacement, since roster management (adding/renaming players) still needs a list view.

## Feature 4: Guided "Design Play" workflow

### Entry point

A new `"🏐 Design play"` button in formation mode's bottom bar, alongside the existing `"Preview demo play"` / `"New play"` / `"Serve-receive"` / `"Matchups"` buttons. Clicking it creates a new blank play seeded with the current on-court formation on both sides as the initial positions, enters author mode, and leaves `authorAdvancedMode` at its default (`false`), so the guided panel is what appears.

### The guided panel

A small floating panel (not a full sidebar), positioned so it doesn't block the court. Two states:

- **Nothing selected:** a one-line prompt ("Click a player to choose their action"), plus "Review play" and "Save & Play" buttons.
- **A player is selected** (clicked in the 3D view): a short list of actions: Serve, Pass/Receive, Set, Attack, Tip, Block, Dig, Move only (no ball). All eight are always available (real plays include drills and non-standard sequences), but the list is ordered with the contextually likely ones first, based on simple heuristics: first step and the player is in the server's zone → Serve first; the ball's previous contact was on this player's team → Pass/Set/Attack near the top for their teammates.

### Placing a target

Actions that need a location (Serve, Pass, Attack, Tip; Set is a special case, below) work in two steps:

1. Click a spot on the court. This sets the target's lat/depth. Clicks near an existing zone anchor or another player snap to it for a clean result; clicks on open floor place exactly there (same snap distance and behavior `PlayerDragController` already uses for its 0.1m grid snap).
2. A small side-view widget appears: a simple 2D diagram (floor line, net line if relevant, a marker for the arc's peak height) with a draggable handle and a meters readout. It opens pre-filled with a sensible default apex for that action type (e.g. a float serve defaults near 3.2m, an attack near 3.0m with a near-contact peak, a tip lower and flatter), so most of the time a coach only glances at it and confirms; dragging is for the times the default doesn't look right. This adjusts the ball segment's `apexM` only; the endpoint height itself (e.g. a pass arriving at platform height, an attack landing on the floor) uses per-action defaults and isn't separately exposed here (it's still editable in Advanced mode via `StepInspector`, unchanged).

Confirming builds a new `PlayStep` with a `BallSegment` (kind, profile, from/to, apexM, duration, all defaulted per action type from a small lookup table seeded with the same numbers the existing demo plays already use) and a `Movement` for the acting player toward the contact point (mode and pose inferred per action type: e.g. `approach`/`attack` for a hit, `shuffle`/`passLow` for a dig).

### Setter's set

Choosing "Set" for the setter shows two small choices instead of a single target click:

- **Target:** Outside / Middle / Opposite / Pipe. Maps to an attack zone (4/3/2/6) via a new reverse lookup of the existing `ZONE_TO_ROLE` table (`core/tactics/attack.ts`), which in turn resolves to a contact point via the existing `ATTACK_CONTACT_BY_ZONE`.
- **Tempo:** Quick / 31 / Shoot / Go / High / Pipe / Bic, the existing `SET_TEMPO_S` names, used here as the ball segment's `profile` and to help pick the step's `duration`.

No court click needed for a set; the target is fully determined by the two choices. The side-view height widget still appears, pre-filled per the chosen tempo (a quick set arcs lower than a high ball).

### Open step vs. new step

A step stays "open" after a ball-contact action is added to it. Clicking another player and choosing "Move only" adds a `Movement` to that same open step (for teammates repositioning during the same beat, e.g. the setter releasing while the pass is still in the air). Choosing a new ball-contact action closes the current step and starts the next one. This maps directly onto the existing `PlayStep` shape (one ball segment, several movements) with no changes to it.

### Review and play

"Review play" renders the play's steps as a plain-language list (e.g. "1. Setter serves a float serve to zone 5.", "2. Outside 2 passes to the setter.", "3. Setter sets a 31 tempo to the outside hitter.", "4. Outside 1 attacks to zone 5.") generated from each step's ball segment and resolved player/zone names, each with Edit (reopen that step) and Delete. "Save & Play" hands off to the existing transport bar and playback pipeline unchanged.

Switching Advanced on at any point shows the exact same play in the existing TimelineEditor/StepInspector for full manual control, since both UIs read and write the same `usePlayEditorStore` play object.

## New modules (planning-level, not final file names)

**Core** (pure, tested, no render/UI imports, per the existing `src/core` boundary):
- `core/tactics/attack.ts`: add `ROLE_TO_ZONE`, the reverse of the existing `ZONE_TO_ROLE`.
- `core/play/guidedDefaults.ts`: per-action-type defaults (duration, apexM, apexU, movement mode, pose), seeded from the numbers already used in `fixtures/demoPlay.ts` / `demoPlays.ts`. Pure data plus small pure functions, unit-testable the same way `SET_TEMPO_S` and `SPEED_CAP_MPS` are today.

**App layer:**
- `app/store/useAppStore.ts`: add `authorAdvancedMode` + toggle.
- `app/store/useGuidedAuthorStore.ts`: guided-mode UI state (selected player, pending action, pending target, which step is open).
- `app/guidedAuthoring.ts`: turns a completed guided choice into a `PlayStep`/`Movement`/`BallSegment` appended via `usePlayEditorStore`, plus `describeStep()` for the Review list's plain-language sentences.

**Render layer:**
- `render/GuidedPlayController.ts`: click-to-select a player, click-to-place a floor target (mirrors `PlayerDragController`'s raycast approach).
- `render/BenchController.ts` (or extend `PlayerDragController`): drag on/off the bench, formation mode only.
- `SceneBridge`: a `setBench(placements)` method alongside the existing `setFormation`.

**UI layer:**
- `ui/panels/GuidedAuthorPanel.tsx`: the floating action-menu/review panel.
- `ui/SideHeightPicker.tsx`: the 2D side-view apex-height widget.
- `App.tsx` / `App.css`: conditionally render `AuthorSidebar`, add the Advanced toggle chip.
- `TransportBar.tsx`: add the "Design play" button to formation mode's row.

## Rollout and verification

Build and commit in the order listed at the top (toggle/recenter, libero color, bench, guided workflow), each as its own commit, pushed to `main` so Vercel redeploys after each. New core additions get Vitest coverage matching the project's existing convention (table-driven where relevant, e.g. `ROLE_TO_ZONE` round-tripping with `ZONE_TO_ROLE`). UI and render changes get verified live in the browser the same way every prior phase in this project has been: `npm run dev`, exercise the feature, screenshot, check the console is clean. `npm test`, `tsc -b --noEmit`, and `npm run lint` must stay clean throughout, same bar as every phase so far.

Once all four pieces are in, do a pass on the GitHub repo presentation (README/description/topics) to reflect the new features, matching how Phases 6 and 7 were wrapped up.
