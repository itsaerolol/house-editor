import { useEffect } from 'react';
import { startAutosave, useStore } from './store/store';
import { Scene } from './viewport/Scene';
import { Inspector } from './ui/Inspector';
import { Dialogs } from './ui/Dialogs';
import { WalkHud } from './ui/WalkHud';
import { GameHud } from './ui/GameHud';
import { useShortcuts } from './ui/shortcuts';
import { Home } from './ui/Home';

export function App() {
  useEffect(() => startAutosave(), []);
  useShortcuts();
  const mode = useStore((s) => s.hist.project.view.mode);
  const walk = mode === 'walk';
  return (
    <div className={'game' + (walk ? ' walking' : '')}>
      <div className="viewport" id="viewport">
        <Scene />
        {walk && <WalkHud />}
      </div>
      <GameHud />
      <Inspector />
      <Dialogs />
      <Home />
    </div>
  );
}
