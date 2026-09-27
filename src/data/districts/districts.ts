import type { DistrictDefinition } from '@game/world';

/** Prototype map: five districts in the east of Moscow. Grid is schematic, not to scale. */
export const DISTRICTS = {
  sokolinaya_gora: {
    id: 'sokolinaya_gora',
    name: 'Соколиная гора',
    description: 'Промзоны и старые пятиэтажки к северу от Лефортово. Здесь замечены вооружённые люди.',
    mapPosition: { column: 2, row: 1 },
    initialController: 'arena',
    initialDiscovered: true,
    neighbors: ['lefortovo', 'perovo', 'izmailovo'],
  },
  izmailovo: {
    id: 'izmailovo',
    name: 'Измайлово',
    description: 'Огромный парк и гостиничный комплекс.',
    mapPosition: { column: 3, row: 1 },
    initialController: 'none',
    initialDiscovered: false,
    neighbors: ['sokolinaya_gora', 'novogireevo'],
  },
  lefortovo: {
    id: 'lefortovo',
    name: 'Лефортово',
    description: 'Домашний район. Здесь находится база — ЖК «Статус».',
    mapPosition: { column: 1, row: 2 },
    initialController: 'none',
    initialDiscovered: true,
    neighbors: ['sokolinaya_gora', 'perovo'],
  },
  perovo: {
    id: 'perovo',
    name: 'Перово',
    description: 'Плотная жилая застройка и железная дорога.',
    mapPosition: { column: 2, row: 2 },
    initialController: 'none',
    initialDiscovered: false,
    neighbors: ['lefortovo', 'sokolinaya_gora', 'novogireevo'],
  },
  novogireevo: {
    id: 'novogireevo',
    name: 'Новогиреево',
    description: 'Спальный район у самой МКАД.',
    mapPosition: { column: 3, row: 2 },
    initialController: 'none',
    initialDiscovered: false,
    neighbors: ['perovo', 'izmailovo'],
  },
} as const satisfies Record<string, DistrictDefinition>;

export type KnownDistrictId = keyof typeof DISTRICTS;
