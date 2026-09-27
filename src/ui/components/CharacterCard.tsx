import { ATTRIBUTE_IDS, EQUIPMENT_SLOTS, SKILL_IDS, type Character } from '@game/index';
import { getItem } from '@data/items';
import { ATTRIBUTE_LABELS, SKILL_LABELS, SLOT_LABELS } from '../labels';

export function CharacterCard({ character }: { readonly character: Character }) {
  const { condition, assignment } = character;
  return (
    <article className="card character">
      <header className="character__header">
        <h3>
          {character.name}
          {character.isHero && <span className="tag">герой</span>}
        </h3>
        <span className={assignment.type === 'base' ? 'status status--base' : 'status status--away'}>
          {assignment.type === 'base' ? 'на базе' : 'в походе'}
        </span>
      </header>
      <p>
        Здоровье: {condition.health}/{condition.maxHealth}
      </p>
      <dl className="stats">
        {ATTRIBUTE_IDS.map((id) => (
          <div key={id}>
            <dt>{ATTRIBUTE_LABELS[id]}</dt>
            <dd>{character.attributes[id]}</dd>
          </div>
        ))}
      </dl>
      <dl className="stats">
        {SKILL_IDS.map((id) => (
          <div key={id}>
            <dt>{SKILL_LABELS[id]}</dt>
            <dd>{character.skills[id]}</dd>
          </div>
        ))}
      </dl>
      <ul className="equipment">
        {EQUIPMENT_SLOTS.map((slot) => {
          const itemId = character.equipment[slot];
          return (
            <li key={slot}>
              <span className="muted">{SLOT_LABELS[slot]}:</span>{' '}
              {itemId ? (getItem(itemId)?.name ?? itemId) : '—'}
            </li>
          );
        })}
      </ul>
    </article>
  );
}
