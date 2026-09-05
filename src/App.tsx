import { SceneCanvas } from '@/ui/SceneCanvas';
import { ControlBar } from '@/ui/ControlBar';
import './App.css';

function App() {
  return (
    <div className="app">
      <div className="scene-viewport">
        <SceneCanvas />
      </div>
      <ControlBar />
    </div>
  );
}

export default App;
