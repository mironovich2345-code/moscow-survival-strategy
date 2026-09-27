import type { Character, CharacterTemplate } from '../characters';
import type { ItemInstance, Storage } from '../inventory';
import type { GameLogEntry } from '../events';
import type { Expedition } from '../expeditions/types';
import type { RngState } from '../random';
import type { ResourceDelta, Resources } from '../resources';
import type { GameHour } from '../time';
import type { LocationId } from '../world';

/** Bump when the shape of GameState changes; add a migration in persistence. */
export const GAME_STATE_VERSION = 4;

/**
 * The complete, serialisable state of one campaign. Plain JSON data only:
 * no classes, no functions, no references to React.
 */
export interface GameState {
  readonly version: typeof GAME_STATE_VERSION;
  /** The seed the campaign was started with (for debugging / replays). */
  readonly seed: number;
  /** Current RNG state; advanced by every random roll. */
  readonly rng: RngState;
  readonly time: GameHour;
  readonly turn: number;
  readonly baseLocationId: LocationId;
  /** Base stock: consumables (food, water, medicine, ammunition) plus fuel and materials. */
  readonly resources: Resources;
  /** Registry of every unique item instance in the world. */
  readonly items: Readonly<Record<string, ItemInstance>>;
  /** Unique items lying in the base storage (not equipped by anyone). */
  readonly storage: Storage;
  readonly characters: readonly Character[];
  readonly expeditions: readonly Expedition[];
  readonly log: readonly GameLogEntry[];
  /** Monotonic counter for deterministic ids. */
  readonly nextId: number;
}

export interface NewGameSetup {
  readonly seed: number;
  readonly baseLocationId: LocationId;
  readonly characters: readonly CharacterTemplate[];
  /** All starting unique items. Items not equipped by a template start in storage. */
  readonly items: readonly ItemInstance[];
  readonly resources: ResourceDelta;
}
