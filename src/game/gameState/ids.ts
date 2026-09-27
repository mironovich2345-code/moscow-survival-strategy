import type { GameLogEntry } from '../events';
import { appendLog } from '../events';
import type { GameState } from './types';

/** Returns a fresh deterministic id with the given prefix and the updated state. */
export function allocateId(state: GameState, prefix: string): [string, GameState] {
  return [`${prefix}-${state.nextId}`, { ...state, nextId: state.nextId + 1 }];
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type NewLogEntry = DistributiveOmit<GameLogEntry, 'id' | 'at'>;

export function addLogEntry(state: GameState, entry: NewLogEntry): GameState {
  const [id, next] = allocateId(state, 'log');
  const full = { ...entry, id, at: next.time } as GameLogEntry;
  return { ...next, log: appendLog(next.log, full) };
}
