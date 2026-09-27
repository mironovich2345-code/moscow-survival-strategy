import type { CharacterTemplate } from '@game/characters';
import { PM_PISTOL_1, WORK_JACKET_1 } from '../items';

export const HERO_ID = 'hero';
export const MAXIM_ID = 'maxim';

/** The hero. Final name not approved yet (GAME_BIBLE §2) — «Герой». */
export const HERO: CharacterTemplate = {
  id: HERO_ID,
  name: 'Герой',
  isHero: true,
  attributes: { strength: 5, agility: 5, endurance: 5, perception: 5, intelligence: 5 },
  skills: { firearms: 2, melee: 2, medicine: 1, scavenging: 2, stealth: 1 },
  traits: [],
  equipment: { sidearm: PM_PISTOL_1, primary: null, melee: null, body: WORK_JACKET_1, backpack: null },
  condition: { health: 100, maxHealth: 100, hungry: false, thirsty: false },
};

/** Since 0.5 a new campaign starts with the hero alone. */
export const STARTING_CHARACTERS: readonly CharacterTemplate[] = [HERO];
