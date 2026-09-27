import { describe, expect, it } from 'vitest';
import {
  CAMPAIGN_START_TIME,
  advanceTurns,
  formatClock,
  getDay,
  getHourOfDay,
  toGameHour,
  turnsUntil,
} from '@game/time';

describe('game time', () => {
  it('starts on day 10 at 08:00', () => {
    expect(getDay(CAMPAIGN_START_TIME)).toBe(10);
    expect(formatClock(CAMPAIGN_START_TIME)).toBe('08:00');
  });

  it('one turn is two hours', () => {
    expect(advanceTurns(CAMPAIGN_START_TIME, 1) - CAMPAIGN_START_TIME).toBe(2);
  });

  it('rolls over to the next day', () => {
    const t = advanceTurns(toGameHour(10, 22), 1);
    expect(getDay(t)).toBe(11);
    expect(getHourOfDay(t)).toBe(0);
    expect(formatClock(t)).toBe('00:00');
  });

  it('counts turns until a target', () => {
    const now = toGameHour(10, 8);
    expect(turnsUntil(now, toGameHour(10, 14))).toBe(3);
    expect(turnsUntil(now, now)).toBe(0);
    expect(turnsUntil(now, now - 4)).toBe(0);
  });

  it('validates input', () => {
    expect(() => toGameHour(0, 0)).toThrow(RangeError);
    expect(() => toGameHour(1, 24)).toThrow(RangeError);
    expect(() => advanceTurns(0, -1)).toThrow(RangeError);
  });
});
