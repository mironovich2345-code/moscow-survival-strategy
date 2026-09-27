import type { NewGameSetup } from '@game/gameState';
import type { GameContent } from '@game/world';
import { RECRUITS, STARTING_CHARACTERS, TRAITS } from './characters';
import { DISTRICTS } from './districts';
import { EVENTS, STORY_EVENTS, STORY_TRIGGERS } from './events';
import { FACTIONS } from './factions';
import { threatFromNoise } from '@game/districts';
import { FACTION_OPERATION_INTERVAL_HOURS } from '@game/factions';
import { CAMPAIGN_START_TIME } from '@game/time';
import { ITEMS, STARTING_ITEMS } from './items';
import { BASE_LOCATION_ID, LOCATIONS } from './locations';

/** All static content, bundled for the game logic. */
export const GAME_CONTENT: GameContent = {
  districts: DISTRICTS,
  locations: LOCATIONS,
  events: { ...EVENTS, ...STORY_EVENTS },
  items: ITEMS,
  recruits: RECRUITS,
  traits: TRAITS,
  storyTriggers: STORY_TRIGGERS,
  factions: FACTIONS,
  // Temporary balance — GAME_RULES «Уровень угрозы».
  infectedEncounters: {
    low: { chancePercent: 10, min: 1, max: 1 },
    medium: { chancePercent: 20, min: 1, max: 2 },
    high: { chancePercent: 35, min: 2, max: 3 },
    extreme: { chancePercent: 50, min: 3, max: 4 },
  },
};

export const STARTING_RESOURCES = {
  food: 20,
  water: 20,
  medicine: 2,
  ammunition: 24,
  fuel: 10,
  materials: 15,
} as const;

export function createPrototypeSetup(seed: number): NewGameSetup {
  return {
    seed,
    baseLocationId: BASE_LOCATION_ID,
    characters: STARTING_CHARACTERS,
    items: STARTING_ITEMS,
    // The hero knows where Maxim worked (GAME_BIBLE §9).
    storyFlags: { maxim_location_known: true },
    recruits: Object.fromEntries(Object.values(RECRUITS).map((r) => [r.id, r.initialStatus])),
    districts: Object.values(DISTRICTS).map((d) => ({
      districtId: d.id,
      controller: d.initialController,
      noise: 0,
      threatLevel: threatFromNoise(0),
      discovered: d.initialDiscovered,
      lastWorldEventAt: null,
    })),
    factions: Object.values(FACTIONS).map((f) => ({
      id: f.id,
      manpower: f.initialManpower,
      supplies: f.initialSupplies,
      controlledDistricts: Object.values(DISTRICTS)
        .filter((d) => d.initialController === f.id)
        .map((d) => d.id),
      awarenessOfPlayer: 0,
      relationToPlayer: 0,
      status: 'active' as const,
      currentOperation: null,
      // First operation 6 hours after the campaign starts.
      nextOperationAt: CAMPAIGN_START_TIME + FACTION_OPERATION_INTERVAL_HOURS,
      contacted: false,
      lastKnownActivity: null,
    })),
    resources: STARTING_RESOURCES,
  };
}
