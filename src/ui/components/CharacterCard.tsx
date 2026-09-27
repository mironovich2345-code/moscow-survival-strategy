import { ATTRIBUTE_IDS, SKILL_IDS, carryCapacity, equipmentWeight, type Character } from '@game/index';
import { GAME_CONTENT } from '@data/content';
import { ATTRIBUTE_LABELS, SKILL_LABELS } from '../labels';
import { useGameStore } from '../store/gameStore';
import { EquipmentEditor } from './EquipmentEditor';

export function CharacterCard({ character }: { readonly character: Character }) {
  const { condition, assignment } = character;
  const items = useGameStore((s) => s.game.items);
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
        {condition.hungry && <span className="tag tag--warn">голоден</span>}
        {condition.thirsty && <span className="tag tag--warn">жажда</span>}
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
      <p className="small">
        Снаряжение: {equipmentWeight(character, items, GAME_CONTENT.items)} /{' '}
        грузоподъёмность {carryCapacity(character, items, GAME_CONTENT.items)}
      </p>
      <EquipmentEditor character={character} />
    </article>
  );
}
