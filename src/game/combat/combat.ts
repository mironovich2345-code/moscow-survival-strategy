import { EQUIPMENT_SLOTS, findCharacter, isAlive } from '../characters';
import type { Character, CharacterId, ItemInstanceId } from '../characters';
import { carriedResources, carriesAtLeast, spendFromExpedition } from '../expeditions/cargo';
import type { Expedition } from '../expeditions/types';
import { addLogEntry, allocateId } from '../gameState/ids';
import type { GameState } from '../gameState/types';
import { getItemDefinition, squadLoad } from '../inventory';
import type { ItemCatalog, ItemDefinition } from '../inventory';
import { nextInt } from '../random';
import { advanceTurns } from '../time';
import type { GameContent } from '../world';
import {
  MAX_ENEMIES,
  MAX_REINFORCEMENTS,
  MEDICINE_HEAL,
  MIN_ENEMIES,
  armorPercent,
  hitChance,
  incomingDamage,
  isFirearm,
  isMeleeWeapon,
  reinforcementChance,
  retreatChance,
  weaponSkill,
} from './rules';
import { ENEMY_TYPES, MAX_PER_LINE } from './types';
import type {
  CombatAction,
  CombatEnemy,
  CombatError,
  CombatLine,
  CombatLogEntry,
  CombatState,
  CombatStatus,
  WeaponSlot,
} from './types';

export type CombatResult =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly error: CombatError };

const ok = (state: GameState): CombatResult => ({ ok: true, state });
const fail = (error: CombatError): CombatResult => ({ ok: false, error });

type NewCombatLog = CombatLogEntry extends infer E ? (E extends unknown ? Omit<E, 'round'> : never) : never;

// ---------------------------------------------------------------------------
// Small state helpers
// ---------------------------------------------------------------------------

function roll(state: GameState, min: number, max: number): [number, GameState] {
  const result = nextInt(state.rng, min, max);
  return [result.value, { ...state, rng: result.state }];
}

function setCombat(state: GameState, combat: CombatState): GameState {
  return { ...state, combat };
}

function log(state: GameState, entry: NewCombatLog): GameState {
  const combat = state.combat;
  if (!combat) return state;
  return setCombat(state, { ...combat, log: [...combat.log, { ...entry, round: combat.round } as CombatLogEntry] });
}

function expeditionOf(state: GameState, combat: CombatState): Expedition | undefined {
  return state.expeditions.find((e) => e.id === combat.expeditionId);
}

function replaceExpedition(state: GameState, expedition: Expedition): GameState {
  return { ...state, expeditions: state.expeditions.map((e) => (e.id === expedition.id ? expedition : e)) };
}

function updateCharacter(state: GameState, id: CharacterId, update: (c: Character) => Character): GameState {
  return { ...state, characters: state.characters.map((c) => (c.id === id ? update(c) : c)) };
}

/** Living combatants in roster order. */
export function livingCombatants(state: GameState): Character[] {
  const combat = state.combat;
  if (!combat) return [];
  return state.characters.filter((c) => combat.positions[c.id] !== undefined && isAlive(c));
}

export function livingEnemies(combat: CombatState): CombatEnemy[] {
  return combat.enemies.filter((e) => e.health > 0);
}

function lineCount(combat: CombatState, line: CombatLine, exceptId?: CharacterId): number {
  return Object.entries(combat.positions).filter(([id, l]) => l === line && id !== exceptId).length;
}

function otherLine(line: CombatLine): CombatLine {
  return line === 'front' ? 'back' : 'front';
}

export function isCombatOver(combat: CombatState): boolean {
  return combat.status === 'victory' || combat.status === 'retreated' || combat.status === 'defeat';
}

function weaponIn(
  state: GameState,
  catalog: ItemCatalog,
  character: Character,
  slot: WeaponSlot,
): ItemDefinition | undefined {
  const id = character.equipment[slot];
  const definition = id ? getItemDefinition(state.items, catalog, id) : undefined;
  return definition?.weapon ? definition : undefined;
}

function spawnEnemy(combat: CombatState): CombatState {
  const type = ENEMY_TYPES.infected;
  const enemy: CombatEnemy = {
    id: `enemy-${combat.nextEnemyNumber}`,
    typeId: type.id,
    number: combat.nextEnemyNumber,
    health: type.maxHealth,
    maxHealth: type.maxHealth,
  };
  return { ...combat, enemies: [...combat.enemies, enemy], nextEnemyNumber: combat.nextEnemyNumber + 1 };
}

// ---------------------------------------------------------------------------
// Creating a fight
// ---------------------------------------------------------------------------

/** Starts a fight for an expedition against N ordinary infected. */
export function startCombat(state: GameState, expeditionId: string, enemyCount: number): CombatResult {
  if (state.combat) return fail('COMBAT_ACTIVE');
  if (!Number.isInteger(enemyCount) || enemyCount < MIN_ENEMIES || enemyCount > MAX_ENEMIES) {
    return fail('INVALID_ENEMY_COUNT');
  }
  const expedition = state.expeditions.find((e) => e.id === expeditionId);
  if (!expedition || expedition.pendingEventId !== null) return fail('EXPEDITION_BUSY');

  const members = state.characters.filter((c) => expedition.memberIds.includes(c.id) && isAlive(c));
  if (members.length === 0) return fail('EXPEDITION_BUSY');
  const positions: Record<CharacterId, CombatLine> = {};
  members.forEach((c, i) => {
    positions[c.id] = i < MAX_PER_LINE ? 'front' : 'back';
  });

  const [combatId, withId] = allocateId(state, 'combat');
  let combat: CombatState = {
    id: combatId,
    expeditionId,
    locationId: expedition.locationId,
    startedAt: state.time,
    round: 1,
    status: 'setup',
    positions,
    enemies: [],
    selectedActions: {},
    defending: [],
    combatNoise: 0,
    reinforcementCount: 0,
    nextEnemyNumber: 1,
    fallen: [],
    log: [],
  };
  for (let i = 0; i < enemyCount; i += 1) combat = spawnEnemy(combat);
  let next = log(setCombat(withId, combat), { type: 'start', enemies: enemyCount });
  next = addLogEntry(next, {
    type: 'combatStarted',
    expeditionId,
    locationId: expedition.locationId,
    enemies: enemyCount,
  });
  return ok(next);
}

// ---------------------------------------------------------------------------
// Setup and action selection
// ---------------------------------------------------------------------------

export function setCombatPosition(state: GameState, characterId: CharacterId, line: CombatLine): CombatResult {
  const combat = state.combat;
  if (!combat) return fail('NO_COMBAT');
  if (combat.status !== 'setup') return fail('NOT_IN_SETUP');
  if (combat.positions[characterId] === undefined) return fail('NOT_A_COMBATANT');
  if (combat.positions[characterId] === line) return ok(state);
  if (lineCount(combat, line, characterId) >= MAX_PER_LINE) return fail('LINE_FULL');
  return ok(setCombat(state, { ...combat, positions: { ...combat.positions, [characterId]: line } }));
}

/** Checks that an action is possible right now (the round re-checks when it resolves). */
export function validateCombatAction(
  state: GameState,
  content: GameContent,
  characterId: CharacterId,
  action: CombatAction,
): CombatError | null {
  const combat = state.combat;
  if (!combat) return 'NO_COMBAT';
  if (isCombatOver(combat)) return 'COMBAT_OVER';
  const character = findCharacter(state.characters, characterId);
  const line = combat.positions[characterId];
  if (!character || !isAlive(character) || line === undefined) return 'NOT_A_COMBATANT';
  const expedition = expeditionOf(state, combat);

  switch (action.type) {
    case 'attack': {
      const weapon = weaponIn(state, content.items, character, action.weaponSlot);
      if (!weapon?.weapon) return 'NO_WEAPON';
      if (isMeleeWeapon(weapon) && line !== 'front') return 'MELEE_FROM_BACK';
      if (isFirearm(weapon) && (!expedition || !carriesAtLeast(expedition, { ammunition: weapon.weapon.ammoPerAttack }))) {
        return 'NO_AMMUNITION';
      }
      if (!combat.enemies.some((e) => e.id === action.targetId && e.health > 0)) return 'UNKNOWN_TARGET';
      return null;
    }
    case 'defend':
      return null;
    case 'move':
      return lineCount(combat, otherLine(line)) >= MAX_PER_LINE ? 'LINE_FULL' : null;
    case 'useMedicine': {
      if (!expedition || !carriesAtLeast(expedition, { medicine: 1 })) return 'NO_MEDICINE';
      const target = findCharacter(state.characters, action.targetId);
      if (!target || !isAlive(target) || combat.positions[target.id] === undefined) return 'UNKNOWN_TARGET';
      return null;
    }
  }
}

export function setCombatAction(
  state: GameState,
  content: GameContent,
  characterId: CharacterId,
  action: CombatAction,
): CombatResult {
  const error = validateCombatAction(state, content, characterId, action);
  if (error) return fail(error);
  const combat = state.combat!;
  return ok(setCombat(state, { ...combat, selectedActions: { ...combat.selectedActions, [characterId]: action } }));
}

// ---------------------------------------------------------------------------
// Death
// ---------------------------------------------------------------------------

/**
 * A character falls: health 0, assignment dead, removed from the squad and
 * the lines; every equipped item goes to expedition.lostItems (never storage).
 */
function killCharacter(state: GameState, characterId: CharacterId): GameState {
  const combat = state.combat;
  const character = findCharacter(state.characters, characterId);
  if (!combat || !character) return state;
  const expedition = expeditionOf(state, combat);
  const items: ItemInstanceId[] = EQUIPMENT_SLOTS.flatMap((slot) => {
    const id = character.equipment[slot];
    return id ? [id] : [];
  });
  const emptyEquipment = Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot, null])) as Character['equipment'];

  let next = updateCharacter(state, characterId, (c) => ({
    ...c,
    condition: { ...c.condition, health: 0 },
    equipment: emptyEquipment,
    assignment: { type: 'dead' },
  }));
  if (expedition) {
    next = replaceExpedition(next, {
      ...expedition,
      memberIds: expedition.memberIds.filter((id) => id !== characterId),
      lostItems: [...expedition.lostItems, ...items],
    });
  }
  const positions = { ...combat.positions };
  delete positions[characterId];
  next = setCombat(next, {
    ...combat,
    positions,
    fallen: [...combat.fallen, characterId],
    defending: combat.defending.filter((id) => id !== characterId),
  });
  next = log(next, { type: 'death', characterId, items });
  return addLogEntry(next, { type: 'characterDied', characterId, expeditionId: combat.expeditionId });
}

// ---------------------------------------------------------------------------
// Player phase
// ---------------------------------------------------------------------------

function resolveAttack(
  state: GameState,
  content: GameContent,
  character: Character,
  action: Extract<CombatAction, { type: 'attack' }>,
): GameState {
  const combat = state.combat!;
  const weapon = weaponIn(state, content.items, character, action.weaponSlot);
  if (!weapon?.weapon) return log(state, { type: 'attackFailed', actorId: character.id, reason: 'noWeapon' });
  if (isMeleeWeapon(weapon) && combat.positions[character.id] !== 'front') {
    return log(state, { type: 'attackFailed', actorId: character.id, reason: 'meleeFromBack' });
  }
  const target =
    combat.enemies.find((e) => e.id === action.targetId && e.health > 0) ?? livingEnemies(combat)[0];
  if (!target) return log(state, { type: 'attackFailed', actorId: character.id, reason: 'noTarget' });

  let next = state;
  let ammoSpent = 0;
  if (isFirearm(weapon)) {
    const expedition = expeditionOf(next, combat);
    const need = weapon.weapon.ammoPerAttack;
    if (!expedition || !carriesAtLeast(expedition, { ammunition: need })) {
      return log(next, { type: 'attackFailed', actorId: character.id, reason: 'noAmmunition' });
    }
    next = replaceExpedition(next, spendFromExpedition(expedition, { ammunition: need }).expedition);
    ammoSpent = need;
  }

  const chance = hitChance(weaponSkill(character, weapon));
  const [value, rolled] = roll(next, 1, 100);
  next = rolled;
  const hit = value <= chance;
  const damage = hit ? weapon.weapon.damage : 0;
  const health = Math.max(0, target.health - damage);
  const current = next.combat!;
  next = setCombat(next, {
    ...current,
    combatNoise: current.combatNoise + weapon.weapon.noise,
    enemies: current.enemies.map((e) => (e.id === target.id ? { ...e, health } : e)),
  });
  return log(next, {
    type: 'attack',
    actorId: character.id,
    weaponDefId: weapon.id,
    targetId: target.id,
    chance,
    hit,
    damage,
    ammoSpent,
    noise: weapon.weapon.noise,
    killed: hit && health === 0,
  });
}

function resolvePlayerAction(
  state: GameState,
  content: GameContent,
  character: Character,
  action: CombatAction | undefined,
): GameState {
  const combat = state.combat!;
  if (!action || action.type === 'defend') {
    const next = setCombat(state, { ...combat, defending: [...combat.defending, character.id] });
    return log(next, { type: 'defend', actorId: character.id, byDefault: !action });
  }
  switch (action.type) {
    case 'attack':
      return resolveAttack(state, content, character, action);
    case 'move': {
      const line = combat.positions[character.id];
      if (!line) return state;
      const to = otherLine(line);
      if (lineCount(combat, to) >= MAX_PER_LINE) return log(state, { type: 'moveFailed', actorId: character.id });
      const next = setCombat(state, { ...combat, positions: { ...combat.positions, [character.id]: to } });
      return log(next, { type: 'move', actorId: character.id, to });
    }
    case 'useMedicine': {
      const expedition = expeditionOf(state, combat);
      const target = findCharacter(state.characters, action.targetId);
      if (!expedition || !carriesAtLeast(expedition, { medicine: 1 }) || !target || !isAlive(target)) {
        return log(state, { type: 'medicineFailed', actorId: character.id });
      }
      let next = replaceExpedition(state, spendFromExpedition(expedition, { medicine: 1 }).expedition);
      const healed = Math.min(MEDICINE_HEAL, target.condition.maxHealth - target.condition.health);
      next = updateCharacter(next, target.id, (c) => ({
        ...c,
        condition: { ...c.condition, health: c.condition.health + healed },
      }));
      return log(next, { type: 'medicine', actorId: character.id, targetId: target.id, healed });
    }
  }
}

// ---------------------------------------------------------------------------
// Infected phase, reinforcements, round end
// ---------------------------------------------------------------------------

function enemyPhase(state: GameState, content: GameContent): GameState {
  let next = state;
  for (const original of state.combat!.enemies) {
    const combat = next.combat!;
    const enemy = combat.enemies.find((e) => e.id === original.id);
    if (!enemy || enemy.health <= 0) continue;
    const living = livingCombatants(next);
    const front = living.filter((c) => combat.positions[c.id] === 'front');
    const candidates = front.length > 0 ? front : living;
    if (candidates.length === 0) break;

    const type = ENEMY_TYPES[enemy.typeId];
    const [pick, afterPick] = roll(next, 0, candidates.length - 1);
    const target = candidates[pick]!;
    const [value, afterHit] = roll(afterPick, 1, 100);
    next = afterHit;
    const hit = value <= type.accuracyPercent;
    const armor = armorPercent(target, next.items, content.items);
    const defended = combat.defending.includes(target.id);
    const damage = hit ? incomingDamage(type.attackDamage, armor, defended) : 0;
    next = setCombat(next, { ...next.combat!, combatNoise: next.combat!.combatNoise + type.noise });
    next = updateCharacter(next, target.id, (c) => ({
      ...c,
      condition: { ...c.condition, health: Math.max(0, c.condition.health - damage) },
    }));
    next = log(next, {
      type: 'enemyAttack',
      enemyId: enemy.id,
      targetId: target.id,
      chance: type.accuracyPercent,
      hit,
      damage,
      rawDamage: type.attackDamage,
      armorPercent: armor,
      defended,
      noise: type.noise,
    });
    const after = findCharacter(next.characters, target.id);
    if (after && after.condition.health <= 0) next = killCharacter(next, target.id);
  }
  return next;
}

function reinforcements(state: GameState): GameState {
  const combat = state.combat!;
  if (combat.reinforcementCount >= MAX_REINFORCEMENTS) return state;
  const chance = reinforcementChance(combat.combatNoise);
  if (chance === 0) return state;
  const [value, rolled] = roll(state, 1, 100);
  if (value > chance) return rolled;
  const spawned = spawnEnemy({ ...combat, reinforcementCount: combat.reinforcementCount + 1 });
  const enemy = spawned.enemies[spawned.enemies.length - 1]!;
  return log(setCombat(rolled, spawned), {
    type: 'reinforcement',
    enemyId: enemy.id,
    chance,
    noise: combat.combatNoise,
  });
}

/** Enemies act, defeat check, reinforcements, next round. */
function finishRound(state: GameState, content: GameContent): GameState {
  let next = enemyPhase(state, content);
  if (livingCombatants(next).length === 0) return endCombat(next, 'defeat');
  next = reinforcements(next);
  const combat = next.combat!;
  return setCombat(next, { ...combat, round: combat.round + 1, selectedActions: {}, defending: [] });
}

export function confirmCombatRound(state: GameState, content: GameContent): CombatResult {
  const combat = state.combat;
  if (!combat) return fail('NO_COMBAT');
  if (isCombatOver(combat)) return fail('COMBAT_OVER');

  let next = setCombat(state, { ...combat, status: 'active', defending: [] });
  for (const character of livingCombatants(next)) {
    const current = findCharacter(next.characters, character.id);
    if (!current || !isAlive(current)) continue;
    next = resolvePlayerAction(next, content, current, combat.selectedActions[character.id]);
  }
  if (livingEnemies(next.combat!).length === 0) return ok(endCombat(next, 'victory', content));
  return ok(finishRound(next, content));
}

export function attemptRetreat(state: GameState, content: GameContent): CombatResult {
  const combat = state.combat;
  if (!combat) return fail('NO_COMBAT');
  if (isCombatOver(combat)) return fail('COMBAT_OVER');
  const chance = retreatChance(livingCombatants(state).length, livingEnemies(combat).length);
  const [value, rolled] = roll(state, 1, 100);
  const success = value <= chance;
  let next = log(setCombat(rolled, { ...combat, status: 'active', defending: [] }), {
    type: 'retreat',
    chance,
    success,
  });
  if (success) return ok(endCombat(next, 'retreated'));
  // The round is lost: nobody acts, the infected attack.
  next = setCombat(next, { ...next.combat!, selectedActions: {} });
  return ok(finishRound(next, content));
}

// ---------------------------------------------------------------------------
// Ending
// ---------------------------------------------------------------------------

/** After a victory the survivors pick up the fallen's items one by one while they fit. */
function recoverFallenItems(state: GameState, content: GameContent): GameState {
  const combat = state.combat!;
  const expedition = expeditionOf(state, combat);
  if (!expedition || expedition.lostItems.length === 0) return state;
  let current = expedition;
  const recovered: ItemInstanceId[] = [];
  const leftBehind: ItemInstanceId[] = [];
  for (const id of expedition.lostItems) {
    const definition = getItemDefinition(state.items, content.items, id);
    const load = squadLoad(state, content.items, current.memberIds, carriedResources(current), current.haulItems);
    if (definition && load.total + definition.weight <= load.capacity) {
      current = { ...current, haulItems: [...current.haulItems, id] };
      recovered.push(id);
    } else {
      leftBehind.push(id);
    }
  }
  current = { ...current, lostItems: leftBehind };
  return log(replaceExpedition(state, current), { type: 'fallenItems', recovered, leftBehind });
}

function endCombat(state: GameState, status: CombatStatus, content?: GameContent): GameState {
  const combat = state.combat!;
  let next = setCombat(state, { ...combat, status, selectedActions: {}, defending: [] });
  if (status === 'victory' && content) next = recoverFallenItems(next, content);

  const expedition = expeditionOf(next, combat);
  if (status === 'retreated' && expedition) {
    next = replaceExpedition(next, {
      ...expedition,
      aborted: true,
      returnsAt: Math.min(expedition.returnsAt, advanceTurns(next.time, 1)),
    });
  }
  if (status === 'defeat' && expedition) {
    // Nobody is left: supplies and found resources are gone; items stay in the location.
    const lost = [...expedition.haulItems, ...expedition.lostItems].map((itemId) => ({
      itemId,
      locationId: expedition.locationId,
      at: next.time,
    }));
    next = {
      ...next,
      expeditions: next.expeditions.filter((e) => e.id !== expedition.id),
      lostItems: [...next.lostItems, ...lost],
    };
    next = addLogEntry(next, {
      type: 'expeditionLost',
      expeditionId: expedition.id,
      locationId: expedition.locationId,
      itemsLost: lost.map((l) => l.itemId),
    });
  }
  next = log(next, { type: 'outcome', status });
  const final = next.combat!;
  return addLogEntry(next, {
    type: 'combatEnded',
    expeditionId: combat.expeditionId,
    result: status,
    rounds: final.round,
    fallen: final.fallen,
  });
}

/** Removes a finished fight so the world can go on. */
export function closeCombat(state: GameState): CombatResult {
  if (!state.combat) return fail('NO_COMBAT');
  if (!isCombatOver(state.combat)) return fail('COMBAT_NOT_OVER');
  return ok({ ...state, combat: null });
}
