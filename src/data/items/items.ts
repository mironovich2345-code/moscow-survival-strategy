import type { EquipmentSlot, ItemId } from '@game/characters';

export interface ItemDefinition {
  readonly id: ItemId;
  readonly name: string;
  readonly slot: EquipmentSlot;
  readonly description: string;
}

/** Prototype item catalogue. Stats will be added together with combat/inventory. */
export const ITEMS = {
  pm_pistol: {
    id: 'pm_pistol',
    name: 'Пистолет Макарова',
    slot: 'weapon',
    description: 'Табельный ПМ. Надёжный, но слабый.',
  },
  fire_axe: {
    id: 'fire_axe',
    name: 'Пожарный топор',
    slot: 'weapon',
    description: 'Снят со щита в подъезде.',
  },
  work_jacket: {
    id: 'work_jacket',
    name: 'Рабочая куртка',
    slot: 'armor',
    description: 'Плотная ткань, немного защищает от укусов.',
  },
  tourist_backpack: {
    id: 'tourist_backpack',
    name: 'Туристический рюкзак',
    slot: 'backpack',
    description: 'Вместительный рюкзак на 60 литров.',
  },
} as const satisfies Record<string, ItemDefinition>;

export type KnownItemId = keyof typeof ITEMS;

export function getItem(id: ItemId): ItemDefinition | undefined {
  return (ITEMS as Record<string, ItemDefinition>)[id];
}
