import { describe, expect, it } from 'vitest';
import { HERO_ID, MAXIM_ID } from '@data/characters';
import { GAME_CONTENT } from '@data/content';
import { STORY_EVENTS } from '@data/events';
import {
  ARENA_GYM_ID,
  ARENA_WAREHOUSE_ID,
  LEFORTOVO_PHARMACY_ID,
  SOKOLINAYA_OUTSKIRTS_ID,
} from '@data/locations';
import type { CombatAction } from '@game/combat';
import {
  addDistrictNoise,
  decayDistrictNoise,
  threatFromNoise,
  type ThreatLevel,
} from '@game/districts';
import { rollInfectedEncounter } from '@game/expeditions';
import {
  awarenessCategory,
  factionIntel,
  factionTick,
  manpowerEstimate,
  pickOperation,
  relationCategory,
} from '@game/factions';
import {
  GAME_STATE_VERSION,
  applyCommand,
  deserializeGame,
  endTurn,
  loadGame,
  saveGame,
  type CommandResult,
  type GameCommand,
  type GameState,
} from '@game/gameState';
import type { GameContent } from '@game/world';
import { SAVE_V1, SAVE_V6 } from './fixtures/saves';
import { MemoryStorage, endTurns, newCampaign, newGame, quietContent } from './helpers';

/** Story events on (for the Arena contact), random events and encounters off. */
const storyOnly: GameContent = { ...GAME_CONTENT, events: STORY_EVENTS, infectedEncounters: null };

const apply = (state: GameState, command: GameCommand, world: GameContent = storyOnly): CommandResult =>
  applyCommand(state, command, world);
function run(state: GameState, command: GameCommand, world: GameContent = storyOnly): GameState {
  const result = apply(state, command, world);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}
const trip = (state: GameState) => state.expeditions[0]!;
const arena = (state: GameState) => state.factions.arena!;
const district = (state: GameState, id: string) => state.districts[id]!;
const setNoise = (state: GameState, id: string, noise: number): GameState => ({
  ...state,
  districts: { ...state.districts, [id]: { ...district(state, id), noise, threatLevel: threatFromNoise(noise) } },
});
function withRng(state: GameState, step: (s: GameState) => GameState, want: (s: GameState) => boolean): GameState {
  for (let rng = 0; rng < 20000; rng += 1) {
    const result = step({ ...state, rng });
    if (want(result)) return result;
  }
  throw new Error('no rng found');
}

// ---------------------------------------------------------------------------

describe('districts as world state', () => {
  it('a new campaign has runtime state for all five districts', () => {
    const state = newCampaign();
    expect(Object.keys(state.districts).sort()).toEqual(
      ['izmailovo', 'lefortovo', 'novogireevo', 'perovo', 'sokolinaya_gora'].sort(),
    );
    expect(district(state, 'lefortovo')).toEqual({
      districtId: 'lefortovo',
      controller: 'none',
      noise: 0,
      threatLevel: 'low',
      discovered: true,
      lastWorldEventAt: null,
    });
    expect(district(state, 'sokolinaya_gora')).toMatchObject({ controller: 'arena', discovered: true });
    for (const id of ['perovo', 'izmailovo', 'novogireevo']) {
      expect(district(state, id)).toMatchObject({ controller: 'none', discovered: false, noise: 0 });
    }
  });

  it('threat thresholds: 0–19 low, 20–39 medium, 40–69 high, 70+ extreme', () => {
    const cases: [number, ThreatLevel][] = [[0, 'low'], [19, 'low'], [20, 'medium'], [39, 'medium'], [40, 'high'], [69, 'high'], [70, 'extreme'], [100, 'extreme']];
    for (const [noise, level] of cases) expect(threatFromNoise(noise)).toBe(level);
  });

  it('noise is capped at 100 and recomputes threat (journaled when it changes)', () => {
    const state = addDistrictNoise(newCampaign(), 'lefortovo', 250);
    expect(district(state, 'lefortovo')).toMatchObject({ noise: 100, threatLevel: 'extreme' });
    expect(state.log.find((e) => e.type === 'threatChanged')).toMatchObject({ districtId: 'lefortovo', from: 'low', to: 'extreme' });
    expect(state.log.find((e) => e.type === 'districtNoiseRose')).toMatchObject({ amount: 100, noise: 100 });
  });

  it('noise decays by 5 every turn, never below 0', () => {
    let state = setNoise(newCampaign(), 'lefortovo', 12);
    state = decayDistrictNoise(state);
    expect(district(state, 'lefortovo').noise).toBe(7);
    state = endTurns(state, 1);
    expect(district(state, 'lefortovo').noise).toBe(2);
    state = endTurns(state, 1);
    expect(district(state, 'lefortovo').noise).toBe(0);
  });

  it('a finished fight leaves all its combat noise in the district', () => {
    let state = newGame(3);
    state = run(state, { type: 'sendExpedition', locationId: LEFORTOVO_PHARMACY_ID, memberIds: [HERO_ID, MAXIM_ID], supplies: { ammunition: 12 } }, quietContent);
    state = run(state, { type: 'startCombat', expeditionId: trip(state).id, enemies: 1 }, quietContent);
    state = { ...state, combat: { ...state.combat!, combatNoise: 17, enemies: state.combat!.enemies.map((e) => ({ ...e, health: 0 })) } };
    const defend: CombatAction = { type: 'defend' };
    state = run(state, { type: 'setCombatAction', characterId: HERO_ID, action: defend }, quietContent);
    state = run(state, { type: 'setCombatAction', characterId: MAXIM_ID, action: defend }, quietContent);
    const before = district(state, 'lefortovo').noise;
    state = run(state, { type: 'confirmCombatRound' }, quietContent);
    expect(state.combat!.status).toBe('victory');
    expect(district(state, 'lefortovo').noise).toBe(before + 17);
    expect(district(state, 'lefortovo').threatLevel).toBe('low');
  });

  it('a retreat also leaves its noise behind; noise stays out of the in-fight rules', () => {
    let state = newGame(4);
    state = run(state, { type: 'sendExpedition', locationId: LEFORTOVO_PHARMACY_ID, memberIds: [HERO_ID], supplies: { ammunition: 5 } }, quietContent);
    state = run(state, { type: 'startCombat', expeditionId: trip(state).id, enemies: 1 }, quietContent);
    state = { ...state, combat: { ...state.combat!, combatNoise: 30 } };
    const out = withRng(state, (s) => run(s, { type: 'retreatFromCombat' }, quietContent), (s) => s.combat!.status === 'retreated');
    expect(district(out, 'lefortovo')).toMatchObject({ noise: 30, threatLevel: 'medium' });
  });
});

describe('threat → infected encounters', () => {
  const onTheRoad = (seed = 5) =>
    run(newCampaign(seed), { type: 'sendExpedition', locationId: LEFORTOVO_PHARMACY_ID, memberIds: [HERO_ID] }, quietContent);

  it('chance and size follow the threat table', () => {
    const expected: Record<ThreatLevel, [number, number, number]> = {
      low: [0.1, 1, 1],
      medium: [0.2, 1, 2],
      high: [0.35, 2, 3],
      extreme: [0.5, 3, 4],
    };
    const noiseFor: Record<ThreatLevel, number> = { low: 0, medium: 25, high: 50, extreme: 80 };
    for (const level of Object.keys(expected) as ThreatLevel[]) {
      const base = setNoise(onTheRoad(), 'lefortovo', noiseFor[level]);
      let fights = 0;
      const runs = 600;
      for (let rng = 0; rng < runs; rng += 1) {
        const result = rollInfectedEncounter({ ...base, rng }, GAME_CONTENT, trip(base));
        if (result.fought) {
          fights += 1;
          const n = result.state.combat!.enemies.length;
          expect(n).toBeGreaterThanOrEqual(expected[level][1]);
          expect(n).toBeLessThanOrEqual(expected[level][2]);
          expect(result.state.log.at(-2)).toMatchObject({ type: 'threatEncounter', threat: level, enemies: n });
        }
      }
      expect(Math.abs(fights / runs - expected[level][0])).toBeLessThan(0.06);
    }
  });

  it('is deterministic and starts a real fight during a normal turn', () => {
    const base = setNoise(onTheRoad(), 'lefortovo', 80);
    expect(rollInfectedEncounter(base, GAME_CONTENT, trip(base))).toEqual(rollInfectedEncounter(base, GAME_CONTENT, trip(base)));
    const world: GameContent = { ...GAME_CONTENT, events: {} };
    const fought = withRng(base, (s) => endTurn(s, world), (s) => s.combat !== null);
    expect(fought.combat!.expeditionId).toBe(trip(fought).id);
    expect(apply(fought, { type: 'endTurn' }, world)).toEqual({ ok: false, error: 'COMBAT_ACTIVE' });
  });
});

describe('factions: the Arena', () => {
  it('initial Arena state', () => {
    const a = arena(newCampaign());
    expect(a).toMatchObject({
      id: 'arena',
      manpower: 35,
      supplies: 50,
      controlledDistricts: ['sokolinaya_gora'],
      awarenessOfPlayer: 0,
      relationToPlayer: 0,
      status: 'active',
      currentOperation: null,
      contacted: false,
      lastKnownActivity: null,
    });
    expect(a.nextOperationAt).toBe(newCampaign().time + 6);
  });

  it('relation categories', () => {
    expect(relationCategory({ contacted: false, relationToPlayer: -90 })).toBe('unknown');
    expect(relationCategory({ contacted: true, relationToPlayer: 0 })).toBe('neutral');
    expect(relationCategory({ contacted: true, relationToPlayer: 40 })).toBe('neutral');
    expect(relationCategory({ contacted: true, relationToPlayer: -1 })).toBe('tension');
    expect(relationCategory({ contacted: true, relationToPlayer: -29 })).toBe('tension');
    expect(relationCategory({ contacted: true, relationToPlayer: -30 })).toBe('hostile');
    expect(relationCategory({ contacted: true, relationToPlayer: -69 })).toBe('hostile');
    expect(relationCategory({ contacted: true, relationToPlayer: -70 })).toBe('war');
  });

  it('awareness categories and manpower estimate', () => {
    expect([0, 1, 24, 25, 49, 50, 74, 75, 100].map(awarenessCategory)).toEqual([
      'none', 'rumors', 'rumors', 'knowsGroup', 'knowsGroup', 'watching', 'watching', 'hunting', 'hunting',
    ]);
    expect(manpowerEstimate({ contacted: false, manpower: 35 })).toBe('unknown');
    expect(manpowerEstimate({ contacted: true, manpower: 10 })).toBe('few');
    expect(manpowerEstimate({ contacted: true, manpower: 35 })).toBe('group');
    expect(manpowerEstimate({ contacted: true, manpower: 41 })).toBe('many');
  });

  it('Arena points are dangerous: no expeditions there', () => {
    for (const id of [ARENA_WAREHOUSE_ID, ARENA_GYM_ID]) {
      expect(apply(newGame(), { type: 'sendExpedition', locationId: id, memberIds: [HERO_ID] })).toEqual({
        ok: false,
        error: 'LOCATION_RESTRICTED',
      });
    }
  });
});

describe('first contact with the Arena', () => {
  /** Hero + Maxim reach the outskirts of Sokolinaya gora with some supplies. */
  function contact(seed = 1): GameState {
    let state = run(newGame(seed), {
      type: 'sendExpedition',
      locationId: SOKOLINAYA_OUTSKIRTS_ID,
      memberIds: [HERO_ID, MAXIM_ID],
      supplies: { food: 3, water: 3, ammunition: 12 },
    });
    state = endTurns(state, 2, storyOnly); // arrival after ceil(3/2) = 2 turns
    return state;
  }
  const choose = (state: GameState, choiceId: string) =>
    run(state, { type: 'resolveEvent', expeditionId: trip(state).id, choiceId });

  it('happens on arrival in Sokolinaya gora, as a story event, and never starts a fight', () => {
    const state = contact();
    expect(trip(state).pendingEventId).toBe('arena_first_contact');
    expect(state.combat).toBeNull();
    expect(state.log.some((e) => e.type === 'locationArrived')).toBe(true);
  });

  it('pay: supplies are handed over, a little awareness, relation stays neutral', () => {
    const before = contact();
    const state = choose(before, 'pay');
    expect(trip(state).supplies).toMatchObject({ food: 1, water: 1, ammunition: 7 });
    expect(arena(state)).toMatchObject({ contacted: true, awarenessOfPlayer: 10, relationToPlayer: 0 });
    expect(relationCategory(arena(state))).toBe('neutral');
    expect(state.storyFlags.arena_met).toBe(true);
    expect(state.combat).toBeNull();
    const types = state.log.map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(['factionContact', 'factionAwarenessChanged']));
    // The trip goes on.
    expect(trip(state).aborted).toBe(false);
  });

  it('refuse: awareness jumps, relation becomes tense, still no fight', () => {
    const state = choose(contact(), 'refuse');
    expect(arena(state)).toMatchObject({ awarenessOfPlayer: 30, relationToPlayer: -20 });
    expect(relationCategory(arena(state))).toBe('tension');
    expect(awarenessCategory(arena(state).awarenessOfPlayer)).toBe('knowsGroup');
    expect(state.combat).toBeNull();
    expect(state.log.find((e) => e.type === 'factionRelationChanged')).toMatchObject({ category: 'tension' });
  });

  it('slip away: deterministic success (trip aborted) or failure (threats, tension)', () => {
    const base = contact();
    const ok = withRng(base, (s) => choose(s, 'slip_away'), (s) => s.log.some((e) => e.type === 'eventChoice' && e.outcomeId === 'escaped'));
    expect(trip(ok).aborted).toBe(true);
    expect(arena(ok)).toMatchObject({ awarenessOfPlayer: 5, relationToPlayer: 0, contacted: true });
    const bad = withRng(base, (s) => choose(s, 'slip_away'), (s) => s.log.some((e) => e.type === 'eventChoice' && e.outcomeId === 'caught'));
    expect(trip(bad).aborted).toBe(false);
    expect(arena(bad)).toMatchObject({ awarenessOfPlayer: 15, relationToPlayer: -15 });
    expect(bad.combat).toBeNull();
    expect(choose(base, 'slip_away')).toEqual(choose(base, 'slip_away'));
  });

  it('happens only once', () => {
    let state = choose(contact(), 'pay');
    state = endTurns(state, 2, storyOnly);
    expect(state.expeditions).toHaveLength(0);
    state = run(state, { type: 'sendExpedition', locationId: SOKOLINAYA_OUTSKIRTS_ID, memberIds: [HERO_ID] });
    state = endTurns(state, 2, storyOnly);
    expect(trip(state).pendingEventId).toBeNull();
  });
});

describe('Arena operations (world tick)', () => {
  it('one operation every 6 hours', () => {
    let state = newCampaign(2);
    state = endTurns(state, 2);
    expect(state.worldEvents).toHaveLength(0);
    state = endTurns(state, 1);
    expect(state.worldEvents).toHaveLength(1);
    expect(arena(state).currentOperation).not.toBeNull();
    state = endTurns(state, 2);
    expect(state.worldEvents).toHaveLength(1);
    state = endTurns(state, 1);
    expect(state.worldEvents).toHaveLength(2);
    expect(arena(state).nextOperationAt).toBe(newCampaign().time + 18);
  });

  it('operation choice is deterministic and all three kinds occur', () => {
    const state = newCampaign();
    const definition = GAME_CONTENT.factions.arena!;
    expect(pickOperation(state, definition)).toEqual(pickOperation(state, definition));
    const kinds = new Set<string>();
    for (let rng = 0; rng < 200; rng += 1) kinds.add(pickOperation({ ...state, rng }, definition)[0]);
    expect([...kinds].sort()).toEqual(['intimidate', 'patrol', 'scavenge']);
  });

  const due = (s: GameState): GameState => ({ ...s, factions: { arena: { ...arena(s), nextOperationAt: s.time } } });
  const tick = (s: GameState) => factionTick(s, GAME_CONTENT);

  it('SCAVENGE adds supplies (hidden)', () => {
    const base = due(newCampaign());
    const state = withRng(base, tick, (s) => arena(s).currentOperation?.type === 'scavenge');
    expect(arena(state).supplies).toBe(55);
    expect(arena(state).manpower).toBe(35);
  });

  it('INTIMIDATE raises the noise of an uncontrolled neighbour', () => {
    const base = due(newCampaign());
    const state = withRng(base, tick, (s) => arena(s).currentOperation?.type === 'intimidate');
    const target = arena(state).currentOperation!.districtId;
    expect(['lefortovo', 'perovo', 'izmailovo']).toContain(target);
    expect(district(state, target)).toMatchObject({ noise: 10, lastWorldEventAt: state.time });
    expect(district(state, 'sokolinaya_gora').controller).toBe('arena'); // no territory change
  });

  it('hidden actions do not leak into the player journal', () => {
    const base = due(newCampaign());
    // Scavenging at home, nobody of ours there: recorded internally only.
    const secret = withRng(base, tick, (s) => arena(s).currentOperation?.type === 'scavenge');
    expect(secret.worldEvents.at(-1)).toMatchObject({ operation: 'scavenge', observed: false });
    expect(secret.log.some((e) => e.type === 'factionActivity')).toBe(false);
    expect(arena(secret).lastKnownActivity).toBeNull();

    // Intimidation in Lefortovo (our base district) is seen — but not who it was.
    const seen = withRng(base, tick, (s) => arena(s).currentOperation?.districtId === 'lefortovo');
    expect(seen.worldEvents.at(-1)).toMatchObject({ observed: true });
    expect(seen.log.find((e) => e.type === 'factionActivity')).toMatchObject({ districtId: 'lefortovo', identified: false });
    expect(arena(seen).lastKnownActivity).toMatchObject({ operation: 'intimidate', districtId: 'lefortovo' });

    // A patrol at home is seen only if our squad is in Sokolinaya gora.
    let away = run(newGame(7), { type: 'sendExpedition', locationId: SOKOLINAYA_OUTSKIRTS_ID, memberIds: [HERO_ID] }, quietContent);
    away = due(away);
    const patrol = withRng(away, tick, (s) => arena(s).currentOperation?.type === 'patrol');
    expect(patrol.worldEvents.at(-1)).toMatchObject({ observed: true, districtId: 'sokolinaya_gora' });
    expect(patrol.log.some((e) => e.type === 'factionActivity')).toBe(true);
  });

  it('faction intel exposes only what the player knows — never manpower or supplies', () => {
    const before = factionIntel(newCampaign(), GAME_CONTENT, 'arena')!;
    expect(before).toMatchObject({
      name: 'Неизвестная вооружённая группа',
      description: null,
      contacted: false,
      relation: 'unknown',
      awareness: 'none',
      manpower: 'unknown',
      knownTerritories: ['sokolinaya_gora'],
    });
    const json = JSON.stringify(before);
    expect(json).not.toMatch(/supplies|"manpower":\d/);
    expect(json).not.toContain('35');
    expect(json).not.toContain('50');
    expect(Object.keys(before).sort()).toEqual(
      ['awareness', 'contacted', 'contacts', 'description', 'id', 'knownTerritories', 'lastKnownActivity', 'manpower', 'name', 'relation'].sort(),
    );

    const met = { ...newCampaign(), factions: { arena: { ...arena(newCampaign()), contacted: true, awarenessOfPlayer: 30, relationToPlayer: -20 } } };
    const after = factionIntel(met, GAME_CONTENT, 'arena')!;
    expect(after).toMatchObject({ name: 'Арена', relation: 'tension', awareness: 'knowsGroup', manpower: 'group' });
    expect(after.description).toContain('силой');
  });
});

describe('world tick and pauses', () => {
  it('no extra world tick while a decision is pending', () => {
    let state = run(newCampaign(), { type: 'sendExpedition', locationId: SOKOLINAYA_OUTSKIRTS_ID, memberIds: [HERO_ID] });
    state = setNoise(endTurns(state, 2, storyOnly), 'lefortovo', 30);
    expect(trip(state).pendingEventId).toBe('arena_first_contact');
    expect(apply(state, { type: 'endTurn' })).toEqual({ ok: false, error: 'EVENT_PENDING' });
    // Nothing moved: the command was rejected, so no decay and no faction operation.
    expect(district(state, 'lefortovo').noise).toBe(30);
  });
});

describe('save / load and migrations', () => {
  it('world state survives save and load', () => {
    let state = setNoise(newCampaign(), 'lefortovo', 33);
    state = endTurns(state, 7);
    const storage = new MemoryStorage();
    saveGame(storage, state);
    expect(loadGame(storage)).toEqual(state);
  });

  it('v6 → v7: districts and the Arena are added, characters and story untouched', () => {
    const state = deserializeGame(JSON.stringify(SAVE_V6));
    expect(state).not.toBeNull();
    expect(state!.version).toBe(GAME_STATE_VERSION);
    expect(Object.keys(state!.districts)).toHaveLength(5);
    expect(district(state!, 'sokolinaya_gora').controller).toBe('arena');
    expect(arena(state!)).toMatchObject({ manpower: 35, contacted: false, nextOperationAt: SAVE_V6.time + 6 });
    expect(state!.worldEvents).toEqual([]);
    expect(state!.characters.map((c) => c.id)).toEqual(SAVE_V6.characters.map((c) => c.id));
    expect(state!.storyFlags).toEqual(SAVE_V6.storyFlags);
    expect(state!.recruits).toEqual(SAVE_V6.recruits);
    const later = endTurns(state!, 4);
    expect(later.worldEvents.length).toBeGreaterThan(0);
  });

  it('old Prototype 0.5 and older saves still work', () => {
    for (const save of [SAVE_V6, SAVE_V1]) {
      const state = deserializeGame(JSON.stringify(save));
      expect(state?.version).toBe(7);
      expect(state!.factions.arena).toBeDefined();
      expect(() => endTurns(state!, 5)).not.toThrow();
    }
  });
});
