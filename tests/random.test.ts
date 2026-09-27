import { describe, expect, it } from 'vitest';
import { createRngState, nextFloat, nextInt } from '@game/random';

describe('rng', () => {
  it('is deterministic for the same seed', () => {
    const roll = (seed: number) => {
      let state = createRngState(seed);
      const values: number[] = [];
      for (let i = 0; i < 10; i += 1) {
        const r = nextFloat(state);
        values.push(r.value);
        state = r.state;
      }
      return values;
    };
    expect(roll(123)).toEqual(roll(123));
    expect(roll(123)).not.toEqual(roll(124));
  });

  it('hashes string seeds deterministically', () => {
    expect(createRngState('moscow')).toBe(createRngState('moscow'));
    expect(createRngState('moscow')).not.toBe(createRngState('moskva'));
  });

  it('keeps integers within inclusive bounds and hits both ends', () => {
    let state = createRngState(7);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i += 1) {
      const r = nextInt(state, 1, 5);
      expect(r.value).toBeGreaterThanOrEqual(1);
      expect(r.value).toBeLessThanOrEqual(5);
      seen.add(r.value);
      state = r.state;
    }
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('rejects invalid ranges', () => {
    expect(() => nextInt(1, 5, 1)).toThrow(RangeError);
  });
});
