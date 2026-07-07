# TGA remediation plan (единый документ)

> **Актуальная версия:** этот файл. Ранние черновики в чате устарели.
> Первая версия фазы 3 без шага 3.0 **отменена** — см. раздел «Фаза 3» ниже.

Оценка усилий: **S** ≈ 0.5–1 день, **M** ≈ 2–4 дня, **L** ≈ 3–5 недель календарно (solo + учёба), не 1–2 недели чистого кода.

---

## Жёсткие гейты (что блокирует следующий шаг)

| Переход | Единственный жёсткий гейт | Мягкие (не блокируют) |
|---------|---------------------------|------------------------|
| → **3.0** (вынос дат) | Все тесты из [§ Gate 3.0](#gate-30) green локально + CI | P2 тесты i18n/expand |
| → **3.1** (event-tables) | 3.0 merged + `last-results-dates.js` + smoke «даты» | — |
| → **3.2–3.5** (render) | Предыдущий подшаг + Tier A smoke | Tier B — в конце 3.5 |
| → **data strict** | Отдельный milestone (§ compare-wiki) | compare-wiki warn-only до тогда |

**Правило:** не начинать 3.1, пока gate 3.0 не зелёный. Остальные пункты фазы 2 (merge P0, expand P1) идут **параллельно**, но не заменяют gate 3.0.

### Gate 3.0

Обязательны перед выносом `tga-dates-*.js`:

```bash
node scripts/tga-dates.test.mjs          # parseMeta, formatDateRange, buildEventMetaDate
node scripts/event-card-date.test.mjs    # card rules (регрессия)
node scripts/audit-card-dates.mjs
```

Список кейсов `tga-dates.test.mjs`:

1. `parseIsoDatePrefix` — ISO string, prose `Date`, empty
2. `parseMetaDateToISO('Thu 05 Mar 2026')` → `2026-03-05`
3. `parseNamedRaceDurationHours` — `24 Hours of Le Mans`, `Twelve Hours of Sebring`, `Rolex 24`, null
4. `isoAddDays` — month boundary
5. `formatDateRange` — same month, cross-month, EN
6. `formatDateRangeLong` — single day, span (EN)
7. `buildEventMetaDate` — ISO span vs prose `date`
8. `getEventSessionDateRange` — weekend bounds beat session meta (F1-style)

---

## Фаза 0 — дисциплина коммитов (S, ongoing)

- Один коммит = одна тема (`data`, `frontend-dates`, `frontend-event-render`, `ci`, `backend`).
- Перед push: `go test ./...`, gate 3.0 (когда применимо), `golangci-lint run ./...`.
- Subject: `feat|fix|data|refactor(scope): …`

---

## Фаза 1 — data pipeline (M)

1. **`make check-data`** (или npm script): `validate-schedule-times`, `compare-wiki-schedules` (warn), `build-multi-race-schedule-sessions.mjs --check`, `audit-card-dates`, `go test ./internal/schedulefile/... -run Standings`.
2. Чеклист «новый раунд» в `SERIES_TEMPLATES.md` §0.
3. CI job/step `check-data`.

### compare-wiki → `--strict` (отдельный milestone)

| Этап | Когда | Действие |
|------|-------|----------|
| W0 | сейчас | warn-only в `check-data` |
| W1 | после 2 стабильных data-коммитов | whitelist `data/schedules/wiki-allowlist.json` для известных расхождений |
| W2 | когда allowlist < 5 записей | `--strict` в CI на `main` |
| W3 | release | `--strict` на всех PR с `data/` |

Без W1–W2 скрипт останется шумным и его будут игнорировать — это осознанный риск до milestone.

---

## Фаза 2 — JS-тесты (M, частично параллельно 3.x)

| Приоритет | Модуль | Блокирует |
|-----------|--------|-----------|
| **P0 gate** | `tga-dates-*.js` | 3.0 |
| **P0** | `weekend-card-merge.js` | — |
| **P1** | `event-card-date.js` (FREC, DTM) | — |
| **P1** | `series-schedule-expand.js` | — |
| **P2** | `tga-i18n.js` MSK | — |

Инфра: `scripts/js-test.mjs` запускает `*.test.mjs` (добавить когда >2 файлов).

---

## Фаза 3 — фронт (L, 3–5 недель календарно)

### Порядок

```text
3.0  Даты → web/lib/tga-dates-*.js
3.1  event-tables.js (buildTableSection)
3.2  endurance-race.js
3.3  stockcar-race.js
3.4  openwheel-race.js
3.5  touring-race.js + last-results-dates.js
```

Smoke: **`docs/SMOKE_EVENTS.md`**.

### 3.1 smoke (исправление риска #5)

После выноса `event-tables.js` — **не только A4+A5**, минимум:

- **A1** `IMSA_2026_6` — class columns, rowspan
- **A4** `NASCAR_CUP_2026_19` — stockcar team cells
- **A5** `F2_2026_6` — openwheel sessions

### Откат (rollback)

Strangler fig **без feature flags**:

1. Каждый подшаг 3.x — **отдельный коммит** (легкий `git revert`).
2. До merge следующего подшага — smoke Tier A на затронутое семейство.
3. Новый render-модуль: старый код в `event.js` удаляется **только** в том же PR после smoke; если сомнение — оставить thin wrapper `if (TGA_USE_LEGACY_RACE_RENDER)`.
4. Прод-баг через неделю: `git revert <commit-hash подшага>`; не смешивать 3.2+3.3 в одном коммите.

Бэкап перед 3.0: `TGA-backup-2026-07-07-pre-phase30.zip` (корень `Documents/`).

### 3.0 — модули дат

| Файл | Содержимое |
|------|------------|
| `tga-dates-core.js` | `parseIsoDatePrefix`, `isoAddDays`, `parseMetaDateToISO`, `parseNamedRaceDurationHours` |
| `tga-dates-format.js` | `formatShortDate`, `formatDateRange`, `formatDateRangeLong`, `buildEventMetaDate` |
| `tga-dates-event.js` | `getEventSessionDateRange` |
| `event-card-date.js` | правила карточек (без дублей core) |
| `tga-i18n.js` | MSK/UTC (3.0b — вынос в `tga-dates-msk.js`, не блокирует 3.0) |

---

## Фаза 4 — CI (S–M)

- `node scripts/js-test.mjs` или перечисление `*.test.mjs` в workflow
- `check-data` job
- golangci-lint `install-mode: goinstall`

---

## Метрики готовности

| Область | Цель |
|---------|------|
| Дубли `parseMetaDateToISO` | 0 |
| `event.js` | < 120 KB (после 3.5) |
| JS unit tests | ≥ 20 |
| Коммит | < 40 файлов, одна тема |
