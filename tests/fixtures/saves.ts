/**
 * Saves exactly as older prototypes wrote them to localStorage.
 * Frozen: never update these to the current format.
 */

const V1_V2_HERO = {
  id: 'hero',
  name: 'Герой',
  isHero: true,
  attributes: { strength: 5, agility: 5, endurance: 5, perception: 5, intelligence: 5 },
  skills: { firearms: 2, melee: 2, medicine: 1, scavenging: 2, stealth: 1 },
  equipment: { weapon: 'pm_pistol', armor: 'work_jacket', backpack: null },
};
const V1_V2_MAXIM = {
  id: 'maxim',
  name: 'Максим',
  isHero: false,
  attributes: { strength: 6, agility: 4, endurance: 6, perception: 4, intelligence: 4 },
  skills: { firearms: 1, melee: 3, medicine: 0, scavenging: 2, stealth: 1 },
  equipment: { weapon: 'fire_axe', armor: null, backpack: 'tourist_backpack' },
};

/** Prototype 0.1: Maxim on the way to the pharmacy. */
export const SAVE_V1 = {
  version: 1,
  seed: 42,
  rng: 1234567,
  time: 226,
  turn: 2,
  baseLocationId: 'zhk_status',
  resources: { food: 20, water: 20, medicine: 2, ammunition: 24, fuel: 10, materials: 15 },
  characters: [
    { ...V1_V2_HERO, condition: { health: 100, maxHealth: 100 }, assignment: { type: 'base' } },
    {
      ...V1_V2_MAXIM,
      condition: { health: 100, maxHealth: 100 },
      assignment: { type: 'expedition', expeditionId: 'exp-2' },
    },
  ],
  expeditions: [
    { id: 'exp-2', locationId: 'lefortovo_pharmacy', memberIds: ['maxim'], departedAt: 224, returnsAt: 230 },
  ],
  log: [
    { type: 'campaignStarted', id: 'log-1', at: 224 },
    {
      type: 'expeditionDeparted',
      expeditionId: 'exp-2',
      locationId: 'lefortovo_pharmacy',
      memberIds: ['maxim'],
      id: 'log-3',
      at: 224,
    },
  ],
  nextId: 4,
};

/**
 * Prototype 0.2: hero + Maxim at the police station after shooting an
 * infected (ammo −2 still in the haul) and picking up water; Maxim hungry.
 */
export const SAVE_V2 = {
  version: 2,
  seed: 7,
  rng: 987654321,
  time: 250,
  turn: 14,
  baseLocationId: 'zhk_status',
  resources: { food: 0, water: 16, medicine: 2, ammunition: 24, fuel: 10, materials: 15 },
  characters: [
    {
      ...V1_V2_HERO,
      condition: { health: 100, maxHealth: 100, hungry: false, thirsty: false },
      assignment: { type: 'expedition', expeditionId: 'exp-5' },
    },
    {
      ...V1_V2_MAXIM,
      condition: { health: 100, maxHealth: 100, hungry: true, thirsty: false },
      assignment: { type: 'expedition', expeditionId: 'exp-5' },
    },
  ],
  expeditions: [
    {
      id: 'exp-5',
      locationId: 'lefortovo_police',
      memberIds: ['hero', 'maxim'],
      departedAt: 244,
      returnsAt: 254,
      haul: { water: 2, ammunition: -2 },
      pendingEventId: 'locked_door',
      seenEventIds: ['lone_infected', 'locked_door'],
      aborted: false,
    },
  ],
  log: [
    { type: 'campaignStarted', id: 'log-1', at: 224 },
    { type: 'dailyConsumption', day: 11, aliveCount: 2, consumed: { food: 1, water: 2 }, id: 'log-2', at: 240 },
    { type: 'shortage', resource: 'food', characterIds: ['maxim'], id: 'log-3', at: 240 },
    {
      type: 'expeditionDeparted',
      expeditionId: 'exp-5',
      locationId: 'lefortovo_police',
      memberIds: ['hero', 'maxim'],
      id: 'log-6',
      at: 244,
    },
    { type: 'expeditionEvent', expeditionId: 'exp-5', locationId: 'lefortovo_police', eventId: 'lone_infected', id: 'log-7', at: 246 },
    { type: 'eventChoice', expeditionId: 'exp-5', eventId: 'lone_infected', choiceId: 'shoot', outcomeId: 'shot', id: 'log-8', at: 246 },
    { type: 'expeditionEvent', expeditionId: 'exp-5', locationId: 'lefortovo_police', eventId: 'locked_door', id: 'log-9', at: 250 },
    {
      type: 'expeditionReturned',
      expeditionId: 'exp-4',
      locationId: 'lefortovo_pharmacy',
      memberIds: ['hero'],
      loot: { medicine: 3 },
      aborted: false,
      id: 'log-4',
      at: 236,
    },
    { type: 'lootFound', expeditionId: 'exp-4', locationId: 'lefortovo_pharmacy', loot: { medicine: 3 }, scavengingBonusPercent: 20, id: 'log-5', at: 236 },
  ],
  nextId: 10,
};
