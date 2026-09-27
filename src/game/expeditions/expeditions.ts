import { findCharacter, isAvailableForSquad, updateCharacters } from '../characters';
import type { Character, CharacterId } from '../characters';
import { pickOutcome, sumResourceEffects } from '../events';
import { addLogEntry, allocateId } from '../gameState/ids';
import type { GameState } from '../gameState/types';
import { nextInt } from '../random';
import { RESOURCE_KINDS, applyResourceDelta } from '../resources';
import type { ResourceDelta, ResourceKind } from '../resources';
import { advanceTurns } from '../time';
import type { GameContent, LocationDefinition, LocationId } from '../world';
import {
  EVENT_CHANCE_PERCENT,
  MAX_SCAVENGING_BONUS_PERCENT,
  MAX_SQUAD_SIZE,
  SCAVENGING_BONUS_PER_POINT_PERCENT,
} from './types';
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
    haul: {},
    pendingEventId: null,
    seenEventIds: [],
    aborted: false,
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

// ---------------------------------------------------------------------------
// Loot
// ---------------------------------------------------------------------------

/** bonus% = min(10 × sum of squad scavenging, 100). See docs/GAME_RULES.md. */
export function getScavengingBonusPercent(members: readonly Character[]): number {
  const total = members.reduce((sum, character) => sum + character.skills.scavenging, 0);
  return Math.min(Math.max(0, total) * SCAVENGING_BONUS_PER_POINT_PERCENT, MAX_SCAVENGING_BONUS_PERCENT);
}

export function applyLootBonus(amount: number, bonusPercent: number): number {
  return Math.floor((amount * (100 + bonusPercent)) / 100);
}

function membersOf(state: GameState, memberIds: readonly CharacterId[]): Character[] {
  return memberIds.flatMap((id) => {
    const character = findCharacter(state.characters, id);
    return character ? [character] : [];
  });
}

/** Rolls the location's loot table with the state's RNG, applying the squad's search bonus. */
export function rollLoot(
  state: GameState,
  location: LocationDefinition,
  bonusPercent = 0,
): { readonly state: GameState; readonly loot: Partial<Record<ResourceKind, number>> } {
  let rng = state.rng;
  const loot: Partial<Record<ResourceKind, number>> = {};
  for (const range of location.loot) {
    if (range.chancePercent !== undefined) {
      const chance = nextInt(rng, 1, 100);
      rng = chance.state;
      if (chance.value > range.chancePercent) continue;
    }
    const roll = nextInt(rng, range.min, range.max);
    rng = roll.state;
    const amount = applyLootBonus(roll.value, bonusPercent);
    loot[range.resource] = (loot[range.resource] ?? 0) + amount;
  }
  return { state: { ...state, rng }, loot };
}

function addDeltas(a: ResourceDelta, b: ResourceDelta): ResourceDelta {
  const result: Partial<Record<ResourceKind, number>> = {};
  for (const kind of RESOURCE_KINDS) {
    const sum = (a[kind] ?? 0) + (b[kind] ?? 0);
    if (a[kind] !== undefined || b[kind] !== undefined) result[kind] = sum;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Return
// ---------------------------------------------------------------------------

function completeExpedition(
  state: GameState,
  content: GameContent,
  expedition: Expedition,
): GameState {
  const location = content.locations[expedition.locationId];
  let next: GameState = state;
  let loot: ResourceDelta = {};
  if (location && !expedition.aborted) {
    const bonus = getScavengingBonusPercent(membersOf(next, expedition.memberIds));
    const rolled = rollLoot(next, location, bonus);
    next = addLogEntry(rolled.state, {
      type: 'lootFound',
      expeditionId: expedition.id,
      locationId: expedition.locationId,
      loot: rolled.loot,
      scavengingBonusPercent: bonus,
    });
    loot = rolled.loot;
  }

  const delivered = addDeltas(loot, expedition.haul);
  const members = new Set(expedition.memberIds);
  next = {
    ...next,
    resources: applyResourceDelta(next.resources, delivered),
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
    loot: delivered,
    aborted: expedition.aborted,
  });
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

function replaceExpedition(state: GameState, expedition: Expedition): GameState {
  return {
    ...state,
    expeditions: state.expeditions.map((e) => (e.id === expedition.id ? expedition : e)),
  };
}

/** Is the expedition waiting on an event the current content knows about? */
export function hasPendingEvent(expedition: Expedition, content: GameContent): boolean {
  return expedition.pendingEventId !== null && content.events[expedition.pendingEventId] !== undefined;
}

/** Rolls whether an event happens this turn and, if so, which one. */
export function rollExpeditionEvent(
  state: GameState,
  content: GameContent,
  expedition: Expedition,
): GameState {
  const candidates = Object.keys(content.events).filter(
    (id) => !expedition.seenEventIds.includes(id),
  );
  if (candidates.length === 0) return state;

  const chance = nextInt(state.rng, 1, 100);
  let next: GameState = { ...state, rng: chance.state };
  if (chance.value > EVENT_CHANCE_PERCENT) return next;

  const pick = nextInt(next.rng, 0, candidates.length - 1);
  const eventId = candidates[pick.value];
  if (eventId === undefined) return next;
  next = replaceExpedition(
    { ...next, rng: pick.state },
    { ...expedition, pendingEventId: eventId, seenEventIds: [...expedition.seenEventIds, eventId] },
  );
  return addLogEntry(next, {
    type: 'expeditionEvent',
    expeditionId: expedition.id,
    locationId: expedition.locationId,
    eventId,
  });
}

export type ResolveEventResult =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly error: ExpeditionError };

/** Applies the player's choice for a paused expedition; the expedition then continues. */
export function resolveExpeditionEvent(
  state: GameState,
  content: GameContent,
  expeditionId: string,
  choiceId: string,
): ResolveEventResult {
  const expedition = state.expeditions.find((e) => e.id === expeditionId);
  if (!expedition) return { ok: false, error: 'EXPEDITION_NOT_FOUND' };
  if (expedition.pendingEventId === null) return { ok: false, error: 'NO_PENDING_EVENT' };

  const event = content.events[expedition.pendingEventId];
  if (!event) {
    // Content changed since the save: drop the stale event instead of blocking the game.
    return { ok: true, state: replaceExpedition(state, { ...expedition, pendingEventId: null }) };
  }
  const choice = event.choices.find((c) => c.id === choiceId);
  if (!choice) return { ok: false, error: 'UNKNOWN_CHOICE' };

  const { outcome, rng } = pickOutcome(state.rng, choice.outcomes);
  let updated: Expedition = {
    ...expedition,
    pendingEventId: null,
    haul: addDeltas(expedition.haul, sumResourceEffects(outcome.effects)),
  };
  for (const effect of outcome.effects) {
    if (effect.type === 'delay') {
      updated = { ...updated, returnsAt: advanceTurns(updated.returnsAt, effect.turns) };
    } else if (effect.type === 'abort') {
      updated = {
        ...updated,
        aborted: true,
        returnsAt: Math.min(updated.returnsAt, advanceTurns(state.time, 1)),
      };
    }
  }

  const next = replaceExpedition({ ...state, rng }, updated);
  return {
    ok: true,
    state: addLogEntry(next, {
      type: 'eventChoice',
      expeditionId,
      eventId: event.id,
      choiceId: choice.id,
      outcomeId: outcome.id,
    }),
  };
}

// ---------------------------------------------------------------------------
// Turn processing
// ---------------------------------------------------------------------------

/**
 * Called once per turn after time advanced: due expeditions return,
 * the rest may run into an event. Processed in departure order.
 */
export function processExpeditions(state: GameState, content: GameContent): GameState {
  return state.expeditions.reduce((current, original) => {
    const expedition = current.expeditions.find((e) => e.id === original.id);
    if (!expedition) return current;
    if (expedition.returnsAt <= current.time) return completeExpedition(current, content, expedition);
    if (hasPendingEvent(expedition, content)) return current;
    return rollExpeditionEvent(current, content, expedition);
  }, state);
}

