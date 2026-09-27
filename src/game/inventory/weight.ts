import type { Character } from '../characters';
import { EQUIPMENT_SLOTS } from '../characters';
import type { GameState } from '../gameState/types';
import { RESOURCE_KINDS } from '../resources';
import type { ResourceDelta, ResourceKind } from '../resources';
import type { ItemDefinition, ItemDefId, ItemInstance } from './types';

/** Every character can carry this much without a backpack. */
export const BASE_CARRY_CAPACITY = 10;

/** How many units of a resource make one weight unit (rounded up). */
export const RESOURCE_UNITS_PER_WEIGHT: Readonly<Record<ResourceKind, number>> = {
  food: 1,
  water: 1,
  medicine: 1,
  ammunition: 10,
  fuel: 1,
  materials: 1,
};

export type ItemCatalog = Readonly<Record<ItemDefId, ItemDefinition>>;
export type ItemRegistry = Readonly<Record<string, ItemInstance>>;

/** Σ ceil(amount / unitsPerWeight) over resource kinds. Negative amounts count as 0. */
export function resourceWeight(resources: ResourceDelta): number {
  return RESOURCE_KINDS.reduce((sum, kind) => {
    const amount = Math.max(0, resources[kind] ?? 0);
    return sum + Math.ceil(amount / RESOURCE_UNITS_PER_WEIGHT[kind]);
  }, 0);
}

export function getItemDefinition(
  registry: ItemRegistry,
  catalog: ItemCatalog,
  instanceId: string,
): ItemDefinition | undefined {
  const instance = registry[instanceId];
  return instance ? catalog[instance.defId] : undefined;
}

function equippedDefinitions(
  character: Character,
  registry: ItemRegistry,
  catalog: ItemCatalog,
): ItemDefinition[] {
  return EQUIPMENT_SLOTS.flatMap((slot) => {
    const id = character.equipment[slot];
    const definition = id ? getItemDefinition(registry, catalog, id) : undefined;
    return definition ? [definition] : [];
  });
}

/** Weight of everything the character has equipped. */
export function equipmentWeight(
  character: Character,
  registry: ItemRegistry,
  catalog: ItemCatalog,
): number {
  return equippedDefinitions(character, registry, catalog).reduce((sum, d) => sum + d.weight, 0);
}

/** capacity = BASE_CARRY_CAPACITY + capacity bonuses of equipped items (the backpack). */
export function carryCapacity(
  character: Character,
  registry: ItemRegistry,
  catalog: ItemCatalog,
): number {
  return (
    BASE_CARRY_CAPACITY +
    equippedDefinitions(character, registry, catalog).reduce((sum, d) => sum + d.capacityBonus, 0)
  );
}

/** Total weight of the given item instances (e.g. an expedition's found items). */
export function itemsWeight(
  itemIds: readonly string[],
  registry: ItemRegistry,
  catalog: ItemCatalog,
): number {
  return itemIds.reduce((sum, id) => sum + (getItemDefinition(registry, catalog, id)?.weight ?? 0), 0);
}

export interface SquadLoad {
  readonly equipment: number;
  /** Found unique items carried in the haul. */
  readonly items: number;
  readonly resources: number;
  readonly total: number;
  readonly capacity: number;
}

/**
 * load = equipment of members + found items + weight of carried resources;
 * capacity = Σ member capacity.
 */
export function squadLoad(
  state: GameState,
  catalog: ItemCatalog,
  memberIds: readonly string[],
  carried: ResourceDelta,
  carriedItems: readonly string[] = [],
): SquadLoad {
  const members = state.characters.filter((c) => memberIds.includes(c.id));
  const equipment = members.reduce((sum, c) => sum + equipmentWeight(c, state.items, catalog), 0);
  const capacity = members.reduce((sum, c) => sum + carryCapacity(c, state.items, catalog), 0);
  const items = itemsWeight(carriedItems, state.items, catalog);
  const resources = resourceWeight(carried);
  return { equipment, items, resources, total: equipment + items + resources, capacity };
}

export interface FitResult {
  readonly accepted: Partial<Record<ResourceKind, number>>;
  readonly leftBehind: Partial<Record<ResourceKind, number>>;
}

/**
 * Adds `found` to `carried` unit by unit (in `order`) while the load stays
 * within capacity. `fixedWeight` is the non-resource part of the load (equipment).
 */
export function fitIntoCapacity(
  capacity: number,
  fixedWeight: number,
  carried: ResourceDelta,
  found: ResourceDelta,
  order: readonly ResourceKind[] = RESOURCE_KINDS,
): FitResult {
  const current: Partial<Record<ResourceKind, number>> = { ...carried };
  const accepted: Partial<Record<ResourceKind, number>> = {};
  const leftBehind: Partial<Record<ResourceKind, number>> = {};
  const seen = new Set<ResourceKind>();
  for (const kind of order) {
    if (seen.has(kind)) continue;
    seen.add(kind);
    const amount = Math.max(0, found[kind] ?? 0);
    let taken = 0;
    for (let i = 0; i < amount; i += 1) {
      const nextAmount = (current[kind] ?? 0) + 1;
      if (fixedWeight + resourceWeight({ ...current, [kind]: nextAmount }) > capacity) break;
      current[kind] = nextAmount;
      taken += 1;
    }
    if (taken > 0) accepted[kind] = taken;
    if (amount - taken > 0) leftBehind[kind] = amount - taken;
  }
  return { accepted, leftBehind };
}
