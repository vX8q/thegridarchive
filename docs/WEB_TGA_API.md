# window.TGA public API

The frontend uses **IIFE scripts** + `window.TGA` as a shared namespace (no ES modules yet).

## Script load order (`web/index.html`)

```
data/*  →  utils/fetch-json.js  →  lib/api.js  →  lib/state.js
  →  tga-i18n.js  →  tga-utils.js  →  components/*  →  pages/schedule.js  →  pages/list.js
  →  series-supercars.js  →  tga-series.js  →  pages/series.js  →  lib/router.js  →  app.js
```

## `lib/api.js` — HTTP API client

Wraps `window.TGA.fetchJSON` with typed methods. All `/api/*` fetches should go through `window.TGA.API` (Phase 2+).

| Method | Endpoint |
|--------|----------|
| `getSeries()` | `/api/series` |
| `getSeriesMeta(seriesId)` | `/api/series/:id` |
| `getSeriesTeams(seriesId)` | `/api/series/:id/teams` |
| `getSeriesStandings(seriesId, options?)` | `/api/series/:id/standings` |
| `getSeriesStats(seriesId)` | `/api/series/:id/stats` |
| `getSeriesEvents(seriesId, season?, options?)` | `/api/series/:id/events` |
| `getSeriesHistory(seriesId)` | `/api/series/:id/history` |
| `getEvent(eventId, options?)` | `/api/events/:id` |
| `getDriver(slug, options?)` | `/api/driver/:slug` |
| `getDrivers()` | `/api/drivers` |
| `getDriversPrimaryContext()` | `/api/drivers/primary-context` |
| `getLiveEvents()` | `/api/live-events` |
| `safe(fn)` | Promise wrapper with logger on reject |
| `fetchJSON(url, opts?)` | Escape hatch (deprecated for new code) |

**Options:** `{ cacheBust: false }` skips the `_=` timestamp query param (matches legacy calls that omitted it).

## `lib/state.js` — `window.TGA._state`

| Field | Owner | Purpose |
|-------|-------|---------|
| `loadedSeriesId` | series.js / app.js | Current series detail page |
| `eventCache` | app.js | Cached event JSON by API id |
| `eventPageLoadGeneration` | app.js | Stale-guard for fast tab switches |
| `searchIndexItems` | app.js | Search index cache |
| `searchIndexReady` | app.js | Search index loaded flag |
| `searchIndexLoading` | app.js | Search index in-flight |
| `searchInitDone` | app.js | Header search wired |

## `tga-i18n.js` — i18n, theme, time, localization

Single source for: `t`, `getLang`, `setLang`, `setTheme`, `translateStaticUI`, `localize*`, `formatTimeForDisplay`, `getTimeSettings`, etc.

`setLang` clears `state.eventCache` and `state.loadedSeriesId`, then calls `window.TGA.route()` if defined.

## `tga-utils.js` — DOM/format helpers

Single source for: `esc`, `dash`, `slugify`, `driverDisplayName`, guest-entry helpers, `categories`, `categoryBySeriesId`, `seriesBadge`, date formats (`formatShortDate`, `formatDateRange`, `parseEventDate`), `addObjectTableSort`, `countryHtml`, panel padding, Supercars static specs.

## `tga-series.js` — F1 static data helpers

Exports F1 2025 teams/chassis/engine/tech-spec data and `buildF1TeamsTableHTML`.

**Does not** export `renderDetail` — see `pages/series.js`.

## `pages/series.js` — series/season detail page

| Export | Description |
|--------|-------------|
| `renderDetail(seriesId, subPath?)` | `/series/:id`, `/season/:slug` — schedule, teams, standings, specs, stats, history |
| `rebuildNascarCupDayFromDaytona(data)` | NASCAR Cup DAY column from Daytona 500 results |
| `renderF1StaticSpecsIfNeeded()` | F1 technical regulations on specs tab (also on `load`) |

Includes static F1 history data (1950–2026 champions) for `/series/f1/history`.

## `lib/router.js` — SPA routing

| Export | Description |
|--------|-------------|
| `route` | Match `pathname` → page handler on `window.TGA` |
| `navigate(href)` | `pushState` + scroll + `route()` |
| `initRouter()` | Wire `popstate`, `pageshow`, link click delegation; call once from `app.js` |

`route()` delegates to handlers registered by `app.js` before `initRouter()`.

## `pages/schedule.js` — full schedule + home feed

| Export | Description |
|--------|-------------|
| `renderSchedulePage` | `/schedule` and `/?full_schedule=1` |
| `loadGlobalSchedule` | Home page: fetch all events, next-race + last-results cards |
| `fetchAllEvents` | (internal) aggregate events across series + static fallbacks |
| `formatDateRangeLong` | Event header date range (`March 5–8, 2026`) |
| `parseMetaDateToISO` | Parse `meta.Date` strings |
| `getEventSessionDateRange` | Min/max session dates from event JSON |
| `applySchedulePastVisibility` | Hide past rows on schedule page |
| `monthDayToISO` | `"March 8"` → `2026-03-08` |
| `getGlobalEventsCache` / `setGlobalEventsCache` | Cached merged schedule for event header fallback |
| `filterVisibleEvents(events)` | Filter hidden events from schedule lists (currently pass-through) |

## `pages/list.js` — series list (home)

Uses `loadGlobalSchedule` from `pages/schedule.js`.

## `app.js` — page renderers

Registers handlers, then calls `initRouter()`:

| Export | Description |
|--------|-------------|
| `showView` | Toggle `#view-*` panels |
| `renderSearchPage` | `/search?q=…` |
| `renderEventPage` | `/event/:id/:section` |
| `renderDriverDetail` | `/driver/:slug` |
| `renderTrackDetail` | `/track/:slug` |
| `renderTeamDetail` | `/team/:slug` |
| `renderCrewChiefDetail` | `/crew-chief/:slug` |

Schedule helpers (`formatDateRangeLong`, etc.) live in `pages/schedule.js`; `app.js` uses thin `window.TGA.*` aliases.

## Components (`web/components/*`)

Each file exports one or more functions on `window.TGA` (e.g. `renderNextRaceCards`, `buildScheduleHTML`, `makeSimpleTableSortable`).

## Rules (Phase 0+)

1. **Do not duplicate** `esc`, `dash`, `t`, `localize*` in `app.js` — use `window.TGA.*`.
2. **Do not re-export** helpers from `app.js` that already live in `tga-i18n` / `tga-utils`.
3. **Mutable UI state** goes in `window.TGA._state`, not loose `var` in `app.js`.
4. **`renderDetail`**: only one implementation — in `pages/series.js`.
