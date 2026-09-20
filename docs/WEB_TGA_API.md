# window.TGA public API

The frontend uses **IIFE scripts** + `window.TGA` as a shared namespace (no ES modules yet).

## Script load order (`web/index.html`)

Approximate order:

```
spa-boot.js (blocking, in <head> — hides #view-list on inner URLs before first paint)
data/* (translations, series-colors, static-schedules, …)
  → utils/fetch-json.js → lib/api.js → lib/state.js
  → lib/tga-dates-*.js → lib/lazy-assets.js → tga-i18n.js
  → multi-race-schedule-sessions.js → event-card-date.js → weekend-card-merge.js → last-results-dates.js
  → tga-utils.js → lib/deps.js
  → components/* → pages/schedule.js → pages/list.js → pages/home-feed.js
  → lib/router.js → app.js
```

**Lazy-loaded** (via `lib/lazy-assets.js`, not in the initial HTML):

- RU dictionaries (`utils/*-ru.js`, spec-value maps) — when `lang === 'ru'` (scripts download in parallel)
- F1 tech-spec + IMSA/series classes specs — on `/series/*` and `/season/*`
- Series page (`tga-series.js`, `series-stockcar.js`, `pages/series.js`) — on `/series/*` and `/season/*`
- Event page + race table libs — on `/event/*`
- Driver career tabs (`pages/driver.js`) — on `/driver/*`

Home idles `prefetchPageAssets()` so the first inner navigation is already warm.

**Discovery routes** (registered before the SPA catch-all `/` in `cmd/server/main.go`):

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/sitemap.xml` | Home, current-season series pages, current-season events, driver profile slugs. No `/api/` URLs. `Content-Type: application/xml`. Rebuilds when schedule/event/profile mtime changes. |
| `GET` | `/robots.txt` | `Allow: /` plus `Sitemap: {origin}/sitemap.xml`. Does not blanket-disallow `/api/`. |

`<loc>` origins come from the request host and scheme (`r.Host`, TLS → `https`).

**Static `/web/*` cache** (`cmd/server/static_cache.go`): `app.js`, `style.css`, `index.html`, **`pages/event.js`**, **`pages/driver.js`**, **`pages/series.js`**, **`lib/lazy-assets.js`**, **`lib/router.js`**, **`lib/api.js`**, **`data/translations.js`**, **`spa-boot.js`** = `Cache-Control: no-store`. Other JS/CSS `max-age=3600`; images `max-age=604800`. `translations.js` stays no-store so new i18n keys (e.g. driver career tabs) are not served as raw keys from a 1-hour cache while `driver.js` is already fresh. After changing a previously cached path on a running server, restart once so the new header applies.

## `lib/api.js` — HTTP API client

Wraps `window.TGA.fetchJSON` with typed methods. All `/api/*` fetches should go through `window.TGA.API`.

| Method | Endpoint |
|--------|----------|
| `getSeries()` | `/api/series` |
| `getSeriesMeta(seriesId)` | `/api/series/:id` |
| `getSeriesTeams(seriesId)` | `/api/series/:id/teams` |
| `getAllSeriesTeams(season?, options?)` | `/api/teams?season=` — all current-season teams keyed by lowercase data series id (`by_series.f1`, `by_series.nascar_cup`, …). Search uses this instead of N× `getSeriesTeams`. |
| `getSeriesStandings(seriesId, options?)` | `/api/series/:id/standings` |
| `getSeriesStats(seriesId, options?)` | `/api/series/:id/stats` (`options.season`, cache-bust) |
| `getSeriesEvents(seriesId, season?, options?)` | `/api/series/:id/events` |
| `getSeriesHistory(seriesId)` | `/api/series/:id/history` |
| `getEvent(eventId, options?)` | `/api/events/:id` |
| `getEventSummaries(ids, options?)` | `/api/events/summaries?ids=A,B` — slim Last Results winners |
| `getEventSummary(eventId, options?)` | `/api/events/:id/summary` |
| `getDriver(slug, options?)` | `/api/driver/:slug` — profile + `season_results` (current season), `career_results` (all seasons), `available_seasons`, `team_history` (team stints), `achievements` (crown-jewel wins), `titles` (championships) |
| `getDrivers()` | `/api/drivers` |
| `getDriversPrimaryContext()` | `/api/drivers/primary-context` |
| `getLiveEvents()` | `/api/live-events` |
| `safe(fn)` | Promise wrapper with logger on reject |
| `fetchJSON(url, opts?)` | Escape hatch (deprecated for new code) |

**Options:** `{ cacheBust: true }` appends `_=` timestamp (opt-in). Default is **no** cache-bust so browser/`max-age` can reuse responses. Live boards always bust.

### `getSeriesStandings` response

Standings are **rebuilt server-side on every request** from `data/events/` (not from frozen `data/standings/*.json` rows).

| Shape | Series | Key fields |
|-------|--------|------------|
| Flat | F1, F2, F3, stock-car, IndyCar, Supercars, DTM, PSC, Super GT, … | `rows[]`, `race_order[]`, `completed_races[]`; stock-car also `ineligible[]`, `Stages` column |
| Per-class | IMSA, ELMS, WEC, GTWCE End, GTWCE Sprint | `classes[]` (each with `id`, `name`, `rows[]`), shared `race_order[]` |

**The Chase** (Cup / NOAPS / Truck only): after the regular-season finale has `race_results`, the top 16 / 12 / 10 on points are re-seeded (2100, 2075, 2065, then −5). No elimination rounds, no playoff points. Extra payload:

| Field | Where | Meaning |
|-------|--------|---------|
| `chase` | top-level | `active`, `round` (`regular_season` / `the_chase`), `field_size`, `cutline`, `regular_season_races` |
| `chase_status` | `rows[]` | `in` for Chase field |

UI: `#standings-chase-note`, dashed cutline from `chase.cutline`. Helpers in `web/lib/series-stockcar.js` (`stockcarPlayoffCutline`, `stockcarPlayoffRowClass`). Handbook: `data/SERIES_TEMPLATES.md` § The Chase.

Rendering: flat tables in `#standings-wrap`; per-class via `tga-utils.js` → `buildImsaGtwceClassStandingsHtml` (`#standings-imsa-wrap`). IMSA and WEC support Crew / Driver mode (`standings-mode-nav`).

**Super GT:** API is still flat `rows[]`. `pages/series.js` splits them into GT500 / GT300 tables from car class in event JSON. Driver stats poles = Q2 P1 per class (not Q1 leader).

Data workflow: edit `Pts` / `Points` in event JSON tables — see `data/SERIES_TEMPLATES.md` § «Автоматическая сборка standings».

## `lib/state.js` — `window.TGA._state`

| Field | Owner | Purpose |
|-------|-------|---------|
| `loadedSeriesId` | series.js / app.js | Current series detail page |
| `eventCache` | app.js | Cached event JSON by API id |
| `eventPageLoadGeneration` | app.js | Stale-guard for fast tab switches |
| `searchIndexItems` | app.js | Search index cache |
| `searchIndexReady` | app.js | Search index loaded flag |
| `searchIndexLoading` | app.js | Search index in-flight |
| `searchInitDone` | app.js | Header search wired (`/` and Ctrl/Cmd+K open `#search-popover`; ignored while focus is in input/textarea/select/contenteditable) |

## Date helpers (`lib/tga-dates-*.js`, `event-card-date.js`, `weekend-card-merge.js`)

| Module | Role |
|--------|------|
| `tga-dates-core.js` | `parseMetaDateToISO`, ISO helpers |
| `tga-dates-format.js` | `formatDateRange`, `formatDateRangeLong`, … |
| `tga-dates-event.js` | `getEventSessionDateRange` |
| `event-card-date.js` | Card date rules per series (`SERIES_CARD_DATE_RULES`) |
| `weekend-card-merge.js` | Last Results merge (PSC / IndyCar / Super Formula double-headers, …) |
| `last-results-dates.js` | Last Results date strings for home cards |

`pages/schedule.js` and `app.js` consume these via `window.TGA` / `lib/deps.js` — do not reimplement.

## `tga-i18n.js` — i18n, theme, time, localization

Single source for: `t`, `getLang`, `setLang`, `setTheme`, `translateStaticUI`, `localize*`, `formatTimeForDisplay`, `getTimeSettings`, etc.

`setLang` clears `state.eventCache` and `state.loadedSeriesId`, then calls `window.TGA.route()` if defined.

## `tga-utils.js` — DOM/format helpers

Single source for: `esc`, `dash`, `slugify`, `driverDisplayName`, guest-entry helpers, `categories`, `categoryBySeriesId`, `seriesBadge`, date formats used by older call sites, `addObjectTableSort`, `countryHtml`, panel padding, Supercars static specs.

## `tga-series.js` — F1 tech-spec aliases

Exposes `window.TGA.F1_2024_TECH_SPEC` and `window.TGA.F1_2025_TECH_SPEC` from `web/data/f1-tech-spec-*.js` (2026 tech-spec is loaded separately and used from series page code). Teams HTML is built in `web/pages/series.js` (including from `entry_list` when `data/teams/f1_20xx.json` is empty).

**Does not** export static F1 teams blobs or `renderDetail` — see `pages/series.js`.

## `pages/series.js` — series/season detail page

| Export | Description |
|--------|-------------|
| `renderDetail(seriesId, subPath?)` | `/series/:id`, `/season/:slug` — schedule, teams, standings, specs, stats, history |
| `rebuildNascarCupDayFromDaytona(data)` | NASCAR Cup DAY column from Daytona 500 results |
| `renderF1StaticSpecsIfNeeded()` | F1 technical regulations on specs tab (also on `load`) |

Standings cutline / Chase row classes for Cup, NOAPS, and Truck come from `web/lib/series-stockcar.js` (`window.TGA.stockcarPlayoffCutline`, `stockcarPlayoffRowClass`), loaded immediately before `pages/series.js`.

Includes static F1 history data (1950–2026 champions) for `/series/f1/history`. Live seasons: `/season/f1-2024`, `/season/f1-2025`, `/season/f1-2026`.

## `lib/router.js` — SPA routing

| Export | Description |
|--------|-------------|
| `route` | Match `pathname` → page handler on `window.TGA` |
| `navigate(href)` | `pushState` + scroll + `route()` |
| `initRouter()` | Wire `popstate`, `pageshow`, link click delegation; call once from `app.js` |

`route()` delegates to handlers registered by `app.js` before `initRouter()`.

## `pages/schedule.js` — full schedule + home feed helpers

| Export | Description |
|--------|-------------|
| `renderSchedulePage` | `/schedule` and `/?full_schedule=1` |
| `loadGlobalSchedule` | Home page: fetch all events, next-race + last-results cards |
| `fetchAllEvents` | (internal) aggregate events across series + static fallbacks |
| `applySchedulePastVisibility` | Hide past rows on schedule page |
| `getGlobalEventsCache` / `setGlobalEventsCache` | Cached merged schedule for event header fallback |
| `filterVisibleEvents(events)` | Filter hidden events from schedule lists (currently pass-through) |

Date formatting for cards/schedule uses `tga-dates-*` / `event-card-date.js` via `window.TGA`.

## `pages/list.js` / `pages/home-feed.js`

Home series list and feed wiring; schedule aggregation still goes through `pages/schedule.js` / `loadGlobalSchedule`.

## `app.js` — page renderers

Registers handlers, then calls `initRouter()`:

| Export | Description |
|--------|-------------|
| `showView` | Toggle `#view-*` panels; drops `html.spa-boot-inner` / `spa-boot-driver` (first-paint hide of `#view-list` via `/web/spa-boot.js`) |
| `renderSearchPage` | `/search?q=…` |
| `renderEventPage` | `/event/:id/:section` (delegates to `pages/event.js` libs) |
| `renderDriverDetail` | `/driver/:slug` — header in `app.js`, career tabs via `pages/driver.js` (`renderDriverCareer`) |
| `renderTrackDetail` | `/track/:slug` |
| `renderTeamDetail` | `/team/:slug` |
| `renderCrewChiefDetail` | `/crew-chief/:slug` |

## Event page libs (`web/lib/*-race.js`, `event-*.js`)

Loaded before `pages/event.js`. Race tab goes through `event-race-content.js` (`renderRaceContent`). Notable series hooks:

| Module | Role |
|--------|------|
| `event-race-content.js` | Race tab; ELMS adds `elms-race-results-table` (layout only — no class color bars) |
| `openwheel-race.js` | F1 / F2 / F3 / IndyCar race transforms |
| `touring-race.js` | Super GT / DTM / Supercars; Super GT race split by CLASS |
| `event-bop.js` | IMSA `/event/:id/bop` from top-level `bop` |
| `event-pit-stops.js` | F1 pit-stop chart |

Super GT qualifying (Q1/Q2 columns, one table per class, `qual-row-q1-out`) is rendered in `pages/event.js`.

## Components (`web/components/*`)

Each file exports one or more functions on `window.TGA` (e.g. `renderNextRaceCards`, `buildScheduleHTML`, `makeSimpleTableSortable`).

## `pages/driver.js` — driver career tabs

`window.TGA.renderDriverCareer(contentEl, data)` fills `#driver-content` with **Results** / **Teams** / **Achievements** / **Titles**. Hash `#teams` / `#achievements` / `#titles` selects a tab. Season chips appear when `available_seasons` has more than one year (F1 2024–2026).

`GET /api/driver/:slug` extra fields:

| Field | Meaning |
|-------|---------|
| `season_results` | Current season only (backward compatible) |
| `career_results` | All seasons; each row may include `season`, `circuit_name`, `class_position` |
| `available_seasons` | Distinct years, newest first |
| `team_history` | Team stints from event JSON; consecutive years at the same team become `2024–2026`. Empty race-row Team is filled from that event's `entry_list` (`team`, else `constructor`). F1 commercial/constructor aliases fold to one stint. `starts` counts race/sprint rows only |
| `achievements` | Crown-jewel wins from `data/crown_jewels.json` + optional Triple Crown |
| `titles` | Championship titles (F1 from `data/f1_seasons_history.json` `driver_champion`) |

## Rules

1. **Do not duplicate** `esc`, `dash`, `t`, `localize*`, or date parsers in `app.js` — use `window.TGA.*`.
2. **Do not re-export** helpers from `app.js` that already live in `tga-i18n` / `tga-utils` / `tga-dates-*`.
3. **Mutable UI state** goes in `window.TGA._state`, not loose `var` in `app.js`.
4. **`renderDetail`**: only one implementation — in `pages/series.js`.
