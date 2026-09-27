import { findCharacter, isAvailableForSquad, updateCharacters } from '../characters';
import type { CharacterId } from '../characters';
import { addLogEntry, allocateId } from '../gameState/ids';
import type { GameState } from '../gameState/types';
import { nextInt } from '../random';
import { applyResourceDelta } from '../resources';
import type { ResourceKind } from '../resources';
import { advanceTurns } from '../time';
import type { GameContent, LocationDefinition, LocationId } from '../world';
import { MAX_SQUAD_SIZE } from './types';
import type { Expedition, ExpeditionError } from './types';

export type ExpeditionResult =
  | { readonly ok: true; readonly state: GameState; readonly expedition: Expedition }
  | { readonly ok: false; readonly error: ExpeditionError };

export function validateSquad(
  state: GameState,
  memberIds: readonly CharacterId[],
): ExpeditionError | null {
  if (memberIds.length === 0) return 'EMPTY_SQUAD';
  if (memberIds.length > MAX_SQUAD_SIZE) return 'SQUAD_TOO_LARGE';
  if (new Set(memberIds).size !== memberIds.length) return 'DUPLICATE_MEMBER';
  for (const id of memberIds) {
    const character = findCharacter(state.characters, id);
    if (!character) return 'CHARACTER_NOT_FOUND';
    if (!isAvailableForSquad(character)) return 'CHARACTER_UNAVAILABLE';
  }
  return null;
}

export function startExpedition(
  state: GameState,
  content: GameContent,
  locationId: LocationId,
  memberIds: readonly CharacterId[],
): ExpeditionResult {
  const location = content.locations[locationId];
  if (!location) return { ok: false, error: 'UNKNOWN_LOCATION' };
  if (location.kind === 'base' || location.expeditionTurns <= 0) {
    return { ok: false, error: 'LOCATION_NOT_EXPLORABLE' };
  }
  const squadError = validateSquad(state, memberIds);
  if (squadError) return { ok: false, error: squadError };

  const [expeditionId, withId] = allocateId(state, 'exp');
  const expedition: Expedition = {
    id: expeditionId,
    locationId,
    memberIds: [...memberIds],
    departedAt: withId.time,
    returnsAt: advanceTurns(withId.time, location.expeditionTurns),
  };

  const members = new Set(memberIds);
  let next: GameState = {
    ...withId,
    expeditions: [...withId.expeditions, expedition],
    characters: updateCharacters(withId.characters, members, (character) => ({
      ...character,
      assignment: { type: 'expedition', expeditionId },
    })),
  };
  next = addLogEntry(next, {
    type: 'expeditionDeparted',
    expeditionId,
    locationId,
    memberIds: expedition.memberIds,
  });
  return { ok: true, state: next, expedition };
}

/** Rolls the location's loot table with the state's RNG. */
export function rollLoot(
  state: GameState,
  location: LocationDefinition,
): { readonly state: GameState; readonly loot: Partial<Record<ResourceKind, number>> } {
  let rng = state.rng;
  const loot: Partial<Record<ResourceKind, number>> = {};
  for (const range of location.loot) {
    const roll = nextInt(rng, range.min, range.max);
    rng = roll.state;
    loot[range.resource] = (loot[range.resource] ?? 0) + roll.value;
  }
  return { state: { ...state, rng }, loot };
}

function completeExpedition(
  state: GameState,
  content: GameContent,
  expedition: Expedition,
): GameState {
  const location = content.locations[expedition.locationId];
  let next: GameState = state;
  let loot: Partial<Record<ResourceKind, number>> = {};
  if (location) {
    const rolled = rollLoot(next, location);
    next = rolled.state;
    loot = rolled.loot;
  }

  const members = new Set(expedition.memberIds);
  next = {
    ...next,
    resources: applyResourceDelta(next.resources, loot),
    expeditions: next.expeditions.filter((e) => e.id !== expedition.id),
    characters: updateCharacters(next.characters, members, (character) => ({
      ...character,
      assignment: { type: 'base' },
    })),
  };
  return addLogEntry(next, {
    type: 'expeditionReturned',
    expeditionId: expedition.id,
    locationId: expedition.locationId,
    memberIds: expedition.memberIds,
    loot,
  });
}

/** Resolves every expedition whose return time has come, in departure order. */
export function resolveDueExpeditions(state: GameState, content: GameContent): GameState {
  const due = state.expeditions.filter((expedition) => expedition.returnsAt <= state.time);
  return due.reduce((current, expedition) => completeExpedition(current, content, expedition), state);
}
