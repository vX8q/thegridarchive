#!/usr/bin/env node
/**
 * Load browser event-card-date.js in Node for tests and audit scripts.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function loadMultiRaceMap() {
  const p = path.join(root, 'web', 'data', 'multi-race-schedule-sessions.js');
  const src = fs.readFileSync(p, 'utf8');
  const m = src.match(/window\.TGA_MULTI_RACE_SESSIONS\s*=\s*(\{[\s\S]*?\n\};)/);
  if (!m) throw new Error('TGA_MULTI_RACE_SESSIONS not found');
  // eslint-disable-next-line no-new-func
  return Function(`return ${m[1].replace(/;$/, '')}`)();
}

export function loadStaticSchedules() {
  const p = path.join(root, 'web', 'data', 'static-schedules.js');
  const src = fs.readFileSync(p, 'utf8');
  const m = src.match(/window\.TGA_STATIC_SCHEDULES\s*=\s*(\{[\s\S]*\n\s*\};)/);
  if (!m) throw new Error('TGA_STATIC_SCHEDULES not found');
  // eslint-disable-next-line no-new-func
  return Function(`return ${m[1].replace(/;$/, '')}`)();
}

export function isoPrefix(s) {
  const str = String(s || '').trim();
  return /^\d{4}-\d{2}-\d{2}/.test(str) ? str.slice(0, 10) : '';
}

/**
 * @param {Object} [opts]
 * @param {Object} [opts.multiRaceMap]
 * @param {Object} [opts.staticSchedules]
 */
export function createEventCardDateApi(opts = {}) {
  const TGA = {
    getLang() { return 'en'; },
    formatShortDate(iso) {
      if (!iso) return '—';
      const d = new Date(iso + 'T12:00:00');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return months[d.getMonth()] + ' ' + d.getDate();
    },
    normalizeScheduleEvent: (e) => e,
    getEventRaceStartDateIso(e) {
      const start = isoPrefix(e.start_date || e.date);
      const end = isoPrefix(e.end_date);
      if (start && end && end > start) return end;
      return start || end || '';
    },
    getEventRaceLocalDateIso(e) {
      return isoPrefix(e.end_date || e.start_date || e.date);
    },
  };
  const window = {
    TGA,
    TGA_MULTI_RACE_SESSIONS: opts.multiRaceMap || loadMultiRaceMap(),
    TGA_STATIC_SCHEDULES: opts.staticSchedules || loadStaticSchedules(),
    console,
  };
  const coreSrc = fs.readFileSync(path.join(root, 'web', 'lib', 'tga-dates-core.js'), 'utf8');
  vm.runInNewContext(coreSrc, { window, console });
  const src = fs.readFileSync(path.join(root, 'web', 'lib', 'event-card-date.js'), 'utf8');
  vm.runInNewContext(src, { window, console });
  return window.TGA;
}

export function createWeekendMergeApi() {
  const TGA = createEventCardDateApi();
  const window = { TGA, console };
  const src = fs.readFileSync(path.join(root, 'web', 'lib', 'weekend-card-merge.js'), 'utf8');
  vm.runInNewContext(src, { window, console });
  return window.TGA;
}

export function createSeriesScheduleExpandApi(opts = {}) {
  const TGA = createEventCardDateApi(opts);
  const window = { TGA, console };
  const src = fs.readFileSync(path.join(root, 'web', 'components', 'series-schedule-expand.js'), 'utf8');
  vm.runInNewContext(src, { window, console });
  return window.TGA;
}

export function loadScheduleEntry(seriesFile, eventId) {
  const rows = JSON.parse(fs.readFileSync(path.join(root, 'data', 'schedules', seriesFile), 'utf8'));
  return rows.find((e) => e.id === eventId) || null;
}
