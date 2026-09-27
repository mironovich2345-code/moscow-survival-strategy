import { MAX_GROUP_SIZE, createCharacter } from '../characters';
import { createRngState } from '../random';
import { createResources } from '../resources';
import { CAMPAIGN_START_TIME } from '../time';
import { addLogEntry } from './ids';
import { GAME_STATE_VERSION } from './types';
import type { GameState, NewGameSetup } from './types';

export function createNewGame(setup: NewGameSetup): GameState {
  if (setup.characters.length === 0) {
    throw new Error('A new game needs at least one character');
  }
  if (setup.characters.length > MAX_GROUP_SIZE) {
    throw new Error(`Group cannot exceed ${MAX_GROUP_SIZE} characters`);
  }
  if (setup.characters.filter((c) => c.isHero).length !== 1) {
    throw new Error('A new game needs exactly one hero');
  }

  const state: GameState = {
    version: GAME_STATE_VERSION,
    seed: setup.seed,
    rng: createRngState(setup.seed),
    time: CAMPAIGN_START_TIME,
    turn: 1,
    baseLocationId: setup.baseLocationId,
    resources: createResources(setup.resources),
    characters: setup.characters.map(createCharacter),
    expeditions: [],
    log: [],
    nextId: 1,
  };
  return addLogEntry(state, { type: 'campaignStarted' });
}
