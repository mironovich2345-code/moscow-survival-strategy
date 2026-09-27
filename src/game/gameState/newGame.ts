import { EQUIPMENT_SLOTS, MAX_GROUP_SIZE, createCharacter } from '../characters';
import { findItemLocationErrors } from '../inventory';
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

  const equipped = new Set(
    setup.characters.flatMap((c) => EQUIPMENT_SLOTS.map((slot) => c.equipment[slot])),
  );
  const state: GameState = {
    version: GAME_STATE_VERSION,
    seed: setup.seed,
    rng: createRngState(setup.seed),
    time: CAMPAIGN_START_TIME,
    turn: 1,
    baseLocationId: setup.baseLocationId,
    resources: createResources(setup.resources),
    items: Object.fromEntries(setup.items.map((item) => [item.id, item])),
    storage: { items: setup.items.filter((item) => !equipped.has(item.id)).map((item) => item.id) },
    characters: setup.characters.map(createCharacter),
    expeditions: [],
    lostItems: [],
    combat: null,
    log: [],
    nextId: 1,
  };
  const itemErrors = findItemLocationErrors(state);
  if (itemErrors.length > 0) {
    throw new Error(`Invalid starting items: ${itemErrors.join('; ')}`);
  }
  return addLogEntry(state, { type: 'campaignStarted' });
}
