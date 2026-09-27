import type { CombatActionType, CombatLine, CombatLogEntry, CombatStatus, WeaponSlot } from '@game/index';
import { itemName } from './labels';

export const LINE_LABELS: Record<CombatLine, string> = { front: 'FRONT', back: 'BACK' };

export const ACTION_LABELS: Record<CombatActionType, string> = {
  attack: 'Атака',
  defend: 'Защита',
  move: 'Сменить линию',
  useMedicine: 'Медикаменты',
};

export const WEAPON_SLOT_LABELS: Record<WeaponSlot, string> = {
  sidearm: 'пистолет',
  primary: 'основное',
  melee: 'ближний бой',
};

export const STATUS_LABELS: Record<CombatStatus, string> = {
  setup: 'расстановка',
  active: 'идёт бой',
  victory: 'ПОБЕДА',
  retreated: 'ОТСТУПЛЕНИЕ',
  defeat: 'ОТРЯД ПОГИБ',
};

export function enemyName(id: string): string {
  const number = id.replace('enemy-', '');
  return `Заражённый ${number}`;
}

const FAIL_REASONS = {
  noAmmunition: 'нет патронов',
  noWeapon: 'нет оружия',
  meleeFromBack: 'ближним оружием из BACK нельзя',
  noTarget: 'нет цели',
} as const;

export function describeCombatLog(entry: CombatLogEntry, nameOf: (id: string) => string): string {
  switch (entry.type) {
    case 'start':
      return `Бой начался. Заражённых: ${entry.enemies}.`;
    case 'attack': {
      const how = `${nameOf(entry.actorId)} → ${enemyName(entry.targetId)} (${itemName(entry.weaponDefId)}, шанс ${entry.chance} %)`;
      const result = entry.hit ? `попадание, урон ${entry.damage}` : 'промах';
      const ammo = entry.ammoSpent > 0 ? `, патронов −${entry.ammoSpent}` : '';
      const killed = entry.killed ? `. ${enemyName(entry.targetId)} убит` : '';
      return `${how}: ${result}${ammo}, шум +${entry.noise}${killed}.`;
    }
    case 'attackFailed':
      return `${nameOf(entry.actorId)} не может атаковать: ${FAIL_REASONS[entry.reason]}.`;
    case 'defend':
      return `${nameOf(entry.actorId)} в защите.`;
    case 'move':
      return `${nameOf(entry.actorId)} переходит в ${entry.to === 'front' ? 'FRONT' : 'BACK'}.`;
    case 'moveFailed':
      return `${nameOf(entry.actorId)} не может сменить линию: там уже 3 человека.`;
    case 'medicine':
      return `${nameOf(entry.actorId)} использует медикаменты на ${nameOf(entry.targetId)}: +${entry.healed} здоровья (медикаменты −1).`;
    case 'medicineFailed':
      return `${nameOf(entry.actorId)}: медикаментов не осталось.`;
    case 'enemyAttack': {
      const who = `${enemyName(entry.enemyId)} → ${nameOf(entry.targetId)} (шанс ${entry.chance} %)`;
      const noise = entry.noise > 0 ? `, шум +${entry.noise}` : '';
      if (!entry.hit) return `${who}: промах${noise}.`;
      const mods = [
        entry.armorPercent > 0 ? `броня −${entry.armorPercent} %` : '',
        entry.defended ? 'защита −50 %' : '',
      ].filter(Boolean);
      return `${who}: урон ${entry.damage}${mods.length ? ` (из ${entry.rawDamage}; ${mods.join(', ')})` : ''}${noise}.`;
    }
    case 'death':
      return `${nameOf(entry.characterId)} погиб. Его вещи (${entry.items.map((id) => id).length}) остались лежать на месте боя.`;
    case 'reinforcement':
      return `Шум ${entry.noise} привлёк ещё одного: ${enemyName(entry.enemyId)} (шанс был ${entry.chance} %).`;
    case 'retreat':
      return `Попытка отступить (шанс ${entry.chance} %): ${entry.success ? 'удалось' : 'не удалось, раунд потерян'}.`;
    case 'fallenItems':
      return `Вещи павших: забрали ${entry.recovered.length}, пришлось оставить ${entry.leftBehind.length}.`;
    case 'outcome':
      return `Итог боя: ${STATUS_LABELS[entry.status]}.`;
  }
}
