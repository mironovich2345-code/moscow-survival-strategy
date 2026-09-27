import { useState } from 'react';
import {
  HOURS_PER_TURN,
  MAX_SQUAD_SIZE,
  SUPPLY_KINDS,
  applyLootBonus,
  carryCapacity,
  emptySupplies,
  equipmentWeight,
  getScavengingBonusPercent,
  isAvailableForSquad,
  squadLoad,
  validateExpedition,
  type LocationDefinition,
  type Supplies,
  type SupplyKind,
} from '@game/index';
import { GAME_CONTENT } from '@data/content';
import { ERROR_LABELS, RESOURCE_LABELS, RISK_LABELS, SKILL_LABELS, formatLootRange } from '../labels';
import { useGameStore } from '../store/gameStore';
import { EquipmentEditor } from './EquipmentEditor';

interface SquadPanelProps {
  readonly location: LocationDefinition;
  readonly onSent: () => void;
}

export function SquadPanel({ location, onSent }: SquadPanelProps) {
  const game = useGameStore((s) => s.game);
  const dispatch = useGameStore((s) => s.dispatch);
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [supplies, setSupplies] = useState<Supplies>(emptySupplies());

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  const changeSupply = (kind: SupplyKind, delta: number) =>
    setSupplies((current) => ({
      ...current,
      [kind]: Math.min(game.resources[kind], Math.max(0, current[kind] + delta)),
    }));

  const squad = game.characters.filter((c) => selected.includes(c.id));
  const bonus = getScavengingBonusPercent(squad);
  const load = squadLoad(game, GAME_CONTENT.items, selected, supplies);
  const problem = selected.length === 0 ? null : validateExpedition(game, GAME_CONTENT, location.id, selected, supplies);
  const hours = location.expeditionTurns * HOURS_PER_TURN;

  const send = () => {
    const ok = dispatch({ type: 'sendExpedition', locationId: location.id, memberIds: selected, supplies });
    if (ok) onSent();
  };

  return (
    <section className="panel squad">
      <h2>{location.name}</h2>
      <p className="muted">{location.description}</p>
      <dl className="facts">
        <div>
          <dt>Базовое время</dt>
          <dd>
            {location.expeditionTurns} х. ({hours} ч)
          </dd>
        </div>
        <div>
          <dt>Риск</dt>
          <dd className={`risk risk--${location.risk}`}>{RISK_LABELS[location.risk]}</dd>
        </div>
        <div>
          <dt>Возможная добыча</dt>
          <dd>{location.loot.map((range) => formatLootRange(range)).join(', ')}</dd>
        </div>
        <div>
          <dt>С этим отрядом</dt>
          <dd>
            {squad.length === 0
              ? '— выберите участников —'
              : `${location.loot
                  .map((range) => formatLootRange(range, (n) => applyLootBonus(n, bonus)))
                  .join(', ')} (поиск +${bonus} %), если хватит места`}
          </dd>
        </div>
      </dl>

      <h3>
        Участники{' '}
        <span className="muted">
          {selected.length}/{MAX_SQUAD_SIZE}
        </span>
      </h3>
      <ul className="squad__members">
        {game.characters.map((character) => {
          const available = isAvailableForSquad(character);
          const checked = selected.includes(character.id);
          const full = !checked && selected.length >= MAX_SQUAD_SIZE;
          return (
            <li key={character.id}>
              <label className={available ? '' : 'muted'}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!available || full}
                  onChange={() => toggle(character.id)}
                />{' '}
                {character.name}{' '}
                <span className="muted">
                  ({SKILL_LABELS.scavenging}: {character.skills.scavenging})
                </span>
                {character.condition.hungry && <span className="tag tag--warn">голоден</span>}
                {character.condition.thirsty && <span className="tag tag--warn">жажда</span>}
                {!available && ' (недоступен)'}
              </label>
            </li>
          );
        })}
      </ul>

      {squad.length > 0 && (
        <div className="grid">
          {squad.map((character) => (
            <article key={character.id} className="card">
              <h3>{character.name}</h3>
              <p className="small">
                Снаряжение: {equipmentWeight(character, game.items, GAME_CONTENT.items)} / грузоподъёмность{' '}
                {carryCapacity(character, game.items, GAME_CONTENT.items)}
              </p>
              <EquipmentEditor character={character} />
            </article>
          ))}
        </div>
      )}

      <h3>Припасы отряда</h3>
      <ul className="supplies">
        {SUPPLY_KINDS.map((kind) => (
          <li key={kind} className="supplies__row">
            <span className="supplies__label">{RESOURCE_LABELS[kind]}</span>
            <button
              type="button"
              className="small"
              aria-label={`${RESOURCE_LABELS[kind]} −`}
              disabled={supplies[kind] <= 0}
              onClick={() => changeSupply(kind, -1)}
            >
              −
            </button>
            <span className="supplies__value" data-supply={kind}>
              {supplies[kind]}
            </span>
            <button
              type="button"
              className="small"
              aria-label={`${RESOURCE_LABELS[kind]} +`}
              disabled={supplies[kind] >= game.resources[kind]}
              onClick={() => changeSupply(kind, 1)}
            >
              +
            </button>
            <span className="muted small">на складе {game.resources[kind]}</span>
          </li>
        ))}
      </ul>

      <p className={load.total > load.capacity ? 'load load--over' : 'load'}>
        Груз: {load.total} / {load.capacity}{' '}
        <span className="muted small">
          (снаряжение {load.equipment}, припасы {load.resources})
        </span>
      </p>
      {problem && <p className="error small">{ERROR_LABELS[problem]}</p>}

      <button type="button" className="primary" disabled={selected.length === 0 || problem !== null} onClick={send}>
        Отправить отряд
      </button>
    </section>
  );
}
