import type { CharacterId } from '../characters';
import { resolveDueExpeditions, startExpedition } from '../expeditions';
import type { ExpeditionError } from '../expeditions';
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
    };

export type GameError = ExpeditionError;

export type CommandResult =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly error: GameError };

/** Advances time by one turn (2 hours) and resolves everything that became due. */
export function endTurn(state: GameState, content: GameContent): GameState {
  const advanced: GameState = { ...state, time: advanceTurns(state.time, 1), turn: state.turn + 1 };
  return resolveDueExpeditions(advanced, content);
}

export function applyCommand(
  state: GameState,
  command: GameCommand,
  content: GameContent,
): CommandResult {
  switch (command.type) {
    case 'endTurn':
      return { ok: true, state: endTurn(state, content) };
    case 'sendExpedition': {
      const result = startExpedition(state, content, command.locationId, command.memberIds);
      return result.ok ? { ok: true, state: result.state } : result;
    }
  }
}
