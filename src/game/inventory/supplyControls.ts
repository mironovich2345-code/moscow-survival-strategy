import type { GameState } from '../gameState/types';
import type { Supplies, SupplyKind } from './types';
import { squadLoad } from './weight';
import type { ItemCatalog } from './weight';

/** Applies a step (−10, −1, +1, +10…) and clamps the result to 0 … stock. */
export function adjustSupplyAmount(current: number, delta: number, stock: number): number {
  const upper = Math.max(0, Math.floor(stock));
  return Math.min(upper, Math.max(0, Math.floor(current + delta)));
}

/**
 * The largest amount of `kind` the squad can take: available in the base
 * stock AND fitting into the squad's free capacity together with the other
 * supplies. 0 when nobody is selected.
 */
export function maxSupplyThatFits(
  state: GameState,
  catalog: ItemCatalog,
  memberIds: readonly string[],
  supplies: Supplies,
  kind: SupplyKind,
): number {
  if (memberIds.length === 0) return 0;
  const stock = Math.max(0, state.resources[kind]);
  const fits = (amount: number) => {
    const load = squadLoad(state, catalog, memberIds, { ...supplies, [kind]: amount });
    return load.total <= load.capacity;
  };
  if (!fits(0)) return 0;
  // Weight is monotonic in the amount: binary search the largest fitting value.
  let low = 0;
  let high = stock;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (fits(mid)) low = mid;
    else high = mid - 1;
  }
  return low;
}
