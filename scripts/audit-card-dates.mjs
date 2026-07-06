#!/usr/bin/env node
/**
 * Audit card date display: multi-day weekends should show a range, not last day only.
 * Uses web/lib/event-card-date.js via VM (same code as the browser).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createEventCardDateApi, isoPrefix } from './lib/load-event-card-date.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schedulesDir = path.join(root, 'data', 'schedules');

const MULTI_RACE_SERIES = new Set([
  'f2', 'f3', 'frec', 'f4_it', 'gtwce_sprint', 'dtm', 'f1', 'super_formula',
]);

function seriesKeyNorm(seriesId) {
  const k = String(seriesId || '').toLowerCase().replace(/-/g, '_');
  return /^f1_\d{4}$/.test(k) ? 'f1' : k;
}

function formatDateRange(startDs, endDs) {
  if (!startDs) return '—';
  if (!endDs || startDs === endDs) return startDs;
  return `${startDs}..${endDs}`;
}

function formatEventRaceStartDate(e, TGA) {
  if (TGA.enduranceWeekendRaceDayOnly(e)) {
    const raceDay = TGA.singleRaceCardDateIso(e) || TGA.getEventRaceStartDateIso(e);
    return raceDay || '—';
  }
  const schedRange = TGA.getEventRaceDateRangeIso(e);
  if (schedRange.start && schedRange.end && schedRange.end > schedRange.start) {
    return formatDateRange(schedRange.start, schedRange.end);
  }
  const start = isoPrefix(e.start_date || e.date);
  const end = isoPrefix(e.end_date);
  if (start && end && end > start) {
    return formatDateRange(start, end);
  }
  return TGA.getEventRaceStartDateIso(e) || schedRange.start || '—';
}

function loadSchedules() {
  const events = [];
  for (const f of fs.readdirSync(schedulesDir)) {
    if (!f.endsWith('.json')) continue;
    const list = JSON.parse(fs.readFileSync(path.join(schedulesDir, f), 'utf8'));
    for (const e of list) {
      events.push(e);
    }
  }
  return events;
}

const TGA = createEventCardDateApi();
const events = loadSchedules();

const issues = [];
const missingMap = [];

for (const e of events) {
  const sid = seriesKeyNorm(e.series_id);
  const start = isoPrefix(e.start_date || e.date);
  const end = isoPrefix(e.end_date);
  const isMultiDay = !!(start && end && end > start);
  const isMultiRace = MULTI_RACE_SERIES.has(sid);
  const wantsRange = isMultiDay && !TGA.enduranceWeekendRaceDayOnly(e);

  if (!wantsRange && !isMultiRace) continue;

  const display = formatEventRaceStartDate(e, TGA);
  const range = TGA.getEventRaceDateRangeIso(e);
  const showsRange = range.start && range.end && range.end > range.start;
  const displayIsSingle = !display.includes('..');

  if (wantsRange && displayIsSingle) {
    issues.push({
      id: e.id,
      series: e.series_id,
      name: e.name,
      schedule: `${start} → ${end}`,
      display,
      range: `${range.start} → ${range.end}`,
      reason: showsRange ? 'format path' : 'getRange single',
    });
  }

  if (isMultiRace && ['f2', 'f3', 'frec', 'f4_it'].includes(sid) && isMultiDay) {
    const sessions = TGA.buildSessionsForEvent(sid, e);
    if (!sessions || sessions.length < 2) {
      missingMap.push({ id: e.id, series: e.series_id, start, end });
    }
  }
}

const apiStyleIssues = [];
for (const e of events) {
  const start = isoPrefix(e.start_date || e.date);
  const end = isoPrefix(e.end_date);
  if (!start || !end || end <= start) continue;
  if (TGA.enduranceWeekendRaceDayOnly(e)) continue;
  const apiEv = {
    id: e.id,
    start_date: start,
    end_date: end,
    name: e.name,
    series_id: e.series_id,
    _seriesId: e.series_id,
  };
  const display = formatEventRaceStartDate(apiEv, TGA);
  if (!display.includes('..')) {
    apiStyleIssues.push({ id: e.id, series: e.series_id, display, schedule: `${start} → ${end}` });
  }
}

const expandedRowIssues = [];
for (const e of events) {
  const idU = String(e.id || '').toUpperCase();
  if (idU !== 'F2_2026_7' && idU !== 'F3_2026_5') continue;
  const sessions = TGA.buildSessionsForEvent(seriesKeyNorm(e.series_id), e);
  if (!Array.isArray(sessions)) continue;
  for (const r of sessions) {
    const row = {
      id: e.id,
      series_id: e.series_id,
      _seriesId: e.series_id,
      name: `${e.name || ''} (${r.label || 'Race'})`,
      start_date: String(r.start_date || '').slice(0, 10),
      end_date: String(r.end_date || r.start_date || '').slice(0, 10),
    };
    const display = formatEventRaceStartDate(row, TGA);
    if (!display.includes('..')) {
      expandedRowIssues.push({ id: e.id, label: r.label, display });
    }
  }
}

const f1SprintIssues = [];
for (const e of events) {
  if (!TGA.isF1SprintWeekendEvent(e)) continue;
  const display = formatEventRaceStartDate(e, TGA);
  if (!display.includes('..')) {
    f1SprintIssues.push({
      id: e.id,
      display,
      schedule: `${isoPrefix(e.start_date)} → ${isoPrefix(e.end_date)}`,
    });
  }
}

console.log('=== Card date audit ===\n');
console.log(`Events checked: ${events.length}`);
console.log(`Range expected but single-day display: ${issues.length}`);
if (issues.length) {
  for (const x of issues.slice(0, 40)) {
    console.log(`  ${x.id} (${x.series}) ${x.schedule} → "${x.display}" [${x.reason}]`);
  }
  if (issues.length > 40) console.log(`  ... +${issues.length - 40} more`);
}

console.log(`\nAPI-style (no series_id) single-day: ${apiStyleIssues.length}`);
if (apiStyleIssues.length) {
  for (const x of apiStyleIssues.slice(0, 20)) {
    console.log(`  ${x.id} (${x.series}) ${x.schedule} → "${x.display}"`);
  }
}

console.log(`\nF2/F3 expanded cache rows without range: ${expandedRowIssues.length}`);
for (const x of expandedRowIssues) {
  console.log(`  ${x.id} (${x.label}) → "${x.display}"`);
}

console.log(`\nF1 sprint weekends without range: ${f1SprintIssues.length}`);
for (const x of f1SprintIssues) {
  console.log(`  ${x.id} ${x.schedule} → "${x.display}"`);
}

console.log(`\nMulti-race series missing sessions + no weekend span: ${missingMap.length}`);
for (const x of missingMap) {
  console.log(`  ${x.id} (${x.series}) ${x.start} → ${x.end}`);
}

process.exit(issues.length || apiStyleIssues.length || f1SprintIssues.length || expandedRowIssues.length ? 1 : 0);
