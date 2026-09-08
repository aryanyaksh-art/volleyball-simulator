import { usePlaybackStore } from '@/app/store/usePlaybackStore';
import { usePlayEditorStore } from '@/app/store/usePlayEditorStore';

export function DiagnosticsPanel() {
  const mode = usePlaybackStore((s) => s.mode);
  const diagnostics = usePlaybackStore((s) => s.diagnostics);
  const editorPlay = usePlayEditorStore((s) => s.play);
  const setStepDuration = usePlayEditorStore((s) => s.setStepDuration);

  if (mode !== 'play') return null;

  const { speedCapViolations, ballFlightIssues } = diagnostics;
  const clean = speedCapViolations.length === 0 && ballFlightIssues.length === 0;

  return (
    <div className="panel diagnostics-panel">
      <h3 className="panel-title">Diagnostics</h3>
      {clean ? (
        <p className="validation-status validation-legal">No issues. Every move is within its speed cap and the ball stays legal.</p>
      ) : (
        <ul className="panel-warnings">
          {speedCapViolations.map((v, i) => {
            // Only offer the one-click fix when the previewed play is
            // actually the one open in the editor — otherwise "Extend"
            // would silently edit a different play than what's on screen
            // (e.g. previewing a built-in demo while a custom play is
            // still loaded in the Advanced editor).
            const editable = editorPlay?.steps.some((s) => s.id === v.stepId) ?? false;
            return (
              <li key={`speed-${i}`} className="violation-error">
                {v.message} Try extending that step to at least {v.suggestedDurationS.toFixed(2)}s.
                {editable && (
                  <button className="chip chip-small" onClick={() => setStepDuration(v.stepId, v.suggestedDurationS)}>
                    Extend to {v.suggestedDurationS.toFixed(2)}s
                  </button>
                )}
              </li>
            );
          })}
          {ballFlightIssues.map((issue, i) => (
            <li key={`ball-${i}`} className={issue.severity === 'error' ? 'violation-error' : 'violation-warning'}>
              [{issue.atS.toFixed(2)}s, {issue.kind}] {issue.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
