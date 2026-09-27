import { findCharacter, formatClock, getDay, turnsUntil, type Expedition } from '@game/index';
import { foundList, formatAmounts } from '../labels';
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
            {!expedition.aborted && (
              <div className="muted">
                {expedition.searched
                  ? 'Локация обыскана.'
                  : `Обыск: день ${getDay(expedition.searchAt)}, ${formatClock(expedition.searchAt)}.`}
              </div>
            )}
            <div className="muted">Припасы: {formatAmounts(expedition.supplies)}</div>
            <FoundItems haul={expedition.haul} haulItems={expedition.haulItems} />
            {isDevMode() && <DevCombatButtons expeditionId={expedition.id} />}
          </li>
        );
      })}
    </ul>
  );
}

function FoundItems({
  haul,
  haulItems,
}: {
  readonly haul: Expedition['haul'];
  readonly haulItems: Expedition['haulItems'];
}) {
  const registry = useGameStore((s) => s.game.items);
  const lines = foundList(
    haul,
    haulItems.map((id) => registry[id]?.defId ?? id),
  );
  if (lines.length === 0) return null;
  return (
    <div className="found">
      <span className="muted">Найдено:</span>
      <ul>
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

/** DEV tool: visible only in `npm run dev` or with `?dev` in the URL. Not part of the game UI. */
function isDevMode(): boolean {
  if (import.meta.env.DEV) return true;
  try {
    return new URLSearchParams(window.location.search).has('dev');
  } catch {
    return false;
  }
}

function DevCombatButtons({ expeditionId }: { readonly expeditionId: string }) {
  const dispatch = useGameStore((s) => s.dispatch);
  return (
    <div className="dev small">
      DEV: бой с{' '}
      {[1, 2, 3, 4].map((n) => (
        <button
          key={n}
          type="button"
          className="small"
          onClick={() => dispatch({ type: 'startCombat', expeditionId, enemies: n })}
        >
          {n}
        </button>
      ))}{' '}
      заражёнными
    </div>
  );
}
