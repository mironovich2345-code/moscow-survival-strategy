import {
  EQUIPMENT_SLOTS,
  getItemDefinition,
  isAvailableForSquad,
  type Character,
  type MoveItemTarget,
} from '@game/index';
import { GAME_CONTENT } from '@data/content';
import { SLOT_LABELS } from '../labels';
import { useGameStore } from '../store/gameStore';

/**
 * Per-slot equipment with simple controls: take off, hand over, put on from
 * storage. All rules (who can, where the displaced item goes) live in moveItem.
 */
export function EquipmentEditor({ character }: { readonly character: Character }) {
  const items = useGameStore((s) => s.game.items);
  const storage = useGameStore((s) => s.game.storage);
  const characters = useGameStore((s) => s.game.characters);
  const dispatch = useGameStore((s) => s.dispatch);

  const editable = isAvailableForSquad(character);
  const others = characters.filter((c) => c.id !== character.id && isAvailableForSquad(c));
  const definitionOf = (id: string) => getItemDefinition(items, GAME_CONTENT.items, id);
  const move = (itemId: string, to: MoveItemTarget) => dispatch({ type: 'moveItem', itemId, to });

  return (
    <ul className="equipment">
      {EQUIPMENT_SLOTS.map((slot) => {
        const itemId = character.equipment[slot];
        const definition = itemId ? definitionOf(itemId) : undefined;
        const fitting = storage.items.filter((id) => definitionOf(id)?.slot === slot);
        return (
          <li key={slot} className="equipment__row">
            <span className="muted">{SLOT_LABELS[slot]}:</span>{' '}
            {itemId ? (
              <>
                {definition?.name ?? itemId} <span className="muted">({definition?.weight ?? 0})</span>
                {editable && (
                  <span className="equipment__actions">
                    <button type="button" className="small" onClick={() => move(itemId, { type: 'storage' })}>
                      Снять
                    </button>
                    {others.length > 0 && (
                      <select
                        className="small"
                        value=""
                        aria-label={`Передать: ${definition?.name ?? itemId}`}
                        onChange={(e) => move(itemId, { type: 'character', characterId: e.target.value })}
                      >
                        <option value="">Передать…</option>
                        {others.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="muted">—</span>
                {editable && fitting.length > 0 && (
                  <select
                    className="small"
                    value=""
                    aria-label={`Надеть: ${SLOT_LABELS[slot]}`}
                    onChange={(e) => move(e.target.value, { type: 'character', characterId: character.id })}
                  >
                    <option value="">Надеть со склада…</option>
                    {fitting.map((id) => (
                      <option key={id} value={id}>
                        {definitionOf(id)?.name ?? id}
                      </option>
                    ))}
                  </select>
                )}
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
