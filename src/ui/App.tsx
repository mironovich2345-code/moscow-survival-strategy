import { useState } from 'react';
import { TopBar } from './components/TopBar';
import { BaseScreen } from './screens/BaseScreen';
import { MapScreen } from './screens/MapScreen';

export type Screen = 'base' | 'map';

export function App() {
  const [screen, setScreen] = useState<Screen>('base');

  return (
    <div className="app">
      <TopBar screen={screen} onNavigate={setScreen} />
      <main className="app__main">
        {screen === 'base' ? <BaseScreen /> : <MapScreen onBack={() => setScreen('base')} />}
      </main>
    </div>
  );
}
