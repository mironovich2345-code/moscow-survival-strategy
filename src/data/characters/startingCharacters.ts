import type { CharacterTemplate } from '@game/characters';
import { FIRE_AXE_1, PM_PISTOL_1, TOURIST_BACKPACK_1, WORK_JACKET_1 } from '../items';

export const HERO_ID = 'hero';
export const MAXIM_ID = 'maxim';

export const HERO: CharacterTemplate = {
  id: HERO_ID,
  name: 'Герой',
  isHero: true,
  attributes: { strength: 5, agility: 5, endurance: 5, perception: 5, intelligence: 5 },
  skills: { firearms: 2, melee: 2, medicine: 1, scavenging: 2, stealth: 1 },
  equipment: { sidearm: PM_PISTOL_1, primary: null, melee: null, body: WORK_JACKET_1, backpack: null },
  condition: { health: 100, maxHealth: 100, hungry: false, thirsty: false },
};

/** Test companion for the prototype. */
export const MAXIM: CharacterTemplate = {
  id: MAXIM_ID,
  name: 'Максим',
  isHero: false,
  attributes: { strength: 6, agility: 4, endurance: 6, perception: 4, intelligence: 4 },
  skills: { firearms: 1, melee: 3, medicine: 0, scavenging: 2, stealth: 1 },
  equipment: { sidearm: null, primary: null, melee: FIRE_AXE_1, body: null, backpack: TOURIST_BACKPACK_1 },
  condition: { health: 100, maxHealth: 100, hungry: false, thirsty: false },
};

export const STARTING_CHARACTERS: readonly CharacterTemplate[] = [HERO, MAXIM];
