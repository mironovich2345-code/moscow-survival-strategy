import type { Character } from '../characters';
import type { ItemCatalog, ItemDefinition, ItemRegistry } from '../inventory';
import { getItemDefinition } from '../inventory';

/** Pure combat formulas. Every number here is documented in GAME_RULES «Бой». */

export const HIT_CHANCE_BASE = 50;
export const HIT_CHANCE_PER_SKILL = 10;
export const HIT_CHANCE_MIN = 20;
export const HIT_CHANCE_MAX = 95;

export const DEFEND_REDUCTION_PERCENT = 50;
export const MEDICINE_HEAL = 30;

export const RETREAT_BASE = 50;
export const RETREAT_PER_DIFFERENCE = 10;
export const RETREAT_MIN = 10;
export const RETREAT_MAX = 90;

/** Checked from the top: the first threshold reached gives the chance. */
export const REINFORCEMENT_THRESHOLDS: readonly { readonly noise: number; readonly chance: number }[] = [
  { noise: 35, chance: 50 },
  { noise: 20, chance: 25 },
];
export const MAX_REINFORCEMENTS = 3;
export const MIN_ENEMIES = 1;
export const MAX_ENEMIES = 4;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function isFirearm(definition: ItemDefinition): boolean {
  return definition.category === 'firearm';
}

/** Melee weapons (and tools used as weapons) only work from the FRONT line. */
export function isMeleeWeapon(definition: ItemDefinition): boolean {
  return definition.weapon !== undefined && !isFirearm(definition);
}

/** firearms skill for firearms, melee skill for everything else. */
export function weaponSkill(character: Character, definition: ItemDefinition): number {
  return isFirearm(definition) ? character.skills.firearms : character.skills.melee;
}

/** hitChance = clamp(50 + 10 × skill, 20, 95) */
export function hitChance(skill: number): number {
  return clamp(HIT_CHANCE_BASE + HIT_CHANCE_PER_SKILL * skill, HIT_CHANCE_MIN, HIT_CHANCE_MAX);
}

/** Damage reduction % of the armour in the body slot (0 if none). */
export function armorPercent(character: Character, registry: ItemRegistry, catalog: ItemCatalog): number {
  const id = character.equipment.body;
  const definition = id ? getItemDefinition(registry, catalog, id) : undefined;
  return definition?.armor?.damageReductionPercent ?? 0;
}

/** damage = floor(raw × (100 − armor%) × (100 − defend%) / 10000) */
export function incomingDamage(raw: number, armor: number, defending: boolean): number {
  const defend = defending ? DEFEND_REDUCTION_PERCENT : 0;
  return Math.floor((raw * (100 - armor) * (100 - defend)) / 10000);
}

/** chance = clamp(50 + 10 × (alive characters − alive enemies), 10, 90) */
export function retreatChance(aliveCharacters: number, aliveEnemies: number): number {
  return clamp(
    RETREAT_BASE + RETREAT_PER_DIFFERENCE * (aliveCharacters - aliveEnemies),
    RETREAT_MIN,
    RETREAT_MAX,
  );
}

/** 0 % below 20, 25 % at 20–34, 50 % at 35 and above. */
export function reinforcementChance(noise: number): number {
  return REINFORCEMENT_THRESHOLDS.find((t) => noise >= t.noise)?.chance ?? 0;
}
