import type { DistrictDefinition } from '@game/world';

/** Prototype map: five districts in the east of Moscow. Grid is schematic, not to scale. */
export const DISTRICTS = {
  sokolinaya_gora: {
    id: 'sokolinaya_gora',
    name: 'Соколиная гора',
    description: 'Промзоны и старые пятиэтажки к северу от Лефортово.',
    mapPosition: { column: 2, row: 1 },
  },
  izmailovo: {
    id: 'izmailovo',
    name: 'Измайлово',
    description: 'Огромный парк и гостиничный комплекс.',
    mapPosition: { column: 3, row: 1 },
  },
  lefortovo: {
    id: 'lefortovo',
    name: 'Лефортово',
    description: 'Домашний район. Здесь находится база — ЖК «Статус».',
    mapPosition: { column: 1, row: 2 },
  },
  perovo: {
    id: 'perovo',
    name: 'Перово',
    description: 'Плотная жилая застройка и железная дорога.',
    mapPosition: { column: 2, row: 2 },
  },
  novogireevo: {
    id: 'novogireevo',
    name: 'Новогиреево',
    description: 'Спальный район у самой МКАД.',
    mapPosition: { column: 3, row: 2 },
  },
} as const satisfies Record<string, DistrictDefinition>;

export type KnownDistrictId = keyof typeof DISTRICTS;
