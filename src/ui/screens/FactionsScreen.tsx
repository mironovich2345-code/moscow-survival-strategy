import { factionIntel, findCharacter, formatClock, getDay } from '@game/index';
import { GAME_CONTENT } from '@data/content';
import {
  AWARENESS_LABELS,
  FACTION_RELATION_LABELS,
  MANPOWER_LABELS,
  OPERATION_SEEN_LABELS,
  describeLogEntry,
  districtName,
} from '../labels';
import { useGameStore } from '../store/gameStore';

/** «Фракции»: only what the player knows. Internal numbers are never read here. */
export function FactionsScreen() {
  const game = useGameStore((s) => s.game);
  const nameOf = (id: string) => findCharacter(game.characters, id)?.name ?? id;
  const intel = Object.keys(game.factions).flatMap((id) => {
    const info = factionIntel(game, GAME_CONTENT, id as 'arena');
    return info ? [info] : [];
  });

  return (
    <div className="screen factions">
      {intel.map((f) => (
        <section key={f.id} className="panel faction">
          <h2>{f.name}</h2>
          {f.description ? <p className="muted">{f.description}</p> : <p className="muted">Кто они — пока неизвестно.</p>}
          <dl className="facts">
            <div>
              <dt>Отношения</dt>
              <dd>{FACTION_RELATION_LABELS[f.relation]}</dd>
            </div>
            <div>
              <dt>Осведомлённость</dt>
              <dd>{AWARENESS_LABELS[f.awareness]}</dd>
            </div>
            <div>
              <dt>Численность</dt>
              <dd>{MANPOWER_LABELS[f.manpower]}</dd>
            </div>
            <div>
              <dt>Ресурсы</dt>
              <dd className="muted">неизвестно</dd>
            </div>
            <div>
              <dt>Известная территория</dt>
              <dd>{f.knownTerritories.length > 0 ? f.knownTerritories.map(districtName).join(', ') : '—'}</dd>
            </div>
            <div>
              <dt>Последняя активность</dt>
              <dd>
                {f.lastKnownActivity
                  ? `${OPERATION_SEEN_LABELS[f.lastKnownActivity.operation]} — ${districtName(f.lastKnownActivity.districtId)}, день ${getDay(f.lastKnownActivity.at)}, ${formatClock(f.lastKnownActivity.at)}`
                  : 'нет данных'}
              </dd>
            </div>
          </dl>
          <h3>Контакты и наблюдения</h3>
          {f.contacts.length === 0 ? (
            <p className="muted">Пока ничего.</p>
          ) : (
            <ol className="log">
              {[...f.contacts].reverse().map((entry) => (
                <li key={entry.id}>
                  <span className="log__time">
                    Д{getDay(entry.at)} {formatClock(entry.at)}
                  </span>{' '}
                  {describeLogEntry(entry, nameOf)}
                </li>
              ))}
            </ol>
          )}
        </section>
      ))}
    </div>
  );
}
