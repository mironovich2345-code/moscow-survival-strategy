import {
  RESOURCE_KINDS,
  findCharacter,
  findItemLocation,
  getItemDefinition,
  isAvailableForSquad,
} from '@game/index';
import { GAME_CONTENT } from '@data/content';
import { RESOURCE_LABELS, SLOT_LABELS } from '../labels';
import { useGameStore } from '../store/gameStore';

/** «Склад»: base resources and every unique item with its current place. */
export function StoragePanel() {
  const game = useGameStore((s) => s.game);
  const dispatch = useGameStore((s) => s.dispatch);
  const atBase = game.characters.filter(isAvailableForSquad);

  return (
    <section className="panel">
      <h2>Склад</h2>
      <ul className="storage__resources">
        {RESOURCE_KINDS.map((kind) => (
          <li key={kind} className="resource">
            <span className="resource__label">{RESOURCE_LABELS[kind]}</span>
            <span className="resource__value">{game.resources[kind]}</span>
          </li>
        ))}
      </ul>

      <table className="table">
        <thead>
          <tr>
            <th>Предмет</th>
            <th>Тип</th>
            <th>Вес</th>
            <th>Где</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {Object.values(game.items).map((item) => {
            const definition = getItemDefinition(game.items, GAME_CONTENT.items, item.id);
            const location = findItemLocation(game, item.id);
            const owner =
              location?.type === 'character' ? findCharacter(game.characters, location.characterId) : undefined;
            const ownerAway = owner !== undefined && owner.assignment.type !== 'base';
            return (
              <tr key={item.id}>
                <td>
                  {definition?.name ?? item.defId} <span className="muted small">#{item.id}</span>
                </td>
                <td>{definition ? SLOT_LABELS[definition.slot] : '?'}</td>
                <td>{definition?.weight ?? '?'}</td>
                <td>
                  {location?.type === 'storage'
                    ? 'на складе'
                    : `экипирован: ${owner?.name ?? '?'}${ownerAway ? ' (в походе)' : ''}`}
                </td>
                <td>
                  {location?.type === 'storage' && atBase.length > 0 && (
                    <select
                      className="small"
                      value=""
                      aria-label={`Выдать: ${definition?.name ?? item.id}`}
                      onChange={(e) =>
                        dispatch({
                          type: 'moveItem',
                          itemId: item.id,
                          to: { type: 'character', characterId: e.target.value },
                        })
                      }
                    >
                      <option value="">Выдать…</option>
                      {atBase.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {location?.type === 'character' && !ownerAway && (
                    <button
                      type="button"
                      className="small"
                      onClick={() => dispatch({ type: 'moveItem', itemId: item.id, to: { type: 'storage' } })}
                    >
                      На склад
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
