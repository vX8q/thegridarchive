# Series Rendering Templates

Справочник по структуре event-страниц для каждого типа серии.
Используется при создании/проверке JSON-файлов событий.

## Содержание

- [Чеклист](#правила-заполнения-event-json-чеклист) — общие правила заполнения
- [§1](#1-nascar-cup--noaps-xfinity--trucks--modified--arca) — NASCAR Cup / NOAPS / Truck / Modified / ARCA (`stock_car_racing`)
- [§2](#2-formula-1) — Formula 1 (`openwheel`)
- [§3](#3-f2--f3) — F2 / F3 (`openwheel`)
- [§4](#4-indycar) — IndyCar (`openwheel`)
- [§5](#5-imsa) — IMSA (`gt_endurance`)
- [§6](#6-supercars) — Supercars (`touring`)
- [§7](#7-super-formula) — Super Formula (`openwheel`)
- [§8](#8-super-gt) — Super GT (`touring`)
- [§9](#9-wec--elms--gt-world-challenge-europe-endurance) — WEC / ELMS / GTWCE Endurance (`gt_endurance`)
- [§10](#10-dtm) — DTM (`touring`)
- [§11](#11-frec--f4-italian--porsche-supercup--gtwce-sprint) — FREC / F4 Italian / PSC / GTWCE Sprint
- [События вне championship](#события-вне-championship) — exhibition, pre-season
- [Автоматическая сборка standings](#автоматическая-сборка-standings) и [Stats API](#stats-api)
- [`data/teams/*.json`](#datateamsjson) — роли файлов команд
- [Служебные файлы и скрипты](#служебные-файлы-и-скрипты)
- [Рекорды круга в `event_preview`](#рекорды-круга-в-event_preview) — правила + проверенные источники
- [Сводная таблица](#сводная-таблица-различий) различий

**Связанные документы:** [`docs/WEB_TGA_API.md`](../docs/WEB_TGA_API.md) — публичные `/api/*` эндпоинты и фронтенд (`window.TGA.API`).

**Связанные правила Cursor** (подмешиваются при редактировании matching files):

| Файл | Glob / scope |
|------|----------------|
| `event-json-fill.mdc` | **always** — workflow перед любым event JSON |
| `event-json-format.mdc` | `data/events/**/*.json` |
| `stockcar-event-json.mdc` | NASCAR Cup, NOAPS, Truck, Modified, ARCA |
| `stockcar-qualifying-separators.mdc` | **always** — stock-car team/separator/distance |
| `f1-event-json.mdc` | `data/events/F1/**` |
| `f2-f3-event-json.mdc` | `data/events/F2/**`, `F3/**` |
| `indycar-event-json.mdc` | `data/events/IndyCar/**` |
| `imsa-event-json.mdc` | `data/events/IMSA/**` |
| `wec-event-json.mdc` | `data/events/WEC/**` |
| `elms-event-json.mdc` | `data/events/ELMS/**` |
| `gtwce-end-event-json.mdc` | `GT World Challenge Europe Endurance/**` |
| `gtwce-sprint-event-json.mdc` | `GT World Challenge Europe Sprint/**` |
| `gtwce-sprint-entry-list.mdc` | `GT World Challenge Europe Sprint/**` |
| `supercars-event-files.mdc` | `data/events/Supercars/**` |
| `super-formula-event-json.mdc` | `data/events/Super Formula/**` |
| `super-gt-event-json.mdc` | `data/events/Super GT/**` |
| `dtm-event-json.mdc` | `data/events/DTM/**` |
| `frec-2026-scoring.mdc` | `data/events/FREC/**` |
| `italian-f4-2026-scoring.mdc` | `data/events/Italian F4/**` |
| `psc-event-json.mdc` | `data/events/Porsche Supercup/**` |
| `imsa-race-results-reference.mdc` | web/CSS only — not event data |

---

## Правила заполнения event JSON (чеклист)

Использовать при каждом запросе «заполни этап / практику / квалификацию / гонку».

### Порядок работы

1. **Найти файл** — `data/events/<Series>/<season>/<slug>.json` (напр. `F2/2026/f2_2026_6.json`). Сверить `event_id` с `data/schedules/<series>.json`. При **новом раунде** — добавить строку в schedule и (для stock-car / IndyCar) код колонки в `data/standings/<series>.json` → `race_order` / `event_names`.
2. **Сначала метаданные** — `event_preview` (+ `event_preview_ru`), YouTube (`youtube_id` и/или `youtube_highlights`), `entry_list`, даты `start_date` / `end_date`.
3. **Сессии по порядку** — practice → qualifying → race (sprint → feature для F2/F3).
4. **Эталон** — скопировать структуру headers / meta / ключей таблиц с **последнего полностью заполненного этапа** той же серии в том же сезоне.
5. **Не ломать схему** — не добавлять ключи `tables.sprint` / `tables.feature`, если серия использует `tables.race.sessions[]` (F2, F3, Super Formula, F1 2026).
6. **Очки** — колонка `Pts` в таблице гонки должна совпадать с официальным протоколом, включая бонусы (см. раздел серии).

### Общие правила (все серии)

| Поле | Правило |
|------|---------|
| `event_preview` | Только plain text, **без Markdown** (`**`, `#`, списков). Абзацы через `\n\n`. Рекорды круга серии на трассе — финальный абзац EN+RU; правила и источники: [Рекорды круга в `event_preview`](#рекорды-круга-в-event_preview). |
| `event_preview_ru` | Добавлять, если есть английский preview. |
| `laps` | Только число кругов (напр. `"200"`), не текст «200 laps». |
| `distance` | Только физическая дистанция гонки — **не** дублировать lap count. Формат зависит от серии: сток-кары `"X mi (Y km)"` (§1); IndyCar `"X.XXX miles (Y.YYY km)"` (§4). Не писать длину овала (`0.333 mile paved track …`). |
| `youtube_id` / `youtube_highlights` | Сток-кары и многие 2026-файлы: достаточно строки `"youtube_id": "…"`. Массив `youtube_highlights: [{ "id", "title" }]` тоже поддерживается (F1 и др.). |
| `entry_list` | Официальные полные имена **без латинской диакритики** (`Rafael Camara`, `Noel Leon`, `Niccolo Maccagnani`); то же для `event_preview` / мест (`Sao Paulo`, `Autodromo Jose Carlos Pace`). Кириллица в `event_preview_ru` сохраняется. `driver_slug` — ASCII-канон (`rafael-camara`). Nickname-дубли (Matt→Matthew, Cam→Cameron, …) — через `data/driver_slug_aliases.json`; после правок: `node scripts/fix-driver-slug-aliases.mjs` (или `--check` в CI). Массовая зачистка: `node scripts/strip-latin-diacritics.mjs`. Канон: всегда **Leland Honeyman** (без Jr.); slug `leland-honeyman` (алиас `leland-honeyman-jr`). |
| `driver_profiles` / `citizenship` | Страна **гоночной лицензии ≠ гражданство**. В `citizenship` только реальное гражданство/национальность; dual — только при подтверждённом гражданстве, не по FIA licence. |
| `track` / `circuit_name` vs `location` | `track` / `circuit_name` — название трассы (при необходимости суффикс лейаута, напр. `Charlotte Motor Speedway Roval`); `location` — только география (`City, State` / `City, Region`). Не дублировать город в имени трассы. Хелперы UI: `web/lib/schedule-location.js`. |
| Full Schedule (серия) | Унифицированная схема **A** в `web/pages/series.js`: всегда **Circuit** + **Location** (не класть `circuit_name` в колонку Location). Колонка **Race** — только multi-race уик-энды (сессия: Sprint / Race 1 / GP). Single-race: `Round · Event · Circuit · Location · Date · Time`. |
| Таблицы | У P1 в Gap и Int — `"—"`. DNF: `"Pos"` = `"DNF"`, `"Gap"` = `"DNF"`, `"Int"` = `"—"`. |
| Колонки из протокола | Не переносить служебные колонки, которые сайт не рендерит (напр. **LAP SET ON** у F2). |
| Формат JSON | **Новые** файлы — компактно (`event-json-format.mdc`). **Существующие** — не переформатировать целиком без запроса. |
| Standings | Очки и позиции **не править** в `data/standings/*.json` — API пересобирает таблицу из `data/events/` при каждом запросе. Исключение: для stock-car и IndyCar в standings-файле поддерживать только `race_order` / `event_names` (коды колонок раундов). |
| Event summary API | `GET /api/events/summaries` и `/api/events/{id}/summary` читают **те же** `tables.*`, что и страница этапа. Не изобретать отдельные layout’ы под Last Results — заполнять эталонные ключи серии. |

**Full Schedule — колонки (схема A)**

| Режим | Колонки | Серии |
|-------|---------|--------|
| Multi-race | Round · **Race** · Event · Circuit · Location · Date · Time | F2, F3, FREC, F4_IT, DTM, GTWCE Sprint, Supercars, F1 2025/2026 |
| Multi-race SF | **Race** · Event · Circuit · Location · Date · Time | Super Formula |
| Single-race | Round · Event · Circuit · Location · Date · Time | PSC, ELMS, WEC, GTWCE End, Super GT, stock-car, IndyCar |
| IMSA | Round · Event · Length · Classes · Circuit · Location · Date | IMSA |
| Historical F1 | Round · Grand Prix · Circuit · Location · Date | `/season/f1-20xx` кроме 2025/2026 |

### Имена в таблицах vs entry_list

| Место | Формат |
|-------|--------|
| `entry_list.driver` | Полное имя без диакритики: `Gabriele Mini`, `Nicolas Varrone` |
| Practice / Qualifying / Race rows (single-driver series) | По умолчанию то же полное имя, что в `entry_list`: `Gabriele Mini`, `Nikola Tsolov`, `Emerson Fittipaldi Jr.`. Не сокращать вручную до `N. Surname`. |
| `Drivers` / crew columns (multi-driver series) | Полные имена всех пилотов; разделитель зависит от серии (`/` или `; `, см. ниже по разделам). |
| Team в таблицах F2 | Как в протоколе FIA: `Hitech TGR`, `Trident`, `Prema Racing`, `DAMS Lucas Oil` (не ALL CAPS `TRIDENT` / `PREMA`) |

Если в существующем файле уже есть сокращения вида `N. Surname`, при ручной правке разворачивать их в полную форму **из `entry_list` этого же event JSON**. Исключения допустимы только там, где официальный источник сам последовательно использует формат с несколькими инициалами/частями имени (`A. J. Allmendinger`, `J. J. Yeley`) и вы сознательно сохраняете именно эту официальную форму по всей серии.

### Даты на карточках (Next Race / Last Results / расписание)

Правила отображения календарных дат на главной и в расписании. Канонический объект в коде: `web/lib/event-card-date.js` → `SERIES_CARD_DATE_RULES`. Пересборка multi-race сессий: `node scripts/build-multi-race-schedule-sessions.mjs` (из `tables.race.sessions` + `data/schedules`).

| Серия | Дата на карточке | Сессии / merge | Примечание |
|-------|------------------|----------------|------------|
| **F2, F3, FREC, F4_IT** | Last Results: диапазон уик-энда (`Jul 4–5`). **Next Race: один день** ближайшей сессии | Sprint + Feature (или Race 1–3 у FREC) из event JSON / multi-race map | Развёрнутая строка Full Schedule — **один** день сессии |
| **DTM, GTWCE Sprint** | Диапазон уик-энда | Race 1 / Race 2 по `start_date`–`end_date` | |
| **F1** | Диапазон в sprint-уикенды | Sprint (сб) + GP (вс) — `static-schedules.js` `f1Sprint20xx` | Обычный уикенд — один день (воскресенье) |
| **Super Formula** | Диапазон уик-энда | Несколько гонок; **merge** карточек на главной | Исключение: `SUPER_FORMULA_2026_6` (Fuji triple-header) — вручную в build-скрипте |
| **Supercars** | Last Results: диапазон уик-энда, **merge** после **последней** гонки уик-энда | **Next Race: отдельная карточка на каждую гонку** (`Race 1`, `Race 2`, …) | В названии карточки — номер гонки из schedule; gate не показывает карточку после Race 1, пока не завершён финал уик-энда |
| **IMSA, WEC, ELMS, GTWCE End** | **Один день** — день гонки | В JSON уикенд может быть `start_date`–`end_date` | Не путать с диапазоном расписания |
| **PSC** | Обычный этап: **один день** гонки (`race_day_only`) | Double-header (отдельные `event_id`, напр. Zandvoort `_6`+`_7`): Last Results **merge** → диапазон дней гонок | Multi-day `start_date`–`end_date` у support-уикенда (Hungaroring 24–26) **не** значит интервал на карточке |
| **IndyCar** | Обычно **один день** | Double-header (отдельные файлы, напр. Milwaukee): Last Results **merge** | `LAST_RESULTS_WEEKEND_MERGE_SERIES` в `web/lib/weekend-card-merge.js` |
| **24h гонки** (Spa, Le Mans, …) | Два календарных дня | Из названия (`24 Hours`, `24h`) | Исключение из «один день» endurance |
| **Остальные** (Cup, Truck, …) | Один день | — | По `getEventRaceStartDateIso` |

**Multi-race map** (`web/data/multi-race-schedule-sessions.js`): даты и метки — из `tables.race.sessions[]` в event JSON (`meta.Date`, `meta.Session`, `title`); время — `meta.Start` / `meta.time_msk` при наличии, иначе из `data/schedules/<series>.json`. Ручная правка только для исключений (см. `CURATED_OVERRIDES` в build-скрипте).

### Идентификаторы: API slug → папки и файлы

Championship ID в URL/API (`/api/series/f2-2026`, `/event/f2-2026-7`) нормализуется в **data series id** (`config.DataSeriesID`). Исключение: `nascar_xfinity` → `noaps`.

| Data series ID | Папка `data/events/` | `data/schedules/` | Пример `event_id` |
|----------------|----------------------|-------------------|-------------------|
| `f1` | `F1` | `f1.json` | `F1_2026_3` |
| `f2`, `f3`, `frec` | `F2`, `F3`, `FREC` | `f2.json`, … | `F2_2026_7` |
| `f4_it` | `Italian F4` | `f4_it.json` | `F4_IT_2026_3` |
| `nascar_cup`, `noaps`, `nascar_truck`, `nascar_modified`, `arca` | `NASCAR Cup Series`, `NOAPS`, … | `nascar_cup.json`, `noaps.json`, … | `NASCAR_CUP_2026_7` |
| `indycar` | `IndyCar` | `indycar.json` | `INDYCAR_2026_5` |
| `imsa`, `wec`, `elms` | `IMSA`, `WEC`, `ELMS` | `imsa.json`, … | `IMSA_2026_5` |
| `gtwce_end`, `gtwce_sprint` | `GT World Challenge Europe Endurance`, `GT World Challenge Europe Sprint` | `gtwce_end.json`, `gtwce_sprint.json` | `GTWCE_SPRINT_2026_1` |
| `dtm`, `super_gt`, `supercars`, `super_formula`, `psc` | `DTM`, `Super GT`, `Supercars`, `Super Formula`, `Porsche Supercup` | одноимённые `.json` | `DTM_2026_4` |

Полная карта slug → folder: `internal/schedulefile/io.go` → `eventSeriesFolderNames`.

---

## Общая структура (все серии)

```
Страница события
├── Header: h1 — название гонки
├── Overview
│   ├── Laps / Distance (скрыт у IMSA, WEC, ELMS, GTWCE End, Supercars)
│   ├── Block navigation tiles (навигация по секциям)
│   ├── Track info (h4)
│   ├── Tyre compounds (только F1)
│   ├── Highlights / YouTube (h4)
│   └── Race Statistics (h4): Field | Value
├── Entry List
├── Practice
├── Qualifying
└── Race
```

### Иерархия заголовков

| Уровень | Назначение | CSS-класс |
|---------|-----------|-----------|
| h1 | Название события (заголовок страницы) | `.event-header h1` |
| h2 | Название секции (Entry List, Practice, Qualifying, Race) | `.event-data-section h2` |
| h3 | Заголовок сессии внутри секции (Sprint Results, Race Results, Qualifying) | `.event-pre-season-title` |
| h4 | Заголовок таблицы (Stage 1, Starting Grid, Laps Led, Penalties...) | `.table-section-title` |

---

## 1. NASCAR Cup / NOAPS (Xfinity) / Trucks / Modified / ARCA

**Категория:** `stock_car_racing`  
**Series IDs:** `nascar_cup`, `noaps`, `nascar_truck`, `nascar_modified`, `arca`

### Laps / Distance

| Поле | Правило |
|------|---------|
| `laps` | Только число кругов (`"150"`, `"200"`). |
| `distance` | Только физическая дистанция гонки: **`"X mi (Y km)"`**. |

Примеры (актуальный формат):

```json
"laps": "150",
"distance": "49.950 mi (80.387 km)"
```

```json
"laps": "200",
"distance": "137.2 mi (220.802 km)"
```

**Не использовать** (устаревший / неправильный формат — часто встречался у Modified и ранних файлов):

```json
// ❌ BAD — длина овала + «paved track», без km
"distance": "0.333 mile paved track (49.950 miles)"

// ❌ BAD — дублирует lap count
"distance": "150 laps, 49.950 mi (80.387 km)"
```

Длина овала (0.333 / 0.625 mi и т.п.) относится к описанию трассы в `event_preview`, не в поле `distance`. То же правило для **Cup / NOAPS / Truck / Modified / ARCA**.

### YouTube

Для сток-каров в 2026 обычно достаточно верхнеуровневого поля:

```json
"youtube_id": "ZuE8gdqZOVY"
```

Массив `youtube_highlights` допустим, если нужны несколько роликов / заголовки; UI читает оба варианта.

### Entry List

| # | Driver | Team | Manufacturer | Crew Chief |
|---|--------|------|-------------|------------|

- Без rowspan-объединения
- Сортировка: по номеру
- **`points_eligible: false`** — пилот вне зачёта очков (в протоколе с `(i)`); в standings попадает в `ineligible[]`, очки стейджей не начисляются
- **`Team`** (entry_list и колонка Team в practice / qualifying / race / stage) — официальное имя организации (`JR Motorsports`, `Joe Gibbs Racing`), **без** partnership-хвоста ` with …` и **без** primary sponsor / paint-scheme как имени команды. После массовых правок: `node scripts/sync-stockcar-table-teams.mjs`

### Practice (1, 2, 3, Final Practice)

Колонки приходят из данных, типичный набор:

| Pos | No. | Driver | Team | Time | Gap | Speed | Laps |
|-----|------|--------|------|------|-----|-------|------|

### Qualifying

Основная таблица квалификации + **separator rows** внутри `tables.qualifying.rows` (не отдельные подтаблицы):
- `"Qualified by owner's points"` — строка-разделитель перед блоком пилотов
- `"Failed to qualify"` — строка-разделитель перед DNQ-блоком

Дополнительные таблицы (если есть):
- **Duel 1** (h4) — Daytona
- **Duel 2** (h4) — Daytona
- **Last Chance** (h4)
- **Did Not Qualify** (h4)

### Race

```
Race
├── h4 "Race Results" (основной заголовок, bold)
├── h4 "Stage 1 (N laps)" — таблица stage_1
├── h4 "Stage 2 (N laps)" — таблица stage_2
├── h4 "Stage 3 (N laps)" или "Race Results (N laps)"
├── Race Results table (колонки из данных, auto-ширины)
├── h4 "Penalties" (если есть)
├── h4 "Penalties added after the chequered flag" (если есть)
├── h4 "Race neutralisation" (если есть)
└── h4 "Caution Breakdown" (цветные строки: жёлтые/зелёные)
```

**Stage-таблицы** — CSS-класс `race-stage-table race-stage-table--points`:

| Pos | No. | Driver | Team | Manufacturer | Pts |
|-----|------|--------|------|-------------|-----|

**Ключи таблиц stage:** `stage_1`, `stage_2` (не `stage1`/`stage2`).

**Caution Breakdown** — есть колонка "Free Pass" (показывается для NASCAR, скрыта для IndyCar).

**race_statistics** — key-value объект на верхнем уровне JSON (не внутри `tables`).

**starting_lineup** — **не используется** (удалён из всех файлов).

### JSON-шаблон события (NASCAR Cup)

```json
{
  "event_id": "NASCAR_CUP_2026_7",
  "series": "NASCAR Cup Series",
  "race": "Cook Out 400",
  "date": "Sunday, March 29, 2026",
  "start_date": "2026-03-29",
  "end_date": "2026-03-29",
  "track": "Martinsville Speedway",
  "location": "Ridgeway, Virginia",
  "laps": "400",
  "distance": "210.4 mi (338.6 km)",
  "stage1_laps": "80",
  "stage2_laps": "160",
  "stage3_laps": "160",
  "event_preview": "...",
  "event_preview_ru": "...",
  "youtube_id": "...",
  "race_statistics": {
    "Lead changes": "...",
    "Cautions / Laps": "...",
    "Red flags": "...",
    "Time of race": "...",
    "Average speed": "..."
  },
  "entry_list": [
    {"number": "1", "driver": "...", "team": "...", "manufacturer": "...", "crew_chief": "..."}
  ],
  "tables": {
    "practice": {"headers": [...], "rows": [...]},
    "qualifying": {"headers": [...], "rows": [...]},
    "stage_1": {"headers": [...], "rows": [...]},
    "stage_2": {"headers": [...], "rows": [...]},
    "race_results": {"headers": [...], "rows": [...]},
    "caution_breakdown": {"headers": [...], "rows": [...]}
  }
}
```

---

## 2. Formula 1

**Категория:** `openwheel`
**Series ID:** `f1`

### Entry List

| # | Driver | Constructor | Chassis |
|---|--------|-------------|---------|

- Rowspan на Constructor + Chassis (гонщики одной команды объединяются)
- `manufacturer` в `entry_list` — код шасси (напр. `MCL39`, `RB21`)
- `entry_list` содержит поля: `number`, `driver`, `team`, `constructor`, `manufacturer`

### Practice (1, 2, 3)

`sessions[]` — массив сессий внутри `practice`:
```json
"practice": {
  "sessions": [
    {"title": "Practice 1", "headers": [...], "rows": [...]},
    {"title": "Practice 2", "headers": [...], "rows": [...]},
    {"title": "Practice 3", "headers": [...], "rows": [...]}
  ]
}
```

### Qualifying

`sessions[]` — массив сессий; опционально `note` для штрафов на старте:
```json
"qualifying": {
  "note": "Optional grid-penalty note shown under the table",
  "sessions": [
    {"title": "Qualifying", "headers": [...], "rows": [...]}
  ]
}
```

Мульти-сессионный формат:
```
Qualifying
├── h3 "Sprint Qualifying" (если есть)
│   ├── h4 "Session info" — мета-таблица (Date, Session, Length...)
│   └── Таблица результатов (БЕЗ доп. h4 "Results")
└── h3 "Qualifying"
    ├── h4 "Session info"
    └── Таблица результатов
```

### Race

Мульти-сессионный формат:
```
Race
├── h3 "Sprint Results" (если спринт-уикенд)
│   ├── h4 "Session info"
│   ├── Таблица результатов (10 колонок: … Laps Led, Best Lap, Points)
│   └── Penalties / VSC
├── h3 "Race Results"
│   ├── h4 "Session info"
│   ├── Таблица результатов (10 колонок, фиксированные ширины)
│   ├── h4 "Pit Stops" — визуальный стинт-чарт с цветами шин
│   ├── h4 "Penalties during the race"
│   ├── h4 "Penalties added after the chequered flag"
│   └── h4 "Race neutralisation / VSC"
```

**Race Results — 10 колонок с фиксированными ширинами:**

| Pos | No. | Driver | Team | Laps | Time | Grid | Laps Led | Best Lap | Pts |
|-----|------|--------|------|------|------|------|----------|----------|-----|
| 6%  | 6%   | 4%     | 18%  | 24%  | 10%  | 6%   | 6%       | 12%      | 6%  |

- **Pit Stops** — стинт-чарт: H=white, M=yellow, S=red, I=green, W=blue
- **starting_lineup** — не используется
- **Laps Led / Best Lap** — только колонки в таблице результатов (`race_results` для GP; `tables.race.sessions[]` для спринта). **Не создавать** отдельные ключи `laps_led`, `best_laps`, `laps_led_sprint`, `best_laps_sprint` — сайт их не рендерит; breakdown по отрезкам лидирования тоже не хранится в JSON.
- **race_statistics** — не используется для F1
- Формат названия гонки: `"YYYY Grand Prix Name"` (напр. `"2026 Japanese Grand Prix"`)

### JSON-шаблон события (F1)

```json
{
  "event_id": "F1_2026_3",
  "series": "FIA Formula 1 World Championship",
  "race": "2026 Japanese Grand Prix",
  "date": "29 March 2026",
  "start_date": "2026-03-27",
  "end_date": "2026-03-29",
  "track": "Suzuka Circuit",
  "location": "Suzuka",
  "laps": "53",
  "distance": "307.471 km",
  "event_preview": "...",
  "event_preview_ru": "...",
  "tyre_compounds": "Hard: C2, Medium: C3, Soft: C4",
  "youtube_id": "...",
  "youtube_highlights": [
    {"id": "...", "title": "Race highlights"}
  ],
  "entry_list": [
    {"number": "1", "driver": "...", "constructor": "Red Bull Racing", "manufacturer": "Red Bull Racing-Honda RBPT", "team": "Red Bull"}
  ],
  "tables": {
    "practice": {
      "sessions": [
        {"title": "Practice 1", "headers": [...], "rows": [...]},
        {"title": "Practice 2", "headers": [...], "rows": [...]},
        {"title": "Practice 3", "headers": [...], "rows": [...]}
      ]
    },
    "qualifying": {
      "sessions": [
        {"title": "Sprint qualifying classification", "headers": [...], "rows": [...]},
        {"title": "Qualifying classification", "headers": [...], "rows": [...]}
      ]
    },
    "race": {
      "sessions": [
        {"title": "Sprint classification", "headers": [...], "rows": [...]}
      ]
    },
    "race_results": {"headers": [...], "rows": [...]},
    "pit_stops": {"headers": [...], "rows": [...]},
    "penalties": {"headers": [...], "rows": [...]},
    "penalties_after": {"headers": [...], "rows": [...]},
    "penalties_sprint": {"headers": [...], "rows": [...]},
    "penalties_sprint_after": {"headers": [...], "rows": [...]},
    "vsc": {"headers": [...], "rows": [...]}
  }
}
```

Спринт-уикенд: спринт в `tables.race.sessions[]`, GP — в `tables.race_results`; штрафы спринта — `penalties_sprint` / `penalties_sprint_after`. Обычный уикенд — только `race_results` (без `tables.race.sessions` для спринта) и без sprint-penalty ключей.

---

## 3. F2 / F3

**Категория:** `openwheel`

Общая схема JSON **одинакова**; отличаются состав, `series` / `event_id`, число кругов и meta-даты. Подробности Cursor: `f2-f3-event-json.mdc`.

| | **F2** | **F3** |
|---|--------|--------|
| Series ID | `f2` | `f3` |
| Путь | `data/events/F2/<year>/f2_<year>_<round>.json` | `data/events/F3/<year>/f3_<year>_<round>.json` |
| Эталон 2026 | `f2_2026_7.json` | `f3_2026_5.json` |
| Поле `series` | `FIA Formula 2 Championship` | `FIA Formula 3 Championship` |
| Сетка | 22 машины (11 команд × 2) | 30 машин (10 команд × 3) |
| Reverse grid Sprint | Top **12** квалификации → обратный порядок на старт Sprint | то же |

### Формат уик-энда

| День | Сессия | Ключ JSON |
|------|--------|-----------|
| Пятница | Free Practice | `tables.practice` |
| Пятница | Qualifying (решётка Feature + reverse grid Sprint) | `tables.qualifying` |
| Суббота | Sprint Race | `tables.race.sessions[0]` — title `"Sprint Race Results"` |
| Воскресенье | Feature Race | `tables.race.sessions[1]` — title `"Feature Race Results"` |

**❌ Не использовать** отдельные ключи `tables.sprint` / `tables.feature` — сайт читает только `tables.race.sessions[]`.

### Entry List

| # | Team | Driver |
|---|------|--------|

- Rowspan на Team (F2: 2 гонщика на команду; F3: 3 гонщика на команду)
- **Порядок колонок**: Team ПЕРЕД Driver (отличие от остальных серий)
- Поля: `number`, `driver`, `team`, `driver_slug`
- Сетка: **22** (F2) / **30** (F3) машин; при обновлении этапа сверять с официальной entry list раунда

### Practice

Flat-таблица (не `sessions[]`):

```json
"practice": {
  "title": "2026 FIA Formula 2 Championship - Practice",
  "subtitle": "Spielberg",
  "meta": {
    "Championship": "2026 FIA Formula 2 Championship",
    "Session": "Practice",
    "Date": "Fri 26 Jun 2026",
    "Start": "11:05 AM",
    "Length": "45 mins"
  },
  "headers": ["Pos", "No.", "Driver", "Team", "Laps", "Time", "Gap", "Int", "KPH"],
  "rows": [["1", "10", "O. Goethe", "MP Motorsport", "20", "1:16.978", "—", "—", "202.312"], ...]
}
```

- `subtitle` — короткое имя трассы / города (как в schedule)
- `Date` — `Fri 12 Jun 2026` (день недели + число + месяц + год)

### Qualifying

Тот же каркас, что practice; **добавлена колонка `Laps`**:

```json
"headers": ["Pos", "No.", "Driver", "Team", "Laps", "Time", "Gap", "Int", "KPH"]
```

- `Length`: `"30 mins"`
- P1 квалификации = поул **Feature** (+2 очка в Feature, не в колонке квалификации)
- **Sprint grid:** reverse top 12 из квалификации (P12 квалификации → P1 Sprint); в JSON квалификации хранится только итоговая таблица квалификации, не отдельная решётка Sprint

### Race — `tables.race.sessions[]`

Две сессии в одном массиве:

```json
"race": {
  "sessions": [
    {
      "title": "Sprint Race Results",
      "subtitle": "Spielberg",
      "meta": {
        "Championship": "2026 FIA Formula 2 Championship",
        "Session": "Sprint Race",
        "Date": "Sat 27 Jun 2026"
      },
      "headers": ["Pos", "ST", "No.", "Driver", "Team", "Laps", "Time", "Gap", "Int", "KPH", "Best", "Lap", "Pts"],
      "rows": [...]
    },
    {
      "title": "Feature Race Results",
      "subtitle": "Spielberg",
      "meta": {
        "Championship": "2026 FIA Formula 2 Championship",
        "Session": "Feature Race",
        "Date": "Sun 28 Jun 2026"
      },
      "headers": ["Pos", "ST", "No.", "Driver", "Team", "Laps", "Time", "Gap", "Int", "KPH", "Best", "Lap", "Pts"],
      "rows": [...]
    }
  ]
}
```

Колонки **Best** и **Lap** — две отдельные колонки (лучший круг и номер круга).

**`ST`** — стартовая позиция с официального FIA **final starting grid** / **final grid** PDF для этой гонки (не provisional). Не выводить ST из qualifying / reverse-grid вручную: пенальти есть только в final grid. Сопоставление строк — по номеру машины; DNF/NC тоже получают `ST` с решётки. Если машина **Withdrawn** / отсутствует на решётке — `ST` = `"—"`. Отдельный `starting_lineup` не использовать (как Italian F4).

#### DNF / NC

| Ситуация | Pos | Laps / Time | Gap | Int | KPH / Best / Lap |
|----------|-----|-------------|-----|-----|------------------|
| Сход с частичными данными | `DNF` | из протокола | `DNF` | `—` | из протокола |
| Сход без данных | `DNF` | `—` | `DNF` | `—` | `—` |

### Очки в колонке `Pts` (F2 и F3 — одна шкала, обязательно сверять)

**Sprint Race** — только за финиш:

| Pos | Очки |
|-----|------|
| 1 | 10 |
| 2 | 8 |
| 3 | 6 |
| 4 | 5 |
| 5 | 4 |
| 6 | 3 |
| 7 | 2 |
| 8 | 1 |
| 9+ | 0 |

**+1** за fastest lap (любому классифицированному пилоту; напр. P9 с FL → `Pts` = `1`).

**Feature Race** — за финиш:

| Pos | Очки |
|-----|------|
| 1 | 25 |
| 2 | 18 |
| 3 | 15 |
| 4 | 12 |
| 5 | 10 |
| 6 | 8 |
| 7 | 6 |
| 8 | 4 |
| 9 | 2 |
| 10 | 1 |
| 11+ | 0 |

**Бонусы Feature** (суммируются с финишными):

| Бонус | Очки | Кому |
|-------|------|------|
| Pole position | +2 | победитель квалификации (Feature grid P1) |
| Fastest lap | +1 | автор лучшего круга в Feature |

Примеры: поул Leon + P7 в Feature → `6 + 2 = 8` в `Pts`. P3 Goethe + FL → `15 + 1 = 16`.

### YouTube

```json
"youtube_highlights": [
  {"id": "XXXXXXXXXXX", "title": "Sprint highlights"},
  {"id": "YYYYYYYYYYY", "title": "Feature highlights"}
]
```

### JSON-шаблон (верхний уровень, F2)

```json
{
  "event_id": "F2_2026_6",
  "series": "FIA Formula 2 Championship",
  "race": "Spielberg",
  "date": "27–28 June 2026",
  "track": "Red Bull Ring",
  "location": "Spielberg",
  "start_date": "2026-06-27",
  "end_date": "2026-06-28",
  "laps": "",
  "distance": "",
  "event_preview": "...",
  "event_preview_ru": "...",
  "youtube_highlights": [...],
  "entry_list": [...],
  "tables": {
    "practice": {...},
    "qualifying": {...},
    "race": {"sessions": [sprintSession, featureSession]}
  }
}
```

**F3** — те же ключи `tables.*` и та же шкала очков; заменить `event_id` (`F3_2026_5`), `series` (`FIA Formula 3 Championship`), `entry_list` (30 машин), число кругов Sprint/Feature и meta-даты. Эталон: `data/events/F3/2026/f3_2026_5.json`.

---

## 4. IndyCar

**Категория:** `openwheel`
**Series ID:** `indycar`

### Entry List

| # | Driver | Team | Engine |
|---|--------|------|--------|

- Rowspan на Team + Engine
- Engine = `entry.manufacturer` или `entry.engine`

### Practice

Стандартный формат (flat, не sessions[]):
```json
"practice": {
  "title": "Practice 1",
  "headers": ["Rank", "Car", "Driver Name", "C/E/T", "Time", "Speed", "Diff", "Gap", "Best Lap", "Laps"],
  "rows": [["1", "3", "McLaughlin, Scott", "D/C/F", "01:01.1020", "106.052", "--.----", "--.----", "24", "27"], ...]
}
```

- **Driver Name** — формат `"Имя Фамилия"` (First Last)
- **C/E/T** — `D/{C|H}/F` (Dallara / Chevrolet или Honda / Firestone)
- Дополнительные сессии: `practice2`, `final_practice`

### Qualifying

Как у F1 — мульти-сессионная, без доп. h4 "Results".
- **Driver Name** (в таблице qualifying) — формат `"Имя Фамилия"` (First Last)

### Race

```
Race
├── Race Results table (колонки из данных, auto-ширины)
├── h4 "Penalties"
├── h4 "Race neutralisation"
└── h4 "Caution Breakdown" (колонка "Free Pass" СКРЫТА)
```

- **Нет stage-таблиц**
- **Нет фиксированных ширин колонок**
- **starting_lineup** — не используется
- **race_statistics** — не используется
- В Caution Breakdown удалена последняя колонка "Free Pass"
- Формат даты: `"1 March 2026"` (день месяц год)
- Нулевые laps_led: `"0"` (не `"--"` или `"–"`)
- **Формат distance (важно)**: `"214.200 miles (344.700 km)"` — строго `miles (km)` как в IndyCar 2026 (`indycar_2026_2/3`), без `mi / km`
- **Driver** (в `race_results`) — формат `"Имя Фамилия"` (First Last), например `"Alex Palou"` (в отличие от practice/qualifying)
- **Double-header** (напр. Milwaukee): **два** event JSON / два `event_id` в schedule, у каждого свой `race_results` — не `tables.race.sessions[]`. Last Results на главной merge’ит карточку после второй гонки (см. чеклист «Даты на карточках»)

### JSON-шаблон события (IndyCar)

```json
{
  "event_id": "INDYCAR_2026_1",
  "series": "IndyCar Series",
  "race": "Firestone Grand Prix of St. Petersburg",
  "date": "1 March 2026",
  "start_date": "2026-03-01",
  "end_date": "2026-03-01",
  "track": "Streets of St. Petersburg",
  "location": "St. Petersburg, Florida",
  "laps": "100",
  "distance": "180.000 miles (289.682 km)",
  "event_preview": "...",
  "event_preview_ru": "...",
  "youtube_highlights": [{"id": "...", "title": "Race highlights"}],
  "entry_list": [
    {"number": "2", "driver": "Josef Newgarden", "team": "Team Penske", "manufacturer": "Chevrolet"}
  ],
  "tables": {
    "practice": {"title": "Practice 1", "headers": [...], "rows": [...]},
    "practice2": {"title": "Practice 2", "headers": [...], "rows": [...]},
    "final_practice": {"title": "Final Practice", "headers": [...], "rows": [...]},
    "qualifying": {"title": "Qualifying", "headers": [...], "rows": [...]},
    "race_results": {"headers": [...], "rows": [...]},
    "caution_breakdown": {"headers": [...], "rows": [...]}
  }
}
```

---

## 5. IMSA

**Категория:** `gt_endurance`  
**Series ID:** `imsa`  
**Путь:** `data/events/IMSA/<year>/imsa_<year>_<round>.json`  
**Эталон 2026:** `imsa_2026_5.json` или последний заполненный раунд

### Entry List

На сайте — **отдельная таблица на класс** (как ELMS), заголовок `h4.table-section-title`:

| # | Team | Car | Drivers |
|---|------|-----|---------|

- Множество пилотов на экипаж (через `/`)
- Rowspan на Team (и Car, если совпадает) внутри класса
- Порядок секций: GTP → LMP2 → GTD Pro → GTD (пустые классы на этапе пропускаются)
- В JSON по-прежнему плоский `entry_list[]` с полем `class`

### JSON-ключи таблиц

```json
"tables": {
  "practice": {"headers": [...], "rows": [...]},
  "qualifying": {"headers": [...], "rows": [...]},
  "race": {"headers": [...], "rows": [...]}
}
```

- Источник для **standings** и **stats**: `tables.race` + `tables.qualifying` (не `race_results`).
- В сырых протоколах часто `TEAM/CAR/SPONSOR` — в JSON хранить отдельно **`Team`** + **`Car`**.
- Qualifying: колонка **Points** (35/32/30…); race: **ST POS** из квалификации; standalone fastest-lap в race не дублировать.

### Practice

Трансформации:
1. TEAM/CAR/SPONSOR → TEAM + CAR (разделение)
2. Колонка ST POS удаляется
3. Колонка CLASS добавляется и заполняется из entry_list

### Qualifying

Трансформации:
1. TEAM/CAR/SPONSOR → TEAM + CAR
2. CLASS добавляется/заполняется из entry_list
3. CLASS POS пересчитывается
4. Колонка POINTS добавляется: 1st→35, 2nd→32, 3rd→30... 29th→2, 30+→1
5. Session meta **скрыт**
6. Для отдельных этапов: merged-таблица Qualifying + Shoot Out

### Race

Трансформации:
1. TEAM/CAR/SPONSOR → TEAM + CAR
2. FASTEST LAP — **удаляется**
3. ST POS заполняется из квалификации
4. CAR NO → #
5. POINTS добавляется: 1st→350, 2nd→320... 30+→10
6. Session meta **скрыт**

### Overview

- **Laps/Distance таблица скрыта**
- BoP секция (Balance of Performance) — только этапы 1-2
- **race_statistics** — не используется

---

## 6. Supercars

**Категория:** `touring`  
**Series ID:** `supercars`  
**Путь:** `data/events/Supercars/<year>/supercars_<year>_<round>.json`

**Один JSON = один championship round** (напр. `SUPERCARS_2026_5`). Несколько гонок уик-энда (`Race 1`, `Race 2`, иногда `Race 3`) живут в **`tables.race.sessions[]`** одного файла — не создавать отдельный event-файл на каждую гонку. На главной Next Race — **отдельная карточка на каждую сессию**; Last Results — merge уик-энда (см. чеклист «Даты на карточках»).

### Entry List

| # | Driver | Team | Manufacturer |
|---|--------|------|-------------|

- Rowspan на Team + Manufacturer

### Practice

- Team names применяются по номеру машины
- Sydney-события: #8 → #800

### Qualifying

Для этапов с Shoot Out — **merged двухгрупповая таблица**:

| Pos | No. | Drivers | Team | *Qualifying:* Fastest Lap, Gap, Lap, Laps | *Shoot Out:* Pos, Fastest Lap, Gap |
|-----|------|---------|------|-------------------------------------------|-------------------------------------|

- Топ-10 строк (в Shoot Out) выделены классом `qual-row-in-shootout`
- Строки 11+ показывают "—" в колонках Shoot Out

### Race

Мульти-гоночный формат (несколько гонок за уикенд):

```
Race
├── h4 "Starting Grid 1"
├── h3 "Race 1" → таблица результатов
├── h4 "Starting Grid 2"
├── h3 "Race 2" → таблица результатов
├── ...
└── Penalties / VSC (после спринт-сессий)
```

**Race Results — 7 колонок (колонка Stops удалена):**

| Pos | No. | Driver | Team | Race time | Laps | Pts |
|-----|------|--------|------|-----------|------|-----|

### Overview

- **Laps/Distance таблица скрыта**
- Видео-сетка: `minmax(260px, 1fr)` (уже, чем у других серий — 380px)
- Все блоки (entry-list, practice, qualifying, race) всегда показываются

---

## 7. Super Formula

**Категория:** `openwheel`
**Series ID:** `super_formula`

### Практика / квалификация

Flat-формат или `qualifying.sessions[]` (`Qualifying Round N`).

### Очки

В колонке **`Pts` гонки** — только очки за финиш (без бонуса квалификации):

| | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|--|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Полная дистанция | 20 | 15 | 11 | 8 | 6 | 5 | 4 | 3 | 2 | 1 |
| Спринт / укороченная R3 (25 кругов Fuji 2026) | 12 | 9 | 7 | 6 | 5 | 4 | 3 | 2 | 1 | — |
| Половинные (например Motegi R1) | 10 | 7.5 | 5.5 | 4 | 3 | 2.5 | 2 | 1.5 | 1 | 0.5 |

**Квалификация** отдельно: 3 / 2 / 1 за P1–P3. Standings начисляет их из `Qualifying Round N` (или flat quali, если гонка в файле ещё пустая — Autopolis).

### Race — многогоночный уикенд

Один event-файл может содержать **несколько гонок** в формате `race.sessions[]`
(Motegi double-header и аналогичные этапы):

```json
"race": {
  "sessions": [
    { "title": "Race Round 4", "headers": [...], "rows": [...] },
    { "title": "Race Round 5", "headers": [...], "rows": [...] }
  ]
}
```

- При сборе standings каждая сессия раскладывается в свою колонку `race_order`
  (`R1`, `R2`, …) по номеру из title (`Race Round N`).
- Очки допускают дробные значения (например, половинные очки за укороченную
  гонку) — хранятся как `"2.5"` в исходных данных.

---

## 8. Super GT

**Категория:** `touring`  
**Series ID:** `super_gt`

### Entry List

| # | Class | Team | Make | Car | Drivers | Tire |
|---|-------|------|------|-----|---------|------|

- Два класса: `GT500` и `GT300` (обе группы в одной таблице, с пустой строкой-разделителем между ними в `entry_list`).
- В колонке `Drivers` — несколько пилотов через `; ` (формат для endurance-разделения).

### Race

Один проход, многоклассовый:

| Pos. | Class | Car | No. | Team | Drivers | Laps | Gap | Interval | Avg. (km/h) | Time of the day | DP | TP |
|------|-------|-----|-----|------|---------|------|-----|----------|-------------|-----------------|----|----|

- **DP** — очки пилотам (используется для standings)
- **TP** — очки команде
- В колонке `Drivers` — несколько пилотов через `; ` (сборщик standings автоматически их разобьёт)

---

## 9. WEC / ELMS / GT World Challenge Europe Endurance

**Категория:** `gt_endurance`  
**Series IDs:** `wec`, `elms`, `gtwce_end`

> **Ключ результатов — разный у WEC и ELMS/GTWCE End.** Не путать при заполнении:
>
> | Серия | Ключ таблицы гонки | Примечание |
> |-------|-------------------|------------|
> | **WEC** | `tables.race_results` | Hypercar + LMGT3; 24h — один протокол |
> | **ELMS** | `tables.race` | LMP2 / LMP3 / LMGT3 |
> | **GTWCE Endurance** | `tables.race` | Pro / Gold / Silver / Bronze / Pro-Am; Spa — 5 классовых победителей на карточке |

### Entry List

| # | Class | Team | Drivers | Car |
|---|-------|------|---------|-----|

- Колонка `Drivers` содержит 2–4 пилотов, разделённых `/` либо `; `.
- Классы: WEC — Hypercar / LMGT3; ELMS — LMP2 / LMP2 Pro/Am / LMP3 / LMGT3; GTWCE-End — Pro / Gold / Silver / Bronze / Pro-Am.

### Race

- В большинстве этапов единичная таблица `race` с колонками `Pos / Class / Drivers / Team / Points` (ELMS/GTWC также включают `Cup pts` + `Overall pts`).
- **24 Hours of Spa** (`GTWCE_END`, CrowdStrike 24 Hours of Spa): на карточке Last Results показываются **5** классовых победителей — Overall, Gold, Silver, Bronze и **Pro-Am** (класс в протоколе часто `Pro-AM Cup`). Остальные этапы GTWCE Endurance — 4 строки.
- Сборщик standings автоматически разбивает `Drivers` по `;` / `/` и начисляет очки каждому пилоту из колонки `Points` (или `DP` для Super GT).

### Классовые standings (IMSA, ELMS, WEC, GTWCE)

**IMSA**, **ELMS**, **WEC**, **GT World Challenge Europe** (Endurance и Sprint) — per-class standings собираются автоматически из event JSON в Go:

| Серия | Функция | Источник в event JSON |
|-------|---------|------------------------|
| IMSA | `BuildImsaStandingsFromEvents` | `tables.race` + `tables.qualifying` |
| ELMS | `BuildElmsStandingsFromEvents` | `tables.race` |
| WEC | `BuildWecStandingsFromEvents` | `tables.race_results` (Hypercar, LMGT3) |
| GTWCE End / Sprint | `BuildGtwceStandingsFromEvents` | `tables.race` / `tables.race.sessions[]` |

Структура event JSON для **GTWCE Sprint** (Race 1 + Race 2, entry list с двумя пилотами) — §11. Endurance — эталоны в `gtwce-end-event-json.mdc`.

Ручной `data/standings/*.json` для этих серий **не нужен** (файл `elms.json` в репозитории — legacy, API его не читает).

Фронтенд рендерит `classes[]` отдельными таблицами (IMSA, WEC, ELMS, GTWCE End/Sprint); у IMSA и WEC доступен переключатель Crew / Driver.

### Классовый standings JSON (legacy)

Структура ручного файла с `classes[]` — **только для справки и тестов**. API для IMSA / ELMS / WEC / GTWCE использует автосборку из events, а не этот файл:

```json
{
  "race_order": ["DAY24", "SEB12", "LBG"],
  "completed_races": ["DAY24", "SEB12"],
  "classes": [
    {
      "id": "GTP",
      "name": "Grand Touring Prototype (GTP)",
      "rows": [
        {
          "pos": 1,
          "car": "7",
          "driver": "Julien Andlauer / Laurin Heinrich / Felipe Nasr",
          "team": "Porsche Penske Motorsport",
          "manufacturer": "Porsche 963",
          "races": { "DAY24": "1", "SEB12": "1" },
          "points": "755"
        }
      ]
    }
  ]
}
```

- Если в JSON только `rows`, отображается одна общая таблица пилотов (flat).

---

## 10. DTM

**Категория:** `touring`  
**Series ID:** `dtm`  
**Путь:** `data/events/DTM/<year>/dtm_<year>_<round>.json`  
**Эталон 2026:** `dtm_2026_3.json` (Lausitzring) или последний заполненный раунд

### Entry list

Поля: `manufacturer`, `car`, `power_unit`, `team`, `number`, `driver`, `status`, `rounds`, `driver_slug`.

Операционные имена команд в протоколах (напр. `Mercedes-AMG Team Mann-Filter`, `Mercedes-AMG Team Ravenol`) **не менять** в таблицах гонок. Если две машины делят одну запись teams' championship, задать `teams_championship` в `data/teams/dtm.json` (напр. обе → `Winward Racing`) — это влияет только на **Team Stats** на странице серии, не на drivers standings.

### Practice / Qualifying / Race

Все три секции — `sessions[]`:

```json
"tables": {
  "practice": {
    "sessions": [
      {"title": "Practice 1", "headers": ["Pos", "No.", "Driver", "Team", "Manufacturer", "Fastest Lap", "Gap", "Laps"], "rows": []},
      {"title": "Practice 2", "headers": [...], "rows": []}
    ]
  },
  "qualifying": {
    "sessions": [
      {"title": "Qualifying (Race 1)", "headers": ["Pos", "No.", "Driver", "Team", "Manufacturer", "Fastest Lap", "Int"], "rows": []},
      {"title": "Qualifying (Race 2)", "headers": [...], "rows": []}
    ]
  },
  "race": {
    "sessions": [
      {"title": "Race 1", "headers": ["Pos", "No.", "Driver", "Team", "Manufacturer", "Time", "Fastest Lap", "Pitstops", "Pts"], "rows": []},
      {"title": "Race 2", "headers": [...], "rows": []}
    ]
  }
}
```

### Очки в колонке `Pts`

В `tables.race.sessions[].rows` → `Pts` = **только финиш** (как в раундах 1–4). Бонус квалификации **не** класть в `Pts` гонки: `BuildStandingsFromEvents` начисляет 3/2/1 из `Qualifying (Race N)` отдельно (`applyDTMQualifyingAwards`). Иначе получится двойной счёт.

**Гонка** (топ-15 классифицированных):

| Pos | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
|-----|--:|--:|--:|--:|--:|--:|--:|--:|--:|---:|---:|---:|---:|---:|---:|
| Pts | 25 | 20 | 16 | 13 | 11 | 10 | 9 | 8 | 7 | 6 | 5 | 4 | 3 | 2 | 1 |

**Квалификация** (топ-3 той же гонки: Qualifying Race 1 → Race 1, Qualifying Race 2 → Race 2) — только в standings-движке:

| Q Pos | 1 | 2 | 3 |
|-------|--:|--:|--:|
| Pts | 3 | 2 | 1 |

Пример: поул + победа → в JSON гонки `Pts` = `25`, плюс +3 из Q в standings (= 28 суммарно). DNF / P16+ → `0` в гонке; Q-бонус всё равно начислится из таблицы квалификации.

### YouTube

```json
"youtube_highlights": [
  {"id": "...", "title": "Race 1 Highlights"},
  {"id": "...", "title": "Race 2 Highlights"}
]
```

### Standings

- **Drivers:** `BuildStandingsFromEvents` из `tables.race.sessions[]`; колонки `race_order` — аббревиатура трассы + номер гонки (`RBR1`, `RBR2`, `NOR1`, `NOR2`, …).
- **Team Stats:** агрегация по `teams_championship` из `data/teams/dtm.json` (см. раздел «Автоматическая сборка standings»).
- **Manufacturers:** отдельного manufacturers championship на сайте нет; блок `manufacturers[]` в Stats API — агрегация по `Manufacturer` из race tables / entry list для справочной статистики.

---

## 11. FREC / F4 Italian / Porsche Supercup / GTWCE Sprint

Краткие серии с авто-сборкой standings из events (без ручного редактирования `data/standings/*.json`).

| Серия | Series ID | Категория | Путь к events | Эталон 2026 |
|-------|-----------|-----------|---------------|-------------|
| FREC | `FREC` | `openwheel` | `data/events/FREC/<year>/frec_<year>_<round>.json` | `frec_2026_5.json` |
| F4 Italian | `F4_IT` | `single_make` | `data/events/Italian F4/<year>/f4_it_<year>_<round>.json` | `f4_it_2026_3.json` |
| Porsche Supercup | `PSC` | `single_make` | `data/events/Porsche Supercup/<year>/psc_<year>_<round>.json` | `psc_2026_3.json` |
| GTWCE Sprint | `GTWCE_SPRINT` | `gt_sprint` | `data/events/GT World Challenge Europe Sprint/<year>/gtwce_sprint_<year>_<round>.json` | `gtwce_sprint_2026_1.json` |

### FREC

| Секция | Формат | Примечание |
|--------|--------|------------|
| Practice | `practice.sessions[]` | Free Practice 1/2 |
| Qualifying | `qualifying.sessions[]` | Q1 / Q2 (reverse-grid sprint) |
| Race | `race.sessions[]` | 2 или 3 гонки; колонка `Fin / ST`, **`Pts`** с бонусами |

- Standings: колонки `R1-1`, `R1-2`, …; на 3-гоночных уикендах Race 2 = sprint (другая шкала очков).
- Очки: `frec-2026-scoring.mdc`.
- YouTube: **не заполнять** `youtube_highlights` / `youtube_id`.

### F4 Italian

| Секция | Формат | Примечание |
|--------|--------|------------|
| Practice | `practice.sessions[]` | Free Practice 1/2 (как FREC) |
| Qualifying | `qualifying.sessions[]` | Qualifying 1 / 2 (heat-группы) |
| Race | `race.sessions[]` | до 4 гонок (Race 1–3 + Final); колонки `Fin`, `ST`, **`Pts`** |

- Standings **по номеру машины** (`#10`), не по фамилии heat-группы.
- Нет бонусов за поул / FL в `Pts`; только финишные очки top 15.
- Очки: `italian-f4-2026-scoring.mdc`.

### Porsche Supercup

| Секция | Формат | Примечание |
|--------|--------|------------|
| Practice | `practice` (flat) | одна сессия |
| Qualifying | `qualifying` (flat) | |
| Race | **`race_results`** | одна гонка за F1 support round |

- Entry: `number`, `driver`, `team`, `driver_slug`; **`guest": true`** → `ineligible[]` в standings.
- Обычный этап = один `event_id` и **день гонки** на карточке (не `start_date`–`end_date` уик-энда F1). Double-header (два id подряд на одной трассе, напр. Zandvoort) — merge на Last Results.
- Очки: `psc-event-json.mdc`.
- YouTube: **не заполнять** `youtube_highlights` / `youtube_id`.

### YouTube (F4 Italian)

Поле: `youtube_highlights: [{ "id", "title" }]`. Только официальный канал; live VOD / watch-along сторонних каналов не класть, если есть ролик с официального канала.

**FREC / PSC:** поле `youtube_highlights` / `youtube_id` **не использовать**.

| Серия | Канал | Что писать | `title` |
|-------|--------|------------|---------|
| **F4 Italian** | `@Italianf4-Euro4` | Отдельных highlight-пакетов нет — полные гонки уик-энда (Race 1–3 + Final). Не брать ACI Sport TV live-дубли, если есть ролик с `@Italianf4-Euro4`. | `Race 1` … `Race 3`, `Final` |

Эталон 2026: `f4_it_2026_1.json`.

### GTWCE Sprint

| Секция | Формат | Примечание |
|--------|--------|------------|
| Practice | `practice` (flat) | |
| Qualifying | `qualifying` (flat) | |
| Race | `race.sessions[]` | Race 1 + Race 2; `Drivers`, `Cup pts`, `Overall pts` |

- Entry: **`driver1`**, **`driver2` only** (без `driver3`) — `gtwce-sprint-entry-list.mdc`.
- Standings: per-class через `BuildGtwceStandingsFromEvents`.
- Подробности: `gtwce-sprint-event-json.mdc`.

Минимум для строки standings: `Pos` + `Driver`/`Drivers` + `Pts`/`Points` (или `Cup pts` / `Overall pts` у GTWCE).

---

## События вне championship

Exhibition / pre-season / prologue файлы могут отображаться на сайте, но **не** входят в championship standings, stats и head-to-head (`skipChampionshipMetricsEvent` + `isFutureScheduleEvent`):

| Событие | `event_id` (пример) | Standings / Stats / H2H |
|---------|---------------------|-------------------------|
| NASCAR Cup Clash | `NASCAR_CUP_2026_0` (суффикс `_0`) | ❌ |
| NASCAR All-Star | `...ALLSTAR...`, `...ALL_STAR...` | ❌ |
| F1 / IMSA / любое pre-season | `...PRE_SEASON...` / `...PRESEASON...` | ❌ |
| ELMS Prologue | `...PROLOGUE...` | ❌ |
| Будущие даты | `StartDate > today` | ❌ (все серии) |

Перед добавлением раунда в календарь: `internal/schedulefile/enrich.go` (`skipChampionshipMetricsEvent`, `isExhibitionEvent`).

**PSC guests:** в standings — таблица `ineligible` / 0 очков; в stats — guest-машины из `entry_list.guest` полностью исключаются из Driver/Team/Manufacturer metrics.

**F2/F3 poles:** одна flat-таблица Qualifying мапится только на Feature (Sprint не наследует Q — reverse grid). Без wraparound Q→race, чтобы не дублировать poles.

---

## Автоматическая сборка standings

Точка входа API: `cmd/server/handlers_series.go` → `handleSeriesStandings`.

Таблица **пересобирается при каждом запросе** `GET /api/series/{id}/standings`.
Достаточно положить корректные результаты в `data/events/<series>/<season>/`.

### Маршрутизация по сериям

| Серии | Go-сборщик | Ответ API |
|-------|------------|-----------|
| IMSA | `BuildImsaStandingsFromEvents` | `classes[]` |
| ELMS | `BuildElmsStandingsFromEvents` | `classes[]` |
| WEC | `BuildWecStandingsFromEvents` | `classes[]` |
| GTWCE_END, GTWCE_SPRINT | `BuildGtwceStandingsFromEvents` | `classes[]` |
| F1, F2, F3, FREC, F4_IT, DTM, IndyCar, Super Formula, Super GT, PSC, `nascar_cup` / `noaps` / `nascar_truck` / `nascar_modified` / `arca`, Supercars | `BuildStandingsFromEvents` | `rows[]` (+ `ineligible[]` у stock-car и PSC) |

Если `BuildStandingsFromEvents` вернул `nil` (крайний случай), API делает fallback на `LoadStandings` — сырой JSON из `data/standings/`.

### Роль `data/standings/*.json`

Файлы standings — **не снимки очков**. Сборщик читает из них только метаданные колонок (и то не для всех серий):

| Файл | Нужен API? | Что используется | `rows` в файле |
|------|------------|------------------|----------------|
| `nascar_cup`, `noaps`, `nascar_truck`, `arca`, `nascar_modified` | да | `race_order`, `event_names` | игнорируются |
| `indycar` | да | `race_order` | игнорируются (пустой) |
| `supercars` | нет | — | legacy |
| `elms` | нет | — | legacy (тесты) |
| остальные серии | нет | `race_order` строится из `data/schedules/` + events | — |

При отсутствии standings-файла stock-car получит generic-коды `R1`, `R2`, … — для NASCAR/ARCA/Modified нужно поддерживать официальные аббревиатуры трасс в `race_order`.

### Что нужно в event-JSON, чтобы строка standings построилась

Минимальный набор колонок в `tables.race_results` (или `tables.race` с `rows[]`,
или `tables.race.sessions[i]`):

| Колонка | Обязательно? | Варианты названий |
|---------|--------------|-------------------|
| Позиция | да | `Pos`, `Pos.`, `Fin` |
| Пилот   | да | `Driver` (одиночно) **или** `Drivers` (несколько через `;` / `/` / `,`) |
| Очки    | да, чтобы начислять очки | `Points`, `Pts`, `Pts.`, `DP` (Super GT) |
| Номер машины | нет | `No`, `No.`, `#`, `Car` |
| Команда | нет | `Team` |
| Производитель | нет | `Manufacturer`, `Chassis`, `Make` |
| Статус (для DNQ) | нет | `Status`, `Reason`, `Notes` |

### Поддерживаемые варианты таблицы результатов

Сборщик последовательно проверяет источники в event JSON. **Куда класть результаты — по серии:**

| Серия | Ключ(и) результатов |
|-------|---------------------|
| NASCAR Cup / NOAPS / Truck / Modified / ARCA | `tables.race_results` (fallback: `tables.stage3`) |
| F1 | GP: `tables.race_results`; спринт: `tables.race.sessions[]` |
| F2 / F3 | `tables.race.sessions[]` (Sprint + Feature) |
| FREC / F4_IT / DTM / GTWCE Sprint | `tables.race.sessions[]` |
| Super Formula / Supercars | `tables.race.sessions[]` |
| IndyCar / WEC / PSC | `tables.race_results` |
| IMSA / ELMS / GTWCE Endurance | `tables.race` |
| Super GT | `tables.race` (flat `headers` + `rows`, не sessions) |

Порядок fallback в `BuildStandingsFromEvents` (если ключ не задан явно для серии):

1. `tables.race_results`
2. `tables.stage3` (stock-car)
3. `tables.race` (flat `rows[]` или контейнер)
4. `tables.race.sessions[]`

### Что происходит автоматически для конкретных серий

| Серия | Особенности авто-сборки |
|-------|-------------------------|
| F1 (2025+) | Для спринт-уикенда race_order расширяется на `RnS` / `RnF`; сессия `Sprint Race` и основная гонка раскладываются в отдельные колонки. `Carlos Sainz` нормализуется в `Carlos Sainz Jr.` |
| Super Formula | `race.sessions[]` разворачивается в отдельные колонки race_order по порядку (`R1`, `R2`, …). Поддержка дробных очков; бонус за квалификацию (3/2/1). |
| Super GT | Колонка `Drivers` разбивается по `;` / `/`; очки из `DP`. Flat-таблица через `BuildStandingsFromEvents`. |
| WEC / ELMS / GTWCE | Per-class через отдельные сборщики (см. выше); multi-driver entries; WEC — только Hypercar и LMGT3 в зачёте. |
| IndyCar | Производитель берётся из `data/teams/indycar.json` по номеру машины (в результатах его нет). `race_order` — из `data/standings/indycar.json`. |
| Supercars | `race_order` и очки только из events (коды `SMP1`, `MLB4`, …); snapshot `supercars.json` API не использует. |
| DTM | Drivers standings из `tables.race.sessions[]`; `race_order` — `NOR1`/`NOR2`, `RBR1`/`RBR2`, … **Team Stats** (не drivers championship): Mann-Filter + Ravenol → `Winward Racing` через `teams_championship` в `data/teams/dtm.json`. |
| FREC | `tables.race.sessions[]` → колонки `R1-1`, `R1-2`, … (по числу гонок в раунде). |
| F4_IT | Как FREC; одна строка standings на номер машины (`#10`), даже если пилоты разные в heat-группах. |
| PSC | Гостевые заезды (`guest` в entry list) попадают в отдельную таблицу `ineligible`. |
| NASCAR Cup / Xfinity / Truck / ARCA / Modified | Очки стейджей (`stage_1`, `stage_2`; для Cup также `stage_3` на 4-stage гонках вроде Coca-Cola 600 и очки Daytona Duels) попадают в колонку `Stages`. DNQ из таблицы `did_not_qualify` создают отдельные строки со статусом `DNQ`. Для NASCAR Cup события `..._0` (Clash) исключаются из зачёта. `NC` в колонке Pos отображается как индекс строки. `race_order` — из standings-файла серии. |
| NOAPS / Modified / ARCA | Эксклюзивно поддерживается fallback на `tables.stage3` как источник финишной таблицы. |

### Completed races

`CompletedRaces` вычисляется автоматически на основании того, в каких колонках
race_order реально появились непустые значения. Пустая ячейка → раунд считается
несостоявшимся. Дополнительно `EnsureCompletedRaces` сверяется с наличием таблиц
`race_results` / `race` / `race.sessions` в каждом event-файле.

---

## Stats API

Точка входа: `cmd/server/handlers_series.go` → `handleSeriesStats` → `BuildDriverStatsFromEvents`.

`GET /api/series/{id}/stats?season=…` пересобирает **Driver / Team / Manufacturer** stats из тех же event JSON, что и standings.

| Блок ответа | Содержание |
|-------------|------------|
| `rows[]` | Driver stats (starts, wins, points, avg finish, …) |
| `teams[]` | Агрегация по команде из driver rows |
| `manufacturers[]` | Агрегация по manufacturer/engine |
| `classes[]` | Per-class split (IMSA, endurance) |

**Важно для DTM:** drivers championship = `rows` / standings; **Team Stats** (`teams[]`) может объединять операционные имена (Mann-Filter + Ravenol → Winward Racing) через `teams_championship` в `data/teams/dtm.json`. Это не меняет drivers standings.

**Stock-car:** team names в stats канонизируются через `data/teams/{series}.json` (варианты написания → одно имя).

**IndyCar:** manufacturer в race tables отсутствует — подставляется из `data/teams/indycar.json` по номеру.

**Supercars:** manufacturer в stats дополняется из `data/teams/supercars.json` по `#`.

**F1:** chassis/manufacturer из `data/teams/f1.json`; Q2/Q3 passes из qualifying tables.

**Head-to-head:** `GET /api/series/{id}/headtohead?season=2026&driverA=<slug>&driverB=<slug>` — сравнение двух пилотов по раундам (только серии с flat standings).

### Car Specs (`GET /api/series/{id}/teams`)

Поля `car_models`, `technical_spec`, опционально `engines` / `homologation` в `data/teams/{series}.json`.

**Единицы (политика):**
| Кластер | Primary | Secondary в скобках |
|---------|---------|---------------------|
| Stock-car (Cup, NOAPS, Truck, ARCA, Modified) | imperial (`in`, `lb`, `cu in`, `US gal`, `hp`) | SI (`mm`, `kg`, `L`) |
| FIA open-wheel / endurance / touring (F1–F4, FREC, PSC, SF, IMSA Classes, Supercars, DTM, …) | SI (`mm`, `kg`, `L`/`litres`, `kW`) | hp/BHP где так в официальном источнике |
| Мощность | как в источнике (`hp` / `HP` / `kW` / `BHP` / `cv`) — не «нормализовать» между системами | dual `kW (hp)` допустим, если оба официальны |

Не выдумывать конверсии: SI↔imperial только если обе цифры есть в официальном материале или уже были в файле.

Источник истины для stats: **event JSON** через `BuildDriverStatsFromEvents` (не SQLite-агрегаты).

Источники (2026):

| Серия | Источник |
|-------|----------|
| Italian F4 | ACI Sport Tatuus T-421 User Manual; Autotecnica Motori 414-F4 Gen2 Technical Manual; FIA F4 Gen2 weight reference |
| Porsche Supercup | Porsche Newsroom Technical Data 911 Cup 992.2 MY2026; Michelin (PMSC playbook) |
| Super Formula | TOYOTA GAZOO Racing fact sheet *Super Formula (as of March 2025)* (`fact-data_006_01_en.pdf`, source: JRP) — SF23 550+ hp / 677 kg / engines / tyre allocation; **no public JRP TR** for fuel / OTS Δhp / dimensions |
| Supercars | 2026 Operations Manual Division C FINAL (C1.2 models, C4.1 weight/axle, C8.12 parity test, C9.4 fuel vessel by circuit, C15.4.2 MoTeC C185); Gen3 tech sheet only for ~600 hp / ~7500 rpm / ~300 km/h (ESD holds exact engine limits) |
| NASCAR Cup power | nascar.com 2026 horsepower package announcements |
| ARCA power | [Ilmor Racing ARCA](https://www.ilmor.com/racing/ARCA) (Ilmor 396: 700 HP / 530 ft-lb / 7500 RPM) |
| Modified Spec Engine | [Robert Yates Racing Engines — NASCAR-Approved Spec Engine](https://www.ryr.com/nascar-spec-engine/) (~610 hp / ~500 ft-lb) |
| NWMT (Modified) tech | [2025 NWMT Rule Book §20D](https://www.speedbowlct.com/wp-content/uploads/2025/08/2025-NASCAR-Modified-Rules.pdf) (weight 2645–3200 lb, spoiler 8×48″, fuel cell ≤24 gal, restrictor via Entry Blank); 2026 tyres **American Racer** ([nascar.com](https://www.nascar.com/news-media/2026/06/23/american-racer-modified-tour-tires/), RaceDayCT) — not Hoosier |
| NOAPS / Truck power | Exact hp/torque, fuel capacity, track packages, wet policy — **not** in open NASCAR/Ilmor primary docs; Specs state unpublished |
| FIA Formula 2 | [fiaformula2.com — The car and engine](https://www.fiaformula2.com/en/information/the-car-and-engine-f2.14LCsEEMG9yyx5DkhcN1J8); 2026 FIA Formula 2 Technical Regulations Art. 4.1 (min mass) |
| FIA Formula 3 | [fiaformula3.com — The car and engine](https://www.fiaformula3.com/en/information/the-car-and-engine-f3.5tGE8Qr5FdTJJwaUN0YbWq) |
| IndyCar hybrid | 2026 IndyCar Rulebook (epaddock) Art. 14.4 weight / 14.7 aero / 14.8 fuel / 14.12 EMS / 14.19 P2P; Honda HRC hybrid notes |
| IMSA Classes | IMSA Sporting Art. 1.20–1.24; FIA 2026 LMP2 TR (homologated 2017); GTP LMDh/LMH architecture without BoP numbers (imsa.com ACO/IMSA regs hub) |
| NASCAR Cup packages | nascar.com 2025/11/14 technical updates (750 hp / 3″ spoiler short-track–road package; A-post flaps) — full Rule Book not public |
| FIA F3 | 2026 FIA Formula 3 Technical Regulations Issue 3 (Art. 4.1 min mass 729 kg) |
| FREC | Tatuus T-326 = FR 2nd Gen Art. 275A; FREC Sporting Art. 29.2 min weight 695 kg |
| FIA F2 | 2026 FIA Formula 2 Technical Regulations Issue 2 (Art. 4.1 / 3.5.1 DRS / 10.4 tyres) |
| Italian F4 | 2026 FIA Formula 4 Technical Regulations Art. 274A + ACI Sport Italian F4 Sporting Regulations 2026 |
| WEC / ELMS / GTWCE / DTM / Super GT Classes | `web/data/series-classes-spec.js` — class definitions only; no event BoP numbers |

Вкладки **Classes** (не Car Specs): IMSA, WEC, ELMS, GTWCE End/Sprint, Super GT, DTM — `/series/{id}/classes`.

Подробнее по эндпоинтам: [`docs/WEB_TGA_API.md`](../docs/WEB_TGA_API.md).

---

## `data/teams/*.json`

Файл `data/teams/<series>.json` (или `{series}_{season}.json` для F1) — **не standings**, а справочник составов и метаданных для страницы Teams и обогащения stats/entry.

| Серия | Что хранится | Где используется |
|-------|--------------|------------------|
| Stock-car (Cup, NOAPS, Truck, ARCA, Modified) | #, driver, team, manufacturer, crew_chief | Teams page; **канонизация team name** в Team Stats |
| F1 / F2 / F3 | constructor, chassis, power unit | Teams page; F1 stats (manufacturer/chassis) |
| IndyCar | engine brand в `manufacturer` | Teams page; **engine в standings/stats** по `#` |
| DTM | car, power_unit, `teams_championship` | Teams page; **Team Stats aggregation** |
| Supercars | manufacturer, co-driver, rounds | Teams page; manufacturer в stats |
| IMSA / ELMS / WEC / GTWCE | class, car, multi-driver | Teams page; rounds enrichment |

`entry_list` в event JSON — источник для конкретного уик-энда; `data/teams/*.json` — сезонный состав и правила агрегации.

---

## Служебные файлы и скрипты

Не путать с event JSON — эти файлы обслуживают расписание, live-блок и проверки данных.

### `data/live.json`

Список `event_id`, которые сейчас считаются **live** на сайте (баннер / live dashboard). Обновляется **отдельными CLI**, не вручную при заполнении результатов:

| Источник | CLI / пакет | Что синхронизирует |
|----------|-------------|-------------------|
| F1 | `cmd/sync-openf1-live` | OpenF1 → F1 entries в `live.json` |
| NASCAR | `cmd/sync-nascar-live` | NASCAR feed → stock-car entries |
| WEC | `cmd/sync-wec-live` | ECM live feed → WEC entries |
| Super Formula | `cmd/sync-superformula-live` | Super Formula live → entries |

Диагностика live-синхронизации: [`docs/RUNBOOK.md`](../docs/RUNBOOK.md) §2.

Формат: массив строк `["F1_2026_3", ...]` или объект `{"live_event_ids": [...]}` (оба поддерживаются API).

### Скрипты (из корня репозитория)

| Скрипт | Когда запускать |
|--------|-----------------|
| `node scripts/build-multi-race-schedule-sessions.mjs` | После заполнения `tables.race.sessions[]` или правок дат multi-race серий (F2, F3, FREC, F4, DTM, Supercars, …) — пересобирает `web/data/multi-race-schedule-sessions.js` |
| `node scripts/fill-schedule-times.mjs` | После добавления/изменения времени в `data/schedules/*.json` (`time_est` / `time_msk`) |
| `node scripts/validate-schedule-times.mjs` | Проверка согласованности времён в schedules |
| `node scripts/sync-stockcar-table-teams.mjs` | Выровнять колонку `Team` в practice/qualifying/race/stage таблицах stock-car с `entry_list` |
| `node scripts/check-data.mjs` | Общий gate: тесты данных и smoke-проверки перед коммитом |
| `node scripts/fix-driver-slug-aliases.mjs` | Канонизация nickname-slug (`--check` в `make ci-data-audits`); правит events / profiles / redirects |
| `node scripts/sync-driver-profiles-from-events.mjs` | Синк профилей из entry_list (учитывает aliases) |
| `node scripts/audit-card-dates.mjs` | Аудит дат на карточках Next Race / Last Results |

Правила часовых поясов: `data/timezones-reference.json`, `data/TIMEZONES.md`.

---

## Рекорды круга в `event_preview`

Абзац(ы) про рекорд **серии на этой трассе** — в конце `event_preview` / `event_preview_ru` (plain text, `\n\n`, без Markdown). Не абсолют трассы и не чужой чемпионат.

### Правила заполнения

1. Рекорд = **конкретный чемпионат + конкретная трасса** (и класс, если мультикласс).
2. Если лучший круг / поул **побит на этом же ивенте** — в preview писать **предыдущий** рекорд (состояние «на входе в уик-энд»).
3. Нет надёжного источника → **не выдумывать**. Допустимы формулировки *fastest documented* / *qualifying benchmark* / *inaugural T-326 era*, если официального «all-time record» нет.
4. Inaugural / смена шасси (FREC T-326) / первый визит серии — явная фраза, что рекорды будут установлены впервые.
5. EN и RU зеркалят; имена пилотов латиницей в обоих языках.

### Приоритет источников (по типу серии)

| Тип | Куда смотреть в первую очередь |
|-----|--------------------------------|
| NASCAR Cup / NOAPS / Truck / ARCA | [Jayski](https://www.jayski.com/) Statistical Advance («Track Qualifying Record» / «Track Race Record»); [Racing-Reference](https://www.racing-reference.info/) / [nascarreference.com](https://www.nascarreference.com/); SPEED SPORT / SpeedwayMedia notes; ARCARacing.com |
| Modified (NWMT) | Official NWMT / track release; SPEED SPORT; The Third Turn (только если совпадает с NWMT/пресс-релизом) |
| F1 / F2 / F3 / F4 | FIA timing PDF; Wikipedia round/circuit «Lap record» **только** с цитатой протокола; motorsport.com / Formula Scout race reports |
| IndyCar | IndyCar Fast Facts / track media notes; Racing-Reference |
| IMSA / WEC / ELMS / GTWCE | Official timing (IMSA Results, FIA WEC, ELMS / Al Kamel, SRO); series «Facts and Figures» |
| Supercars | Auto Action Event Guides (PDF); [supercars.com](https://www.supercars.com/) event pages («Lap Record») |
| Super Formula | motorsport.com / Formula Scout + circuit course-record notes |
| DTM | [dtm.com](https://www.dtm.com/) news (явно «qualifying record»); motorsport.com |
| Porsche Supercup | [Porsche Newsroom](https://newsroom.porsche.com/) (PPDB / Supercup) |

### Проверенные источники — батч gap-fill (июль 2026)

Ниже — источники для этапов, которым не хватало рекордного абзаца. При обновлении цифр сверять с этими URL (или более свежим официальным релизом той же серии).

| `event_id` | Claim (кратко) | Источник |
|------------|----------------|----------|
| `SUPERCARS_2026_1` | Q McLaughlin 1:27.7428 (2020); R Whincup 1:29.8424 | [Auto Action Sydney Event Guide PDF](https://autoaction.com.au/wp-content/uploads/2023/07/Supercars_2023-EventGuide_RD7-SydneyTM.pdf); [supercars.com Sydney](https://www.supercars.com/events/2023-beaurepaires-sydney-supernight) |
| `SUPERCARS_2026_7` | Q McLaughlin 1:11.9908 (2017); R Percat 1:12.9311 (2017) | [Auto Action Townsville Event Guide PDF](https://autoaction.com.au/wp-content/uploads/2023/07/Supercars_2023-EventGuide_RD6-Townsville-TM.pdf); [supercars.com Townsville](https://www.supercars.com/events/2023-nti-townsville-500) |
| `SUPERCARS_2026_4` | Inaugural modern-era Christchurch — records first set this weekend | Preview / calendar (нет исторических Q/R серии) |
| `PSC_2026_2` | Q Schuring 1:43.784 (2025, Barcelona) | [Porsche Newsroom](https://newsroom.porsche.com/en/ppdb/2025/05/rookie-flynt-schuring-wins-the-qualifying-in-barcelona.html) |
| `PSC_2026_3` | Fastest documented Q Andlauer 1:30.457 (2019, RBR) — не помечен как официальный all-time | Исторический протокол PSC 2019 / race reports (формулировка *documented*) |
| `PSC_2026_4` | Q Marvin Klein 2:20.058 (2024, Spa) | Porsche Newsroom / PSC 2024 Spa qualifying reports |
| `PSC_2026_5` | Q Harry King 1:45.933 (2023, Hungaroring) | [Porsche Newsroom](https://newsroom.porsche.com/en/2023/motorsports/porsche-mobil-1-supercup-pmsc-saison-2023-round-4-budapest-33200.html) |
| `DTM_2026_3` | **Previous** Q Auer 1:19.827 (2025); Thiim 1:19.463 — рекорд **этого** уик-энда 2026 | [dtm.com Lausitzring](https://www.dtm.com/en/news/Second-DTM-pole-Viking-Thiim-takes-the-spoils-at-the-Dekra-Lausitzring); [motorsport.com 2025 Q](https://au.motorsport.com/dtm/results/2025/lausitzring-656532/?st=Q1) |
| `DTM_2026_4` | **Previous** Q Pepper 48.467 (2025); Thiim 48.449 — сбит на Norisring 2026 | [motorsport.com Norisring](https://www.motorsport.com/dtm/news/dtm-qualifying-norisring-1-pole-for-thiim-debacle-for-porsche-and-bmw/10836095/) |
| `F3_2026_6` | Race Voisin 2:05.770 (2024); documented Q Benavides 2:04.253 (2025) | Circuit / F3 Spa lap-record tables; FIA F3 timing |
| `FREC_2026_1`, `_3`–`_6` | Inaugural T-326 modern-era wording (как `_2`) | Серия / шасси T-326 — нет прежних FREC records на этой машине |
| `F4_IT_2026_2` | Race Fittipaldi 1:32.995 (2018, Vallelunga) | Circuit F4 lap-record tables |
| `F4_IT_2026_3` | Race Pradel 1:51.179 (2024, Monza) | [Monza circuit lap records / F4](https://en.wikipedia.org/wiki/Monza_Circuit) (сверять с Euro 4 / Italian F4 protocol) |
| `INDYCAR_2026_12` | Q Dixon 22.6952 / 206.211 mph (18 Jul 2003) | [Nashville Superspeedway Fast Facts](https://www.nashvillesuperspeedway.com/media/news/borchetta-bourbon-music-city-grand-prix-presented-willscot-fast-facts.html) |
| `SUPER_FORMULA_2026_6` | Course record Nojiri 1:19.972 (20 Dec 2020 Q) | [motorsport.com Fuji Q](https://www.motorsport.com/super-formula/news/fuji-qualifying-nojiri-yamamoto-cassidy/4929836/) |
| `ELMS_2026_3` | LMP2 Q Milesi 1:30.829; race Leclerc 1:31.757 (Jul 2024) | [ELMS Imola Facts and Figures](https://www.europeanlemansseries.com/en/news/imola-elms-facts-and-figures/13648) |
| `ELMS_2026_PROLOGUE` | Barcelona LMP2 best / race (de Gerus / Ugran) | ELMS Barcelona facts / Al Kamel timing |
| `WEC_2026_PROLOGUE` | Hypercar race Fuoco 1:31.794 (21 Apr 2024, Imola) | FIA WEC Imola timing / race reports |
| `GTWCE_END_2026_1` | Qualifying benchmark Gounon 1:52.671 (2019, Paul Ricard) | SRO / GTWCE timing archives (*benchmark*, не жёсткий «official record») |
| `GTWCE_END_2026_2` | GT3 Monza Pier Guidi 1:44.593 (2024) | SRO / GTWCE reports |
| `GTWCE_END_2026_3` | Spa 24h — no confirmed modern GT3 single-lap series record in pre-event materials | Явный skip / disclaimer в preview |
| `NASCAR_MODIFIED_2026_1` | Documented Q Hirschman 17.462 (Feb 2022, New Smyrna) | NWMT / SPEED SPORT reports |
| `NASCAR_MODIFIED_2026_4` | Oxford Plains 2026 — quali washed out; no published modern Tour Q record | NWMT race notes |
| `NASCAR_MODIFIED_2026_7` | Q Cravenho 11.739 / 102.121 mph (Jun 2000, Seekonk) | Track / NWMT historical notes |
| `NASCAR_MODIFIED_2026_8` | Documented Q Jake Johnson 13.57 (Jul 2022, Claremont) | NWMT reports |
| `NASCAR_MODIFIED_2026_9` | Documented Q Jake Johnson 11.537 / 78.01 mph (Jun 2025, White Mountain) | NWMT reports |
| `NASCAR_MODIFIED_2026_10` | Documented Q Hirschman 11.637 / 77.34 mph (May 4, 2024 Granite State Derby, repave); race lap not published | [myracenews Q](https://myracenews.com/2024/05/qualifying-results-granite-state-derby-at-monadnock-speedway/); The Third Turn 2024 GSD |
| `NASCAR_TRUCK_2026_2` | Q Crawford 30.339 / 182.735 mph (18 Mar 2005) — **pre-2022 Atlanta layout** | Racing-Reference / Jayski historical Atlanta Truck |
| `NASCAR_TRUCK_2026_15` | **Previous** Q Heim 20.072 / 112.096 mph (2023); Riggs 18.502 — рекорд **этого** уик-энда на новом покрытии | [tobychristie.com 2023 pole](https://tobychristie.com/nascar/truck-series/corey-heim-scores-second-consecutive-nascar-truck-pole-with-quick-lap-at-north-wilkesboro/); [SPEED SPORT 2026 pole](https://speedsport.com/nascar/nascar-craftsman-truck-series/riggs-claims-north-wilkesboro-pole/) |

При добавлении новых рекордов — **дописывать строку в эту таблицу** (или подсекцию по серии), чтобы следующий проход не начинал поиск с нуля.

---

## Сводная таблица различий

| Признак | Stock car | F1 | F2/F3 | IndyCar | IMSA | Supercars | Super Formula | Super GT | Endurance (WEC/ELMS/GTWCE) |
|---------|-----------|-----|-------|---------|------|-----------|---------------|----------|----------------------------|
| Entry list колонки | #, Driver, Team, Mfr, Crew Chief | #, Driver, Constructor, Chassis | #, Team, Driver | #, Driver, Team, Engine | #, Class, Team, Car, Drivers | #, Driver, Team, Mfr | #, Driver, Team, Engine | #, Class, Team, Make, Car, Drivers, Tire | #, Class, Team, Drivers, Car |
| Driver column в race | `Driver` (1) | `Driver` (1) | `Driver` (1) | `Driver` (1) | `Drivers` (multi) | `Driver` (1) | `Driver` (1) | `Drivers` (multi) | `Drivers` (multi) |
| Stage-таблицы | Да (stage_1, stage_2) | Нет | Нет | Нет | Нет | Нет | Нет | Нет | Нет |
| Sprint + Race | Нет | Да | Да (Sprint+Feature) | Нет | Нет | Да (Race 1–4, один JSON) | Да (2 гонки за уикенд) | Нет | Нет |
| Race фикс. ширины | Нет (auto) | Да (10 колонок) | Нет | Нет | Нет | Нет | Нет | Нет | Нет |
| Pit Stops чарт | Нет | Да | Нет | Нет | Нет | Нет | Нет | Нет | Нет |
| Caution Breakdown | Да (+Free Pass) | Нет | Нет | Да (−Free Pass) | Нет | Нет | Нет | Нет | Нет |
| Laps/Distance | Показан | Показан | Показан | Показан | Скрыт | Скрыт | Показан | Показан | Скрыт |
| POINTS колонка | Pts/Points | Points | Pts | Points | Points | Pts | Points | DP (driver) / TP (team) | Points / Cup pts / Overall pts |
| CLASS колонка | Нет | Нет | Нет | Нет | Да | Нет | Нет | Да (GT500 / GT300) | Да |
| Merged qual | Нет | Нет | Нет | Нет | Shoot Out | Shoot Out | Нет | Нет | Нет |
| Множество гонок/уик. | Нет | Sprint+Race | Sprint+Feature | Нет | Нет | Race 1-4 | Race 1-2 | Нет | Нет |
| Practice формат | Flat | sessions[] | Flat | Flat | Flat | Flat | Flat | sessions[] (per-class) | sessions[] |
| Auto-standings | ✅ flat (`race_order` из файла) | ✅ sprint-aware | ✅ flat | ✅ flat (`race_order` из файла) | ✅ per-class (events) | ✅ flat (events) | ✅ multi-race | ✅ flat (multi-driver) | ✅ per-class (events) |
| laps_led/best_laps | Нет | GP: в `race_results`; спринт: в `race.sessions[]` | Нет | Нет | Нет | Нет | Нет | Нет | Нет |

### Прочие серии (кратко)

| Серия | Entry / race | Auto-standings |
|-------|--------------|----------------|
| DTM | manufacturer + `race.sessions[]` ×2 | flat; `NOR1`/`NOR2`; Team Stats + `teams_championship`; manufacturers только в Stats API |
| FREC | как F2-style sessions | `R1-1`, `R1-2`, … |
| F4_IT | `practice.sessions[]` + `qualifying.sessions[]`; 4× `race.sessions[]` | по `#` машины |
| PSC | `race_results` | flat; `ineligible[]` для guests |
| GTWCE Sprint | `race.sessions[]` ×2 | per-class (`BuildGtwceStandingsFromEvents`) |
| WEC | `race_results` | per-class Hypercar + LMGT3 |
