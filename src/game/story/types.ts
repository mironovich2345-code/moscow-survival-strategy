import type { Attributes, CharacterId, Skills } from '../characters';
import type { ItemDefId } from '../inventory/types';
import type { LocationId } from '../world/types';

// ---------------------------------------------------------------------------
// Story flags
// ---------------------------------------------------------------------------

export type StoryFlagValue = boolean | number | string;
/** One shared table of story flags. A missing flag reads as `false`. */
export type StoryFlags = Readonly<Record<string, StoryFlagValue>>;

/** Conditions over flags and recruits, used by triggers and recruitment. */
export type StoryCondition =
  | { readonly type: 'flag'; readonly flag: string; readonly value: StoryFlagValue }
  | {
      readonly type: 'recruitStatus';
      readonly recruitId: CharacterId;
      readonly statuses: readonly RecruitmentStatus[];
    };

// ---------------------------------------------------------------------------
// Recruitment
// ---------------------------------------------------------------------------

export const RECRUITMENT_STATUSES = [
  'unavailable',
  'available',
  'invited',
  'recruited',
  'declined',
  'dead',
] as const;
export type RecruitmentStatus = (typeof RECRUITMENT_STATUSES)[number];

export interface RecruitState {
  readonly status: RecruitmentStatus;
}

export type RecruitmentCondition =
  /** This character must be a member of the expedition where recruiting happens. */
  | { readonly type: 'memberInExpedition'; readonly characterId: CharacterId }
  | { readonly type: 'storyFlag'; readonly flag: string; readonly value: StoryFlagValue }
  /** Fewer than MAX_GROUP_SIZE living members. */
  | { readonly type: 'groupHasRoom' };

export type RecruitError =
  | 'RECRUIT_UNKNOWN'
  | 'RECRUIT_NOT_AVAILABLE'
  | 'REQUIRED_MEMBER_MISSING'
  | 'STORY_FLAG_MISSING'
  | 'GROUP_FULL'
  | 'ALREADY_RECRUITED';

/** Static content describing someone who can join the group. */
export interface RecruitDefinition {
  /** Also the character id once recruited. */
  readonly id: CharacterId;
  readonly name: string;
  /** Short note shown before the full profile is known. */
  readonly teaser: string;
  readonly lastKnownLocationId: LocationId;
  readonly initialStatus: RecruitmentStatus;
  readonly attributes: Attributes;
  readonly skills: Skills;
  readonly traits: readonly TraitId[];
  /** Created as new item instances at the moment of joining. */
  readonly startingEquipment: readonly ItemDefId[];
  /** Trust towards the hero when no relation is recorded yet. */
  readonly baseTrust: number;
  readonly conditions: readonly RecruitmentCondition[];
}

// ---------------------------------------------------------------------------
// Traits & relations
// ---------------------------------------------------------------------------

export type TraitId = string;

export interface TraitDefinition {
  readonly id: TraitId;
  readonly name: string;
  readonly description: string;
}

/** Attitude towards the hero. Only a category is shown to the player. */
export interface Relation {
  readonly trust: number;
}

export type TrustCategory = 'distrust' | 'wary' | 'neutral' | 'trust' | 'highTrust';

// ---------------------------------------------------------------------------
// Story triggers
// ---------------------------------------------------------------------------

/** A story event bound to arriving at a location while conditions hold. */
export interface StoryTrigger {
  readonly id: string;
  readonly locationId: LocationId;
  readonly eventId: string;
  readonly conditions: readonly StoryCondition[];
  /** Characters who must be in the squad while this trigger is active. */
  readonly requiredMemberIds: readonly CharacterId[];
}
