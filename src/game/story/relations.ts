import type { CharacterId } from '../characters';
import type { GameState } from '../gameState/types';
import type { GameContent } from '../world';
import type { TrustCategory } from './types';

/** Recorded trust, or the recruit's base trust, or 0. */
export function getTrust(state: GameState, content: GameContent, characterId: CharacterId): number {
  return state.relations[characterId]?.trust ?? content.recruits[characterId]?.baseTrust ?? 0;
}

export function changeTrust(
  state: GameState,
  content: GameContent,
  characterId: CharacterId,
  delta: number,
): GameState {
  const trust = getTrust(state, content, characterId) + delta;
  return { ...state, relations: { ...state.relations, [characterId]: { trust } } };
}

/** Boundaries: ≤−40 / −39…−10 / −9…19 / 20…59 / ≥60 (GAME_RULES «Отношения»). */
export function trustCategory(trust: number): TrustCategory {
  if (trust <= -40) return 'distrust';
  if (trust <= -10) return 'wary';
  if (trust < 20) return 'neutral';
  if (trust < 60) return 'trust';
  return 'highTrust';
}
