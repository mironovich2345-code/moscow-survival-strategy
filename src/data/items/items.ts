import type { ItemDefinition, ItemInstance } from '@game/inventory';

/**
 * Prototype item catalogue. Weights, capacity, weapon and armour numbers are
 * temporary balance — see docs/GAME_RULES.md «Вес и грузоподъёмность».
 */
export const ITEMS = {
  // --- Starting items (0.1–0.3) ---
  pm_pistol: {
    id: 'pm_pistol',
    name: 'Пистолет Макарова',
    category: 'firearm',
    slot: 'sidearm',
    weight: 1,
    capacityBonus: 0,
    weapon: { damage: 30, noise: 6, ammoPerAttack: 1 },
    description: 'Табельный ПМ. Надёжный, но слабый.',
  },
  fire_axe: {
    id: 'fire_axe',
    name: 'Пожарный топор',
    category: 'melee',
    slot: 'melee',
    weight: 3,
    capacityBonus: 0,
    weapon: { damage: 40, noise: 1, ammoPerAttack: 0 },
    description: 'Снят со щита в подъезде.',
  },
  work_jacket: {
    id: 'work_jacket',
    name: 'Рабочая куртка',
    category: 'armor',
    slot: 'body',
    weight: 2,
    capacityBonus: 0,
    armor: { damageReductionPercent: 5 },
    description: 'Плотная ткань, немного защищает от укусов.',
  },
  tourist_backpack: {
    id: 'tourist_backpack',
    name: 'Туристический рюкзак',
    category: 'backpack',
    slot: 'backpack',
    weight: 2,
    capacityBonus: 15,
    description: 'Вместительный рюкзак на 60 литров.',
  },
  // --- Found in locations (0.3.1) ---
  pump_shotgun: {
    id: 'pump_shotgun',
    name: 'Помповый дробовик',
    category: 'firearm',
    slot: 'primary',
    weight: 4,
    capacityBonus: 0,
    weapon: { damage: 60, noise: 10, ammoPerAttack: 1 },
    description: 'Оружие из оружейной комнаты отдела полиции. Громкое.',
  },
  police_vest: {
    id: 'police_vest',
    name: 'Полицейский бронежилет',
    category: 'armor',
    slot: 'body',
    weight: 5,
    capacityBonus: 0,
    armor: { damageReductionPercent: 25 },
    description: 'Тяжёлый, но надёжно закрывает корпус.',
  },
  city_backpack: {
    id: 'city_backpack',
    name: 'Маленький городской рюкзак',
    category: 'backpack',
    slot: 'backpack',
    weight: 1,
    capacityBonus: 8,
    description: 'Обычный рюкзак для ноутбука и сменки.',
  },
  crowbar: {
    id: 'crowbar',
    name: 'Монтировка',
    category: 'tool',
    slot: 'melee',
    weight: 2,
    capacityBonus: 0,
    weapon: { damage: 25, noise: 1, ammoPerAttack: 0 },
    description: 'Инструмент из багажника. Годится и как оружие.',
  },
} as const satisfies Record<string, ItemDefinition>;

export type KnownItemDefId = keyof typeof ITEMS;

/** Stable instance ids of the hero's starting items. */
export const PM_PISTOL_1 = 'pm_pistol-1';
export const WORK_JACKET_1 = 'work_jacket-1';
/**
 * Ids of Maxim's items in 0.1–0.4 starts (old saves, test squad). Since 0.5 a
 * new campaign creates Maxim's items only when he joins, with fresh ids.
 */
export const FIRE_AXE_1 = 'fire_axe-1';
export const TOURIST_BACKPACK_1 = 'tourist_backpack-1';

export const STARTING_ITEMS: readonly ItemInstance[] = [
  { id: PM_PISTOL_1, defId: 'pm_pistol' },
  { id: WORK_JACKET_1, defId: 'work_jacket' },
];
