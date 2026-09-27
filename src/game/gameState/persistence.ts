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
    isFiniteNumber(value.returnsAt)
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

export function deserializeGame(raw: string): GameState | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return isGameState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveGame(storage: StorageLike, state: GameState): void {
  storage.setItem(SAVE_KEY, serializeGame(state));
}

/** Returns the saved game, or null if there is none or it is corrupt/outdated. */
export function loadGame(storage: StorageLike): GameState | null {
  const raw = storage.getItem(SAVE_KEY);
  return raw === null ? null : deserializeGame(raw);
}

export function clearSave(storage: StorageLike): void {
  storage.removeItem(SAVE_KEY);
}
