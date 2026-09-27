import type { LocationDefinition } from '@game/world';

export const BASE_LOCATION_ID = 'zhk_status';
export const LEFORTOVO_PHARMACY_ID = 'lefortovo_pharmacy';
export const LEFORTOVO_GROCERY_ID = 'lefortovo_grocery';
export const LEFORTOVO_PARKING_ID = 'lefortovo_parking';
export const LEFORTOVO_POLICE_ID = 'lefortovo_police';

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
  },
} as const satisfies Record<string, LocationDefinition>;
