import { usePlaybackStore } from '@/app/store/usePlaybackStore';

export function DiagnosticsPanel() {
  const mode = usePlaybackStore((s) => s.mode);
  const diagnostics = usePlaybackStore((s) => s.diagnostics);

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
          {speedCapViolations.map((v, i) => (
            <li key={`speed-${i}`} className="violation-error">
              {v.message} Try extending that step to at least {v.suggestedDurationS.toFixed(2)}s.
            </li>
          ))}
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
