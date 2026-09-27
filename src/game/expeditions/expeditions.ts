import { findCharacter, isAvailableForSquad, updateCharacters } from '../characters';
import type { Character, CharacterId } from '../characters';
import { startCombat } from '../combat/combat';
import { setFlag } from '../story/flags';
import { recruitCharacter, checkRecruitment, setRecruitStatus } from '../story/recruitment';
import { changeTrust } from '../story/relations';
import { activeStoryTrigger } from '../story/triggers';
import type { RecruitError } from '../story/types';
import type { EventChoice } from '../events';
import { pickOutcome } from '../events';
import type { EventEffect } from '../events';
import { SUPPLY_KINDS, emptySupplies, squadLoad } from '../inventory';
import type { ItemDefId, Supplies } from '../inventory';
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
import {
  addDeltas,
  addFindingsToHaul,
  carriesAtLeast,
  compactDelta,
  fitFindings,
  spendFromExpedition,
  takeFoundItems,
} from './cargo';

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

export type SuppliesRequest = Readonly<Partial<Supplies>>;

function normalizeSupplies(request: SuppliesRequest): Supplies | null {
  const supplies: Record<(typeof SUPPLY_KINDS)[number], number> = { ...emptySupplies() };
  for (const kind of SUPPLY_KINDS) {
    const amount = request[kind] ?? 0;
    if (!Number.isInteger(amount) || amount < 0) return null;
    supplies[kind] = amount;
  }
  return supplies;
}

/** Validates squad + supplies + capacity without changing anything. */
export function validateExpedition(
  state: GameState,
  content: GameContent,
  locationId: LocationId,
  memberIds: readonly CharacterId[],
  request: SuppliesRequest = {},
): ExpeditionError | null {
  const location = content.locations[locationId];
  if (!location) return 'UNKNOWN_LOCATION';
  if (location.kind === 'base' || location.expeditionTurns <= 0) return 'LOCATION_NOT_EXPLORABLE';
  const squadError = validateSquad(state, memberIds);
  if (squadError) return squadError;
  // While a story trigger is active here, its required members must go.
  const trigger = activeStoryTrigger(state, content, locationId);
  if (trigger && trigger.requiredMemberIds.some((id) => !memberIds.includes(id))) {
    return 'REQUIRED_MEMBER_MISSING';
  }
  const supplies = normalizeSupplies(request);
  if (!supplies) return 'INVALID_SUPPLIES';
  if (SUPPLY_KINDS.some((kind) => supplies[kind] > state.resources[kind])) return 'NOT_ENOUGH_SUPPLIES';
  const load = squadLoad(state, content.items, memberIds, supplies);
  if (load.total > load.capacity) return 'OVERLOADED';
  return null;
}

export function startExpedition(
  state: GameState,
  content: GameContent,
  locationId: LocationId,
  memberIds: readonly CharacterId[],
  request: SuppliesRequest = {},
): ExpeditionResult {
  const error = validateExpedition(state, content, locationId, memberIds, request);
  const location = content.locations[locationId];
  const supplies = normalizeSupplies(request);
  if (error || !location || !supplies) return { ok: false, error: error ?? 'UNKNOWN_LOCATION' };

  const [expeditionId, withId] = allocateId(state, 'exp');
  const expedition: Expedition = {
    id: expeditionId,
    locationId,
    memberIds: [...memberIds],
    departedAt: withId.time,
    returnsAt: advanceTurns(withId.time, location.expeditionTurns),
    searchAt: advanceTurns(withId.time, Math.ceil(location.expeditionTurns / 2)),
    searched: false,
    supplies,
    haul: {},
    haulItems: [],
    lostItems: [],
    pendingEventId: null,
    seenEventIds: [],
    aborted: false,
  };

  const members = new Set(memberIds);
  let next: GameState = {
    ...withId,
    // Supplies leave the base immediately.
    resources: applyResourceDelta(withId.resources, {
      food: -supplies.food,
      water: -supplies.water,
      medicine: -supplies.medicine,
      ammunition: -supplies.ammunition,
    }),
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
    supplies: compactDelta(supplies),
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

/** Rolls the location's unique-item table: one `nextInt(1, 100) ≤ chance` per entry, in order. */
export function rollItemLoot(
  state: GameState,
  location: LocationDefinition,
): { readonly state: GameState; readonly defIds: readonly ItemDefId[] } {
  let rng = state.rng;
  const defIds: ItemDefId[] = [];
  for (const entry of location.itemLoot ?? []) {
    const roll = nextInt(rng, 1, 100);
    rng = roll.state;
    if (roll.value <= entry.chancePercent) defIds.push(entry.defId);
  }
  return { state: { ...state, rng }, defIds };
}

// ---------------------------------------------------------------------------
// Return
// ---------------------------------------------------------------------------

/**
 * Mid-trip search of the location: resources (table order), then unique
 * items, all capacity-limited, straight into the haul. See GAME_RULES «Обыск локации».
 */
function searchLocation(state: GameState, content: GameContent, expedition: Expedition): GameState {
  const searchedExpedition: Expedition = { ...expedition, searched: true };
  const location = content.locations[expedition.locationId];
  if (!location || expedition.aborted) return replaceExpedition(state, searchedExpedition);

  const bonus = getScavengingBonusPercent(membersOf(state, expedition.memberIds));
  // 1. Resources (table order, capacity-limited).
  const rolled = rollLoot(state, location, bonus);
  const order = location.loot.map((range) => range.resource);
  const fit = fitFindings(rolled.state, content.items, expedition, rolled.loot, order);
  const withLoot: Expedition = {
    ...searchedExpedition,
    haul: compactDelta(addDeltas(expedition.haul, fit.accepted)),
  };
  // 2. Unique items, in whatever capacity is left after the resources.
  const itemRoll = rollItemLoot(rolled.state, location);
  const picked = takeFoundItems(
    replaceExpedition(itemRoll.state, withLoot),
    content.items,
    withLoot,
    itemRoll.defIds,
  );
  return addLogEntry(picked.state, {
    type: 'lootFound',
    expeditionId: expedition.id,
    locationId: expedition.locationId,
    loot: fit.accepted,
    scavengingBonusPercent: bonus,
    leftBehind: fit.leftBehind,
    items: picked.taken,
    itemsLeftBehind: picked.leftBehind,
  });
}

/** The squad is home: supplies left + haul → base stock, found items → storage (same ids). */
function completeExpedition(state: GameState, expedition: Expedition): GameState {
  const suppliesReturned = compactDelta(expedition.supplies);
  const delivered = compactDelta(addDeltas(suppliesReturned, expedition.haul));
  const members = new Set(expedition.memberIds);
  const next: GameState = {
    ...state,
    resources: applyResourceDelta(state.resources, delivered),
    storage: { items: [...state.storage.items, ...expedition.haulItems] },
    // Fallen members' items nobody picked up stay in the location.
    lostItems: [
      ...state.lostItems,
      ...expedition.lostItems.map((itemId) => ({ itemId, locationId: expedition.locationId, at: state.time })),
    ],
    expeditions: state.expeditions.filter((e) => e.id !== expedition.id),
    characters: updateCharacters(state.characters, members, (character) => ({
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
    suppliesReturned,
    items: expedition.haulItems,
    itemsLost: expedition.lostItems,
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
  // Story events never come from the random pool.
  const candidates = Object.values(content.events)
    .filter((event) => event.kind !== 'story' && !expedition.seenEventIds.includes(event.id))
    .map((event) => event.id);
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
    story: false,
  });
}

/** Splits resource effects into costs (negative) and finds (positive), both as positive deltas. */
function splitResourceEffects(effects: readonly EventEffect[]): {
  readonly costs: ResourceDelta;
  readonly finds: ResourceDelta;
} {
  const costs: Partial<Record<ResourceKind, number>> = {};
  const finds: Partial<Record<ResourceKind, number>> = {};
  for (const effect of effects) {
    if (effect.type !== 'resources') continue;
    for (const kind of RESOURCE_KINDS) {
      const amount = effect.delta[kind] ?? 0;
      if (amount < 0) costs[kind] = (costs[kind] ?? 0) - amount;
      if (amount > 0) finds[kind] = (finds[kind] ?? 0) + amount;
    }
  }
  return { costs, finds };
}

/**
 * Why this choice cannot be picked right now (null = it can): missing supplies
 * for `requires`, or an unmet recruitment condition for a `recruit` effect.
 */
export function choiceBlocker(
  state: GameState,
  content: GameContent,
  expedition: Expedition,
  choice: EventChoice,
): ExpeditionError | RecruitError | null {
  if (choice.requires && !carriesAtLeast(expedition, choice.requires)) return 'CHOICE_UNAVAILABLE';
  for (const outcome of choice.outcomes) {
    for (const effect of outcome.effects) {
      if (effect.type === 'recruit') {
        const error = checkRecruitment(state, content, effect.recruitId, expedition.id);
        if (error) return error;
      }
    }
  }
  return null;
}

export type ResolveEventResult =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly error: ExpeditionError | RecruitError };

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
  if (state.combat) return { ok: false, error: 'COMBAT_ACTIVE' };
  const blocker = choiceBlocker(state, content, expedition, choice);
  if (blocker) return { ok: false, error: blocker };

  const { outcome, rng } = pickOutcome(state.rng, choice.outcomes);
  const { costs, finds } = splitResourceEffects(outcome.effects);
  // Costs are paid immediately from the squad's supplies (then haul).
  const paid = spendFromExpedition({ ...expedition, pendingEventId: null }, costs);
  // Finds go to the haul, as far as capacity allows.
  const found = addFindingsToHaul(state, content.items, paid.expedition, finds);
  let updated: Expedition = found.expedition;
  for (const effect of outcome.effects) {
    if (effect.type === 'delay') {
      updated = {
        ...updated,
        returnsAt: advanceTurns(updated.returnsAt, effect.turns),
        // Before the search, the search is pushed back too.
        searchAt: updated.searched ? updated.searchAt : advanceTurns(updated.searchAt, effect.turns),
      };
    } else if (effect.type === 'abort') {
      updated = {
        ...updated,
        aborted: true,
        returnsAt: Math.min(updated.returnsAt, advanceTurns(state.time, 1)),
      };
    }
  }

  let next = replaceExpedition({ ...state, rng }, updated);
  next = addLogEntry(next, {
    type: 'eventChoice',
    expeditionId,
    eventId: event.id,
    choiceId: choice.id,
    outcomeId: outcome.id,
    spent: paid.spent,
    gained: found.accepted,
    leftBehind: found.leftBehind,
  });
  // Story effects, in the order they are listed.
  for (const effect of outcome.effects) {
    switch (effect.type) {
      case 'setFlag':
        next = setFlag(next, effect.flag, effect.value);
        break;
      case 'trust': {
        next = changeTrust(next, content, effect.characterId, effect.delta);
        next = addLogEntry(next, {
          type: 'trustChanged',
          characterId: effect.characterId,
          delta: effect.delta,
          trust: next.relations[effect.characterId]?.trust ?? 0,
        });
        break;
      }
      case 'recruitStatus':
        next = setRecruitStatus(next, effect.recruitId, effect.status);
        break;
      case 'recruit': {
        const joined = recruitCharacter(next, content, effect.recruitId, expeditionId);
        if (!joined.ok) return joined;
        next = joined.state;
        break;
      }
      default:
        break;
    }
  }
  // A chained story event pauses the expedition again right away.
  const chained = outcome.effects.find((effect) => effect.type === 'storyEvent');
  if (chained?.type === 'storyEvent' && content.events[chained.eventId]) {
    next = pauseOnEvent(next, expeditionId, chained.eventId, true);
  }
  // A `combat` effect opens the fight right away.
  const fight = outcome.effects.find((effect) => effect.type === 'combat');
  if (fight?.type === 'combat') {
    const started = startCombat(next, expeditionId, fight.enemies);
    if (!started.ok) return { ok: false, error: 'COMBAT_ACTIVE' };
    next = started.state;
  }
  return { ok: true, state: next };
}

/** Puts an expedition on hold waiting for a decision on `eventId`. */
function pauseOnEvent(state: GameState, expeditionId: string, eventId: string, story: boolean): GameState {
  const expedition = state.expeditions.find((e) => e.id === expeditionId);
  if (!expedition) return state;
  const next = replaceExpedition(state, {
    ...expedition,
    pendingEventId: eventId,
    seenEventIds: expedition.seenEventIds.includes(eventId)
      ? expedition.seenEventIds
      : [...expedition.seenEventIds, eventId],
  });
  return addLogEntry(next, {
    type: 'expeditionEvent',
    expeditionId,
    locationId: expedition.locationId,
    eventId,
    story,
  });
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
    let next = current;
    let active = expedition;
    if (!active.searched && !active.aborted && active.searchAt <= next.time) {
      next = searchLocation(next, content, active);
      // Arrival: a story event here takes priority over everything else this turn.
      const trigger = activeStoryTrigger(next, content, active.locationId);
      if (trigger && content.events[trigger.eventId]) {
        next = addLogEntry(next, { type: 'locationArrived', expeditionId: active.id, locationId: active.locationId });
        return pauseOnEvent(next, active.id, trigger.eventId, true);
      }
      active = next.expeditions.find((e) => e.id === active.id) ?? active;
    }
    if (active.returnsAt <= next.time) return completeExpedition(next, active);
    if (hasPendingEvent(active, content)) return next;
    return rollExpeditionEvent(next, content, active);
  }, state);
}

