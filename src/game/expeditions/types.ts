import type { CharacterId } from '../characters';
import type { GameHour } from '../time';
import type { LocationId } from '../world';

/** Maximum number of characters in one combat squad / expedition. */
export const MAX_SQUAD_SIZE = 5;

export interface Expedition {
  readonly id: string;
  readonly locationId: LocationId;
  readonly memberIds: readonly CharacterId[];
  readonly departedAt: GameHour;
  readonly returnsAt: GameHour;
}

export type ExpeditionError =
  | 'UNKNOWN_LOCATION'
  | 'LOCATION_NOT_EXPLORABLE'
  | 'EMPTY_SQUAD'
  | 'SQUAD_TOO_LARGE'
  | 'DUPLICATE_MEMBER'
  | 'CHARACTER_NOT_FOUND'
  | 'CHARACTER_UNAVAILABLE';
