import type { GameHour } from '../time';

export type DistrictController = 'none' | 'arena' | 'player';
export type ThreatLevel = 'low' | 'medium' | 'high' | 'extreme';
export const THREAT_LEVELS = ['low', 'medium', 'high', 'extreme'] as const;

export const MAX_DISTRICT_NOISE = 100;
export const DISTRICT_NOISE_DECAY_PER_TURN = 5;
/** A single rise of at least this much is worth a journal line. */
export const SIGNIFICANT_NOISE_RISE = 10;

/** Runtime state of a district (the static part lives in DistrictDefinition). */
export interface DistrictState {
  readonly districtId: string;
  readonly controller: DistrictController;
  /** 0–100, long-term. Different from combatNoise, which lives inside one fight. */
  readonly noise: number;
  readonly threatLevel: ThreatLevel;
  readonly discovered: boolean;
  readonly lastWorldEventAt: GameHour | null;
}

/** Infected encounter chance and size per threat level (content). */
export interface InfectedEncounterRule {
  readonly chancePercent: number;
  readonly min: number;
  readonly max: number;
}
