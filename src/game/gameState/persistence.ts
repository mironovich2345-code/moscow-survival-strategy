import { ATTRIBUTE_IDS, EQUIPMENT_SLOTS, SKILL_IDS } from '../characters';
import { SUPPLY_KINDS, findItemLocationErrors } from '../inventory';
import { RESOURCE_KINDS } from '../resources';
import { GAME_STATE_VERSION } from './types';
import type { GameState } from './types';

/** Minimal subset of the Web Storage API, so tests can pass an in-memory store. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const SAVE_KEY = 'moscow-survival:save';

export function serializeGame(state: GameState): string {
  return JSON.stringify(state);
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasNumberFields(value: unknown, keys: readonly string[]): boolean {
  return isRecord(value) && keys.every((key) => isFiniteNumber(value[key]));
}

function isCharacter(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const { assignment, equipment, condition } = value;
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.isHero === 'boolean' &&
    hasNumberFields(value.attributes, ATTRIBUTE_IDS) &&
    hasNumberFields(value.skills, SKILL_IDS) &&
    hasNumberFields(condition, ['health', 'maxHealth']) &&
    isRecord(condition) &&
    typeof condition.hungry === 'boolean' &&
    typeof condition.thirsty === 'boolean' &&
    isRecord(equipment) &&
    EQUIPMENT_SLOTS.every((slot) => equipment[slot] === null || typeof equipment[slot] === 'string') &&
    isRecord(assignment) &&
    (assignment.type === 'base' ||
      assignment.type === 'dead' ||
      (assignment.type === 'expedition' && typeof assignment.expeditionId === 'string'))
  );
}

function isExpedition(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.locationId === 'string' &&
    Array.isArray(value.memberIds) &&
    value.memberIds.every((id) => typeof id === 'string') &&
    isFiniteNumber(value.departedAt) &&
    isFiniteNumber(value.returnsAt) &&
    hasNumberFields(value.supplies, SUPPLY_KINDS) &&
    isRecord(value.haul) &&
    Object.values(value.haul).every(isFiniteNumber) &&
    Array.isArray(value.haulItems) &&
    isFiniteNumber(value.searchAt) &&
    typeof value.searched === 'boolean' &&
    value.haulItems.every((id) => typeof id === 'string') &&
    isStringArray(value.lostItems) &&
    (value.pendingEventId === null || typeof value.pendingEventId === 'string') &&
    Array.isArray(value.seenEventIds) &&
    value.seenEventIds.every((id) => typeof id === 'string') &&
    typeof value.aborted === 'boolean'
  );
}

function isStringArray(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isLostItem(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.itemId === 'string' &&
    typeof value.locationId === 'string' &&
    isFiniteNumber(value.at)
  );
}

const COMBAT_STATUSES = ['setup', 'active', 'victory', 'retreated', 'defeat'];

function isCombatEnemy(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    value.typeId === 'infected' &&
    isFiniteNumber(value.number) &&
    isFiniteNumber(value.health) &&
    isFiniteNumber(value.maxHealth)
  );
}

/** A saved fight: null, or a structurally sound CombatState. */
function isCombat(value: unknown): boolean {
  if (value === null) return true;
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.expeditionId === 'string' &&
    typeof value.locationId === 'string' &&
    isFiniteNumber(value.startedAt) &&
    isFiniteNumber(value.round) &&
    typeof value.status === 'string' &&
    COMBAT_STATUSES.includes(value.status) &&
    isRecord(value.positions) &&
    Object.values(value.positions).every((line) => line === 'front' || line === 'back') &&
    Array.isArray(value.enemies) &&
    value.enemies.every(isCombatEnemy) &&
    isRecord(value.selectedActions) &&
    Object.values(value.selectedActions).every((action) => isRecord(action) && typeof action.type === 'string') &&
    isStringArray(value.defending) &&
    isFiniteNumber(value.combatNoise) &&
    isFiniteNumber(value.reinforcementCount) &&
    isFiniteNumber(value.nextEnemyNumber) &&
    isStringArray(value.fallen) &&
    Array.isArray(value.log)
  );
}

function isItemRegistry(value: unknown): boolean {
  return (
    isRecord(value) &&
    Object.entries(value).every(
      ([key, item]) => isRecord(item) && item.id === key && typeof item.defId === 'string',
    )
  );
}

function isStorage(value: unknown): boolean {
  return isRecord(value) && Array.isArray(value.items) && value.items.every((id) => typeof id === 'string');
}

/**
 * Validation of untrusted save data: structure first, then the invariant
 * that every unique item is in exactly one place.
 */
export function isGameState(value: unknown): value is GameState {
  return isStructurallyValid(value) && findItemLocationErrors(value).length === 0;
}

function isStructurallyValid(value: unknown): value is GameState {
  return (
    isRecord(value) &&
    value.version === GAME_STATE_VERSION &&
    isFiniteNumber(value.seed) &&
    isFiniteNumber(value.rng) &&
    isFiniteNumber(value.time) &&
    isFiniteNumber(value.turn) &&
    isFiniteNumber(value.nextId) &&
    typeof value.baseLocationId === 'string' &&
    hasNumberFields(value.resources, RESOURCE_KINDS) &&
    isItemRegistry(value.items) &&
    isStorage(value.storage) &&
    Array.isArray(value.lostItems) &&
    value.lostItems.every(isLostItem) &&
    isCombat(value.combat) &&
    Array.isArray(value.characters) &&
    value.characters.every(isCharacter) &&
    Array.isArray(value.expeditions) &&
    value.expeditions.every(isExpedition) &&
    Array.isArray(value.log)
  );
}

// ---------------------------------------------------------------------------
// Migrations. Each step takes the raw object of version N and returns N + 1.
// Steps must be defensive: input is untrusted and may be partially broken.
// ---------------------------------------------------------------------------

function mapArray(value: unknown, fn: (item: UnknownRecord) => UnknownRecord): unknown {
  return Array.isArray(value) ? value.map((item) => (isRecord(item) ? fn(item) : item)) : value;
}

/** v1 → v2: hunger/thirst flags, expedition events & haul, `aborted` on return logs. */
function migrateV1toV2(save: UnknownRecord): UnknownRecord {
  return {
    ...save,
    version: 2,
    characters: mapArray(save.characters, (character) => ({
      ...character,
      condition: isRecord(character.condition)
        ? { hungry: false, thirsty: false, ...character.condition }
        : character.condition,
    })),
    expeditions: mapArray(save.expeditions, (expedition) => ({
      haul: {},
      pendingEventId: null,
      seenEventIds: [],
      aborted: false,
      ...expedition,
    })),
    log: mapArray(save.log, (entry) =>
      entry.type === 'expeditionReturned' ? { aborted: false, ...entry } : entry,
    ),
  };
}

/** Where the four items that existed in 0.1/0.2 go in the new slot layout. Frozen history. */
const V2_ITEM_SLOTS: Readonly<Record<string, string>> = {
  pm_pistol: 'sidearm',
  fire_axe: 'melee',
  work_jacket: 'body',
  tourist_backpack: 'backpack',
};
const V2_FALLBACK_SLOTS: Readonly<Record<string, string>> = {
  weapon: 'primary',
  armor: 'body',
  backpack: 'backpack',
};

/** Fills missing fields of old log entries with empty values. */
function migrateLogEntryV2toV3(entry: UnknownRecord): UnknownRecord {
  switch (entry.type) {
    case 'expeditionDeparted':
      return { supplies: {}, ...entry };
    case 'eventChoice':
      return { spent: {}, gained: {}, leftBehind: {}, ...entry };
    case 'lootFound':
      return { leftBehind: {}, ...entry };
    case 'expeditionReturned':
      return { suppliesReturned: {}, ...entry };
    case 'dailyConsumption':
    case 'shortage':
      return { expeditionId: null, ...entry };
    default:
      return entry;
  }
}

/**
 * v2 → v3: item instances + storage, new equipment slots, expedition supplies.
 * Negative v2 haul (costs that 0.2 charged on return) is charged to the base now.
 */
function migrateV2toV3(save: UnknownRecord): UnknownRecord {
  const items: Record<string, { id: string; defId: string }> = {};
  const storage: string[] = [];
  const newItem = (defId: string): string => {
    let n = 1;
    while (items[`${defId}-${n}`]) n += 1;
    const id = `${defId}-${n}`;
    items[id] = { id, defId };
    return id;
  };

  const characters = mapArray(save.characters, (character) => {
    const old = isRecord(character.equipment) ? character.equipment : {};
    const equipment: Record<string, string | null> = Object.fromEntries(
      EQUIPMENT_SLOTS.map((slot) => [slot, null]),
    );
    for (const oldSlot of ['weapon', 'armor', 'backpack']) {
      const defId = old[oldSlot];
      if (typeof defId !== 'string') continue;
      const id = newItem(defId);
      const slot = V2_ITEM_SLOTS[defId] ?? V2_FALLBACK_SLOTS[oldSlot] ?? 'primary';
      if (equipment[slot] === null) equipment[slot] = id;
      else storage.push(id);
    }
    return { ...character, equipment };
  });

  const resources: Record<string, unknown> = isRecord(save.resources) ? { ...save.resources } : {};
  const expeditions = mapArray(save.expeditions, (expedition) => {
    const haul: Record<string, number> = {};
    if (isRecord(expedition.haul)) {
      for (const [kind, amount] of Object.entries(expedition.haul)) {
        if (!isFiniteNumber(amount)) continue;
        if (amount > 0) haul[kind] = amount;
        const stock = resources[kind];
        if (amount < 0 && isFiniteNumber(stock)) resources[kind] = Math.max(0, stock + amount);
      }
    }
    return { ...expedition, supplies: { food: 0, water: 0, medicine: 0, ammunition: 0 }, haul };
  });

  return {
    ...save,
    version: 3,
    resources,
    items,
    storage: { items: storage },
    characters,
    expeditions,
    log: mapArray(save.log, migrateLogEntryV2toV3),
  };
}

/** v3 → v4: found unique items in the haul; item fields on loot/return log entries. */
function migrateV3toV4(save: UnknownRecord): UnknownRecord {
  return {
    ...save,
    version: 4,
    // Old trips search at return, as they did in 0.3.
    expeditions: mapArray(save.expeditions, (expedition) => ({
      haulItems: [],
      searched: false,
      searchAt: expedition.returnsAt,
      ...expedition,
    })),
    log: mapArray(save.log, (entry) => {
      if (entry.type === 'lootFound') return { items: [], itemsLeftBehind: [], ...entry };
      if (entry.type === 'expeditionReturned') return { items: [], ...entry };
      return entry;
    }),
  };
}

/** v4 → v5: combat, items lost in the world, fallen members' items per expedition. */
function migrateV4toV5(save: UnknownRecord): UnknownRecord {
  return {
    ...save,
    version: 5,
    combat: null,
    lostItems: [],
    expeditions: mapArray(save.expeditions, (expedition) => ({ lostItems: [], ...expedition })),
    log: mapArray(save.log, (entry) =>
      entry.type === 'expeditionReturned' ? { itemsLost: [], ...entry } : entry,
    ),
  };
}

const MIGRATIONS: Readonly<Record<number, (save: UnknownRecord) => UnknownRecord>> = {
  1: migrateV1toV2,
  2: migrateV2toV3,
  3: migrateV3toV4,
  4: migrateV4toV5,
};

/** Brings an old save up to GAME_STATE_VERSION and validates it. Null if impossible. */
export function migrateSave(data: unknown): GameState | null {
  if (!isRecord(data) || !isFiniteNumber(data.version)) return null;
  let current: UnknownRecord = data;
  while (isFiniteNumber(current.version) && current.version < GAME_STATE_VERSION) {
    const step = MIGRATIONS[current.version];
    if (!step) return null;
    current = step(current);
  }
  return isGameState(current) ? current : null;
}

export function deserializeGame(raw: string): GameState | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return migrateSave(parsed);
  } catch {
    return null;
  }
}

export function saveGame(storage: StorageLike, state: GameState): void {
  storage.setItem(SAVE_KEY, serializeGame(state));
}

/** Returns the saved game, or null if there is none or it is corrupt/outdated. */
export function loadGame(storage: StorageLike): GameState | null {
  try {
    const raw = storage.getItem(SAVE_KEY);
    return raw === null ? null : deserializeGame(raw);
  } catch {
    return null;
  }
}

export function clearSave(storage: StorageLike): void {
  storage.removeItem(SAVE_KEY);
}
