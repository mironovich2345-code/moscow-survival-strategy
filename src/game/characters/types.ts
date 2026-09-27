export const ATTRIBUTE_IDS = ['strength', 'agility', 'endurance', 'perception', 'intelligence'] as const;
export type AttributeId = (typeof ATTRIBUTE_IDS)[number];

export const SKILL_IDS = ['firearms', 'melee', 'medicine', 'scavenging', 'stealth'] as const;
export type SkillId = (typeof SKILL_IDS)[number];

export const EQUIPMENT_SLOTS = ['weapon', 'armor', 'backpack'] as const;
export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number];

export type CharacterId = string;
export type ItemId = string;

export type Attributes = Readonly<Record<AttributeId, number>>;
export type Skills = Readonly<Record<SkillId, number>>;
export type Equipment = Readonly<Record<EquipmentSlot, ItemId | null>>;

export interface CharacterCondition {
  readonly health: number;
  readonly maxHealth: number;
  /** Did not get a food portion at the last daily consumption. */
  readonly hungry: boolean;
  /** Did not get a water portion at the last daily consumption. */
  readonly thirsty: boolean;
}

/** Where the character is right now. Extend with new variants (e.g. 'wounded', 'guard'). */
export type CharacterAssignment =
  | { readonly type: 'base' }
  | { readonly type: 'expedition'; readonly expeditionId: string };

export interface Character {
  readonly id: CharacterId;
  readonly name: string;
  readonly isHero: boolean;
  readonly attributes: Attributes;
  readonly skills: Skills;
  readonly equipment: Equipment;
  readonly condition: CharacterCondition;
  readonly assignment: CharacterAssignment;
}

/** Static description of a character used to spawn it into a game. */
export type CharacterTemplate = Omit<Character, 'assignment'>;
