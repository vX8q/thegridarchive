# Live-статус событий (мигающая иконка LIVE)

Список событий «идёт прямо сейчас» хранится в **`data/live.json`**. Его отдаёт API **`GET /api/live-events`**; фронтенд раз в минуту обновляет список и показывает мигающую метку LIVE на карточках в блоке «NEXT RACE».

## Формат `data/live.json`

Допустимы два варианта:

**Массив ID событий:**
```json
["NASCAR_CUP_2026_3", "SUPERCARS_2026_1"]
```

**Объект с полем `live_event_ids`:**
```json
{
  "live_event_ids": ["NASCAR_CUP_2026_3"]
}
```

ID события — тот же, что в расписании и в `data/events/` (например `NASCAR_CUP_2026_3`, `SUPERCARS_2026_4`). Регистр не важен.

## Как обновлять

### Вручную
Во время уик-энда откройте `data/live.json` и добавьте/удалите нужные `event_id`. После сохранения файла интерфейс подхватит изменения в течение ~1 минуты (или при обновлении страницы).

Пример: идёт DuraMAX Grand Prix (NASCAR Cup, 3-й этап 2026) — в расписании это `NASCAR_CUP_2026_3`. Добавьте в массив:
```json
["NASCAR_CUP_2026_3"]
```
Когда гонка закончится — уберите этот ID или очистите массив до `[]`.

### NASCAR — автоматическая синхронизация (официальный API)

Используется **официальный API NASCAR** [feed.nascar.com](https://feed.nascar.com/swagger/ui/index). При запуске **`cmd/server`** фоновый **livesync** каждые **2 минуты** опрашивает Live Feed, определяет текущую гонку (Cup / Xfinity / Truck) и обновляет `data/live.json`. Отдельный cron не нужен, пока работает сервер.

**Запуск вручную (без сервера):**
```bash
go run ./cmd/sync-nascar-live -data-dir=./data
```

**По cron** — только если сервер не запущен постоянно:
```bash
*/2 * * * * cd /path/to/TGA && go run ./cmd/sync-nascar-live -data-dir=./data
```
Или соберите бинарник и вызывайте его: `go build -o sync-nascar-live ./cmd/sync-nascar-live`.

Поддерживаются серии: **NASCAR Cup** (`nascar_cup`), **Xfinity** (`noaps`), **Truck** (`nascar_truck`). Маппинг NASCAR `race_id` → наш `event_id` идёт по дате гонки из `data/schedules/*.json`. Утилита **объединяет** свой результат с уже записанными в `live.json` (не затирает F1 и др.).

### F1 — OpenF1 (api.openf1.org)

Интеграция с **OpenF1** (неофициальный, бесплатный API):

- **LIVE-бейдж** — фоновый livesync ищет сессию текущего уик-энда (`meeting_key=latest`) в окне `date_start`…`date_end` и пишет `F1_2026_X` в `live.json`.
- **Live-таблица** — на вкладке `/live` (как NASCAR): позиции, команда, решётка, отставание (в гонке — из `/v1/intervals` **по каждому пилоту**, не полный дамп), номер круга лидера (кэш ~45 с). API: `GET /api/live-boards` (топ-**22**).

**Запуск вручную (без сервера):**
```bash
go run ./cmd/sync-openf1-live -data-dir=./data
```

**Проверка на уик-энде:** `/live` и `/api/live-debug` (блок `openf1`: `live_session`, `board`, `mapped_event_id`).

Сервер (`cmd/server`) уже синхронизирует NASCAR, F1, WEC и Super Formula в одном фоновом цикле. CLI-утилиты нужны только для ручного прогона или cron без сервера.

### WEC — ECM live JSON (Google Cloud Storage)

Публичный снимок тайминга Al Kamel / ECM:

- **LIVE-бейдж** — livesync читает `https://storage.googleapis.com/ecm-prod/live/WEC/data.json`, проверяет `raceState` / прогресс сессии и пишет `WEC_2026_X` в `live.json` (маппинг по `startTime` → дата уик-энда в `data/schedules/wec.json`).
- **Live-таблица** — на `/live`: позиции, команда/шасси, класс, отставание, круг. API: `GET /api/live-boards` (топ-**22**).

**Запуск вручную:**
```bash
go run ./cmd/sync-wec-live -data-dir=./data
```

**Проверка:** `/api/live-debug` (блок `wec`: `snapshot`, `board`, `mapped_event_id`).

Вне сессии JSON может оставаться «застывшим» с финишным `raceState` (например `Chk`) — LIVE не включается.

### Super Formula — RaceNow WebSocket

Официальный live timing RaceLive / RaceNow:

- **LIVE-бейдж** — livesync читает снимок RaceNow из **фонового кэша** (обновление каждые ~30 с, не блокирует цикл `Run`), пишет `SUPER_FORMULA_2026_X` по ближайшей дате уик-энда в расписании.
- **Live-таблица** — позиции, команда, двигатель, отставание, круги.

**Запуск вручную:**
```bash
go run ./cmd/sync-superformula-live -data-dir=./data
```

**Проверка:** `/api/live-debug` (блок `super_formula`).

WebSocket доступен **только во время сессий**; вне уик-энда соединение отклоняется — это нормально.

### Остальные чемпионаты

У Supercars, IndyCar и др. публичного API статуса «live» нет. Для них — **ручное** обновление `live.json` или запасной вариант на фронте по времени (start_date/end_date).

## Проверенные источники live timing

| Источник | Серии | Доступ | Примечание |
|----------|--------|--------|------------|
| **NASCAR feed** | Cup, Xfinity, Truck | Бесплатно, публичный API | Уже интегрирован: `sync-nascar-live`. [feed.nascar.com](https://feed.nascar.com/swagger/ui/index). |
| **OpenF1** | Только Formula 1 | Бесплатно, без ключа | LIVE-бейдж + live-таблица на `/live` (`/api/live-boards`). Сессии: `meeting_key=latest`; позиции/интервалы по `session_key`. |
| **ECM WEC JSON** | WEC | Бесплатно, публичный GCS | LIVE-бейдж + live-таблица (`sync-wec-live`). `storage.googleapis.com/ecm-prod/live/WEC/data.json`. |
| **RaceNow WebSocket** | Super Formula | Бесплатно | LIVE-бейдж + live-таблица (`sync-superformula-live`). `ws://superformula.racelive.jp:6001/get`. |
| **Sportradar** | F1, IndyCar, NASCAR, MotoGP, Formula E и др. | Платно (есть trial) | Официальный поставщик данных для многих чемпионатов. Live Data по F1 (gRPC), расписания и результаты IndyCar/NASCAR. Регистрация: [developer.sportradar.com](https://developer.sportradar.com). Для коммерческого использования — контракт. |
| **Ergast** | F1 | Бесплатно | Только исторические данные, без live. [ergast.com](https://ergast.com/mrd/). |

Итого: для **автоматического** LIVE без платных подписок сейчас реалистичны **NASCAR**, **F1 (OpenF1)**, **WEC (ECM JSON)** и **Super Formula (RaceNow)**. Остальные серии — вручную или по времени из расписания.

## Логика на фронте

- Если **event_id есть в ответе `/api/live-events`** — карточка сразу помечается как LIVE (мигающая иконка и подпись «LIVE»).
- Для серий с **автоматическим livesync** (NASCAR Cup/Xfinity/Truck, F1, WEC, Super Formula) **запасной LIVE по времени отключён** — только `live.json` / API. Иначе бейдж мог бы гореть по расписанию, когда внешний фид молчит.
- Для **остальных** чемпионатов (Supercars, IndyCar, …) при пустом `live.json` LIVE по-прежнему может загораться, если текущее время попадает в интервал `start_date`…`end_date` карточки.

То есть для интегрированных серий заполнение `live.json` (вручную или через livesync) — единственный источник LIVE на карточках NEXT RACE; для остальных — ручной `live.json` или эвристика по календарю.
