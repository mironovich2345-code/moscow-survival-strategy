import { useState } from 'react';
import { EventDialog } from './components/EventDialog';
import { TopBar } from './components/TopBar';
import { BaseScreen } from './screens/BaseScreen';
import { CombatScreen } from './screens/CombatScreen';
import { FactionsScreen } from './screens/FactionsScreen';
import { MapScreen } from './screens/MapScreen';
import { useGameStore } from './store/gameStore';

export type Screen = 'base' | 'map' | 'factions';

export function App() {
  const [screen, setScreen] = useState<Screen>('base');
  const inCombat = useGameStore((s) => s.game.combat !== null);

  return (
    <div className="app">
      <TopBar screen={screen} onNavigate={setScreen} />
      <main className="app__main">
        {inCombat ? (
          <CombatScreen />
        ) : screen === 'base' ? (
          <BaseScreen />
        ) : screen === 'factions' ? (
          <FactionsScreen />
        ) : (
          <MapScreen onBack={() => setScreen('base')} />
        )}
      </main>
      <EventDialog />
    </div>
  );
}
