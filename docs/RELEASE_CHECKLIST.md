# Release Checklist

## Before merge/push

- [ ] `make ci` (или эквивалент: `go test ./...`, lint, `node scripts/js-test.mjs`, `node scripts/check-data.mjs`, data audits из Makefile)
- [ ] `git status` clean (или только ожидаемые изменения)
- [ ] При правках event JSON / schedules — сверить с `data/SERIES_TEMPLATES.md`
- [ ] При изменениях фронтенд-API — обновить `docs/WEB_TGA_API.md`
- [ ] После заполнения финала регулярки Cup/NOAPS/Truck — `/series/{id}/standings`: сид ~2000+, объект `chase.active`, линия отсечения (не править `data/standings/`)
- [ ] Super GT / ELMS / IMSA BoP UI: smoke из `docs/SMOKE_EVENTS.md` (qualifying Q1/Q2, ELMS race layout, `/bop`)

## Before deploy

- [ ] Проверены ключевые endpoint вручную:
  - `/health`
  - `/api/series`
  - `/api/events/{eventID}`
  - `/api/driver/{slug}`
- [ ] Проверены миграции/инициализация SQLite на целевой среде
- [ ] Прод-env: `TGA_ADMIN_TOKEN`, `TGA_TRUSTED_PROXY=1` (за proxy), Turnstile если SMTP feedback — см. `docs/RUNBOOK.md` §0
- [ ] Обновлены документы при изменениях API/данных

## After deploy

- [ ] `/health` = 200
- [ ] Нет всплеска `tga_api_errors_total{status_class="5xx"}`
- [ ] `tga_livesync_last_success_unix` обновляется
- [ ] p95 latency в допустимых пределах
