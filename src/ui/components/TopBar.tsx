import { RESOURCE_KINDS, formatClock, getDay } from '@game/index';
import { RESOURCE_LABELS } from '../labels';
import { useGameStore } from '../store/gameStore';
import type { Screen } from '../App';

interface TopBarProps {
  readonly screen: Screen;
  readonly onNavigate: (screen: Screen) => void;
}

export function TopBar({ screen, onNavigate }: TopBarProps) {
  const time = useGameStore((s) => s.game.time);
  const turn = useGameStore((s) => s.game.turn);
  const resources = useGameStore((s) => s.game.resources);
  const dispatch = useGameStore((s) => s.dispatch);

  return (
    <header className="topbar">
      <div className="topbar__time">
        <span className="topbar__day">День {getDay(time)}</span>
        <span className="topbar__clock">{formatClock(time)}</span>
        <span className="muted">ход {turn}</span>
      </div>

      <ul className="topbar__resources">
        {RESOURCE_KINDS.map((kind) => (
          <li key={kind} className="resource" data-resource={kind}>
            <span className="resource__label">{RESOURCE_LABELS[kind]}</span>
            <span className="resource__value">{resources[kind]}</span>
          </li>
        ))}
      </ul>

      <nav className="topbar__nav">
        <button
          type="button"
          className={screen === 'base' ? 'active' : ''}
          onClick={() => onNavigate('base')}
        >
          База
        </button>
        <button
          type="button"
          className={screen === 'map' ? 'active' : ''}
          onClick={() => onNavigate('map')}
        >
          Карта
        </button>
        <button type="button" className="primary" onClick={() => dispatch({ type: 'endTurn' })}>
          Следующий ход (+2 ч)
        </button>
      </nav>
    </header>
  );
}
