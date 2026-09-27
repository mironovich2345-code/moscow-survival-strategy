import type { RecruitDefinition, TraitDefinition } from '@game/story';
import { FITNESS_CLUB_ID } from '../locations';
import { HERO_ID, MAXIM_ID } from './startingCharacters';

export const TRAITS = {
  reliable: {
    id: 'reliable',
    name: 'Надёжный',
    description: 'Редко бросает своих и спокойнее большинства действует под давлением.',
  },
} as const satisfies Record<string, TraitDefinition>;

/** Maxim — the hero's friend, a fitness trainer before the catastrophe (GAME_BIBLE §9). */
export const MAXIM_RECRUIT: RecruitDefinition = {
  id: MAXIM_ID,
  name: 'Максим',
  teaser: 'Максим — друг героя.',
  lastKnownLocationId: FITNESS_CLUB_ID,
  initialStatus: 'unavailable',
  attributes: { strength: 6, agility: 4, endurance: 6, perception: 4, intelligence: 4 },
  skills: { firearms: 1, melee: 3, medicine: 0, scavenging: 2, stealth: 1 },
  traits: ['reliable'],
  startingEquipment: ['fire_axe', 'tourist_backpack'],
  baseTrust: 50,
  conditions: [
    { type: 'memberInExpedition', characterId: HERO_ID },
    { type: 'storyFlag', flag: 'maxim_met', value: true },
    { type: 'groupHasRoom' },
  ],
};

export const RECRUITS: Readonly<Record<string, RecruitDefinition>> = {
  [MAXIM_ID]: MAXIM_RECRUIT,
};
