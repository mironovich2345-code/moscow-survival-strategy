import { isAlive } from '../characters';
import type { Character, CharacterId } from '../characters';
import { spendFromExpedition } from '../expeditions/cargo';
import type { Expedition } from '../expeditions/types';
import { addLogEntry } from '../gameState/ids';
import type { GameState } from '../gameState/types';
import type { ResourceKind } from '../resources';
import { getDay } from '../time';
import type { GameHour } from '../time';

export const FOOD_PER_PERSON_PER_DAY = 1;
export const WATER_PER_PERSON_PER_DAY = 1;

type Consumable = Extract<ResourceKind, 'food' | 'water'>;

const PER_PERSON: Record<Consumable, number> = {
  food: FOOD_PER_PERSON_PER_DAY,
  water: WATER_PER_PERSON_PER_DAY,
};

interface Distribution {
  readonly consumed: number;
  readonly unfed: ReadonlySet<CharacterId>;
}

/** Hands out portions in roster order until the stock runs out. */
function distribute(stock: number, eaters: readonly Character[], perPerson: number): Distribution {
  let remaining = stock;
  const unfed = new Set<CharacterId>();
  for (const character of eaters) {
    if (remaining >= perPerson) {
      remaining -= perPerson;
    } else {
      unfed.add(character.id);
    }
  }
  return { consumed: stock - remaining, unfed };
}

interface GroupResult {
  readonly food: Distribution;
  readonly water: Distribution;
}

/** Sets hungry/thirsty for the group's eaters according to who got a portion. */
function applyNeeds(state: GameState, eaters: readonly Character[], result: GroupResult): GameState {
  const ids = new Set(eaters.map((c) => c.id));
  return {
    ...state,
    characters: state.characters.map((character) =>
      ids.has(character.id)
        ? {
            ...character,
            condition: {
              ...character.condition,
              hungry: result.food.unfed.has(character.id),
              thirsty: result.water.unfed.has(character.id),
            },
          }
        : character,
    ),
  };
}

function logGroup(
  state: GameState,
  expeditionId: string | null,
  eaters: readonly Character[],
  result: GroupResult,
): GameState {
  let next = addLogEntry(state, {
    type: 'dailyConsumption',
    expeditionId,
    day: getDay(state.time),
    aliveCount: eaters.length,
    consumed: { food: result.food.consumed, water: result.water.consumed },
  });
  for (const [resource, distribution] of [
    ['food', result.food],
    ['water', result.water],
  ] as const) {
    if (distribution.unfed.size > 0) {
      next = addLogEntry(next, {
        type: 'shortage',
        expeditionId,
        resource,
        characterIds: [...distribution.unfed],
      });
    }
  }
  return next;
}

/** Living characters at the base eat from the base stock. */
function feedBase(state: GameState): GameState {
  const eaters = state.characters.filter((c) => isAlive(c) && c.assignment.type === 'base');
  if (eaters.length === 0) return state;
  const result: GroupResult = {
    food: distribute(state.resources.food, eaters, PER_PERSON.food),
    water: distribute(state.resources.water, eaters, PER_PERSON.water),
  };
  const next: GameState = {
    ...state,
    resources: {
      ...state.resources,
      food: state.resources.food - result.food.consumed,
      water: state.resources.water - result.water.consumed,
    },
  };
  return logGroup(applyNeeds(next, eaters, result), null, eaters, result);
}

/** Living members of an expedition eat from its own supplies (then haul). */
function feedExpedition(state: GameState, expedition: Expedition): GameState {
  const members = new Set(expedition.memberIds);
  // Roster order, same rule as at the base.
  const eaters = state.characters.filter((c) => members.has(c.id) && isAlive(c));
  if (eaters.length === 0) return state;
  const stock = (kind: Consumable) => (expedition.supplies[kind] ?? 0) + (expedition.haul[kind] ?? 0);
  const result: GroupResult = {
    food: distribute(stock('food'), eaters, PER_PERSON.food),
    water: distribute(stock('water'), eaters, PER_PERSON.water),
  };
  const { expedition: fed } = spendFromExpedition(expedition, {
    food: result.food.consumed,
    water: result.water.consumed,
  });
  const next: GameState = {
    ...state,
    expeditions: state.expeditions.map((e) => (e.id === fed.id ? fed : e)),
  };
  return logGroup(applyNeeds(next, eaters, result), expedition.id, eaters, result);
}

/**
 * Daily food & water consumption, computed separately for the base and for
 * every expedition. See docs/GAME_RULES.md «Еда и вода».
 */
export function applyDailyConsumption(state: GameState): GameState {
  const afterBase = feedBase(state);
  return afterBase.expeditions.reduce(
    (current, expedition) => feedExpedition(current, expedition),
    afterBase,
  );
}

/** Number of day boundaries (00:00) crossed when moving from `from` to `to`. */
export function daysCrossed(from: GameHour, to: GameHour): number {
  return Math.max(0, getDay(to) - getDay(from));
}
