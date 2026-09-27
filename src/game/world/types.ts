import type { EventDefinition, EventId } from '../events';
import type { ItemDefId, ItemDefinition } from '../inventory';
import type { ResourceKind } from '../resources';

/**
 * Static world definitions (districts, locations). The concrete content lives
 * in src/data; the game logic only knows these shapes.
 */

export type DistrictId = string;
export type LocationId = string;

export interface DistrictDefinition {
  readonly id: DistrictId;
  readonly name: string;
  readonly description: string;
  /** Position on the schematic prototype map (grid cells). */
  readonly mapPosition: { readonly column: number; readonly row: number };
}

export type LocationKind = 'base' | 'pharmacy' | 'grocery' | 'parking' | 'police';

/** Informational only in 0.2 — does not change any roll yet. */
export type RiskLevel = 'none' | 'low' | 'medium' | 'high';

export interface LootRange {
  readonly resource: ResourceKind;
  readonly min: number;
  readonly max: number;
  /** Chance (1–100 %) that this entry drops at all. Omitted = always. */
  readonly chancePercent?: number;
}

export interface LocationDefinition {
  readonly id: LocationId;
  readonly name: string;
  readonly districtId: DistrictId;
  readonly kind: LocationKind;
  readonly description: string;
  readonly risk: RiskLevel;
  /** Total expedition time (there and back, including search), in turns. */
  readonly expeditionTurns: number;
  readonly loot: readonly LootRange[];
}

/** Everything static the game logic needs to run. Passed in, never imported. */
export interface GameContent {
  readonly districts: Readonly<Record<DistrictId, DistrictDefinition>>;
  readonly locations: Readonly<Record<LocationId, LocationDefinition>>;
  readonly events: Readonly<Record<EventId, EventDefinition>>;
  readonly items: Readonly<Record<ItemDefId, ItemDefinition>>;
}
