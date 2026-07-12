# План очистки и оптимизации TGA

Приоритет: **срочное → несрочное**. Каждый пункт: цель, действия, риск, ожидаемый эффект, критерий готовности.

Связанные документы: [`PERFORMANCE.md`](PERFORMANCE.md), [`RUNBOOK.md`](RUNBOOK.md), [`data/SERIES_TEMPLATES.md`](../data/SERIES_TEMPLATES.md).

---

## Фаза 0 — Срочно (сегодня, низкий риск)

Безопасная уборка без изменения поведения сайта.

### 0.1 Удалить временные артефакты

| Действие | Файлы |
|----------|--------|
| Удалить | `scripts/_grid_r1_0.png`, `scripts/_grid_r2_0.png`, `scripts/_r2.png` |
| Не коммитить | `data/live.json`, `data/tga.sqlite*`, `data/cache/` (уже в `.gitignore`) |

**Эффект:** чище репозиторий, нет случайного коммита мусора.  
**Готово когда:** PNG удалены; `git status` без scratch-файлов.

---

### 0.2 Облегчить legacy standings JSON

API **не читает** `rows` из standings для пересчёта очков (кроме редкого fallback). Эталон — `data/standings/indycar.json` (`"rows": []`).

| Файл | Действие |
|------|----------|
| `nascar_cup.json`, `noaps.json`, `nascar_truck.json`, `nascar_modified.json`, `arca.json` | Оставить `race_order`, `event_names`; **`rows` → `[]`** |
| `supercars.json`, `elms.json` | То же + комментарий в README уже есть; опционально перенести minimal fixture в `testdata/` для теста ELMS |

**Эффект:** ~50 KB меньше JSON; меньше путаницы при редактировании.  
**Риск:** низкий — `make test` + открыть standings Cup/IndyCar в UI.  
**Готово когда:** `go test ./internal/schedulefile/...` зелёный; standings в браузере совпадают с текущими.

---

### 0.3 Архивировать одноразовые скрипты

Перенести (не удалять сразу) в `scripts/archive/` с `scripts/archive/README.md` (одна строка: «выполненные миграции, не в CI»):

| Скрипт | Назначение |
|--------|------------|
| `apply-f3-official-points.mjs` | разовый патч очков F3 |
| `apply-imsa-official-points.mjs` | разовый патч IMSA |
| `dump-f3-sprint-pts.mjs`, `f3-breakdown.mjs`, `audit-f3-standings.mjs` | отладка F3 standings |
| `build-f2-2026-7-silverstone.mjs`, `build-frec-2026-5-hungaroring.mjs` | генераторы одного event |
| `apply-event-split.mjs`, `split-event-page.mjs` | миграция `event.js` |

**Эффект:** в `scripts/` остаются только актуальные инструменты.  
**Готово когда:** `make ci` зелёный; в корневом README нет битых ссылок на эти скрипты.

---

### 0.4 Фронт: две быстрые правки

| # | Файл | Изменение | Эффект |
|---|------|-----------|--------|
| A | `web/pages/schedule.js` | При открытии Full Schedule — **сначала** `getGlobalEventsCache()`, иначе `fetchAllEvents` | −22 API-вызова при Home → Schedule |
| B | `web/pages/series.js` | Stats retry: **max 2** попытки (или убрать), вместо 10×1 с | нет шторма на `/stats` |

**Риск:** низкий.  
**Готово когда:** ручной клик Home → Full Schedule (сеть: 0 новых `/events`); stats tab без 10 повторов.

---

## Фаза 1 — Срочно (эта неделя, мёртвый Go-код)

### 1.1 Удалить неиспользуемые экспорты

| Символ | Файл | Проверка |
|--------|------|----------|
| `SaveStandings` | `internal/schedulefile/schedulefile.go` | `rg SaveStandings` — только определение |
| `BuildSupercarsStandingsFromFiles` | `internal/schedulefile/standings.go` | то же |
| `BuildImsaStandingsThroughRound` | `internal/schedulefile/standings_imsa_elms.go` | то же, если нет планов «standings through round N» |

**Действия:** удалить функции; `go test ./...`.  
**Эффект:** ~200 строк мёртвого кода.  
**Готово когда:** `make ci` зелёный.

---

### 1.2 Упростить fallback в `handleSeriesStandings`

В `cmd/server/handlers_series.go` ветка `if data == nil { LoadStandings }` **не срабатывает** при успешном `BuildStandingsFromEvents` (всегда non-nil struct).

**Действия:** удалить ветку или заменить на явный комментарий + `slog.Warn` только при `err != nil`.  
**Риск:** низкий.  
**Готово когда:** тест handlers / ручная проверка standings нескольких серий.

---

### 1.3 Убрать дублирование `globalEventsCache` в `schedule.js`

Сейчас объявление на строках ~6 и ~13.

**Действия:** одна переменная + `setGlobalEventsCache` / `getGlobalEventsCache` через `window.TGA`.  
**Готово когда:** `node scripts/js-test.mjs` зелёный.

---

## Фаза 2 — Высокий приоритет (производительность сервера)

Корневая причина медленных страниц: **пересчёт standings/stats из всех event JSON на каждый запрос** + **N× чтение файлов на главной**.

### 2.1 Mtime-кэш для standings и stats

**Где:** `cmd/server/handlers_series.go`, пакет `internal/cache/ttl.go` (уже есть).

**Дизайн:**
- Ключ: `{seriesID}/{season}/standings` и `.../stats`
- Инвалидация: max mtime среди `data/events/<series>/<season>/*.json` + `data/standings/<series>.json` (если есть)
- TTL запасной: 30–60 с на случай пропуска mtime
- Заголовок: `Cache-Control: private, max-age=30` для standings/stats (опционально; event — по-прежнему `no-store`)

**Эффект:** повторные запросы standings/stats **50–500 ms → &lt;10 ms**; меньше CPU при навигации по серии.  
**Риск:** средний — устаревшие данные, если mtime не обновился (редко на NTFS при быстрых правках).  
**Готово когда:** bench до/после; после правки JSON standings обновляются без перезапуска.

**Шаги:**
1. `func eventsDirMaxMtime(dataDir, seriesID, season string) (time.Time, error)`
2. Обернуть `handleSeriesStandings` / `handleSeriesStats`
3. Добавить тест: два запроса подряд — второй из кэша
4. Обновить `docs/PERFORMANCE.md` — bench `GET /api/series/nascar_cup/standings`

---

### 2.2 Один проход по events в standings pipeline

**Где:** `BuildStandingsFromEvents` + `EnsureCompletedRaces` + `EnrichStagesFromEvents` (`internal/schedulefile/standings.go`).

**Проблема:** три цикла, каждый вызывает `LoadEventDetail`.

**Действия:**
- Общий `detailCache map[string]*EventDetailJSON` на весь HTTP-запрос (context или параметр)
- Или слить `EnsureCompletedRaces` / `EnrichStagesFromEvents` в один проход после build

**Эффект:** до **3× меньше** disk I/O на standings (даже без TTL-кэша).  
**Риск:** низкий.  
**Готово когда:** `go test ./internal/schedulefile/... -run Standings` + сравнение JSON ответа до/после (snapshot или diff тест).

---

### 2.3 Убрать N× `EventDetailExists` на `/api/series/{id}/events`

**Где:** `handlers_series.go` → `schedulefile.EventDetailExists` на каждый раунд.

**Варианты (выбрать один):**

| Вариант | Плюсы | Минусы |
|---------|-------|--------|
| A. Поле `has_detail` в `data/schedules/*.json` | Быстро, явно | Ручное/скриптовое поддержание |
| B. Флаг в SQLite при bootstrap | Авто при старте | Нужен re-bootstrap при новом JSON |
| C. Кэш списка event_id с файлами на диске (mtime каталога) | Без правок schedules | Сложнее инвалидация |

**Рекомендация:** **B** (уже есть bootstrap) + скрипт `scripts/refresh-has-detail.mjs` для dev без полного bootstrap.

**Эффект:** главная страница: **22 × N read → 22 лёгких ответа**; заметное ускорение TTFB Home.  
**Готово когда:** `hey` на симуляцию 22 parallel `/events` — p95 вниз; карточки Home без регрессий.

---

### 2.4 Подключить event cache в `handleEvent`

**Где:** `cmd/server/main.go:192` — `handleEvent(..., nil)`; `internal/cache/ttl.go`.

**Действия:**
- Кэшировать **сырые bytes** или enriched JSON по `event_id` + mtime файла
- Передавать `*cache.TTL` в handler

**Эффект:** event page + Last Results cards — меньше повторного parse/enrich.  
**Риск:** средний (enrich chain).  
**Готово когда:** два подряд `GET /api/events/{id}` — второй быстрее; live-редактирование JSON видно после сохранения файла.

---

## Фаза 3 — Средний приоритет (dev UX и структура API)

### 3.1 Инкрементальный / пропускаемый bootstrap

**Где:** `cmd/server/bootstrap.go`, `main.go`.

**Действия:**
- Env `TGA_BOOTSTRAP=full|skip|incremental` (default `full` в prod, `skip` или `incremental` в dev)
- Incremental: импорт только event, у которых mtime &gt; last_bootstrap_time в SQLite meta table
- Документировать в README § Hot Reload / Air

**Эффект:** перезапуск с Air **5–30 с → &lt;2 с** в типичном dev.  
**Риск:** средний — рассинхрон DB/JSON если skip без понимания.  
**Готово когда:** `air` + правка одного event JSON не требует полного bootstrap для stats из DB (если DB path используется).

---

### 3.2 Агрегированный endpoint расписания

**Новый:** `GET /api/schedule?season=2026` — merged events всех серий (то, что сейчас делает фронт через 22 вызова).

**Эффект:** Home / Full Schedule — **1 запрос** вместо 22+; проще кэшировать на сервере.  
**Риск:** средний — новый контракт API, обновить `web/lib/api.js`, `schedule.js`, `list.js`.  
**Готово когда:** Home работает с одним вызовом; `docs/WEB_TGA_API.md` обновлён.

---

### 3.3 Облегчить Last Results на главной

**Где:** `web/components/last-results-cards.js`.

**Действия:** endpoint `GET /api/events/{id}/summary` (победитель, top-3, дата) **или** включить summary в ответ `/api/series/{id}/events`.

**Эффект:** нет 5–10 полных `getEvent` после загрузки Home.  
**Готово когда:** Network tab — нет полных event JSON для карточек Last Results.

---

### 3.4 Убрать double-fetch на event page

**Где:** `web/pages/event.js` (~501–521) — повторный fetch если «короткий payload».

**Действия:** найти root cause (форма `eventCache` при SPA navigation); исправить кэш, убрать retry.

**Эффект:** −50% latency на части навигаций.  
**Готово когда:** переход series → event → другой event без второго fetch в Network.

---

### 3.5 Codegen для дублей

| Источник | Потребитель | Действие |
|----------|-------------|----------|
| `scripts/lib/f1-event-normalize.mjs` | `web/lib/f1-event-normalize.js` | `make f1-normalize` → вызывает `build-f1-event-normalize-browser.mjs` |
| `data/timezones-reference.json` | `scripts/lib/timezones.mjs`, `web/data/timezones.js` | новый `scripts/build-timezones.mjs` |

**Эффект:** меньше drift между Node и browser.  
**Готово когда:** targets в Makefile + строка в README.

---

## Фаза 4 — Низкий приоритет (полировка)

### 4.1 Решить судьбу `BuildDriverStatsFromDB`

SQLite views и `driver_stats_stockcar` есть; HTTP всегда идёт в `BuildDriverStatsFromEvents`.

**Варианты:** (a) удалить DB path как неиспользуемый; (b) включить для stock-car/F1 с parity-тестами JSON vs DB.

**Не делать**, пока не зафиксирована политика «JSON единственный source» в README.

---

### 4.2 JS bundling для production

61 отдельный `<script>` в `index.html`; `series.js` ~5200 строк.

**Действия:** esbuild rollup: `web/dist/app.js` для prod; dev — как сейчас.

**Эффект:** меньше HTTP round-trips на медленных сетях; не влияет на API latency.  
**Риск:** высокий (порядок загрузки, globals).  
**Готово когда:** prod build + smoke E2E.

---

### 4.3 Search index без N× teams

**Где:** `web/app.js` `ensureSearchIndex` — `getSeriesTeams` для каждой серии.

**Действия:** lazy index по категории или серверный `/api/search-index`.

**Эффект:** первое открытие поиска быстрее.  
**Приоритет:** низкий (opt-in feature).

---

### 4.4 Разбить `web/pages/series.js`

Вынести F1 render, stats tables, IMSA class standings в отдельные модули (продолжение `split-event-page`).

**Эффект:** maintainability, не perf.  
**Риск:** средний регрессий UI.

---

### 4.5 Расширить performance baseline

**Где:** `docs/PERFORMANCE.md`.

Добавить `hey` сценарии:
- `GET /api/series/nascar_cup/standings`
- `GET /api/series/nascar_cup/stats`
- `GET /api/series/nascar_cup/events`
- Симуляция Home (22 parallel events)

Подключить `go test -bench=BenchmarkBuildDriverStats` в optional CI job.

---

### 4.6 Мелкие скрипты — документировать или архивировать

Оставить в `scripts/`, но явно в README § Tooling:

| Скрипт | Когда |
|--------|-------|
| `sync-stockcar-table-teams.mjs` | после правок team в stock-car |
| `sync-driver-profiles-from-events.mjs` | обновление `driver_profiles.json` |
| `sync-sf-table-teams.mjs` | Super Formula teams |
| `stats-columns-sanity.mjs` | ручной аудит stats |
| `compare-wiki-schedules.mjs` | локально, warn-only (не для CI) |

---

## Фаза 5 — Опционально / когда будет время

- Удалить `data/standings/elms.json` и `supercars.json` после переноса fixtures в `testdata/`
- `cmd/normalize-event-tables`, `cmd/fetch-driver-wikidata` — оформить в README или `make tools`
- `.gitignore`: добавить `scripts/_*.png` pattern
- Рефакторинг «legacy render» в `series.js` (не F1) — только с тестами
- CDN / HTTP caching для статики `web/` (если деплой не nginx с cache headers)

---

## Порядок выполнения (чеклист)

```
Фаза 0  [x] 0.1 PNG          [x] 0.2 standings rows  [x] 0.3 archive scripts  [x] 0.4 frontend quick wins
Фаза 1  [x] 1.1 dead Go      [x] 1.2 handler fallback [x] 1.3 schedule cache dedup
Фаза 2  [ ] 2.1 mtime cache  [ ] 2.2 single pass     [ ] 2.3 has_detail       [ ] 2.4 event cache
Фаза 3  [ ] 3.1 bootstrap    [ ] 3.2 /api/schedule   [ ] 3.3 last results   [ ] 3.4 event double-fetch  [ ] 3.5 codegen
Фаза 4  [ ] 4.1 DB stats     [ ] 4.2 bundling        [ ] 4.3 search           [ ] 4.4 split series.js   [ ] 4.5 perf docs  [ ] 4.6 script docs
Фаза 5  [ ] по необходимости
```

**Рекомендуемые PR (разбивка):**
1. `chore: cleanup temp files, standings rows, archive scripts`
2. `chore: remove dead schedulefile exports`
3. `perf(frontend): schedule cache + stats retry`
4. `perf(server): standings/stats mtime cache`
5. `perf(server): shared detail cache + has_detail`
6. `perf(dev): incremental bootstrap`
7. `feat(api): GET /api/schedule`

---

## Метрики успеха

| Метрика | Сейчас (оценка) | Цель после фаз 0–2 |
|---------|-----------------|---------------------|
| Home load API calls | ~22+ events + 5–10 full events | ≤23 или 1 aggregated |
| Standings p95 (Cup, warm) | 100–500 ms | &lt;30 ms |
| Air restart to ready | 5–30 s | &lt;5 s (фаза 3) |
| Мёртвый Go код | ~200 строк | 0 |
| One-off scripts в `scripts/` | 9 | 0 (в archive) |

---

*Документ создан по аудиту кодовой базы. Обновлять по мере закрытия пунктов.*
