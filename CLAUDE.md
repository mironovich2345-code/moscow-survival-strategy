# CLAUDE.md — правила разработки

Turn-based survival strategy про Москву после биологической катастрофы.
Стек: React + TypeScript (strict) + Vite + Zustand + Vitest + CSS + localStorage. Без backend.

## Перед работой прочитать
- `docs/GAME_BIBLE.md` — мир и сеттинг (что решено, а что нет).
- `docs/GAME_RULES.md` — числовые правила.
- `docs/ARCHITECTURE.md` — слои и как расширять.

## Незыблемые правила игры
- Москва; кампания стартует на **10-й день** после катастрофы.
- **1 ход = 2 игровых часа.**
- Группа — максимум **12** человек, боевой отряд — максимум **5**.
- Ресурсы: `food`, `water`, `medicine`, `ammunition`, `fuel`, `materials`.
- База героя — ЖК «Статус», Лефортово.

## Архитектура (обязательно)
- Вся игровая логика — в `src/game`, чистые функции над plain-JSON `GameState`.
- `src/game` не импортирует React, Zustand, `window`, `localStorage` и `src/data`.
  Контент передаётся параметром (`GameContent`).
- `src/data` — только статический контент; зависит лишь от типов `src/game`.
- `src/ui` — только отображение и отправка `GameCommand` через store. Правил игры в UI нет.
- Все действия игрока — варианты `GameCommand` в `src/game/gameState/commands.ts`.
- Ошибки логики — коды (union-строки), тексты — в `src/ui/labels.ts`.
- Случайность — только через `src/game/random` и `GameState.rng`. `Math.random()` в логике запрещён.
- State иммутабелен: никогда не мутировать входной state.
- Меняешь форму `GameState` → увеличь `GAME_STATE_VERSION` и добавь миграцию/валидацию в `persistence.ts`.

## Стиль кода
- TypeScript strict, без `any` (используй `unknown` + type guards).
- Импорты через алиасы `@game/*`, `@data/*`, `@ui/*`.
- Не добавлять новые зависимости без явного согласования.
- Не придумывать новые крупные механики и лор самостоятельно — сначала спросить.
- UI: простой, тёмный, функциональный. Графика не в приоритете.

## Порядок работы над фичей
1. Логика в `src/game` → 2. тесты в `tests/` → 3. UI.
4. Обновить `docs/GAME_RULES.md` / `docs/ARCHITECTURE.md`, если поменялись правила или структура.

## Проверки перед коммитом
```bash
npm test          # vitest
npm run build     # tsc --noEmit + vite build
```
Оба должны проходить без ошибок.
