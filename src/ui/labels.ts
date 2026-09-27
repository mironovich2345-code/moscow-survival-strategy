import type {
  AttributeId,
  EquipmentSlot,
  GameError,
  GameLogEntry,
  ResourceDelta,
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
  weapon: 'Оружие',
  armor: 'Броня',
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
};

export function formatDelta(delta: ResourceDelta): string {
  const parts = RESOURCE_KINDS.filter((kind) => (delta[kind] ?? 0) !== 0).map(
    (kind) => `${RESOURCE_LABELS[kind]} +${delta[kind] ?? 0}`,
  );
  return parts.length > 0 ? parts.join(', ') : 'ничего';
}

export function describeLogEntry(entry: GameLogEntry, nameOf: (id: string) => string): string {
  const locationName = (id: string) => GAME_CONTENT.locations[id]?.name ?? id;
  switch (entry.type) {
    case 'campaignStarted':
      return 'Десятый день после катастрофы. Группа укрылась в ЖК «Статус».';
    case 'expeditionDeparted':
      return `Отряд (${entry.memberIds.map(nameOf).join(', ')}) вышел: ${locationName(entry.locationId)}.`;
    case 'expeditionReturned':
      return `Отряд вернулся из локации «${locationName(entry.locationId)}». Добыча: ${formatDelta(entry.loot)}.`;
  }
}
