import type { CharacterTemplate } from '@game/characters';

export const HERO_ID = 'hero';
export const MAXIM_ID = 'maxim';

export const HERO: CharacterTemplate = {
  id: HERO_ID,
  name: 'Герой',
  isHero: true,
  attributes: { strength: 5, agility: 5, endurance: 5, perception: 5, intelligence: 5 },
  skills: { firearms: 2, melee: 2, medicine: 1, scavenging: 2, stealth: 1 },
  equipment: { weapon: 'pm_pistol', armor: 'work_jacket', backpack: null },
  condition: { health: 100, maxHealth: 100 },
};

/** Test companion for the prototype. */
export const MAXIM: CharacterTemplate = {
  id: MAXIM_ID,
  name: 'Максим',
  isHero: false,
  attributes: { strength: 6, agility: 4, endurance: 6, perception: 4, intelligence: 4 },
  skills: { firearms: 1, melee: 3, medicine: 0, scavenging: 2, stealth: 1 },
  equipment: { weapon: 'fire_axe', armor: null, backpack: 'tourist_backpack' },
  condition: { health: 100, maxHealth: 100 },
};

export const STARTING_CHARACTERS: readonly CharacterTemplate[] = [HERO, MAXIM];
