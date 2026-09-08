import { useEffect, useRef } from 'react';
import { useAppStore } from '@/app/store/useAppStore';
import { useLineupStore } from '@/app/store/useLineupStore';
import { usePlaybackStore } from '@/app/store/usePlaybackStore';
import { usePlayEditorStore } from '@/app/store/usePlayEditorStore';
import { useServeReceiveStore } from '@/app/store/useServeReceiveStore';
import { useMatchupStore } from '@/app/store/useMatchupStore';
import { deriveMatchupState } from '@/app/deriveMatchupState';
import { defensiveBase } from '@/core/tactics/defense.presets';
import type { Play } from '@/core/play/types';
import { deriveRotationState, effectivePosition } from '@/app/deriveRotationState';
import { benchSlotPosition, benchDepthForOverrides, nearestZone } from '@/core/court/anchors';
import { SceneRenderer } from '@/render/SceneRenderer';
import { SceneBridge, type PlayerPlacement } from '@/render/SceneBridge';
import type { ViolationLink } from '@/render/overlays/ViolationOverlay';
import { capsuleHumanoidFactory } from '@/render/players/CapsuleHumanoid';
import { THEME_PRESETS } from '@/render/theme/presets';
import type { Theme } from '@/render/theme/Theme';
import { otherSide, toLocal, toWorld, type LocalPos, type Side } from '@/core/court/coordinates';
import { PlayerDragController } from '@/render/PlayerDragController';
import { BenchDragController } from '@/render/BenchDragController';
import { playerSlotInZone } from '@/core/lineup/rotation';
import { GuidedPlayController } from '@/render/GuidedPlayController';
import { useGuidedAuthorStore } from '@/app/store/useGuidedAuthorStore';
import type { ZoneNumber } from '@/core/court/zones';
import type { PoseId } from '@/core/play/poses';
import type { Lineup } from '@/core/lineup/types';
import type { Roster } from '@/core/roster/types';
import { breakdown } from '@/core/lineup/systems';
import { compilePlay } from '@/core/play/compile';
import { evaluateInto } from '@/core/play/evaluate';
import { createWorldState, type PlaySchedule, type WorldState } from '@/core/play/schedule';
import { diagnosePlay } from '@/core/play/diagnostics';
import { analyzeServeReceive, type Passer } from '@/core/tactics/serveReceive';
import { DEMO_PLAYS } from '@/fixtures/demoPlays';
import { commitPositionAction } from '@/app/guidedAuthoring';

const SERVE_RECEIVE_CELL_SIZE_M = 0.4;
const SERVE_CONTACT_HEIGHT_M = 2.2;

const SIDES: Side[] = ['A', 'B'];

function poseForOnCourt(isServer: boolean, isSetter: boolean): PoseId {
  if (isServer) return 'serveToss';
  if (isSetter) return 'set';
  return 'ready';
}

interface SceneState {
  placements: PlayerPlacement[];
  violationLinks: ViolationLink[];
}

/**
 * Builds the 3D formation from each side's real Lineup/Roster/rotation
 * state: positions come from the ZONE_BASE anchors (or a manual formation
 * override from FormationPanel) for whichever zone a player's rotation puts
 * them in, poses reflect server/setter, and any player in an overlap error
 * is recolored with the theme's violation color and linked with a connector
 * so R1-R6 legality is visible directly on the court, not just in the panel.
 */
function buildSceneState(
  theme: Theme,
  lineups: Record<Side, Lineup>,
  rosters: Record<Side, Roster>,
  rotations: Record<Side, number>,
  positionOverrides: Record<Side, Partial<Record<ZoneNumber, LocalPos>>>,
  previewPlayerId: string,
  previewPose: PoseId,
): SceneState {
  const placements: PlayerPlacement[] = [];
  const violationLinks: ViolationLink[] = [];

  for (const side of SIDES) {
    const overrides = positionOverrides[side];
    const { breakdown, alignment } = deriveRotationState(lineups[side], rosters[side], side, rotations[side], overrides);

    const worldById = new Map<string, PlayerPlacement['pos']>();
    for (const p of breakdown.onCourt) {
      if (p.zone == null) continue;
      worldById.set(p.onCourtId, toWorld(effectivePosition(p.zone, overrides), side));
    }

    const violatingIds = new Set(alignment.violations.filter((v) => v.severity === 'error').flatMap((v) => v.players));

    for (const p of breakdown.onCourt) {
      if (p.zone == null) continue;
      const id = `${side}:${p.zone}`;
      const isViolating = violatingIds.has(p.onCourtId);
      placements.push({
        id,
        side,
        pos: worldById.get(p.onCourtId)!,
        teamColor: isViolating ? theme.overlays.violation : p.isLibero ? theme.liberoColor : theme.teams[side].body,
        pose: id === previewPlayerId ? previewPose : poseForOnCourt(p.isServer, p.onCourtId === breakdown.setterOnCourtId),
      });
    }

    for (const v of alignment.violations) {
      if (v.severity !== 'error') continue;
      const a = worldById.get(v.players[0]);
      const b = worldById.get(v.players[1]);
      if (a && b) violationLinks.push({ id: `${side}:${v.pair[0]}-${v.pair[1]}:${v.axis}`, a, b });
    }
  }

  return { placements, violationLinks };
}

/** Roster players not currently in the lineup's serve order, laid out along each team's own bench row. Mirrors BenchPanel's own "who's on the bench" rule (liberos excluded — they swap in automatically, they're never manually benched). The row's own depth pulls back to clear any manually-displaced formation (see benchDepthForOverrides). */
function buildBenchPlacements(
  rosters: Record<Side, Roster>,
  lineups: Record<Side, Lineup>,
  positionOverrides: Record<Side, Partial<Record<ZoneNumber, LocalPos>>>,
): PlayerPlacement[] {
  const placements: PlayerPlacement[] = [];
  for (const side of SIDES) {
    const onCourtIds = new Set(lineups[side].order.filter((id): id is string => id != null));
    const bench = rosters[side].players.filter((p) => p.primaryRole !== 'L' && !onCourtIds.has(p.id));
    const depthM = benchDepthForOverrides(positionOverrides[side]);
    bench.forEach((p, i) => {
      placements.push({
        id: `bench:${side}:${p.id}`,
        side,
        pos: toWorld(benchSlotPosition(i, bench.length, depthM), side),
        teamColor: '',
        pose: 'idle',
      });
    });
  }
  return placements;
}

export function SceneCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<SceneRenderer | null>(null);
  const bridgeRef = useRef<SceneBridge | null>(null);
  const dragControllerRef = useRef<PlayerDragController | null>(null);
  const benchDragControllerRef = useRef<BenchDragController | null>(null);
  const guidedPlayControllerRef = useRef<GuidedPlayController | null>(null);
  const scheduleRef = useRef<PlaySchedule | null>(null);
  const liberoOnCourtIdsRef = useRef<Set<string>>(new Set());
  const worldStateRef = useRef<WorldState>(createWorldState());
  const tRef = useRef(0);
  const frameCountRef = useRef(0);

  const themeId = useAppStore((s) => s.themeId);
  const cameraPreset = useAppStore((s) => s.cameraPreset);
  const cameraRequestToken = useAppStore((s) => s.cameraRequestToken);
  const focusCameraTarget = useAppStore((s) => s.focusCameraTarget);
  const focusCameraToken = useAppStore((s) => s.focusCameraToken);
  const previewPlayerId = useAppStore((s) => s.previewPlayerId);
  const previewPose = useAppStore((s) => s.previewPose);

  const lineups = useLineupStore((s) => s.lineups);
  const rosters = useLineupStore((s) => s.rosters);
  const rotations = useLineupStore((s) => s.rotations);
  const positionOverrides = useLineupStore((s) => s.positionOverrides);

  const playbackMode = usePlaybackStore((s) => s.mode);
  const selectedPlayId = usePlaybackStore((s) => s.selectedPlayId);
  const editorPlay = usePlayEditorStore((s) => s.play);
  const selectedStepId = usePlayEditorStore((s) => s.selectedStepId);
  const savedPlays = usePlayEditorStore((s) => s.savedPlays);

  const srReceivingSide = useServeReceiveStore((s) => s.receivingSide);
  const srPasserSlots = useServeReceiveStore((s) => s.passerSlots);
  const srPasserWeights = useServeReceiveStore((s) => s.passerWeights);
  const srServeOriginZone = useServeReceiveStore((s) => s.serveOriginZone);

  const matchupAttackingSide = useMatchupStore((s) => s.attackingSide);
  const matchupAttackZone = useMatchupStore((s) => s.attackZone);
  const matchupSetCall = useMatchupStore((s) => s.setCall);
  const matchupLateralSign = useMatchupStore((s) => s.lateralSign);
  const matchupBlockScheme = useMatchupStore((s) => s.blockScheme);
  const matchupDefensiveSystem = useMatchupStore((s) => s.defensiveSystem);
  const matchupTipDefenderSlot = useMatchupStore((s) => s.tipDefenderSlot);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const initial = useAppStore.getState();
    const initialLineups = useLineupStore.getState();
    const theme = THEME_PRESETS[initial.themeId];
    const renderer = new SceneRenderer(container, theme.background, initial.cameraPreset);
    const bridge = new SceneBridge(renderer.scene, theme, capsuleHumanoidFactory);
    const scene = buildSceneState(
      theme,
      initialLineups.lineups,
      initialLineups.rosters,
      initialLineups.rotations,
      initialLineups.positionOverrides,
      initial.previewPlayerId,
      initial.previewPose,
    );
    bridge.setFormation(scene.placements);
    bridge.setViolationLinks(scene.violationLinks);
    useAppStore.getState().setSceneCanvasEl(renderer.renderer.domElement);

    renderer.start((dtSeconds) => {
      const b = bridgeRef.current;
      if (!b) return;
      // Pose crossfades run every frame regardless of mode, so switching
      // rotations/themes in formation view is just as smooth as playback.
      b.update(dtSeconds);

      const playback = usePlaybackStore.getState();
      const schedule = scheduleRef.current;
      if ((playback.mode !== 'play' && playback.mode !== 'author') || !schedule) return;

      let t = tRef.current;
      if (playback.playing) {
        t += dtSeconds * playback.speed;
        if (t >= schedule.durationS) {
          if (playback.loop) t = schedule.durationS > 0 ? t % schedule.durationS : 0;
          else {
            t = schedule.durationS;
            // setT immediately (not just the throttled every-5th-frame sync
            // below) so the store's own t is reliably at the exact end the
            // moment playback stops — otherwise "hit Play to rewatch" (see
            // usePlaybackStore.toggle) can't reliably detect "already at the
            // end" and silently does nothing instead of restarting.
            usePlaybackStore.getState().setT(t);
            usePlaybackStore.getState().pause();
          }
        }
      } else {
        t = playback.t;
      }
      tRef.current = t;

      const world = worldStateRef.current;
      evaluateInto(schedule, t, world);

      const activeTheme = THEME_PRESETS[useAppStore.getState().themeId];
      const guidedActive = playback.mode === 'author' && !useAppStore.getState().authorAdvancedMode;
      const guidedSelectedId = guidedActive ? useGuidedAuthorStore.getState().selectedOnCourtId : null;
      const placements: PlayerPlacement[] = world.players.map((p) => ({
        id: p.onCourtId,
        side: p.side,
        pos: toWorld(p.pos, p.side, p.y),
        teamColor:
          guidedSelectedId === p.onCourtId
            ? activeTheme.guidedSelectedColor
            : liberoOnCourtIdsRef.current.has(p.onCourtId)
              ? activeTheme.liberoColor
              : activeTheme.teams[p.side].body,
        pose: p.pose,
        facingRad: p.facingRad,
      }));
      b.setFormation(placements);
      b.setViolationLinks([]);
      b.setBallState(world.ball.worldPos, world.ball.visible);

      frameCountRef.current++;
      if (playback.playing && frameCountRef.current % 5 === 0) {
        usePlaybackStore.getState().setT(t);
      }
    });

    rendererRef.current = renderer;
    bridgeRef.current = bridge;
    if (import.meta.env.DEV) {
      (window as unknown as { __sceneBridge: SceneBridge }).__sceneBridge = bridge;
      (window as unknown as { __sceneRenderer: SceneRenderer }).__sceneRenderer = renderer;
    }

    const dragController = new PlayerDragController({
      domElement: renderer.renderer.domElement,
      camera: renderer.cameraRig.camera,
      getDraggables: () => bridge.getPlayerRoots(),
      isEnabled: () => {
        const playback = usePlaybackStore.getState();
        return playback.mode === 'author' && !playback.playing && usePlayEditorStore.getState().selectedStepId != null;
      },
      setOrbitEnabled: (enabled) => {
        renderer.cameraRig.controls.enabled = enabled;
      },
      onDragMove: (id, worldPos) => {
        bridge.setPlayerPosition(id, { x: worldPos.x, y: 0, z: worldPos.z });
      },
      onDragEnd: (id, worldPos) => {
        const [side, slotStr] = id.split(':') as [Side, string];
        const slot = Number(slotStr);
        const stepId = usePlayEditorStore.getState().selectedStepId;
        if (!stepId || Number.isNaN(slot)) return;
        const pos = toLocal({ x: worldPos.x, y: 0, z: worldPos.z }, side);
        usePlayEditorStore.getState().moveOrAddMovement(stepId, side, slot, pos);
      },
    });
    dragControllerRef.current = dragController;

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

    const guidedPlayController = new GuidedPlayController({
      domElement: renderer.renderer.domElement,
      camera: renderer.cameraRig.camera,
      getClickables: () => bridge.getPlayerRoots(),
      isEnabled: () => {
        const playback = usePlaybackStore.getState();
        return playback.mode === 'author' && !useAppStore.getState().authorAdvancedMode;
      },
      setOrbitEnabled: (enabled) => {
        renderer.cameraRig.controls.enabled = enabled;
      },
      onDragMove: (id, worldPos) => {
        bridge.setPlayerPosition(id, { x: worldPos.x, y: 0, z: worldPos.z });
      },
      onDragEnd: (id, worldPos) => {
        const [side] = id.split(':') as [Side, string];
        const guided = useGuidedAuthorStore.getState();
        // Dragging the player currently mid-flow (selected, maybe with a
        // pending action) supersedes that flow rather than running alongside
        // it — a direct drag is an unambiguous "put them here," so whatever
        // click-based action was half-chosen for them is dropped.
        if (guided.selectedOnCourtId === id) guided.reset();
        const local = toLocal({ x: worldPos.x, y: 0, z: worldPos.z }, side);
        usePlayEditorStore.getState().applyGuidedAction((p) => commitPositionAction(p, { action: 'move', onCourtId: id, side, target: local }));
      },
      onSelectPlayer: (id) => {
        const guided = useGuidedAuthorStore.getState();
        // Clicking the already-selected player again deselects them, but only
        // before an action's been chosen — once a target/height picker is up,
        // a re-click should behave like any other player click (reselect),
        // not silently discard whatever's in progress.
        if (guided.selectedOnCourtId === id && !guided.pendingAction) {
          guided.reset();
          return;
        }
        guided.selectPlayer(id);
      },
      onSelectFloor: (worldPos) => {
        const guided = useGuidedAuthorStore.getState();
        if (!guided.selectedOnCourtId) {
          // Nothing selected yet — a click near an empty zone is otherwise a
          // silent no-op, so surface which zone (if any) it landed near and
          // whether anyone's actually standing there.
          const side: Side = worldPos.z >= 0 ? 'A' : 'B';
          const local = toLocal({ x: worldPos.x, y: 0, z: worldPos.z }, side);
          const zone = nearestZone(local);
          const lineupState = useLineupStore.getState();
          const b = breakdown(lineupState.lineups[side], lineupState.rosters[side], side, lineupState.rotations[side]);
          const occupied = b.onCourt.some((p) => p.zone === zone);
          guided.setEmptySlotHint(occupied ? null : zone);
          return;
        }
        if (!guided.pendingAction) {
          // A player's selected but no action chosen yet — clicking open
          // floor is unambiguous (there's nothing else it could mean here),
          // so treat it as "click elsewhere to deselect."
          guided.reset();
          return;
        }
        const floorSide = guided.selectedOnCourtId.split(':')[0] as Side;
        const local = toLocal({ x: worldPos.x, y: 0, z: worldPos.z }, floorSide);
        guided.setPendingTarget({ lat: local.lat, depth: local.depth });
      },
    });
    guidedPlayControllerRef.current = guidedPlayController;

    return () => {
      dragController.dispose();
      benchDragController.dispose();
      guidedPlayController.dispose();
      bridge.dispose();
      renderer.dispose();
      rendererRef.current = null;
      bridgeRef.current = null;
      dragControllerRef.current = null;
      useAppStore.getState().setSceneCanvasEl(null);
    };
  }, []);

  // Recompile whenever the underlying roster/lineup data changes, so a
  // preview always reflects the current 5-1 (or whatever's been edited),
  // and — in author mode — whenever the play being edited changes at all.
  useEffect(() => {
    let play: Play | null;
    if (playbackMode === 'author') {
      play = editorPlay;
    } else {
      play = DEMO_PLAYS.find((p) => p.id === selectedPlayId) ?? savedPlays[selectedPlayId] ?? DEMO_PLAYS[0];
    }
    if (!play) {
      scheduleRef.current = null;
      return;
    }
    const schedule = compilePlay(play, { rosters, lineups });
    scheduleRef.current = schedule;
    usePlaybackStore.getState().setDuration(schedule.durationS);
    usePlaybackStore.getState().setDiagnostics(diagnosePlay(schedule));

    const liberoIds = new Set<string>();
    for (const side of SIDES) {
      const b = breakdown(lineups[side], rosters[side], side, play.scenario.rotations[side]);
      for (const p of b.onCourt) if (p.isLibero) liberoIds.add(p.onCourtId);
    }
    liberoOnCourtIdsRef.current = liberoIds;

    if (playbackMode !== 'author') tRef.current = 0;
  }, [lineups, rosters, selectedPlayId, playbackMode, editorPlay, savedPlays]);

  // In author mode, selecting a different step jumps the preview to that
  // step's start time and pauses, so editing a step always shows it fresh.
  useEffect(() => {
    if (playbackMode !== 'author' || !editorPlay || !selectedStepId) return;
    let acc = 0;
    for (const step of editorPlay.steps) {
      if (step.id === selectedStepId) break;
      acc += step.duration;
    }
    tRef.current = acc;
    usePlaybackStore.getState().pause();
    usePlaybackStore.getState().setT(acc);
  }, [selectedStepId, playbackMode, editorPlay]);

  // The serve-receive coverage heatmap — recomputed whenever the config or
  // underlying lineup data changes, cleared whenever we leave that mode.
  useEffect(() => {
    const bridge = bridgeRef.current;
    if (!bridge) return;

    if (playbackMode !== 'serve-receive' || srPasserSlots.length === 0) {
      bridge.setCoverageHeatmap([], srReceivingSide, SERVE_RECEIVE_CELL_SIZE_M);
      return;
    }

    const servingSide = otherSide(srReceivingSide);
    const b = breakdown(lineups[srReceivingSide], rosters[srReceivingSide], srReceivingSide, rotations[srReceivingSide]);
    const overrides = positionOverrides[srReceivingSide];

    const passers: Passer[] = srPasserSlots
      .map((slot) => {
        const p = b.onCourt.find((oc) => oc.slot === slot);
        if (!p || p.zone == null) return null;
        return { onCourtId: p.onCourtId, pos: effectivePosition(p.zone, overrides), weight: srPasserWeights[slot] ?? 1 };
      })
      .filter((p): p is Passer => p !== null);

    if (passers.length === 0) {
      bridge.setCoverageHeatmap([], srReceivingSide, SERVE_RECEIVE_CELL_SIZE_M);
      return;
    }

    const serveOriginWorld = toWorld(
      effectivePosition(srServeOriginZone, positionOverrides[servingSide]),
      servingSide,
      SERVE_CONTACT_HEIGHT_M,
    );
    const cells = analyzeServeReceive({
      side: srReceivingSide,
      passers,
      serveOriginWorld,
      cellSizeM: SERVE_RECEIVE_CELL_SIZE_M,
    });
    bridge.setCoverageHeatmap(cells, srReceivingSide, SERVE_RECEIVE_CELL_SIZE_M);
  }, [playbackMode, srReceivingSide, srPasserSlots, srPasserWeights, srServeOriginZone, lineups, rosters, rotations, positionOverrides]);

  // The matchup overlays (approach lane, block shadow, tip-coverage ring) —
  // recomputed whenever the scenario or underlying lineup data changes,
  // cleared whenever we leave that mode.
  useEffect(() => {
    const bridge = bridgeRef.current;
    if (!bridge) return;

    if (playbackMode !== 'matchup') {
      bridge.setApproachLane([]);
      bridge.setMatchupShadow([], null);
      return;
    }

    const matchup = deriveMatchupState({
      attackingSide: matchupAttackingSide,
      attackZone: matchupAttackZone,
      setCall: matchupSetCall,
      lateralSign: matchupLateralSign,
      blockScheme: matchupBlockScheme,
      defensiveSystem: matchupDefensiveSystem,
      tipDefenderSlot: matchupTipDefenderSlot,
      rosters,
      lineups,
      rotations,
      positionOverrides,
    });

    bridge.setApproachLane([
      toWorld(matchup.approachLane.approachStart, matchupAttackingSide, 0),
      toWorld(matchup.approachLane.takeoff, matchupAttackingSide, 0),
      matchup.contactWorld,
    ]);
    bridge.setMatchupShadow(matchup.blockShadowPolygon, matchup.tipRegion);
  }, [
    playbackMode,
    matchupAttackingSide,
    matchupAttackZone,
    matchupSetCall,
    matchupLateralSign,
    matchupBlockScheme,
    matchupDefensiveSystem,
    matchupTipDefenderSlot,
    lineups,
    rosters,
    rotations,
    positionOverrides,
  ]);

  useEffect(() => {
    const bridge = bridgeRef.current;
    const renderer = rendererRef.current;
    if (!bridge || !renderer) return;
    const theme = THEME_PRESETS[themeId];
    bridge.setTheme(theme);
    renderer.setBackground(theme.background);

    if (playbackMode === 'play' || playbackMode === 'author') {
      // The per-frame playback loop owns formation/ball while a play is active.
      bridge.setBench([]);
      return;
    }

    tRef.current = 0;
    bridge.setBallState({ x: 0, y: 0, z: 0 }, false);

    // In matchup mode, the defending side's on-court spots reflect the
    // chosen defensive system's base positions instead of their plain
    // rotation anchors, so switching "Defense" is actually visible on
    // court — but a coach's own manual FormationPanel override for a given
    // zone still wins over the system's default for that zone, matching
    // deriveMatchupState's own merge order (the math and what's rendered
    // have to agree).
    let sceneOverrides = positionOverrides;
    if (playbackMode === 'matchup') {
      const defendingSide = otherSide(matchupAttackingSide);
      sceneOverrides = {
        ...positionOverrides,
        [defendingSide]: { ...defensiveBase(matchupDefensiveSystem, matchupAttackZone), ...positionOverrides[defendingSide] },
      };
    }

    const scene = buildSceneState(theme, lineups, rosters, rotations, sceneOverrides, previewPlayerId, previewPose);
    bridge.setFormation(scene.placements);
    bridge.setViolationLinks(scene.violationLinks);
    bridge.setBench(buildBenchPlacements(rosters, lineups, positionOverrides));
  }, [
    themeId,
    lineups,
    rosters,
    rotations,
    positionOverrides,
    previewPlayerId,
    previewPose,
    playbackMode,
    matchupAttackingSide,
    matchupDefensiveSystem,
    matchupAttackZone,
  ]);

  useEffect(() => {
    if (cameraRequestToken === 0) return; // skip the initial mount
    rendererRef.current?.cameraRig.goToPreset(cameraPreset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraRequestToken]);

  useEffect(() => {
    if (focusCameraToken === 0 || !focusCameraTarget) return; // skip the initial mount
    rendererRef.current?.cameraRig.focusOn(focusCameraTarget);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusCameraToken]);

  return <div ref={containerRef} className="scene-canvas" />;
}
