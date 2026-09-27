import type { CharacterId, ItemInstanceId } from '../characters';
import type { EventId } from '../events';
import type { Supplies } from '../inventory';
import type { ResourceDelta } from '../resources';
import type { GameHour } from '../time';
import type { LocationId } from '../world';

/** Maximum number of characters in one combat squad / expedition. */
export const MAX_SQUAD_SIZE = 5;

/** Chance (%) per expedition per turn that an event happens. */
export const EVENT_CHANCE_PERCENT = 25;

/** Each scavenging point in the squad gives +10 % loot… */
export const SCAVENGING_BONUS_PER_POINT_PERCENT = 10;
/** …up to +100 %. */
export const MAX_SCAVENGING_BONUS_PERCENT = 100;

export interface Expedition {
  readonly id: string;
  readonly locationId: LocationId;
  readonly memberIds: readonly CharacterId[];
  readonly departedAt: GameHour;
  readonly returnsAt: GameHour;
  /** When the squad searches the location (mid-trip). */
  readonly searchAt: GameHour;
  readonly searched: boolean;
  /** Taken from the base at departure; spent on the way; leftovers return to storage. */
  readonly supplies: Supplies;
  /** Resources found on the way (events). Never negative. Delivered to storage on return. */
  readonly haul: ResourceDelta;
  /** Unique items found on the way (instance ids). Moved to storage on return. */
  readonly haulItems: readonly ItemInstanceId[];
  /** Event waiting for the player's decision; the expedition is paused. */
  readonly pendingEventId: EventId | null;
  /** Events already met on this trip (no repeats within one expedition). */
  readonly seenEventIds: readonly EventId[];
  /** Search abandoned: returns without location loot. */
  readonly aborted: boolean;
}

export type ExpeditionError =
  | 'UNKNOWN_LOCATION'
  | 'LOCATION_NOT_EXPLORABLE'
  | 'EMPTY_SQUAD'
  | 'SQUAD_TOO_LARGE'
  | 'DUPLICATE_MEMBER'
  | 'CHARACTER_NOT_FOUND'
  | 'CHARACTER_UNAVAILABLE'
  | 'EXPEDITION_NOT_FOUND'
  | 'NO_PENDING_EVENT'
  | 'UNKNOWN_CHOICE'
  | 'CHOICE_UNAVAILABLE'
  | 'INVALID_SUPPLIES'
  | 'NOT_ENOUGH_SUPPLIES'
  | 'OVERLOADED';
