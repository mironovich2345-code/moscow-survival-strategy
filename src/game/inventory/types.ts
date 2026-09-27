import type { EquipmentSlot, ItemInstanceId } from '../characters';
import type { ResourceKind } from '../resources';

/** Id of an item *definition* in content (e.g. 'pm_pistol'). */
export type ItemDefId = string;

/** Static description of an item type. Lives in src/data/items. */
export interface ItemDefinition {
  readonly id: ItemDefId;
  readonly name: string;
  readonly slot: EquipmentSlot;
  /** Integer weight units. */
  readonly weight: number;
  /** Extra carry capacity while equipped (backpacks). */
  readonly capacityBonus: number;
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
  | { readonly type: 'character'; readonly characterId: string; readonly slot: EquipmentSlot };

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
