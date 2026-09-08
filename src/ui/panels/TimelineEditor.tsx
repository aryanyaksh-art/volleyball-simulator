import { usePlayEditorStore } from '@/app/store/usePlayEditorStore';

export function TimelineEditor() {
  const play = usePlayEditorStore((s) => s.play);
  const selectedStepId = usePlayEditorStore((s) => s.selectedStepId);
  const selectStep = usePlayEditorStore((s) => s.selectStep);
  const addStep = usePlayEditorStore((s) => s.addStep);
  const removeStep = usePlayEditorStore((s) => s.removeStep);
  const moveStep = usePlayEditorStore((s) => s.moveStep);
  const renameStep = usePlayEditorStore((s) => s.renameStep);
  const setStepDuration = usePlayEditorStore((s) => s.setStepDuration);
  const undo = usePlayEditorStore((s) => s.undo);
  const redo = usePlayEditorStore((s) => s.redo);
  const canUndo = usePlayEditorStore((s) => s.past.length > 0);
  const canRedo = usePlayEditorStore((s) => s.future.length > 0);

  if (!play) return null;

  return (
    <div className="panel">
      <div className="panel-title-row">
        <h3 className="panel-title">Timeline: {play.name}</h3>
        <div className="control-group">
          <button className="chip" onClick={undo} disabled={!canUndo}>
            Undo
          </button>
          <button className="chip" onClick={redo} disabled={!canRedo}>
            Redo
          </button>
        </div>
      </div>

      <div className="timeline-steps">
        {play.steps.map((step, i) => (
          <div
            key={step.id}
            className={step.id === selectedStepId ? 'timeline-chip timeline-chip-active' : 'timeline-chip'}
            style={{ flexGrow: Math.max(step.duration, 0.1) }}
            onClick={() => selectStep(step.id)}
          >
            <input
              className="timeline-chip-name"
              value={step.name}
              onChange={(e) => renameStep(step.id, e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
            <div className="timeline-chip-controls">
              <button onClick={(e) => (e.stopPropagation(), moveStep(step.id, -1))} disabled={i === 0} title="Move earlier">
                &lt;
              </button>
              <input
                className="timeline-chip-duration"
                type="number"
                step={0.05}
                min={0.05}
                value={step.duration}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setStepDuration(step.id, Number(e.target.value))}
              />
              <span>s</span>
              <button
                onClick={(e) => (e.stopPropagation(), moveStep(step.id, 1))}
                disabled={i === play.steps.length - 1}
                title="Move later"
              >
                &gt;
              </button>
              <button
                onClick={(e) => (e.stopPropagation(), removeStep(step.id))}
                disabled={play.steps.length <= 1}
                title="Remove step"
              >
                x
              </button>
            </div>
          </div>
        ))}
        <button className="chip timeline-add-step" onClick={addStep}>
          + Add step
        </button>
      </div>
    </div>
  );
}
