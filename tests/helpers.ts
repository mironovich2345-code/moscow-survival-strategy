import { MAXIM_RECRUIT } from '@data/characters';
import { GAME_CONTENT, createPrototypeSetup } from '@data/content';
import { FIRE_AXE_1, TOURIST_BACKPACK_1 } from '@data/items';
import {
  createNewGame,
  endTurn,
  type Character,
  type CharacterTemplate,
  type GameContent,
  type GameState,
  type StorageLike,
} from '@game/index';

export const content = GAME_CONTENT;

/** Same world without expedition events — for tests of timing and loot only. */
export const quietContent: GameContent = { ...GAME_CONTENT, events: {} };

export function endTurns(state: GameState, n: number, world: GameContent = quietContent): GameState {
  let s = state;
  for (let i = 0; i < n; i += 1) s = endTurn(s, world);
  return s;
}

export function withCharacter(
  state: GameState,
  id: string,
  update: (character: Character) => Character,
): GameState {
  return { ...state, characters: state.characters.map((c) => (c.id === id ? update(c) : c)) };
}

/** A real new campaign (0.5+): the hero alone. */
export function newCampaign(seed = 42): GameState {
  return createNewGame(createPrototypeSetup(seed));
}

/**
 * Maxim as he was in the 0.1–0.4 test start: already in the group with the
 * fire axe and tourist backpack (ids `fire_axe-1`, `tourist_backpack-1`).
 */
export const LEGACY_MAXIM: CharacterTemplate = {
  id: MAXIM_RECRUIT.id,
  name: MAXIM_RECRUIT.name,
  isHero: false,
  attributes: MAXIM_RECRUIT.attributes,
  skills: MAXIM_RECRUIT.skills,
  traits: MAXIM_RECRUIT.traits,
  equipment: { sidearm: null, primary: null, melee: FIRE_AXE_1, body: null, backpack: TOURIST_BACKPACK_1 },
  condition: { health: 100, maxHealth: 100, hungry: false, thirsty: false },
};

/**
 * TEST SQUAD FIXTURE (not a real new game since 0.5): hero + an already
 * recruited Maxim, like the 0.1–0.4 start. Used by the combat, inventory,
 * expedition and survival tests, which are about the squad, not the story.
 */
export function newGame(seed = 42): GameState {
  const setup = createPrototypeSetup(seed);
  return createNewGame({
    ...setup,
    characters: [...setup.characters, LEGACY_MAXIM],
    items: [
      ...setup.items,
      { id: FIRE_AXE_1, defId: 'fire_axe' },
      { id: TOURIST_BACKPACK_1, defId: 'tourist_backpack' },
    ],
    storyFlags: { ...setup.storyFlags, maxim_met: true, maxim_recruited: true },
  });
}

export class MemoryStorage implements StorageLike {
  private readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}
