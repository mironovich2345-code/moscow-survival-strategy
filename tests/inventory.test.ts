import { describe, expect, it } from 'vitest';
import { HERO_ID, MAXIM_ID } from '@data/characters';
import { FIRE_AXE_1, PM_PISTOL_1, TOURIST_BACKPACK_1, WORK_JACKET_1 } from '@data/items';
import { LEFORTOVO_PHARMACY_ID } from '@data/locations';
import {
  BASE_CARRY_CAPACITY,
  carryCapacity,
  equipmentWeight,
  findItemLocation,
  findItemLocationErrors,
  resourceWeight,
  squadLoad,
  type MoveItemTarget,
} from '@game/inventory';
import { applyCommand, type CommandResult, type GameState } from '@game/gameState';
import { content, newGame, quietContent } from './helpers';

const move = (state: GameState, itemId: string, to: MoveItemTarget): CommandResult =>
  applyCommand(state, { type: 'moveItem', itemId, to }, content);

function mustMove(state: GameState, itemId: string, to: MoveItemTarget): GameState {
  const result = move(state, itemId, to);
  if (!result.ok) throw new Error(result.error);
  expect(findItemLocationErrors(result.state)).toEqual([]);
  return result.state;
}

const toStorage: MoveItemTarget = { type: 'storage' };
const toChar = (characterId: string): MoveItemTarget => ({ type: 'character', characterId });
const char = (state: GameState, id: string) => state.characters.find((c) => c.id === id)!;

describe('starting items', () => {
  it('four unique items with stable ids, all equipped, storage empty', () => {
    const state = newGame();
    expect(Object.keys(state.items).sort()).toEqual(
      [FIRE_AXE_1, PM_PISTOL_1, TOURIST_BACKPACK_1, WORK_JACKET_1].sort(),
    );
    expect(state.storage.items).toEqual([]);
    expect(char(state, HERO_ID).equipment).toEqual({
      sidearm: PM_PISTOL_1,
      primary: null,
      melee: null,
      body: WORK_JACKET_1,
      backpack: null,
    });
    expect(char(state, MAXIM_ID).equipment).toEqual({
      sidearm: null,
      primary: null,
      melee: FIRE_AXE_1,
      body: null,
      backpack: TOURIST_BACKPACK_1,
    });
    expect(findItemLocationErrors(state)).toEqual([]);
  });

  it('ids are the same in every new game', () => {
    expect(Object.keys(newGame(1).items)).toEqual(Object.keys(newGame(999).items));
  });
});

describe('moving items', () => {
  it('unequip: item goes to storage and the slot is empty', () => {
    const state = mustMove(newGame(), PM_PISTOL_1, toStorage);
    expect(char(state, HERO_ID).equipment.sidearm).toBeNull();
    expect(state.storage.items).toEqual([PM_PISTOL_1]);
    expect(findItemLocation(state, PM_PISTOL_1)).toEqual({ type: 'storage' });
  });

  it('equip from storage into the slot of the item type', () => {
    let state = mustMove(newGame(), FIRE_AXE_1, toStorage);
    state = mustMove(state, FIRE_AXE_1, toChar(HERO_ID));
    expect(char(state, HERO_ID).equipment.melee).toBe(FIRE_AXE_1);
    expect(char(state, MAXIM_ID).equipment.melee).toBeNull();
    expect(state.storage.items).toEqual([]);
  });

  it('hand over to another character directly', () => {
    const state = mustMove(newGame(), TOURIST_BACKPACK_1, toChar(HERO_ID));
    expect(char(state, HERO_ID).equipment.backpack).toBe(TOURIST_BACKPACK_1);
    expect(char(state, MAXIM_ID).equipment.backpack).toBeNull();
    expect(findItemLocation(state, TOURIST_BACKPACK_1)).toEqual({
      type: 'character',
      characterId: HERO_ID,
      slot: 'backpack',
    });
  });

  it('an item already in the target slot is displaced to storage', () => {
    // Give Maxim a second jacket situation: move hero's jacket to Maxim, then back a different way.
    let state = mustMove(newGame(), WORK_JACKET_1, toChar(MAXIM_ID));
    const extra: GameState = {
      ...state,
      items: { ...state.items, 'work_jacket-2': { id: 'work_jacket-2', defId: 'work_jacket' } },
      storage: { items: ['work_jacket-2'] },
    };
    state = mustMove(extra, 'work_jacket-2', toChar(MAXIM_ID));
    expect(char(state, MAXIM_ID).equipment.body).toBe('work_jacket-2');
    expect(state.storage.items).toEqual([WORK_JACKET_1]);
  });

  it('an item is always in exactly one place, whatever the sequence', () => {
    let state = newGame();
    const steps: [string, MoveItemTarget][] = [
      [PM_PISTOL_1, toChar(MAXIM_ID)],
      [FIRE_AXE_1, toChar(HERO_ID)],
      [TOURIST_BACKPACK_1, toStorage],
      [TOURIST_BACKPACK_1, toChar(HERO_ID)],
      [WORK_JACKET_1, toChar(MAXIM_ID)],
      [PM_PISTOL_1, toStorage],
      [PM_PISTOL_1, toChar(HERO_ID)],
    ];
    for (const [id, to] of steps) state = mustMove(state, id, to);
    const places = [
      ...state.storage.items,
      ...state.characters.flatMap((c) => Object.values(c.equipment).filter((x) => x !== null)),
    ];
    expect(places.sort()).toEqual(Object.keys(state.items).sort());
  });

  it('rejects impossible moves', () => {
    const state = newGame();
    expect(move(state, 'nope', toStorage)).toEqual({ ok: false, error: 'ITEM_NOT_FOUND' });
    expect(move(state, PM_PISTOL_1, toChar(HERO_ID))).toEqual({ ok: false, error: 'ITEM_ALREADY_THERE' });
    expect(move(state, PM_PISTOL_1, toChar('ghost'))).toEqual({ ok: false, error: 'CHARACTER_NOT_FOUND' });
    const stored = mustMove(state, PM_PISTOL_1, toStorage);
    expect(move(stored, PM_PISTOL_1, toStorage)).toEqual({ ok: false, error: 'ITEM_ALREADY_THERE' });
  });

  it('items of a character on an expedition cannot be touched, nor can they receive items', () => {
    const sent = applyCommand(
      mustMove(newGame(), PM_PISTOL_1, toStorage),
      { type: 'sendExpedition', locationId: LEFORTOVO_PHARMACY_ID, memberIds: [MAXIM_ID] },
      quietContent,
    );
    if (!sent.ok) throw new Error(sent.error);
    expect(move(sent.state, FIRE_AXE_1, toStorage)).toEqual({ ok: false, error: 'ITEM_UNAVAILABLE' });
    expect(move(sent.state, FIRE_AXE_1, toChar(HERO_ID))).toEqual({ ok: false, error: 'ITEM_UNAVAILABLE' });
    expect(move(sent.state, PM_PISTOL_1, toChar(MAXIM_ID))).toEqual({
      ok: false,
      error: 'CHARACTER_UNAVAILABLE',
    });
  });

  it('does not mutate the input state', () => {
    const state = newGame();
    const snapshot = JSON.stringify(state);
    mustMove(state, PM_PISTOL_1, toChar(MAXIM_ID));
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe('weight and carry capacity', () => {
  it('resource weight: 1 per unit, ammunition 1 per started 10', () => {
    expect(resourceWeight({ food: 2, water: 1, medicine: 1 })).toBe(4);
    expect(resourceWeight({ ammunition: 1 })).toBe(1);
    expect(resourceWeight({ ammunition: 10 })).toBe(1);
    expect(resourceWeight({ ammunition: 12 })).toBe(2);
    expect(resourceWeight({ fuel: 3, materials: 2 })).toBe(5);
    expect(resourceWeight({ food: -5 })).toBe(0);
  });

  it('starting capacity and equipment weight', () => {
    const state = newGame();
    const hero = char(state, HERO_ID);
    const maxim = char(state, MAXIM_ID);
    expect(carryCapacity(hero, state.items, content.items)).toBe(BASE_CARRY_CAPACITY);
    expect(equipmentWeight(hero, state.items, content.items)).toBe(3); // ПМ 1 + куртка 2
    expect(carryCapacity(maxim, state.items, content.items)).toBe(BASE_CARRY_CAPACITY + 15);
    expect(equipmentWeight(maxim, state.items, content.items)).toBe(5); // топор 3 + рюкзак 2
  });

  it('the backpack raises capacity of whoever wears it', () => {
    const state = mustMove(newGame(), TOURIST_BACKPACK_1, toChar(HERO_ID));
    expect(carryCapacity(char(state, HERO_ID), state.items, content.items)).toBe(25);
    expect(carryCapacity(char(state, MAXIM_ID), state.items, content.items)).toBe(10);
  });

  it('squad load = equipment + carried resources, capacity = sum', () => {
    const load = squadLoad(newGame(), content.items, [HERO_ID, MAXIM_ID], { water: 2, ammunition: 12 });
    expect(load).toEqual({ equipment: 8, items: 0, resources: 4, total: 12, capacity: 35 });
  });
});
