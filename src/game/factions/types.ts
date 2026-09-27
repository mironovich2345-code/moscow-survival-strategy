import type { GameHour } from '../time';

export type FactionId = 'arena';
export type FactionStatus = 'active' | 'weakened' | 'destroyed';
export type FactionOperationType = 'patrol' | 'scavenge' | 'intimidate';

export interface FactionOperation {
  readonly type: FactionOperationType;
  readonly districtId: string;
  readonly startedAt: GameHour;
}

/** What the player actually saw of the faction (never numbers). */
export interface KnownActivity {
  readonly operation: FactionOperationType;
  readonly districtId: string;
  readonly at: GameHour;
}

/** Runtime state. manpower / supplies are internal and never shown to the player. */
export interface FactionState {
  readonly id: FactionId;
  readonly manpower: number;
  readonly supplies: number;
  readonly controlledDistricts: readonly string[];
  /** 0–100: how much they know about the player's group. */
  readonly awarenessOfPlayer: number;
  /** −100…100. Shown only as a category. */
  readonly relationToPlayer: number;
  readonly status: FactionStatus;
  readonly currentOperation: FactionOperation | null;
  readonly nextOperationAt: GameHour;
  /** Has the player met them face to face? */
  readonly contacted: boolean;
  readonly lastKnownActivity: KnownActivity | null;
}

/** Static content of a faction. */
export interface FactionDefinition {
  readonly id: FactionId;
  readonly name: string;
  /** Name used before contact. */
  readonly unknownName: string;
  readonly description: string;
  readonly homeDistrictId: string;
  readonly initialManpower: number;
  readonly initialSupplies: number;
  readonly operationWeights: Readonly<Record<FactionOperationType, number>>;
}

/** Hidden world simulation record (not the player's journal). */
export interface WorldEvent {
  readonly at: GameHour;
  readonly factionId: FactionId;
  readonly operation: FactionOperationType;
  readonly districtId: string;
  readonly observed: boolean;
}

export type FactionRelationCategory = 'unknown' | 'neutral' | 'tension' | 'hostile' | 'war';
export type AwarenessCategory = 'none' | 'rumors' | 'knowsGroup' | 'watching' | 'hunting';
export type ManpowerEstimate = 'unknown' | 'few' | 'group' | 'many';

/** One faction operation every 6 hours. */
export const FACTION_OPERATION_INTERVAL_HOURS = 6;
export const SCAVENGE_SUPPLIES = 5;
export const INTIMIDATE_NOISE = 10;
export const MAX_WORLD_EVENTS = 200;
