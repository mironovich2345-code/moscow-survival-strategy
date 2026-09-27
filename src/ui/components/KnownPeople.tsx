import { GAME_CONTENT } from '@data/content';
import { RECRUIT_STATUS_LABELS } from '../labels';
import { useGameStore } from '../store/gameStore';

/**
 * People the hero knows about who are not in the group. Only a short note —
 * no full profile before they join.
 */
export function KnownPeople() {
  const recruits = useGameStore((s) => s.game.recruits);
  const people = Object.values(GAME_CONTENT.recruits).filter((r) => recruits[r.id]?.status !== 'recruited');
  if (people.length === 0) return null;

  return (
    <section className="panel">
      <h2>Известные люди</h2>
      <ul className="list">
        {people.map((recruit) => {
          const status = recruits[recruit.id]?.status ?? recruit.initialStatus;
          const place = GAME_CONTENT.locations[recruit.lastKnownLocationId]?.name ?? recruit.lastKnownLocationId;
          return (
            <li key={recruit.id} className="card">
              {recruit.teaser} Последнее известное место: {place}.
              {status !== 'unavailable' && <span className="muted"> ({RECRUIT_STATUS_LABELS[status]})</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
