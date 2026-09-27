import type { EventChoice, EventDefinition } from '@game/events';
import type { StoryTrigger } from '@game/story';
import { HERO_ID, MAXIM_ID } from '../characters/startingCharacters';
import { FITNESS_CLUB_ID, SOKOLINAYA_OUTSKIRTS_ID } from '../locations';

/**
 * Story chain «Максим» (Prototype 0.5). Short placeholder texts: the system
 * is what matters, the writing will be filled in later.
 */

/** The decision about Maxim, shared by the first meeting and later visits. */
const MAXIM_DECISION: readonly EventChoice[] = [
  {
    id: 'invite',
    text: '«Пойдём со мной. У меня есть место.»',
    outcomes: [
      {
        id: 'joined',
        weight: 1,
        text: 'Максим молча берёт топор и рюкзак. «Пошли.»',
        effects: [
          { type: 'recruit', recruitId: MAXIM_ID },
          { type: 'setFlag', flag: 'maxim_recruited', value: true },
          { type: 'trust', characterId: MAXIM_ID, delta: 10 },
        ],
      },
    ],
  },
  {
    id: 'stay',
    text: '«Оставайся здесь. Я ещё вернусь.»',
    outcomes: [
      {
        id: 'waits',
        weight: 1,
        text: 'Максим кивает: «Буду здесь».',
        effects: [{ type: 'recruitStatus', recruitId: MAXIM_ID, status: 'available' }],
      },
    ],
  },
  {
    id: 'refuse',
    text: '«Дальше каждый сам за себя.»',
    outcomes: [
      {
        id: 'refused',
        weight: 1,
        text: 'Максим долго смотрит на героя и ничего не отвечает.',
        effects: [
          { type: 'recruitStatus', recruitId: MAXIM_ID, status: 'declined' },
          { type: 'setFlag', flag: 'maxim_refused', value: true },
          { type: 'trust', characterId: MAXIM_ID, delta: -20 },
        ],
      },
    ],
  },
];

export const STORY_EVENTS = {
  maxim_car: {
    id: 'maxim_car',
    kind: 'story',
    title: 'Знакомая машина',
    description: 'У входа в фитнес-клуб стоит машина Максима. Двери клуба закрыты изнутри.',
    choices: [
      {
        id: 'enter',
        text: 'Войти внутрь',
        outcomes: [
          {
            id: 'entered',
            weight: 1,
            text: 'Герой стучит условным стуком. Изнутри отзывается знакомый голос.',
            effects: [
              { type: 'setFlag', flag: 'maxim_met', value: true },
              { type: 'recruitStatus', recruitId: MAXIM_ID, status: 'available' },
              { type: 'storyEvent', eventId: 'maxim_found' },
            ],
          },
        ],
      },
      {
        id: 'leave',
        text: 'Уйти',
        outcomes: [
          {
            id: 'left',
            weight: 1,
            text: 'Герой уходит. Машина остаётся стоять у клуба.',
            effects: [{ type: 'abort' }],
          },
        ],
      },
    ],
  },
  maxim_found: {
    id: 'maxim_found',
    kind: 'story',
    title: 'Максим',
    description:
      'Максим жив. Он один — все эти дни держался в клубе, забаррикадировав вход. «Я знал, что ты придёшь».',
    choices: MAXIM_DECISION,
  },
  maxim_waiting: {
    id: 'maxim_waiting',
    kind: 'story',
    title: 'Максим ждёт',
    description: 'Максим по-прежнему в клубе. «Ну что, решил?»',
    choices: MAXIM_DECISION,
  },
  arena_first_contact: {
    id: 'arena_first_contact',
    kind: 'story',
    title: 'Люди с повязками',
    description:
      'Дорогу перегораживают трое с одинаковыми повязками на рукавах. «Это наш район. Хочешь пройти — плати».',
    choices: [
      {
        id: 'pay',
        text: 'Отдать часть припасов',
        outcomes: [
          {
            id: 'paid',
            weight: 1,
            text: 'Они забирают еду, воду и патроны. «Умный. Передадим, что ты понятливый».',
            effects: [
              { type: 'resources', delta: { food: -2, water: -2, ammunition: -5 } },
              { type: 'factionContact', factionId: 'arena' },
              { type: 'factionAwareness', factionId: 'arena', delta: 10 },
              { type: 'setFlag', flag: 'arena_met', value: true },
            ],
          },
        ],
      },
      {
        id: 'refuse',
        text: 'Отказаться',
        outcomes: [
          {
            id: 'refused',
            weight: 1,
            text: '«Запомним». Они уходят, не сводя с отряда глаз.',
            effects: [
              { type: 'factionContact', factionId: 'arena' },
              { type: 'factionAwareness', factionId: 'arena', delta: 30 },
              { type: 'factionRelation', factionId: 'arena', delta: -20 },
              { type: 'setFlag', flag: 'arena_met', value: true },
            ],
          },
        ],
      },
      {
        id: 'slip_away',
        text: 'Попытаться уйти',
        outcomes: [
          {
            id: 'escaped',
            weight: 60,
            text: 'Отряд уходит дворами, пока люди с повязками спорят между собой.',
            effects: [
              { type: 'abort' },
              { type: 'factionContact', factionId: 'arena' },
              { type: 'factionAwareness', factionId: 'arena', delta: 5 },
              { type: 'setFlag', flag: 'arena_met', value: true },
            ],
          },
          {
            id: 'caught',
            weight: 40,
            text: 'Уйти не вышло. Отряд отпускают — с угрозами и обещанием «найти».',
            effects: [
              { type: 'factionContact', factionId: 'arena' },
              { type: 'factionAwareness', factionId: 'arena', delta: 15 },
              { type: 'factionRelation', factionId: 'arena', delta: -15 },
              { type: 'setFlag', flag: 'arena_met', value: true },
            ],
          },
        ],
      },
    ],
  },
} as const satisfies Record<string, EventDefinition>;

export const STORY_TRIGGERS: readonly StoryTrigger[] = [
  {
    id: 'maxim_first_visit',
    locationId: FITNESS_CLUB_ID,
    eventId: 'maxim_car',
    conditions: [
      { type: 'flag', flag: 'maxim_met', value: false },
      { type: 'recruitStatus', recruitId: MAXIM_ID, statuses: ['unavailable'] },
    ],
    requiredMemberIds: [HERO_ID],
  },
  {
    id: 'maxim_revisit',
    locationId: FITNESS_CLUB_ID,
    eventId: 'maxim_waiting',
    conditions: [
      { type: 'flag', flag: 'maxim_met', value: true },
      { type: 'recruitStatus', recruitId: MAXIM_ID, statuses: ['available'] },
    ],
    requiredMemberIds: [HERO_ID],
  },
  {
    id: 'arena_first_contact',
    locationId: SOKOLINAYA_OUTSKIRTS_ID,
    eventId: 'arena_first_contact',
    conditions: [{ type: 'flag', flag: 'arena_met', value: false }],
    requiredMemberIds: [],
  },
];
