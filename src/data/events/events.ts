import type { EventDefinition } from '@game/events';

/**
 * Prototype expedition events (0.2). Text only, no combat.
 * Effects: `resources` → expedition haul, `delay` → +N turns, `abort` → go home without loot.
 */
export const EVENTS = {
  noise_next_building: {
    id: 'noise_next_building',
    title: 'Шум в соседнем здании',
    description:
      'Из соседнего подъезда доносится грохот — будто кто-то роняет мебель. Потом тишина.',
    choices: [
      {
        id: 'investigate',
        text: 'Осторожно проверить',
        outcomes: [
          {
            id: 'supplies',
            weight: 60,
            text: 'Шкаф упал сам. В квартире нашлись бутылки воды и консервы.',
            effects: [{ type: 'resources', delta: { food: 1, water: 2 } }],
          },
          {
            id: 'infected',
            weight: 40,
            text: 'На лестнице мелькнул заражённый. Отряд затаился и переждал.',
            effects: [{ type: 'delay', turns: 1 }],
          },
        ],
      },
      {
        id: 'avoid',
        text: 'Обойти стороной',
        outcomes: [
          {
            id: 'detour',
            weight: 1,
            text: 'Отряд обходит квартал дворами. Это заняло время.',
            effects: [{ type: 'delay', turns: 1 }],
          },
        ],
      },
    ],
  },
  locked_door: {
    id: 'locked_door',
    title: 'Закрытая дверь',
    description: 'Металлическая дверь подсобки заперта. За ней может быть что-то ценное.',
    choices: [
      {
        id: 'force',
        text: 'Выбить замок',
        outcomes: [
          {
            id: 'first_aid',
            weight: 50,
            text: 'Внутри — аптечка и пара бутылок воды.',
            effects: [{ type: 'resources', delta: { medicine: 2, water: 1 } }],
          },
          {
            id: 'noise',
            weight: 50,
            text: 'Грохот разносится по району. Пришлось уходить и прятаться.',
            effects: [{ type: 'delay', turns: 1 }],
          },
        ],
      },
      {
        id: 'leave',
        text: 'Не рисковать',
        outcomes: [
          { id: 'nothing', weight: 1, text: 'Отряд идёт дальше.', effects: [] },
        ],
      },
    ],
  },
  other_group_tracks: {
    id: 'other_group_tracks',
    title: 'Следы другой группы',
    description: 'Свежие следы ботинок и окурки. Здесь недавно были живые люди.',
    choices: [
      {
        id: 'follow',
        text: 'Пойти по следам',
        outcomes: [
          {
            id: 'cache',
            weight: 50,
            text: 'Следы ведут к брошенному тайнику с едой и водой.',
            effects: [{ type: 'resources', delta: { food: 2, water: 2 } }],
          },
          {
            id: 'spotted',
            weight: 50,
            text: 'Отряд заметили издалека. Решили не испытывать судьбу и повернуть домой.',
            effects: [{ type: 'abort' }],
          },
        ],
      },
      {
        id: 'change_route',
        text: 'Сменить маршрут',
        outcomes: [
          {
            id: 'detour',
            weight: 1,
            text: 'Отряд идёт в обход. Потеряно время.',
            effects: [{ type: 'delay', turns: 1 }],
          },
        ],
      },
    ],
  },
  lone_infected: {
    id: 'lone_infected',
    title: 'Один заражённый',
    description: 'Посреди улицы стоит заражённый в форме курьера. Он пока не заметил отряд.',
    choices: [
      {
        id: 'shoot',
        text: 'Застрелить',
        outcomes: [
          {
            id: 'shot',
            weight: 1,
            text: 'Пара выстрелов — и путь свободен. Патроны потрачены.',
            effects: [{ type: 'resources', delta: { ammunition: -2 } }],
          },
        ],
      },
      {
        id: 'sneak',
        text: 'Переждать и обойти',
        outcomes: [
          {
            id: 'waited',
            weight: 1,
            text: 'Заражённый ушёл сам, но ждать пришлось долго.',
            effects: [{ type: 'delay', turns: 1 }],
          },
        ],
      },
      {
        id: 'retreat',
        text: 'Вернуться на базу',
        outcomes: [
          {
            id: 'retreated',
            weight: 1,
            text: 'Отряд разворачивается и идёт домой ни с чем.',
            effects: [{ type: 'abort' }],
          },
        ],
      },
    ],
  },
  abandoned_bag: {
    id: 'abandoned_bag',
    title: 'Брошенная сумка',
    description: 'У подъезда лежит спортивная сумка. Похоже, хозяин бросил её в спешке.',
    choices: [
      {
        id: 'take',
        text: 'Забрать',
        outcomes: [
          {
            id: 'meds_food',
            weight: 40,
            text: 'Бинты, таблетки и пачка галет.',
            effects: [{ type: 'resources', delta: { medicine: 1, food: 1 } }],
          },
          {
            id: 'water',
            weight: 40,
            text: 'Две полные бутылки воды.',
            effects: [{ type: 'resources', delta: { water: 2 } }],
          },
          {
            id: 'empty',
            weight: 20,
            text: 'Внутри только одежда.',
            effects: [],
          },
        ],
      },
      {
        id: 'ignore',
        text: 'Не трогать',
        outcomes: [
          { id: 'nothing', weight: 1, text: 'Отряд проходит мимо.', effects: [] },
        ],
      },
    ],
  },
} as const satisfies Record<string, EventDefinition>;
