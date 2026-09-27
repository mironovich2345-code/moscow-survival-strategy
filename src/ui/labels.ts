import type {
  AttributeId,
  EquipmentSlot,
  GameError,
  CombatRole,
  GameLogEntry,
  ItemCategory,
  RecruitmentStatus,
  TrustCategory,
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

export const RECRUIT_STATUS_LABELS: Record<RecruitmentStatus, string> = {
  unavailable: 'ещё не встречен',
  available: 'может присоединиться',
  invited: 'приглашён',
  recruited: 'в группе',
  declined: 'Герой отказался его брать',
  dead: 'погиб',
};

export const TRUST_LABELS: Record<TrustCategory, string> = {
  distrust: 'Недоверие',
  wary: 'Осторожность',
  neutral: 'Нейтрально',
  trust: 'Доверие',
  highTrust: 'Высокое доверие',
};

export const COMBAT_ROLE_LABELS: Record<CombatRole, string> = {
  shooter: 'стрелок',
  melee: 'ближний бой',
  support: 'поддержка',
};

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  firearm: 'огнестрел',
  melee: 'холодное',
  tool: 'инструмент',
  armor: 'защита',
  backpack: 'рюкзак',
};

/** Item name by definition id (for logs of items that were left behind). */
export function itemName(defId: string): string {
  return GAME_CONTENT.items[defId]?.name ?? defId;
}

/** ["Медикаменты ×3", "Помповый дробовик ×1"] — resources and unique items grouped by type. */
export function foundList(
  resources: ResourceDelta,
  itemDefIds: readonly string[],
): string[] {
  const lines = RESOURCE_KINDS.filter((kind) => (resources[kind] ?? 0) > 0).map(
    (kind) => `${RESOURCE_LABELS[kind]} ×${resources[kind] ?? 0}`,
  );
  const counts = new Map<string, number>();
  for (const defId of itemDefIds) counts.set(defId, (counts.get(defId) ?? 0) + 1);
  for (const [defId, n] of counts) lines.push(`${itemName(defId)} ×${n}`);
  return lines;
}

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
  COMBAT_ACTIVE: 'Идёт бой — сначала завершите его.',
  NO_COMBAT: 'Боя нет.',
  COMBAT_OVER: 'Бой уже окончен.',
  COMBAT_NOT_OVER: 'Бой ещё идёт.',
  NOT_A_COMBATANT: 'Персонаж не участвует в бою.',
  NOT_IN_SETUP: 'Расстановку можно менять только до первого раунда.',
  LINE_FULL: 'В этой линии уже 3 человека.',
  NO_WEAPON: 'В этом слоте нет оружия.',
  MELEE_FROM_BACK: 'Ближним оружием можно бить только из первой линии.',
  NO_AMMUNITION: 'Нет патронов.',
  UNKNOWN_TARGET: 'Нет такой цели.',
  NO_MEDICINE: 'У отряда нет медикаментов.',
  INVALID_ENEMY_COUNT: 'Заражённых должно быть от 1 до 4.',
  EXPEDITION_BUSY: 'Эта экспедиция сейчас не может вступить в бой.',
  MISSING_ACTIONS: 'Выберите действие каждому живому персонажу.',
  GROUP_FULL: 'В группе уже 12 человек — места нет.',
  RECRUIT_UNKNOWN: 'Неизвестный персонаж.',
  RECRUIT_NOT_AVAILABLE: 'Этого человека сейчас нельзя позвать.',
  REQUIRED_MEMBER_MISSING: 'В этом походе обязательно должен участвовать Герой.',
  STORY_FLAG_MISSING: 'Для этого ещё не время.',
  ALREADY_RECRUITED: 'Уже в группе.',
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
      return entry.story
        ? `Сюжет (${locationName(entry.locationId)}): «${eventOf(entry.eventId)?.title ?? entry.eventId}».`
        : `Событие в пути (${locationName(entry.locationId)}): «${eventOf(entry.eventId)?.title ?? entry.eventId}».`;
    case 'locationArrived':
      return `Отряд прибыл: ${locationName(entry.locationId)}.`;
    case 'recruitStatusChanged':
      return `${nameOf(entry.recruitId)}: ${RECRUIT_STATUS_LABELS[entry.status as RecruitmentStatus] ?? entry.status}.`;
    case 'characterRecruited':
      return `${nameOf(entry.characterId)} присоединился к группе (со своим снаряжением: ${entry.items.length} предм.).`;
    case 'trustChanged':
      return `${nameOf(entry.characterId)}: отношение к Герою ${entry.delta >= 0 ? 'улучшилось' : 'ухудшилось'}.`;
    case 'eventChoice': {
      const event = eventOf(entry.eventId);
      const choice = event?.choices.find((c) => c.id === entry.choiceId);
      const outcome = choice?.outcomes.find((o) => o.id === entry.outcomeId);
      const text = choice?.text ?? entry.choiceId;
      const quoted = text.startsWith('«') ? text : `«${text}»`;
      const parts = [`Решение: ${quoted}. ${outcome?.text ?? ''}`.trim()];
      if (hasAny(entry.spent)) parts.push(`Потрачено: ${formatAmounts(entry.spent)}.`);
      if (hasAny(entry.gained)) parts.push(`Найдено: ${formatAmounts(entry.gained)}.`);
      if (hasAny(entry.leftBehind)) parts.push(`Не унесли: ${formatAmounts(entry.leftBehind)}.`);
      return parts.join(' ');
    }
    case 'lootFound': {
      const bonus = entry.scavengingBonusPercent > 0 ? ` (поиск +${entry.scavengingBonusPercent} %)` : '';
      const left = hasAny(entry.leftBehind) ? ` Не поместилось, осталось на месте: ${formatAmounts(entry.leftBehind)}.` : '';
      const items = entry.items.length > 0 ? ` Предметы: ${entry.items.map((i) => itemName(i.defId)).join(', ')}.` : '';
      const itemsLeft =
        entry.itemsLeftBehind.length > 0
          ? ` Пришлось оставить (не хватило места): ${entry.itemsLeftBehind.map(itemName).join(', ')}.`
          : '';
      return `Найдено в локации «${locationName(entry.locationId)}»: ${formatDelta(entry.loot)}${bonus}.${left}${items}${itemsLeft}`;
    }
    case 'expeditionReturned':
      return `${
        entry.aborted
          ? `Отряд прервал поход в «${locationName(entry.locationId)}» и вернулся.`
          : `Отряд вернулся из локации «${locationName(entry.locationId)}».`
      } На склад: ${formatAmounts(entry.loot)} (из них остаток припасов: ${formatAmounts(entry.suppliesReturned)})${
        entry.items.length > 0 ? `; предметы: ${entry.items.length}` : ''
      }${entry.itemsLost.length > 0 ? `. Вещи павших брошены: ${entry.itemsLost.length}` : ''}.`;
    case 'dailyConsumption':
      return `День ${entry.day}. ${entry.expeditionId === null ? 'База' : 'Отряд в пути (свои припасы)'}: паёк на ${entry.aliveCount} чел. — еда −${entry.consumed.food ?? 0}, вода −${entry.consumed.water ?? 0}.`;
    case 'combatStarted':
      return `Бой (${locationName(entry.locationId)}): заражённых — ${entry.enemies}.`;
    case 'combatEnded': {
      const result = { victory: 'победа', retreated: 'отступление', defeat: 'гибель отряда', setup: '—', active: '—' }[entry.result];
      const fallen = entry.fallen.length > 0 ? ` Погибли: ${entry.fallen.map(nameOf).join(', ')}.` : '';
      return `Бой окончен: ${result} (раундов: ${entry.rounds}).${fallen}`;
    }
    case 'characterDied':
      return `${nameOf(entry.characterId)} погиб.`;
    case 'expeditionLost':
      return `Отряд в локации «${locationName(entry.locationId)}» погиб. Вещи остались там: ${
        entry.itemsLost.length > 0 ? entry.itemsLost.length : 'нет'
      }.`;
    case 'shortage':
      return `${entry.expeditionId === null ? 'На базе' : 'В отряде'} не хватило ${CONSUMABLE_LABELS[entry.resource]}: ${entry.characterIds.map(nameOf).join(', ')}.`;
  }
}
