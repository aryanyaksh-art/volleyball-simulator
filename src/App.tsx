import { SceneCanvas } from '@/ui/SceneCanvas';
import { ControlBar } from '@/ui/ControlBar';
import { TransportBar } from '@/ui/TransportBar';
import { LineupSidebar } from '@/ui/panels/LineupSidebar';
import { AuthorSidebar } from '@/ui/panels/AuthorSidebar';
import { ServeReceiveSidebar } from '@/ui/panels/ServeReceiveSidebar';
import { MatchupSidebar } from '@/ui/panels/MatchupSidebar';
import { DiagnosticsPanel } from '@/ui/panels/DiagnosticsPanel';
import { usePlaybackStore } from '@/app/store/usePlaybackStore';
import './App.css';

function App() {
  const mode = usePlaybackStore((s) => s.mode);

  return (
    <div className="app">
      <div className="main-row">
        <div className="scene-viewport">
          <SceneCanvas />
          <DiagnosticsPanel />
        </div>
        {mode === 'author' ? (
          <AuthorSidebar />
        ) : mode === 'serve-receive' ? (
          <ServeReceiveSidebar />
        ) : mode === 'matchup' ? (
          <MatchupSidebar />
        ) : (
          <LineupSidebar />
        )}
      </div>
      <TransportBar />
      <ControlBar />
    </div>
  );
}

export default App;
