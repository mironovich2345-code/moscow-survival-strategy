import { useState } from 'react';
import {
  HOURS_PER_TURN,
  MAX_SQUAD_SIZE,
  applyLootBonus,
  getScavengingBonusPercent,
  isAvailableForSquad,
  type LocationDefinition,
} from '@game/index';
import { RISK_LABELS, SKILL_LABELS, formatLootRange } from '../labels';
import { useGameStore } from '../store/gameStore';

interface SquadPanelProps {
  readonly location: LocationDefinition;
  readonly onSent: () => void;
}

export function SquadPanel({ location, onSent }: SquadPanelProps) {
  const characters = useGameStore((s) => s.game.characters);
  const dispatch = useGameStore((s) => s.dispatch);
  const [selected, setSelected] = useState<readonly string[]>([]);

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );

  const send = () => {
    const ok = dispatch({ type: 'sendExpedition', locationId: location.id, memberIds: selected });
    if (ok) onSent();
  };

  const hours = location.expeditionTurns * HOURS_PER_TURN;
  const squad = characters.filter((c) => selected.includes(c.id));
  const bonus = getScavengingBonusPercent(squad);

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
                  .join(', ')} (поиск +${bonus} %)`}
          </dd>
        </div>
      </dl>
      <p className="muted small">
        Бонус поиска: +10 % за каждое очко навыка «{SKILL_LABELS.scavenging}» у участников, максимум
        +100 %. В пути возможны события.
      </p>

      <h3>
        Отряд{' '}
        <span className="muted">
          {selected.length}/{MAX_SQUAD_SIZE}
        </span>
      </h3>
      <ul className="squad__members">
        {characters.map((character) => {
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

      <button type="button" className="primary" disabled={selected.length === 0} onClick={send}>
        Отправить отряд
      </button>
    </section>
  );
}
