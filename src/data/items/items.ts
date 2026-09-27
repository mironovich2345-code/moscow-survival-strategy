import type { ItemDefinition, ItemInstance } from '@game/inventory';

/**
 * Prototype item catalogue. Weights and capacity bonuses are temporary
 * balance — see docs/GAME_RULES.md «Вес и грузоподъёмность».
 */
export const ITEMS = {
  pm_pistol: {
    id: 'pm_pistol',
    name: 'Пистолет Макарова',
    slot: 'sidearm',
    weight: 1,
    capacityBonus: 0,
    description: 'Табельный ПМ. Надёжный, но слабый.',
  },
  fire_axe: {
    id: 'fire_axe',
    name: 'Пожарный топор',
    slot: 'melee',
    weight: 3,
    capacityBonus: 0,
    description: 'Снят со щита в подъезде.',
  },
  work_jacket: {
    id: 'work_jacket',
    name: 'Рабочая куртка',
    slot: 'body',
    weight: 2,
    capacityBonus: 0,
    description: 'Плотная ткань, немного защищает от укусов.',
  },
  tourist_backpack: {
    id: 'tourist_backpack',
    name: 'Туристический рюкзак',
    slot: 'backpack',
    weight: 2,
    capacityBonus: 15,
    description: 'Вместительный рюкзак на 60 литров.',
  },
} as const satisfies Record<string, ItemDefinition>;

export type KnownItemDefId = keyof typeof ITEMS;

/** Stable instance ids of the starting items. */
export const PM_PISTOL_1 = 'pm_pistol-1';
export const FIRE_AXE_1 = 'fire_axe-1';
export const WORK_JACKET_1 = 'work_jacket-1';
export const TOURIST_BACKPACK_1 = 'tourist_backpack-1';

export const STARTING_ITEMS: readonly ItemInstance[] = [
  { id: PM_PISTOL_1, defId: 'pm_pistol' },
  { id: FIRE_AXE_1, defId: 'fire_axe' },
  { id: WORK_JACKET_1, defId: 'work_jacket' },
  { id: TOURIST_BACKPACK_1, defId: 'tourist_backpack' },
];
