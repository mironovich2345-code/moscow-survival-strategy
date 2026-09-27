import { describe, expect, it } from 'vitest';
import { HERO_ID, MAXIM_ID } from '@data/characters';
import { EVENTS } from '@data/events';
import { FIRE_AXE_1, PM_PISTOL_1, TOURIST_BACKPACK_1, WORK_JACKET_1 } from '@data/items';
import { LEFORTOVO_PHARMACY_ID, LEFORTOVO_POLICE_ID } from '@data/locations';
import {
  ENEMY_TYPES,
  MAX_REINFORCEMENTS,
  hitChance,
  incomingDamage,
  reinforcementChance,
  retreatChance,
  type CombatAction,
  type CombatLogEntry,
  type CombatState,
} from '@game/combat';
import {
  GAME_STATE_VERSION,
  applyCommand,
  deserializeGame,
  loadGame,
  saveGame,
  type CommandResult,
  type GameCommand,
  type GameState,
} from '@game/gameState';
import type { SuppliesRequest } from '@game/expeditions';
import { findItemLocation, findItemLocationErrors } from '@game/inventory';
import type { GameContent } from '@game/world';
import { SAVE_V4 } from './fixtures/saves';
import { MemoryStorage, content, endTurns, newGame, quietContent, withCharacter } from './helpers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const apply = (state: GameState, command: GameCommand, world: GameContent = quietContent): CommandResult =>
  applyCommand(state, command, world);

function run(state: GameState, command: GameCommand, world: GameContent = quietContent): GameState {
  const result = apply(state, command, world);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

interface FightOptions {
  readonly members?: readonly string[];
  readonly enemies?: number;
  readonly supplies?: SuppliesRequest;
  readonly seed?: number;
  readonly locationId?: string;
  readonly prepare?: (state: GameState) => GameState;
}

/** A squad on the road with a fresh fight (status 'setup'). */
function fight(options: FightOptions = {}): GameState {
  let state = newGame(options.seed ?? 1);
  if (options.prepare) state = options.prepare(state);
  state = run(state, {
    type: 'sendExpedition',
    locationId: options.locationId ?? LEFORTOVO_PHARMACY_ID,
    memberIds: options.members ?? [HERO_ID, MAXIM_ID],
    supplies: options.supplies ?? { ammunition: 12, medicine: 1 },
  });
  return run(state, { type: 'startCombat', expeditionId: state.expeditions[0]!.id, enemies: options.enemies ?? 1 });
}

const combat = (state: GameState): CombatState => state.combat!;
const trip = (state: GameState) => state.expeditions[0]!;
const char = (state: GameState, id: string) => state.characters.find((c) => c.id === id)!;
const enemy = (state: GameState, i = 0) => combat(state).enemies[i]!;
const act = (state: GameState, characterId: string, action: CombatAction) =>
  run(state, { type: 'setCombatAction', characterId, action });
const confirm = (state: GameState) => run(state, { type: 'confirmCombatRound' });
const logOf = <T extends CombatLogEntry['type']>(state: GameState, type: T) =>
  combat(state).log.filter((e): e is Extract<CombatLogEntry, { type: T }> => e.type === type);
const shoot = (targetId = 'enemy-1'): CombatAction => ({ type: 'attack', weaponSlot: 'sidearm', targetId });
const chop = (targetId = 'enemy-1'): CombatAction => ({ type: 'attack', weaponSlot: 'melee', targetId });

/** Tries RNG states until `step` gives a result that satisfies `want` (deterministic search). */
function withRng(state: GameState, step: (s: GameState) => GameState, want: (s: GameState) => boolean): GameState {
  for (let rng = 0; rng < 20000; rng += 1) {
    const result = step({ ...state, rng });
    if (want(result)) return result;
  }
  throw new Error('no rng found');
}

const setHealth = (state: GameState, id: string, health: number) =>
  withCharacter(state, id, (c) => ({ ...c, condition: { ...c.condition, health } }));

/** Give the hero a shotgun (primary) and a vest (body; jacket goes to storage). */
function armHero(state: GameState): GameState {
  const hero = char(state, HERO_ID);
  return {
    ...withCharacter(state, HERO_ID, (c) => ({
      ...c,
      equipment: { ...c.equipment, primary: 'pump_shotgun-90', body: 'police_vest-91' },
    })),
    items: {
      ...state.items,
      'pump_shotgun-90': { id: 'pump_shotgun-90', defId: 'pump_shotgun' },
      'police_vest-91': { id: 'police_vest-91', defId: 'police_vest' },
    },
    storage: { items: [...state.storage.items, hero.equipment.body!] },
  };
}

// ---------------------------------------------------------------------------

describe('starting a fight', () => {
  it('creates a CombatState for the expedition', () => {
    const state = fight({ enemies: 3 });
    const c = combat(state);
    expect(c.status).toBe('setup');
    expect(c.round).toBe(1);
    expect(c.expeditionId).toBe(trip(state).id);
    expect(c.enemies).toHaveLength(3);
    expect(c.enemies.every((e) => e.health === 70 && e.maxHealth === 70 && e.typeId === 'infected')).toBe(true);
    expect(c.positions).toEqual({ [HERO_ID]: 'front', [MAXIM_ID]: 'front' });
    expect(c.combatNoise).toBe(0);
    expect(c.reinforcementCount).toBe(0);
    expect(state.log.at(-1)).toMatchObject({ type: 'combatStarted', enemies: 3 });
    expect(findItemLocationErrors(state)).toEqual([]);
  });

  it('accepts 1–4 infected and only one fight at a time', () => {
    let state = newGame();
    state = run(state, { type: 'sendExpedition', locationId: LEFORTOVO_PHARMACY_ID, memberIds: [HERO_ID] });
    const id = trip(state).id;
    expect(apply(state, { type: 'startCombat', expeditionId: id, enemies: 0 })).toEqual({ ok: false, error: 'INVALID_ENEMY_COUNT' });
    expect(apply(state, { type: 'startCombat', expeditionId: id, enemies: 5 })).toEqual({ ok: false, error: 'INVALID_ENEMY_COUNT' });
    const started = run(state, { type: 'startCombat', expeditionId: id, enemies: 4 });
    expect(apply(started, { type: 'startCombat', expeditionId: id, enemies: 1 })).toEqual({ ok: false, error: 'COMBAT_ACTIVE' });
  });

  it('«Один заражённый» → «Вступить в бой» opens a fight', () => {
    let state = run(newGame(2), { type: 'sendExpedition', locationId: LEFORTOVO_PHARMACY_ID, memberIds: [HERO_ID] });
    state = { ...state, expeditions: [{ ...trip(state), pendingEventId: 'lone_infected', seenEventIds: ['lone_infected'] }] };
    const after = run(state, { type: 'resolveEvent', expeditionId: trip(state).id, choiceId: 'fight' }, content);
    expect(combat(after).enemies).toHaveLength(1);
    expect(trip(after).pendingEventId).toBeNull();
    expect(EVENTS.lone_infected.choices.map((c) => c.id)).toEqual(['fight', 'avoid']);
  });
});

describe('positions', () => {
  it('lines can be set in setup, max 3 per line, not after the first round', () => {
    let state = fight();
    state = run(state, { type: 'setCombatPosition', characterId: MAXIM_ID, line: 'back' });
    expect(combat(state).positions[MAXIM_ID]).toBe('back');
    const full: GameState = {
      ...state,
      combat: { ...combat(state), positions: { a: 'front', b: 'front', c: 'front', [HERO_ID]: 'back' } },
    };
    expect(apply(full, { type: 'setCombatPosition', characterId: HERO_ID, line: 'front' })).toEqual({ ok: false, error: 'LINE_FULL' });
    const later = confirm(state);
    expect(combat(later).status).not.toBe('setup');
    expect(apply(later, { type: 'setCombatPosition', characterId: MAXIM_ID, line: 'front' })).toEqual({ ok: false, error: 'NOT_IN_SETUP' });
  });

  it('melee only from FRONT, firearms from both lines', () => {
    let state = fight();
    state = run(state, { type: 'setCombatPosition', characterId: MAXIM_ID, line: 'back' });
    state = run(state, { type: 'setCombatPosition', characterId: HERO_ID, line: 'back' });
    expect(apply(state, { type: 'setCombatAction', characterId: MAXIM_ID, action: chop() })).toEqual({ ok: false, error: 'MELEE_FROM_BACK' });
    expect(apply(state, { type: 'setCombatAction', characterId: HERO_ID, action: shoot() }).ok).toBe(true);
    expect(apply(state, { type: 'setCombatAction', characterId: HERO_ID, action: chop() })).toEqual({ ok: false, error: 'NO_WEAPON' });
  });

  it('MOVE switches the line and takes the action', () => {
    let state = act(fight(), MAXIM_ID, { type: 'move' });
    state = confirm(state);
    expect(combat(state).positions[MAXIM_ID]).toBe('back');
    expect(logOf(state, 'move')).toMatchObject([{ actorId: MAXIM_ID, to: 'back' }]);
    expect(logOf(state, 'attack').some((e) => e.actorId === MAXIM_ID)).toBe(false);
  });

  it('infected attack FRONT first, BACK only when FRONT is empty', () => {
    let state = run(fight({ enemies: 4 }), { type: 'setCombatPosition', characterId: MAXIM_ID, line: 'back' });
    state = confirm(state);
    expect(logOf(state, 'enemyAttack').every((e) => e.targetId === HERO_ID)).toBe(true);
    let empty = run(fight({ enemies: 4 }), { type: 'setCombatPosition', characterId: MAXIM_ID, line: 'back' });
    empty = run(empty, { type: 'setCombatPosition', characterId: HERO_ID, line: 'back' });
    empty = confirm(empty);
    expect(logOf(empty, 'enemyAttack').length).toBeGreaterThan(0);
  });
});

describe('attacks', () => {
  it('a shot spends 1 ammunition of the expedition and never touches the base', () => {
    const state = fight({ supplies: { ammunition: 5 } });
    const base = state.resources.ammunition;
    const after = confirm(act(state, HERO_ID, shoot()));
    expect(trip(after).supplies.ammunition).toBe(4);
    expect(after.resources.ammunition).toBe(base);
    expect(logOf(after, 'attack')[0]).toMatchObject({ actorId: HERO_ID, weaponDefId: 'pm_pistol', ammoSpent: 1 });
  });

  it('no ammunition → cannot shoot', () => {
    const state = fight({ supplies: {} });
    expect(apply(state, { type: 'setCombatAction', characterId: HERO_ID, action: shoot() })).toEqual({ ok: false, error: 'NO_AMMUNITION' });
  });

  it('ammo running out in the same round: the second shot does not happen', () => {
    // Maxim gets a second pistol; one round of ammo for two shooters.
    const prepare = (s: GameState): GameState => ({
      ...withCharacter(s, MAXIM_ID, (c) => ({ ...c, equipment: { ...c.equipment, sidearm: 'pm_pistol-80' } })),
      items: { ...s.items, 'pm_pistol-80': { id: 'pm_pistol-80', defId: 'pm_pistol' } },
    });
    let state = fight({ supplies: { ammunition: 1 }, prepare, enemies: 2 });
    state = act(act(state, HERO_ID, shoot()), MAXIM_ID, shoot('enemy-2'));
    const after = confirm(state);
    expect(logOf(after, 'attackFailed')).toMatchObject([{ actorId: MAXIM_ID, reason: 'noAmmunition' }]);
    expect(trip(after).supplies.ammunition).toBe(0);
  });

  it('hit or miss is deterministic for the same state', () => {
    const state = act(fight({ seed: 5 }), HERO_ID, shoot());
    expect(confirm(state)).toEqual(confirm(state));
    const hit = withRng(state, confirm, (s) => logOf(s, 'attack')[0]?.hit === true);
    const miss = withRng(state, confirm, (s) => logOf(s, 'attack')[0]?.hit === false);
    expect(enemy(hit).health).toBe(70 - 30);
    expect(enemy(miss).health).toBe(70);
    expect(logOf(miss, 'attack')[0]!.damage).toBe(0);
  });

  it('hit chance = clamp(50 + 10 × skill, 20, 95)', () => {
    expect(hitChance(0)).toBe(50);
    expect(hitChance(2)).toBe(70);
    expect(hitChance(10)).toBe(95);
    expect(hitChance(-10)).toBe(20);
  });

  it('firearms skill drives shooting, melee skill drives melee', () => {
    const chanceWith = (skills: Partial<Record<'firearms' | 'melee', number>>, action: CombatAction, who: string) => {
      const prepare = (s: GameState) => withCharacter(s, who, (c) => ({ ...c, skills: { ...c.skills, ...skills } }));
      const state = confirm(act(fight({ prepare }), who, action));
      return logOf(state, 'attack').find((e) => e.actorId === who)!.chance;
    };
    expect(chanceWith({ firearms: 0 }, shoot(), HERO_ID)).toBe(50);
    expect(chanceWith({ firearms: 4 }, shoot(), HERO_ID)).toBe(90);
    expect(chanceWith({ firearms: 4, melee: 0 }, chop(), MAXIM_ID)).toBe(50);
    expect(chanceWith({ firearms: 0, melee: 3 }, chop(), MAXIM_ID)).toBe(80);
  });

  it('damage by weapon: ПМ 30, дробовик 60, топор 40; noise per attack', () => {
    const shot = withRng(act(fight(), HERO_ID, shoot()), confirm, (s) => logOf(s, 'attack')[0]?.hit === true);
    expect(logOf(shot, 'attack')[0]).toMatchObject({ damage: 30, noise: 6 });
    const blast = withRng(
      act(fight({ prepare: armHero }), HERO_ID, { type: 'attack', weaponSlot: 'primary', targetId: 'enemy-1' }),
      confirm,
      (s) => logOf(s, 'attack')[0]?.hit === true,
    );
    expect(logOf(blast, 'attack')[0]).toMatchObject({ weaponDefId: 'pump_shotgun', damage: 60, noise: 10 });
    const axe = withRng(act(fight(), MAXIM_ID, chop()), confirm, (s) => logOf(s, 'attack')[0]?.hit === true);
    expect(logOf(axe, 'attack')[0]).toMatchObject({ weaponDefId: 'fire_axe', damage: 40, noise: 1, ammoSpent: 0 });
  });

  it('an infected dies at 0 health; killing the last one is a victory', () => {
    let state = fight();
    state = { ...state, combat: { ...combat(state), enemies: [{ ...enemy(state), health: 30 }] } };
    const won = withRng(act(state, HERO_ID, shoot()), confirm, (s) => logOf(s, 'attack')[0]?.hit === true);
    expect(enemy(won).health).toBe(0);
    expect(logOf(won, 'attack')[0]!.killed).toBe(true);
    expect(combat(won).status).toBe('victory');
    expect(logOf(won, 'enemyAttack')).toEqual([]); // the dead do not bite
    expect(won.log.at(-1)).toMatchObject({ type: 'combatEnded', result: 'victory' });
  });
});

describe('armour, DEFEND, medicine', () => {
  it('damage = floor(raw × (100 − armour) × (100 − defend) / 10000)', () => {
    expect(incomingDamage(18, 0, false)).toBe(18);
    expect(incomingDamage(18, 5, false)).toBe(17);
    expect(incomingDamage(18, 25, false)).toBe(13);
    expect(incomingDamage(18, 5, true)).toBe(8);
    expect(incomingDamage(18, 25, true)).toBe(6);
  });

  const bitten = (state: GameState) => withRng(state, confirm, (s) => logOf(s, 'enemyAttack')[0]?.hit === true);

  it('the jacket and the vest reduce incoming damage', () => {
    // Only the hero stands in FRONT.
    const solo = (prepare?: (s: GameState) => GameState) =>
      run(fight(prepare ? { prepare } : {}), { type: 'setCombatPosition', characterId: MAXIM_ID, line: 'back' });
    const jacket = bitten(act(solo(), HERO_ID, shoot()));
    expect(logOf(jacket, 'enemyAttack')[0]).toMatchObject({ targetId: HERO_ID, armorPercent: 5, damage: 17 });
    expect(char(jacket, HERO_ID).condition.health).toBe(100 - 17);
    const vest = bitten(act(solo(armHero), HERO_ID, shoot()));
    expect(logOf(vest, 'enemyAttack')[0]).toMatchObject({ armorPercent: 25, damage: 13 });
    const none = bitten(act(solo(), MAXIM_ID, { type: 'defend' }));
    expect(logOf(none, 'enemyAttack')[0]!.targetId).toBe(HERO_ID);
  });

  it('DEFEND skips the attack and halves incoming damage until the next round', () => {
    const state = run(fight(), { type: 'setCombatPosition', characterId: MAXIM_ID, line: 'back' });
    const after = bitten(act(state, HERO_ID, { type: 'defend' }));
    expect(logOf(after, 'attack')).toEqual([]);
    expect(logOf(after, 'enemyAttack')[0]).toMatchObject({ defended: true, damage: 8 });
    expect(combat(after).defending).toEqual([]); // reset for the next round
  });

  it('a character without an action defends by default', () => {
    const after = confirm(fight());
    expect(logOf(after, 'defend').map((e) => e.byDefault)).toEqual([true, true]);
  });

  it('medicine: −1 medicine of the expedition, +30 health (not above max)', () => {
    let state = setHealth(fight({ supplies: { medicine: 2 } }), MAXIM_ID, 50);
    state = act(state, HERO_ID, { type: 'useMedicine', targetId: MAXIM_ID });
    state = run(state, { type: 'setCombatPosition', characterId: HERO_ID, line: 'back' });
    const after = withRng(state, confirm, (s) => logOf(s, 'enemyAttack')[0]?.hit === false);
    expect(char(after, MAXIM_ID).condition.health).toBe(80);
    expect(trip(after).supplies.medicine).toBe(1);
    expect(logOf(after, 'medicine')).toMatchObject([{ actorId: HERO_ID, targetId: MAXIM_ID, healed: 30 }]);
    const capped = confirm(act(setHealth(fight({ supplies: { medicine: 1 } }), HERO_ID, 90), HERO_ID, { type: 'useMedicine', targetId: HERO_ID }));
    expect(logOf(capped, 'medicine')[0]!.healed).toBe(10);
    expect(apply(fight({ supplies: {} }), { type: 'setCombatAction', characterId: HERO_ID, action: { type: 'useMedicine', targetId: HERO_ID } })).toEqual({ ok: false, error: 'NO_MEDICINE' });
  });
});

describe('death and equipment', () => {
  /** Hero (alone in FRONT, 1 health) gets bitten and dies. */
  function heroDies(options: FightOptions = {}): GameState {
    let state = setHealth(fight(options), HERO_ID, 1);
    state = run(state, { type: 'setCombatPosition', characterId: MAXIM_ID, line: 'back' });
    return withRng(state, confirm, (s) => char(s, HERO_ID).condition.health === 0);
  }

  it('the fallen: dead, out of the squad, equipment in expedition.lostItems — not in storage', () => {
    const state = heroDies();
    const hero = char(state, HERO_ID);
    expect(hero.assignment).toEqual({ type: 'dead' });
    expect(Object.values(hero.equipment).every((id) => id === null)).toBe(true);
    expect(trip(state).memberIds).toEqual([MAXIM_ID]);
    expect([...trip(state).lostItems].sort()).toEqual([PM_PISTOL_1, WORK_JACKET_1].sort());
    expect(state.storage.items).not.toContain(PM_PISTOL_1);
    expect(findItemLocation(state, PM_PISTOL_1)).toEqual({ type: 'fallen', expeditionId: trip(state).id });
    expect(findItemLocationErrors(state)).toEqual([]);
    expect(logOf(state, 'death')[0]).toMatchObject({ characterId: HERO_ID });
    expect(state.log.some((e) => e.type === 'characterDied')).toBe(true);
    expect(combat(state).positions[HERO_ID]).toBeUndefined();
  });

  it('victory: survivors pick up the fallen items that fit; they come home to storage', () => {
    let state = heroDies();
    state = { ...state, combat: { ...combat(state), enemies: combat(state).enemies.map((e) => ({ ...e, health: 1 })) } };
    state = run(state, { type: 'setCombatAction', characterId: MAXIM_ID, action: { type: 'move' } });
    state = confirm(state); // Maxim goes to FRONT
    state = withRng(act(state, MAXIM_ID, chop(combat(state).enemies.find((e) => e.health > 0)!.id)), confirm, (s) => combat(s).status === 'victory');
    // Maxim: capacity 25, carries 5 of equipment + a little ammo → both items (3) fit.
    expect([...trip(state).haulItems].sort()).toEqual([PM_PISTOL_1, WORK_JACKET_1].sort());
    expect(trip(state).lostItems).toEqual([]);
    expect(logOf(state, 'fallenItems')[0]).toMatchObject({ leftBehind: [] });
    state = run(state, { type: 'closeCombat' });
    const home = endTurns(state, 3);
    expect(home.expeditions).toHaveLength(0);
    expect(home.storage.items).toEqual(expect.arrayContaining([PM_PISTOL_1, WORK_JACKET_1]));
    expect(char(home, HERO_ID).assignment).toEqual({ type: 'dead' });
    expect(findItemLocationErrors(home)).toEqual([]);
  });

  it('victory without capacity: the rest is left in the location, never in storage', () => {
    // Maxim hands the backpack to the hero before the trip → Maxim has 10 capacity, 3 used by the axe.
    const prepare = (s: GameState) =>
      run(s, { type: 'moveItem', itemId: TOURIST_BACKPACK_1, to: { type: 'character', characterId: HERO_ID } });
    let state = heroDies({ prepare, supplies: { water: 7 } });
    state = { ...state, combat: { ...combat(state), enemies: combat(state).enemies.map((e) => ({ ...e, health: 0 })) } };
    state = confirm(state); // everyone already dead → victory
    const left = logOf(state, 'fallenItems')[0]!;
    expect(left.leftBehind.length).toBeGreaterThan(0);
    expect(trip(state).lostItems).toEqual(left.leftBehind);
    state = run(state, { type: 'closeCombat' });
    const home = endTurns(state, 3);
    for (const id of left.leftBehind) {
      expect(home.storage.items).not.toContain(id);
      expect(findItemLocation(home, id)).toEqual({ type: 'world', locationId: LEFORTOVO_PHARMACY_ID });
    }
    expect(findItemLocationErrors(home)).toEqual([]);
  });

  it('defeat: the expedition ends, nothing comes home, items stay in the location', () => {
    let state = fight({ members: [HERO_ID], supplies: { ammunition: 5, water: 2 } });
    state = setHealth(state, HERO_ID, 1);
    const base = state.resources;
    const lost = withRng(state, confirm, (s) => combat(s).status === 'defeat');
    expect(lost.expeditions).toEqual([]);
    expect(char(lost, HERO_ID).assignment).toEqual({ type: 'dead' });
    expect(lost.resources).toEqual(base);
    expect(lost.lostItems.map((l) => l.itemId).sort()).toEqual([PM_PISTOL_1, WORK_JACKET_1].sort());
    expect(lost.storage.items).toEqual([]);
    expect(lost.log.some((e) => e.type === 'expeditionLost')).toBe(true);
    expect(findItemLocationErrors(lost)).toEqual([]);
    const closed = run(lost, { type: 'closeCombat' });
    expect(apply(closed, { type: 'endTurn' }).ok).toBe(true);
  });

  it('the dead do not eat at midnight and do not count towards the group limit', () => {
    let state = heroDies();
    state = { ...state, combat: { ...combat(state), enemies: combat(state).enemies.map((e) => ({ ...e, health: 0 })) } };
    state = run(confirm(state), { type: 'closeCombat' });
    expect(state.characters.filter((c) => c.assignment.type !== 'dead')).toHaveLength(1);
    // Maxim is alone on the road; base has nobody alive → base stock untouched at night.
    const night = endTurns({ ...state, time: 238 }, 1);
    expect(night.resources.food).toBe(state.resources.food);
  });
});

describe('noise and reinforcements', () => {
  it('noise grows by weapon noise per attack and 2 per infected attack', () => {
    const state = act(act(fight({ enemies: 2 }), HERO_ID, shoot()), MAXIM_ID, chop());
    const after = confirm(state);
    const infectedAttacks = logOf(after, 'enemyAttack').length;
    expect(combat(after).combatNoise).toBe(6 + 1 + 2 * infectedAttacks);
  });

  it('chance: <15 → 0, ≥15 → 25 %, ≥25 → 50 %', () => {
    expect(reinforcementChance(14)).toBe(0);
    expect(reinforcementChance(15)).toBe(25);
    expect(reinforcementChance(24)).toBe(25);
    expect(reinforcementChance(25)).toBe(50);
  });

  const noisy = (noise: number, count = 0) => {
    const state = fight({ enemies: 1 });
    return { ...state, combat: { ...combat(state), combatNoise: noise, reinforcementCount: count } };
  };

  it('below the threshold no infected ever comes', () => {
    for (let rng = 0; rng < 200; rng += 1) {
      expect(logOf(confirm({ ...noisy(0), rng }), 'reinforcement')).toEqual([]);
    }
  });

  it('above the threshold they come sometimes, deterministically, never more than 3', () => {
    const comes = withRng(noisy(30), confirm, (s) => logOf(s, 'reinforcement').length === 1);
    expect(combat(comes).enemies).toHaveLength(2);
    expect(combat(comes).reinforcementCount).toBe(1);
    expect(enemy(comes, 1)).toMatchObject({ id: 'enemy-2', number: 2, health: 70 });
    expect(confirm(noisy(30))).toEqual(confirm(noisy(30)));
    for (let rng = 0; rng < 200; rng += 1) {
      expect(logOf(confirm({ ...noisy(40, MAX_REINFORCEMENTS), rng }), 'reinforcement')).toEqual([]);
    }
    let hits25 = 0;
    let hits50 = 0;
    for (let rng = 0; rng < 400; rng += 1) {
      if (logOf(confirm({ ...noisy(15), rng }), 'reinforcement').length) hits25 += 1;
      if (logOf(confirm({ ...noisy(25), rng }), 'reinforcement').length) hits50 += 1;
    }
    expect(hits25).toBeGreaterThan(40);
    expect(hits50).toBeGreaterThan(hits25);
  });
});

describe('retreat', () => {
  it('chance = clamp(50 + 10 × (alive − infected), 10, 90)', () => {
    expect(retreatChance(2, 1)).toBe(60);
    expect(retreatChance(1, 4)).toBe(20);
    expect(retreatChance(1, 9)).toBe(10);
    expect(retreatChance(5, 1)).toBe(90);
  });

  const retreat = (s: GameState) => run(s, { type: 'retreatFromCombat' });

  it('success: fight over, expedition aborted and heads home, finds kept', () => {
    let state = fight({ enemies: 2 });
    state = { ...state, expeditions: [{ ...trip(state), haul: { medicine: 2 } }] };
    const escaped = withRng(state, retreat, (s) => combat(s).status === 'retreated');
    expect(logOf(escaped, 'retreat')[0]).toMatchObject({ success: true, chance: 50 });
    expect(trip(escaped).aborted).toBe(true);
    expect(trip(escaped).returnsAt).toBe(escaped.time + 2);
    const home = endTurns(run(escaped, { type: 'closeCombat' }), 1);
    expect(home.expeditions).toHaveLength(0);
    // Found medicine (2) + the supply medicine that was never used (1).
    expect(home.resources.medicine).toBe(state.resources.medicine + 2 + trip(state).supplies.medicine);
  });

  it('failure: the round is lost and the infected attack', () => {
    const state = fight({ enemies: 2 });
    const stuck = withRng(state, retreat, (s) => combat(s).status === 'active');
    expect(logOf(stuck, 'retreat')[0]!.success).toBe(false);
    expect(logOf(stuck, 'attack')).toEqual([]);
    expect(logOf(stuck, 'enemyAttack')).toHaveLength(2);
    expect(combat(stuck).round).toBe(2);
  });
});

describe('fight and expedition', () => {
  it('the world is paused during a fight; after victory the trip continues', () => {
    let state = fight();
    const returnsAt = trip(state).returnsAt;
    expect(apply(state, { type: 'endTurn' })).toEqual({ ok: false, error: 'COMBAT_ACTIVE' });
    expect(apply(state, { type: 'moveItem', itemId: FIRE_AXE_1, to: { type: 'storage' } })).toEqual({ ok: false, error: 'ITEM_UNAVAILABLE' });
    state = { ...state, combat: { ...combat(state), enemies: [{ ...enemy(state), health: 1 }] } };
    state = withRng(act(state, MAXIM_ID, chop()), confirm, (s) => combat(s).status === 'victory');
    expect(apply(state, { type: 'endTurn' })).toEqual({ ok: false, error: 'COMBAT_ACTIVE' }); // until closed
    state = run(state, { type: 'closeCombat' });
    expect(state.combat).toBeNull();
    expect(trip(state).returnsAt).toBe(returnsAt);
    expect(trip(state).aborted).toBe(false);
    const home = endTurns(state, 3);
    expect(home.expeditions).toHaveLength(0);
    expect(home.log.some((e) => e.type === 'expeditionReturned')).toBe(true);
  });

  it('a running fight cannot be closed', () => {
    expect(apply(fight(), { type: 'closeCombat' })).toEqual({ ok: false, error: 'COMBAT_NOT_OVER' });
  });
});

describe('save / load', () => {
  it('an active fight survives save and load and continues identically', () => {
    let state = act(fight({ enemies: 3, prepare: armHero, locationId: LEFORTOVO_POLICE_ID }), HERO_ID, shoot('enemy-2'));
    state = confirm(state);
    state = act(state, MAXIM_ID, chop('enemy-1'));
    const storage = new MemoryStorage();
    saveGame(storage, state);
    const loaded = loadGame(storage);
    expect(loaded).toEqual(state);
    expect(confirm(loaded!)).toEqual(confirm(state));
  });

  it('v4 → v5: combat null, lostItems added, game plays on', () => {
    const state = deserializeGame(JSON.stringify(SAVE_V4));
    expect(state).not.toBeNull();
    expect(state!.version).toBe(GAME_STATE_VERSION);
    expect(state!.combat).toBeNull();
    expect(state!.lostItems).toEqual([]);
    expect(trip(state!)).toMatchObject({ lostItems: [], haulItems: ['crowbar-6'] });
    expect(findItemLocationErrors(state!)).toEqual([]);
    const home = endTurns(state!, 3);
    expect(home.storage.items).toContain('crowbar-6');
  });
});

describe('enemy type', () => {
  it('ordinary infected: 70 health, 18 damage, 75 % accuracy, noise 2', () => {
    expect(ENEMY_TYPES.infected).toEqual({ id: 'infected', maxHealth: 70, attackDamage: 18, accuracyPercent: 75, noise: 2 });
  });
});
