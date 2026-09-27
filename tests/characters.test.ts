import { describe, expect, it } from 'vitest';
import { MAXIM, HERO } from '@data/characters';
import {
  MAX_GROUP_SIZE,
  addCharacterToGroup,
  createCharacter,
  isAvailableForSquad,
  type Character,
} from '@game/characters';
import { newGame } from './helpers';

describe('characters', () => {
  it('new game has the hero and Maxim at the base', () => {
    const state = newGame();
    expect(state.characters.map((c) => c.name)).toEqual(['Герой', 'Максим']);
    expect(state.characters.filter((c) => c.isHero)).toHaveLength(1);
    expect(state.characters.every(isAvailableForSquad)).toBe(true);
  });

  it('characters carry attributes, skills, equipment and condition', () => {
    const maxim = createCharacter(MAXIM);
    expect(maxim.attributes.strength).toBeGreaterThan(0);
    expect(maxim.skills.melee).toBeGreaterThan(0);
    expect(maxim.equipment.melee).toBe('fire_axe-1');
    expect(maxim.equipment.backpack).toBe('tourist_backpack-1');
    expect(maxim.condition.health).toBe(maxim.condition.maxHealth);
  });

  it(`group is limited to ${MAX_GROUP_SIZE}`, () => {
    let group: readonly Character[] = [createCharacter(HERO)];
    for (let i = 1; i < MAX_GROUP_SIZE; i += 1) {
      const result = addCharacterToGroup(group, createCharacter({ ...MAXIM, id: `m${i}` }));
      expect(result.ok).toBe(true);
      if (result.ok) group = result.characters;
    }
    expect(group).toHaveLength(MAX_GROUP_SIZE);
    const overflow = addCharacterToGroup(group, createCharacter({ ...MAXIM, id: 'extra' }));
    expect(overflow).toEqual({ ok: false, error: 'GROUP_FULL' });
  });

  it('rejects duplicate characters', () => {
    const group = [createCharacter(HERO)];
    expect(addCharacterToGroup(group, createCharacter(HERO))).toEqual({
      ok: false,
      error: 'DUPLICATE_CHARACTER',
    });
  });

  it('dead characters cannot join a squad', () => {
    const dead = { ...createCharacter(MAXIM), condition: { ...createCharacter(MAXIM).condition, health: 0 } };
    expect(isAvailableForSquad(dead)).toBe(false);
  });
});
