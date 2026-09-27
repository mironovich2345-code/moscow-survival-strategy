/**
 * Deterministic pseudo-random number generator (mulberry32).
 *
 * The RNG state is a plain uint32 stored inside GameState, so the whole game
 * is reproducible from a seed and survives save/load. All functions are pure:
 * they return the value together with the next state.
 */

export type RngState = number;

export interface RandomResult<T> {
  readonly value: T;
  readonly state: RngState;
}

/** Normalises any number or string into a uint32 seed. */
export function createRngState(seed: number | string): RngState {
  if (typeof seed === 'number') {
    return seed >>> 0;
  }
  // FNV-1a hash for string seeds.
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Returns a float in [0, 1). */
export function nextFloat(state: RngState): RandomResult<number> {
  const nextState = (state + 0x6d2b79f5) >>> 0;
  let t = nextState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: nextState };
}

/** Returns an integer in [min, max] (both inclusive). */
export function nextInt(state: RngState, min: number, max: number): RandomResult<number> {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
    throw new RangeError(`Invalid integer range: [${min}, ${max}]`);
  }
  const { value, state: nextState } = nextFloat(state);
  return { value: min + Math.floor(value * (max - min + 1)), state: nextState };
}
