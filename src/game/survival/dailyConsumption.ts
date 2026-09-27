import { isAlive } from '../characters';
import type { Character, CharacterId } from '../characters';
import { addLogEntry } from '../gameState/ids';
import type { GameState } from '../gameState/types';
import type { ResourceKind } from '../resources';
import { getDay } from '../time';
import type { GameHour } from '../time';

export const FOOD_PER_PERSON_PER_DAY = 1;
export const WATER_PER_PERSON_PER_DAY = 1;

type Consumable = Extract<ResourceKind, 'food' | 'water'>;

const NEED_FLAG = { food: 'hungry', water: 'thirsty' } as const satisfies Record<
  Consumable,
  'hungry' | 'thirsty'
>;

const PER_PERSON: Record<Consumable, number> = {
  food: FOOD_PER_PERSON_PER_DAY,
  water: WATER_PER_PERSON_PER_DAY,
};

interface Distribution {
  readonly consumed: number;
  readonly remaining: number;
  readonly unfed: ReadonlySet<CharacterId>;
}

/** Hands out portions in roster order until the stock runs out. */
function distribute(stock: number, alive: readonly Character[], perPerson: number): Distribution {
  let remaining = stock;
  const unfed = new Set<CharacterId>();
  for (const character of alive) {
    if (remaining >= perPerson) {
      remaining -= perPerson;
    } else {
      unfed.add(character.id);
    }
  }
  return { consumed: stock - remaining, remaining, unfed };
}

/**
 * Daily food & water consumption. Every living member (including those on an
 * expedition) needs one portion of each. See docs/GAME_RULES.md.
 */
export function applyDailyConsumption(state: GameState): GameState {
  const alive = state.characters.filter(isAlive);
  if (alive.length === 0) return state;

  const food = distribute(state.resources.food, alive, PER_PERSON.food);
  const water = distribute(state.resources.water, alive, PER_PERSON.water);

  let next: GameState = {
    ...state,
    resources: { ...state.resources, food: food.remaining, water: water.remaining },
    characters: state.characters.map((character) =>
      isAlive(character)
        ? {
            ...character,
            condition: {
              ...character.condition,
              [NEED_FLAG.food]: food.unfed.has(character.id),
              [NEED_FLAG.water]: water.unfed.has(character.id),
            },
          }
        : character,
    ),
  };

  next = addLogEntry(next, {
    type: 'dailyConsumption',
    day: getDay(next.time),
    aliveCount: alive.length,
    consumed: { food: food.consumed, water: water.consumed },
  });
  for (const [resource, result] of [
    ['food', food],
    ['water', water],
  ] as const) {
    if (result.unfed.size > 0) {
      next = addLogEntry(next, { type: 'shortage', resource, characterIds: [...result.unfed] });
    }
  }
  return next;
}

/** Number of day boundaries (00:00) crossed when moving from `from` to `to`. */
export function daysCrossed(from: GameHour, to: GameHour): number {
  return Math.max(0, getDay(to) - getDay(from));
}
