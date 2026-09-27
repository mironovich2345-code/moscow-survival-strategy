import type { LocationDefinition } from '@game/world';

export const BASE_LOCATION_ID = 'zhk_status';
export const LEFORTOVO_PHARMACY_ID = 'lefortovo_pharmacy';
export const LEFORTOVO_GROCERY_ID = 'lefortovo_grocery';
export const LEFORTOVO_PARKING_ID = 'lefortovo_parking';
export const LEFORTOVO_POLICE_ID = 'lefortovo_police';
export const FITNESS_CLUB_ID = 'maxim_fitness_club';
export const SOKOLINAYA_OUTSKIRTS_ID = 'sokolinaya_outskirts';
export const ARENA_WAREHOUSE_ID = 'arena_warehouse';
export const ARENA_GYM_ID = 'arena_gym';

/** Values are prototype balance — see docs/GAME_RULES.md «Локации Лефортово». */
export const LOCATIONS = {
  [BASE_LOCATION_ID]: {
    id: BASE_LOCATION_ID,
    name: 'ЖК «Статус»',
    districtId: 'lefortovo',
    kind: 'base',
    description: 'Жилой комплекс, ставший убежищем группы.',
    risk: 'none',
    expeditionTurns: 0,
    loot: [],
  },
  [LEFORTOVO_PHARMACY_ID]: {
    id: LEFORTOVO_PHARMACY_ID,
    name: 'Аптека',
    districtId: 'lefortovo',
    kind: 'pharmacy',
    description: 'Небольшая аптека на первом этаже жилого дома в паре кварталов от базы.',
    risk: 'low',
    // 3 turns = 6 hours: дорога туда, обыск, дорога обратно.
    expeditionTurns: 3,
    loot: [{ resource: 'medicine', min: 1, max: 5 }],
  },
  [LEFORTOVO_GROCERY_ID]: {
    id: LEFORTOVO_GROCERY_ID,
    name: 'Продуктовый магазин',
    districtId: 'lefortovo',
    kind: 'grocery',
    description: 'Магазин у дома. Витрины разбиты, но на складе могло что-то остаться.',
    risk: 'low',
    expeditionTurns: 3,
    loot: [
      { resource: 'food', min: 2, max: 6 },
      { resource: 'water', min: 2, max: 6 },
    ],
  },
  [LEFORTOVO_PARKING_ID]: {
    id: LEFORTOVO_PARKING_ID,
    name: 'Подземная парковка',
    districtId: 'lefortovo',
    kind: 'parking',
    description: 'Тёмная парковка под жилым комплексом. Брошенные машины и кладовки.',
    risk: 'medium',
    expeditionTurns: 4,
    loot: [
      { resource: 'fuel', min: 2, max: 5 },
      { resource: 'materials', min: 2, max: 6 },
    ],
    itemLoot: [
      { defId: 'city_backpack', chancePercent: 15 },
      { defId: 'crowbar', chancePercent: 15 },
    ],
  },
  [LEFORTOVO_POLICE_ID]: {
    id: LEFORTOVO_POLICE_ID,
    name: 'Отдел полиции',
    districtId: 'lefortovo',
    kind: 'police',
    description: 'Районный отдел полиции. Возможно, оружейная комната не пуста.',
    risk: 'high',
    expeditionTurns: 5,
    loot: [
      { resource: 'ammunition', min: 6, max: 15 },
      { resource: 'medicine', min: 1, max: 2, chancePercent: 25 },
    ],
    itemLoot: [
      { defId: 'pump_shotgun', chancePercent: 10 },
      { defId: 'police_vest', chancePercent: 15 },
    ],
  },
  [FITNESS_CLUB_ID]: {
    id: FITNESS_CLUB_ID,
    name: 'Фитнес-клуб Максима',
    districtId: 'lefortovo',
    kind: 'fitness_club',
    description: 'Клуб, где до катастрофы работал тренером друг героя, Максим.',
    risk: 'low',
    // 2 turns = 4 hours: arrival after 1 turn, back after 2.
    expeditionTurns: 2,
    loot: [{ resource: 'water', min: 0, max: 2 }],
  },
  [SOKOLINAYA_OUTSKIRTS_ID]: {
    id: SOKOLINAYA_OUTSKIRTS_ID,
    name: 'Окраина промзоны',
    districtId: 'sokolinaya_gora',
    kind: 'industrial',
    description: 'Склады и гаражи на краю промзоны. Говорят, здесь ходят вооружённые люди.',
    risk: 'medium',
    expeditionTurns: 3,
    loot: [
      { resource: 'materials', min: 1, max: 4 },
      { resource: 'fuel', min: 0, max: 2 },
    ],
  },
  [ARENA_WAREHOUSE_ID]: {
    id: ARENA_WAREHOUSE_ID,
    name: 'Склад Арены',
    districtId: 'sokolinaya_gora',
    kind: 'faction_site',
    description: 'Охраняемый склад. Соваться туда сейчас — самоубийство.',
    risk: 'high',
    expeditionTurns: 3,
    loot: [],
    restricted: true,
    hiddenUntilFlag: 'arena_met',
  },
  [ARENA_GYM_ID]: {
    id: ARENA_GYM_ID,
    name: 'Спортзал Арены',
    districtId: 'sokolinaya_gora',
    kind: 'faction_site',
    description: 'Бывший спортзал, теперь — база Арены.',
    risk: 'high',
    expeditionTurns: 3,
    loot: [],
    restricted: true,
    hiddenUntilFlag: 'arena_met',
  },
} as const satisfies Record<string, LocationDefinition>;
