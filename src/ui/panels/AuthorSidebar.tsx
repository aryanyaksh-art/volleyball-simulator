import { TimelineEditor } from './TimelineEditor';
import { StepInspector } from './StepInspector';

export function AuthorSidebar() {
  return (
    <div className="lineup-sidebar">
      <TimelineEditor />
      <StepInspector />
    </div>
  );
}
