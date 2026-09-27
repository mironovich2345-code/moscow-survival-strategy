import {
  WEAPON_SLOTS,
  carriedResources,
  findCharacter,
  getItemDefinition,
  isCombatOver,
  livingCombatants,
  livingEnemies,
  missingCombatActions,
  retreatChance,
  validateCombatAction,
  type Character,
  type CombatAction,
  type CombatActionType,
  type WeaponSlot,
} from '@game/index';
import { GAME_CONTENT } from '@data/content';
import { ErrorBanner } from '../components/ErrorBanner';
import {
  ACTION_LABELS,
  LINE_LABELS,
  STATUS_LABELS,
  WEAPON_SLOT_LABELS,
  describeCombatLog,
  enemyName,
} from '../combatLabels';
import { ERROR_LABELS } from '../labels';
import { useGameStore } from '../store/gameStore';

export function CombatScreen() {
  const game = useGameStore((s) => s.game);
  const dispatch = useGameStore((s) => s.dispatch);
  const combat = game.combat;
  if (!combat) return null;

  const expedition = game.expeditions.find((e) => e.id === combat.expeditionId);
  const carried = expedition ? carriedResources(expedition) : {};
  const living = livingCombatants(game);
  const enemiesAlive = livingEnemies(combat);
  const over = isCombatOver(combat);
  const nameOf = (id: string) => findCharacter(game.characters, id)?.name ?? id;
  const missing = missingCombatActions(game);
  const location = GAME_CONTENT.locations[combat.locationId];
  const squad = [
    ...living,
    ...combat.fallen.flatMap((id) => {
      const c = findCharacter(game.characters, id);
      return c ? [c] : [];
    }),
  ];

  return (
    <div className="screen combat">
      <section className="panel combat__header">
        <h2>
          Бой · {location?.name ?? combat.locationId} ·{' '}
          <span className={`combat__status combat__status--${combat.status}`}>{STATUS_LABELS[combat.status]}</span>
        </h2>
        <ul className="combat__stats">
          <li>
            Раунд <b>{combat.round}</b>
          </li>
          <li>
            Шум <b>{combat.combatNoise}</b>
            <span className="muted small">
              {' '}
              (подкрепления: 20+ — 25 %, 35+ — 50 %; пришло {combat.reinforcementCount}/3)
            </span>
          </li>
          <li>
            Патроны отряда <b>{carried.ammunition ?? 0}</b>
          </li>
          <li>
            Медикаменты <b>{carried.medicine ?? 0}</b>
          </li>
        </ul>
      </section>

      <ErrorBanner />

      <div className="combat__field">
        <section className="panel">
          <h2>Отряд</h2>
          <div className="combat__units">
            {squad.map((character) => (
              <CombatantCard key={character.id} character={character} />
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>Заражённые ({enemiesAlive.length})</h2>
          <ul className="combat__enemies">
            {combat.enemies.map((e) => (
              <li key={e.id} className={e.health > 0 ? 'card' : 'card muted dead'}>
                <b>{enemyName(e.id)}</b> — {e.health > 0 ? `${e.health} / ${e.maxHealth}` : 'убит'}
                <HealthBar value={e.health} max={e.maxHealth} />
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="panel combat__controls">
        {over ? (
          <>
            <p>
              <b>{STATUS_LABELS[combat.status]}</b>
              {combat.status === 'victory' && ' — отряд продолжает поход.'}
              {combat.status === 'retreated' && ' — отряд возвращается на базу.'}
              {combat.status === 'defeat' && ' — экспедиция потеряна.'}
            </p>
            <button type="button" className="primary" onClick={() => dispatch({ type: 'closeCombat' })}>
              Завершить бой
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="primary"
              disabled={missing.length > 0}
              onClick={() => dispatch({ type: 'confirmCombatRound' })}
            >
              Подтвердить раунд {combat.round}
            </button>
            <button type="button" onClick={() => dispatch({ type: 'retreatFromCombat' })}>
              Отступить всем отрядом (шанс {retreatChance(living.length, enemiesAlive.length)} %)
            </button>
            {missing.length > 0 && (
              <span className="error small">Нет действия: {missing.map(nameOf).join(', ')}</span>
            )}
            {combat.status === 'setup' && (
              <span className="muted small">Расстановку FRONT/BACK можно менять до первого раунда.</span>
            )}
          </>
        )}
      </section>

      <section className="panel">
        <h2>Лог боя</h2>
        <ol className="log">
          {[...combat.log].reverse().map((entry, i) => (
            <li key={combat.log.length - i}>
              <span className="log__time">Р{entry.round}</span> {describeCombatLog(entry, nameOf)}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function HealthBar({ value, max }: { readonly value: number; readonly max: number }) {
  const percent = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  return (
    <div className="hp" aria-hidden="true">
      <div className="hp__fill" style={{ width: `${percent}%` }} />
    </div>
  );
}

function CombatantCard({ character }: { readonly character: Character }) {
  const game = useGameStore((s) => s.game);
  const dispatch = useGameStore((s) => s.dispatch);
  const combat = game.combat!;
  const line = combat.positions[character.id];
  const dead = line === undefined;
  const over = isCombatOver(combat);
  const action = combat.selectedActions[character.id];
  const weapons = WEAPON_SLOTS.flatMap((slot) => {
    const id = character.equipment[slot];
    const definition = id ? getItemDefinition(game.items, GAME_CONTENT.items, id) : undefined;
    return definition?.weapon ? [{ slot, definition }] : [];
  });
  const enemies = livingEnemies(combat);
  const allies = livingCombatants(game);

  const choose = (next: CombatAction) =>
    dispatch({ type: 'setCombatAction', characterId: character.id, action: next });

  /** Builds a sensible default action of the chosen type. */
  const pickType = (type: CombatActionType) => {
    const firstEnemy = enemies[0]?.id ?? '';
    if (type === 'attack') {
      const usable = weapons.find(
        (w) =>
          validateCombatAction(game, GAME_CONTENT, character.id, {
            type: 'attack',
            weaponSlot: w.slot,
            targetId: firstEnemy,
          }) === null,
      );
      choose({ type: 'attack', weaponSlot: usable?.slot ?? weapons[0]?.slot ?? 'sidearm', targetId: firstEnemy });
    } else if (type === 'useMedicine') {
      choose({ type: 'useMedicine', targetId: character.id });
    } else {
      choose({ type });
    }
  };

  const reason = (candidate: CombatAction) => validateCombatAction(game, GAME_CONTENT, character.id, candidate);

  return (
    <article className={dead ? 'card combatant dead' : 'card combatant'}>
      <header className="character__header">
        <h3>{character.name}</h3>
        <span className="muted">{dead ? 'погиб' : LINE_LABELS[line]}</span>
      </header>
      <p>
        Здоровье: {character.condition.health} / {character.condition.maxHealth}
      </p>
      <HealthBar value={character.condition.health} max={character.condition.maxHealth} />
      <p className="small">
        Оружие:{' '}
        {weapons.length > 0
          ? weapons.map((w) => `${w.definition.name} (${WEAPON_SLOT_LABELS[w.slot]})`).join(', ')
          : 'нет'}
      </p>

      {!dead && combat.status === 'setup' && (
        <p className="small">
          Линия:{' '}
          {(['front', 'back'] as const).map((l) => (
            <button
              key={l}
              type="button"
              className={l === line ? 'small active' : 'small'}
              onClick={() => dispatch({ type: 'setCombatPosition', characterId: character.id, line: l })}
            >
              {LINE_LABELS[l]}
            </button>
          ))}
        </p>
      )}

      {!dead && !over && (
        <div className="combatant__action">
          <label className="small">
            Действие:{' '}
            <select
              className="small"
              value={action?.type ?? ''}
              aria-label={`Действие: ${character.name}`}
              onChange={(e) => pickType(e.target.value as CombatActionType)}
            >
              <option value="" disabled>
                — выберите действие —
              </option>
              {(['attack', 'defend', 'move', 'useMedicine'] as const).map((type) => (
                <option key={type} value={type}>
                  {ACTION_LABELS[type]}
                </option>
              ))}
            </select>
          </label>

          {action?.type === 'attack' && (
            <>
              <label className="small">
                Оружие:{' '}
                <select
                  className="small"
                  value={action.weaponSlot}
                  aria-label={`Оружие: ${character.name}`}
                  onChange={(e) => choose({ ...action, weaponSlot: e.target.value as WeaponSlot })}
                >
                  {weapons.map((w) => {
                    const problem = reason({ ...action, weaponSlot: w.slot });
                    return (
                      <option key={w.slot} value={w.slot} disabled={problem !== null}>
                        {w.definition.name}
                        {problem ? ` — ${ERROR_LABELS[problem]}` : ''}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="small">
                Цель:{' '}
                <select
                  className="small"
                  value={action.targetId}
                  aria-label={`Цель: ${character.name}`}
                  onChange={(e) => choose({ ...action, targetId: e.target.value })}
                >
                  {enemies.map((e) => (
                    <option key={e.id} value={e.id}>
                      {enemyName(e.id)} ({e.health})
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          {action?.type === 'useMedicine' && (
            <label className="small">
              Кого лечить:{' '}
              <select
                className="small"
                value={action.targetId}
                aria-label={`Лечить: ${character.name}`}
                onChange={(e) => choose({ type: 'useMedicine', targetId: e.target.value })}
              >
                {allies.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.condition.health})
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="small muted combatant__chosen">
            Выбрано: {action ? ACTION_LABELS[action.type] : 'ничего — нужно выбрать'}
            {action?.type === 'attack' && ` → ${enemyName(action.targetId)}`}
          </p>
        </div>
      )}
    </article>
  );
}
