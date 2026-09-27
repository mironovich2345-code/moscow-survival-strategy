import type { FactionDefinition } from '@game/factions';

/**
 * Arena (GAME_BIBLE §11). Only what is canon and visible to the player at this
 * stage; its hidden ties are NOT part of the content yet. Numbers are temporary.
 */
export const ARENA: FactionDefinition = {
  id: 'arena',
  name: 'Арена',
  unknownName: 'Неизвестная вооружённая группа',
  description:
    'Охранники, вышибалы, уличные бойцы, бывшие спортсмены, мародёры и криминальные элементы. ' +
    'Держат территорию силой и угрозами.',
  homeDistrictId: 'sokolinaya_gora',
  initialManpower: 35,
  initialSupplies: 50,
  operationWeights: { patrol: 40, scavenge: 35, intimidate: 25 },
};

export const FACTIONS: Readonly<Record<string, FactionDefinition>> = { arena: ARENA };
