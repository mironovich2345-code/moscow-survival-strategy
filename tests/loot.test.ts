import { describe, expect, it } from 'vitest';
import { HERO, MAXIM_ID, HERO_ID } from '@data/characters';
import { LEGACY_MAXIM as MAXIM } from './helpers';
import {
  LEFORTOVO_GROCERY_ID,
  LEFORTOVO_PARKING_ID,
  LEFORTOVO_PHARMACY_ID,
  LEFORTOVO_POLICE_ID,
} from '@data/locations';
import { createCharacter } from '@game/characters';
import { applyLootBonus, getScavengingBonusPercent, rollLoot } from '@game/expeditions';
import { applyCommand, type GameState } from '@game/gameState';
import { RESOURCE_KINDS, type ResourceKind } from '@game/resources';
import { endTurns, newGame, quietContent, withCharacter } from './helpers';

function runExpedition(state: GameState, locationId: string, memberIds: readonly string[]) {
  const sent = applyCommand(state, { type: 'sendExpedition', locationId, memberIds }, quietContent);
  if (!sent.ok) throw new Error(sent.error);
  const turns = quietContent.locations[locationId]!.expeditionTurns;
  const after = endTurns(sent.state, turns);
  expect(after.expeditions).toHaveLength(0);
  const gained: Partial<Record<ResourceKind, number>> = {};
  for (const kind of RESOURCE_KINDS) {
    // Ignore daily consumption: expeditions here never cross midnight from 08:00.
    const diff = after.resources[kind] - state.resources[kind];
    if (diff !== 0) gained[kind] = diff;
  }
  return gained;
}

const setScavenging = (state: GameState, id: string, value: number) =>
  withCharacter(state, id, (c) => ({ ...c, skills: { ...c.skills, scavenging: value } }));

describe('scavenging skill', () => {
  it('bonus = 10 % per point of squad scavenging, capped at 100 %', () => {
    expect(getScavengingBonusPercent([])).toBe(0);
    const hero = createCharacter(HERO);
    const maxim = createCharacter(MAXIM);
    expect(getScavengingBonusPercent([hero, maxim])).toBe(10 * (HERO.skills.scavenging + MAXIM.skills.scavenging));
    const expert = { ...hero, skills: { ...hero.skills, scavenging: 15 } };
    expect(getScavengingBonusPercent([expert])).toBe(100);
  });

  it('bonus rounds down', () => {
    expect(applyLootBonus(5, 40)).toBe(7);
    expect(applyLootBonus(1, 40)).toBe(1);
    expect(applyLootBonus(3, 100)).toBe(6);
    expect(applyLootBonus(4, 0)).toBe(4);
  });

  it('rollLoot: same RNG, higher bonus → proportionally more loot', () => {
    const state = newGame(17);
    const location = quietContent.locations[LEFORTOVO_GROCERY_ID]!;
    const base = rollLoot(state, location, 0).loot;
    const doubled = rollLoot(state, location, 100).loot;
    expect(doubled.food).toBe((base.food ?? 0) * 2);
    expect(doubled.water).toBe((base.water ?? 0) * 2);
  });

  it('a skilled squad brings back more than an unskilled one (same seed)', () => {
    // Maxim (backpack) has 20 free capacity: pharmacy loot ×2 (max 10) always fits.
    for (const seed of [1, 2, 3, 4, 5]) {
      const unskilled = setScavenging(newGame(seed), MAXIM_ID, 0);
      const skilled = setScavenging(newGame(seed), MAXIM_ID, 10);
      const low = runExpedition(unskilled, LEFORTOVO_PHARMACY_ID, [MAXIM_ID]);
      const high = runExpedition(skilled, LEFORTOVO_PHARMACY_ID, [MAXIM_ID]);
      expect(high.medicine).toBe((low.medicine ?? 0) * 2);
    }
  });

  it('squad skill is summed over members', () => {
    const state = setScavenging(setScavenging(newGame(8), HERO_ID, 5), MAXIM_ID, 5);
    const solo = runExpedition(setScavenging(newGame(8), HERO_ID, 10), LEFORTOVO_PHARMACY_ID, [HERO_ID]);
    const pair = runExpedition(state, LEFORTOVO_PHARMACY_ID, [HERO_ID, MAXIM_ID]);
    expect(pair).toEqual(solo);
  });
});

describe('Lefortovo locations', () => {
  const ids = [LEFORTOVO_PHARMACY_ID, LEFORTOVO_GROCERY_ID, LEFORTOVO_PARKING_ID, LEFORTOVO_POLICE_ID];

  it('all four exist in Lefortovo with time, risk, loot and description', () => {
    for (const id of ids) {
      const location = quietContent.locations[id]!;
      expect(location.districtId).toBe('lefortovo');
      expect(location.expeditionTurns).toBeGreaterThan(0);
      expect(['low', 'medium', 'high']).toContain(location.risk);
      expect(location.loot.length).toBeGreaterThan(0);
      expect(location.description.length).toBeGreaterThan(0);
    }
  });

  it('each location yields its own resource types', () => {
    const kinds = (id: string) => {
      const seen = new Set<string>();
      for (let seed = 0; seed < 40; seed += 1) {
        Object.keys(runExpedition(newGame(seed), id, [HERO_ID])).forEach((k) => seen.add(k));
      }
      return [...seen].sort();
    };
    expect(kinds(LEFORTOVO_PHARMACY_ID)).toEqual(['medicine']);
    expect(kinds(LEFORTOVO_GROCERY_ID)).toEqual(['food', 'water']);
    expect(kinds(LEFORTOVO_PARKING_ID)).toEqual(['fuel', 'materials']);
    expect(kinds(LEFORTOVO_POLICE_ID)).toEqual(['ammunition', 'medicine']);
  });

  it('police medicine is a chance drop, ammunition is guaranteed', () => {
    let withMedicine = 0;
    const runs = 60;
    for (let seed = 0; seed < runs; seed += 1) {
      const gained = runExpedition(newGame(seed), LEFORTOVO_POLICE_ID, [HERO_ID]);
      expect(gained.ammunition ?? 0).toBeGreaterThan(0);
      if ((gained.medicine ?? 0) > 0) withMedicine += 1;
    }
    expect(withMedicine).toBeGreaterThan(0);
    expect(withMedicine).toBeLessThan(runs / 2);
  });
});
