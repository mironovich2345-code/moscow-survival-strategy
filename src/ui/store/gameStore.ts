import { create } from 'zustand';
import { GAME_CONTENT, createPrototypeSetup } from '@data/content';
import {
  applyCommand,
  clearSave,
  createNewGame,
  loadGame,
  saveGame,
  type GameCommand,
  type GameError,
  type GameState,
  type StorageLike,
} from '@game/index';

/**
 * Thin bridge between React and the pure game logic. The store holds the
 * current GameState, forwards commands to applyCommand and persists the result.
 * No game rules live here.
 */
export interface GameStore {
  readonly game: GameState;
  readonly lastError: GameError | null;
  dispatch(command: GameCommand): boolean;
  startNewGame(seed?: number): void;
  clearError(): void;
}

function getStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

function persist(game: GameState): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    saveGame(storage, game);
  } catch (error) {
    console.error('Не удалось сохранить игру', error);
  }
}

function loadOrCreate(): GameState {
  const storage = getStorage();
  const saved = storage ? loadGame(storage) : null;
  if (saved) {
    persist(saved); // rewrites a migrated older save in the current format
    return saved;
  }
  const game = createNewGame(createPrototypeSetup(randomSeed()));
  persist(game);
  return game;
}

export const useGameStore = create<GameStore>()((set, get) => ({
  game: loadOrCreate(),
  lastError: null,

  dispatch(command) {
    const result = applyCommand(get().game, command, GAME_CONTENT);
    if (!result.ok) {
      set({ lastError: result.error });
      return false;
    }
    persist(result.state);
    set({ game: result.state, lastError: null });
    return true;
  },

  startNewGame(seed = randomSeed()) {
    const storage = getStorage();
    if (storage) clearSave(storage);
    const game = createNewGame(createPrototypeSetup(seed));
    persist(game);
    set({ game, lastError: null });
  },

  clearError() {
    set({ lastError: null });
  },
}));
