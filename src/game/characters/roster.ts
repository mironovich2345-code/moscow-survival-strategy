import type { Character, CharacterId, CharacterTemplate } from './types';

/** Maximum number of people in the survivor group (including the hero). */
export const MAX_GROUP_SIZE = 12;

export function createCharacter(template: CharacterTemplate): Character {
  return { ...template, assignment: { type: 'base' } };
}

export function findCharacter(
  characters: readonly Character[],
  id: CharacterId,
): Character | undefined {
  return characters.find((character) => character.id === id);
}

export function isAtBase(character: Character): boolean {
  return character.assignment.type === 'base';
}

export function isAlive(character: Character): boolean {
  return character.condition.health > 0;
}

/** Can the character be sent on an expedition right now? */
export function isAvailableForSquad(character: Character): boolean {
  return isAtBase(character) && isAlive(character);
}

export function canAddToGroup(characters: readonly Character[]): boolean {
  return characters.length < MAX_GROUP_SIZE;
}

export type AddCharacterResult =
  | { readonly ok: true; readonly characters: readonly Character[] }
  | { readonly ok: false; readonly error: 'GROUP_FULL' | 'DUPLICATE_CHARACTER' };

export function addCharacterToGroup(
  characters: readonly Character[],
  character: Character,
): AddCharacterResult {
  if (findCharacter(characters, character.id)) {
    return { ok: false, error: 'DUPLICATE_CHARACTER' };
  }
  if (!canAddToGroup(characters)) {
    return { ok: false, error: 'GROUP_FULL' };
  }
  return { ok: true, characters: [...characters, character] };
}

export function updateCharacters(
  characters: readonly Character[],
  ids: ReadonlySet<CharacterId>,
  update: (character: Character) => Character,
): readonly Character[] {
  return characters.map((character) => (ids.has(character.id) ? update(character) : character));
}
