import type { NewGameSetup } from '@game/gameState';
import type { GameContent } from '@game/world';
import { STARTING_CHARACTERS } from './characters';
import { DISTRICTS } from './districts';
import { EVENTS } from './events';
import { BASE_LOCATION_ID, LOCATIONS } from './locations';

/** All static content, bundled for the game logic. */
export const GAME_CONTENT: GameContent = {
  districts: DISTRICTS,
  locations: LOCATIONS,
  events: EVENTS,
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
    resources: STARTING_RESOURCES,
  };
}
