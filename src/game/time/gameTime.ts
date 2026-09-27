/**
 * Game time is stored as a single integer: absolute hours since the moment of
 * the catastrophe (day 1, 00:00). Day and hour are derived from it.
 */

export type GameHour = number;

export const HOURS_PER_DAY = 24;
/** One turn = 2 in-game hours. */
export const HOURS_PER_TURN = 2;
/** The campaign starts on the 10th day after the catastrophe. */
export const CAMPAIGN_START_DAY = 10;
export const CAMPAIGN_START_HOUR = 8;

export function toGameHour(day: number, hour: number): GameHour {
  if (!Number.isInteger(day) || day < 1) {
    throw new RangeError(`Day must be a positive integer, got ${day}`);
  }
  if (!Number.isInteger(hour) || hour < 0 || hour >= HOURS_PER_DAY) {
    throw new RangeError(`Hour must be in [0, 23], got ${hour}`);
  }
  return (day - 1) * HOURS_PER_DAY + hour;
}

export const CAMPAIGN_START_TIME: GameHour = toGameHour(CAMPAIGN_START_DAY, CAMPAIGN_START_HOUR);

export function getDay(time: GameHour): number {
  return Math.floor(time / HOURS_PER_DAY) + 1;
}

export function getHourOfDay(time: GameHour): number {
  return time % HOURS_PER_DAY;
}

export function turnsToHours(turns: number): number {
  return turns * HOURS_PER_TURN;
}

export function advanceTurns(time: GameHour, turns: number): GameHour {
  if (!Number.isInteger(turns) || turns < 0) {
    throw new RangeError(`Turns must be a non-negative integer, got ${turns}`);
  }
  return time + turnsToHours(turns);
}

/** Number of whole turns left until `target` (0 if already reached). */
export function turnsUntil(now: GameHour, target: GameHour): number {
  return Math.max(0, Math.ceil((target - now) / HOURS_PER_TURN));
}

/** "08:00" */
export function formatClock(time: GameHour): string {
  return `${String(getHourOfDay(time)).padStart(2, '0')}:00`;
}
