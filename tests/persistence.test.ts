import { describe, expect, it } from 'vitest';
import { HERO_ID, MAXIM_ID } from '@data/characters';
import { PM_PISTOL_1 } from '@data/items';
import { LEFORTOVO_PHARMACY_ID } from '@data/locations';
import {
  GAME_STATE_VERSION,
  SAVE_KEY,
  type GameState,
  type StorageLike,
  applyCommand,
  clearSave,
  deserializeGame,
  endTurn,
  loadGame,
  saveGame,
} from '@game/gameState';
import { SAVE_V1, SAVE_V2 } from './fixtures/saves';
import { MemoryStorage, content, endTurns, newGame, quietContent } from './helpers';

describe('persistence', () => {
  it('returns null when there is no save', () => {
    expect(loadGame(new MemoryStorage())).toBeNull();
  });

  it('round-trips a game with an active expedition', () => {
    const storage = new MemoryStorage();
    const result = applyCommand(
      newGame(3),
      { type: 'sendExpedition', locationId: LEFORTOVO_PHARMACY_ID, memberIds: [HERO_ID] },
      content,
    );
    if (!result.ok) throw new Error(result.error);
    const state = endTurn(result.state, content);

    saveGame(storage, state);
    const loaded = loadGame(storage);
    expect(loaded).toEqual(state);
  });

  it('a loaded game continues exactly like the original (RNG state is saved)', () => {
    const storage = new MemoryStorage();
    const result = applyCommand(
      newGame(11),
      { type: 'sendExpedition', locationId: LEFORTOVO_PHARMACY_ID, memberIds: [HERO_ID] },
      content,
    );
    if (!result.ok) throw new Error(result.error);
    saveGame(storage, result.state);

    const finish = (s: typeof result.state) => endTurn(endTurn(endTurn(s, content), content), content);
    const loaded = loadGame(storage);
    expect(loaded).not.toBeNull();
    expect(finish(loaded!)).toEqual(finish(result.state));
  });

  it('rejects corrupt or incompatible data', () => {
    expect(deserializeGame('not json')).toBeNull();
    expect(deserializeGame('{}')).toBeNull();
    expect(deserializeGame(JSON.stringify({ ...newGame(), version: 999 }))).toBeNull();
    expect(deserializeGame(JSON.stringify({ ...newGame(), resources: { food: 1 } }))).toBeNull();
  });

  it('clears the save', () => {
    const storage = new MemoryStorage();
    saveGame(storage, newGame());
    expect(storage.getItem(SAVE_KEY)).not.toBeNull();
    clearSave(storage);
    expect(loadGame(storage)).toBeNull();
  });
});

describe('save format v3', () => {
  function midExpedition(seed = 3): GameState {
    const result = applyCommand(
      newGame(seed),
      {
        type: 'sendExpedition',
        locationId: LEFORTOVO_PHARMACY_ID,
        memberIds: [HERO_ID, MAXIM_ID],
        supplies: { water: 2, ammunition: 12, medicine: 1 },
      },
      quietContent,
    );
    if (!result.ok) throw new Error(result.error);
    return result.state;
  }

  it('saves the current version', () => {
    const storage = new MemoryStorage();
    saveGame(storage, newGame());
    expect(GAME_STATE_VERSION).toBe(3);
    expect(JSON.parse(storage.getItem(SAVE_KEY)!)).toMatchObject({ version: 3 });
  });

  it('round-trips items, storage, equipment, supplies, haul, pending event and hunger', () => {
    let state = midExpedition();
    const [trip] = state.expeditions;
    state = {
      ...state,
      expeditions: [
        { ...trip!, pendingEventId: 'locked_door', seenEventIds: ['locked_door'], haul: { water: 2 } },
      ],
      characters: state.characters.map((c) => ({ ...c, condition: { ...c.condition, hungry: true } })),
    };
    // Put something into storage too.
    const withStorage: GameState = {
      ...state,
      items: { ...state.items, 'fire_axe-2': { id: 'fire_axe-2', defId: 'fire_axe' } },
      storage: { items: ['fire_axe-2'] },
    };

    const storage = new MemoryStorage();
    saveGame(storage, withStorage);
    expect(loadGame(storage)).toEqual(withStorage);
  });

  it('rejects a save where one item is in two places', () => {
    const state = newGame();
    const broken: GameState = { ...state, storage: { items: [PM_PISTOL_1] } }; // also on the hero
    expect(deserializeGame(JSON.stringify(broken))).toBeNull();
    const orphan: GameState = {
      ...state,
      items: { ...state.items, 'x-1': { id: 'x-1', defId: 'fire_axe' } },
    };
    expect(deserializeGame(JSON.stringify(orphan))).toBeNull();
  });

  it('migrates a 0.2 (v2) save', () => {
    const migrated = deserializeGame(JSON.stringify(SAVE_V2));
    expect(migrated).not.toBeNull();
    const state = migrated!;

    // Items became instances in the new slots.
    expect(state.items).toEqual({
      'pm_pistol-1': { id: 'pm_pistol-1', defId: 'pm_pistol' },
      'work_jacket-1': { id: 'work_jacket-1', defId: 'work_jacket' },
      'fire_axe-1': { id: 'fire_axe-1', defId: 'fire_axe' },
      'tourist_backpack-1': { id: 'tourist_backpack-1', defId: 'tourist_backpack' },
    });
    expect(state.storage.items).toEqual([]);
    const hero = state.characters.find((c) => c.id === HERO_ID)!;
    const maxim = state.characters.find((c) => c.id === MAXIM_ID)!;
    expect(hero.equipment).toEqual({
      sidearm: 'pm_pistol-1',
      primary: null,
      melee: null,
      body: 'work_jacket-1',
      backpack: null,
    });
    expect(maxim.equipment).toMatchObject({ melee: 'fire_axe-1', backpack: 'tourist_backpack-1' });
    expect(maxim.condition.hungry).toBe(true);

    // Expedition: empty supplies, only positive haul; the 0.2 ammo cost is charged now.
    expect(state.expeditions[0]).toMatchObject({
      supplies: { food: 0, water: 0, medicine: 0, ammunition: 0 },
      haul: { water: 2 },
      pendingEventId: 'locked_door',
    });
    expect(state.resources.ammunition).toBe(SAVE_V2.resources.ammunition - 2);

    // Old log entries got the new fields.
    const byType = (type: string) => state.log.find((e) => e.type === type);
    expect(byType('dailyConsumption')).toMatchObject({ expeditionId: null });
    expect(byType('expeditionDeparted')).toMatchObject({ supplies: {} });
    expect(byType('eventChoice')).toMatchObject({ spent: {}, gained: {}, leftBehind: {} });
    expect(byType('expeditionReturned')).toMatchObject({ suppliesReturned: {} });
  });

  it('a migrated v2 game plays on: event, return, loot', () => {
    let state = deserializeGame(JSON.stringify(SAVE_V2))!;
    const resolved = applyCommand(
      state,
      { type: 'resolveEvent', expeditionId: 'exp-5', choiceId: 'leave' },
      content,
    );
    if (!resolved.ok) throw new Error(resolved.error);
    state = endTurns(resolved.state, 2, quietContent);
    expect(state.expeditions).toHaveLength(0);
    expect(state.resources.water).toBe(SAVE_V2.resources.water + 2);
    expect(state.resources.ammunition).toBeGreaterThan(SAVE_V2.resources.ammunition - 2);
  });

  it('migrates a 0.1 (v1) save through v2 to v3', () => {
    const state = deserializeGame(JSON.stringify(SAVE_V1));
    expect(state).not.toBeNull();
    expect(state!.version).toBe(3);
    expect(state!.expeditions[0]).toMatchObject({ supplies: { food: 0 }, haul: {}, aborted: false });
    const home = endTurns(state!, 2);
    expect(home.expeditions).toHaveLength(0);
    expect(home.resources.medicine).toBeGreaterThan(SAVE_V1.resources.medicine);
  });

  it('never throws on broken storage', () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    };
    expect(loadGame(broken)).toBeNull();

    const storage = new MemoryStorage();
    for (const junk of ['', 'null', '[]', '{"version":1}', '{"version":2}', '{"version":"3"}', '{"version":0}']) {
      storage.setItem(SAVE_KEY, junk);
      expect(loadGame(storage)).toBeNull();
    }
  });
});
