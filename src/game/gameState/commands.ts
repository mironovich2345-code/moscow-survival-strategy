import type { CharacterId, ItemInstanceId } from '../characters';
import {
  attemptRetreat,
  closeCombat,
  confirmCombatRound,
  setCombatAction,
  setCombatPosition,
  startCombat,
} from '../combat';
import type { CombatAction, CombatError, CombatLine } from '../combat';
import { hasPendingEvent, processExpeditions, resolveExpeditionEvent, startExpedition } from '../expeditions';
import type { ExpeditionError, SuppliesRequest } from '../expeditions';
import { moveItem } from '../inventory';
import type { ItemError, MoveItemTarget } from '../inventory';
import type { RecruitError } from '../story/types';
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
      /** Food, water, medicine, ammunition taken from the base (default: none). */
      readonly supplies?: SuppliesRequest;
    }
  | {
      /** Equip from storage, unequip to storage, or hand over to another character. */
      readonly type: 'moveItem';
      readonly itemId: ItemInstanceId;
      readonly to: MoveItemTarget;
    }
  /** Starts a fight (used by events; exposed to the UI only as a DEV tool). */
  | { readonly type: 'startCombat'; readonly expeditionId: string; readonly enemies: number }
  | { readonly type: 'setCombatPosition'; readonly characterId: CharacterId; readonly line: CombatLine }
  | { readonly type: 'setCombatAction'; readonly characterId: CharacterId; readonly action: CombatAction }
  | { readonly type: 'confirmCombatRound' }
  | { readonly type: 'retreatFromCombat' }
  | { readonly type: 'closeCombat' }
  | {
      readonly type: 'resolveEvent';
      readonly expeditionId: string;
      readonly choiceId: string;
    };

export type GameError = ExpeditionError | ItemError | CombatError | RecruitError | 'EVENT_PENDING';

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
      if (state.combat) return { ok: false, error: 'COMBAT_ACTIVE' };
      if (isAwaitingDecision(state, content)) return { ok: false, error: 'EVENT_PENDING' };
      return { ok: true, state: endTurn(state, content) };
    case 'sendExpedition': {
      const result = startExpedition(
        state,
        content,
        command.locationId,
        command.memberIds,
        command.supplies ?? {},
      );
      return result.ok ? { ok: true, state: result.state } : result;
    }
    case 'moveItem':
      return moveItem(state, content.items, command.itemId, command.to);
    case 'startCombat':
      return startCombat(state, command.expeditionId, command.enemies);
    case 'setCombatPosition':
      return setCombatPosition(state, command.characterId, command.line);
    case 'setCombatAction':
      return setCombatAction(state, content, command.characterId, command.action);
    case 'confirmCombatRound':
      return confirmCombatRound(state, content);
    case 'retreatFromCombat':
      return attemptRetreat(state, content);
    case 'closeCombat':
      return closeCombat(state);
    case 'resolveEvent':
      return resolveExpeditionEvent(state, content, command.expeditionId, command.choiceId);
  }
}
