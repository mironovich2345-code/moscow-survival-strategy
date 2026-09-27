# Architecture

## Слои

```
src/data  ──(типы)──►  src/game  ◄──(команды/состояние)──  src/ui
 контент              чистая логика                         React + Zustand
```

| Слой | Что внутри | Может импортировать |
|---|---|---|
| `src/game` | Правила, типы, чистые функции | только `src/game` |
| `src/data` | Статический контент (персонажи, районы, локации, предметы) | типы из `src/game` |
| `src/ui` | React-компоненты, Zustand-store, тексты/локализация | `src/game`, `src/data` |

`src/game` **никогда** не импортирует React, Zustand, `window`, `localStorage`
или `src/data`. Контент передаётся в логику параметром (`GameContent`).

## Ключевые принципы

1. **GameState — plain JSON.** Никаких классов и функций; сериализуется как есть.
2. **Иммутабельность.** Каждая функция возвращает новый state, старый не меняется.
3. **Команды.** Любое действие игрока — `GameCommand`, применяемый через
   `applyCommand(state, command, content)`; результат — `{ ok, state }` или
   `{ ok: false, error }`. Ошибки — коды, а не строки.
4. **Детерминизм.** RNG-состояние внутри `GameState`; id выдаются счётчиком
   `nextId`.
5. **Журнал — данные.** `GameLogEntry` хранит структуру, текст формирует UI
   (`src/ui/labels.ts`).
6. **Хранилище абстрагировано.** `persistence.ts` работает с интерфейсом
   `StorageLike`; в браузере это `localStorage`, в тестах — `MemoryStorage`.
   Сейв версионирован (`GAME_STATE_VERSION`) и валидируется при загрузке.

## Модули `src/game`

| Модуль | Ответственность |
|---|---|
| `random/` | Детерминированный RNG (mulberry32), `nextFloat`, `nextInt` |
| `time/` | Абсолютные игровые часы, ход = 2 ч, форматирование |
| `resources/` | Тип `Resources`, дельты, проверки стоимости |
| `characters/` | Типы персонажа (слоты экипировки), ростер, лимит группы |
| `inventory/` | Уникальные предметы (`ItemInstance`), склад, `moveItem`, инвариант «один предмет — одно место», вес и грузоподъёмность |
| `world/` | Типы районов, локаций, таблиц добычи, `GameContent` |
| `expeditions/` | Отправка отряда с припасами, `cargo.ts` (supplies/haul: расход, находки с учётом вместимости), добыча с бонусом поиска, события в пути, возвращение |
| `combat/` | Бой (0.4): `CombatState`, формулы (`rules.ts`: попадание, броня, отступление, подкрепления), движок раунда, смерть и вещи павших |
| `events/` | Типы событий экспедиций (`EventDefinition`, `EventEffect`), выбор исхода, журнал (`GameLogEntry`) |
| `survival/` | Суточный расход еды и воды, голод/жажда |
| `gameState/` | `GameState`, новая игра, команды, сохранение/загрузка |
| `index.ts` | Публичный API слоя |

## Поток данных в UI

```
Компонент ──dispatch(command)──► useGameStore ──applyCommand──► новый GameState
                                     │                                  │
                                     └──── saveGame(localStorage) ◄─────┘
```

При запуске store вызывает `loadGame`: старые версии сейва мигрируются
(`migrateSave`, цепочка `MIGRATIONS`) и сразу перезаписываются в текущем
формате; если сейва нет или он не распознан — создаётся новая игра.

`EventDialog` показывается поверх любого экрана, пока у экспедиции есть
`pendingEventId`; команда `endTurn` в это время отклоняется логикой
(`EVENT_PENDING`), а не только UI.

Порядок обработки хода — `docs/GAME_RULES.md`, раздел «Порядок обработки хода».

## Инвентарь (0.3)

```
GameState.items    { [instanceId]: { id, defId } }   ← реестр всех уникальных предметов
GameState.storage  { items: instanceId[] }            ← лежат на складе
Expedition.haulItems instanceId[]                     ← найдены, несёт отряд (0.3.1)
Character.equipment{ sidearm|primary|melee|body|backpack: instanceId | null }
GameState.resources                                   ← расходники базы + fuel/materials
Expedition.supplies / Expedition.haul                 ← что отряд взял / что нашёл
```

- Определения предметов (название, слот, вес, `capacityBonus`) — контент
  (`GameContent.items`, `src/data/items`). В state — только экземпляры.
- Все перемещения предметов игроком — через `moveItem`; находки — через
  `takeFoundItems` (выдаёт стабильный ID `<defId>-<nextId>`, кладёт в
  `haulItems`); возвращение переносит `haulItems` в склад.
  `findItemLocationErrors` проверяет инвариант «одно место» по складу,
  экипировке и грузу экспедиций (в тестах и при загрузке сейва).
- Обыск локации — в середине похода (`searchAt`), см. GAME_RULES.
- Вес и вместимость — чистые функции (`resourceWeight`, `carryCapacity`,
  `squadLoad`, `fitIntoCapacity`), UI вызывает их же для превью.

## Бой (0.4)

```
GameState.combat: CombatState | null      ← один бой; сохраняется вместе с игрой
  positions        { characterId: 'front'|'back' }
  enemies          CombatEnemy[]            ← health заражённых
  selectedActions  { characterId: CombatAction }
  combatNoise, reinforcementCount, round, status, log (структурный)
Character.condition.health                  ← раны персонажей живут в персонаже
Expedition.lostItems / GameState.lostItems  ← вещи павших / потерянные в мире
```

- Команды: `startCombat` (событие или DEV), `setCombatPosition`,
  `setCombatAction`, `confirmCombatRound`, `retreatFromCombat`, `closeCombat`.
- Все броски — из `GameState.rng`, порядок фиксирован (действия игроков по
  списку группы → заражённые по порядку → подкрепление).
- Пока `combat !== null`, `endTurn` отклоняется (`COMBAT_ACTIVE`) — мир стоит.
- Формулы — чистые функции в `combat/rules.ts`; UI использует их же
  (шанс отступления, валидация действий через `validateCombatAction`).
- `CombatScreen` показывается вместо остальных экранов, пока идёт бой.
  DEV-кнопка старта боя — только в dev-сборке или с `?dev`.

## Как расширять

- **Новое действие игрока:** вариант в `GameCommand` + обработчик в
  `applyCommand` + тесты.
- **Новая локация:** запись в `src/data/locations`. Новый тип — расширить
  `LocationKind`.
- **Новое событие экспедиции:** запись в `src/data/events/events.ts`.
  Новый вид последствия — вариант `EventEffect` + обработка в
  `resolveExpeditionEvent` + тесты.
- **События вне экспедиций (база, район):** тот же `EventDefinition`,
  но нужен свой «владелец» паузы вместо `Expedition.pendingEventId`.
- **Новый предмет:** запись в `src/data/items/items.ts`; для выдачи в игре —
  экземпляр в реестре `items` с новым ID (`allocateId`).
- **Бой / фракции:** отдельные модули в `src/game/`, их state —
  новые поля `GameState` + увеличение `GAME_STATE_VERSION` + миграция в
  `persistence.ts`.
