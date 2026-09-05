import { useEffect, useRef } from 'react';
import { useAppStore } from '@/app/store/useAppStore';
import { SceneRenderer } from '@/render/SceneRenderer';
import { SceneBridge, type PlayerPlacement } from '@/render/SceneBridge';
import { capsuleHumanoidFactory } from '@/render/players/CapsuleHumanoid';
import { THEME_PRESETS } from '@/render/theme/presets';
import type { Theme } from '@/render/theme/Theme';
import { ZONE_BASE } from '@/core/court/anchors';
import { toWorld, type Side } from '@/core/court/coordinates';
import type { ZoneNumber } from '@/core/court/zones';
import type { PoseId } from '@/core/play/poses';

const ZONES: ZoneNumber[] = [1, 2, 3, 4, 5, 6];
const SIDES: Side[] = ['A', 'B'];

/**
 * Phase 1 placeholder: 12 players at their default zone anchors, all in a
 * relaxed ready stance except whichever one the pose-preview control has
 * selected. Replaced in Phase 2 by real lineup/rotation data.
 */
function buildDemoFormation(theme: Theme, previewPlayerId: string, previewPose: PoseId): PlayerPlacement[] {
  const placements: PlayerPlacement[] = [];
  for (const side of SIDES) {
    for (const zone of ZONES) {
      const id = `${side}:${zone}`;
      placements.push({
        id,
        side,
        pos: toWorld(ZONE_BASE[zone], side),
        teamColor: theme.teams[side].body,
        pose: id === previewPlayerId ? previewPose : 'ready',
      });
    }
  }
  return placements;
}

export function SceneCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<SceneRenderer | null>(null);
  const bridgeRef = useRef<SceneBridge | null>(null);

  const themeId = useAppStore((s) => s.themeId);
  const cameraPreset = useAppStore((s) => s.cameraPreset);
  const cameraRequestToken = useAppStore((s) => s.cameraRequestToken);
  const previewPlayerId = useAppStore((s) => s.previewPlayerId);
  const previewPose = useAppStore((s) => s.previewPose);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const initial = useAppStore.getState();
    const theme = THEME_PRESETS[initial.themeId];
    const renderer = new SceneRenderer(container, theme.background, initial.cameraPreset);
    const bridge = new SceneBridge(renderer.scene, theme, capsuleHumanoidFactory);
    bridge.setFormation(buildDemoFormation(theme, initial.previewPlayerId, initial.previewPose));
    renderer.start();

    rendererRef.current = renderer;
    bridgeRef.current = bridge;

    return () => {
      bridge.dispose();
      renderer.dispose();
      rendererRef.current = null;
      bridgeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const bridge = bridgeRef.current;
    const renderer = rendererRef.current;
    if (!bridge || !renderer) return;
    const theme = THEME_PRESETS[themeId];
    bridge.setTheme(theme);
    renderer.setBackground(theme.background);
    bridge.setFormation(buildDemoFormation(theme, previewPlayerId, previewPose));
    // Only re-run this rebuild when the theme itself changes — pose/player
    // preview changes are handled cheaply by the effect below instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeId]);

  useEffect(() => {
    bridgeRef.current?.setPose(previewPlayerId, previewPose);
  }, [previewPlayerId, previewPose]);

  useEffect(() => {
    if (cameraRequestToken === 0) return; // skip the initial mount
    rendererRef.current?.cameraRig.goToPreset(cameraPreset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraRequestToken]);

  return <div ref={containerRef} className="scene-canvas" />;
}
