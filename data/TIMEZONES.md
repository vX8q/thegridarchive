# Часовые пояса — справочник TGA

Единый источник данных для расчёта времени гонок:

| Файл | Назначение |
|------|------------|
| `data/timezones-reference.json` | Таблица UTC, правила DST 2026, IANA-идентификаторы, карта трасс |
| `scripts/lib/timezones.mjs` | Конвертация local → MSK с учётом DST на дату гонки |
| `web/data/timezones.js` | То же для браузера (генерируется скриптом) |

**Команды:**

```bash
node scripts/fill-schedule-times.mjs        # точечные правки time_est / time_msk
node scripts/validate-schedule-times.mjs    # проверка согласованности
```

При изменении `data/timezones-reference.json` обновите вручную `web/data/timezones.js` (или скопируйте `eventTimezones`, `eventRaceDates`, `locationRules`).

> **MSK** (`Europe/Moscow`, UTC+3) — без перевода часов с 2014 года.  
> TGA **не** использует фиксированные «зимние» смещения из таблицы — для каждой гонки берётся **IANA-зона** и **Intl** (DST на конкретную дату).

---

## Примечания к таблице

1. **Стандартное время** — «зимнее» (без DST). Летом в регионах с DST локальные часы на **1 ч впереди** (UTC-смещение на 1 ч ближе к нулю).
2. **Разница с MSK** меняется, если DST действует только в одном из поясов (MSK без DST).
3. **AST** — Atlantic Standard Time (UTC−4) **≠** Arabia Standard Time (UTC+3, как MSK).
4. **CST** — Central Standard Time, США (UTC−6) **≠** China Standard Time (UTC+8).
5. **Bahrain** (F1 Sakhir) — `Asia/Bahrain` UTC+3, **не** Dubai (UTC+4).
6. **Arizona** (Phoenix) — `America/Phoenix`, MST круглый год, **без DST**.
7. **Турция** — UTC+3 круглый год с 2016 (`Europe/Istanbul`).

---

## Полная таблица (UTC−12 … UTC+14)

| UTC | MSK зимой* | MSK летом* | Аббревиатуры | IANA (примеры) | Регионы | DST 2026 |
|-----|------------|------------|--------------|----------------|---------|----------|
| −12:00 | −15 ч | −15 ч | IDLW | `Etc/GMT+12` | О-ва Бейкер и Хауленд (США) | нет |
| −11:00 | −14 ч | −14 ч | SST, NUT | `Pacific/Pago_Pago`, `Pacific/Niue` | Американское Самоа, Ниуэ | нет |
| −10:00 | −13 ч | −13 ч | HST, CKT | `Pacific/Honolulu`, `Pacific/Rarotonga` | Гавайи, О-ва Кука, Таити | нет (Гавайи) |
| −09:30 | −12:30 | −12:30 | MART | `Pacific/Marquesas` | Маркизские о-ва | нет |
| −09:00 | −12 ч | −11 ч | AKST, AKDT | `America/Anchorage` | Аляска | **8 мар → 1 ноя** |
| −08:00 | −11 ч | −10 ч | PST, PDT | `America/Los_Angeles` | Тихоокеанское побережье США/Канады, **Las Vegas**, Long Beach | **8 мар → 1 ноя** |
| −07:00 | −10 ч | −9 ч | MST, MDT | `America/Denver`, `America/Phoenix` | Горные штаты; **Phoenix — без DST** | частично |
| −06:00 | −9 ч | −8 ч | CST, CDT | `America/Chicago` | Центр США, **Austin (F1)**, Road America | **8 мар → 1 ноя** |
| −05:00 | −8 ч | −7 ч | EST, EDT | `America/New_York` | Восток США/Канады, NASCAR, Daytona | **8 мар → 1 ноя** |
| −04:00 | −7 ч | −6 ч | AST (Atlantic), VET | `America/Puerto_Rico`, `America/Caracas` | Пуэрто-Рико, Венесуэла, Боливия | частично |
| −03:30 | −6:30 | −5:30 | NST, NDT | `America/St_Johns` | Ньюфаундленд | **8 мар → 1 ноя** |
| −03:00 | −6 ч | −6 ч | BRT, ART | `America/Sao_Paulo`, `America/Argentina/Buenos_Aires` | Бразилия, Аргентина, **Interlagos** | нет |
| −02:00 | −5 ч | −5 ч | FNT | `America/Noronha` | Fernando de Noronha | нет |
| −01:00 | −4 ч | −3 ч | CVT, AZOT | `Atlantic/Cape_Verde`, `Atlantic/Azores` | Кабо-Верде, Азоры | частично |
| ±00:00 | −3 ч | −2 ч | GMT, WET, WEST | `Europe/London`, `Europe/Lisbon` | Великобритания, Португалия, **Silverstone** | **29 мар → 25 окт** (ЕС) |
| +01:00 | −2 ч | −1 ч | CET, CEST | `Europe/Paris`, `Europe/Berlin`, `Europe/Rome` | ЕС, **Monaco, Spa, Monza** | **29 мар → 25 окт** |
| +02:00 | −1 ч | ±0 ч | EET, EEST | `Europe/Helsinki`, `Africa/Cairo` | Финляндия, Греция, Египет | частично |
| +03:00 | **±0 ч** | **±0 ч** | MSK, AST (Arabia) | `Europe/Moscow`, `Asia/Bahrain`, `Asia/Riyadh` | **Россия, Bahrain F1, Jeddah** | нет |
| +03:30 | +0:30 | +0:30 | IRST | `Asia/Tehran` | Иран | нет |
| +04:00 | +1 ч | +1 ч | GST, GET | `Asia/Dubai`, `Asia/Baku` | **Abu Dhabi F1**, Baku F1, ОАЭ | нет |
| +04:30 | +1:30 | +1:30 | AFT | `Asia/Kabul` | Афганистан | нет |
| +05:00 | +2 ч | +2 ч | YEKT, PKT | `Asia/Yekaterinburg`, `Asia/Karachi` | Урал, Пакистан | нет |
| +05:30 | +2:30 | +2:30 | IST | `Asia/Kolkata` | Индия | нет |
| +05:45 | +2:45 | +2:45 | NPT | `Asia/Kathmandu` | Непал | нет |
| +06:00 | +3 ч | +3 ч | OMST | `Asia/Omsk`, `Asia/Dhaka` | Омск, Бангladesh | нет |
| +06:30 | +3:30 | +3:30 | MMT | `Asia/Yangon` | Мьянма | нет |
| +07:00 | +4 ч | +4 ч | KRAT, ICT | `Asia/Bangkok` | Таиланд, Вьетнам | нет |
| +08:00 | +5 ч | +5 ч | CST (China), AWST | `Asia/Shanghai`, `Australia/Perth`, `Asia/Singapore` | **Shanghai F1**, Сингapur F1 | нет (Китай) |
| +08:45 | +5:45 | +5:45 | ACWST | `Australia/Eucla` | Центр.-Зап. Австралия | нет |
| +09:00 | +6 ч | +6 ч | JST, KST | `Asia/Tokyo`, `Asia/Seoul` | **Super GT, Suzuka F1** | нет |
| +09:30 | +6:30 | +7:30 | ACST, ACDT | `Australia/Adelaide` | Adelaide 500 | **4 окт → 5 апр** |
| +10:00 | +7 ч | +8 ч | AEST, AEDT | `Australia/Sydney`, `Australia/Melbourne` | **Supercars** | **4 окт → 5 апр** |
| +10:30 | +7:30 | +8:30 | LHST | `Australia/Lord_Howe` | О-в Лорд-Хау | **4 окт → 5 апр** |
| +11:00 | +8 ч | +8 ч | MAGT, SBT | `Asia/Magadan` | Магadan, Солomon Is. | нет |
| +12:00 | +9 ч | +10 ч | NZST, FJT | `Pacific/Auckland`, `Asia/Kamchatka` | **Supercars NZ**, Фidji | частично |
| +12:45 | +9:45 | +10:45 | CHAST | `Pacific/Chatham` | О-ва Чatham | **4 окт → 5 апр** |
| +13:00 | +10 ч | +10 ч | NZDT, TKT | `Pacific/Apia` | Samoa (летом), Tonga | частично |
| +14:00 | +11 ч | +11 ч | LINT | `Pacific/Kiritimati` | О-ва Line (Kiribati) | нет |

\* «MSK зимой/летом» — разница при **стандартном** UTC-смещении региона; при DST в регионе летняя колонка актуальна, MSK не меняется.

---

## DST в 2026 году

| Регион | Вперёд (+1 ч) | Назад (−1 ч) | Исключения |
|--------|---------------|--------------|------------|
| **США / Канада** | 8 марта | 1 ноября | Гавайи, большая часть **Arizona** |
| **ЕС** | 29 марта | 25 октября | Россия, Беларусь, Исландия |
| **Австралия** | 4 октября | 5 апреля | Квинсленд, WA, NT (частично) |
| **Марокко** | 22 марта | 15 февраля | Привязка к Рамадану, не к сезону |
| **Южное полушарие** | сен–окт | мар–апр | Чили, NZ, Австралия (частично) |

**Без DST:** Россия, Беларусь, Япония, Китай, Индия, ОАЭ, Saudi, Bahrain, Qatar, Brazil (с 2019), Argentina, Turkey.

---

## Трассы TGA → IANA (выборка)

| Трасса / серия | IANA | UTC (зима) |
|----------------|------|------------|
| Daytona, Charlotte, Watkins Glen | `America/New_York` | −5 |
| Phoenix Raceway | `America/Phoenix` | −7 (без DST) |
| COTA Austin, Road America, Chicago | `America/Chicago` | −6 |
| Long Beach, Las Vegas, Monterey | `America/Los_Angeles` | −8 |
| Montreal, Mosport | `America/Toronto` | −5 |
| Sakhir (Bahrain) | `Asia/Bahrain` | +3 (= MSK) |
| Abu Dhabi | `Asia/Dubai` | +4 |
| Jeddah | `Asia/Riyadh` | +3 (= MSK) |
| Suzuka, Super GT | `Asia/Tokyo` | +9 |
| Shanghai | `Asia/Shanghai` | +8 |
| Singapore | `Asia/Singapore` | +8 |
| Melbourne, Bathurst | `Australia/Melbourne` / `Sydney` | +10/+11 AEDT |
| Auckland (Supercars) | `Pacific/Auckland` | +12/+13 NZDT |
| Monaco, Monza, Imola | `Europe/Monaco` / `Rome` | +1/+2 CEST |
| Spa, Zandvoort | `Europe/Brussels` / `Amsterdam` | +1/+2 CEST |
| Interlagos | `America/Sao_Paulo` | −3 |

Полный список правил по тексту локации — в `locationRules` внутри `data/timezones-reference.json`.

---

## Форматы `time_msk` в расписаниях

| Серия | Формат | Пример |
|-------|--------|--------|
| NASCAR / ARCA / NOAPS | embedded, **дата = US race day** | `3/8/26 05:30` |
| IndyCar | plain или embedded | `20:00` или `4/20/26 03:30` |
| IMSA | embedded (MSK calendar) | `4/20/26 02:00` |
| F1 / F2 / F3 | plain MSK | `16:00` |
| Supercars | embedded | `2/20/26 11:50` |

Официальная база IANA: [tzdata](https://www.iana.org/time-zones).
