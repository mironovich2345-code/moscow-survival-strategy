import type { LocationDefinition } from '@game/world';

export const BASE_LOCATION_ID = 'zhk_status';
export const LEFORTOVO_PHARMACY_ID = 'lefortovo_pharmacy';

export const LOCATIONS = {
  [BASE_LOCATION_ID]: {
    id: BASE_LOCATION_ID,
    name: 'ЖК «Статус»',
    districtId: 'lefortovo',
    kind: 'base',
    description: 'Жилой комплекс, ставший убежищем группы.',
    expeditionTurns: 0,
    loot: [],
  },
  [LEFORTOVO_PHARMACY_ID]: {
    id: LEFORTOVO_PHARMACY_ID,
    name: 'Аптека',
    districtId: 'lefortovo',
    kind: 'pharmacy',
    description: 'Небольшая аптека на первом этаже жилого дома в паре кварталов от базы.',
    // 3 turns = 6 hours: дорога туда, обыск, дорога обратно.
    expeditionTurns: 3,
    loot: [{ resource: 'medicine', min: 1, max: 5 }],
  },
} as const satisfies Record<string, LocationDefinition>;
