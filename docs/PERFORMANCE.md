# Performance Baseline

Быстрый базовый профиль производительности для `cmd/server` (локальный прогон).

## Environment

- OS: Windows 10
- Runtime: Go (`go run ./cmd/server`)
- Endpoint under test: `GET /api/series`
- Tool: `hey`

## Test scenarios and results

### 1) Smoke

Command:

```bash
hey -n 300 -c 10 http://localhost:8080/api/series
```

Result:

- RPS: `3607 req/s`
- p95 latency: `8.6 ms`
- error rate: `0%` (`300/300` HTTP 200)

### 2) Sustained (30s)

Command:

```bash
hey -z 30s -c 50 http://localhost:8080/api/series
```

Result:

- RPS: `4094 req/s`
- p95 latency: `37.8 ms`
- p99 latency: `74.8 ms`
- error rate: `0%` (`122,909` HTTP 200)

### 3) Spike-like (30s, high concurrency)

Command:

```bash
hey -z 30s -c 200 http://localhost:8080/api/series
```

Result:

- RPS: `2423 req/s`
- p95 latency: `284.5 ms`
- p99 latency: `591.6 ms`
- error rate: `0%` (`72,776` HTTP 200)

## Acceptance gates used

- sustained: `p95 < 250ms`, `error rate < 0.5%`
- spike-like: `error rate < 1%`

## 2026 optimizations (local dev)

Changes:

- `GET /api/schedule?season=2026` — one request for Full Schedule / Home instead of ~22 `/api/series/*/events`.
- Standings / stats: response cache checked **before** rebuild (`tryWriteSeriesJSONCache`).
- `EventDetailFileSet` — single walk of `data/events/` for `has_detail` on series events.

Quick checks (server running, `TGA_BOOTSTRAP=skip` optional):

```powershell
# Aggregated schedule (cold then warm)
Measure-Command { curl.exe -s -o NUL http://localhost:8080/api/schedule?season=2026 }
Measure-Command { curl.exe -s -o NUL http://localhost:8080/api/schedule?season=2026 }

# Standings: 2nd request should be much faster (cache hit, no rebuild)
Measure-Command { curl.exe -s -o NUL http://localhost:8080/api/series/cup/standings }
Measure-Command { curl.exe -s -o NUL http://localhost:8080/api/series/cup/standings }
```

In browser DevTools → Network on cold Home load: expect **one** `/api/schedule?...` (not many `/api/series/*/events`).

## Load testing (k6)

Результаты выше получены сценариями smoke / sustained / spike (1 VU×30s, 200 VU×10m, spike 0→500→0 VU).
Скрипты k6 в репозитории не хранятся; при необходимости повторить прогон — восстановите сценарии по порогам из раздела «Acceptance gates» или из истории коммитов.
