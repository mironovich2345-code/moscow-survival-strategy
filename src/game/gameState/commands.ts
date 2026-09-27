import type { CharacterId } from '../characters';
import { hasPendingEvent, processExpeditions, resolveExpeditionEvent, startExpedition } from '../expeditions';
import type { ExpeditionError } from '../expeditions';
import { applyDailyConsumption, daysCrossed } from '../survival';
import { advanceTurns } from '../time';
import type { GameContent, LocationId } from '../world';
import type { GameState } from './types';

/**
 * Every player action is a command. The UI only dispatches commands; all rules
 * live here. New actions (combat, trading, crafting...) = new command variants.
 */
export type GameCommand =
  | { readonly type: 'endTurn' }
  | {
      readonly type: 'sendExpedition';
      readonly locationId: LocationId;
      readonly memberIds: readonly CharacterId[];
    }
  | {
      readonly type: 'resolveEvent';
      readonly expeditionId: string;
      readonly choiceId: string;
    };

export type GameError = ExpeditionError | 'EVENT_PENDING';

export type CommandResult =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly error: GameError };

/** True while any expedition waits for the player's decision. */
export function isAwaitingDecision(state: GameState, content: GameContent): boolean {
  return state.expeditions.some((expedition) => hasPendingEvent(expedition, content));
}

/**
 * Advances time by one turn (2 hours): daily consumption on a new day, then
 * expeditions (returns and events). Order is documented in GAME_RULES.md.
 * Callers must check isAwaitingDecision first (applyCommand does).
 */
export function endTurn(state: GameState, content: GameContent): GameState {
  const time = advanceTurns(state.time, 1);
  let next: GameState = { ...state, time, turn: state.turn + 1 };
  for (let i = 0; i < daysCrossed(state.time, time); i += 1) {
    next = applyDailyConsumption(next);
  }
  return processExpeditions(next, content);
}

export function applyCommand(
  state: GameState,
  command: GameCommand,
  content: GameContent,
): CommandResult {
  switch (command.type) {
    case 'endTurn':
      if (isAwaitingDecision(state, content)) return { ok: false, error: 'EVENT_PENDING' };
      return { ok: true, state: endTurn(state, content) };
    case 'sendExpedition': {
      const result = startExpedition(state, content, command.locationId, command.memberIds);
      return result.ok ? { ok: true, state: result.state } : result;
    }
    case 'resolveEvent':
      return resolveExpeditionEvent(state, content, command.expeditionId, command.choiceId);
  }
}
