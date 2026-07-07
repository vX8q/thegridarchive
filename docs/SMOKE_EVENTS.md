# Smoke events (ручная проверка после рефакторинга)

Формат URL: `/event/{slug}/{section}` (slug = `event_id` lowercase, `_` → `-`).

Чеклист копировать в PR description.

---

## Tier A — после каждого подшага 3.x

| ID | Slug | Секции | Семейство | Модуль |
|----|------|--------|-----------|--------|
| `IMSA_2026_6` | `imsa-2026-6` | overview, race, qualifying | endurance | 3.2 |
| `WEC_2026_2` | `wec-2026-2` | race, entry_list | endurance | 3.2 |
| `ELMS_2026_2` | `elms-2026-2` | race | endurance | 3.2 |
| `NASCAR_CUP_2026_19` | `nascar-cup-2026-19` | race, qualifying | stockcar | 3.3 |
| `F2_2026_6` | `f2-2026-6` | race, qualifying, practice | openwheel | 3.4 |
| `F1_2026_5` | `f1-2026-5` | race, qualifying | openwheel (sprint) | 3.4 |
| `SUPERCARS_2026_5` | `supercars-2026-5` | race | touring | 3.5 |
| `INDYCAR_2026_5` | `indycar-2026-5` | race | touring | 3.5 |

### 3.1 event-tables (дополнительно к A4+A5)

| ID | Зачем |
|----|-------|
| `IMSA_2026_6` | class tables, IMSA column surgery |
| `NASCAR_CUP_2026_19` | team rowspan |
| `F2_2026_6` | driver links, sort |

---

## Tier B — после завершения 3.5

| ID | Slug | Edge case |
|----|------|-----------|
| `IMSA_2026_5` | `imsa-2026-5` | Detroit GTP qual/grid |
| `GTWCE_END_2026_3` | `gtwce-end-2026-3` | 24h Spa |
| `WEC_2026_3` | `wec-2026-3` | Le Mans classes |
| `FREC_2026_4` | `frec-2026-4` | 3 races |
| `F3_2026_5` | `f3-2026-5` | F3 sessions |
| `DTM_2026_4` | `dtm-2026-4` | Race 1+2 |
| `GTWCE_SPRINT_2026_1` | `gtwce-sprint-2026-1` | dual race |
| `PSC_2026_3` | `psc-2026-3` | support series |
| `SUPER_FORMULA_2026_6` | `super-formula-2026-6` | Fuji triple |
| `NOAPS_2026_4` | `noaps-2026-4` | qual separator |
| `NASCAR_CUP_2026_ALLSTAR_RACE` | `nascar-cup-2026-allstar-race` | All-Star |
| `IMSA_2026_PRE_SEASON_TEST` | `imsa-2026-pre-season-test` | pre_season_tests |

---

## Tier C — даты (после 3.0)

| ID | Где | Ожидание |
|----|-----|----------|
| `F2_2026_7` | `/` Last Results | диапазон **Jul 4–5** |
| `F2_2026_7` | `/` Next Race | **один день** (Sprint или Feature), не Jul 4–5 |
| `ELMS_2026_2` | `/`, header | один день гонки |
| `GTWCE_END_2026_3` | header | 24h → 2 календарных дня |
| `F1_2026_5` | header | sprint span |
| `SUPERCARS_2026_20`–`22` | `/` Next Race | **3 карточки** Townsville Race 1/2/3, Jul 10/11/12 |
| `SUPERCARS_2026_7` | `/` Last Results | **одна** карточка на уик-энд Townsville |

---

## PR checklist (копипаст)

```markdown
## Smoke

### 3.0 dates
- [ ] F2_2026_6 — weekend range on cards
- [ ] ELMS_2026_2 — single race day on card
- [ ] GTWCE_END_2026_3 — 24h header span
- [ ] F1_2026_5 — sprint weekend meta
- [ ] SUPERCARS_2026_5 — merged Last Results card

### 3.x render (отметить нужное)
- [ ] A1 IMSA_2026_6 /race
- [ ] A4 NASCAR_CUP_2026_19 /race
- [ ] A5 F2_2026_6 /race
- [ ] A6 F1_2026_5 /race
- [ ] A7 SUPERCARS_2026_5 /race
```
