import type { CharacterId } from '../characters';
import type { EventId } from '../events';
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
  /** Resources gained/lost through events, delivered on return. */
  readonly haul: ResourceDelta;
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
  | 'UNKNOWN_CHOICE';
