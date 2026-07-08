#!/usr/bin/env node
/**
 * Phase 3.0 + 3.1 smoke (automated). Complements manual browser pass in docs/SMOKE_EVENTS.md.
 * Run: node scripts/smoke-phase31.mjs [--base http://localhost:8080]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createEventCardDateApi } from './lib/load-event-card-date.mjs';
import { createLastResultsDatesApi } from './lib/load-last-results-dates.mjs';
import { stockCarRaceSectionPlan } from './stockcar-stages-plan.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.argv.find((a) => a.startsWith('--base='))?.slice(7)
  || (process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : null)
  || 'http://localhost:8080';

const results = [];

function check(id, label, ok, detail) {
  results.push({ id, label, ok, detail: detail || '' });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`${mark}  [${id}] ${label}${detail ? ` — ${detail}` : ''}`);
}

function loadEventJson(eventId) {
  const dirs = ['NASCAR Cup Series', 'NOAPS', 'NASCAR Truck', 'IMSA', 'F2', 'F1', 'SUPERCARS', 'ELMS', 'GT World Challenge Europe Endurance'];
  const lower = eventId.toLowerCase();
  for (const dir of dirs) {
    const y = eventId.match(/_(\d{4})_/)?.[1] || '2026';
    const p = path.join(root, 'data/events', dir, y, lower + '.json');
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  const flat = path.join(root, 'data/events', lower + '.json');
  if (fs.existsSync(flat)) return JSON.parse(fs.readFileSync(flat, 'utf8'));
  return null;
}

function qualCarNoColumnIndex(headers) {
  if (!Array.isArray(headers)) return 1;
  for (let ci = 0; ci < headers.length; ci++) {
    const hc = String(headers[ci] || '').trim().toLowerCase();
    if (hc === 'no.' || hc === 'no' || hc === 'car' || hc === '#') return ci;
  }
  return 1;
}

function qualifyingExcludingDidNotQualify(qualTable, dnqTable) {
  if (!qualTable || !dnqTable || !Array.isArray(qualTable.rows) || !dnqTable.rows?.length) return qualTable;
  const qualNoIdx = qualCarNoColumnIndex(qualTable.headers);
  const dnqNoIdx = qualCarNoColumnIndex(dnqTable.headers);
  const dnqNos = new Set(dnqTable.rows.map((row) => String(row[dnqNoIdx] || '').trim()).filter(Boolean));
  return {
    ...qualTable,
    rows: qualTable.rows.filter((row) => !dnqNos.has(String(row[qualNoIdx] || '').trim())),
  };
}

async function fetchOk(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  return res;
}

async function ensureServer() {
  try {
    const res = await fetchOk(`${base}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

async function apiEvent(eventId) {
  const res = await fetchOk(`${base}/api/events/${encodeURIComponent(eventId.toLowerCase())}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function loadSchedule(seriesFile) {
  return JSON.parse(fs.readFileSync(path.join(root, 'data/schedules', seriesFile), 'utf8'));
}

// --- Tier C: dates ---
const TGA = createEventCardDateApi();
const lastDates = createLastResultsDatesApi();

const f27 = loadSchedule('f2.json').find((e) => e.id === 'F2_2026_7');
if (f27) {
  const lrCard = {
    event: f27,
    rangeStart: '2026-07-04',
    rangeEnd: '2026-07-05',
  };
  const lr = lastDates.formatLastResultsCardDate(lrCard);
  const lrOk = (lr.includes('Jul 4') && lr.includes('Jul 5'))
    || (lr.includes('2026-07-04') && lr.includes('2026-07-05'));
  check('C-F2-LR', 'F2_2026_7 Last Results Jul 4–5', lrOk, lr);

  const sprintRow = {
    ...f27,
    name: 'Silverstone (Sprint)',
    start_date: '2026-07-04',
    end_date: '2026-07-04',
    _scheduleSessionKind: 'sprint',
  };
  const nextDay = TGA.formatNextRaceCardDate(sprintRow);
  check('C-F2-NR', 'F2_2026_7 Next Race single day', nextDay === 'Jul 4', nextDay);
}

const elms2 = loadSchedule('elms.json').find((e) => e.id === 'ELMS_2026_2');
if (elms2) {
  const r = TGA.getEventRaceDateRangeIso(elms2);
  check('C-ELMS', 'ELMS_2026_2 single race day', r.start === r.end, `${r.start}`);
}

const gtwce3 = loadSchedule('gtwce_end.json').find((e) => e.id === 'GTWCE_END_2026_3');
if (gtwce3) {
  const r = TGA.getEventRaceDateRangeIso(gtwce3);
  check('C-24H', 'GTWCE_END_2026_3 24h span', r.start && r.end && r.end > r.start, `${r.start}..${r.end}`);
}

const f15 = loadSchedule('f1.json').find((e) => e.id === 'F1_2026_5');
if (f15) {
  const r = TGA.getEventRaceDateRangeIso(f15);
  check('C-F1', 'F1_2026_5 sprint weekend span', r.start && r.end && r.end > r.start, `${r.start}..${r.end}`);
}

const scTownsville = ['SUPERCARS_2026_20', 'SUPERCARS_2026_21', 'SUPERCARS_2026_22'].map((id) =>
  loadSchedule('supercars.json').find((e) => e.id === id)).filter(Boolean);
check('C-SC-NR', 'Supercars Townsville 3 Next Race schedule rows', scTownsville.length === 3, `count=${scTownsville.length}`);
const scDates = scTownsville.map((e) => e.start_date);
check('C-SC-NR-dates', 'Townsville Race 1/2/3 dates Jul 10–12', scDates.join(',') === '2026-07-10,2026-07-11,2026-07-12', scDates.join(','));

const sc7 = loadSchedule('supercars.json').filter((e) =>
  ['SUPERCARS_2026_20', 'SUPERCARS_2026_21', 'SUPERCARS_2026_22'].includes(e.id));
check('C-SC-LR', 'Supercars Townsville weekend span for merge', sc7.length === 3 && sc7[0].circuit_name === sc7[1].circuit_name, sc7[0]?.circuit_name);

// --- Tier 3.1 data / layout ---
const imsa6 = loadEventJson('IMSA_2026_6');
check('A1-IMSA-data', 'IMSA_2026_6 has race + qualifying tables', !!(imsa6?.tables?.race && imsa6?.tables?.qualifying));
if (imsa6?.tables?.qualifying?.headers) {
  const hasClass = imsa6.tables.qualifying.headers.some((h) => /class/i.test(String(h)));
  check('A1-IMSA-class', 'IMSA_2026_6 qualifying has Class column', hasClass);
}

const cup18 = loadEventJson('NASCAR_CUP_2026_18');
const cup18plan = cup18 ? stockCarRaceSectionPlan(cup18, cup18.tables) : [];
check('A4-data', 'NASCAR_CUP_2026_18 race_results + stages', !!(cup18?.tables?.race_results?.rows?.length && cup18?.tables?.stage_1));
check('A4-stage', 'NASCAR_CUP_2026_18 stage layout', cup18plan.includes('table:race_results_as_stage_3'), cup18plan.join(', '));

const f26 = loadEventJson('F2_2026_6');
check('A5-data', 'F2_2026_6 race.sessions', !!(f26?.tables?.race?.sessions?.length));
check('A5-no-flat', 'F2_2026_6 no empty tables.sprint', !f26?.tables?.sprint || !f26.tables.sprint.rows?.length);

check('NASCAR-18', 'Sonoma: one final stage table', !cup18plan.includes('table:stage_3_points') && cup18plan.includes('table:race_results_as_stage_3'), cup18plan.join(', '));

const cup13 = loadEventJson('NASCAR_CUP_2026_13');
const cup13plan = cup13 ? stockCarRaceSectionPlan(cup13, cup13.tables) : [];
check('NASCAR-600', 'Charlotte 600: stage_3 points + race as stage 4', cup13plan.includes('table:stage_3_points') && cup13plan.includes('table:race_results_as_stage_4'), cup13plan.join(', '));

const cup1 = loadEventJson('NASCAR_CUP_2026_1');
if (cup1?.tables?.qualifying && cup1?.tables?.did_not_qualify) {
  const filtered = qualifyingExcludingDidNotQualify(cup1.tables.qualifying, cup1.tables.did_not_qualify);
  const qualNos = new Set(filtered.rows.map((r) => String(r[1]).trim()));
  const dnqNos = cup1.tables.did_not_qualify.rows.map((r) => String(r[1]).trim());
  const overlap = dnqNos.filter((n) => qualNos.has(n));
  check('NASCAR-1-DNQ', 'Daytona qual: no DNQ overlap in main table', overlap.length === 0, overlap.join(', '));
}

const noaps4 = loadEventJson('NOAPS_2026_4');
const qualRows = noaps4?.tables?.qualifying?.rows || [];
const hasSep = qualRows.some((row) => {
  const first = String(row[0] || '').trim().toLowerCase();
  if (!first) return false;
  return first === "qualified by owner's points" || first === 'failed to qualify' || first === 'did not qualify';
});
check('B-NOAPS-qual', 'NOAPS_2026_4 qual separator in rows', hasSep);

// --- Static bundle ---
const indexHtml = fs.readFileSync(path.join(root, 'web', 'index.html'), 'utf8');
for (const script of ['tga-dates-core.js', 'event-tables.js', 'event-page-helpers.js', 'last-results-dates.js', 'endurance-race.js', 'stockcar-race.js', 'openwheel-race.js', 'touring-race.js', 'event-pit-stops.js', 'event-bop.js', 'event-race-content.js', 'event-entry-list.js']) {
  check('bundle', `index.html loads ${script}`, indexHtml.includes(script));
}

// --- API (needs server) ---
const serverUp = await ensureServer();
check('server', `Server ${base}/health`, serverUp, serverUp ? '' : 'start: go run ./cmd/server');

if (serverUp) {
  for (const id of ['IMSA_2026_6', 'NASCAR_CUP_2026_18', 'F2_2026_6']) {
    try {
      const data = await apiEvent(id);
      check('api', `GET /api/events/${id.toLowerCase()}`, !!data.event_id, data.event_id);
    } catch (err) {
      check('api', `GET /api/events/${id.toLowerCase()}`, false, err.message);
    }
  }

  try {
    const res = await fetchOk(`${base}/`);
    const html = await res.text();
    check('home', 'Home page loads', res.ok && html.includes('next-race-cards'));
  } catch (err) {
    check('home', 'Home page loads', false, err.message);
  }
}

const failed = results.filter((r) => !r.ok);
console.log('\n=== Smoke summary ===');
console.log(`Passed: ${results.length - failed.length}/${results.length}`);
if (failed.length) {
  console.error('\nFailed checks:');
  for (const f of failed) console.error(`  - [${f.id}] ${f.label}: ${f.detail}`);
  process.exit(1);
}
console.log('All automated smoke checks passed.');
console.log('\nManual (browser): open event pages from docs/SMOKE_EVENTS.md — tables, sort, team links, rowspan.');
