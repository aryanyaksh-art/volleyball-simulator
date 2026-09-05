import { useAppStore } from '@/app/store/useAppStore';
import { THEME_PRESETS } from '@/render/theme/presets';
import { CAMERA_PRESETS, CAMERA_PRESET_IDS } from '@/render/cameraPresets';
import { ALL_POSES, type PoseId } from '@/core/play/poses';

const SIDES = ['A', 'B'] as const;
const ZONES = [1, 2, 3, 4, 5, 6] as const;

export function ControlBar() {
  const themeId = useAppStore((s) => s.themeId);
  const setThemeId = useAppStore((s) => s.setThemeId);
  const goToCameraPreset = useAppStore((s) => s.goToCameraPreset);
  const previewPlayerId = useAppStore((s) => s.previewPlayerId);
  const setPreviewPlayerId = useAppStore((s) => s.setPreviewPlayerId);
  const previewPose = useAppStore((s) => s.previewPose);
  const setPreviewPose = useAppStore((s) => s.setPreviewPose);

  return (
    <div className="control-bar">
      <div className="control-group">
        <span className="control-label">Theme</span>
        {Object.values(THEME_PRESETS).map((theme) => (
          <button
            key={theme.id}
            className={theme.id === themeId ? 'chip chip-active' : 'chip'}
            onClick={() => setThemeId(theme.id)}
          >
            {theme.label}
          </button>
        ))}
      </div>

      <div className="control-group">
        <span className="control-label">Camera</span>
        {CAMERA_PRESET_IDS.map((id, i) => (
          <button key={id} className="chip" onClick={() => goToCameraPreset(id)} title={CAMERA_PRESETS[id].label}>
            {i + 1}. {CAMERA_PRESETS[id].label}
          </button>
        ))}
      </div>

      <div className="control-group">
        <span className="control-label">Pose preview</span>
        <select value={previewPlayerId} onChange={(e) => setPreviewPlayerId(e.target.value)}>
          {SIDES.map((side) =>
            ZONES.map((zone) => {
              const id = `${side}:${zone}`;
              return (
                <option key={id} value={id}>
                  {side}, zone {zone}
                </option>
              );
            }),
          )}
        </select>
        <select value={previewPose} onChange={(e) => setPreviewPose(e.target.value as PoseId)}>
          {ALL_POSES.map((pose) => (
            <option key={pose} value={pose}>
              {pose}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
