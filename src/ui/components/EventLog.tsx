import { findCharacter, formatClock, getDay } from '@game/index';
import { describeLogEntry } from '../labels';
import { useGameStore } from '../store/gameStore';

const VISIBLE_ENTRIES = 12;

export function EventLog() {
  const log = useGameStore((s) => s.game.log);
  const characters = useGameStore((s) => s.game.characters);
  const nameOf = (id: string) => findCharacter(characters, id)?.name ?? id;

  const recent = log.slice(-VISIBLE_ENTRIES).reverse();
  return (
    <ol className="log">
      {recent.map((entry) => (
        <li key={entry.id}>
          <span className="log__time">
            Д{getDay(entry.at)} {formatClock(entry.at)}
          </span>{' '}
          {describeLogEntry(entry, nameOf)}
        </li>
      ))}
    </ol>
  );
}
