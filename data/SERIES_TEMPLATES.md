# Series Rendering Templates

Справочник по структуре event-страниц для каждого типа серии.
Используется при создании/проверке JSON-файлов событий.

## Содержание

- [Чеклист](#правила-заполнения-event-json-чеклист) — общие правила заполнения
- [Превью на входе в уик-энд](#event_preview--состояние-на-входе-в-уик-энд) — что можно и нельзя писать в `event_preview`
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
- [Автоматическая сборка standings](#автоматическая-сборка-standings) ([The Chase](#the-chase-nascar-cup--noaps--truck)) и [Stats API](#stats-api)
- [`data/teams/*.json`](#datateamsjson) — роли файлов команд
- [Профиль пилота — вкладки](#профиль-пилота--вкладки-results--teams--achievements--titles)
- [Служебные файлы и скрипты](#служебные-файлы-и-скрипты)
- [Compact JSON (формат файла на диске)](#compact-json-формат-файла-на-диске)
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
5. **Не ломать схему** — не добавлять ключи `tables.sprint` / `tables.feature`, если серия использует `tables.race.sessions[]` (F2, F3, Super Formula, F1 sprint-уикенды 2024–2026). Super GT: не дробить квалификацию на `Qualifying 1`/`Qualifying 2` — одна таблица на класс с колонками `Q1`/`Q2`. WEC: гонка в `tables.race_results`, не `tables.race`.
6. **Очки** — колонка `Pts` в таблице гонки должна совпадать с официальным протоколом, включая бонусы (см. раздел серии).

### Общие правила (все серии)

| Поле | Правило |
|------|---------|
| **Формат файла на диске** | **Compact JSON** — см. [§ Compact JSON](#compact-json-формат-файла-на-диске). Табличные строки и `entry_list` — по одной строке; цель ~сотни строк на типичный этап, не тысячи. После правок: `node scripts/format-compact-json.mjs data/events/<Series>/<season>/<file>.json`. |
| `event_preview` | Только plain text, **без Markdown** (`**`, `#`, списков). Абзацы через `\n\n`. Текст = состояние **на входе в уик-энд** (не практика/квалификация/гонка этого этапа). Рекорды круга серии на трассе — финальный абзац EN+RU; правила: [Рекорды](#рекорды-круга-в-event_preview) и [превью](#event_preview--состояние-на-входе-в-уик-энд). |
| `event_preview_ru` | Добавлять, если есть английский preview. |
| `laps` | **Запланированное** число кругов (напр. `"175"`), не текст «200 laps», не овертайм/укороченная дистанция и не суффикс `*`. Фактически пройденные круги — только в таблицах гонки. |
| `distance` | **Запланированная** физическая дистанция — **не** дублировать lap count и **не** подставлять overtime miles. Формат зависит от серии: **F1 / F2 / F3 / openwheel (km)** — `"X.XXX km (Y.YYY miles)"` (§2); сток-кары — `"X mi (Y km)"` (§1); IndyCar — `"X.XXX miles (Y.YYY km)"` (§4). Не писать длину овала (`0.333 mile paved track …`). |
| `youtube_id` / `youtube_highlights` | Сток-кары и многие 2026-файлы: достаточно строки `"youtube_id": "…"`. Массив `youtube_highlights: [{ "id", "title" }]` тоже поддерживается (F1 и др.). |
| `entry_list` | Официальные полные имена **без латинской диакритики** (`Rafael Camara`, `Noel Leon`, `Niccolo Maccagnani`); то же для `event_preview` / мест (`Sao Paulo`, `Autodromo Jose Carlos Pace`). Кириллица в `event_preview_ru` сохраняется. `driver_slug` — ASCII-канон (`rafael-camara`). Nickname-дубли (Matt→Matthew, Cam→Cameron, …) — через `data/driver_slug_aliases.json`; после правок: `node scripts/fix-driver-slug-aliases.mjs` (или `--check` в CI). Массовая зачистка: `node scripts/strip-latin-diacritics.mjs`. Канон: всегда **Leland Honeyman** (без Jr.); slug `leland-honeyman` (алиас `leland-honeyman-jr`). |
| `driver_profiles` / `citizenship` | Страна **гоночной лицензии ≠ гражданство**. В `citizenship` только реальное гражданство/национальность; dual — только при подтверждённом гражданстве, не по FIA licence. |
| `track` / `circuit_name` vs `location` | `track` / `circuit_name` — название трассы (при необходимости суффикс лейаута, напр. `Charlotte Motor Speedway Roval`); `location` — только география (`City, State` / `City, Region`). Не дублировать город в имени трассы. Хелперы UI: `web/lib/schedule-location.js`. |
| Full Schedule (серия) | Унифицированная схема **A** в `web/pages/series.js`: всегда **Circuit** + **Location** (не класть `circuit_name` в колонку Location). Колонка **Race** — только multi-race уик-энды (сессия: Sprint / Race 1 / GP). Single-race: `Round · Event · Circuit · Location · Date · Time`. |
| Таблицы | У P1 в Gap и Int — `"—"`. DNF: `"Pos"` = `"DNF"`, `"Gap"` = `"DNF"`, `"Int"` = `"—"`. |
| Круговое время | Двоеточие между минутами и секундами, **не** апостроф протокола: `"1:45.891"`, не `"1'45.891"`. Обычно три знака после точки (`M:SS.sss`). **IndyCar** — четыре: `"00:57.6076"` / `"01:01.1020"` (`MM:SS.ssss`). Овалы сток-кар — часто только секунды (`"27.090"`). То же в `event_preview` (рекорды). |
| Колонки из протокола | Не переносить служебные колонки, которые сайт не рендерит (напр. **LAP SET ON** у F2). |
| Марка машины (`Car`) | Каноническое написание, а не капс протокола: `Oreca`, `Ligier`, `Aston Martin`, `Mercedes-AMG`, `McLaren`, `Chevrolet` (не `CORVETTE`). Серии, где `Car` — марка: ELMS, WEC, IMSA, GTWCE End/Sprint, Super GT, DTM (у сток-каров `Car` — номер). Проверка `node scripts/audit-car-makes.mjs`, применить `--write`, гейт CI `--check`. Новую марку сначала добавить в `scripts/lib/car-makes.mjs`. |
| P1 Gap / Int | У лидера строки в `Gap` / `Int` / `Interval` — всегда `"—"`, не `"-"` и не пустая ячейка. Проверка `node scripts/audit-p1-gap.mjs` (`--write` / `--check`). |
| Формат JSON | **Compact** для всего каталога `data/` (см. [§ Compact JSON](#compact-json-формат-файла-на-диске)). Не разворачивать ячейки таблиц построчно. После крупных правок: `node scripts/format-compact-json.mjs …`; опционально `node scripts/audit-compact-json.mjs` (legacy-таблицы вне `data/` не блокируют сайт). |
| Standings | Очки и позиции **не править** в `data/standings/*.json` — API пересобирает таблицу из `data/events/` при каждом запросе. Исключение: для stock-car и IndyCar в standings-файле поддерживать только `race_order` / `event_names` (коды колонок раундов). **The Chase** (Cup / NOAPS / Truck) тоже считается из events — не сидить поле вручную. |
| Event summary API | `GET /api/events/summaries` и `/api/events/{id}/summary` читают **те же** `tables.*`, что и страница этапа. Не изобретать отдельные layout’ы под Last Results — заполнять эталонные ключи серии. |

### `event_preview` — состояние на входе в уик-энд

Блок Overview на странице этапа показывает `event_preview` рядом с **запланированными** `laps` / `distance`. Превью не рекап уик-энда: результаты практики, квалификации и гонки живут в таблицах.

**Можно:** трасса и лейаут; **запланированные** круги и дистанция; чемпионат и форма *перед* этим этапом; победители прошлых лет / прошлых раундов; размер `entry_list` и гости (в т.ч. «N заявок на M мест»); рекорды серии на трассе **на входе** в уик-энд.

**Нельзя** (это появляется по ходу уик-энда — писать в таблицы, не в preview):

- поул, лучший круг практики, инциденты квалификации, отмена практики/квалификации, стартовая решётка «по rule book / owner's points»;
- победитель, подиум, стейджи, cautions, MOV, овертайм («extended to N laps»);
- фактически пройденные круги / мили вместо scheduled;
- DNQ как свершившийся факт («пятеро не прошли квалификацию») — допустима только формулировка из заявки («N на M мест»);
- рекорд, побитый **на этом же** этапе — оставлять предыдущий (см. [Рекорды](#рекорды-круга-в-event_preview)).

Исключение: если сам этап *состоит* в отмене гонки с переносом (напр. Super Formula Autopolis 2026), превью может объяснить календарный статус файла, без рекапа сессий.

**Full Schedule — колонки (схема A)**

| Режим | Колонки | Серии |
|-------|---------|--------|
| Multi-race | Round · **Race** · Event · Circuit · Location · Date · Time | F2, F3, FREC, F4_IT, DTM, GTWCE Sprint, Supercars, F1 2024/2025/2026 |
| Multi-race SF / PSC | **Round** · Event · Circuit · Location · Date · Time | Super Formula, PSC (номера этапов; double-header — несколько строк) |
| Single-race | Round · Event · Circuit · Location · Date · Time | ELMS, WEC, GTWCE End, Super GT, stock-car, IndyCar |
| IMSA | Round · Event · Length · Classes · Circuit · Location · Date | IMSA |
| Historical F1 | Round · Grand Prix · Circuit · Location · Date | `/season/f1-20xx` кроме live 2024/2025/2026 |

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
| **F2, F3, FREC, F4_IT** | Last Results: диапазон **дней гонок** (`Jul 4–5`), не practice/qual уик-энда. **Next Race: один день** ближайшей сессии | Sprint + Feature (или Race 1–3 у FREC) из event JSON / multi-race map | `start_date`–`end_date` в schedule может включать пятницу; карточка берёт даты из multi-race sessions. Full Schedule — **один** день сессии |
| **DTM, GTWCE Sprint** | Диапазон **дней гонок** | Race 1 / Race 2 из multi-race map / sessions | Не путать с Fri–Sun practice span в schedule |
| **F1** | Диапазон в sprint-уикенды | Sprint (сб) + GP (вс) — `static-schedules.js` `f1Sprint20xx` | Обычный уикенд — один день (воскресенье) |
| **Super Formula** | Диапазон уик-энда | Несколько гонок; **merge** карточек на главной | `SUPER_FORMULA_2026_6` (Fuji triple) — `race.sessions[]` в одном файле; Fuji Oct / Suzuka late — **отдельные** `event_id` (`_9`+`_10`, `_11`+`_12`) как Milwaukee |
| **Supercars** | Last Results: диапазон уик-энда, **merge** после **последней** гонки уик-энда | **Next Race: отдельная карточка на каждую гонку** (`Race 1`, `Race 2`, …) | В названии карточки — номер гонки из schedule; gate не показывает карточку после Race 1, пока не завершён финал уик-энда |
| **IMSA, WEC, ELMS, GTWCE End** | **Один день** — день гонки | В JSON уикенд может быть `start_date`–`end_date` | Не путать с диапазоном расписания |
| **PSC** | Обычный этап: **один день** гонки (`race_day_only`) | Double-header (Zandvoort): **один** файл `psc_2026_6` + `tables.race.sessions[]` (Race 1+2); карточка и расписание как Super Formula; `/event/psc-2026-7` → тот же уикенд | Multi-day `start_date`–`end_date` у support-уикенда (Hungaroring 24–26, Monza 4–6) **не** значит интервал на карточке; summary API и Last Results берут **день гонки** (`end_date`). Пока LIVE — только Next Race, не Last Results. |
| **IndyCar** | Обычно **один день** | Double-header (отдельные файлы Milwaukee `_16`+`_17`): **merge** Next Race и Last Results в одну карточку **Snap-on IndyCar Weekend**, даты **Aug 29–30**, победители **Race 1 + Race 2** (даже если один пилот) | `weekend-card-merge.js`; окно Last Results 7 дней считается от **последней** гонки блока (суббота не выпадает до merge); overview без Laps/Distance (`eventIsMultiRoundWeekend`) |
| **24h гонки** (Spa, Le Mans, …) | Два календарных дня | Из названия (`24 Hours`, `24h`) | Исключение из «один день» endurance |
| **Остальные** (Cup, Truck, …) | Один день | — | По `getEventRaceStartDateIso` |

**Multi-race weekends (общее правило):** все гонки уик-энда должны сохраняться и показываться на главной — как у Supercars / F4 / F2 (через `tables.race.sessions[]` в одном файле) или как у IndyCar Milwaukee / Super Formula Fuji Oct (отдельные `event_id` + merge в `weekend-card-merge.js`). Нельзя оставлять только воскресную гонку: Last Results ждёт финал блока, мержит карточки и держит окно 7 дней от последней гонки. Пока этап в окне LIVE (Next Race), он **не** дублируется в Last Results.

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
│   ├── Laps / Distance (скрыт у IMSA, WEC, ELMS, GTWCE End, Supercars, multi-round weekends, Milwaukee double-header)
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

Карточка Overview (FIELD / VALUE) читает верхнеуровневые `laps` и `distance`. Это **всегда запланированная** дистанция гонки, не overtime и не укороченный заезд.

| Поле | Правило |
|------|---------|
| `laps` | Только **scheduled** число кругов (`"175"`, `"200"`). Без суффикса `*` и без фактических кругов овертайма. |
| `distance` | Только **scheduled** физическая дистанция: **`"X mi (Y km)"`**. |
| `tables.race_results` / стейджи | Фактически пройденные круги, OT, shortened finish — **здесь**. Не копировать их в верхние `laps` / `distance`. |

Примеры (актуальный формат):

```json
"laps": "175",
"distance": "185.150 mi (297.970 km)"
```

```json
"laps": "200",
"distance": "137.2 mi (220.802 km)"
```

```json
// ❌ BAD — овертайм вместо scheduled (EJP 175 → 189 кругов)
"laps": "189",
"distance": "199.962 mi (321.808 km)"

// ❌ BAD — звёздочка «был OT»
"laps": "260*"

// ❌ BAD — длина овала + «paved track», без km
"distance": "0.333 mile paved track (49.950 miles)"

// ❌ BAD — дублирует lap count
"distance": "150 laps, 49.950 mi (80.387 km)"
```

Длина овала (0.333 / 0.625 mi и т.п.) относится к описанию трассы в `event_preview`, не в поле `distance`. То же правило для **Cup / NOAPS / Truck / Modified / ARCA**. `stage1_laps` / `stage2_laps` / `stage3_laps` — как в протоколе стейджей (стейдж 3 может быть длиннее scheduled из‑за OT); на Overview это не влияет.

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

**race_statistics** — key-value объект на верхнем уровне JSON (не внутри `tables`). Эталон заполненного этапа: `nascar_cup_2026_19.json` / `nascar_cup_2026_20.json`.

| Ключ | Обязательность | Формат / пример |
|------|----------------|-----------------|
| `Average speed` | да (если есть в протоколе) | `"127.422 mph (205.065 km/h)"` |
| `Cautions / Laps` | да | `"5 for 27"` |
| `Lead changes` | да | `"15"` или `"28 among 13 different drivers"` |
| `Time of race` | да | `"3 hours, 8 minutes and 21 seconds"` |
| `Margin of victory` | **да, если есть в протоколе** | `"0.287 sec"` (не отбрасывать как «лишнее») |
| `Red flags` | если известно | `"0"` или `"1 for 3 hours, 9 minutes and 18 seconds"` |

Не класть в `race_statistics`: Pole speed, Attendance / n/a и прочий шум протокола, которого нет в эталонах. **MOV (`Margin of victory`) — не шум**, его нужно сохранять вместе с остальными stats.

**starting_lineup** — **не используется** (удалён из всех файлов).

### The Chase (Cup / NOAPS / Truck)

ARCA и Modified — обычный сезон без плей-офф. Cup, NOAPS и Truck после финала регулярки переходят в **The Chase**; сборщик standings делает это сам, как только заполнен `tables.race_results` финала.

| | Cup | NOAPS | Truck |
|--|-----|-------|-------|
| Финал регулярки | Daytona, гонка 26 (`NASCAR_CUP_2026_26`) | Daytona, гонка 24 (`NOAPS_2026_24`) | Loudon, гонка 18 (`NASCAR_TRUCK_2026_18`) |
| Поле | 16 | 12 | 10 |
| Гонки Chase | 10 | 9 | 7 |
| Баннер Full Schedule | перед гонкой 27 | перед гонкой 25 (`i === 24`) | перед гонкой 19 (`i === 18`) |

Формат 2026 ([NASCAR.com](https://www.nascar.com/news-media/2026/08/31/the-chase-101-how-nascars-new-championship-format-works/)): отбор **только по очкам** регулярки (win-and-you're-in нет). Один сброс: 1-е место **2100**, 2-е **2075**, 3-е **2065**, далее −5 до 16-го = **2000** (NOAPS обрезается на 12-м = 2020, Truck на 10-м = 2030). Вылетов и Championship 4 нет — все участники Chase остаются до Homestead. Playoff points нет. Победа в гонке = **55** очков (2-е и ниже без изменений: 35, 34, …); стейджи как раньше. `(i)` / `points_eligible: false` в Chase не входят.

Полные правила, поля API и что **не** трогать — [The Chase](#the-chase-nascar-cup--noaps--truck) в разделе авто-сборки standings.

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
    "Average speed": "… mph (… km/h)",
    "Cautions / Laps": "… for …",
    "Lead changes": "…",
    "Red flags": "…",
    "Time of race": "… hours, … minutes and … seconds",
    "Margin of victory": "0.287 sec"
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
**Live-сезоны на сайте:** `/season/f1-2024`, `/season/f1-2025`, `/season/f1-2026` (текущий по умолчанию — `config.CurrentSeason` = 2026). Исторические чемпионы — `/series/f1/history`.

### Entry List

| # | Driver | Constructor | Chassis |
|---|--------|-------------|---------|

- Rowspan на Constructor + Chassis (гонщики одной команды объединяются)
- `manufacturer` в `entry_list` — код шасси (напр. `MCL39`, `RB21`, `RB20`)
- `entry_list` содержит поля: `number`, `driver`, `team`, `constructor`, `manufacturer` (chassis), `power_unit`, `driver_slug`
- Страница Teams для сезона (`/season/f1-20xx/teams`) при пустом `data/teams/f1_20xx.json` **собирается из `entry_list`** всех этапов: Constructor ← `constructor`, Chassis ← `manufacturer`, Power unit ← `power_unit`, Rounds — по участию

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

### Очки в колонке `Pts` (F1 2024–2026)

Очки пишутся в колонку **`Pts` / `Points`** таблицы GP (`race_results`) и спринта (`tables.race.sessions[]`). Standings API **суммирует эти значения** (спринт + GP) — неверная цифра в JSON ломает чемпионат.

**Grand Prix** — топ-10 классифицированных:

| Pos | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|-----|---|---|---|---|---|---|---|---|---|----|
| Очки | 25 | 18 | 15 | 12 | 10 | 8 | 6 | 4 | 2 | 1 |

- **2024–2025:** дополнительно **+1 FL**, только если автор лучшего круга **финишировал в топ-10**. Пример: P1 + FL → `26`; P10 + FL → `2`; P11 + FL → `0`.
- **2026:** бонуса за fastest lap **нет** — в `Pts` только очки за финиш (P1 = `25` даже с лучшим кругом).

**Sprint** — топ-8 классифицированных (без бонуса за FL во всех сезонах):

| Pos | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|-----|---|---|---|---|---|---|---|---|
| Очки | 8 | 7 | 6 | 5 | 4 | 3 | 2 | 1 |

**Тай-брейк чемпионата** (при равных очках): больше побед в GP → больше 2-х мест → 3-х → … (countback). На сайте порядок при равенстве очков следует этой логике, если она реализована в standings; иначе сверять с официальным протоколом.

**Спринт-уикенды** (`f1Sprint20xx` в `static-schedules.js`):

| Сезон | Этапы (sprint) |
|-------|----------------|
| 2024 | China, Miami, Austria, United States, Sao Paulo, Qatar |
| 2025 | China, Miami, Belgium, United States, Sao Paulo, Qatar |
| 2026 | China, Miami, Canada, Great Britain, Netherlands, Singapore |

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
  "distance": "307.471 km (190.908 miles)",
  "event_preview": "...",
  "event_preview_ru": "...",
  "tyre_compounds": "Hard: C2, Medium: C3, Soft: C4",
  "youtube_id": "...",
  "youtube_highlights": [
    {"id": "...", "title": "Race highlights"}
  ],
  "entry_list": [
    {"number": "1", "driver": "Max Verstappen", "team": "Oracle Red Bull Racing", "constructor": "Red Bull Racing-Honda RBPT", "manufacturer": "RB20", "power_unit": "Honda RBPTH002", "driver_slug": "max-verstappen"}
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

### Overview: `laps` и `distance`

Страница этапа (вкладка Overview) показывает **верхнеуровневые** `laps` и `distance` рядом с `event_preview` (`web/pages/event.js`). Это **всегда запланированная** дистанция гонки (FIA Event Notes / formula1.com → Circuit → Race Distance), **не** «сколько кругов проехал победитель», если протокол совпал случайно.

| Поле | Правило |
|------|---------|
| `laps` | Scheduled число кругов гонки (напр. `"57"` для Madring 2026). |
| `distance` | `"308.524 km (191.708 miles)"` — km первым, miles в скобках, три знака после точки как в заполненных `f1_2026_*.json`. |

При внесении **только** practice / qualifying / race из PDF всё равно добавить `laps` + `distance` из календаря — иначе на Overview останется одна строка «Laps». Эталон: `f1_2026_13.json`, `f1_2026_14.json`.

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
- **Time** — `MM:SS.ssss` (четыре знака после точки), двоеточие: `"01:01.1020"`, `"00:57.6076"`. Не апостроф `1'01.1020`.
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
- **Double-header** (напр. Milwaukee): **два** event JSON / два `event_id` в schedule, у каждого свой `race_results` — не `tables.race.sessions[]`. Weekend title (`race` / schedule `name`) — **Snap-on IndyCar Weekend**; официальные имена гонок — в `tables.race_results.title`. Карточки на главной merge’ят уик-энд с интервалом дат и **обоими** победителями Race 1 / Race 2 (см. чеклист «Даты на карточках» — multi-race weekends). Overview не показывает Laps/Distance.

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
**Эталон 2026:** `imsa_2026_9.json` (VIR, включая BoP) или последний заполненный раунд

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
- **BoP** — вкладка `/event/{id}/bop`, когда в JSON есть верхнеуровневый объект `bop` (не только раунды 1–2). Рендер: `web/lib/event-bop.js`. Эталон структуры: `imsa_2026_9.json` (`vehicles[]`, `regulatory_params`, `notes`).
- **race_statistics** — не используется

---

## 6. Supercars

**Категория:** `touring`  
**Series ID:** `supercars`  
**Путь:** `data/events/Supercars/<year>/supercars_<year>_<round>.json`

**Один JSON = один championship round** (напр. `SUPERCARS_2026_5`). Несколько гонок уик-энда (`Race 1`, `Race 2`, иногда `Race 3`) живут в **`tables.race.sessions[]`** одного файла — не создавать отдельный event-файл на каждую гонку. На главной Next Race — **отдельная карточка на каждую сессию**; Last Results — merge уик-энда (см. чеклист «Даты на карточках»).

### Entry List

Sprint weekends:

| # | Driver | Team | Manufacturer |
|---|--------|------|-------------|

Enduro Cup (`co_driver` in JSON — The Bend 500, Bathurst 1000, and later two-driver rounds):

| # | Driver | Co-driver | Team | Manufacturer |
|---|--------|-----------|------|-------------|

- Поля: `driver` + `driver_slug`, `co_driver` + `co_driver_slug` (только на двухпилотных этапах).
- Колонка Co-driver на сайте появляется **только если** хотя бы у одной машины заполнен `co_driver`.
- Rowspan на Team + Manufacturer
- Не класть сопилота в `driver1`/`driver2` — это разворачивается в substitute-строки, а не в колонку Co-driver.

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

Два паттерна (не смешивать без нужды):

1. **Один event-файл** с `race.sessions[]` (Motegi double-header, Fuji triple `SUPER_FORMULA_2026_6`):

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

2. **Отдельные `event_id` на гонку** (Fuji Oct `_9`/`_10`, Suzuka `_11`/`_12`) — как IndyCar Milwaukee: один день / один файл; на главной Last Results **merge** через `weekend-card-merge.js`.

---

## 8. Super GT

**Категория:** `touring`  
**Series ID:** `super_gt`  
**Эталон 2026:** `super_gt_2026_5.json` (Suzuka) — полный уик-энд: practice, combined Q1/Q2, race.

### Entry List

| # | Class | Team | Make | Car | Drivers | Tire |
|---|-------|------|------|-----|---------|------|

JSON-поля: `number`, `class` (`GT500` / `GT300`), `team`, `make`, `car`, `driver1`, `driver2`, `tire`.

- Оба класса в одном `entry_list`; сайт рисует разделитель между классами.
- В таблицах практики / квалификации / гонки колонка `Drivers` — несколько пилотов через `; `.

### Practice

`tables.practice.sessions[]` — **одна сессия на класс** (`title`: `GT500` / `GT300`):

| Pos | No. | Team | Drivers | Best lap | Gap | Laps | Tire |
|-----|-----|------|---------|----------|-----|------|------|

### Qualifying

Q1 и Q2 — **сегменты одной нокаут-квалификации** (как Q1/Q2/Q3 у F1), не две отдельные сессии и не четыре таблицы. Поул и **+1 DP** — **P1 в Q2** (не лидер Q1).

Одна таблица на класс (`qualifying.sessions[]` с `class`: `GT500` / `GT300`):

| Pos | No. | Team | Drivers | Tire | Q1 | Q2 |
|-----|-----|------|---------|------|----|----|

```json
"qualifying": {
  "title": "Qualifying",
  "sessions": [
    { "class": "GT500", "title": "Qualifying", "headers": ["Pos","No.","Team","Drivers","Tire","Q1","Q2"], "rows": [] },
    { "class": "GT300", "title": "Qualifying", "headers": ["Pos","No.","Team","Drivers","Tire","Q1","Q2"], "rows": [] }
  ]
}
```

- Порядок строк = стартовая решётка. Пустой `Q2` у машин, не прошедших из Q1 (`GT500` P11+, `GT300` P19+).
- Времена Q1/Q2: `"1:45.129"` (двоеточие), не `"1'45.129"` из японского протокола.
- **GT500:** все в Q1, топ-10 в Q2.
- **GT300:** Q1 группами A/B, топ-9 из каждой группы в Q2 (18 машин). Группы A/B **не** хранить отдельными сессиями — лучший круг группы идёт в колонку `Q1`.
- UI: одна таблица на класс (класс `super-gt-qual-table`); пустой Q2 — строка `qual-row-q1-out` (приглушённая ячейка). Заливку «дошедших до Q2» не ставить.
- **Stats / поулы:** `BuildDriverStatsFromEvents` берёт поул как Q2 P1 в каждом классе (`statsSuperGTQualStartByCar`). Лидер Q1 поул **не** получает.

### Race

Один проход, оба класса в одной flat-таблице `tables.race` (`headers` + `rows`, **не** `sessions[]`):

| Pos. | Class | Car | No. | Team | Drivers | Laps | Gap | Interval | Avg. (km/h) | Time of the day | DP | TP |
|------|-------|-----|-----|------|---------|------|-----|----------|-------------|-----------------|----|----|

- **DP** — очки пилотам (standings читает `DP`).
- **TP** — очки команде (не источник drivers standings).
- `Drivers` через `; ` — сборщик разбивает экипаж на отдельных пилотов.

### Очки (2026)

**GT500 DP** (P1–P10) + **+1** поул (только в `DP`, не в `TP`):

| Pos | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|-----|--:|--:|--:|--:|--:|--:|--:|--:|--:|---:|
| DP  | 20 | 15 | 11 | 8 | 6 | 5 | 4 | 3 | 2 | 1 |

**GT300 DP** (P1–P15) + **+1** поул в `DP`:

| Pos | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
|-----|--:|--:|--:|--:|--:|--:|--:|--:|--:|---:|---:|---:|---:|---:|---:|
| DP  | 25 | 20 | 16 | 13 | 11 | 10 | 9 | 8 | 7 | 6 | 5 | 4 | 3 | 2 | 1 |

**TP** = финишные очки класса **без** поула, плюс бонус за отставание от лидера класса:

| Отставание | TP-бонус |
|------------|----------|
| Круг лидера (lead lap) | +3 |
| −1 круг | +2 |
| −2 круга и более | +1 |

Пример Suzuka 2026: GT500 P1 → `DP` 20 / `TP` 23; GT500 поул + P2 → `DP` 16 (15+1) / `TP` 18 (15+3); GT300 поул + P1 → `DP` 26 / `TP` 28.

### Standings (UI)

API отдаёт **flat** `rows[]` (`BuildStandingsFromEvents`). Страница серии (`web/pages/series.js`) **режет** таблицу на GT500 / GT300 по классу машины из event JSON.

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
- **ELMS UI:** таблица гонки — класс `elms-race-results-table` (по ширине контента, слева под Race / Results, как у других серий). Колонка `Class` в JSON нужна для standings и Last Results; **не** красить строки / текст класса цветами LMP2/LMP3/LMGT3.
- **24 Hours of Spa** (`GTWCE_END`, CrowdStrike 24 Hours of Spa): на карточке Last Results показываются **5** классовых победителей — Overall, Gold, Silver, Bronze и **Pro-Am** (класс в протоколе часто `Pro-AM Cup`). Остальные этапы GTWCE Endurance — 4 строки.
- Сборщик standings автоматически разбивает `Drivers` по `;` / `/` и начисляет очки каждому пилоту из колонки `Points` (или `DP` для Super GT).
- Эталон ELMS 2026: `elms_2026_4.json` (Spa 4 Hours).

#### GTWCE Endurance — очки Main Race (Monza / Nürburgring / Portimão)

3-часовые этапы: топ-10 = **25 / 18 / 15 / 12 / 10 / 8 / 6 / 4 / 2 / 1** + **+1 за поул**. Писать в колонки `Cup pts` / `Overall pts` (отдельную таблицу очков в event JSON не класть).

| Колонка | Начисление | Поул (+1) |
|---------|------------|-----------|
| **Overall pts** | Абсолютный топ-10 | P1 Qualifying Combined |
| **Cup pts** (Gold / Silver / Bronze) | Топ-10 **в классе** | Первый в классе в Qualifying Combined |
| **Cup pts** (Pro) | Как overall finish points (не отдельная Pro-шкала); class-pole на Cup нет | Overall-поул только в **Overall pts** |

Paul Ricard (6 Hours) и Spa 24H — другие шкалы / checkpoint-колонки; копировать с заполненного этапа того же формата. Подробнее: `gtwce-end-event-json.mdc`.

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
- Времена круга: `"1:21.456"`, не `"1'21.456"`.
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
| Qualifying (double-header) | **`qualifying.sessions[]`** | Zandvoort: одна сессия даёт две решётки — лучший круг → Race 1, второй по времени → Race 2. Две session-таблицы (`Qualifying — Race 1` / `Qualifying — Race 2`) мапятся 1:1 на `race.sessions[]` (поулы в stats). Гридовые штрафы — в `qualifying.note` |
| Race | **`race_results`** | одна гонка за F1 support round |
| Race (double-header) | **`tables.race.sessions[]`** | Zandvoort: Race 1 + Race 2 **в одном** `event_id` (`PSC_2026_6`); не создавать `PSC_2026_7` |

- Entry: `number`, `driver`, `team`, `driver_slug`; **`guest": true`** → `ineligible[]` в standings.
- Обычный этап = один `event_id` и **день гонки** на карточке (не `start_date`–`end_date` уик-энда F1). Double-header (Zandvoort) — один weekend-файл, как Super Formula Suzuka; Full Schedule группирует по трассе; `/event/psc-2026-7` ремапится на `psc_2026_6`.
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
- **Очки Sprint Cup** (Race 1 и Race 2 одинаково): top 10 = `16.5 / 12 / 9.5 / 7.5 / 6 / 4 / 3 / 2 / 1 / 0.5` + **+1 за поул**. `Overall pts` — абсолют; `Cup pts` — класс; поул из Qualifying Combined (Q1→R1, Q2→R2). Подробнее: `gtwce-sprint-event-json.mdc`.
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
| IndyCar / WEC | `tables.race_results` |
| PSC | `tables.race_results`; double-header (Zandvoort) — `tables.race.sessions[]` |
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
| F1 (2024+) | Для спринт-уикенда race_order расширяется на `RnS` / `RnF`; сессия `Sprint` и основная гонка раскладываются в отдельные колонки. `Carlos Sainz` нормализуется в `Carlos Sainz Jr.` |
| Super Formula | `race.sessions[]` разворачивается в отдельные колонки race_order по порядку (`R1`, `R2`, …). Поддержка дробных очков; бонус за квалификацию (3/2/1). |
| Super GT | Колонка `Drivers` разбивается по `;` / `/`; очки из `DP`. API — flat `rows[]` (`BuildStandingsFromEvents`); UI серии режет на GT500 / GT300. Поул в stats = Q2 P1 класса, не лидер Q1. |
| WEC / ELMS / GTWCE | Per-class через отдельные сборщики (см. выше); multi-driver entries; WEC — только Hypercar и LMGT3 в зачёте. |
| IndyCar | Производитель берётся из `data/teams/indycar.json` по номеру машины (в результатах его нет). `race_order` — из `data/standings/indycar.json`. |
| Supercars | `race_order` и очки только из events (коды `SMP1`, `MLB4`, …); snapshot `supercars.json` API не использует. |
| DTM | Drivers standings из `tables.race.sessions[]`; `race_order` — `NOR1`/`NOR2`, `RBR1`/`RBR2`, … **Team Stats** (не drivers championship): Mann-Filter + Ravenol → `Winward Racing` через `teams_championship` в `data/teams/dtm.json`. |
| FREC | `tables.race.sessions[]` → колонки `R1-1`, `R1-2`, … (по числу гонок в раунде). |
| F4_IT | Как FREC; одна строка standings на номер машины (`#10`), даже если пилоты разные в heat-группах. |
| PSC | Гостевые заезды (`guest` в entry list) попадают в отдельную таблицу `ineligible`. Double-header (Zandvoort) даёт две колонки `R6`/`R7` из `tables.race.sessions[]` одного файла. |
| NASCAR Cup / Xfinity / Truck / ARCA / Modified | Очки стейджей (`stage_1`, `stage_2`; для Cup также `stage_3` на 4-stage гонках вроде Coca-Cola 600 и очки Daytona Duels) попадают в колонку `Stages`. DNQ из таблицы `did_not_qualify` создают отдельные строки со статусом `DNQ`. Для NASCAR Cup события `..._0` (Clash) исключаются из зачёта. `NC` в колонке Pos отображается как индекс строки. `race_order` — из standings-файла серии. |
| NOAPS / Modified / ARCA | Эксклюзивно поддерживается fallback на `tables.stage3` как источник финишной таблицы. |

### The Chase (NASCAR Cup / NOAPS / Truck)

Код: `internal/schedulefile/standings_chase.go` (вызывается из `BuildStandingsFromEvents`). Конфиг зашит в `stockCarChaseConfig`. **Stats API** (`/stats`) Chase **не** применяет: там сумма weekend `Pts` за сезон, без сброса.

Chase **включается сам**, когда в `completed_races` есть все коды регулярки (`race_order[0 .. N-1]`). Пустой `race_results` у финала = регулярка ещё идёт (линия отсечения 16 / 12 / 10).

| Серия | Регулярка | Поле Chase | Финал регулярки 2026 |
|-------|-----------|------------|----------------------|
| `NASCAR_CUP` | 26 гонок | 16, затем 10 гонок без вылетов | Coke Zero Sugar 400, Daytona (`DAY2`) |
| `NOAPS` | 24 гонки | 12, затем 9 гонок без вылетов | Winn-Dixie 250, Daytona (`DAY2`) |
| `NASCAR_TRUCK` | 18 гонок | 10, затем 7 гонок без вылетов | EJP 175, Loudon (`NHA`) |

Отбор: топ поля по очкам регулярки (тай-брейк — победы, затем имя). Победы в регулярке **не** дают место в Chase.

**Сиды** (один сброс, [NASCAR.com Chase 101](https://www.nascar.com/news-media/2026/08/31/the-chase-101-how-nascars-new-championship-format-works/)):

1st 2100, 2nd 2075, 3rd 2065, далее −5: 2060 … 2000 (16th). NOAPS — первые 12, Truck — первые 10.

Дальше к сиду прибавляются weekend `Pts` гонок Chase. Не попавшие в Chase остаются на сумме регулярки + последующие гонки (без 2100). Колонка `playoff_points` / «PO Pts» в 2026 не заполняется. Победа в гонке = **55** очков; остальные позиции и стейджи без изменений.

Объект ответа `chase`:

| Поле | Смысл |
|------|--------|
| `active` | `true`, когда регулярка закрыта |
| `round` | `regular_season` или `the_chase` |
| `field_size` | размер поля Chase (16 / 12 / 10) |
| `cutline` | последняя позиция внутри поля (пунктир над `cutline+1`) |
| `regular_season_races` | индекс первой колонки Chase в `race_order` |

На строке: `chase_status: "in"` у участников поля. Не писать эти поля в `data/standings/*.json`.

Тесты: `internal/schedulefile/standings_chase_test.go`. После заполнения Daytona NOAPS / Loudon Truck таблица должна показать 2100 / 2075 / 2065 у топ-3.

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

**Stock-car:** team names в stats канонизируются через `data/teams/{series}.json` (варианты написания → одно имя). **The Chase не применяется** — `points` в stats = сумма weekend `Pts` за сезон, без сброса 2100. Чемпионат смотреть в standings.

**IndyCar:** manufacturer в race tables отсутствует — подставляется из `data/teams/indycar.json` по номеру.

**Supercars:** manufacturer в stats дополняется из `data/teams/supercars.json` по `#`.

**F1:** chassis/manufacturer из `data/teams/f1.json`; Q2/Q3 passes из qualifying tables.

**Super GT:** поул в driver stats — P1 колонки **Q2** каждой классовой таблицы (`qualifying.sessions[]` с заголовками `Q1`/`Q2`). Лидер Q1, не прошедший в Q2 первым, поул не получает.

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

## Профиль пилота — вкладки Results / Teams / Achievements / Titles

На `/driver/{slug}` под шапкой профиля — четыре вкладки (`web/pages/driver.js`).

| Вкладка | Данные | Источник |
|---------|--------|----------|
| **Results** | Таблица гонок, переключатель сезонов | `career_results` из event JSON (все сезоны в `data/events/`) |
| **Teams** | История команд: годы, интервал при нескольких сезонах подряд в одной команде | `team_history` из тех же event JSON; разрыв года или смена команды — новый отрезок. Пустой Team в race-строке заполняется из `entry_list` того же события (`team`, иначе `constructor`). Старты считаются только по race/sprint, не по placeholder «Entry list». F1 commercial names (Scuderia Ferrari HP, Mercedes-AMG Petronas) сворачиваются к конструктору |
| **Achievements** | Победы в знаковых гонках (Daytona 500, Monaco GP, Indy 500, Le Mans, Bathurst 1000, …) | P1 (для IMSA/WEC — класс P1) в событии, которое матчится по `data/crown_jewels.json` |
| **Titles** | Чемпионские титулы | сейчас F1 1950–present из `data/f1_seasons_history.json` → `driver_champion` |

Каталог знаковых гонок — `data/crown_jewels.json` (`name_any` / `track_any` / `name_exclude` + `series_ids`). Не записывать эти победы в `event_preview`. Если пилот выиграл Monaco GP + Indy 500 + 24 Hours of Le Mans, API добавляет карточку Triple Crown of Motorsport.

API: `GET /api/driver/{slug}` поля `season_results`, `career_results`, `available_seasons`, `team_history`, `achievements`, `titles`. UI: `#results` / `#teams` / `#achievements` / `#titles`.

---

## Профиль команды — канон organization / entrant

На `/team/{slug}` — один профиль на **гоночную организацию** (не марку и не юрлицо из реестра). Factory vs customer под одной маркой — **разные** каноны. Одна org в нескольких сериях или с несколькими машинами/классами — **один** канон; FT/PT — атрибут строки roster.

| Файл | Роль |
|------|------|
| `data/team_profiles.json` | Канон: `kind`, `canonical_name`, `series_ids`, `display_name_by_season` (`series\|year`); опционально org-meta: `founded`, `headquarters`, `owner`, `president`, `team_principal`, `staff[]` (`name`/`role`/`group`) (ASCII; пропускать, если неизвестно). Staff: `node scripts/sync-team-staff.mjs` (baseline из leadership + curated overrides) → `apply-team-org-metadata.mjs` |
| `data/team_slug_aliases.json` / `team_profile_redirects.json` | Resolve сырых имён → канон |

**Важно:** aliases строятся из **всех** различных `entry_list.team` / `constructor` по events (скрипт `node scripts/build-team-canon.mjs`), а не только из `display_name_by_season`. Display-имя — только UI шапки/блока сезона (гранулярность = сезон). Rebuild **сохраняет** curated org-meta на существующих slug.

API: `GET /api/team/{slug}`, `GET /api/team-profile-redirects`. UI шапки: Founded / Headquarters / Owner / President / Team principal (как Born у пилота). Cursor: `.cursor/rules/team-profile.mdc`.

---

## Compact JSON (формат файла на диске)

Смысл данных для сайта **не меняется** — меняется только переносы строк в файле. Парсер JSON одинаково читает «развёрнутый» и compact вид.

### Зачем

- Типичный заполненный этап: **~300–800 строк**, а не 2000–4000 (длинные `event_preview` и endurance-сессии — норма).
- Проще ревью в git и правки в Cursor: одна строка = одна строка таблицы или одна машина в `entry_list`.
- Эталон после compact: `data/events/NASCAR Cup Series/2026/nascar_cup_2026_28.json`, `data/events/ELMS/2026/elms_2026_5.json`, `data/events/F1/2026/f1_2026_14.json`.
- Каталог **`data/`** (все event JSON, profiles, schedules, …) хранится в compact-виде. JSON **вне** `data/` (fixtures, служебные отчёты) compact не обязателен.

### Правила разметки

| Блок | Как писать |
|------|------------|
| Метаданные (`event_id`, `date`, `laps`, …) | Обычный отступ 2 пробела, **один ключ на строку** |
| `event_preview` / `event_preview_ru` | Одна JSON-строка на ключ (с `\n` внутри текста) |
| `headers` | Одна строка: `["Pos", "#", "Driver", …]` |
| `tables.*.rows` и любые табличные массивы массивов | **Одна строка результата = одна строка файла**: `["1", "22", "Joey Logano", …],` |
| `entry_list`, `youtube_highlights`, массивы однотипных объектов | **Один объект = одна строка** (через `JSON.stringify` объекта) |
| `tables.race.sessions[]` | Объект сессии с отступом; внутри — compact `rows` |
| Вложенные «плоские» объекты (профиль пилота, мелкий meta) | Одна строка, если все значения — строки/числа/пустые массивы |

### Не делать

- Не разворачивать каждую ячейку таблицы на отдельную строку (старый pretty-print).
- Не minify весь файл в одну строку — файл должен оставаться diff-friendly.

### Команда

```bash
node scripts/format-compact-json.mjs data/events/F1/2026/f1_2026_14.json
node scripts/format-compact-json.mjs data/events
node scripts/format-compact-json.mjs data
make format-data   # то же для всего data/
node scripts/audit-compact-json.mjs   # parse + эвристика legacy table rows (stdout JSON)
```

Правило Cursor: `.cursor/rules/event-json-format.mdc`.

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
| `node scripts/format-compact-json.mjs [paths…]` | Привести JSON к **compact**-виду (табличные `rows`, `entry_list`, мелкие объекты — по строке). Без аргументов — весь каталог `data/`. |
| `node scripts/audit-compact-json.mjs` | Аудит: все `.json` в репо, parse errors, legacy multi-line table rows, статистика по длине файлов. |
| `node scripts/fix-driver-slug-aliases.mjs` | Канонизация nickname-slug (`--check` в `make ci-data-audits`); правит events / profiles / redirects |
| `node scripts/sync-driver-profiles-from-events.mjs` | Синк профилей из entry_list (учитывает aliases) |
| `node scripts/audit-card-dates.mjs` | Аудит дат на карточках Next Race / Last Results |

Правила часовых поясов: `data/timezones-reference.json`, `data/TIMEZONES.md`.

---

## Рекорды круга в `event_preview`

Абзац(ы) про рекорд **серии на этой трассе** — в конце `event_preview` / `event_preview_ru` (plain text, `\n\n`, без Markdown). Не абсолют трассы и не чужой чемпионат.

### Правила заполнения

1. Рекорд = **конкретный чемпионат + конкретная трасса** (и класс, если мультикласс).
2. Если лучший круг / поул **побит на этом же ивенте** — в preview писать **предыдущий** рекорд (состояние «на входе в уик-энд»). Не писать «set at this 2026 meeting».
3. Нет надёжного источника → **не выдумывать**. Допустимы формулировки *fastest documented* / *qualifying benchmark* / *inaugural T-326 era*, если официального «all-time record» нет.
4. Inaugural / смена шасси (FREC T-326) / первый визит серии — явная фраза, что рекорды будут установлены впервые.
5. EN и RU зеркалят; имена пилотов латиницей в обоих языках.
6. Время круга в preview — как в таблицах: `"1:43.143"`, не `"1'43.143"`.

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
| `SUPERCARS_2026_8` | Lap McLaughlin 52.8141 (2019); R Courtney 53.7293 (2019) | [supercars.com Perth](https://www.supercars.com/events/2026-perth); [Wikipedia Wanneroo Raceway](https://en.wikipedia.org/wiki/Wanneroo_Raceway) |
| `SUPERCARS_2026_9` | **Previous** Q Feeney 1:08.1301 (2025); R Feeney 1:09.2638 (2025) — Payne 1:08.0105 Q и Feeney 1:09.2277 R сбиты на Ipswich 2026 | [Speedcafe 2025 Ipswich Q](https://speedcafe.com/supercars-news-saturday-race-1-qualifying-results-broc-feeney-pole-position/); [supercars.com QR Gen3 race record](https://www.supercars.com/circuit/queensland-raceway); [V8 Sleuth 2026 Q](https://www.v8sleuth.com.au/payne-nails-qr-gen3-record-as-brown-murray-shine/); [Wikipedia Queensland Raceway](https://en.wikipedia.org/wiki/Queensland_Raceway) |
| `GTWCE_SPRINT_2026_3` | Q Marciello 1:35.444 (2022); R Marciello 1:36.500 (2022) | [SRO Magny-Cours Q2 2022](https://www.gt-world-challenge-europe.com/news/2305/marciello-leads-goetz-as-akkodis-asp-mercedes-amg-secures-front-row-lockout-at-magny-cours); [Racing Sports Cars Magny-Cours 2022](https://www.racingsportscars.com/results/laps/Magny-Cours-2022-05-15.html); [SRO top-five Magny-Cours](https://www.gt-world-challenge-europe.com/news/3279/the-top-five-gt-world-challenge-races-at-magny-cours) |
| `SUPER_GT_2026_4` | Q GT500 Yamashita 1:25.764 (2021); Q GT300 Yamauchi 1:34.395 (2021) | [supergt.net Fuji track records](https://supergt.net/en/news_race_report/%E3%80%90%E7%AC%AC4%E6%88%A6%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%80%91%E5%AF%8C%E5%A3%AB%E3%81%A7%E3%81%AE%E6%96%B0%E3%81%9F%E3%81%AA%E3%82%B9%E3%83%97%E3%83%AA%E3%83%B3%E3%83%88%E3%83%AC); [Racing Sports Cars Fuji 2021 Q](https://www.racingsportscars.com/results/qualifying/Fuji-2021-11-28.html) |
| `IMSA_2026_8` | Q GTP Derani 1:47.730 (2023); LMP2 Hanley 1:51.846 (2023); GTD Pro Catsburg 2:02.198 (2024); GTD Snow 2:03.291 (2023) | [IMSA Derani Road America pole / track record](https://www.imsa.com/news/2023/08/05/derani-puts-no-31-cadillac-on-pole-at-road-america-with-track-record-lap/); [Al Kamel Road America 2025 Qualifying PDF](https://imsa.results.alkamelcloud.com/Results/25_2025/16_Road%20America/01_IMSA%20WeatherTech%20SportsCar%20Championship/202508021640_Qualifying/03_Results_Qualifying.PDF) (footer still lists those marks) |
| `IMSA_2026_9` | Q GTD Pro Snow 1:43.206 (2024); GTD Gunn 1:43.356 (2021) | [SPEED SPORT Snow VIR pole](https://speedsport.com/sports-cars/imsa/paul-miller-racing-qualifies-p1-in-vir-michelin-gt-challenge/); [Al Kamel VIR 2024 Qualifying PDF](https://imsa.results.alkamelcloud.com/Results/24_2024/15_VIRginia%20International%20Raceway/01_IMSA%20WeatherTech%20SportsCar%20Championship/202408241650_Qualifying/03_Results_Qualifying.PDF) |
| `SUPERCARS_2026_4` | Inaugural modern-era Christchurch — records first set this weekend | Preview / calendar (нет исторических Q/R серии) |
| `PSC_2026_2` | Q Schuring 1:43.784 (2025, Barcelona) | [Porsche Newsroom](https://newsroom.porsche.com/en/ppdb/2025/05/rookie-flynt-schuring-wins-the-qualifying-in-barcelona.html) |
| `PSC_2026_3` | Fastest documented Q Andlauer 1:30.457 (2019, RBR) — не помечен как официальный all-time | Исторический протокол PSC 2019 / race reports (формулировка *documented*) |
| `PSC_2026_4` | Q Marvin Klein 2:20.058 (2024, Spa) | Porsche Newsroom / PSC 2024 Spa qualifying reports |
| `PSC_2026_5` | Q Harry King 1:45.933 (2023, Hungaroring) | [Porsche Newsroom](https://newsroom.porsche.com/en/2023/motorsports/porsche-mobil-1-supercup-pmsc-saison-2023-round-4-budapest-33200.html) |
| `PSC_2026_6` | Q Flynt Schuring 1:35.952 (2025, Zandvoort) — сбил рекорд Laurin Heinrich 2021 | [Porsche Newsroom](https://newsroom.porsche.com/en/ppdb/2025/08/flynt-schuring-wins-thrilling-qualifying-by-a-thousandth-of-a-second.html) |
| `F1_2026_12` | Q Oscar Piastri 1:08.662 (2025); R Lewis Hamilton 1:11.097 (2021) | [Wikipedia Circuit Zandvoort](https://en.wikipedia.org/wiki/Circuit_Zandvoort); [F1 circuit guide](https://www.formula1.com/en/latest/article/circuit-guide-everything-you-need-to-know-about-circuit-zandvoort.3yxmn4LiWkbNTKpad7IRSo); [F1 2025 qualifying](https://www.formula1.com/en/results/2025/races/1267/netherlands/qualifying) |
| `DTM_2026_3` | **Previous** Q Auer 1:19.827 (2025); Thiim 1:19.463 — рекорд **этого** уик-энда 2026 | [dtm.com Lausitzring](https://www.dtm.com/en/news/Second-DTM-pole-Viking-Thiim-takes-the-spoils-at-the-Dekra-Lausitzring); [motorsport.com 2025 Q](https://au.motorsport.com/dtm/results/2025/lausitzring-656532/?st=Q1) |
| `DTM_2026_4` | **Previous** Q Pepper 48.467 (2025); Thiim 48.449 — сбит на Norisring 2026 | [motorsport.com Norisring](https://www.motorsport.com/dtm/news/dtm-qualifying-norisring-1-pole-for-thiim-debacle-for-porsche-and-bmw/10836095/) |
| `F3_2026_6` | Race Voisin 2:05.770 (2024); documented Q Benavides 2:04.253 (2025) | Circuit / F3 Spa lap-record tables; FIA F3 timing |
| `FREC_2026_1`, `_3`–`_6` | Inaugural T-326 modern-era wording (как `_2`) | Серия / шасси T-326 — нет прежних FREC records на этой машине |
| `F4_IT_2026_2` | Race Fittipaldi 1:32.995 (2018, Vallelunga) | Circuit F4 lap-record tables |
| `F4_IT_2026_3` | Race Pradel 1:51.179 (2024, Monza) | [Monza circuit lap records / F4](https://en.wikipedia.org/wiki/Monza_Circuit) (сверять с Euro 4 / Italian F4 protocol) |
| `INDYCAR_2026_12` | Q Dixon 22.6952 / 206.211 mph (18 Jul 2003) | [Nashville Superspeedway Fast Facts](https://www.nashvillesuperspeedway.com/media/news/borchetta-bourbon-music-city-grand-prix-presented-willscot-fast-facts.html) |
| `INDYCAR_2026_15` | Inaugural Streets of Washington — no prior IndyCar Q/R records (scheduled 125 laps / 212.5 mi; not OT 147) | [Wikipedia Freedom 250](https://en.wikipedia.org/wiki/Freedom_250_Grand_Prix); dc.gov / IndyCar event notes |
| `SUPER_FORMULA_2026_6` | Course record Nojiri 1:19.972 (20 Dec 2020 Q) | [motorsport.com Fuji Q](https://www.motorsport.com/super-formula/news/fuji-qualifying-nojiri-yamamoto-cassidy/4929836/) |
| `SUPER_FORMULA_2026_8` | Course record Sette Camara 1:04.235 (18 Oct 2020 Q) | [motorsport.com SUGO Q](https://www.motorsport.com/super-formula/news/sugo-qualifying-sette-camara-pole/4893563/); [superformula.net 2020 Q](https://superformula.net/sf2/race2020/round3/qf) |
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
| `NASCAR_MODIFIED_2026_11` | Q Bobby Santos 18.237 / 123.376 mph (10 Apr 2011); Tour wins at track Bonsignore 14 | [OnPitRoad Thompson notes](https://onpitroad.com/2016/06/14/whelen-mod-tour-news-notes-thompson-2/); Hartford Courant / NWMT historical |
| `NASCAR_MODIFIED_2026_12` | Q Mike Ewanitsko 28.693 / 132.743 mph (19 Jul 2001); R Todd Szegedy 123.087 mph (16 Jul 2011) | [NHMS track records](https://www.nhms.com/media/track-info/track-history.html) |
| `NASCAR_MODIFIED_2026_13` | Q Doug Coby 17.896 / 100.581 mph (29 Apr 2017, Stafford) | [Short Track Scene Stafford 150 notes](https://www.shorttrackscene.com/press-releases/whelen-modified-stat-advance-stafford-150/) |
| `ARCA_2026_15` | Q Mason Mitchell 32.407 / 111.084 mph (2013); R Frank Kimmel 95.265 mph (2012) | [SPEED SPORT Springfield notes](https://speedsport.com/nascar/arca/arca-notes-springfield-for-the-44th-time/) |
| `ARCA_2026_16` | Q Chandler Smith 17.982 / 100.095 mph (2019); R Kyle Benjamin 79.210 mph (2013) | [SPEED SPORT Madison notes](https://speedsport.com/nascar/arca/arca-notes-title-battle-heads-to-wisconsin/) |
| `NASCAR_TRUCK_2026_2` | Q Crawford 30.339 / 182.735 mph (18 Mar 2005) — **pre-2022 Atlanta layout** | Racing-Reference / Jayski historical Atlanta Truck |
| `NASCAR_TRUCK_2026_15` | **Previous** Q Heim 20.072 / 112.096 mph (2023); Riggs 18.502 — рекорд **этого** уик-энда на новом покрытии | [tobychristie.com 2023 pole](https://tobychristie.com/nascar/truck-series/corey-heim-scores-second-consecutive-nascar-truck-pole-with-quick-lap-at-north-wilkesboro/); [SPEED SPORT 2026 pole](https://speedsport.com/nascar/nascar-craftsman-truck-series/riggs-claims-north-wilkesboro-pole/) |
| `NASCAR_TRUCK_2026_18` | Q Austin Dillon 28.574 / 133.296 mph (26 Sep 2015); R Kyle Busch 118.707 mph (24 Sep 2011) | [NHMS track records](https://www.nhms.com/media/track-info/track-history.html); [Jayski 2017 NH Truck](https://www.jayski.com/2017-truck-series-new-hampshire-race-info/) |
| `NASCAR_CUP_2026_25` | Q Brad Keselowski 27.090 / 140.598 mph (19 Sep 2014); R Jeff Burton 117.134 mph (13 Jul 1997, 2:42:35) | [NHMS track records](https://www.nhms.com/media/track-info/track-history.html); [Jayski Statistical Advance Dollar Tree 301](https://www.jayski.com/2026/08/19/statistical-advance-analyzing-the-dollar-tree-301/) |
| `NASCAR_CUP_2026_26` | All-time Q Bill Elliott 42.783 / 210.364 mph (9 Feb 1987); summer Q Cale Yarborough 44.222 / 203.519 mph (2 Jul 1986); summer R Bobby Allison 173.473 mph (4 Jul 1980, 2:18:21) | [Jayski Statistical Advance Coke Zero Sugar 400](https://www.jayski.com/2026/08/26/statistical-advance-analyzing-the-coke-zero-sugar-400-9/) |
| `NOAPS_2026_24` | All-time Q Tommy Houston 46.298 / 194.389 mph (14 Feb 1987); R Geoff Bodine 157.137 mph (1985) | [Jayski 2023 Daytona Xfinity qualifying PDF](https://www.jayski.com/wp-content/uploads/sites/31/2023/8/25/24-nxs-2023-qual-results.pdf); same marks as `NOAPS_2026_1` |
| `INDYCAR_2026_16`, `_17` | One-lap Q Patrick Carpentier 20.028 / 185.500 mph (30 May 1998); two-lap Q Dario Franchitti 42.7768 / 170.840 mph (18 Jun 2011) | [TrackSideOnline Milwaukee Fast Facts](https://www.tracksideonline.com/2025/08/21/fast-facts-snap-on-milwaukee-mile-250/) |
| `GTWCE_END_2026_4` | Fastest documented Q Thomas Preining 1:53.612 (Q3 2025, Nurburgring GP) | [SRO Nurburgring 2025 results](https://www.gt-world-challenge-europe.com/results/2025/n%C3%BCrburgring) |
| `F1_2026_13` | Q Max Verstappen 1:18.792 (2025); R Lando Norris 1:20.901 (2025) | [F1 2025 Italian GP qualifying](https://www.formula1.com/en/results/2025/races/1268/italy/qualifying); [FIA 2025 ITA race fastest laps PDF](https://api.fia.com/sites/default/files/2025_16_ita_f1_r0_timing_racefastestlaps_v01.pdf) |
| `F2_2026_10` | Documented Q Luke Browning 1:32.390 (2025) | [Formula Scout Monza F2 2025 Q](https://formulascout.com/browning-on-monza-f2-pole-as-verschoor-and-fornaroli-trigger-red-flags/134337) |
| `F3_2026_8` | Documented Q Brad Benavides 1:38.120 (2025) | [F1.com F3 Monza 2025 pole](https://www.formula1.com/en/latest/article/f3-benavides-beats-ugochukwu-to-pole-position-in-monza.3o9zS79N3jQf3pmOMk0IPI) |
| `FREC_2026_7` | Inaugural T-326 at Imola — records first set this weekend | Серия / шасси T-326 |
| `F4_IT_2026_5` | No confirmed official Italian F4 Imola all-time record in pre-event materials | Явный skip / disclaimer в preview |
| `PSC_2026_8` | Documented Q Marvin Klein 1:47.697 (2025, Monza) | PSC / F1 support 2025 Monza qualifying reports |
| `WEC_2026_5` | Documented Hyperpole Robert Kubica 1:57.655 (2025, damp COTA) | [Autosport COTA 2025 Hyperpole](https://www.autosport.com/wec/news/Kubica-claims-WEC-pole-position-Ferrari-1-2-COTA/10757324/) |
| `INDYCAR_2026_18` | Q Christian Lundgaard 1:06.4610 / 121.226 mph (9 Sep 2023) | [TrackSideOnline Monterey Fast Facts](https://www.tracksideonline.com/2025/07/24/fast-facts-java-house-grand-prix-of-monterey/) |
| `NASCAR_CUP_2026_27` | Q Aric Almirola 26.705 / 184.145 mph (11 Apr 2014); 500-mile R Matt Kenseth 141.383 mph (11 May 2013, 3:32:45) | [Jayski Statistical Advance Goodyear 400](https://www.jayski.com/2025/04/02/statistical-advance-analyzing-the-goodyear-400-6/) |
| `NOAPS_2026_25` | Q Ryan Blaney 28.696 / 171.369 mph (2019); race lap Blaney 29.196 / 168.0 mph (2019) | Existing `noaps_2026_6` preview / 2019 Darlington Xfinity notes |
| `NASCAR_MODIFIED_2026_14` | Q Matt Hirschman 17.460 (2 Sep 2017) | [Racers Guide Oswego NWMT](https://racersguide.com/whelen-modified-tour-returning-to-oswego-for-third-consecutive-season/) |
| `ARCA_2026_17` | Q Sheldon Creed 31.805 / 113.190 mph (2018); R Christian Eckes 92.119 mph (2019) | [SPEED SPORT DuQuoin notes](https://speedsport.com/nascar/arca/arca-notes-dirt-double-goes-to-duquoin/) |

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
| Merged qual | Нет | Нет | Нет | Нет | Shoot Out | Shoot Out | Нет | Q1/Q2 knockout | Нет |
| Множество гонок/уик. | Нет | Sprint+Race | Sprint+Feature | Нет | Нет | Race 1-4 | Race 1-2 | Нет | Нет |
| Practice формат | Flat | sessions[] | Flat | Flat | Flat | Flat | Flat | sessions[] (per-class) | sessions[] |
| Auto-standings | ✅ flat + **The Chase** (Cup/NOAPS/Truck) | ✅ sprint-aware | ✅ flat | ✅ flat (`race_order` из файла) | ✅ per-class (events) | ✅ flat (events) | ✅ multi-race | ✅ flat (multi-driver) | ✅ per-class (events) |
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
