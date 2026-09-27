import type { EquipmentSlot, ItemInstanceId } from '../characters';
import type { ResourceKind } from '../resources';

/** Id of an item *definition* in content (e.g. 'pm_pistol'). */
export type ItemDefId = string;

export const ITEM_CATEGORIES = ['firearm', 'melee', 'tool', 'armor', 'backpack'] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

/** Informational weapon parameters for the future combat (0.4). Not used by any rule yet. */
export interface WeaponStats {
  readonly damage: number;
  /** 0–10: how loud one attack is. */
  readonly noise: number;
  /** Universal ammunition spent per attack (0 for melee). */
  readonly ammoPerAttack: number;
}

/** Static description of an item type. Lives in src/data/items. */
export interface ItemDefinition {
  readonly id: ItemDefId;
  readonly name: string;
  readonly category: ItemCategory;
  /** The only equipment slot this item fits. */
  readonly slot: EquipmentSlot;
  /** Integer weight units. */
  readonly weight: number;
  /** Extra carry capacity while equipped (backpacks). */
  readonly capacityBonus: number;
  readonly weapon?: WeaponStats;
  readonly description: string;
}

/** One physical, unique item in the world. */
export interface ItemInstance {
  readonly id: ItemInstanceId;
  readonly defId: ItemDefId;
}

/** Unique items lying in the base storage. Consumables live in GameState.resources. */
export interface Storage {
  readonly items: readonly ItemInstanceId[];
}

/** Where a unique item currently is. */
export type ItemLocation =
  | { readonly type: 'storage' }
  | { readonly type: 'character'; readonly characterId: string; readonly slot: EquipmentSlot }
  /** Found on the way, carried in the haul of an active expedition. */
  | { readonly type: 'expedition'; readonly expeditionId: string };

/** Resources a squad can take with it. */
export const SUPPLY_KINDS = ['food', 'water', 'medicine', 'ammunition'] as const;
export type SupplyKind = (typeof SUPPLY_KINDS)[number] & ResourceKind;
export type Supplies = Readonly<Record<SupplyKind, number>>;

export function emptySupplies(): Supplies {
  return { food: 0, water: 0, medicine: 0, ammunition: 0 };
}

export function isSupplyKind(kind: string): kind is SupplyKind {
  return (SUPPLY_KINDS as readonly string[]).includes(kind);
}
