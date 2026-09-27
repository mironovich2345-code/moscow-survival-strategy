import type { ResourceDelta } from '../resources';

/**
 * Text events with choices. Definitions are static content (src/data/events);
 * the game logic only interprets their effects.
 */

export type EventId = string;

/** What a chosen outcome does. Extend with new variants as mechanics appear. */
export type EventEffect =
  /** Adds (or removes) resources to the expedition's haul. */
  | { readonly type: 'resources'; readonly delta: ResourceDelta }
  /** Pushes the expedition's return back by N turns. */
  | { readonly type: 'delay'; readonly turns: number }
  /** Expedition gives up the search and heads home: no location loot. */
  | { readonly type: 'abort' };

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
  readonly outcomes: readonly EventOutcome[];
}

export interface EventDefinition {
  readonly id: EventId;
  readonly title: string;
  readonly description: string;
  readonly choices: readonly EventChoice[];
}
