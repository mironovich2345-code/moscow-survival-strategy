import { GAME_CONTENT, createPrototypeSetup } from '@data/content';
import {
  createNewGame,
  endTurn,
  type Character,
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

export function newGame(seed = 42): GameState {
  return createNewGame(createPrototypeSetup(seed));
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
