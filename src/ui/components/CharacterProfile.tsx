import {
  EQUIPMENT_SLOTS,
  SKILL_IDS,
  combatRole,
  findCharacter,
  getItemDefinition,
  getTrust,
  trustCategory,
  whereabouts,
} from '@game/index';
import { GAME_CONTENT } from '@data/content';
import { COMBAT_ROLE_LABELS, SKILL_LABELS, SLOT_LABELS, TRUST_LABELS } from '../labels';
import { useGameStore } from '../store/gameStore';

interface CharacterProfileProps {
  readonly characterId: string;
  readonly onClose: () => void;
}

/** Full profile of a group member (only recruited characters have one). */
export function CharacterProfile({ characterId, onClose }: CharacterProfileProps) {
  const game = useGameStore((s) => s.game);
  const character = findCharacter(game.characters, characterId);
  if (!character) return null;

  const where = whereabouts(character, game);
  const place =
    where.type === 'base'
      ? 'на базе'
      : where.type === 'dead'
        ? 'погиб'
        : `в экспедиции: ${GAME_CONTENT.locations[where.locationId]?.name ?? where.locationId}`;
  const { condition } = character;

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="profile-title" onClick={onClose}>
      <section className="panel dialog profile" onClick={(e) => e.stopPropagation()}>
        <header className="character__header">
          <h2 id="profile-title">
            {character.name} {character.isHero && <span className="tag">герой</span>}
          </h2>
          <button type="button" className="small" onClick={onClose} aria-label="Закрыть профиль">
            ×
          </button>
        </header>
        <dl className="facts">
          <div>
            <dt>Статус</dt>
            <dd>{character.assignment.type === 'dead' ? 'погиб' : 'в группе'}</dd>
          </div>
          <div>
            <dt>Где</dt>
            <dd>{place}</dd>
          </div>
          <div>
            <dt>Здоровье</dt>
            <dd>
              {condition.health} / {condition.maxHealth}
              {condition.hungry && <span className="tag tag--warn">голоден</span>}
              {condition.thirsty && <span className="tag tag--warn">жажда</span>}
            </dd>
          </div>
          <div>
            <dt>Боевая роль</dt>
            <dd>{COMBAT_ROLE_LABELS[combatRole(character, game, GAME_CONTENT.items)]}</dd>
          </div>
          {!character.isHero && (
            <div>
              <dt>Отношение к Герою</dt>
              <dd data-testid="trust">{TRUST_LABELS[trustCategory(getTrust(game, GAME_CONTENT, character.id))]}</dd>
            </div>
          )}
          <div>
            <dt>Навыки</dt>
            <dd>{SKILL_IDS.map((id) => `${SKILL_LABELS[id]} ${character.skills[id]}`).join(', ')}</dd>
          </div>
          <div>
            <dt>Черты</dt>
            <dd>
              {character.traits.length === 0 ? (
                <span className="muted">нет</span>
              ) : (
                <ul className="traits">
                  {character.traits.map((id) => {
                    const trait = GAME_CONTENT.traits[id];
                    return (
                      <li key={id}>
                        <b>{trait?.name ?? id}</b>
                        {trait && <span className="muted"> — {trait.description}</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </dd>
          </div>
          <div>
            <dt>Экипировка</dt>
            <dd>
              <ul className="traits">
                {EQUIPMENT_SLOTS.map((slot) => {
                  const id = character.equipment[slot];
                  const definition = id ? getItemDefinition(game.items, GAME_CONTENT.items, id) : undefined;
                  return (
                    <li key={slot}>
                      <span className="muted">{SLOT_LABELS[slot]}:</span> {definition?.name ?? '—'}
                    </li>
                  );
                })}
              </ul>
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
