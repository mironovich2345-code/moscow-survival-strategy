import type { CharacterId } from '../characters';
import type { ResourceDelta, ResourceKind } from '../resources';
import type { GameHour } from '../time';
import type { LocationId } from '../world';
import type { EventId } from './types';

interface LogEntryBase {
  readonly id: string;
  readonly at: GameHour;
}

/**
 * Structured game journal. Entries hold data, not text: the UI decides how to
 * phrase them.
 */
export type GameLogEntry = LogEntryBase &
  (
    | { readonly type: 'campaignStarted' }
    | {
        readonly type: 'expeditionDeparted';
        readonly expeditionId: string;
        readonly locationId: LocationId;
        readonly memberIds: readonly CharacterId[];
      }
    | {
        readonly type: 'expeditionEvent';
        readonly expeditionId: string;
        readonly locationId: LocationId;
        readonly eventId: EventId;
      }
    | {
        readonly type: 'eventChoice';
        readonly expeditionId: string;
        readonly eventId: EventId;
        readonly choiceId: string;
        readonly outcomeId: string;
      }
    | {
        readonly type: 'lootFound';
        readonly expeditionId: string;
        readonly locationId: LocationId;
        /** Location loot after the scavenging bonus. */
        readonly loot: ResourceDelta;
        readonly scavengingBonusPercent: number;
      }
    | {
        readonly type: 'expeditionReturned';
        readonly expeditionId: string;
        readonly locationId: LocationId;
        readonly memberIds: readonly CharacterId[];
        /** Everything delivered to the base: location loot + haul. */
        readonly loot: ResourceDelta;
        readonly aborted: boolean;
      }
    | {
        readonly type: 'dailyConsumption';
        readonly day: number;
        readonly aliveCount: number;
        readonly consumed: ResourceDelta;
      }
    | {
        readonly type: 'shortage';
        readonly resource: Extract<ResourceKind, 'food' | 'water'>;
        readonly characterIds: readonly CharacterId[];
      }
  );

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
