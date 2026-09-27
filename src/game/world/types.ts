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

export type LocationKind = 'base' | 'pharmacy';

export interface LootRange {
  readonly resource: ResourceKind;
  readonly min: number;
  readonly max: number;
}

export interface LocationDefinition {
  readonly id: LocationId;
  readonly name: string;
  readonly districtId: DistrictId;
  readonly kind: LocationKind;
  readonly description: string;
  /** Total expedition time (there and back, including search), in turns. */
  readonly expeditionTurns: number;
  readonly loot: readonly LootRange[];
}

/** Everything static the game logic needs to run. Passed in, never imported. */
export interface GameContent {
  readonly districts: Readonly<Record<DistrictId, DistrictDefinition>>;
  readonly locations: Readonly<Record<LocationId, LocationDefinition>>;
}
