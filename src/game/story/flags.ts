import type { GameState } from '../gameState/types';
import type { StoryCondition, StoryFlagValue } from './types';

export function getFlag(state: GameState, flag: string): StoryFlagValue {
  return state.storyFlags[flag] ?? false;
}

export function setFlag(state: GameState, flag: string, value: StoryFlagValue): GameState {
  return { ...state, storyFlags: { ...state.storyFlags, [flag]: value } };
}

export function checkStoryCondition(state: GameState, condition: StoryCondition): boolean {
  switch (condition.type) {
    case 'flag':
      return getFlag(state, condition.flag) === condition.value;
    case 'recruitStatus': {
      const status = state.recruits[condition.recruitId]?.status;
      return status !== undefined && condition.statuses.includes(status);
    }
  }
}

export function checkStoryConditions(state: GameState, conditions: readonly StoryCondition[]): boolean {
  return conditions.every((condition) => checkStoryCondition(state, condition));
}
