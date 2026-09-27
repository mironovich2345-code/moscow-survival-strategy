import { describe, expect, it } from 'vitest';
import { HERO_ID, MAXIM_ID } from '@data/characters';
import { LEFORTOVO_PHARMACY_ID, BASE_LOCATION_ID } from '@data/locations';
import { applyCommand, endTurn, type GameState } from '@game/gameState';
import { MAX_SQUAD_SIZE } from '@game/expeditions';
import { getDay, formatClock } from '@game/time';
import { content, endTurns, newGame, quietContent } from './helpers';

function send(state: GameState, memberIds: readonly string[], locationId = LEFORTOVO_PHARMACY_ID) {
  return applyCommand(state, { type: 'sendExpedition', locationId, memberIds }, quietContent);
}

function mustSend(state: GameState, memberIds: readonly string[]): GameState {
  const result = send(state, memberIds);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

const pharmacyTurns = content.locations[LEFORTOVO_PHARMACY_ID]!.expeditionTurns;

describe('expeditions', () => {
  it('the pharmacy is in Lefortovo', () => {
    expect(content.locations[LEFORTOVO_PHARMACY_ID]?.districtId).toBe('lefortovo');
    expect(pharmacyTurns).toBeGreaterThan(0);
  });

  it('sends a squad: members leave the base', () => {
    const state = mustSend(newGame(), [HERO_ID, MAXIM_ID]);
    expect(state.expeditions).toHaveLength(1);
    expect(state.characters.every((c) => c.assignment.type === 'expedition')).toBe(true);
    expect(state.log.at(-1)?.type).toBe('expeditionDeparted');
  });

  it('takes game time and returns with medicine', () => {
    const start = newGame(1);
    let state = mustSend(start, [MAXIM_ID]);

    state = endTurns(state, pharmacyTurns - 1);
    expect(state.expeditions).toHaveLength(1);
    expect(state.resources.medicine).toBe(start.resources.medicine);

    state = endTurn(state, quietContent);
    expect(state.expeditions).toHaveLength(0);
    expect(state.time - start.time).toBe(pharmacyTurns * 2);
    const gained = state.resources.medicine - start.resources.medicine;
    // Maxim: scavenging 2 → +20 %, so 1–5 becomes 1–6.
    expect(gained).toBeGreaterThanOrEqual(1);
    expect(gained).toBeLessThanOrEqual(6);
    expect(state.characters.every((c) => c.assignment.type === 'base')).toBe(true);

    const entry = state.log.at(-1);
    expect(entry?.type).toBe('expeditionReturned');
    if (entry?.type === 'expeditionReturned') expect(entry.loot.medicine).toBe(gained);
  });

  it('only changes medicine among resources', () => {
    const start = newGame(5);
    const state = endTurns(mustSend(start, [HERO_ID]), pharmacyTurns);
    const { medicine: _a, ...restBefore } = start.resources;
    const { medicine: _b, ...restAfter } = state.resources;
    expect(restAfter).toEqual(restBefore);
  });

  it('loot is deterministic for a seed and varies across seeds', () => {
    const run = (seed: number) =>
      endTurns(mustSend(newGame(seed), [HERO_ID]), pharmacyTurns).resources.medicine;
    expect(run(99)).toBe(run(99));
    const results = new Set(Array.from({ length: 30 }, (_, i) => run(i)));
    expect(results.size).toBeGreaterThan(1);
  });

  it('advances day and time correctly', () => {
    const state = endTurns(newGame(), 8);
    expect(getDay(state.time)).toBe(11);
    expect(formatClock(state.time)).toBe('00:00');
    expect(state.turn).toBe(9);
  });

  it('does not mutate the previous state', () => {
    const start = newGame();
    const snapshot = JSON.stringify(start);
    endTurns(mustSend(start, [HERO_ID, MAXIM_ID]), pharmacyTurns);
    expect(JSON.stringify(start)).toBe(snapshot);
  });

  describe('validation', () => {
    it('rejects an empty squad', () => {
      expect(send(newGame(), [])).toEqual({ ok: false, error: 'EMPTY_SQUAD' });
    });

    it(`rejects squads larger than ${MAX_SQUAD_SIZE}`, () => {
      const ids = Array.from({ length: MAX_SQUAD_SIZE + 1 }, (_, i) => `c${i}`);
      expect(send(newGame(), ids)).toEqual({ ok: false, error: 'SQUAD_TOO_LARGE' });
    });

    it('rejects unknown characters and duplicates', () => {
      expect(send(newGame(), ['ghost'])).toEqual({ ok: false, error: 'CHARACTER_NOT_FOUND' });
      expect(send(newGame(), [HERO_ID, HERO_ID])).toEqual({ ok: false, error: 'DUPLICATE_MEMBER' });
    });

    it('rejects characters already on an expedition', () => {
      const state = mustSend(newGame(), [HERO_ID]);
      expect(send(state, [HERO_ID])).toEqual({ ok: false, error: 'CHARACTER_UNAVAILABLE' });
    });

    it('rejects unknown and non-explorable locations', () => {
      expect(send(newGame(), [HERO_ID], 'nowhere')).toEqual({ ok: false, error: 'UNKNOWN_LOCATION' });
      expect(send(newGame(), [HERO_ID], BASE_LOCATION_ID)).toEqual({
        ok: false,
        error: 'LOCATION_NOT_EXPLORABLE',
      });
    });
  });
});
