import { describe, expect, it } from 'vitest';
import { HERO_ID } from '@data/characters';
import { LEFORTOVO_PHARMACY_ID } from '@data/locations';
import {
  GAME_STATE_VERSION,
  SAVE_KEY,
  type GameState,
  type StorageLike,
  applyCommand,
  clearSave,
  deserializeGame,
  endTurn,
  loadGame,
  saveGame,
} from '@game/gameState';
import { MemoryStorage, content, endTurns, newGame, quietContent } from './helpers';

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

describe('save format v2', () => {
  function toV1(state: GameState): unknown {
    return {
      ...state,
      version: 1,
      characters: state.characters.map(({ condition, ...rest }) => ({
        ...rest,
        condition: { health: condition.health, maxHealth: condition.maxHealth },
      })),
      expeditions: state.expeditions.map(
        ({ haul: _h, pendingEventId: _p, seenEventIds: _s, aborted: _a, ...rest }) => rest,
      ),
      log: state.log.map((entry) => {
        if (entry.type !== 'expeditionReturned') return entry;
        const { aborted: _aborted, ...rest } = entry;
        return rest;
      }),
    };
  }

  function midExpedition(seed = 3): GameState {
    const result = applyCommand(
      newGame(seed),
      { type: 'sendExpedition', locationId: LEFORTOVO_PHARMACY_ID, memberIds: [HERO_ID] },
      quietContent,
    );
    if (!result.ok) throw new Error(result.error);
    return result.state;
  }

  it('saves the current version', () => {
    const storage = new MemoryStorage();
    saveGame(storage, newGame());
    expect(JSON.parse(storage.getItem(SAVE_KEY)!)).toMatchObject({ version: GAME_STATE_VERSION });
    expect(GAME_STATE_VERSION).toBe(2);
  });

  it('round-trips hunger flags, pending event, haul and new log entries', () => {
    const base = newGame(3);
    // Night with no food: produces dailyConsumption + shortage entries and hungry flags.
    const hungry = endTurns({ ...base, resources: { ...base.resources, food: 0 } }, 8);
    const trip = midExpedition(3).expeditions[0]!;
    const state: GameState = {
      ...hungry,
      expeditions: [
        { ...trip, pendingEventId: 'locked_door', seenEventIds: ['locked_door'], haul: { water: 2, ammunition: -1 } },
      ],
    };
    expect(state.characters.every((c) => c.condition.hungry)).toBe(true);
    expect(state.log.some((e) => e.type === 'shortage')).toBe(true);

    const storage = new MemoryStorage();
    saveGame(storage, state);
    expect(loadGame(storage)).toEqual(state);
  });

  it('migrates a v1 save (no pending expedition)', () => {
    const v2 = endTurns(newGame(4), 3);
    const migrated = deserializeGame(JSON.stringify(toV1(v2)));
    expect(migrated).toEqual(v2);
  });

  it('migrates a v1 save with an active expedition, which then plays on', () => {
    const v2 = midExpedition(6);
    const migrated = deserializeGame(JSON.stringify(toV1(v2)));
    expect(migrated).not.toBeNull();
    expect(migrated!.expeditions[0]).toMatchObject({
      haul: {},
      pendingEventId: null,
      seenEventIds: [],
      aborted: false,
    });
    const home = endTurns(migrated!, 3);
    expect(home.expeditions).toHaveLength(0);
    expect(home.resources.medicine).toBeGreaterThan(v2.resources.medicine);
  });

  it('never throws on broken storage', () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    };
    expect(loadGame(broken)).toBeNull();

    const storage = new MemoryStorage();
    for (const junk of ['', 'null', '[]', '{"version":1}', '{"version":"2"}', '{"version":0}']) {
      storage.setItem(SAVE_KEY, junk);
      expect(loadGame(storage)).toBeNull();
    }
  });
});
