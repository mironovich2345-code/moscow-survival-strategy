import type { NewGameSetup } from '@game/gameState';
import type { GameContent } from '@game/world';
import { RECRUITS, STARTING_CHARACTERS, TRAITS } from './characters';
import { DISTRICTS } from './districts';
import { EVENTS, STORY_EVENTS, STORY_TRIGGERS } from './events';
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
    resources: STARTING_RESOURCES,
  };
}
