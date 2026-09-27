import { EQUIPMENT_SLOTS, canAddToGroup, createCharacter, findCharacter } from '../characters';
import type { Character, CharacterId, Equipment } from '../characters';
import { addLogEntry, allocateId } from '../gameState/ids';
import type { GameState } from '../gameState/types';
import type { ItemInstance } from '../inventory/types';
import type { GameContent } from '../world';
import { getFlag } from './flags';
import type { RecruitError, RecruitmentStatus } from './types';

export type RecruitResult =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly error: RecruitError };

/** Can this recruit join now, during the given expedition? Returns the first unmet condition. */
export function checkRecruitment(
  state: GameState,
  content: GameContent,
  recruitId: CharacterId,
  expeditionId: string | null,
): RecruitError | null {
  const definition = content.recruits[recruitId];
  if (!definition) return 'RECRUIT_UNKNOWN';
  if (findCharacter(state.characters, recruitId)) return 'ALREADY_RECRUITED';
  if (state.recruits[recruitId]?.status !== 'available') return 'RECRUIT_NOT_AVAILABLE';
  const expedition = state.expeditions.find((e) => e.id === expeditionId);
  for (const condition of definition.conditions) {
    switch (condition.type) {
      case 'memberInExpedition':
        if (!expedition || !expedition.memberIds.includes(condition.characterId)) return 'REQUIRED_MEMBER_MISSING';
        break;
      case 'storyFlag':
        if (getFlag(state, condition.flag) !== condition.value) return 'STORY_FLAG_MISSING';
        break;
      case 'groupHasRoom':
        if (!canAddToGroup(state.characters)) return 'GROUP_FULL';
        break;
    }
  }
  // The group limit is a hard rule, whatever the recruit's own conditions say.
  if (!canAddToGroup(state.characters)) return 'GROUP_FULL';
  return null;
}

export function setRecruitStatus(state: GameState, recruitId: CharacterId, status: RecruitmentStatus): GameState {
  if (state.recruits[recruitId]?.status === status) return state;
  const next: GameState = { ...state, recruits: { ...state.recruits, [recruitId]: { status } } };
  return addLogEntry(next, { type: 'recruitStatusChanged', recruitId, status });
}

/**
 * The recruit joins: a character is created from the profile, the starting
 * equipment is created as NEW item instances (`<defId>-<nextId>`) and put on,
 * and the character joins the expedition to walk home with the squad.
 */
export function recruitCharacter(
  state: GameState,
  content: GameContent,
  recruitId: CharacterId,
  expeditionId: string,
): RecruitResult {
  const error = checkRecruitment(state, content, recruitId, expeditionId);
  const definition = content.recruits[recruitId];
  const expedition = state.expeditions.find((e) => e.id === expeditionId);
  if (error || !definition || !expedition) return { ok: false, error: error ?? 'RECRUIT_UNKNOWN' };

  let next = state;
  const created: ItemInstance[] = [];
  const equipment: Record<(typeof EQUIPMENT_SLOTS)[number], string | null> = {
    sidearm: null,
    primary: null,
    melee: null,
    body: null,
    backpack: null,
  };
  for (const defId of definition.startingEquipment) {
    const itemDefinition = content.items[defId];
    if (!itemDefinition || equipment[itemDefinition.slot] !== null) continue;
    const [id, withId] = allocateId(next, defId);
    next = { ...withId, items: { ...withId.items, [id]: { id, defId } } };
    equipment[itemDefinition.slot] = id;
    created.push({ id, defId });
  }

  const character: Character = {
    ...createCharacter({
      id: definition.id,
      name: definition.name,
      isHero: false,
      attributes: definition.attributes,
      skills: definition.skills,
      traits: definition.traits,
      equipment: equipment as Equipment,
      condition: { health: 100, maxHealth: 100, hungry: false, thirsty: false },
    }),
    assignment: { type: 'expedition', expeditionId },
  };
  next = {
    ...next,
    characters: [...next.characters, character],
    expeditions: next.expeditions.map((e) =>
      e.id === expeditionId ? { ...e, memberIds: [...e.memberIds, character.id] } : e,
    ),
  };
  next = setRecruitStatus(next, recruitId, 'recruited');
  return {
    ok: true,
    state: addLogEntry(next, {
      type: 'characterRecruited',
      characterId: character.id,
      expeditionId,
      items: created.map((item) => item.id),
    }),
  };
}
