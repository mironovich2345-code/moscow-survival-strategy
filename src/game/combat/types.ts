import type { CharacterId, ItemInstanceId } from '../characters';
import type { GameHour } from '../time';

export type CombatLine = 'front' | 'back';
export const COMBAT_LINES = ['front', 'back'] as const;
/** At most this many people per line. */
export const MAX_PER_LINE = 3;

/** Slots a character can attack with. */
export const WEAPON_SLOTS = ['sidearm', 'primary', 'melee'] as const;
export type WeaponSlot = (typeof WEAPON_SLOTS)[number];

export type CombatStatus = 'setup' | 'active' | 'victory' | 'retreated' | 'defeat';

export type EnemyTypeId = 'infected';

export interface EnemyType {
  readonly id: EnemyTypeId;
  readonly maxHealth: number;
  readonly attackDamage: number;
  readonly accuracyPercent: number;
  /** Noise added to the fight per attack. */
  readonly noise: number;
}

/** Temporary balance, see docs/GAME_RULES.md «Бой». */
export const ENEMY_TYPES: Readonly<Record<EnemyTypeId, EnemyType>> = {
  // 0.4.1: ordinary infected attacks make no combat noise.
  infected: { id: 'infected', maxHealth: 70, attackDamage: 18, accuracyPercent: 75, noise: 0 },
};

export interface CombatEnemy {
  readonly id: string;
  readonly typeId: EnemyTypeId;
  /** Display number: «Заражённый 3». */
  readonly number: number;
  readonly health: number;
  readonly maxHealth: number;
}

export type CombatAction =
  | { readonly type: 'attack'; readonly weaponSlot: WeaponSlot; readonly targetId: string }
  | { readonly type: 'defend' }
  | { readonly type: 'move' }
  | { readonly type: 'useMedicine'; readonly targetId: CharacterId };

export type CombatActionType = CombatAction['type'];

interface CombatLogBase {
  readonly round: number;
}

/** Structured combat log: data only, the UI phrases it. */
export type CombatLogEntry = CombatLogBase &
  (
    | { readonly type: 'start'; readonly enemies: number }
    | {
        readonly type: 'attack';
        readonly actorId: CharacterId;
        readonly weaponDefId: string;
        readonly targetId: string;
        readonly chance: number;
        readonly hit: boolean;
        readonly damage: number;
        readonly ammoSpent: number;
        readonly noise: number;
        readonly killed: boolean;
      }
    | {
        readonly type: 'attackFailed';
        readonly actorId: CharacterId;
        readonly reason: 'noAmmunition' | 'noWeapon' | 'meleeFromBack' | 'noTarget';
      }
    | { readonly type: 'defend'; readonly actorId: CharacterId }
    | { readonly type: 'move'; readonly actorId: CharacterId; readonly to: CombatLine }
    | { readonly type: 'moveFailed'; readonly actorId: CharacterId }
    | {
        readonly type: 'medicine';
        readonly actorId: CharacterId;
        readonly targetId: CharacterId;
        readonly healed: number;
      }
    | { readonly type: 'medicineFailed'; readonly actorId: CharacterId }
    | {
        readonly type: 'enemyAttack';
        readonly enemyId: string;
        readonly targetId: CharacterId;
        readonly chance: number;
        readonly hit: boolean;
        readonly damage: number;
        readonly rawDamage: number;
        readonly armorPercent: number;
        readonly defended: boolean;
        readonly noise: number;
      }
    | { readonly type: 'death'; readonly characterId: CharacterId; readonly items: readonly ItemInstanceId[] }
    | { readonly type: 'reinforcement'; readonly enemyId: string; readonly chance: number; readonly noise: number }
    | { readonly type: 'retreat'; readonly chance: number; readonly success: boolean }
    | {
        readonly type: 'fallenItems';
        readonly recovered: readonly ItemInstanceId[];
        readonly leftBehind: readonly ItemInstanceId[];
      }
    | { readonly type: 'outcome'; readonly status: CombatStatus }
  );

export interface CombatState {
  readonly id: string;
  readonly expeditionId: string;
  readonly locationId: string;
  readonly startedAt: GameHour;
  readonly round: number;
  readonly status: CombatStatus;
  /** Line of every living combatant. */
  readonly positions: Readonly<Record<CharacterId, CombatLine>>;
  readonly enemies: readonly CombatEnemy[];
  /** Actions chosen for the current round (not yet resolved). */
  readonly selectedActions: Readonly<Partial<Record<CharacterId, CombatAction>>>;
  /** Characters defending until the next round starts. */
  readonly defending: readonly CharacterId[];
  readonly combatNoise: number;
  readonly reinforcementCount: number;
  readonly nextEnemyNumber: number;
  /** Characters who died in this fight. */
  readonly fallen: readonly CharacterId[];
  readonly log: readonly CombatLogEntry[];
}

export type CombatError =
  | 'NO_COMBAT'
  | 'COMBAT_ACTIVE'
  | 'COMBAT_OVER'
  | 'COMBAT_NOT_OVER'
  | 'NOT_A_COMBATANT'
  | 'NOT_IN_SETUP'
  | 'LINE_FULL'
  | 'NO_WEAPON'
  | 'MELEE_FROM_BACK'
  | 'NO_AMMUNITION'
  | 'UNKNOWN_TARGET'
  | 'NO_MEDICINE'
  | 'INVALID_ENEMY_COUNT'
  | 'EXPEDITION_BUSY'
  /** Some living character has no action selected for this round. */
  | 'MISSING_ACTIONS';
