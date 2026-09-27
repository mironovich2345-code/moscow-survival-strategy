import { describe, expect, it } from 'vitest';
import { HERO_ID, MAXIM_ID } from '@data/characters';
import { LEFORTOVO_POLICE_ID } from '@data/locations';
import { applyCommand, type GameState } from '@game/gameState';
import { applyDailyConsumption, daysCrossed } from '@game/survival';
import { getDay, toGameHour } from '@game/time';
import { endTurns, newGame, quietContent, withCharacter } from './helpers';

/** A fresh game at 22:00 so the next turn crosses midnight. */
function lateEvening(resources: Partial<GameState['resources']> = {}): GameState {
  const state = newGame();
  return { ...state, time: toGameHour(10, 22), resources: { ...state.resources, ...resources } };
}

const consumptionEntries = (state: GameState) => state.log.filter((e) => e.type === 'dailyConsumption');
const flags = (state: GameState, id: string) => {
  const c = state.characters.find((x) => x.id === id)!;
  return { hungry: c.condition.hungry, thirsty: c.condition.thirsty };
};

describe('daily food & water', () => {
  it('nothing is consumed during the day', () => {
    const start = newGame();
    const state = endTurns(start, 7); // 08:00 → 22:00, still day 10
    expect(getDay(state.time)).toBe(10);
    expect(state.resources.food).toBe(start.resources.food);
    expect(state.resources.water).toBe(start.resources.water);
    expect(consumptionEntries(state)).toHaveLength(0);
  });

  it('new day: each living member eats 1 food and drinks 1 water', () => {
    const start = newGame();
    const state = endTurns(start, 8); // → day 11, 00:00
    expect(getDay(state.time)).toBe(11);
    expect(state.resources.food).toBe(start.resources.food - 2);
    expect(state.resources.water).toBe(start.resources.water - 2);
    const [entry] = consumptionEntries(state);
    expect(entry).toMatchObject({ day: 11, aliveCount: 2, consumed: { food: 2, water: 2 } });
  });

  it('happens exactly once per day', () => {
    const start = newGame();
    const state = endTurns(start, 12 * 3); // three full days
    expect(consumptionEntries(state)).toHaveLength(3);
    expect(state.resources.food).toBe(start.resources.food - 6);
  });

  it('base stock only feeds people at the base', () => {
    const sent = applyCommand(
      lateEvening(),
      { type: 'sendExpedition', locationId: LEFORTOVO_POLICE_ID, memberIds: [MAXIM_ID] },
      quietContent,
    );
    if (!sent.ok) throw new Error(sent.error);
    const state = endTurns(sent.state, 1);
    expect(state.expeditions).toHaveLength(1);
    // Only the hero ate from the base.
    expect(state.resources.food).toBe(lateEvening().resources.food - 1);
    expect(state.resources.water).toBe(lateEvening().resources.water - 1);
  });

  it('dead characters do not consume', () => {
    const state = withCharacter(lateEvening(), MAXIM_ID, (c) => ({
      ...c,
      condition: { ...c.condition, health: 0 },
    }));
    const next = endTurns(state, 1);
    expect(next.resources.food).toBe(state.resources.food - 1);
    expect(flags(next, MAXIM_ID)).toEqual({ hungry: false, thirsty: false });
  });

  it('food shortage: stock hits 0 (not below), hero is fed first, the rest go hungry', () => {
    const state = endTurns(lateEvening({ food: 1 }), 1);
    expect(state.resources.food).toBe(0);
    expect(state.resources.water).toBe(lateEvening().resources.water - 2);
    expect(flags(state, HERO_ID)).toEqual({ hungry: false, thirsty: false });
    expect(flags(state, MAXIM_ID)).toEqual({ hungry: true, thirsty: false });
    const shortage = state.log.filter((e) => e.type === 'shortage');
    expect(shortage).toHaveLength(1);
    expect(shortage[0]).toMatchObject({ resource: 'food', characterIds: [MAXIM_ID] });
  });

  it('water shortage with empty stock: everyone thirsty, stock stays 0', () => {
    const state = endTurns(lateEvening({ water: 0 }), 1);
    expect(state.resources.water).toBe(0);
    expect(flags(state, HERO_ID).thirsty).toBe(true);
    expect(flags(state, MAXIM_ID).thirsty).toBe(true);
    expect(flags(state, HERO_ID).hungry).toBe(false);
    expect(state.log.at(-1)).toMatchObject({ type: 'shortage', resource: 'water' });
  });

  it('hungry/thirsty are cleared when the next daily ration is enough', () => {
    const starving = endTurns(lateEvening({ food: 0, water: 0 }), 1);
    expect(flags(starving, MAXIM_ID)).toEqual({ hungry: true, thirsty: true });

    const restocked = { ...starving, resources: { ...starving.resources, food: 10, water: 10 } };
    const nextDay = endTurns(restocked, 12);
    expect(flags(nextDay, MAXIM_ID)).toEqual({ hungry: false, thirsty: false });
    expect(flags(nextDay, HERO_ID)).toEqual({ hungry: false, thirsty: false });
    expect(nextDay.resources.food).toBe(8);
  });

  it('applyDailyConsumption does not mutate input', () => {
    const state = lateEvening({ food: 1 });
    const snapshot = JSON.stringify(state);
    applyDailyConsumption(state);
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it('counts crossed day boundaries', () => {
    expect(daysCrossed(toGameHour(10, 22), toGameHour(11, 0))).toBe(1);
    expect(daysCrossed(toGameHour(10, 8), toGameHour(10, 10))).toBe(0);
  });
});
