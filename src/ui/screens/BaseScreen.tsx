import { MAX_GROUP_SIZE } from '@game/index';
import { GAME_CONTENT } from '@data/content';
import { CharacterCard } from '../components/CharacterCard';
import { EventLog } from '../components/EventLog';
import { ExpeditionList } from '../components/ExpeditionList';
import { StoragePanel } from '../components/StoragePanel';
import { useGameStore } from '../store/gameStore';

export function BaseScreen() {
  const characters = useGameStore((s) => s.game.characters);
  const baseLocationId = useGameStore((s) => s.game.baseLocationId);
  const startNewGame = useGameStore((s) => s.startNewGame);

  const base = GAME_CONTENT.locations[baseLocationId];
  const district = base ? GAME_CONTENT.districts[base.districtId] : undefined;

  const onNewGame = () => {
    if (window.confirm('Начать новую игру? Текущий прогресс будет удалён.')) startNewGame();
  };

  return (
    <div className="screen base">
      <section className="panel">
        <h2>
          База: {base?.name ?? baseLocationId}
          {district && <span className="muted"> · {district.name}</span>}
        </h2>
        <p className="muted">{base?.description}</p>
      </section>

      <section className="panel">
        <h2>
          Группа{' '}
          <span className="muted">
            {characters.length}/{MAX_GROUP_SIZE}
          </span>
        </h2>
        <div className="grid">
          {characters.map((character) => (
            <CharacterCard key={character.id} character={character} />
          ))}
        </div>
      </section>

      <StoragePanel />

      <section className="panel">
        <h2>Отряды в пути</h2>
        <ExpeditionList />
      </section>

      <section className="panel">
        <h2>Журнал</h2>
        <EventLog />
      </section>

      <footer className="panel panel--footer">
        <button type="button" className="danger" onClick={onNewGame}>
          Новая игра
        </button>
      </footer>
    </div>
  );
}
