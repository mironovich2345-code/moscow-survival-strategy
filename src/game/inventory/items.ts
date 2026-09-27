import { EQUIPMENT_SLOTS, findCharacter, isAvailableForSquad } from '../characters';
import type { Character, CharacterId, EquipmentSlot, ItemInstanceId } from '../characters';
import type { GameState } from '../gameState/types';
import type { ItemCatalog } from './weight';
import type { ItemLocation } from './types';

export type ItemError =
  | 'ITEM_NOT_FOUND'
  | 'ITEM_UNAVAILABLE'
  | 'CHARACTER_NOT_FOUND'
  | 'CHARACTER_UNAVAILABLE'
  | 'ITEM_ALREADY_THERE';

export type MoveItemTarget =
  | { readonly type: 'storage' }
  | { readonly type: 'character'; readonly characterId: CharacterId };

export type MoveItemResult =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly error: ItemError };

/** Finds where an item is, or undefined if it is nowhere (should never happen in a valid state). */
export function findItemLocation(state: GameState, itemId: ItemInstanceId): ItemLocation | undefined {
  if (state.storage.items.includes(itemId)) return { type: 'storage' };
  for (const character of state.characters) {
    for (const slot of EQUIPMENT_SLOTS) {
      if (character.equipment[slot] === itemId) {
        return { type: 'character', characterId: character.id, slot };
      }
    }
  }
  const expedition = state.expeditions.find((e) => e.haulItems.includes(itemId));
  if (expedition) return { type: 'expedition', expeditionId: expedition.id };
  const fallen = state.expeditions.find((e) => e.lostItems.includes(itemId));
  if (fallen) return { type: 'fallen', expeditionId: fallen.id };
  const lost = state.lostItems.find((l) => l.itemId === itemId);
  if (lost) return { type: 'world', locationId: lost.locationId };
  return undefined;
}

/**
 * Checks the core invariant: every registered item is in exactly one place
 * (storage, one equipment slot, the haul or the fallen's items of one active
 * expedition, or lost in the world),
 * and every referenced id is registered. Returns human-readable problems.
 */
export function findItemLocationErrors(state: GameState): string[] {
  const errors: string[] = [];
  const places = new Map<string, number>();
  const count = (id: string) => places.set(id, (places.get(id) ?? 0) + 1);
  state.storage.items.forEach(count);
  for (const character of state.characters) {
    for (const slot of EQUIPMENT_SLOTS) {
      const id = character.equipment[slot];
      if (id !== null) count(id);
    }
  }
  for (const expedition of state.expeditions) {
    expedition.haulItems.forEach(count);
    expedition.lostItems.forEach(count);
  }
  state.lostItems.forEach((lost) => count(lost.itemId));
  for (const [id, n] of places) {
    if (!state.items[id]) errors.push(`unknown item ${id}`);
    if (n > 1) errors.push(`item ${id} is in ${n} places`);
  }
  for (const id of Object.keys(state.items)) {
    if (!places.has(id)) errors.push(`item ${id} is nowhere`);
  }
  return errors;
}

/** Items can only be handed between people who are at the base and alive. */
function canHandle(character: Character): boolean {
  return isAvailableForSquad(character);
}

function setSlot(
  characters: readonly Character[],
  characterId: CharacterId,
  slot: EquipmentSlot,
  itemId: ItemInstanceId | null,
): readonly Character[] {
  return characters.map((c) =>
    c.id === characterId ? { ...c, equipment: { ...c.equipment, [slot]: itemId } } : c,
  );
}

/**
 * Moves a unique item: equip from storage, unequip to storage, or hand over
 * to another character. An item already in the target slot goes to storage.
 */
export function moveItem(
  state: GameState,
  catalog: ItemCatalog,
  itemId: ItemInstanceId,
  target: MoveItemTarget,
): MoveItemResult {
  const instance = state.items[itemId];
  const definition = instance ? catalog[instance.defId] : undefined;
  const from = findItemLocation(state, itemId);
  if (!instance || !definition || !from) return { ok: false, error: 'ITEM_NOT_FOUND' };
  // Found items stay with the squad until it is back; lost items are gone.
  if (from.type !== 'storage' && from.type !== 'character') return { ok: false, error: 'ITEM_UNAVAILABLE' };

  if (from.type === 'character') {
    const owner = findCharacter(state.characters, from.characterId);
    if (!owner || !canHandle(owner)) return { ok: false, error: 'ITEM_UNAVAILABLE' };
  }

  let characters = state.characters;
  let storageItems = state.storage.items;

  if (target.type === 'storage') {
    if (from.type === 'storage') return { ok: false, error: 'ITEM_ALREADY_THERE' };
    characters = setSlot(characters, from.characterId, from.slot, null);
    storageItems = [...storageItems, itemId];
    return { ok: true, state: { ...state, characters, storage: { items: storageItems } } };
  }

  const receiver = findCharacter(state.characters, target.characterId);
  if (!receiver) return { ok: false, error: 'CHARACTER_NOT_FOUND' };
  if (!canHandle(receiver)) return { ok: false, error: 'CHARACTER_UNAVAILABLE' };
  if (from.type === 'character' && from.characterId === receiver.id) {
    return { ok: false, error: 'ITEM_ALREADY_THERE' };
  }

  // 1. Take the item from where it is.
  if (from.type === 'storage') {
    storageItems = storageItems.filter((id) => id !== itemId);
  } else {
    characters = setSlot(characters, from.characterId, from.slot, null);
  }
  // 2. Whatever the receiver wore in that slot goes to storage.
  const displaced = receiver.equipment[definition.slot];
  if (displaced !== null) storageItems = [...storageItems, displaced];
  // 3. Equip.
  characters = setSlot(characters, receiver.id, definition.slot, itemId);

  return { ok: true, state: { ...state, characters, storage: { items: storageItems } } };
}
