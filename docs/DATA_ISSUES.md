# Замечания по данным проекта TGA

Актуализация: **2026-09-20**. Ниже — текущие известные пробелы и соглашения. Старые разовые фиксы (имена Cup, Clash `end_date`, формат Pos) уже в данных и здесь не дублируются.

Автогейты: `make check-data`, `make ci` (audits), `GET /api/admin/data-health` при включённом admin.

---

## 1. F1 2024 — scaffolding без полных результатов

- Календарь, event JSON stubs, `entry_list` и standings wiring есть (`data/events/F1/2024/`, `/season/f1-2024`).
- Таблицы practice / qualifying / race для большинства раундов **пустые** — ожидаемо, пока результаты не заполнены.
- Teams: при пустом `data/teams/f1_2024.json` страница Teams собирается из `entry_list` (`buildF1TeamsFromEntry`).

## 2. Неравномерная полнота полей

Пустые `laps` / `distance` на ещё не прошедших или незаполненных этапах — норма. Заполнять **запланированную** дистанцию (календарь / FIA / handbook), не фактические круги овертайма из протокола. `laps` = scheduled число кругов; `distance` = только физическая дистанция — формат по серии (`data/SERIES_TEMPLATES.md`): F1 `"X.XXX km (Y.YYY miles)"`, stock-car `"X mi (Y km)"`, IndyCar `"X.XXX miles (Y.YYY km)"`. Фактически пройденные круги остаются в `tables.race_results`.

## 3. Multi-race / double-header

Отдельные `event_id` на гонку (не один файл с `race.sessions[]`):

| Серия | Пример |
|-------|--------|
| IndyCar | Milwaukee `INDYCAR_2026_16` + `_17` |
| Super Formula | Fuji Oct `_9`+`_10`, Suzuka `_11`+`_12` |

**PSC Zandvoort** — **один** файл `psc_2026_6.json` с `tables.race.sessions[]` (Race 1+2). Отдельного `psc_2026_7.json` нет; `/event/psc-2026-7` ремапится на тот же уик-энд.

Last Results merge — `web/lib/weekend-card-merge.js`. Пересборка multi-race map: `node scripts/build-multi-race-schedule-sessions.mjs`.

Исключение в одном файле: `SUPER_FORMULA_2026_6` (Fuji triple-header) — `tables.race.sessions[]`.

## 4. Standings files

Не править очки в `data/standings/*.json`. API пересобирает из `data/events/`. Для stock-car / IndyCar поддерживать только `race_order` / `event_names` при добавлении раундов.

**The Chase** (Cup / NOAPS / Truck) тоже из events (`standings_chase.go`). Не сидить 2100/2075 вручную. После Daytona NOAPS / Loudon Truck таблица должна сама перейти на Chase (сиды 2100…). Cup ждёт Daytona (гонка 26). Stats (`/stats`) остаются суммой сезона без сброса. Handbook: `data/SERIES_TEMPLATES.md` § The Chase.

## 5. Super GT qualifying

Не писать отдельные сессии `Qualifying 1` / `Qualifying 2` (и не четыре таблицы GT500/GT300 × Q1/Q2). Канон: **одна таблица на класс** с колонками `Q1` / `Q2`. Поул = Q2 P1. Эталон: `super_gt_2026_5.json`. Handbook: `data/SERIES_TEMPLATES.md` §8.

## 6. Что уже согласовано

- ASCII-only латиница в именах/местах; RU — в `event_preview_ru` и словарях `web/utils/`.
- Nickname-дубли через `data/driver_slug_aliases.json` + `fix-driver-slug-aliases.mjs --check`.
- Stock-car Team-колонка = race team (не sponsor); `sync-stockcar-table-teams.mjs`.
- IMSA BoP — верхнеуровневый объект `bop`, вкладка `/bop` (не только раунды 1–2).
- ELMS race table: layout `elms-race-results-table`, без классовых цветовых полос.
- Круговое время: `"1:45.891"`, не `"1'45.891"`; IndyCar четыре знака после точки (`"00:57.6076"`).
- Event JSON под `data/` — **compact** на диске (`data/SERIES_TEMPLATES.md` § Compact JSON); `make format-data` / `node scripts/format-compact-json.mjs data`; аудит `node scripts/audit-compact-json.mjs`.

## 7. Незаполненные / неверные ключи (календарные stubs)

Пока не заполнены результатами; при заполнении **скопировать ключи** с эталона серии, не оставлять scaffold:

| Файл | Проблема |
|------|----------|
| `f2_2026_10.json` | `tables.sprint` / `tables.feature` — сайт ждёт `tables.race.sessions[]` |
| `f3_2026_8.json` | то же |
| `f4_it_2026_5.json` | пустые `race.sessions[]`; practice/qualifying **flat**, эталон — `sessions[]` |
| `gtwce_sprint_2026_4.json` | `tables.race_results` — нужен `tables.race.sessions[]` (Race 1+2) |
| `wec_2026_5.json` | пустой stub, generic headers; эталон — `tables.race_results` как `wec_2026_2.json` |
| `f1_2026_16.json` | календарный stub (Bahrain GP @ Sepang), таблицы пустые |

## Рекомендуемый порядок

1. Перед коммитом данных: `make ci` (или хотя бы `make check-data` + релевантные `audit-*.mjs`).
2. Новые раунды: schedule + event stub + (stock-car/IndyCar) `race_order`.
3. F1 2024: заполнять таблицы по эталону `data/SERIES_TEMPLATES.md` §2 / заполненному `f1_2025_*` или `f1_2026_*`.
4. F2/F3 stubs: сразу править ключи на `tables.race.sessions[]` при первом заполнении.
