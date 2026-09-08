import { useEffect } from 'react';
import { SceneCanvas } from '@/ui/SceneCanvas';
import { CourtBenchOverlay } from '@/ui/CourtBenchOverlay';
import { ControlBar } from '@/ui/ControlBar';
import { TransportBar } from '@/ui/TransportBar';
import { LineupSidebar } from '@/ui/panels/LineupSidebar';
import { AuthorSidebar } from '@/ui/panels/AuthorSidebar';
import { GuidedAuthorPanel } from '@/ui/panels/GuidedAuthorPanel';
import { ServeReceiveSidebar } from '@/ui/panels/ServeReceiveSidebar';
import { MatchupSidebar } from '@/ui/panels/MatchupSidebar';
import { PlayLibraryPanel } from '@/ui/panels/PlayLibraryPanel';
import { DiagnosticsPanel } from '@/ui/panels/DiagnosticsPanel';
import { usePlaybackStore } from '@/app/store/usePlaybackStore';
import { useAppStore } from '@/app/store/useAppStore';
import { usePresentationWakeLock } from '@/ui/usePresentationWakeLock';
import './App.css';

function App() {
  const mode = usePlaybackStore((s) => s.mode);
  const presentationMode = useAppStore((s) => s.presentationMode);
  const togglePresentationMode = useAppStore((s) => s.togglePresentationMode);
  const authorAdvancedMode = useAppStore((s) => s.authorAdvancedMode);
  const toggleAuthorAdvancedMode = useAppStore((s) => s.toggleAuthorAdvancedMode);
  const showPlayLibrary = useAppStore((s) => s.showPlayLibrary);

  usePresentationWakeLock(presentationMode);

  useEffect(() => {
    if (!presentationMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') togglePresentationMode();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [presentationMode, togglePresentationMode]);

  const showAuthorAdvancedToggle = !presentationMode && (mode === 'author' || mode === 'formation');

  return (
    <div className={presentationMode ? 'app app-presentation' : 'app'}>
      <div className="main-row">
        <div className="scene-viewport">
          <SceneCanvas />
          {!presentationMode && <CourtBenchOverlay />}
          {!presentationMode && mode === 'play' && <DiagnosticsPanel />}
          {showAuthorAdvancedToggle && (
            <button className="chip advanced-toggle" onClick={toggleAuthorAdvancedMode}>
              {authorAdvancedMode ? 'Advanced (on)' : 'Advanced'}
            </button>
          )}
          {presentationMode && (
            <button className="chip presentation-exit" onClick={togglePresentationMode}>
              Exit presentation (Esc)
            </button>
          )}
        </div>
        {!presentationMode &&
          (showPlayLibrary && (mode === 'formation' || mode === 'play') ? (
            <PlayLibraryPanel />
          ) : mode === 'author' ? (
            authorAdvancedMode ? (
              <AuthorSidebar />
            ) : null
          ) : mode === 'serve-receive' ? (
            <ServeReceiveSidebar />
          ) : mode === 'matchup' ? (
            <MatchupSidebar />
          ) : authorAdvancedMode ? (
            <LineupSidebar />
          ) : null)}
        {!presentationMode && mode === 'author' && !authorAdvancedMode && <GuidedAuthorPanel />}
      </div>
      <TransportBar />
      {!presentationMode && authorAdvancedMode && <ControlBar />}
    </div>
  );
}

export default App;
