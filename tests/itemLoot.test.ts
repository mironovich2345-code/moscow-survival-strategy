import { describe, expect, it } from 'vitest';
import { HERO_ID, MAXIM_ID } from '@data/characters';
import { ITEMS, PM_PISTOL_1, TOURIST_BACKPACK_1 } from '@data/items';
import {
  LEFORTOVO_PARKING_ID,
  LEFORTOVO_PHARMACY_ID,
  LEFORTOVO_POLICE_ID,
} from '@data/locations';
import { takeFoundItems, type Expedition } from '@game/expeditions';
import {
  applyCommand,
  deserializeGame,
  loadGame,
  saveGame,
  type GameCommand,
  type GameState,
} from '@game/gameState';
import {
  ITEM_CATEGORIES,
  adjustSupplyAmount,
  emptySupplies,
  findItemLocation,
  findItemLocationErrors,
  maxSupplyThatFits,
  squadLoad,
  type ItemDefinition,
  type SuppliesRequest,
} from '@game/index';
import type { GameContent } from '@game/world';
import { SAVE_V1, SAVE_V2, SAVE_V3 } from './fixtures/saves';
import { MemoryStorage, content, endTurns, newGame, quietContent } from './helpers';

function run(state: GameState, command: GameCommand): GameState {
  const result = applyCommand(state, command, quietContent);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

function send(
  state: GameState,
  locationId: string,
  memberIds: readonly string[] = [HERO_ID, MAXIM_ID],
  supplies: SuppliesRequest = {},
): GameState {
  return run(state, { type: 'sendExpedition', locationId, memberIds, supplies });
}

const trip = (state: GameState): Expedition => state.expeditions[0]!;
const lootEntry = (state: GameState) => {
  const entry = state.log.find((e) => e.type === 'lootFound');
  if (entry?.type !== 'lootFound') throw new Error('no loot entry');
  return entry;
};

/** Runs a full trip; returns the state at home. */
function fullTrip(seed: number, locationId: string, memberIds?: readonly string[]): GameState {
  const state = send(newGame(seed), locationId, memberIds);
  return endTurns(state, quietContent.locations[locationId]!.expeditionTurns);
}

/** First seed where a police trip brings home at least one unique item. */
function seedWithPoliceItem(): number {
  for (let seed = 0; seed < 500; seed += 1) {
    if (lootEntry(fullTrip(seed, LEFORTOVO_POLICE_ID)).items.length > 0) return seed;
  }
  throw new Error('no seed');
}

describe('item catalogue', () => {
  const defs = Object.values(ITEMS) as readonly ItemDefinition[];

  it('has exactly the 4 starting and 4 new items', () => {
    expect(Object.keys(ITEMS).sort()).toEqual(
      [
        'city_backpack',
        'crowbar',
        'fire_axe',
        'pm_pistol',
        'police_vest',
        'pump_shotgun',
        'tourist_backpack',
        'work_jacket',
      ].sort(),
    );
  });

  it('every item has defId, name, category, weight and slot; weapons have stats', () => {
    for (const def of defs) {
      expect(def.name).not.toBe('');
      expect(ITEM_CATEGORIES).toContain(def.category);
      expect(Number.isInteger(def.weight) && def.weight > 0).toBe(true);
      expect(['sidearm', 'primary', 'melee', 'body', 'backpack']).toContain(def.slot);
      if (def.category === 'firearm' || def.category === 'melee') expect(def.weapon).toBeDefined();
    }
    expect(ITEMS.pump_shotgun.weapon).toEqual({ damage: 8, noise: 9, ammoPerAttack: 1 });
    expect(ITEMS.crowbar.weapon.ammoPerAttack).toBe(0);
    expect(ITEMS.city_backpack.capacityBonus).toBeGreaterThan(0);
  });
});

describe('unique items in location loot', () => {
  it('parking and police only drop their own items; aborted trips drop none', () => {
    const seen: Record<string, Set<string>> = { [LEFORTOVO_PARKING_ID]: new Set(), [LEFORTOVO_POLICE_ID]: new Set() };
    for (const locationId of [LEFORTOVO_PARKING_ID, LEFORTOVO_POLICE_ID]) {
      for (let seed = 0; seed < 150; seed += 1) {
        lootEntry(fullTrip(seed, locationId)).items.forEach((i) => seen[locationId]!.add(i.defId));
      }
    }
    expect([...seen[LEFORTOVO_PARKING_ID]!].sort()).toEqual(['city_backpack', 'crowbar']);
    expect([...seen[LEFORTOVO_POLICE_ID]!].sort()).toEqual(['police_vest', 'pump_shotgun']);
    for (let seed = 0; seed < 40; seed += 1) {
      expect(lootEntry(fullTrip(seed, LEFORTOVO_PHARMACY_ID)).items).toEqual([]);
    }
  });

  it('a found item gets a stable id, lands in storage on return and keeps the id', () => {
    const seed = seedWithPoliceItem();
    const home = fullTrip(seed, LEFORTOVO_POLICE_ID);
    const [found] = lootEntry(home).items;
    expect(found!.id).toMatch(new RegExp(`^${found!.defId}-\\d+$`));
    expect(home.items[found!.id]).toEqual(found);
    expect(home.storage.items).toContain(found!.id);
    expect(findItemLocation(home, found!.id)).toEqual({ type: 'storage' });
    expect(findItemLocationErrors(home)).toEqual([]);
    const returned = home.log.find((e) => e.type === 'expeditionReturned');
    expect(returned?.type === 'expeditionReturned' && returned.items).toContain(found!.id);
    // Same seed → same id.
    expect(lootEntry(fullTrip(seed, LEFORTOVO_POLICE_ID)).items).toEqual(lootEntry(home).items);
  });

  it('the found item can be equipped with the normal system', () => {
    const home = fullTrip(seedWithPoliceItem(), LEFORTOVO_POLICE_ID);
    const [found] = lootEntry(home).items;
    const equipped = run(home, { type: 'moveItem', itemId: found!.id, to: { type: 'character', characterId: HERO_ID } });
    const slot = content.items[found!.defId]!.slot;
    expect(equipped.characters.find((c) => c.id === HERO_ID)!.equipment[slot]).toBe(found!.id);
    expect(equipped.storage.items).not.toContain(found!.id);
    expect(findItemLocationErrors(equipped)).toEqual([]);
  });
});

describe('found items in the haul', () => {
  const onTheRoad = (memberIds: readonly string[] = [HERO_ID, MAXIM_ID], supplies: SuppliesRequest = {}) =>
    send(newGame(5), LEFORTOVO_PHARMACY_ID, memberIds, supplies);

  it('are registered, carried in haulItems and exist in exactly one place', () => {
    const state = onTheRoad();
    const result = takeFoundItems(state, content.items, trip(state), ['pump_shotgun', 'crowbar']);
    const [shotgun, crowbar] = result.taken;
    expect(shotgun!.id).toBe(`pump_shotgun-${state.nextId}`);
    expect(crowbar!.id).toBe(`crowbar-${state.nextId + 1}`);
    expect(trip(result.state).haulItems).toEqual([shotgun!.id, crowbar!.id]);
    expect(findItemLocation(result.state, shotgun!.id)).toEqual({ type: 'expedition', expeditionId: trip(state).id });
    expect(findItemLocationErrors(result.state)).toEqual([]);
  });

  it('cannot be touched until the squad is back', () => {
    const state = onTheRoad([HERO_ID]);
    const { state: carrying, taken } = takeFoundItems(state, content.items, trip(state), ['crowbar']);
    const result = applyCommand(
      carrying,
      { type: 'moveItem', itemId: taken[0]!.id, to: { type: 'storage' } },
      quietContent,
    );
    expect(result).toEqual({ ok: false, error: 'ITEM_UNAVAILABLE' });
  });

  it('take up weight in the squad load', () => {
    const state = onTheRoad();
    const before = squadLoad(state, content.items, trip(state).memberIds, {}, trip(state).haulItems);
    const { state: after } = takeFoundItems(state, content.items, trip(state), ['police_vest']);
    const load = squadLoad(after, content.items, trip(after).memberIds, {}, trip(after).haulItems);
    expect(load.items).toBe(5);
    expect(load.total).toBe(before.total + 5);
  });

  it('an item that does not fit is left behind; nothing else is dropped for it', () => {
    // Hero alone: capacity 10, equipment 3, water 5 → 2 free. Vest (5) does not fit, crowbar (2) does.
    const state = onTheRoad([HERO_ID], { water: 5 });
    const result = takeFoundItems(state, content.items, trip(state), ['police_vest', 'crowbar']);
    expect(result.leftBehind).toEqual(['police_vest']);
    expect(result.taken.map((i) => i.defId)).toEqual(['crowbar']);
    expect(trip(result.state).supplies.water).toBe(5);
    expect(Object.values(result.state.items).some((i) => i.defId === 'police_vest')).toBe(false);
    // Only one id was used (for the crowbar).
    expect(result.state.nextId).toBe(state.nextId + 1);
  });

  it('location items respect capacity at return and are logged as left behind', () => {
    // Hero alone, 7 water → 0 free: every rolled item is left behind.
    let leftCases = 0;
    for (let seed = 0; seed < 120; seed += 1) {
      const state = send(newGame(seed), LEFORTOVO_POLICE_ID, [HERO_ID], { water: 7 });
      const home = endTurns(state, 5);
      const entry = lootEntry(home);
      expect(entry.items).toEqual([]);
      if (entry.itemsLeftBehind.length > 0) leftCases += 1;
      expect(findItemLocationErrors(home)).toEqual([]);
    }
    expect(leftCases).toBeGreaterThan(0);
  });

  it('ids survive save/load mid-expedition and after return', () => {
    const state = onTheRoad();
    const { state: carrying, taken } = takeFoundItems(state, content.items, trip(state), ['city_backpack']);
    const storage = new MemoryStorage();
    saveGame(storage, carrying);
    const loaded = loadGame(storage)!;
    expect(loaded).toEqual(carrying);
    expect(trip(loaded).haulItems).toEqual([taken[0]!.id]);

    const home = endTurns(loaded, 3);
    expect(home.storage.items).toContain(taken[0]!.id);
    saveGame(storage, home);
    expect(loadGame(storage)!.items[taken[0]!.id]).toEqual(taken[0]);
  });

  it('a save where a found item is also in storage is rejected', () => {
    const state = onTheRoad();
    const { state: carrying, taken } = takeFoundItems(state, content.items, trip(state), ['crowbar']);
    const broken: GameState = { ...carrying, storage: { items: [taken[0]!.id] } };
    expect(findItemLocationErrors(broken)).not.toEqual([]);
    expect(deserializeGame(JSON.stringify(broken))).toBeNull();
  });
});

describe('determinism with item loot', () => {
  it('same seed + commands → identical states, including item ids (events on)', () => {
    const play = (seed: number) => {
      let state = run(newGame(seed), {
        type: 'sendExpedition',
        locationId: LEFORTOVO_POLICE_ID,
        memberIds: [HERO_ID, MAXIM_ID],
        supplies: { ammunition: 12, water: 2 },
      });
      for (let i = 0; i < 25 && state.expeditions.length > 0; i += 1) {
        const pending = state.expeditions[0]?.pendingEventId;
        const command: GameCommand = pending
          ? {
              type: 'resolveEvent',
              expeditionId: trip(state).id,
              choiceId: content.events[pending]!.choices.find((c) => c.requires === undefined)!.id,
            }
          : { type: 'endTurn' };
        const result = applyCommand(state, command, content);
        if (!result.ok) throw new Error(result.error);
        state = result.state;
      }
      return state;
    };
    for (const seed of [1, 7, 42, 100]) expect(play(seed)).toEqual(play(seed));
  });
});

describe('save migrations to v4', () => {
  it('v3 → v4: haulItems added, item ids untouched, game plays on', () => {
    const state = deserializeGame(JSON.stringify(SAVE_V3));
    expect(state).not.toBeNull();
    expect(state!.version).toBe(4);
    expect(state!.items).toEqual(SAVE_V3.items);
    expect(state!.storage).toEqual(SAVE_V3.storage);
    expect(trip(state!)).toMatchObject({
      haulItems: [],
      haul: { water: 2 },
      supplies: SAVE_V3.expeditions[0]!.supplies,
      searched: false,
      searchAt: SAVE_V3.expeditions[0]!.returnsAt, // old trips search at return, as in 0.3
    });
    const loot = state!.log.find((e) => e.type === 'lootFound');
    expect(loot).toMatchObject({ items: [], itemsLeftBehind: [] });
    expect(state!.log.find((e) => e.type === 'expeditionReturned')).toMatchObject({ items: [] });

    const home = endTurns(state!, 3);
    expect(home.expeditions).toHaveLength(0);
    expect(findItemLocationErrors(home)).toEqual([]);
    expect(home.storage.items).toContain('work_jacket-1');
  });

  it('v1 and v2 still migrate through the whole chain', () => {
    for (const save of [SAVE_V1, SAVE_V2]) {
      const state = deserializeGame(JSON.stringify(save));
      expect(state?.version).toBe(4);
      expect(state!.expeditions.every((e) => Array.isArray(e.haulItems))).toBe(true);
      expect(state!.items[PM_PISTOL_1]).toBeDefined();
      expect(state!.items[TOURIST_BACKPACK_1]).toBeDefined();
    }
  });
});

describe('ammunition amount controls', () => {
  it('steps never go below 0 or above the stock', () => {
    expect(adjustSupplyAmount(0, -1, 24)).toBe(0);
    expect(adjustSupplyAmount(5, -10, 24)).toBe(0);
    expect(adjustSupplyAmount(20, 10, 24)).toBe(24);
    expect(adjustSupplyAmount(24, 1, 24)).toBe(24);
    expect(adjustSupplyAmount(3, 10, 24)).toBe(13);
    expect(adjustSupplyAmount(0, 10, 0)).toBe(0);
    expect(adjustSupplyAmount(30, 0, 24)).toBe(24); // stock shrank below the chosen amount
  });

  it('MAX = min(stock, what fits into free capacity)', () => {
    const state = newGame();
    const none = emptySupplies();
    // Hero+Maxim: 35 − 8 = 27 free → ammo is light: whole stock (24) fits.
    expect(maxSupplyThatFits(state, content.items, [HERO_ID, MAXIM_ID], none, 'ammunition')).toBe(24);
    // Hero alone with 6 water: 1 free → at most 10 rounds.
    expect(maxSupplyThatFits(state, content.items, [HERO_ID], { ...none, water: 6 }, 'ammunition')).toBe(10);
    // Hero alone with 7 water: nothing fits.
    expect(maxSupplyThatFits(state, content.items, [HERO_ID], { ...none, water: 7 }, 'ammunition')).toBe(0);
    // Nobody selected.
    expect(maxSupplyThatFits(state, content.items, [], none, 'ammunition')).toBe(0);
    // Low stock caps it.
    const poor = { ...state, resources: { ...state.resources, ammunition: 3 } };
    expect(maxSupplyThatFits(poor, content.items, [HERO_ID, MAXIM_ID], none, 'ammunition')).toBe(3);
  });
});

describe('mid-trip search', () => {
  const searchTurns = (locationId: string) => Math.ceil(quietContent.locations[locationId]!.expeditionTurns / 2);

  it('loot and items are in the active expedition haul before it returns, then in storage', () => {
    const seed = seedWithPoliceItem();
    const state = send(newGame(seed), LEFORTOVO_POLICE_ID);
    expect(trip(state).searchAt).toBe(state.time + searchTurns(LEFORTOVO_POLICE_ID) * 2);

    const before = endTurns(state, searchTurns(LEFORTOVO_POLICE_ID) - 1);
    expect(trip(before).searched).toBe(false);
    expect(trip(before).haulItems).toEqual([]);

    const searched = endTurns(before, 1);
    expect(searched.expeditions).toHaveLength(1);
    expect(trip(searched).searched).toBe(true);
    const [found] = trip(searched).haulItems;
    expect(found).toBeDefined();
    expect(findItemLocation(searched, found!)).toEqual({ type: 'expedition', expeditionId: trip(searched).id });
    expect(trip(searched).haul.ammunition ?? 0).toBeGreaterThan(0);

    const home = endTurns(searched, 5);
    expect(home.expeditions).toHaveLength(0);
    expect(home.storage.items).toContain(found);
    expect(home.items[found!]).toEqual(searched.items[found!]);
  });

  it('abort before the search: no location loot; abort after: the haul comes home', () => {
    const TEST: GameContent = {
      ...content,
      events: {
        stop: {
          id: 'stop',
          title: 't',
          description: 't',
          choices: [{ id: 'abort', text: 'a', outcomes: [{ id: 'a', weight: 1, text: '', effects: [{ type: 'abort' }] }] }],
        },
      },
    };
    const pauseAndAbort = (state: GameState) => {
      const paused: GameState = {
        ...state,
        expeditions: [{ ...trip(state), pendingEventId: 'stop', seenEventIds: ['stop'] }],
      };
      const result = applyCommand(paused, { type: 'resolveEvent', expeditionId: trip(state).id, choiceId: 'abort' }, TEST);
      if (!result.ok) throw new Error(result.error);
      return result.state;
    };
    const start = send(newGame(9), LEFORTOVO_POLICE_ID);

    const early = endTurns(pauseAndAbort(start), 1, TEST);
    expect(early.expeditions).toHaveLength(0);
    expect(early.log.some((e) => e.type === 'lootFound')).toBe(false);

    const afterSearch = endTurns(start, searchTurns(LEFORTOVO_POLICE_ID), quietContent);
    const carried = trip(afterSearch).haul;
    const late = endTurns(pauseAndAbort(afterSearch), 1, TEST);
    expect(late.expeditions).toHaveLength(0);
    expect(late.resources.ammunition).toBe(afterSearch.resources.ammunition + (carried.ammunition ?? 0));
  });

  it('a delay before the search pushes the search back too', () => {
    const TEST: GameContent = {
      ...content,
      events: {
        wait: {
          id: 'wait',
          title: 't',
          description: 't',
          choices: [{ id: 'wait', text: 'w', outcomes: [{ id: 'w', weight: 1, text: '', effects: [{ type: 'delay', turns: 2 }] }] }],
        },
      },
    };
    const state = send(newGame(9), LEFORTOVO_POLICE_ID);
    const paused: GameState = {
      ...state,
      expeditions: [{ ...trip(state), pendingEventId: 'wait', seenEventIds: ['wait'] }],
    };
    const result = applyCommand(paused, { type: 'resolveEvent', expeditionId: trip(state).id, choiceId: 'wait' }, TEST);
    if (!result.ok) throw new Error(result.error);
    expect(trip(result.state).searchAt).toBe(trip(state).searchAt + 4);
    expect(trip(result.state).returnsAt).toBe(trip(state).returnsAt + 4);
  });
});
