import { useState } from 'react';
import {
  HOURS_PER_TURN,
  MAX_SQUAD_SIZE,
  isAvailableForSquad,
  type LocationDefinition,
} from '@game/index';
import { RESOURCE_LABELS } from '../labels';
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

  return (
    <section className="panel squad">
      <h2>{location.name}</h2>
      <p className="muted">{location.description}</p>
      <p>
        Время похода: {location.expeditionTurns} х. ({hours} ч). Возможная добыча:{' '}
        {location.loot
          .map((l) => `${RESOURCE_LABELS[l.resource]} ${l.min}–${l.max}`)
          .join(', ')}
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
                {character.name} {!available && '(недоступен)'}
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
