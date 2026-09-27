import { describe, expect, it } from 'vitest';
import { RESOURCE_KINDS, applyResourceDelta, createResources, hasResources } from '@game/resources';

describe('resources', () => {
  it('has the six prototype resources', () => {
    expect(RESOURCE_KINDS).toEqual(['food', 'water', 'medicine', 'ammunition', 'fuel', 'materials']);
  });

  it('creates zero-filled stock', () => {
    const r = createResources({ water: 3 });
    expect(r).toEqual({ food: 0, water: 3, medicine: 0, ammunition: 0, fuel: 0, materials: 0 });
  });

  it('applies deltas without going below zero and without mutating', () => {
    const r = createResources({ food: 5, medicine: 1 });
    const next = applyResourceDelta(r, { food: -10, medicine: 4 });
    expect(next.food).toBe(0);
    expect(next.medicine).toBe(5);
    expect(r.food).toBe(5);
  });

  it('checks costs', () => {
    const r = createResources({ fuel: 2 });
    expect(hasResources(r, { fuel: 2 })).toBe(true);
    expect(hasResources(r, { fuel: 3 })).toBe(false);
  });
});
