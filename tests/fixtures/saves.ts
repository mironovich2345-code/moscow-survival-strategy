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

const V3_CHARACTER_BASE = {
  hero: {
    ...V1_V2_HERO,
    equipment: { sidearm: 'pm_pistol-1', primary: null, melee: null, body: 'work_jacket-1', backpack: null },
  },
  maxim: {
    ...V1_V2_MAXIM,
    equipment: { sidearm: null, primary: null, melee: 'fire_axe-1', body: null, backpack: 'tourist_backpack-1' },
  },
};

/** Prototype 0.3: squad at the police station with supplies and found water; jacket in storage. */
export const SAVE_V3 = {
  version: 3,
  seed: 11,
  rng: 55555,
  time: 228,
  turn: 3,
  baseLocationId: 'zhk_status',
  resources: { food: 18, water: 18, medicine: 1, ammunition: 12, fuel: 10, materials: 15 },
  items: {
    'pm_pistol-1': { id: 'pm_pistol-1', defId: 'pm_pistol' },
    'fire_axe-1': { id: 'fire_axe-1', defId: 'fire_axe' },
    'work_jacket-1': { id: 'work_jacket-1', defId: 'work_jacket' },
    'tourist_backpack-1': { id: 'tourist_backpack-1', defId: 'tourist_backpack' },
  },
  storage: { items: ['work_jacket-1'] },
  characters: [
    {
      ...V3_CHARACTER_BASE.hero,
      equipment: { ...V3_CHARACTER_BASE.hero.equipment, body: null },
      condition: { health: 100, maxHealth: 100, hungry: false, thirsty: false },
      assignment: { type: 'expedition', expeditionId: 'exp-3' },
    },
    {
      ...V3_CHARACTER_BASE.maxim,
      condition: { health: 100, maxHealth: 100, hungry: false, thirsty: false },
      assignment: { type: 'expedition', expeditionId: 'exp-3' },
    },
  ],
  expeditions: [
    {
      id: 'exp-3',
      locationId: 'lefortovo_police',
      memberIds: ['hero', 'maxim'],
      departedAt: 224,
      returnsAt: 234,
      supplies: { food: 2, water: 2, medicine: 1, ammunition: 12 },
      haul: { water: 2 },
      pendingEventId: null,
      seenEventIds: ['abandoned_bag'],
      aborted: false,
    },
  ],
  log: [
    { type: 'campaignStarted', id: 'log-1', at: 224 },
    {
      type: 'expeditionDeparted',
      expeditionId: 'exp-3',
      locationId: 'lefortovo_police',
      memberIds: ['hero', 'maxim'],
      supplies: { food: 2, water: 2, medicine: 1, ammunition: 12 },
      id: 'log-4',
      at: 224,
    },
    {
      type: 'lootFound',
      expeditionId: 'exp-0',
      locationId: 'lefortovo_pharmacy',
      loot: { medicine: 2 },
      scavengingBonusPercent: 40,
      leftBehind: {},
      id: 'log-2',
      at: 200,
    },
    {
      type: 'expeditionReturned',
      expeditionId: 'exp-0',
      locationId: 'lefortovo_pharmacy',
      memberIds: ['hero'],
      loot: { medicine: 2 },
      suppliesReturned: {},
      aborted: false,
      id: 'log-3',
      at: 200,
    },
  ],
  nextId: 6,
};

/** Prototype 0.3.1: SAVE_V3's trip after the mid-trip search found a crowbar. */
export const SAVE_V4 = {
  ...SAVE_V3,
  version: 4,
  items: { ...SAVE_V3.items, 'crowbar-6': { id: 'crowbar-6', defId: 'crowbar' } },
  expeditions: [
    {
      ...SAVE_V3.expeditions[0]!,
      haul: { water: 2, ammunition: 9 },
      haulItems: ['crowbar-6'],
      searched: true,
      searchAt: 230,
    },
  ],
  log: [
    ...SAVE_V3.log.map((entry) =>
      entry.type === 'lootFound'
        ? { ...entry, items: [], itemsLeftBehind: [] }
        : entry.type === 'expeditionReturned'
          ? { ...entry, items: [] }
          : entry,
    ),
  ],
  nextId: 7,
};

/** Prototype 0.4.1 (v5): SAVE_V4's campaign after the combat update — test Maxim in the group. */
export const SAVE_V5 = {
  ...SAVE_V4,
  version: 5,
  combat: null,
  lostItems: [],
  expeditions: SAVE_V4.expeditions.map((e) => ({ ...e, lostItems: [] })),
  log: SAVE_V4.log.map((entry) => (entry.type === 'expeditionReturned' ? { ...entry, itemsLost: [] } : entry)),
};

/** Prototype 0.5 (v6): SAVE_V5's campaign after the story update (test Maxim kept). */
export const SAVE_V6 = {
  ...SAVE_V5,
  version: 6,
  characters: SAVE_V5.characters.map((c) => ({ ...c, traits: c.id === 'maxim' ? ['reliable'] : [] })),
  storyFlags: { maxim_location_known: true, maxim_met: true, maxim_recruited: true },
  recruits: { maxim: { status: 'recruited' } },
  relations: { maxim: { trust: 50 } },
  log: SAVE_V5.log,
};
