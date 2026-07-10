# Runbook

## 0) Production deploy checklist

Перед публичным деплоем задайте в `.env` (или secrets в orchestrator):

| Переменная | Обязательно | Зачем |
|------------|-------------|--------|
| `TGA_ADMIN_TOKEN` | **Да** (прод) | `/metrics`, admin API, pprof |
| `TGA_TRUSTED_PROXY` | **Да** (прод за proxy) | `1` — брать IP клиента из `X-Forwarded-For` / `X-Real-IP` для rate limit и feedback |
| `TGA_TURNSTILE_SITE_KEY` + `TGA_TURNSTILE_SECRET_KEY` | **Да**, если настроен SMTP фидбека | Сервер не стартует без них при `TGA_FEEDBACK_SMTP_*` |
| `TGA_RATE_LIMIT_RPS` | Рекомендуется | Например `10`–`20` на IP |
| Reverse proxy | **Да** (прод) | Cloudflare Tunnel / nginx перед приложением; не отдавайте `:8080` напрямую в интернет |

**Проверка после деплоя:**

```bash
curl -fsS https://your-host/health
curl -fsS -H "X-Admin-Token: $TGA_ADMIN_TOKEN" https://your-host/metrics | head
curl -fsS https://your-host/api/series | head -c 200
```

`/metrics` без токена с внешнего IP должен возвращать **403** (если `TGA_ADMIN_TOKEN` задан).  
Feedback с SMTP: форма должна показывать Turnstile (`GET /api/feedback/config` → `turnstile_enabled: true`).

**Trusted proxy:** за Cloudflare Tunnel / nginx задайте `TGA_TRUSTED_PROXY=1`, чтобы rate limit и feedback hash использовали реальный IP клиента. Без этого заголовки `X-Forwarded-For` **игнорируются** (защита от спуфинга при прямом доступе к `:8080`).

---

## 1) Рост 5xx по API

1. Проверить `/health`.
2. Проверить `/metrics`:
   - `tga_api_errors_total{status_class="5xx"}`
   - `http_request_duration_seconds`
3. Проверить логи сервера (`panic recovered`, `bootstrap failed`, `store health failed`).
4. Если проблема в SQLite, перезапустить сервис и проверить доступность `data/tga.sqlite`.

## 2) Live-события не обновляются

1. Проверить `tga_livesync_errors_total{source="nascar|openf1"}`.
2. Проверить `tga_livesync_last_success_unix`.
3. Проверить актуальность `data/live.json`.
4. Проверить доступ к внешним API (NASCAR Feed/OpenF1).

## 3) Деградация latency

1. Проверить `http_request_duration_seconds` и `tga_api_business_request_duration_seconds`.
2. Проверить нагрузку CPU/RAM и наличие I/O bottleneck на `data/` и SQLite.
3. При необходимости временно снизить RPS извне или включить более жёсткий лимит.

## 4) Rollback (3 шага)

1. Откатить деплой к предыдущему коммиту/образу.
2. Перезапустить сервис.
3. Проверить `/health` и базовые endpoint (`/api/series`, `/api/events/{id}`).
