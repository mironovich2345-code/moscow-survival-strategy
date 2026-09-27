import type { ResourceDelta } from '../resources';
import type { RecruitmentStatus, StoryFlagValue } from '../story/types';

/**
 * Text events with choices. Definitions are static content (src/data/events);
 * the game logic only interprets their effects.
 */

export type EventId = string;

/** What a chosen outcome does. Extend with new variants as mechanics appear. */
export type EventEffect =
  /** Positive: found → haul (capacity-limited). Negative: spent from the squad's supplies. */
  | { readonly type: 'resources'; readonly delta: ResourceDelta }
  /** Pushes the expedition's return back by N turns. */
  | { readonly type: 'delay'; readonly turns: number }
  /** Expedition gives up the search and heads home: no location loot. */
  | { readonly type: 'abort' }
  /** Starts a fight against N ordinary infected. */
  | { readonly type: 'combat'; readonly enemies: number }
  | { readonly type: 'setFlag'; readonly flag: string; readonly value: StoryFlagValue }
  | { readonly type: 'trust'; readonly characterId: string; readonly delta: number }
  | { readonly type: 'recruitStatus'; readonly recruitId: string; readonly status: RecruitmentStatus }
  /** The recruit joins the group (conditions must hold; otherwise the choice is unavailable). */
  | { readonly type: 'recruit'; readonly recruitId: string }
  /** Chains the next story event right after this decision. */
  | { readonly type: 'storyEvent'; readonly eventId: EventId };

export interface EventOutcome {
  readonly id: string;
  /** Relative weight for the random pick. */
  readonly weight: number;
  readonly text: string;
  readonly effects: readonly EventEffect[];
}

export interface EventChoice {
  readonly id: string;
  readonly text: string;
  /** The squad must carry at least this much (supplies + haul) to pick this choice. */
  readonly requires?: ResourceDelta;
  readonly outcomes: readonly EventOutcome[];
}

/** `random` events come from the expedition pool; `story` events only from triggers/chains. */
export type EventKind = 'random' | 'story';

export interface EventDefinition {
  readonly id: EventId;
  /** Defaults to 'random'. */
  readonly kind?: EventKind;
  readonly title: string;
  readonly description: string;
  readonly choices: readonly EventChoice[];
}
