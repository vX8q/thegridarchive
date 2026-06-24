# TGA — The Grid Archive

![CI](https://github.com/vX8q/tga/actions/workflows/ci.yml/badge.svg)

Автоспортивный веб-сервис и API на Go: расписания, результаты, турнирные таблицы, статистика пилотов и live-данные по **22 чемпионатам**. Данные актуальны для сезона **2026** (`config.CurrentSeason`).

## Возможности

- Единая база данных по всем основным автоспортивным сериям мира
- Расписания этапов, результаты гонок и квалификаций, сессии
- Турнирные таблицы (личный и командный зачёт)
- Статистика пилотов, команд, трасс и Head-to-Head сравнения
- Live-данные: NASCAR Feed, OpenF1 API, WEC и Super Formula (синхронизация каждые 2 минуты)
- История F1 (чемпионы 1950–2025, очки, шасси, моторы)
- Prometheus-метрики и admin-эндпоинты для мониторинга
- Интернационализация **EN / RU** (переключатель в шапке), тёмная и светлая тема
- Русская локализация контента: имена пилотов, географические названия, названия этапов, превью гонок, статистика гонки, спецификации машин и UI-строки (названия команд и конструкторов остаются на английском)

## Чемпионаты

| Категория | Серии |
|-----------|-------|
| **Formula** | Formula 1, Formula 2, Formula 3, FREC, Italian F4, Porsche Supercup |
| **Stock Car** | NASCAR Cup, NASCAR Xfinity (O'Reilly), NASCAR Truck (Craftsman), ARCA Menards, Whelen Modified Tour |
| **Open-Wheel** | IndyCar, Super Formula |
| **Touring** | Supercars, DTM, Super GT |
| **Endurance** | WEC, ELMS, IMSA |
| **GT** | GT World Challenge Europe (Endurance & Sprint) |

## Технологии

| Компонент | Стек |
|-----------|------|
| Бэкенд | Go 1.24, `net/http`, `slog` |
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
├── scripts/                     # Node.js-скрипты для подготовки/нормализации данных
├── k6/                          # Load-testing сценарии (smoke, sustained, spike)
├── docs/                        # Заметки по архитектуре, метрикам и эксплуатации
│   ├── DATA_ISSUES.md           # Известные проблемы и расхождения в данных
│   ├── PERFORMANCE.md           # Базовый профиль производительности + команды прогонов
│   ├── METRICS.md               # Продуктовые и технические метрики Prometheus
│   ├── RUNBOOK.md               # Действия при инцидентах
│   └── RELEASE_CHECKLIST.md     # Чеклист перед и после релиза
├── cloudflared/                 # Пример конфигурации туннеля (config.example.yml)
├── .github/workflows/           # CI: тесты + линтер
├── Dockerfile                   # Multi-stage build (alpine)
├── docker-compose.yml           # app + Cloudflare Tunnel
├── Makefile                     # build, dev, test, lint, ci, docker
└── go.mod
```

## Быстрый старт

### Требования

- **Go 1.24+**
- (Опционально) **Docker** и **Docker Compose** для контейнерного запуска
- (Опционально) **Make** для удобных команд

### Локальный запуск

```bash
git clone https://github.com/vX8q/tga.git
cd tga
go run ./cmd/server
```

Сервер запустится на **http://localhost:8080**.

Если в корне проекта есть `.env`, сервер загрузит его автоматически. Для отправки писем с формы фидбека скопируйте значения из `.env.example` в `.env` и замените `TGA_FEEDBACK_SMTP_PASS` на Google App Password. Для публичного сайта можно также заполнить `TGA_TURNSTILE_SITE_KEY` и `TGA_TURNSTILE_SECRET_KEY`, тогда форма фидбека будет проверять Cloudflare Turnstile.

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
| `TGA_ENABLE_PPROF` | — | `1` = включить `/debug/pprof/*` (требуется admin-токен) |
| `LOG_LEVEL` | slog default | Если задан: `debug`, `info`, `warn`, `error` |
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
| `GET` | `/api/series/f1/history` | История F1 (1950–2025) |
| `GET` | `/api/events/{eventID}` | Детали этапа (сессии, результаты) |
| `GET` | `/api/live-events` | Текущие/ближайшие live-события |
| `GET` | `/api/drivers` | Список пилотов для поиска (имя, slug) |
| `GET` | `/api/drivers/primary-context` | Основной контекст пилота по сезону (`?season=`, по умолчанию 2026) |
| `GET` | `/api/driver/{slug}` | Профиль пилота + результаты сезона |
| `GET` | `/api/driver-thumb/{slug}` | Миниатюра фото пилота (PNG) |
| `GET` | `/api/flag/{iso2}` | Флаг страны (PNG, ISO 3166-1 alpha-2, напр. `gb`) |
| `GET` | `/api/team-logo/{slug}` | Логотип команды (PNG или SVG-fallback) |

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

`/`, `/schedule`, `/search`, `/series/*`, `/season/*`, `/track/*`, `/driver/*`, `/team/*`, `/crew-chief/*`

Отдельно: `GET /event/*` — тоже `index.html` (legacy-URL этапов).

Редирект: `/series/f1` → `/series/f1/history` (страница F1 — история сезонов; текущий сезон — `/season/f1-2026`).

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
- `data/events/{seriesID}_{year}_{n}.json` **или** `data/events/{SeriesName}/{year}/{eventID}.json` — детали этапов (результаты, сессии, таблицы). Для новых файлов предпочтителен вложенный путь по серии; часть серий (например IndyCar) ещё использует плоские имена в корне `data/events/`
- `data/teams/{seriesID}.json` — составы команд
- `data/standings/{seriesID}.json` — **опциональные** снимки standings (Cup, Truck, Supercars и др.); у большинства серий таблица **считается** из `events/` через `internal/schedulefile`
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

Локальная сборка и Docker используют **Go 1.24** (`go.mod`, `Dockerfile`).

Интеграционные API-тесты (happy-path/404/500) находятся в `cmd/server/integration_api_test.go` и запускаются вместе с `go test ./...`.
Базовые результаты нагрузочных тестов зафиксированы в `docs/PERFORMANCE.md`.

Локальный прогон k6-сценариев:

```bash
k6 run k6/smoke.js
k6 run k6/sustained.js
k6 run k6/spike.js
```

## Лицензия

Проект пока не имеет открытой лицензии. Все права защищены.
