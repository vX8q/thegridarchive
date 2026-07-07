#!/usr/bin/env node
/**
 * Tier A recap + selective Tier B + home-card checks (automated).
 * Run: node scripts/smoke-tier-ab.mjs [--base http://localhost:8080]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEventJson } from './lib/load-event-json.mjs';
import { loadRenderModules } from './lib/load-render-modules.mjs';
import { createWeekendMergeApi } from './lib/load-event-card-date.mjs';
import { stockCarRaceSectionPlan } from './stockcar-stages-plan.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.argv.find((a) => a.startsWith('--base='))?.slice(7)
  || (process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : null)
  || 'http://localhost:8080';

const TGA = loadRenderModules();
const merge = createWeekendMergeApi();
const results = [];

function check(id, label, ok, detail) {
  results.push({ id, label, ok, detail: detail || '' });
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${id}] ${label}${detail ? ` — ${detail}` : ''}`);
}

function loadSchedule(seriesFile) {
  return JSON.parse(fs.readFileSync(path.join(root, 'data/schedules', seriesFile), 'utf8'));
}

function noColIndex(headers) {
  if (!Array.isArray(headers)) return -1;
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i] || '').trim().toLowerCase();
    if (h === 'no.' || h === 'no' || h === '#') return i;
  }
  return -1;
}

function hasLeadingZeroCarNo(rows, headers) {
  const ni = noColIndex(headers);
  if (ni < 0 || !Array.isArray(rows)) return false;
  return rows.some((row) => {
    const s = String(row[ni] || '').trim();
    return /^0\d+$/.test(s) && s !== '0';
  });
}

function qualHasSeparator(rows) {
  return (rows || []).some((row) => {
    const first = String(row[0] || '').trim().toLowerCase();
    if (!first) return false;
    return first === "qualified by owner's points" || first === 'failed to qualify' || first === 'did not qualify';
  });
}

async function ensureServer() {
  try {
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

// --- Tier A ---
const f26 = loadEventJson('F2_2026_6');
check('A-F2-data', 'F2_2026_6 race.sessions present', !!(f26?.tables?.race?.sessions?.length));
if (f26?.tables?.practice) {
  check('A-F2-practice', 'F2_2026_6 practice table', !!(f26.tables.practice.headers && f26.tables.practice.rows?.length));
}
if (f26?.tables?.qualifying) {
  const q = TGA.transformTableDataForF2F3(f26.tables.qualifying, 'F2_2026_6');
  check('A-F2-qual-chassis', 'F2 qual: no Chassis column after transform', !q.headers.some((h) => String(h).toLowerCase() === 'chassis'));
  check('A-F2-meta', 'F2: no Session info table flag', TGA.shouldShowSessionMetaTable('F2_2026_6', 'f2') === false);
  const title = TGA.openwheelSessionTableTitle(f26.tables.practice, 'Practice', 'f2');
  check('A-F2-title', 'F2 practice short title', title === 'Practice' || title === 'Practice 1' || (title && title.indexOf('Championship') < 0), title);
}

const f15 = loadEventJson('F1_2026_5');
if (f15?.tables?.race_results) {
  const rr = TGA.normalizeF1RaceGridColumn(f15.tables.race_results);
  const stIdx = rr.headers.findIndex((h) => String(h).trim() === 'St');
  const gridIdx = rr.headers.findIndex((h) => String(h).toLowerCase() === 'grid');
  check('A-F1-st', 'F1_2026_5 race_results has St not Grid', stIdx === 1 && gridIdx < 0);
}
if (f15?.tables?.race?.sessions?.[0]) {
  const t = TGA.localizeF1RaceSessionTitle(f15.tables.race.sessions[0].title, 'F1_2026_5', (k) => k);
  check('A-F1-title', 'F1 session title localized key', typeof t === 'string');
}

const sc5 = loadEventJson('SUPERCARS_2026_5');
if (sc5?.tables?.race?.sessions?.[0]) {
  const sess = sc5.tables.race.sessions[0];
  const out = TGA.transformSupercarsRaceTable(sess.headers, sess.rows, null);
  check('A-SC-race', 'Supercars_2026_5 race table shape', out.headers[0] === 'Pos' && out.headers[1] === 'ST');
  check('A-SC-no', 'Supercars_2026_5 no leading-zero car numbers', !hasLeadingZeroCarNo(out.rows, out.headers));
}

const ic5 = loadEventJson('INDYCAR_2026_5');
if (ic5?.tables?.race_results) {
  const rr = TGA.normalizeIndycarRaceTable(ic5.tables.race_results);
  check('A-IC-st', 'IndyCar_2026_5 Start Pos → St', rr.headers.includes('St') && !rr.headers.includes('Start Pos'));
  const driverCol = rr.headers.findIndex((h) => String(h).toLowerCase() === 'driver');
  const hasBadPalou = (rr.rows || []).some((r) => String(r[driverCol] || '') === 'alex Palou');
  check('A-IC-palou', 'IndyCar_2026_5 Alex Palou casing', !hasBadPalou);
}
if (ic5?.tables?.caution_breakdown) {
  const cb = TGA.dropIndycarCautionFreePassColumn(ic5.tables.caution_breakdown);
  check('A-IC-caution', 'IndyCar caution: no Free Pass column', !cb.headers.some((h) => /free pass/i.test(String(h))));
}
if (ic5?.entry_list) {
  const bad = ic5.entry_list.some((e) => String(e.driver || '') === 'alex Palou');
  check('A-IC-entry', 'IndyCar entry_list Alex Palou', !bad);
}

// --- Tier B ---
const f35 = loadEventJson('F3_2026_5');
const f3HasSessions = !!(f35?.tables?.race?.sessions?.length);
const f3HasPracticeQual = !!(f35?.tables?.practice?.headers || f35?.tables?.qualifying?.headers);
check('B-F3-data', 'F3_2026_5 practice/qual or race.sessions', f3HasSessions || f3HasPracticeQual);
if (f35?.tables?.qualifying) {
  const q = TGA.transformTableDataForF2F3(f35.tables.qualifying, 'F3_2026_5');
  check('B-F3-qual', 'F3 qual transform ok', q.headers.length > 0);
  check('B-F3-meta', 'F3 no Session info flag', TGA.shouldShowSessionMetaTable('F3_2026_5', 'f3') === false);
}

const frec4 = loadEventJson('FREC_2026_4');
const frecSessions = frec4?.tables?.race?.sessions?.length || 0;
check('B-FREC-races', 'FREC_2026_4 multiple race sessions', frecSessions >= 2, `sessions=${frecSessions}`);

for (const sid of ['SUPERCARS_2026_1', 'SUPERCARS_2026_2', 'SUPERCARS_2026_3']) {
  const ev = loadEventJson(sid);
  const has8 = ev?.entry_list?.some((e) => String(e.number) === '8');
  if (ev?.tables?.practice?.rows) {
    const tbl = TGA.supercarsSydneyCarDisplay({ headers: ev.tables.practice.headers, rows: ev.tables.practice.rows });
    const ni = noColIndex(tbl.headers);
    const shows800 = (tbl.rows || []).some((r) => String(r[ni]) === '800');
    check(`B-SYD-${sid}`, `${sid} Sydney 800 display when #8 entered`, !has8 || shows800);
  } else {
    check(`B-SYD-${sid}`, `${sid} event loaded`, !!ev);
  }
}

const dtm4 = loadEventJson('DTM_2026_4');
const dtmRaces = dtm4?.tables?.race?.sessions?.length || (dtm4?.tables?.race_results ? 1 : 0);
check('B-DTM-data', 'DTM_2026_4 race data', dtmRaces >= 1, `sessions=${dtm4?.tables?.race?.sessions?.length || 0}`);

const noaps4 = loadEventJson('NOAPS_2026_4');
check('B-NOAPS-qual', 'NOAPS_2026_4 qual separators in rows', qualHasSeparator(noaps4?.tables?.qualifying?.rows));

const cup18 = loadEventJson('NASCAR_CUP_2026_18');
if (cup18) {
  const plan = stockCarRaceSectionPlan(cup18, cup18.tables);
  check('B-CUP18-plan', 'NASCAR_CUP_2026_18 stage plan (filled reference)', plan.length > 0, plan.join(', '));
}
const cup19 = loadEventJson('NASCAR_CUP_2026_19');
check('B-CUP19-shell', 'NASCAR_CUP_2026_19 stage tables present', !!(cup19?.tables?.stage_1 && cup19?.tables?.race_results));

// --- Home / Townsville ---
const scTownsville = ['SUPERCARS_2026_20', 'SUPERCARS_2026_21', 'SUPERCARS_2026_22']
  .map((id) => loadSchedule('supercars.json').find((e) => e.id === id))
  .filter(Boolean);
check('C-SC-NR-count', 'Townsville 3 Next Race schedule rows', scTownsville.length === 3);
check('C-SC-NR-dates', 'Townsville Jul 10–12', scTownsville.map((e) => e.start_date).join(',') === '2026-07-10,2026-07-11,2026-07-12');

const lrCards = scTownsville.map((e, i) => ({
  event: e,
  rangeStart: e.start_date,
  rangeEnd: e.end_date,
  dateStr: e.end_date,
  winners: [{ label: `Race ${i + 1}`, car: '1', name: 'Winner' }],
}));
const merged = merge.mergeLastResultsWeekendCards(lrCards, 'SUPERCARS');
check('C-SC-LR-merge', 'Townsville Last Results → 1 card', merged.length === 1);
if (merged[0]) {
  check('C-SC-LR-span', 'Merged span Jul 10–12', merged[0].rangeStart === '2026-07-10' && merged[0].rangeEnd === '2026-07-12');
  check('C-SC-LR-name', 'Merged name drops Race N suffix', !/Race\s*\d+$/i.test(merged[0].event.name), merged[0].event.name);
}

// --- API ---
const serverUp = await ensureServer();
check('server', `Server ${base}/health`, serverUp, serverUp ? '' : 'go run ./cmd/server');

if (serverUp) {
  const apiIds = [
    'F2_2026_6', 'F1_2026_5', 'SUPERCARS_2026_5', 'INDYCAR_2026_5',
    'F3_2026_5', 'FREC_2026_4', 'DTM_2026_4', 'NOAPS_2026_4',
  ];
  for (const id of apiIds) {
    try {
      const res = await fetch(`${base}/api/events/${id.toLowerCase()}`, { signal: AbortSignal.timeout(8000) });
      const data = res.ok ? await res.json() : null;
      check('api', `GET /api/events/${id.toLowerCase()}`, res.ok && data?.event_id === id, res.ok ? '' : `HTTP ${res.status}`);
    } catch (err) {
      check('api', `GET /api/events/${id.toLowerCase()}`, false, err.message);
    }
  }
  try {
    const res = await fetch(`${base}/`, { signal: AbortSignal.timeout(8000) });
    const html = await res.text();
    check('home', 'Home page loads', res.ok && html.includes('next-race-cards'));
  } catch (err) {
    check('home', 'Home page loads', false, err.message);
  }
}

const failed = results.filter((r) => !r.ok);
console.log('\n=== Tier A/B smoke summary ===');
console.log(`Passed: ${results.length - failed.length}/${results.length}`);
if (failed.length) {
  console.error('\nFailed:');
  for (const f of failed) console.error(`  [${f.id}] ${f.label}: ${f.detail}`);
  process.exit(1);
}
console.log('\nAll automated Tier A/B checks passed.');
console.log('Manual browser pass still recommended — see docs/SMOKE_EVENTS.md');
