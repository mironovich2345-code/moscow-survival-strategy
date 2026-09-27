import { describe, expect, it } from 'vitest';
import { HERO } from '@data/characters';
import { LEGACY_MAXIM as MAXIM } from './helpers';
import { STARTING_RESOURCES, createPrototypeSetup } from '@data/content';
import { BASE_LOCATION_ID } from '@data/locations';
import { createNewGame } from '@game/gameState';
import { formatClock, getDay } from '@game/time';
import { newCampaign, newGame } from './helpers';

describe('new game', () => {
  it('starts on day 10 at the base in Lefortovo with starting resources', () => {
    const state = newCampaign();
    expect(getDay(state.time)).toBe(10);
    expect(formatClock(state.time)).toBe('08:00');
    expect(state.turn).toBe(1);
    expect(state.baseLocationId).toBe(BASE_LOCATION_ID);
    expect(state.resources).toEqual(STARTING_RESOURCES);
    expect(state.expeditions).toEqual([]);
    expect(state.log.map((e) => e.type)).toEqual(['campaignStarted']);
  });

  it('is fully determined by the seed', () => {
    expect(newGame(7)).toEqual(newGame(7));
    expect(newGame(7).rng).not.toBe(newGame(8).rng);
  });

  it('requires exactly one hero', () => {
    const setup = createPrototypeSetup(1);
    expect(() => createNewGame({ ...setup, characters: [MAXIM] })).toThrow();
    expect(() => createNewGame({ ...setup, characters: [HERO, { ...HERO, id: 'h2' }] })).toThrow();
    expect(() => createNewGame({ ...setup, characters: [] })).toThrow();
  });
});
