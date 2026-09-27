import type { CharacterId } from '../characters';
import type { ResourceDelta } from '../resources';
import type { GameHour } from '../time';
import type { LocationId } from '../world';

/**
 * Structured game journal. Entries hold data, not text: the UI decides how to
 * phrase them. New random events will add new variants to this union.
 */
export type GameLogEntry =
  | {
      readonly id: string;
      readonly at: GameHour;
      readonly type: 'campaignStarted';
    }
  | {
      readonly id: string;
      readonly at: GameHour;
      readonly type: 'expeditionDeparted';
      readonly expeditionId: string;
      readonly locationId: LocationId;
      readonly memberIds: readonly CharacterId[];
    }
  | {
      readonly id: string;
      readonly at: GameHour;
      readonly type: 'expeditionReturned';
      readonly expeditionId: string;
      readonly locationId: LocationId;
      readonly memberIds: readonly CharacterId[];
      readonly loot: ResourceDelta;
    };

export type GameLogEntryType = GameLogEntry['type'];

/** Keep the save small: only the most recent entries are stored. */
export const MAX_LOG_ENTRIES = 100;

export function appendLog(
  log: readonly GameLogEntry[],
  entry: GameLogEntry,
): readonly GameLogEntry[] {
  const next = [...log, entry];
  return next.length > MAX_LOG_ENTRIES ? next.slice(next.length - MAX_LOG_ENTRIES) : next;
}
