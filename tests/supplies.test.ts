import { describe, expect, it } from 'vitest';
import { HERO_ID, MAXIM_ID } from '@data/characters';
import { EVENTS } from '@data/events';
import { TOURIST_BACKPACK_1 } from '@data/items';
import {
  LEFORTOVO_GROCERY_ID,
  LEFORTOVO_PARKING_ID,
  LEFORTOVO_PHARMACY_ID,
} from '@data/locations';
import type { EventDefinition } from '@game/events';
import { spendFromExpedition, type Expedition, type SuppliesRequest } from '@game/expeditions';
import {
  applyCommand,
  type CommandResult,
  type GameCommand,
  type GameState,
} from '@game/gameState';
import { toGameHour } from '@game/time';
import type { GameContent } from '@game/world';
import { content, endTurns, newGame, quietContent } from './helpers';

function run(state: GameState, command: GameCommand, world: GameContent = quietContent): GameState {
  const result = applyCommand(state, command, world);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

function send(
  state: GameState,
  memberIds: readonly string[],
  supplies: SuppliesRequest,
  locationId = LEFORTOVO_PHARMACY_ID,
  world: GameContent = quietContent,
): CommandResult {
  return applyCommand(state, { type: 'sendExpedition', locationId, memberIds, supplies }, world);
}

function mustSend(
  state: GameState,
  memberIds: readonly string[],
  supplies: SuppliesRequest,
  locationId = LEFORTOVO_PHARMACY_ID,
  world: GameContent = quietContent,
): GameState {
  const result = send(state, memberIds, supplies, locationId, world);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

const trip = (state: GameState): Expedition => state.expeditions[0]!;
const logOf = <T extends GameState['log'][number]['type']>(state: GameState, type: T) =>
  state.log.filter((e): e is Extract<GameState['log'][number], { type: T }> => e.type === type);

const COSTLY: EventDefinition = {
  id: 'costly',
  title: 'test',
  description: 'test',
  choices: [
    { id: 'shoot', text: 'shoot', outcomes: [{ id: 's', weight: 1, text: '', effects: [{ type: 'resources', delta: { ammunition: -2 } }] }] },
    { id: 'guarded', text: 'guarded', requires: { ammunition: 2 }, outcomes: [{ id: 'g', weight: 1, text: '', effects: [] }] },
    { id: 'jackpot', text: 'jackpot', outcomes: [{ id: 'j', weight: 1, text: '', effects: [{ type: 'resources', delta: { water: 40, medicine: 3 } }] }] },
    { id: 'heal', text: 'heal', outcomes: [{ id: 'h', weight: 1, text: '', effects: [{ type: 'resources', delta: { medicine: -1, food: 2 } }] }] },
  ],
};
const costlyWorld: GameContent = { ...content, events: { costly: COSTLY } };

/** Squad on a pharmacy trip, paused on COSTLY. */
function paused(memberIds: readonly string[], supplies: SuppliesRequest): GameState {
  const state = mustSend(newGame(3), memberIds, supplies, LEFORTOVO_PHARMACY_ID, costlyWorld);
  return {
    ...state,
    expeditions: [{ ...trip(state), pendingEventId: 'costly', seenEventIds: ['costly'] }],
  };
}
const choose = (state: GameState, choiceId: string) =>
  applyCommand(state, { type: 'resolveEvent', expeditionId: trip(state).id, choiceId }, costlyWorld);
const mustChoose = (state: GameState, choiceId: string) => {
  const result = choose(state, choiceId);
  if (!result.ok) throw new Error(result.error);
  return result.state;
};

describe('departure with supplies', () => {
  it('supplies leave the base immediately and sit in the expedition', () => {
    const start = newGame();
    const state = mustSend(start, [HERO_ID, MAXIM_ID], { water: 2, medicine: 1, ammunition: 12 });
    expect(trip(state).supplies).toEqual({ food: 0, water: 2, medicine: 1, ammunition: 12 });
    expect(state.resources.water).toBe(start.resources.water - 2);
    expect(state.resources.medicine).toBe(start.resources.medicine - 1);
    expect(state.resources.ammunition).toBe(start.resources.ammunition - 12);
    expect(state.resources.food).toBe(start.resources.food);
    expect(logOf(state, 'expeditionDeparted')[0]?.supplies).toEqual({ water: 2, medicine: 1, ammunition: 12 });
  });

  it('the base cannot use what the squad took', () => {
    const start = newGame();
    const state = mustSend(start, [MAXIM_ID], { medicine: start.resources.medicine });
    expect(state.resources.medicine).toBe(0);
    expect(send(state, [HERO_ID], { medicine: 1 })).toEqual({ ok: false, error: 'NOT_ENOUGH_SUPPLIES' });
  });

  it('cannot take more than the base has, or invalid amounts', () => {
    const start = newGame();
    expect(send(start, [HERO_ID], { medicine: start.resources.medicine + 1 })).toEqual({
      ok: false,
      error: 'NOT_ENOUGH_SUPPLIES',
    });
    expect(send(start, [HERO_ID], { water: -1 })).toEqual({ ok: false, error: 'INVALID_SUPPLIES' });
    expect(send(start, [HERO_ID], { water: 1.5 })).toEqual({ ok: false, error: 'INVALID_SUPPLIES' });
  });

  it('an overloaded squad cannot leave; nothing changes', () => {
    const start = newGame();
    // Hero: capacity 10, equipment 3 → 7 free.
    expect(send(start, [HERO_ID], { water: 7 }).ok).toBe(true);
    expect(send(start, [HERO_ID], { water: 8 })).toEqual({ ok: false, error: 'OVERLOADED' });
    // With the backpack the same load fits.
    const packed = run(start, { type: 'moveItem', itemId: TOURIST_BACKPACK_1, to: { type: 'character', characterId: HERO_ID } });
    expect(send(packed, [HERO_ID], { water: 8 }).ok).toBe(true);
  });
});

describe('events use the squad supplies', () => {
  it('ammunition is spent immediately from the expedition, not from the base', () => {
    const state = paused([HERO_ID], { ammunition: 12 });
    const after = mustChoose(state, 'shoot');
    expect(trip(after).supplies.ammunition).toBe(10);
    expect(after.resources.ammunition).toBe(state.resources.ammunition);
    expect(logOf(after, 'eventChoice').at(-1)).toMatchObject({ spent: { ammunition: 2 } });
  });

  it('shortage is handled: spend what there is, never below zero', () => {
    const after = mustChoose(paused([HERO_ID], { ammunition: 1 }), 'shoot');
    expect(trip(after).supplies.ammunition).toBe(0);
    expect(logOf(after, 'eventChoice').at(-1)).toMatchObject({ spent: { ammunition: 1 } });
  });

  it('a choice with an unmet requirement is unavailable', () => {
    expect(choose(paused([HERO_ID], { ammunition: 1 }), 'guarded')).toEqual({
      ok: false,
      error: 'CHOICE_UNAVAILABLE',
    });
    expect(choose(paused([HERO_ID], { ammunition: 2 }), 'guarded').ok).toBe(true);
  });

  it('the real «Застрелить» needs 2 ammunition', () => {
    const shoot = EVENTS.lone_infected.choices.find((c) => c.id === 'shoot');
    expect(shoot && 'requires' in shoot ? shoot.requires : undefined).toEqual({ ammunition: 2 });
    for (const event of Object.values(EVENTS) as readonly EventDefinition[]) {
      expect(event.choices.some((c) => c.requires === undefined)).toBe(true);
    }
  });

  it('finds go to the haul, limited by free capacity; the rest is left behind', () => {
    // Hero alone: 10 capacity, 3 equipment, 1 water supply → 6 free.
    const after = mustChoose(paused([HERO_ID], { water: 1 }), 'jackpot');
    expect(trip(after).haul).toEqual({ water: 6 });
    const entry = logOf(after, 'eventChoice').at(-1);
    expect(entry).toMatchObject({ gained: { water: 6 }, leftBehind: { water: 34, medicine: 3 } });
  });

  it('spending before finding frees room', () => {
    const after = mustChoose(paused([HERO_ID], { medicine: 1 }), 'heal');
    expect(trip(after).supplies.medicine).toBe(0);
    expect(trip(after).haul).toEqual({ food: 2 });
  });

  it('spending uses supplies first, then haul', () => {
    const expedition: Expedition = {
      ...trip(paused([HERO_ID], { water: 1 })),
      haul: { water: 3 },
    };
    const result = spendFromExpedition(expedition, { water: 2 });
    expect(result.expedition.supplies.water).toBe(0);
    expect(result.expedition.haul).toEqual({ water: 2 });
    expect(result.spent).toEqual({ water: 2 });
    expect(result.missing).toEqual({});
    expect(spendFromExpedition(expedition, { water: 9 }).missing).toEqual({ water: 5 });
  });
});

describe('return', () => {
  it('leftover supplies, haul and loot go to storage; equipment stays on people', () => {
    const start = newGame(4);
    let state = mustSend(start, [HERO_ID, MAXIM_ID], { water: 2, ammunition: 12 }, LEFORTOVO_PHARMACY_ID, costlyWorld);
    state = {
      ...state,
      expeditions: [{ ...trip(state), pendingEventId: 'costly', seenEventIds: ['costly'] }],
    };
    state = mustChoose(state, 'shoot'); // −2 ammo from supplies
    const equipmentBefore = state.characters.map((c) => c.equipment);
    const home = endTurns(state, 3, costlyWorld);

    expect(home.expeditions).toHaveLength(0);
    const found = logOf(home, 'lootFound')[0]!;
    const returned = logOf(home, 'expeditionReturned')[0]!;
    expect(returned.suppliesReturned).toEqual({ water: 2, ammunition: 10 });
    expect(home.resources.water).toBe(start.resources.water);
    expect(home.resources.ammunition).toBe(start.resources.ammunition - 2);
    expect(home.resources.medicine).toBe(start.resources.medicine + (found.loot.medicine ?? 0));
    expect(returned.loot).toEqual({ water: 2, ammunition: 10, ...found.loot });
    expect(home.characters.map((c) => c.equipment)).toEqual(equipmentBefore);
    expect(home.characters.every((c) => c.assignment.type === 'base')).toBe(true);
  });

  it('location loot is limited by free capacity', () => {
    // Hero alone at the grocery, carrying 7 water: 0 free → finds nothing, all left behind.
    const state = mustSend(newGame(2), [HERO_ID], { water: 7 }, LEFORTOVO_GROCERY_ID);
    const home = endTurns(state, 3);
    const found = logOf(home, 'lootFound')[0]!;
    expect(found.loot).toEqual({});
    expect((found.leftBehind.food ?? 0) + (found.leftBehind.water ?? 0)).toBeGreaterThan(0);
  });

  it('loot fills in loot-table order', () => {
    // Hero alone, 2 water → 5 free. Parking: fuel first, then materials.
    let overflowCases = 0;
    for (let seed = 0; seed < 40; seed += 1) {
      const home = endTurns(mustSend(newGame(seed), [HERO_ID], { water: 2 }, LEFORTOVO_PARKING_ID), 4);
      const found = logOf(home, 'lootFound')[0]!;
      expect((found.loot.fuel ?? 0) + (found.loot.materials ?? 0)).toBeLessThanOrEqual(5);
      if ((found.leftBehind.fuel ?? 0) > 0) {
        overflowCases += 1;
        expect(found.loot).toEqual({ fuel: 5 });
      }
    }
    expect(overflowCases).toBeGreaterThan(0);
  });
});

describe('daily rations away from the base', () => {
  function nightTrip(supplies: SuppliesRequest, memberIds = [HERO_ID, MAXIM_ID]): GameState {
    const start = { ...newGame(), time: toGameHour(10, 22) };
    return mustSend(start, memberIds, supplies);
  }
  const flags = (state: GameState, id: string) => {
    const c = state.characters.find((x) => x.id === id)!;
    return { hungry: c.condition.hungry, thirsty: c.condition.thirsty };
  };

  it('the squad eats from its supplies at midnight, the base stock is untouched', () => {
    const state = nightTrip({ food: 2, water: 2 });
    const after = endTurns(state, 1);
    expect(trip(after).supplies).toMatchObject({ food: 0, water: 0 });
    expect(after.resources.food).toBe(state.resources.food);
    expect(after.resources.water).toBe(state.resources.water);
    expect(flags(after, HERO_ID)).toEqual({ hungry: false, thirsty: false });
    expect(logOf(after, 'dailyConsumption').at(-1)).toMatchObject({
      expeditionId: trip(after).id,
      aliveCount: 2,
      consumed: { food: 2, water: 2 },
    });
  });

  it('without supplies the squad goes hungry and thirsty even if the base is full', () => {
    const after = endTurns(nightTrip({}), 1);
    expect(flags(after, HERO_ID)).toEqual({ hungry: true, thirsty: true });
    expect(flags(after, MAXIM_ID)).toEqual({ hungry: true, thirsty: true });
    const shortages = logOf(after, 'shortage');
    expect(shortages.map((s) => s.resource).sort()).toEqual(['food', 'water']);
    expect(shortages.every((s) => s.expeditionId === trip(after).id)).toBe(true);
  });

  it('partial supplies: roster order, hero first', () => {
    const after = endTurns(nightTrip({ food: 1, water: 2 }), 1);
    expect(flags(after, HERO_ID)).toEqual({ hungry: false, thirsty: false });
    expect(flags(after, MAXIM_ID)).toEqual({ hungry: true, thirsty: false });
  });

  it('base and expedition are fed separately in the same night', () => {
    const state = nightTrip({ food: 1, water: 1 }, [MAXIM_ID]);
    const after = endTurns(state, 1);
    expect(after.resources.food).toBe(state.resources.food - 1); // hero at base
    expect(trip(after).supplies.food).toBe(0); // Maxim on the road
    expect(logOf(after, 'dailyConsumption').map((e) => e.expeditionId)).toEqual([null, trip(after).id]);
  });
});

describe('determinism after 0.3 changes', () => {
  it('same seed + same commands → identical state, with events on', () => {
    const play = (seed: number) => {
      let state = mustSend(newGame(seed), [HERO_ID, MAXIM_ID], { water: 2, food: 2, ammunition: 12 }, LEFORTOVO_PHARMACY_ID, content);
      for (let i = 0; i < 20 && state.expeditions.length > 0; i += 1) {
        const pending = state.expeditions[0]?.pendingEventId;
        if (pending) {
          const choice = content.events[pending]!.choices.find((c) => c.requires === undefined)!;
          state = run(state, { type: 'resolveEvent', expeditionId: trip(state).id, choiceId: choice.id }, content);
        } else {
          state = run(state, { type: 'endTurn' }, content);
        }
      }
      return state;
    };
    for (const seed of [1, 2, 3, 10, 42]) expect(play(seed)).toEqual(play(seed));
    expect(play(1)).not.toEqual(play(2));
  });
});
