import { useState } from 'react';
import { choiceBlocker, findCharacter, type Expedition } from '@game/index';
import { ERROR_LABELS, formatAmounts } from '../labels';
import { GAME_CONTENT } from '@data/content';
import { useGameStore } from '../store/gameStore';

interface ShownResult {
  readonly title: string;
  readonly choiceText: string;
  readonly outcomeText: string;
}

/**
 * Blocking dialog: while an expedition waits for a decision the player must
 * pick a choice. After the choice the outcome is shown until dismissed.
 */
export function EventDialog() {
  const game = useGameStore((s) => s.game);
  const expeditions = game.expeditions;
  const characters = useGameStore((s) => s.game.characters);
  const dispatch = useGameStore((s) => s.dispatch);
  const [result, setResult] = useState<ShownResult | null>(null);

  const pending: Expedition | undefined = expeditions.find(
    (e) => e.pendingEventId !== null && GAME_CONTENT.events[e.pendingEventId] !== undefined,
  );

  if (result) {
    return (
      <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="event-title">
        <section className="panel dialog">
          <h2 id="event-title">{result.title}</h2>
          <p className="muted">Решение: {result.choiceText}</p>
          <p>{result.outcomeText}</p>
          <button type="button" className="primary" onClick={() => setResult(null)}>
            Продолжить
          </button>
        </section>
      </div>
    );
  }

  if (!pending?.pendingEventId) return null;
  const event = GAME_CONTENT.events[pending.pendingEventId];
  if (!event) return null;

  const location = GAME_CONTENT.locations[pending.locationId];
  const names = pending.memberIds.map((id) => findCharacter(characters, id)?.name ?? id).join(', ');

  const choose = (choiceId: string) => {
    if (!dispatch({ type: 'resolveEvent', expeditionId: pending.id, choiceId })) return;
    const entry = [...useGameStore.getState().game.log]
      .reverse()
      .find((e) => e.type === 'eventChoice' && e.expeditionId === pending.id);
    const choice = event.choices.find((c) => c.id === choiceId);
    const outcome =
      entry?.type === 'eventChoice' ? choice?.outcomes.find((o) => o.id === entry.outcomeId) : undefined;
    setResult({
      title: event.title,
      choiceText: choice?.text ?? choiceId,
      outcomeText: outcome?.text ?? '',
    });
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="event-title">
      <section className="panel dialog">
        <p className="muted">
          {location?.name ?? pending.locationId} · {names}
        </p>
        <h2 id="event-title">
          {event.kind === 'story' && <span className="tag">сюжет</span>} {event.title}
        </h2>
        <p>{event.description}</p>
        <p className="muted small">
          Припасы отряда: {formatAmounts(pending.supplies)}
          {Object.keys(pending.haul).length > 0 && <> · найдено: {formatAmounts(pending.haul)}</>}
        </p>
        <div className="dialog__choices">
          {event.choices.map((choice) => {
            const blocker = choiceBlocker(game, GAME_CONTENT, pending, choice);
            return (
              <button key={choice.id} type="button" disabled={blocker !== null} onClick={() => choose(choice.id)}>
                {choice.text}
                {choice.requires && (
                  <span className="muted small"> (нужно: {formatAmounts(choice.requires)})</span>
                )}
                {blocker && blocker !== 'CHOICE_UNAVAILABLE' && (
                  <span className="muted small"> — {ERROR_LABELS[blocker]}</span>
                )}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
