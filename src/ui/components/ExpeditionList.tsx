import { findCharacter, formatClock, getDay, turnsUntil } from '@game/index';
import { formatDelta } from '../labels';
import { GAME_CONTENT } from '@data/content';
import { useGameStore } from '../store/gameStore';

export function ExpeditionList() {
  const expeditions = useGameStore((s) => s.game.expeditions);
  const characters = useGameStore((s) => s.game.characters);
  const now = useGameStore((s) => s.game.time);

  if (expeditions.length === 0) {
    return <p className="muted">Все на базе.</p>;
  }

  return (
    <ul className="list">
      {expeditions.map((expedition) => {
        const location = GAME_CONTENT.locations[expedition.locationId];
        const names = expedition.memberIds
          .map((id) => findCharacter(characters, id)?.name ?? id)
          .join(', ');
        return (
          <li key={expedition.id} className="card">
            <strong>{location?.name ?? expedition.locationId}</strong> — {names}
            {expedition.pendingEventId && <span className="tag tag--warn">ждёт решения</span>}
            {expedition.aborted && <span className="tag tag--warn">возвращается</span>}
            <div className="muted">
              Возвращение: день {getDay(expedition.returnsAt)}, {formatClock(expedition.returnsAt)}{' '}
              (через {turnsUntil(now, expedition.returnsAt)} х.)
            </div>
            {Object.keys(expedition.haul).length > 0 && (
              <div className="muted">Несут с собой: {formatDelta(expedition.haul)}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
