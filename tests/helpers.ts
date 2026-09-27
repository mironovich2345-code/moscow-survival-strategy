import { GAME_CONTENT, createPrototypeSetup } from '@data/content';
import { createNewGame, type GameState, type StorageLike } from '@game/index';

export const content = GAME_CONTENT;

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
