import { useEffect, useRef } from 'react';
import { useAppStore } from '@/app/store/useAppStore';
import { useLineupStore } from '@/app/store/useLineupStore';
import { usePlaybackStore } from '@/app/store/usePlaybackStore';
import { usePlayEditorStore } from '@/app/store/usePlayEditorStore';
import type { Play } from '@/core/play/types';
import { deriveRotationState, effectivePosition } from '@/app/deriveRotationState';
import { SceneRenderer } from '@/render/SceneRenderer';
import { SceneBridge, type PlayerPlacement } from '@/render/SceneBridge';
import type { ViolationLink } from '@/render/overlays/ViolationOverlay';
import { capsuleHumanoidFactory } from '@/render/players/CapsuleHumanoid';
import { THEME_PRESETS } from '@/render/theme/presets';
import type { Theme } from '@/render/theme/Theme';
import { toLocal, toWorld, type LocalPos, type Side } from '@/core/court/coordinates';
import { PlayerDragController } from '@/render/PlayerDragController';
import type { ZoneNumber } from '@/core/court/zones';
import type { PoseId } from '@/core/play/poses';
import type { Lineup } from '@/core/lineup/types';
import type { Roster } from '@/core/roster/types';
import { compilePlay } from '@/core/play/compile';
import { evaluateInto } from '@/core/play/evaluate';
import { createWorldState, type PlaySchedule, type WorldState } from '@/core/play/schedule';
import { diagnosePlay } from '@/core/play/diagnostics';
import { DEMO_PLAYS } from '@/fixtures/demoPlays';

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
        teamColor: isViolating ? theme.overlays.violation : theme.teams[side].body,
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

export function SceneCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<SceneRenderer | null>(null);
  const bridgeRef = useRef<SceneBridge | null>(null);
  const dragControllerRef = useRef<PlayerDragController | null>(null);
  const scheduleRef = useRef<PlaySchedule | null>(null);
  const worldStateRef = useRef<WorldState>(createWorldState());
  const tRef = useRef(0);
  const frameCountRef = useRef(0);

  const themeId = useAppStore((s) => s.themeId);
  const cameraPreset = useAppStore((s) => s.cameraPreset);
  const cameraRequestToken = useAppStore((s) => s.cameraRequestToken);
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
      const placements: PlayerPlacement[] = world.players.map((p) => ({
        id: p.onCourtId,
        side: p.side,
        pos: toWorld(p.pos, p.side, p.y),
        teamColor: activeTheme.teams[p.side].body,
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

    return () => {
      dragController.dispose();
      bridge.dispose();
      renderer.dispose();
      rendererRef.current = null;
      bridgeRef.current = null;
      dragControllerRef.current = null;
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

  useEffect(() => {
    const bridge = bridgeRef.current;
    const renderer = rendererRef.current;
    if (!bridge || !renderer) return;
    const theme = THEME_PRESETS[themeId];
    bridge.setTheme(theme);
    renderer.setBackground(theme.background);

    if (playbackMode === 'play' || playbackMode === 'author') {
      // The per-frame playback loop owns formation/ball while a play is active.
      return;
    }

    tRef.current = 0;
    bridge.setBallState({ x: 0, y: 0, z: 0 }, false);
    const scene = buildSceneState(theme, lineups, rosters, rotations, positionOverrides, previewPlayerId, previewPose);
    bridge.setFormation(scene.placements);
    bridge.setViolationLinks(scene.violationLinks);
  }, [themeId, lineups, rosters, rotations, positionOverrides, previewPlayerId, previewPose, playbackMode]);

  useEffect(() => {
    if (cameraRequestToken === 0) return; // skip the initial mount
    rendererRef.current?.cameraRig.goToPreset(cameraPreset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraRequestToken]);

  return <div ref={containerRef} className="scene-canvas" />;
}
