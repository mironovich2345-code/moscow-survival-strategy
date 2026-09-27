import { nextInt } from '../random';
import type { RngState } from '../random';
import type { ResourceDelta, ResourceKind } from '../resources';
import type { EventEffect, EventOutcome } from './types';

/** Weighted pick. A single outcome is returned without consuming the RNG. */
export function pickOutcome(
  rng: RngState,
  outcomes: readonly EventOutcome[],
): { readonly outcome: EventOutcome; readonly rng: RngState } {
  const [first] = outcomes;
  if (!first) throw new Error('Event choice has no outcomes');
  if (outcomes.length === 1) return { outcome: first, rng };

  const total = outcomes.reduce((sum, o) => sum + Math.max(0, o.weight), 0);
  if (total <= 0) return { outcome: first, rng };
  const roll = nextInt(rng, 1, total);
  let acc = 0;
  for (const outcome of outcomes) {
    acc += Math.max(0, outcome.weight);
    if (roll.value <= acc) return { outcome, rng: roll.state };
  }
  return { outcome: first, rng: roll.state };
}

/** Sums all resource effects into a single delta. */
export function sumResourceEffects(effects: readonly EventEffect[]): ResourceDelta {
  const result: Partial<Record<ResourceKind, number>> = {};
  for (const effect of effects) {
    if (effect.type !== 'resources') continue;
    for (const [kind, amount] of Object.entries(effect.delta) as [ResourceKind, number][]) {
      result[kind] = (result[kind] ?? 0) + amount;
    }
  }
  return result;
}
