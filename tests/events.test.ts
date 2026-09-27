import { describe, expect, it } from 'vitest';
import { EVENTS } from '@data/events';
import { HERO_ID } from '@data/characters';
import { LEFORTOVO_GROCERY_ID, LEFORTOVO_PHARMACY_ID } from '@data/locations';
import { pickOutcome, type EventDefinition } from '@game/events';
import { EVENT_CHANCE_PERCENT, type Expedition } from '@game/expeditions';
import { applyCommand, isAwaitingDecision, type GameCommand, type GameState } from '@game/gameState';
import { createRngState } from '@game/random';
import { RESOURCE_KINDS } from '@game/resources';
import { HOURS_PER_TURN } from '@game/time';
import type { GameContent } from '@game/world';
import { content, endTurns, newGame } from './helpers';

function run(state: GameState, command: GameCommand, world: GameContent = content): GameState {
  const result = applyCommand(state, command, world);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

function sendHero(seed: number, world: GameContent = content, locationId = LEFORTOVO_PHARMACY_ID) {
  return run(newGame(seed), { type: 'sendExpedition', locationId, memberIds: [HERO_ID] }, world);
}

/** First seed where an event fires on the first turn of a pharmacy trip. */
function seedWithEventOnFirstTurn(): number {
  for (let seed = 0; seed < 1000; seed += 1) {
    const state = run(sendHero(seed), { type: 'endTurn' });
    if (state.expeditions[0]?.pendingEventId) return seed;
  }
  throw new Error('no seed found');
}

function pendingState(seed = seedWithEventOnFirstTurn()): GameState {
  return run(sendHero(seed), { type: 'endTurn' });
}

const expeditionOf = (state: GameState): Expedition => state.expeditions[0]!;

// A controlled event to test every effect type in isolation.
const TEST_EVENT: EventDefinition = {
  id: 'test_event',
  title: 'Тест',
  description: 'Тестовое событие',
  choices: [
    {
      id: 'gain',
      text: 'gain',
      outcomes: [
        { id: 'g', weight: 1, text: '', effects: [{ type: 'resources', delta: { medicine: 3, food: 1 } }] },
      ],
    },
    { id: 'wait', text: 'wait', outcomes: [{ id: 'w', weight: 1, text: '', effects: [{ type: 'delay', turns: 2 }] }] },
    { id: 'abort', text: 'abort', outcomes: [{ id: 'a', weight: 1, text: '', effects: [{ type: 'abort' }] }] },
    {
      id: 'shoot',
      text: 'shoot',
      outcomes: [{ id: 's', weight: 1, text: '', effects: [{ type: 'resources', delta: { ammunition: -2 } }] }],
    },
  ],
};
const testWorld: GameContent = { ...content, events: { [TEST_EVENT.id]: TEST_EVENT } };

/** Hero on a grocery trip, paused on TEST_EVENT right after departure. */
function withTestEvent(seed = 1): GameState {
  const state = sendHero(seed, testWorld, LEFORTOVO_GROCERY_ID);
  const expedition = expeditionOf(state);
  return {
    ...state,
    expeditions: [{ ...expedition, pendingEventId: TEST_EVENT.id, seenEventIds: [TEST_EVENT.id] }],
  };
}

const resolve = (state: GameState, choiceId: string, world = testWorld) =>
  run(state, { type: 'resolveEvent', expeditionId: expeditionOf(state).id, choiceId }, world);

describe('event content', () => {
  it('has at least 5 events with choices and valid outcomes', () => {
    const events = Object.values(EVENTS) as readonly EventDefinition[];
    expect(events.length).toBeGreaterThanOrEqual(5);
    for (const event of events) {
      expect(event.title).not.toBe('');
      expect(event.description).not.toBe('');
      expect(event.choices.length).toBeGreaterThanOrEqual(2);
      for (const choice of event.choices) {
        expect(choice.outcomes.length).toBeGreaterThan(0);
        for (const outcome of choice.outcomes) {
          expect(outcome.weight).toBeGreaterThan(0);
          for (const effect of outcome.effects) {
            if (effect.type === 'resources') {
              for (const kind of Object.keys(effect.delta)) {
                expect(RESOURCE_KINDS).toContain(kind);
              }
            }
          }
        }
      }
    }
  });
});

describe('expedition events', () => {
  it('are deterministic for a seed', () => {
    const seed = seedWithEventOnFirstTurn();
    const a = pendingState(seed);
    const b = pendingState(seed);
    expect(expeditionOf(a).pendingEventId).toBe(expeditionOf(b).pendingEventId);
    const choiceId = content.events[expeditionOf(a).pendingEventId!]!.choices[0]!.id;
    expect(resolve(a, choiceId, content)).toEqual(resolve(b, choiceId, content));
  });

  it(`fire roughly ${EVENT_CHANCE_PERCENT}% of turns`, () => {
    let fired = 0;
    const runs = 400;
    for (let seed = 0; seed < runs; seed += 1) {
      if (expeditionOf(run(sendHero(seed), { type: 'endTurn' })).pendingEventId) fired += 1;
    }
    expect(fired / runs).toBeGreaterThan(0.15);
    expect(fired / runs).toBeLessThan(0.35);
  });

  it('pause the game: turn cannot end until the player decides', () => {
    const state = pendingState();
    expect(isAwaitingDecision(state, content)).toBe(true);
    expect(state.log.at(-1)).toMatchObject({ type: 'expeditionEvent' });
    expect(applyCommand(state, { type: 'endTurn' }, content)).toEqual({ ok: false, error: 'EVENT_PENDING' });
  });

  it('after a choice the expedition continues and eventually returns', () => {
    const state = pendingState();
    const event = content.events[expeditionOf(state).pendingEventId!]!;
    const resolved = resolve(state, event.choices[0]!.id, content);
    expect(expeditionOf(resolved).pendingEventId).toBeNull();
    expect(isAwaitingDecision(resolved, content)).toBe(false);
    expect(resolved.log.at(-1)).toMatchObject({ type: 'eventChoice', eventId: event.id });

    // Keep playing, choosing the first option each time, until the squad is home.
    let current = resolved;
    for (let i = 0; i < 20 && current.expeditions.length > 0; i += 1) {
      const pending = current.expeditions[0]?.pendingEventId;
      current = pending
        ? resolve(current, content.events[pending]!.choices[0]!.id, content)
        : run(current, { type: 'endTurn' });
    }
    expect(current.expeditions).toHaveLength(0);
    expect(current.log.at(-1)).toMatchObject({ type: 'expeditionReturned' });
  });

  it('the same event does not repeat within one expedition', () => {
    const state = withTestEvent();
    const resolved = resolve(state, 'gain');
    const after = endTurns(resolved, 1, testWorld);
    expect(expeditionOf(after).pendingEventId).toBeNull();
  });

  it('resources effect goes into the haul and is delivered on return', () => {
    const state = resolve(withTestEvent(), 'gain');
    expect(expeditionOf(state).haul).toEqual({ medicine: 3, food: 1 });
    const home = endTurns(state, 3, testWorld);
    const returned = home.log.find((e) => e.type === 'expeditionReturned');
    const found = home.log.find((e) => e.type === 'lootFound');
    if (returned?.type !== 'expeditionReturned' || found?.type !== 'lootFound') throw new Error('missing log');
    expect(home.resources.medicine).toBe(state.resources.medicine + 3);
    expect(returned.loot.food).toBe((found.loot.food ?? 0) + 1);
  });

  it('negative resource effects reduce the stock on return', () => {
    const state = resolve(withTestEvent(), 'shoot');
    const home = endTurns(state, 3, testWorld);
    expect(home.resources.ammunition).toBe(state.resources.ammunition - 2);
  });

  it('delay effect pushes the return back', () => {
    const state = withTestEvent();
    const delayed = resolve(state, 'wait');
    expect(expeditionOf(delayed).returnsAt).toBe(expeditionOf(state).returnsAt + 2 * HOURS_PER_TURN);
    expect(endTurns(delayed, 3, testWorld).expeditions).toHaveLength(1);
    expect(endTurns(delayed, 5, testWorld).expeditions).toHaveLength(0);
  });

  it('abort effect: squad returns next turn without location loot', () => {
    const state = resolve(withTestEvent(), 'abort');
    expect(expeditionOf(state).aborted).toBe(true);
    const home = endTurns(state, 1, testWorld);
    expect(home.expeditions).toHaveLength(0);
    expect(home.resources).toEqual(state.resources);
    expect(home.log.some((e) => e.type === 'lootFound')).toBe(false);
    expect(home.log.at(-1)).toMatchObject({ type: 'expeditionReturned', aborted: true });
  });

  it('rejects invalid resolve commands', () => {
    const state = withTestEvent();
    const id = expeditionOf(state).id;
    expect(applyCommand(state, { type: 'resolveEvent', expeditionId: id, choiceId: 'nope' }, testWorld)).toEqual({
      ok: false,
      error: 'UNKNOWN_CHOICE',
    });
    expect(applyCommand(state, { type: 'resolveEvent', expeditionId: 'x', choiceId: 'gain' }, testWorld)).toEqual({
      ok: false,
      error: 'EXPEDITION_NOT_FOUND',
    });
    const resolved = resolve(state, 'gain');
    expect(applyCommand(resolved, { type: 'resolveEvent', expeditionId: id, choiceId: 'gain' }, testWorld)).toEqual({
      ok: false,
      error: 'NO_PENDING_EVENT',
    });
  });

  it('an event unknown to the current content does not block the game', () => {
    const state = withTestEvent();
    expect(isAwaitingDecision(state, content)).toBe(false);
    expect(applyCommand(state, { type: 'endTurn' }, content).ok).toBe(true);
  });
});

describe('weighted outcomes', () => {
  const outcomes = EVENTS.abandoned_bag.choices[0].outcomes;

  it('same RNG state → same outcome', () => {
    const rng = createRngState(5);
    expect(pickOutcome(rng, outcomes)).toEqual(pickOutcome(rng, outcomes));
  });

  it('every outcome is reachable', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 200; seed += 1) seen.add(pickOutcome(createRngState(seed), outcomes).outcome.id);
    expect([...seen].sort()).toEqual(outcomes.map((o) => o.id).sort());
  });

  it('a single outcome does not consume RNG', () => {
    const rng = createRngState(9);
    expect(pickOutcome(rng, EVENTS.abandoned_bag.choices[1].outcomes).rng).toBe(rng);
  });
});
