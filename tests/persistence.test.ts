import { describe, expect, it } from 'vitest';
import { HERO_ID } from '@data/characters';
import { LEFORTOVO_PHARMACY_ID } from '@data/locations';
import {
  SAVE_KEY,
  applyCommand,
  clearSave,
  deserializeGame,
  endTurn,
  loadGame,
  saveGame,
} from '@game/gameState';
import { MemoryStorage, content, newGame } from './helpers';

describe('persistence', () => {
  it('returns null when there is no save', () => {
    expect(loadGame(new MemoryStorage())).toBeNull();
  });

  it('round-trips a game with an active expedition', () => {
    const storage = new MemoryStorage();
    const result = applyCommand(
      newGame(3),
      { type: 'sendExpedition', locationId: LEFORTOVO_PHARMACY_ID, memberIds: [HERO_ID] },
      content,
    );
    if (!result.ok) throw new Error(result.error);
    const state = endTurn(result.state, content);

    saveGame(storage, state);
    const loaded = loadGame(storage);
    expect(loaded).toEqual(state);
  });

  it('a loaded game continues exactly like the original (RNG state is saved)', () => {
    const storage = new MemoryStorage();
    const result = applyCommand(
      newGame(11),
      { type: 'sendExpedition', locationId: LEFORTOVO_PHARMACY_ID, memberIds: [HERO_ID] },
      content,
    );
    if (!result.ok) throw new Error(result.error);
    saveGame(storage, result.state);

    const finish = (s: typeof result.state) => endTurn(endTurn(endTurn(s, content), content), content);
    const loaded = loadGame(storage);
    expect(loaded).not.toBeNull();
    expect(finish(loaded!)).toEqual(finish(result.state));
  });

  it('rejects corrupt or incompatible data', () => {
    expect(deserializeGame('not json')).toBeNull();
    expect(deserializeGame('{}')).toBeNull();
    expect(deserializeGame(JSON.stringify({ ...newGame(), version: 999 }))).toBeNull();
    expect(deserializeGame(JSON.stringify({ ...newGame(), resources: { food: 1 } }))).toBeNull();
  });

  it('clears the save', () => {
    const storage = new MemoryStorage();
    saveGame(storage, newGame());
    expect(storage.getItem(SAVE_KEY)).not.toBeNull();
    clearSave(storage);
    expect(loadGame(storage)).toBeNull();
  });
});
