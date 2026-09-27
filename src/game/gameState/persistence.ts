import { ATTRIBUTE_IDS, EQUIPMENT_SLOTS, SKILL_IDS } from '../characters';
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
    isRecord(value.haul) &&
    Object.values(value.haul).every(isFiniteNumber) &&
    (value.pendingEventId === null || typeof value.pendingEventId === 'string') &&
    Array.isArray(value.seenEventIds) &&
    value.seenEventIds.every((id) => typeof id === 'string') &&
    typeof value.aborted === 'boolean'
  );
}

/** Structural validation of untrusted save data. */
export function isGameState(value: unknown): value is GameState {
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

const MIGRATIONS: Readonly<Record<number, (save: UnknownRecord) => UnknownRecord>> = {
  1: migrateV1toV2,
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
