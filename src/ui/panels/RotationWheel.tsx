import { useState } from 'react';
import { useLineupStore } from '@/app/store/useLineupStore';
import { useAppStore } from '@/app/store/useAppStore';
import { deriveRotationState } from '@/app/deriveRotationState';
import { exportRotationSheet } from '@/ui/exportRotationSheet';
import { CAMERA_PRESETS, CAMERA_PRESET_IDS, type CameraPresetId } from '@/render/cameraPresets';

const ROTATIONS = [0, 1, 2, 3, 4, 5];

export function RotationWheel() {
  const focusSide = useLineupStore((s) => s.focusSide);
  const roster = useLineupStore((s) => s.rosters[focusSide]);
  const lineup = useLineupStore((s) => s.lineups[focusSide]);
  const rotation = useLineupStore((s) => s.rotations[focusSide]);
  const setRotation = useLineupStore((s) => s.setRotation);
  const overrides = useLineupStore((s) => s.positionOverrides[focusSide]);
  const sceneCanvasEl = useAppStore((s) => s.sceneCanvasEl);
  const sceneCameraRig = useAppStore((s) => s.sceneCameraRig);
  const [exporting, setExporting] = useState(false);
  const [exportCameraId, setExportCameraId] = useState<CameraPresetId>('topDown');

  const handleExport = async () => {
    if (!sceneCanvasEl || exporting) return;
    setExporting(true);
    try {
      await exportRotationSheet({
        canvas: sceneCanvasEl,
        side: focusSide,
        teamLabel: roster.name,
        currentRotation: rotation,
        setRotation,
        cameraRig: sceneCameraRig,
        cameraPresetId: exportCameraId,
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="panel">
      <div className="panel-title-row">
        <h3 className="panel-title">Rotation</h3>
        <div className="control-group">
          <select value={exportCameraId} onChange={(e) => setExportCameraId(e.target.value as CameraPresetId)}>
            {CAMERA_PRESET_IDS.map((id) => (
              <option key={id} value={id}>
                {CAMERA_PRESETS[id].label}
              </option>
            ))}
          </select>
          <button className="chip" onClick={handleExport} disabled={!sceneCanvasEl || exporting}>
            {exporting ? 'Exporting…' : 'Export sheet'}
          </button>
        </div>
      </div>
      <div className="rotation-wheel">
        {ROTATIONS.map((r) => {
          const { breakdown, alignment } = deriveRotationState(lineup, roster, focusSide, r, overrides);
          const active = r === rotation;
          return (
            <button
              key={r}
              className={active ? 'rotation-tile rotation-tile-active' : 'rotation-tile'}
              onClick={() => setRotation(focusSide, r)}
            >
              <div className="rotation-tile-header">
                <span>R{r + 1}</span>
                <span className={alignment.checked && !alignment.legal ? 'legality-dot legality-bad' : 'legality-dot legality-ok'} />
              </div>
              <div className="rotation-tile-body">
                <div>Setter: zone {breakdown.setterZone ?? 'n/a'} ({breakdown.setterRow ?? 'n/a'})</div>
                <div>Front-row attackers: {breakdown.frontRowAttackerCount}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
