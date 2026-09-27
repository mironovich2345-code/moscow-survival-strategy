import { WEAPON_SLOTS } from '../combat/types';
import { isFirearm, isMeleeWeapon } from '../combat/rules';
import type { Character } from '../characters';
import type { GameState } from '../gameState/types';
import { getItemDefinition } from '../inventory';
import type { ItemCatalog } from '../inventory';

export type CombatRole = 'shooter' | 'melee' | 'support';

/** Derived from equipped weapons and skills (GAME_RULES «Профиль персонажа»). */
export function combatRole(character: Character, state: GameState, catalog: ItemCatalog): CombatRole {
  const weapons = WEAPON_SLOTS.flatMap((slot) => {
    const id = character.equipment[slot];
    const definition = id ? getItemDefinition(state.items, catalog, id) : undefined;
    return definition?.weapon ? [definition] : [];
  });
  const hasFirearm = weapons.some(isFirearm);
  const hasMelee = weapons.some(isMeleeWeapon);
  if (hasFirearm && (character.skills.firearms >= character.skills.melee || !hasMelee)) return 'shooter';
  if (hasMelee) return 'melee';
  return 'support';
}

export type Whereabouts =
  | { readonly type: 'base' }
  | { readonly type: 'expedition'; readonly locationId: string }
  | { readonly type: 'dead' };

export function whereabouts(character: Character, state: GameState): Whereabouts {
  switch (character.assignment.type) {
    case 'base':
      return { type: 'base' };
    case 'dead':
      return { type: 'dead' };
    case 'expedition': {
      const id = character.assignment.expeditionId;
      const expedition = state.expeditions.find((e) => e.id === id);
      return { type: 'expedition', locationId: expedition?.locationId ?? '' };
    }
  }
}
