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
| `characters/` | Типы персонажа, ростер, лимит группы |
| `world/` | Типы районов, локаций, таблиц добычи, `GameContent` |
| `expeditions/` | Отправка отряда, валидация, резолв возвращения |
| `events/` | Журнал событий (`GameLogEntry`) |
| `gameState/` | `GameState`, новая игра, команды, сохранение/загрузка |
| `index.ts` | Публичный API слоя |

## Поток данных в UI

```
Компонент ──dispatch(command)──► useGameStore ──applyCommand──► новый GameState
                                     │                                  │
                                     └──── saveGame(localStorage) ◄─────┘
```

При запуске store вызывает `loadGame`; если сейва нет или он повреждён —
создаётся новая игра со случайным seed.

## Как расширять

- **Новое действие игрока:** вариант в `GameCommand` + обработчик в
  `applyCommand` + тесты.
- **Новая локация:** запись в `src/data/locations`. Новый тип — расширить
  `LocationKind`.
- **Случайные события:** модуль в `src/game/events`, бросок через RNG из state,
  результат — новый вариант `GameLogEntry`.
- **Бой / инвентарь / фракции:** отдельные модули в `src/game/`, их state —
  новые поля `GameState` + увеличение `GAME_STATE_VERSION` + миграция в
  `persistence.ts`.
