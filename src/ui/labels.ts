import type {
  AttributeId,
  EquipmentSlot,
  GameError,
  GameLogEntry,
  LootRange,
  ResourceDelta,
  RiskLevel,
  ResourceKind,
  SkillId,
} from '@game/index';
import { RESOURCE_KINDS } from '@game/index';
import { GAME_CONTENT } from '@data/content';

/** All player-facing text for game identifiers lives in the UI layer. */

export const RESOURCE_LABELS: Record<ResourceKind, string> = {
  food: 'Еда',
  water: 'Вода',
  medicine: 'Медикаменты',
  ammunition: 'Патроны',
  fuel: 'Топливо',
  materials: 'Материалы',
};

export const ATTRIBUTE_LABELS: Record<AttributeId, string> = {
  strength: 'Сила',
  agility: 'Ловкость',
  endurance: 'Выносливость',
  perception: 'Восприятие',
  intelligence: 'Интеллект',
};

export const SKILL_LABELS: Record<SkillId, string> = {
  firearms: 'Огнестрел',
  melee: 'Ближний бой',
  medicine: 'Медицина',
  scavenging: 'Поиск',
  stealth: 'Скрытность',
};

export const SLOT_LABELS: Record<EquipmentSlot, string> = {
  sidearm: 'Пистолет',
  primary: 'Основное оружие',
  melee: 'Ближний бой',
  body: 'Тело',
  backpack: 'Рюкзак',
};

export const ERROR_LABELS: Record<GameError, string> = {
  UNKNOWN_LOCATION: 'Неизвестная локация.',
  LOCATION_NOT_EXPLORABLE: 'В эту локацию нельзя отправить отряд.',
  EMPTY_SQUAD: 'Выберите хотя бы одного человека.',
  SQUAD_TOO_LARGE: 'Слишком большой отряд.',
  DUPLICATE_MEMBER: 'Персонаж выбран дважды.',
  CHARACTER_NOT_FOUND: 'Персонаж не найден.',
  CHARACTER_UNAVAILABLE: 'Персонаж недоступен.',
  EXPEDITION_NOT_FOUND: 'Экспедиция не найдена.',
  NO_PENDING_EVENT: 'Нет события, требующего решения.',
  UNKNOWN_CHOICE: 'Неизвестный вариант решения.',
  EVENT_PENDING: 'Сначала примите решение по событию экспедиции.',
  CHOICE_UNAVAILABLE: 'У отряда нет нужных припасов для этого варианта.',
  INVALID_SUPPLIES: 'Некорректное количество припасов.',
  NOT_ENOUGH_SUPPLIES: 'На складе нет столько припасов.',
  OVERLOADED: 'Отряд перегружен: груз больше грузоподъёмности.',
  ITEM_NOT_FOUND: 'Предмет не найден.',
  ITEM_UNAVAILABLE: 'Предмет сейчас недоступен (владелец не на базе).',
  ITEM_ALREADY_THERE: 'Предмет уже там.',
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  none: 'нет',
  low: 'низкий',
  medium: 'средний',
  high: 'высокий',
};

/** "Медикаменты 1–5", "Медикаменты 1–2 (шанс 25 %)" with the search bonus applied. */
export function formatLootRange(range: LootRange, applyBonus: (n: number) => number = (n) => n): string {
  const chance = range.chancePercent !== undefined ? ` (шанс ${range.chancePercent} %)` : '';
  return `${RESOURCE_LABELS[range.resource]} ${applyBonus(range.min)}–${applyBonus(range.max)}${chance}`;
}

export function formatDelta(delta: ResourceDelta): string {
  const parts = RESOURCE_KINDS.filter((kind) => (delta[kind] ?? 0) !== 0).map((kind) => {
    const amount = delta[kind] ?? 0;
    return `${RESOURCE_LABELS[kind]} ${amount > 0 ? '+' : ''}${amount}`;
  });
  return parts.length > 0 ? parts.join(', ') : 'ничего';
}

function hasAny(delta: ResourceDelta): boolean {
  return RESOURCE_KINDS.some((kind) => (delta[kind] ?? 0) !== 0);
}

/** "Вода 2, Патроны 12" (no signs) or "ничего". */
export function formatAmounts(delta: ResourceDelta): string {
  const parts = RESOURCE_KINDS.filter((kind) => (delta[kind] ?? 0) !== 0).map(
    (kind) => `${RESOURCE_LABELS[kind]} ${delta[kind] ?? 0}`,
  );
  return parts.length > 0 ? parts.join(', ') : 'ничего';
}

const CONSUMABLE_LABELS = { food: 'еды', water: 'воды' } as const;

export function describeLogEntry(entry: GameLogEntry, nameOf: (id: string) => string): string {
  const locationName = (id: string) => GAME_CONTENT.locations[id]?.name ?? id;
  const eventOf = (id: string) => GAME_CONTENT.events[id];
  switch (entry.type) {
    case 'campaignStarted':
      return 'Десятый день после катастрофы. Группа укрылась в ЖК «Статус».';
    case 'expeditionDeparted':
      return `Отряд (${entry.memberIds.map(nameOf).join(', ')}) вышел: ${locationName(entry.locationId)}. Взяли: ${formatAmounts(entry.supplies)}.`;
    case 'expeditionEvent':
      return `Событие в пути (${locationName(entry.locationId)}): «${eventOf(entry.eventId)?.title ?? entry.eventId}».`;
    case 'eventChoice': {
      const event = eventOf(entry.eventId);
      const choice = event?.choices.find((c) => c.id === entry.choiceId);
      const outcome = choice?.outcomes.find((o) => o.id === entry.outcomeId);
      const parts = [`Решение: «${choice?.text ?? entry.choiceId}». ${outcome?.text ?? ''}`.trim()];
      if (hasAny(entry.spent)) parts.push(`Потрачено: ${formatAmounts(entry.spent)}.`);
      if (hasAny(entry.gained)) parts.push(`Найдено: ${formatAmounts(entry.gained)}.`);
      if (hasAny(entry.leftBehind)) parts.push(`Не унесли: ${formatAmounts(entry.leftBehind)}.`);
      return parts.join(' ');
    }
    case 'lootFound': {
      const bonus = entry.scavengingBonusPercent > 0 ? ` (поиск +${entry.scavengingBonusPercent} %)` : '';
      const left = hasAny(entry.leftBehind) ? ` Не поместилось, осталось на месте: ${formatAmounts(entry.leftBehind)}.` : '';
      return `Найдено в локации «${locationName(entry.locationId)}»: ${formatDelta(entry.loot)}${bonus}.${left}`;
    }
    case 'expeditionReturned':
      return `${
        entry.aborted
          ? `Отряд прервал поход в «${locationName(entry.locationId)}» и вернулся.`
          : `Отряд вернулся из локации «${locationName(entry.locationId)}».`
      } На склад: ${formatAmounts(entry.loot)} (из них остаток припасов: ${formatAmounts(entry.suppliesReturned)}).`;
    case 'dailyConsumption':
      return `День ${entry.day}. ${entry.expeditionId === null ? 'База' : 'Отряд в пути (свои припасы)'}: паёк на ${entry.aliveCount} чел. — еда −${entry.consumed.food ?? 0}, вода −${entry.consumed.water ?? 0}.`;
    case 'shortage':
      return `${entry.expeditionId === null ? 'На базе' : 'В отряде'} не хватило ${CONSUMABLE_LABELS[entry.resource]}: ${entry.characterIds.map(nameOf).join(', ')}.`;
  }
}
