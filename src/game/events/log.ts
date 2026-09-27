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
        /** What the squad took from the base. */
        readonly supplies: ResourceDelta;
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
        /** Taken from the squad's supplies/haul. */
        readonly spent: ResourceDelta;
        /** Added to the haul. */
        readonly gained: ResourceDelta;
        /** Found but did not fit into the squad's capacity. */
        readonly leftBehind: ResourceDelta;
      }
    | {
        readonly type: 'lootFound';
        readonly expeditionId: string;
        readonly locationId: LocationId;
        /** Location loot after the scavenging bonus. */
        readonly loot: ResourceDelta;
        readonly scavengingBonusPercent: number;
        /** Rolled but did not fit into the squad's capacity. */
        readonly leftBehind: ResourceDelta;
      }
    | {
        readonly type: 'expeditionReturned';
        readonly expeditionId: string;
        readonly locationId: LocationId;
        readonly memberIds: readonly CharacterId[];
        /** Everything delivered to the base: remaining supplies + haul + location loot. */
        readonly loot: ResourceDelta;
        /** The part of `loot` that is leftover supplies taken from the base. */
        readonly suppliesReturned: ResourceDelta;
        readonly aborted: boolean;
      }
    | {
        readonly type: 'dailyConsumption';
        /** null = the base; otherwise the expedition that ate from its own supplies. */
        readonly expeditionId: string | null;
        readonly day: number;
        readonly aliveCount: number;
        readonly consumed: ResourceDelta;
      }
    | {
        readonly type: 'shortage';
        readonly expeditionId: string | null;
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
