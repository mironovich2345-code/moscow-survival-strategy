import { allocateId } from '../gameState/ids';
import type { GameState } from '../gameState/types';
import { SUPPLY_KINDS, fitIntoCapacity, squadLoad } from '../inventory';
import type { ItemCatalog, ItemDefId, ItemInstance, Supplies } from '../inventory';
import { RESOURCE_KINDS } from '../resources';
import type { ResourceDelta, ResourceKind } from '../resources';
import type { Expedition } from './types';

type MutableDelta = Partial<Record<ResourceKind, number>>;

/** Adds two deltas; keys present in either input are kept. */
export function addDeltas(a: ResourceDelta, b: ResourceDelta): ResourceDelta {
  const result: MutableDelta = {};
  for (const kind of RESOURCE_KINDS) {
    if (a[kind] !== undefined || b[kind] !== undefined) result[kind] = (a[kind] ?? 0) + (b[kind] ?? 0);
  }
  return result;
}

/** Drops zero entries (for compact logs). */
export function compactDelta(delta: ResourceDelta): ResourceDelta {
  const result: MutableDelta = {};
  for (const kind of RESOURCE_KINDS) {
    const amount = delta[kind] ?? 0;
    if (amount !== 0) result[kind] = amount;
  }
  return result;
}

/** Everything the squad carries: supplies + haul. */
export function carriedResources(expedition: Expedition): ResourceDelta {
  return addDeltas(expedition.supplies, expedition.haul);
}

/** Does the squad carry at least `required` of each resource (supplies + haul)? */
export function carriesAtLeast(expedition: Expedition, required: ResourceDelta): boolean {
  const carried = carriedResources(expedition);
  return RESOURCE_KINDS.every((kind) => (carried[kind] ?? 0) >= (required[kind] ?? 0));
}

export interface SpendResult {
  readonly expedition: Expedition;
  readonly spent: ResourceDelta;
  /** What was needed but not available. */
  readonly missing: ResourceDelta;
}

/** Spends from supplies first, then from haul of the same kind. Never below 0. */
export function spendFromExpedition(expedition: Expedition, need: ResourceDelta): SpendResult {
  const supplies: Record<(typeof SUPPLY_KINDS)[number], number> = { ...expedition.supplies };
  const haul: MutableDelta = { ...expedition.haul };
  const spent: MutableDelta = {};
  const missing: MutableDelta = {};
  for (const kind of RESOURCE_KINDS) {
    let remaining = Math.max(0, need[kind] ?? 0);
    if (remaining === 0) continue;
    if (kind === 'food' || kind === 'water' || kind === 'medicine' || kind === 'ammunition') {
      const fromSupplies = Math.min(supplies[kind], remaining);
      supplies[kind] -= fromSupplies;
      remaining -= fromSupplies;
    }
    const fromHaul = Math.min(haul[kind] ?? 0, remaining);
    if (fromHaul > 0) haul[kind] = (haul[kind] ?? 0) - fromHaul;
    remaining -= fromHaul;
    const taken = Math.max(0, need[kind] ?? 0) - remaining;
    if (taken > 0) spent[kind] = taken;
    if (remaining > 0) missing[kind] = remaining;
  }
  return {
    expedition: { ...expedition, supplies: supplies as Supplies, haul: compactDelta(haul) },
    spent,
    missing,
  };
}

export interface FindResult {
  readonly expedition: Expedition;
  readonly accepted: ResourceDelta;
  readonly leftBehind: ResourceDelta;
}

/** How much of `found` the squad can still carry, unit by unit in `order`. */
export function fitFindings(
  state: GameState,
  catalog: ItemCatalog,
  expedition: Expedition,
  found: ResourceDelta,
  order: readonly ResourceKind[] = RESOURCE_KINDS,
): { readonly accepted: ResourceDelta; readonly leftBehind: ResourceDelta } {
  const load = squadLoad(
    state,
    catalog,
    expedition.memberIds,
    carriedResources(expedition),
    expedition.haulItems,
  );
  return fitIntoCapacity(
    load.capacity,
    load.equipment + load.items,
    carriedResources(expedition),
    found,
    order,
  );
}

/** Puts findings into the haul, as far as capacity allows. */
export function addFindingsToHaul(
  state: GameState,
  catalog: ItemCatalog,
  expedition: Expedition,
  found: ResourceDelta,
): FindResult {
  const { accepted, leftBehind } = fitFindings(state, catalog, expedition, found);
  return {
    expedition: { ...expedition, haul: compactDelta(addDeltas(expedition.haul, accepted)) },
    accepted,
    leftBehind,
  };
}

export interface TakeItemsResult {
  readonly state: GameState;
  readonly expedition: Expedition;
  /** Items the squad took, with their new stable instance ids. */
  readonly taken: readonly ItemInstance[];
  /** Definitions of items that did not fit and were left where they were. */
  readonly leftBehind: readonly ItemDefId[];
}

/**
 * Tries to pick up found unique items one by one. An item is taken only if it
 * fits into the free capacity as a whole; nothing already carried is dropped
 * for it. Taken items get a stable id (`<defId>-<nextId>`), are registered in
 * GameState.items and placed into the expedition's haulItems.
 */
export function takeFoundItems(
  state: GameState,
  catalog: ItemCatalog,
  expedition: Expedition,
  defIds: readonly ItemDefId[],
): TakeItemsResult {
  let next = state;
  let current = expedition;
  const taken: ItemInstance[] = [];
  const leftBehind: ItemDefId[] = [];
  for (const defId of defIds) {
    const definition = catalog[defId];
    if (!definition) continue;
    const load = squadLoad(next, catalog, current.memberIds, carriedResources(current), current.haulItems);
    if (load.total + definition.weight > load.capacity) {
      leftBehind.push(defId);
      continue;
    }
    const [id, withId] = allocateId(next, defId);
    const instance: ItemInstance = { id, defId };
    current = { ...current, haulItems: [...current.haulItems, id] };
    next = {
      ...withId,
      items: { ...withId.items, [id]: instance },
      expeditions: withId.expeditions.map((e) => (e.id === current.id ? current : e)),
    };
    taken.push(instance);
  }
  return { state: next, expedition: current, taken, leftBehind };
}
