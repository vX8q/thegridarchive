#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const eventsRoot = path.join(repoRoot, 'data', 'events');

const stockCarSeries = new Set(['NASCAR Cup Series', 'NOAPS', 'NASCAR Truck Series', 'NASCAR Truck', 'ARCA', 'NASCAR Modified']);
const classSeries = ['IMSA', 'WEC', 'ELMS', 'GT World Challenge', 'Super GT'];

function inferSeriesFromEvent(file, event) {
  const id = String(event.event_id || event.id || path.basename(file, '.json')).toLowerCase();
  if (id.startsWith('indycar_')) return 'IndyCar';
  if (id.startsWith('nascar_cup_')) return 'NASCAR Cup Series';
  if (id.startsWith('nascar_truck_')) return 'NASCAR Truck';
  if (id.startsWith('nascar_modified_')) return 'NASCAR Modified';
  if (id.startsWith('supercars_')) return 'Supercars';
  if (id.startsWith('super_gt_')) return 'Super GT';
  if (id.startsWith('gtwce_sprint_')) return 'GT World Challenge Europe Sprint';
  if (id.startsWith('gtwce_end_')) return 'GT World Challenge Europe Endurance';
  if (id.startsWith('imsa_')) return 'IMSA';
  if (id.startsWith('wec_')) return 'WEC';
  if (id.startsWith('elms_')) return 'ELMS';
  if (id.startsWith('dtm_')) return 'DTM';
  if (id.startsWith('f1_')) return 'F1';
  if (id.startsWith('f2_')) return 'F2';
  if (id.startsWith('f3_')) return 'F3';
  if (id.startsWith('arca_')) return 'ARCA';
  if (id.startsWith('noaps_')) return 'NOAPS';
  return event.series || path.basename(file);
}

function walkJson(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkJson(p));
    else if (ent.isFile() && ent.name.endsWith('.json')) out.push(p);
  }
  return out;
}

function asTableList(event) {
  const tables = event && event.tables ? event.tables : {};
  const race = tables.race || tables.race_results;
  if (!race) return [];
  if (Array.isArray(race.sessions)) {
    return race.sessions.filter((s) => Array.isArray(s.headers) && Array.isArray(s.rows));
  }
  if (Array.isArray(race.headers) && Array.isArray(race.rows)) return [race];
  return [];
}

function colIndex(headers, names) {
  const normalized = headers.map((h) => String(h || '').trim().toLowerCase());
  for (const name of names) {
    const idx = normalized.indexOf(name.toLowerCase());
    if (idx >= 0) return idx;
  }
  return -1;
}

function numericCell(value) {
  const n = Number(String(value || '').replace(',', '.').trim());
  return Number.isFinite(n) ? n : 0;
}

function addReason(map, key, reason) {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(reason);
}

const bySeries = new Map();
for (const file of walkJson(eventsRoot)) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    continue;
  }
  const rel = path.relative(eventsRoot, file);
  const parts = rel.split(path.sep);
  const series = parts.length > 1 ? parts[0] : inferSeriesFromEvent(file, parsed);
  if (!bySeries.has(series)) {
    bySeries.set(series, { files: 0, raceTables: 0, raceRows: 0, raceSessions: 0, columns: new Map(), zeroVisible: [] });
  }
  const acc = bySeries.get(series);
  acc.files++;
  const tables = asTableList(parsed);
  if (tables.length === 0) continue;
  acc.raceTables += tables.length;
  if (tables.length > 1) acc.raceSessions += tables.length;

  const isStockCar = stockCarSeries.has(series);
  const isClassSeries = classSeries.some((needle) => series.toLowerCase().includes(needle.toLowerCase()));

  for (const table of tables) {
    const headers = table.headers || [];
    const rows = table.rows || [];
    acc.raceRows += rows.length;
    addReason(acc.columns, 'driver', 'base identity column');
    addReason(acc.columns, 'team', 'base identity column');
    addReason(acc.columns, 'starts', 'race result rows found');
    addReason(acc.columns, 'wins', 'finish position exists');
    addReason(acc.columns, 'avg_finish', 'finish position exists');

    if (colIndex(headers, ['No', 'No.', '#', 'Car', 'Car No', 'CAR NO']) >= 0) addReason(acc.columns, 'car', 'car-number header exists');
    if (colIndex(headers, ['Manufacturer', 'Chassis', 'Make', 'Engine']) >= 0) addReason(acc.columns, series === 'IndyCar' ? 'engine' : 'manufacturer', 'manufacturer/engine header exists');
    if (colIndex(headers, ['Grid', 'St', 'Start', 'Started', 'Start Pos']) >= 0) {
      addReason(acc.columns, 'poles', 'start/grid header exists');
      addReason(acc.columns, 'avg_start', 'start/grid header exists');
      addReason(acc.columns, 'pos_diff', 'start/grid header exists');
    } else {
      addReason(acc.columns, 'poles', 'fallback from qualifying when available');
    }
    if (colIndex(headers, ['Points', 'Pts', 'DP', 'TP']) >= 0) addReason(acc.columns, 'points', 'points header exists');
    if (colIndex(headers, ['Best', 'Best lap', 'Fastest Lap', 'FASTEST LAP']) >= 0) addReason(acc.columns, 'fastest_laps', 'best/fastest lap header exists');
    if (colIndex(headers, ['Status', 'Time / status', 'Time/Status']) >= 0) addReason(acc.columns, 'dnf', 'status header exists');
    if (colIndex(headers, ['Led', 'Laps Led']) >= 0) addReason(acc.columns, 'laps_led', 'laps-led header exists');
    if (colIndex(headers, ['Class']) >= 0 || isClassSeries) addReason(acc.columns, 'class', isClassSeries ? 'series is multiclass' : 'class header exists');
    if (isStockCar) {
      addReason(acc.columns, 'top15', 'stock-car series');
      addReason(acc.columns, 'top20', 'stock-car series');
      addReason(acc.columns, 'stage_wins', 'stock-car stage tables stay enabled');
      addReason(acc.columns, 'stage_points', 'stock-car stage tables stay enabled');
      addReason(acc.columns, 'laps_completed_pct', 'stock-car series');
    }
    if (/sprint/i.test(table.title || '')) {
      addReason(acc.columns, 'sprint_wins', 'sprint race session title');
      addReason(acc.columns, 'sprint_podiums', 'sprint race session title');
    }
    if (/feature|grand prix/i.test(table.title || '')) {
      addReason(acc.columns, 'feature_wins', 'feature race session title');
      addReason(acc.columns, 'feature_podiums', 'feature race session title');
    }
  }
}

let failed = false;
for (const [series, acc] of [...bySeries.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  if (acc.raceSessions > 0 && acc.raceRows === 0) {
    failed = true;
    console.error(`[FAIL] ${series}: race.sessions exist but stats would be empty`);
  }
  const columns = [...acc.columns.entries()].map(([name, reasons]) => `${name} (${[...reasons].join('; ')})`);
  console.log(`\n${series}`);
  console.log(`  events scanned: ${acc.files}, race tables: ${acc.raceTables}, race rows: ${acc.raceRows}`);
  console.log(`  columns: ${columns.length ? columns.join(', ') : 'none'}`);
}

if (failed) process.exit(1);
