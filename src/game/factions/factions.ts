import { addDistrictNoise, observedDistricts } from '../districts/districts';
import { addLogEntry } from '../gameState/ids';
import type { GameLogEntry } from '../events/log';
import type { GameState } from '../gameState/types';
import { nextInt } from '../random';
import type { GameContent } from '../world';
import {
  FACTION_OPERATION_INTERVAL_HOURS,
  INTIMIDATE_NOISE,
  MAX_WORLD_EVENTS,
  SCAVENGE_SUPPLIES,
} from './types';
import type {
  AwarenessCategory,
  FactionDefinition,
  FactionId,
  FactionOperationType,
  FactionRelationCategory,
  FactionState,
  KnownActivity,
  ManpowerEstimate,
  WorldEvent,
} from './types';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// ---------------------------------------------------------------------------
// Categories (the only thing the player sees)
// ---------------------------------------------------------------------------

/** Not contacted → unknown; ≥0 neutral; −1…−29 tension; −30…−69 hostile; ≤−70 war. */
export function relationCategory(faction: Pick<FactionState, 'contacted' | 'relationToPlayer'>): FactionRelationCategory {
  if (!faction.contacted) return 'unknown';
  const r = faction.relationToPlayer;
  if (r >= 0) return 'neutral';
  if (r > -30) return 'tension';
  if (r > -70) return 'hostile';
  return 'war';
}

/** 0 none; 1–24 rumors; 25–49 knows the group; 50–74 watching; 75+ hunting. */
export function awarenessCategory(awareness: number): AwarenessCategory {
  if (awareness <= 0) return 'none';
  if (awareness < 25) return 'rumors';
  if (awareness < 50) return 'knowsGroup';
  if (awareness < 75) return 'watching';
  return 'hunting';
}

/** Only after contact; <15 few, 15–40 a notable group, >40 many. */
export function manpowerEstimate(faction: Pick<FactionState, 'contacted' | 'manpower'>): ManpowerEstimate {
  if (!faction.contacted) return 'unknown';
  if (faction.manpower < 15) return 'few';
  if (faction.manpower <= 40) return 'group';
  return 'many';
}

// ---------------------------------------------------------------------------
// State changes
// ---------------------------------------------------------------------------

function setFaction(state: GameState, faction: FactionState): GameState {
  return { ...state, factions: { ...state.factions, [faction.id]: faction } };
}

export function contactFaction(state: GameState, factionId: FactionId): GameState {
  const faction = state.factions[factionId];
  if (!faction || faction.contacted) return state;
  const next = setFaction(state, { ...faction, contacted: true });
  return addLogEntry(next, { type: 'factionContact', factionId });
}

export function changeAwareness(state: GameState, factionId: FactionId, delta: number): GameState {
  const faction = state.factions[factionId];
  if (!faction) return state;
  const awarenessOfPlayer = clamp(faction.awarenessOfPlayer + delta, 0, 100);
  const next = setFaction(state, { ...faction, awarenessOfPlayer });
  const before = awarenessCategory(faction.awarenessOfPlayer);
  const after = awarenessCategory(awarenessOfPlayer);
  return before === after ? next : addLogEntry(next, { type: 'factionAwarenessChanged', factionId, category: after });
}

export function changeRelation(state: GameState, factionId: FactionId, delta: number): GameState {
  const faction = state.factions[factionId];
  if (!faction) return state;
  const updated = { ...faction, relationToPlayer: clamp(faction.relationToPlayer + delta, -100, 100) };
  const next = setFaction(state, updated);
  const before = relationCategory(faction);
  const after = relationCategory(updated);
  return before === after ? next : addLogEntry(next, { type: 'factionRelationChanged', factionId, category: after });
}

// ---------------------------------------------------------------------------
// World tick: operations
// ---------------------------------------------------------------------------

const OPERATION_ORDER: readonly FactionOperationType[] = ['patrol', 'scavenge', 'intimidate'];

/** Weighted deterministic pick of the next operation. */
export function pickOperation(
  state: GameState,
  definition: FactionDefinition,
): [FactionOperationType, GameState] {
  const total = OPERATION_ORDER.reduce((sum, op) => sum + definition.operationWeights[op], 0);
  const roll = nextInt(state.rng, 1, Math.max(1, total));
  let acc = 0;
  for (const op of OPERATION_ORDER) {
    acc += definition.operationWeights[op];
    if (roll.value <= acc) return [op, { ...state, rng: roll.state }];
  }
  return ['patrol', { ...state, rng: roll.state }];
}

function recordWorldEvent(state: GameState, event: WorldEvent): GameState {
  const worldEvents = [...state.worldEvents, event];
  return {
    ...state,
    worldEvents: worldEvents.length > MAX_WORLD_EVENTS ? worldEvents.slice(-MAX_WORLD_EVENTS) : worldEvents,
  };
}

function runOperation(state: GameState, content: GameContent, faction: FactionState): GameState {
  const definition = content.factions[faction.id];
  if (!definition) return state;
  let [operation, next] = pickOperation(state, definition);

  // Where it happens.
  let districtId = definition.homeDistrictId;
  if (operation === 'intimidate') {
    const home = content.districts[definition.homeDistrictId];
    const targets = (home?.neighbors ?? []).filter((id) => next.districts[id]?.controller === 'none');
    if (targets.length === 0) {
      operation = 'patrol';
    } else {
      const pick = nextInt(next.rng, 0, targets.length - 1);
      next = { ...next, rng: pick.state };
      districtId = targets[pick.value] ?? districtId;
    }
  }

  // Effects.
  let updated: FactionState = {
    ...faction,
    currentOperation: { type: operation, districtId, startedAt: next.time },
    nextOperationAt: faction.nextOperationAt + FACTION_OPERATION_INTERVAL_HOURS,
  };
  if (operation === 'scavenge') updated = { ...updated, supplies: updated.supplies + SCAVENGE_SUPPLIES };
  next = setFaction(next, updated);
  if (operation === 'intimidate') next = addDistrictNoise(next, districtId, INTIMIDATE_NOISE);
  const district = next.districts[districtId];
  if (district) {
    next = { ...next, districts: { ...next.districts, [districtId]: { ...district, lastWorldEventAt: next.time } } };
  }

  // What the player can know.
  const observed = observedDistricts(next, content).has(districtId);
  next = recordWorldEvent(next, { at: next.time, factionId: faction.id, operation, districtId, observed });
  if (observed) {
    const known: KnownActivity = { operation, districtId, at: next.time };
    next = setFaction(next, { ...next.factions[faction.id]!, lastKnownActivity: known });
    next = addLogEntry(next, {
      type: 'factionActivity',
      factionId: faction.id,
      operation,
      districtId,
      identified: faction.contacted,
    });
  }
  return next;
}

/** Every faction whose time has come runs one operation (one per 6 hours). */
export function factionTick(state: GameState, content: GameContent): GameState {
  let next = state;
  for (const faction of Object.values(state.factions)) {
    const current = next.factions[faction.id];
    if (!current || current.status === 'destroyed') continue;
    if (next.time >= current.nextOperationAt) next = runOperation(next, content, current);
  }
  return next;
}

// ---------------------------------------------------------------------------
// What the player may see
// ---------------------------------------------------------------------------

export interface FactionIntel {
  readonly id: FactionId;
  /** Real name only after contact. */
  readonly name: string;
  readonly description: string | null;
  readonly contacted: boolean;
  readonly knownTerritories: readonly string[];
  readonly relation: FactionRelationCategory;
  readonly awareness: AwarenessCategory;
  readonly manpower: ManpowerEstimate;
  readonly lastKnownActivity: KnownActivity | null;
  /** Journal entries about this faction (already filtered to what the player saw). */
  readonly contacts: readonly GameLogEntry[];
}

/**
 * Everything the UI may show about a faction. Deliberately contains no
 * manpower / supplies numbers and no hidden world events.
 */
export function factionIntel(state: GameState, content: GameContent, factionId: FactionId): FactionIntel | null {
  const faction = state.factions[factionId];
  const definition = content.factions[factionId];
  if (!faction || !definition) return null;
  const knownTerritories = faction.controlledDistricts.filter((id) => state.districts[id]?.discovered);
  return {
    id: faction.id,
    name: faction.contacted ? definition.name : definition.unknownName,
    description: faction.contacted ? definition.description : null,
    contacted: faction.contacted,
    knownTerritories,
    relation: relationCategory(faction),
    awareness: awarenessCategory(faction.awarenessOfPlayer),
    manpower: manpowerEstimate(faction),
    lastKnownActivity: faction.lastKnownActivity,
    contacts: state.log.filter(
      (entry) =>
        (entry.type === 'factionContact' ||
          entry.type === 'factionActivity' ||
          entry.type === 'factionRelationChanged' ||
          entry.type === 'factionAwarenessChanged') &&
        entry.factionId === factionId,
    ),
  };
}
