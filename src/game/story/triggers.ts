import type { GameState } from '../gameState/types';
import type { GameContent, LocationId } from '../world';
import { checkStoryConditions } from './flags';
import type { StoryTrigger } from './types';

/** The first story trigger of a location whose conditions hold right now. */
export function activeStoryTrigger(
  state: GameState,
  content: GameContent,
  locationId: LocationId,
): StoryTrigger | undefined {
  return content.storyTriggers.find(
    (trigger) => trigger.locationId === locationId && checkStoryConditions(state, trigger.conditions),
  );
}
