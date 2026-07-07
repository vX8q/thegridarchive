# TGA — The Grid Archive

![CI](https://github.com/vX8q/tga/actions/workflows/ci.yml/badge.svg)

Автоспортивный веб-сервис и API на Go: расписания, результаты, турнирные таблицы, статистика пилотов и live-данные по **21 чемпионату**. Данные актуальны для сезона **2026** (`config.CurrentSeason`).

## Возможности

- Единая база данных по всем основным автоспортивным сериям мира
- Расписания этапов, результаты гонок и квалификаций, сессии
- Турнирные таблицы (личный и командный зачёт)
- Статистика пилотов, команд, трасс и Head-to-Head сравнения
- Live-данные: NASCAR Feed, OpenF1 API, WEC и Super Formula (синхронизация каждые 2 минуты)
- История F1 (чемпионы 1950–2026, очки, шасси, моторы)
- Форма обратной связи (`/feedback`) с опциональной почтой и Cloudflare Turnstile
- Prometheus-метрики и admin-эндпоинты для мониторинга
- Интернационализация **EN / RU** (переключатель в шапке), тёмная и светлая тема
- Русская локализация контента: имена пилотов, географические названия, названия этапов, превью гонок, статистика гонки, спецификации машин и UI-строки (названия команд и конструкторов остаются на английском)

## Чемпионаты

| Категория | Серии |
|-----------|-------|
| **Открытые колеса** | Formula 1, IndyCar, Super Formula, Formula 2, Formula 3, FREC, Italian F4 |
| **Сток-кар** | NASCAR Cup, NASCAR O'Reilly Auto Parts (Xfinity), NASCAR Craftsman Truck, ARCA Menards, Whelen Modified Tour |
| **Марафоны** | WEC, ELMS, IMSA |
| **Туринг** | Supercars, GT World Challenge Europe (Endurance & Sprint), Porsche Supercup, DTM, Super GT |

## Технологии

| Компонент | Стек |
|-----------|------|
| Бэкенд | Go 1.26, `net/http`, `slog` |
| БД | SQLite через `modernc.org/sqlite` (pure Go, без CGO) |
| Фронтенд | Vanilla JS SPA, CSS, клиентская маршрутизация |
| Метрики | Prometheus (`prometheus/client_golang`) |
| Rate Limiting | `golang.org/x/time/rate` |
| CI | GitHub Actions (тесты + golangci-lint) |
| Деплой | Docker + Cloudflare Tunnel |

## Структура проекта

```
TGA/
├── cmd/
│   ├── server/                  # Основной HTTP-сервер (live-sync в том же процессе)
│   ├── sync-nascar-live/        # Отдельный CLI: синхронизация NASCAR → live.json
│   ├── sync-openf1-live/        # Отдельный CLI: синхронизация OpenF1 → live.json
│   ├── sync-wec-live/           # Отдельный CLI: синхронизация WEC → live.json
│   ├── sync-superformula-live/  # Отдельный CLI: синхронизация Super Formula → live.json
│   ├── fetch-driver-wikidata/   # Обогащение данных пилотов из Wikidata
│   └── normalize-event-tables/  # Нормализация JSON-таблиц этапов
├── config/                      # Определения чемпионатов (один файл на серию)
├── models/                      # Доменные модели: Series, Event, Race, Result, Driver, Team
├── internal/
│   ├── store/                   # Интерфейс Store + SQLite-реализация
│   ├── schedulefile/            # Загрузка JSON-данных: расписания, результаты, standings
│   ├── eventscaffold/           # Автосоздание пустых JSON-скелетов этапов при старте сервера
│   ├── livesync/                # Live-синхронизация NASCAR, OpenF1, WEC, Super Formula
│   ├── driverutil/              # Slug-генерация для пилотов
│   ├── tableutil/               # Вспомогательные функции для таблиц
│   ├── appenv/                  # Поиск data-директории (TGA_DATA, CWD, рядом с бинарником)
│   └── cache/                   # TTL-кэш
├── web/                         # Фронтенд: index.html, style.css, app.js, компоненты
│   ├── utils/                   # Словари RU (пилоты, места, этапы), translit, spec-маппинги
│   ├── data/                    # Статические справочники (translations, IMSA classes и т.д.)
│   ├── components/              # Переиспользуемые UI-блоки (карточки, расписание)
│   ├── pages/                   # Страницы SPA (series, event, schedule, list)
│   └── lib/                     # api.js, router.js, state.js, deps.js
├── data/                        # JSON-данные проекта
│   ├── schedules/               # Расписания серий (JSON)
│   ├── events/                  # Детали этапов: SeriesName/year/eventID.json
│   ├── teams/                   # Составы команд
│   ├── standings/               # Снимки standings (только часть серий; остальное считается из events)
│   ├── live.json                # Live-данные (обновляются livesync)
│   ├── driver_profiles.json     # Профили пилотов
│   └── driver_profile_redirects.json  # Редиректы slug → канонический профиль
├── scripts/                     # Node.js-скрипты для подготовки/нормализации данных (см. ниже)
├── docs/                        # Заметки по архитектуре, метрикам и эксплуатации
│   ├── DATA_ISSUES.md           # Известные проблемы и расхождения в данных
│   ├── PERFORMANCE.md           # Базовый профиль производительности + команды прогонов
│   ├── METRICS.md               # Продуктовые и технические метрики Prometheus
│   ├── RUNBOOK.md               # Действия при инцидентах
│   ├── RELEASE_CHECKLIST.md     # Чеклист перед и после релиза
│   └── WEB_TGA_API.md           # Публичный API фронтенда (`window.TGA`)
├── cloudflared/                 # Пример конфигурации туннеля (config.example.yml)
├── .github/workflows/           # CI: тесты + линтер
├── Dockerfile                   # Multi-stage build (alpine)
├── docker-compose.yml           # app + Cloudflare Tunnel
├── Makefile                     # build, dev, test, lint, ci, docker
└── go.mod
```

## Быстрый старт

### Требования

- **Go 1.26+**
- (Опционально) **Docker** и **Docker Compose** для контейнерного запуска
- (Опционально) **Make** для удобных команд

### Локальный запуск

```bash
git clone https://github.com/vX8q/tga.git
cd tga
go run ./cmd/server
```

Сервер запустится на **http://localhost:8080**.

Если в корне проекта есть `.env`, сервер загрузит его автоматически. Для почты с формы фидбека создайте `.env` и задайте как минимум `TGA_FEEDBACK_SMTP_USER` и `TGA_FEEDBACK_SMTP_PASS` (для Gmail — [App Password](https://support.google.com/accounts/answer/185833)). Опционально: `TGA_FEEDBACK_FROM`, `TGA_FEEDBACK_TO`, `TGA_FEEDBACK_SMTP_HOST`, `TGA_FEEDBACK_SMTP_PORT`. Для публичного сайта добавьте `TGA_TURNSTILE_SITE_KEY` и `TGA_TURNSTILE_SECRET_KEY` — тогда форма будет проверять Cloudflare Turnstile.

При старте сервер:
1. Загружает JSON из `data/` в SQLite (`bootstrapStoreFromFiles`)
2. Создаёт пустые скелеты недавних этапов без файла результатов (`internal/eventscaffold`, окно «Last Results» + 7 дней)
3. Запускает фоновую live-синхронизацию (`internal/livesync`, каждые 2 минуты)

### Сборка и запуск бинарника

```bash
go build -trimpath -o server ./cmd/server/
./server            # Linux/macOS
# server.exe        # Windows
```

Через Makefile (на Windows выходные файлы — `server.exe`, `fetch-wikidata.exe`):

```bash
make build
make run            # build + запуск server.exe
```

### Смена порта

```bash
PORT=3000 go run ./cmd/server
```

PowerShell:

```powershell
$env:PORT="3000"; go run ./cmd/server
```

### Скрипты обслуживания данных (`scripts/`)

| Скрипт | Назначение |
|--------|------------|
| `fill-schedule-times.mjs` | Заполнение `time_est` / `time_msk` в `data/schedules/` (см. `data/TIMEZONES.md`) |
| `validate-schedule-times.mjs` | Проверка времени в расписаниях |
| `build-multi-race-schedule-sessions.mjs` | Генерация `web/data/multi-race-schedule-sessions.js` |
| `sync-stockcar-table-teams.mjs` | Колонка Team в stock-car tables ↔ `entry_list` |
| `stats-columns-sanity.mjs` | Проверка покрытия колонок stats |
| `sync-driver-profiles-from-events.mjs` | Пересборка `driver_profiles.json` из events |
| `sync-sf-table-teams.mjs` | Team-колонки в Super Formula events |

### Отдельные live-sync CLI (опционально)

Если сервер не запущен постоянно, можно гонять по cron (см. `data/LIVE_README.md`):

- `go run ./cmd/sync-nascar-live`
- `go run ./cmd/sync-openf1-live`
- `go run ./cmd/sync-wec-live`
- `go run ./cmd/sync-superformula-live`

## Docker

### Сборка и запуск вручную

```bash
docker build -t tga:latest .
docker run --rm -p 8080:8080 -v "$(pwd)/data:/app/data" tga:latest
```

### Docker Compose (с Cloudflare Tunnel)

```bash
# Укажи токен туннеля в .env
echo "CLOUDFLARE_TUNNEL_TOKEN=your-token" > .env
docker compose up -d
```

Compose запускает два сервиса:
- **app** — TGA-сервер (`hostname: app`, healthcheck на `/health`; порт не публикуется)
- **cloudflared** — стартует после готовности app; туннель смотрит на **`http://app:8080`**

В Cloudflare Zero Trust (Public Hostname) укажи origin **`http://app:8080`**, не `localhost`. Подробнее: `cloudflared/config.example.yml`.

Контейнер app работает от пользователя **UID 1000**; при проблемах с SQLite на bind-mount `./data` проверь права на каталог.

## Переменные окружения

| Переменная | По умолчанию | Описание |
|------------|-------------|----------|
| `PORT` | `8080` | Порт HTTP-сервера |
| `TGA_DATA` | авто → `data/` | Путь к данным; если не задан — ищется через `internal/appenv` |
| `TGA_WEB` | авто → `web/` | Путь к статике; если не задан — ищется рядом с CWD/бинарником |
| `TGA_RESET_DB_ON_START` | — | `1` = пересоздать SQLite при старте |
| `TGA_ENABLE_ADMIN` | — | `1` = включить admin-эндпоинты |
| `TGA_ADMIN_TOKEN` | — | Токен для admin и pprof (обязателен при `TGA_ENABLE_ADMIN=1`) |
| `TGA_RATE_LIMIT_RPS` | `0` | Лимит запросов/сек на IP (`0` = выключен) |
| `TGA_ENABLE_PPROF` | — | `1` = включить `/debug/pprof/*` (требуется `TGA_ADMIN_TOKEN`) |
| `LOG_LEVEL` | slog default | Если задан: `debug`, `info`, `warn`, `error` |
| `TGA_FEEDBACK_SMTP_HOST` | `smtp.gmail.com` | SMTP-хост для писем с формы фидбека |
| `TGA_FEEDBACK_SMTP_PORT` | `587` | SMTP-порт |
| `TGA_FEEDBACK_SMTP_USER` | — | Логин SMTP |
| `TGA_FEEDBACK_SMTP_PASS` | — | Пароль SMTP |
| `TGA_FEEDBACK_FROM` | как `TGA_FEEDBACK_SMTP_USER` | Адрес отправителя |
| `TGA_FEEDBACK_TO` | `bobbtga@gmail.com` | Получатель фидбека |
| `TGA_TURNSTILE_SITE_KEY` | — | Публичный ключ Cloudflare Turnstile |
| `TGA_TURNSTILE_SECRET_KEY` | — | Secret Turnstile |
| `CLOUDFLARE_TUNNEL_TOKEN` | — | Токен Cloudflare Tunnel (для docker-compose) |

## API

### Публичные эндпоинты

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/health` | Статус сервера (503 при деградации) |
| `GET` | `/metrics` | Prometheus-метрики |
| `GET` | `/api/series` | Список всех серий |
| `GET` | `/api/series/{id}` | Метаданные серии (`?season=` опционально) |
| `GET` | `/api/series/{id}/events` | Этапы серии |
| `GET` | `/api/series/{id}/teams` | Команды и составы |
| `GET` | `/api/series/{id}/standings` | Турнирная таблица |
| `GET` | `/api/series/{id}/stats` | Статистика серии |
| `GET` | `/api/series/{id}/headtohead` | H2H-сравнения пилотов |
| `GET` | `/api/series/f1/history` | История F1 (1950–2026) |
| `GET` | `/api/events/{eventID}` | Детали этапа (сессии, результаты) |
| `GET` | `/api/live-events` | Текущие/ближайшие live-события |
| `GET` | `/api/live-boards` | Live-борды (NASCAR, OpenF1); алиас: `/api/nascar-live` |
| `POST` | `/api/feedback` | Отправка сообщения с формы обратной связи |
| `GET` | `/api/feedback/config` | Включён ли Turnstile и публичный site key |
| `GET` | `/api/drivers` | Список пилотов для поиска (имя, slug) |
| `GET` | `/api/driver-profile-redirects` | Редиректы slug → канонический профиль |
| `GET` | `/api/drivers/primary-context` | Основной контекст пилота по сезону (`?season=`, по умолчанию 2026) |
| `GET` | `/api/driver/{slug}` | Профиль пилота + результаты сезона |
| `GET` | `/api/driver-thumb/{slug}` | Миниатюра фото пилота (PNG) |
| `GET` | `/api/flag/{iso2}` | Флаг страны (PNG, ISO 3166-1 alpha-2, напр. `gb`) |
| `GET` | `/api/team-logo/{slug}` | Логотип команды (PNG или SVG-fallback) |
| `GET` | `/api/card-bg/{filename}` | Фон карточки трассы из `web/images/` |

Статика фронтенда: `GET /web/*`, редирект `GET /favicon.ico` → `/web/favicon.svg`.

### Admin-эндпоинты

Требуют `TGA_ENABLE_ADMIN=1` и заголовок `X-Admin-Token` или `Authorization: Bearer <token>`.

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/api/admin/data-health` | Проверка целостности данных по сериям |
| `GET` | `/api/admin/data-diff` | Diff данных |
| `POST` | `/api/admin/reimport-stockcar` | Реимпорт stock-car данных |

### SPA-маршруты

Следующие пути отдают `index.html` для клиентской маршрутизации:

`/`, `/schedule`, `/live`, `/feedback`, `/search`, `/series/*`, `/season/*`, `/track/*`, `/driver/*`, `/team/*`, `/crew-chief/*`

Отдельно: `GET /event/*` — тоже `index.html` (legacy-URL этапов).

Редирект: `/series/f1` → `/season/f1-2026` (текущий сезон, `config.CurrentSeason`). История чемпионатов — `/series/f1/history`, API — `/api/series/f1/history`.

## Архитектура

```
┌─────────────────────────────────────────────────────────┐
│                     web/ (SPA)                          │
│  Vanilla JS · Client-side routing · i18n (EN/RU)       │
│  web/utils/*-ru.js · tga-i18n.js · localize-ru-data   │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP
┌────────────────────────▼────────────────────────────────┐
│                  cmd/server (Go)                        │
│  net/http · middleware (CORS, rate limit, trace ID,     │
│  panic recovery) · handlers · eventscaffold · static  │
├─────────────────────┬──────────────────┬────────────────┤
│  internal/store     │  schedulefile    │  livesync      │
│  SQLite (R/W)       │  JSON files (RO) │  NASCAR+OpenF1 │
│                     │  + scaffold    │  +WEC+Super F1 │
└─────────┬───────────┴────────┬─────────┴────────┬───────┘
          │                    │                   │
    ┌─────▼──────┐    ┌───────▼────────┐   ┌──────▼──────┐
    │ tga.sqlite │    │  data/*.json   │   │  live.json  │
    └────────────┘    └────────────────┘   └─────────────┘
```

Данные хранятся в JSON-файлах в `data/`.
SQLite (`data/tga.sqlite`) используется для быстрых запросов и обновляется при старте через `bootstrapStoreFromFiles`.
Live-данные обновляются из внешних API фоновым циклом внутри `cmd/server`.

## Интернационализация (RU)

Переключатель языка в шапке (`EN` / `RU`). Логика — в `web/tga-i18n.js`, статические UI-строки — в `web/data/translations.js`.

### Что переводится на русский

| Область | Источник |
|---------|----------|
| UI (кнопки, заголовки, таблицы) | `web/data/translations.js`, атрибуты `data-i18n` в `index.html` |
| Имена пилотов | `web/utils/driver-names-ru.js` + `driver-name-ru-resolve.js` (сокращения, суффиксы `(i)` / `(R)`, транслит через `name-translit-ru.js`) |
| Города, штаты, регионы | `web/utils/place-names-ru.js` (названия трасс остаются на английском) |
| Названия этапов / уик-эндов | `web/utils/event-names-ru.js`, `driver-season-ru.js` |
| Превью гонки | поле `event_preview_ru` в JSON этапа (fallback — `event_preview` с подстановкой имён пилотов) |
| Статистика гонки, статусы, причины схода | `web/utils/localize-ru-data.js` |
| Спецификации машин (ключи и значения) | `web/utils/spec-*-ru.js`, `spec-value-*.js` |

### Что остаётся на английском

- Названия команд, конструкторов, производителей в таблицах и entry list
- Названия трасс / circuit name
- Имена пилотов в API (`/api/drivers`, `/api/driver/{slug}`) — канонические латинские

Словари редактируются напрямую в `web/utils/`. Локальные рабочие экспорты (`data/driver-names-full-*.txt`, `data/event_previews_ru*`) в `.gitignore` и в репозиторий не попадают.

Подробнее о фронтенд-API: `docs/WEB_TGA_API.md`.

## Данные

Данные хранятся в JSON-файлах и редактируются напрямую:

- `data/schedules/{seriesID}.json` — расписания этапов
- `data/events/{SeriesName}/{year}/{eventID}.json` — детали этапов (результаты, сессии, таблицы), например `data/events/F1/2026/f1_2026_1.json`
- `data/teams/{seriesID}.json` — составы команд
- `data/standings/{seriesID}.json` — **опциональные** снимки standings (`nascar_cup`, `noaps`, `nascar_truck`, `arca`, `nascar_modified`, `supercars`, `imsa`, `elms`, `indycar`); у остальных серий таблица **считается** из `events/` через `internal/schedulefile` (F1, GTWCE, DTM и др.)
- `data/driver_profiles.json` — профили пилотов
- `data/driver_profile_redirects.json` — старые slug → канонический профиль
- `data/live.json` — live-данные (пишет `livesync` в `cmd/server` или CLI `sync-*-live`)
- `data/tga.sqlite` — кэш БД (создаётся при старте, не редактировать вручную)

Поле `event_preview_ru` в JSON этапа — русский текст превью гонки (см. раздел «Интернационализация»).

## Мониторинг

### Prometheus-метрики (`GET /metrics`)

Помимо стандартных Go-метрик, доступны:

| Метрика | Описание |
|---------|----------|
| `http_request_duration_seconds{method,route,status}` | Latency всех HTTP-запросов |
| `tga_livesync_errors_total{source,reason}` | Счётчик ошибок live-синхронизации |
| `tga_livesync_last_success_unix{source}` | Unix-время последней успешной синхронизации |
| `tga_api_series_views_total` | Чтения endpoint по сериям |
| `tga_api_event_views_total` | Чтения endpoint деталей этапов |
| `tga_api_driver_views_total` | Чтения endpoint профиля пилота |
| `tga_api_live_events_reads_total` | Чтения endpoint live-событий |
| `tga_api_admin_reads_total` | Чтения admin endpoint |
| `tga_api_errors_total{endpoint,status_class}` | Ошибки API по endpoint и классу статуса |
| `tga_api_business_request_duration_seconds{endpoint}` | Latency ключевых продуктовых endpoint |

Где `source` — `nascar`, `openf1`, `wec` или `super_formula`; `reason` — тип ошибки (`live_feed`, `no_events`, `write_live_json` и т.д.).

Подробное описание и примеры проверки — в `docs/METRICS.md`.

### Health-check

`GET /health` возвращает JSON со статусом и информацией о БД. Код **503** при отсутствии SQLite или ошибке.

### Admin: проверка данных

`GET /api/admin/data-health` — JSON с полями по каждой серии: `ok`, `missing`, `events`, `has_db`, `db_degraded`.

## Makefile

| Команда | Описание |
|---------|----------|
| `make build` | Сборка `server.exe` + `fetch-wikidata.exe` (Windows-имена в Makefile) |
| `make run` | `build` + запуск `server.exe` |
| `make dev` | Запуск в dev-режиме (`go run ./cmd/server`) |
| `make test` | Тесты с `-race` (с fallback) |
| `make lint` | golangci-lint (с fallback на `go vet`) |
| `make ci` | `test` + `lint` |
| `make docker` | Сборка образа + запуск контейнера |

## Hot Reload (Air)

Проект настроен для [Air](https://github.com/air-verse/air). Конфигурация в `.air.toml`:

```bash
# Установка Air
go install github.com/air-verse/air@latest

# Запуск с hot reload
air
```

Air отслеживает `.go`-файлы, пересобирает бинарник во `./tmp/server.exe` и перезапускает при изменениях.

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) запускаются на push/PR в `main`/`master`:

- **test** — `go test ./... -count=1 -v` и `go vet ./...`
- **lint** — `golangci-lint` (govet, staticcheck, gosimple, ineffassign, gosec, misspell, errcheck, revive; см. `.golangci.yml`)

Локальная сборка и Docker используют **Go 1.26** (`go.mod`, `Dockerfile`).

Интеграционные API-тесты (happy-path/404/500) находятся в `cmd/server/integration_api_test.go` и запускаются вместе с `go test ./...`.
Базовые результаты нагрузочных тестов зафиксированы в `docs/PERFORMANCE.md`.

## Лицензия

Проект пока не имеет открытой лицензии. Все права защищены.
