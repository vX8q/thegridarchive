#!/usr/bin/env node
/**
 * Compute time_est / time_msk for schedule JSON updates.
 * Timezone rules: data/timezones-reference.json (see data/TIMEZONES.md)
 * Run: node scripts/fill-schedule-times.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  formatMskEmbedded,
  formatMskPlain,
  mskDateIsoFromUtc,
  parse12h,
  utcMsFromLocal,
} from './lib/timezones.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function etToNascar(iso, time12) {
  const p = parse12h(time12);
  if (!p) return null;
  const utcMs = utcMsFromLocal(iso, p.h, p.min, 'America/New_York');
  return { time_est: time12, time_msk: formatMskEmbedded(utcMs) };
}

function localToSupercars(iso, time12, tz) {
  const p = parse12h(time12);
  if (!p) return null;
  const utcMs = utcMsFromLocal(iso, p.h, p.min, tz);
  return { time_est: time12, time_msk: formatMskEmbedded(utcMs) };
}

function local24ToF1Style(iso, hhmm, tz) {
  const [h, m] = hhmm.split(':').map(Number);
  const utcMs = utcMsFromLocal(iso, h, m, tz);
  return { time_est: hhmm, time_msk: formatMskPlain(utcMs) };
}

function jstToSuperFormula(iso, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const [y, mo, d] = iso.split('-').map(Number);
  const utcMs = Date.UTC(y, mo - 1, d, h - 9, m);
  return { time_est: hhmm, time_msk: formatMskPlain(utcMs) };
}

// --- Supercars updates (supercars.com / 2025 templates where 2026 TBC) ---
const supercars = [
  ['SUPERCARS_2026_1', '2026-02-20', '7:50 PM', 'Australia/Sydney'],
  ['SUPERCARS_2026_2', '2026-02-21', '7:35 PM', 'Australia/Sydney'],
  ['SUPERCARS_2026_3', '2026-02-22', '4:05 PM', 'Australia/Sydney'],
  ['SUPERCARS_2026_4', '2026-03-05', '5:00 PM', 'Australia/Melbourne'],
  ['SUPERCARS_2026_5', '2026-03-06', '5:30 PM', 'Australia/Melbourne'],
  ['SUPERCARS_2026_6', '2026-03-07', '5:35 PM', 'Australia/Melbourne'],
  ['SUPERCARS_2026_7', '2026-03-07', '10:10 AM', 'Australia/Melbourne'],
  ['SUPERCARS_2026_8', '2026-04-10', '4:03 PM', 'Pacific/Auckland'],
  ['SUPERCARS_2026_9', '2026-04-11', '12:20 PM', 'Pacific/Auckland'],
  ['SUPERCARS_2026_10', '2026-04-18', '4:10 PM', 'Pacific/Auckland'],
  ['SUPERCARS_2026_11', '2026-04-17', '4:35 PM', 'Pacific/Auckland'],
  ['SUPERCARS_2026_12', '2026-04-18', '12:45 PM', 'Pacific/Auckland'],
  ['SUPERCARS_2026_13', '2026-04-19', '3:05 PM', 'Pacific/Auckland'],
  ['SUPERCARS_2026_14', '2026-05-23', '1:00 PM', 'Australia/Hobart'],
  ['SUPERCARS_2026_15', '2026-05-23', '4:00 PM', 'Australia/Hobart'],
  ['SUPERCARS_2026_16', '2026-05-24', '2:45 PM', 'Australia/Hobart'],
  ['SUPERCARS_2026_17', '2026-06-19', '5:00 PM', 'Australia/Darwin'],
  ['SUPERCARS_2026_18', '2026-06-20', '3:20 PM', 'Australia/Darwin'],
  ['SUPERCARS_2026_19', '2026-06-21', '2:40 PM', 'Australia/Darwin'],
  ['SUPERCARS_2026_20', '2026-07-10', '4:15 PM', 'Australia/Brisbane'],
  ['SUPERCARS_2026_21', '2026-07-11', '3:05 PM', 'Australia/Brisbane'],
  ['SUPERCARS_2026_22', '2026-07-12', '3:05 PM', 'Australia/Brisbane'],
  ['SUPERCARS_2026_23', '2026-07-31', '6:00 PM', 'Australia/Perth'],
  ['SUPERCARS_2026_24', '2026-08-01', '12:55 PM', 'Australia/Perth'],
  ['SUPERCARS_2026_25', '2026-08-02', '3:15 PM', 'Australia/Perth'],
  ['SUPERCARS_2026_26', '2026-08-21', '12:45 PM', 'Australia/Brisbane'],
  ['SUPERCARS_2026_27', '2026-08-22', '4:10 PM', 'Australia/Brisbane'],
  ['SUPERCARS_2026_28', '2026-08-23', '3:15 PM', 'Australia/Brisbane'],
  ['SUPERCARS_2026_29', '2026-09-13', '2:30 PM', 'Australia/Adelaide'],
  ['SUPERCARS_2026_30', '2026-10-11', '11:45 AM', 'Australia/Sydney'],
  ['SUPERCARS_2026_31', '2026-10-24', '3:15 PM', 'Australia/Brisbane'],
  ['SUPERCARS_2026_32', '2026-10-25', '2:10 PM', 'Australia/Brisbane'],
  ['SUPERCARS_2026_33', '2026-11-07', '3:20 PM', 'Australia/Melbourne'],
  ['SUPERCARS_2026_34', '2026-11-08', '3:20 PM', 'Australia/Melbourne'],
  ['SUPERCARS_2026_35', '2026-11-27', '4:30 PM', 'Australia/Adelaide'],
  ['SUPERCARS_2026_36', '2026-11-28', '3:00 PM', 'Australia/Adelaide'],
  ['SUPERCARS_2026_37', '2026-11-29', '3:45 PM', 'Australia/Adelaide'],
];

const nascarMod = [
  ['NASCAR_MODIFIED_2026_2', '2026-03-28', '7:30 PM'],
  ['NASCAR_MODIFIED_2026_3', '2026-04-12', '4:30 PM'],
  ['NASCAR_MODIFIED_2026_4', '2026-06-06', '6:15 PM'],
  ['NASCAR_MODIFIED_2026_5', '2026-05-16', '8:00 PM'],
  ['NASCAR_MODIFIED_2026_6', '2026-05-30', '8:00 PM'],
  ['NASCAR_MODIFIED_2026_7', '2026-07-18', '8:00 PM'],
  ['NASCAR_MODIFIED_2026_8', '2026-07-01', '8:00 PM'],
  ['NASCAR_MODIFIED_2026_9', '2026-07-10', '8:30 PM'],
  ['NASCAR_MODIFIED_2026_10', '2026-07-25', '7:30 PM'],
  ['NASCAR_MODIFIED_2026_11', '2026-08-05', '8:00 PM'],
  ['NASCAR_MODIFIED_2026_12', '2026-08-22', '4:30 PM'],
  ['NASCAR_MODIFIED_2026_13', '2026-08-28', '8:00 PM'],
  ['NASCAR_MODIFIED_2026_14', '2026-09-05', '8:00 PM'],
  ['NASCAR_MODIFIED_2026_15', '2026-09-19', '8:00 PM'],
  ['NASCAR_MODIFIED_2026_16', '2026-10-11', '4:30 PM'],
];

const superFormula = [
  ['SUPER_FORMULA_2026_1', '2026-04-04', '09:30'],
  ['SUPER_FORMULA_2026_2', '2026-04-05', '10:10'],
  ['SUPER_FORMULA_2026_3', '2026-04-25', '14:15'],
  ['SUPER_FORMULA_2026_4', '2026-05-23', '14:45'],
  ['SUPER_FORMULA_2026_5', '2026-05-24', '14:45'],
  ['SUPER_FORMULA_2026_6', '2026-07-18', '16:15'],
  ['SUPER_FORMULA_2026_8', '2026-08-09', '14:45'],
  ['SUPER_FORMULA_2026_9', '2026-10-10', '14:45'],
  ['SUPER_FORMULA_2026_10', '2026-10-11', '14:45'],
  ['SUPER_FORMULA_2026_11', '2026-11-21', '14:45'],
  ['SUPER_FORMULA_2026_12', '2026-11-22', '14:45'],
];

function patchSchedule(file, patches, fn) {
  const p = path.join(root, 'data', 'schedules', file);
  const rows = JSON.parse(fs.readFileSync(p, 'utf8'));
  const byId = Object.fromEntries(patches.map((x) => [x[0], x]));
  for (const ev of rows) {
    const patch = byId[ev.id];
    if (!patch) continue;
    const times = fn(...patch.slice(1));
    if (!times) continue;
    if (patch[1] && patch[1] !== ev.start_date) {
      ev.start_date = patch[1];
      ev.end_date = patch[1];
      ev.date = patch[1];
    }
    ev.time_est = times.time_est;
    ev.time_msk = times.time_msk;
  }
  fs.writeFileSync(p, JSON.stringify(rows, null, 2) + '\n');
  console.log('Updated', file);
}

/** Recompute time_msk from existing time_est + track timezone. [id, raceDate, tz, time12?] */
function patchLocal12Times(file, entries, opts = {}) {
  const plainWhenSameMskDay = opts.plainWhenSameMskDay !== false;
  const p = path.join(root, 'data', 'schedules', file);
  const rows = JSON.parse(fs.readFileSync(p, 'utf8'));
  const byId = Object.fromEntries(entries.map((x) => [x[0], x]));
  for (const ev of rows) {
    const ent = byId[ev.id];
    if (!ent) continue;
    const raceDate = ent[1];
    const tz = ent[2];
    const time12 = ent[3] || ev.time_est;
    if (!time12 || /^tbd$/i.test(time12)) continue;
    const parsed = parse12h(time12);
    if (!parsed) continue;
    const utcMs = utcMsFromLocal(raceDate, parsed.h, parsed.min, tz);
    const embedded = formatMskEmbedded(utcMs);
    const plain = formatMskPlain(utcMs);
    ev.time_est = time12;
    const mskDay = mskDateIsoFromUtc(utcMs);
    ev.time_msk = plainWhenSameMskDay && mskDay === raceDate ? plain : embedded;
  }
  fs.writeFileSync(p, JSON.stringify(rows, null, 2) + '\n');
  console.log('Updated', file);
}

patchSchedule('supercars.json', supercars, (date, t, tz) => localToSupercars(date, t, tz));
patchSchedule('nascar_modified.json', nascarMod, (date, t) => etToNascar(date, t));
patchSchedule('super_formula.json', superFormula, (date, t) => jstToSuperFormula(date, t));

const wec = [
  ['WEC_2026_PROLOGUE', '2026-04-14', '10:00', 'Europe/Rome'],
  ['WEC_2026_1', '2026-04-19', '13:00', 'Europe/Rome'],
  ['WEC_2026_2', '2026-05-09', '14:00', 'Europe/Brussels'],
  ['WEC_2026_3', '2026-06-13', '16:00', 'Europe/Paris'],
  ['WEC_2026_4', '2026-07-12', '11:30', 'America/Sao_Paulo'],
  ['WEC_2026_5', '2026-09-06', '12:00', 'America/Chicago'],
  ['WEC_2026_6', '2026-09-27', '11:00', 'Asia/Tokyo'],
  ['WEC_2026_7', '2026-10-24', '14:00', 'Asia/Qatar'],
  ['WEC_2026_8', '2026-11-07', '14:00', 'Asia/Bahrain'],
];
patchRaceTimes('wec.json', wec);

// NASCAR national series — ET starts; embedded MSK when race crosses midnight MSK.
function patchNascarEtTimes(file, patches) {
  const p = path.join(root, 'data', 'schedules', file);
  const rows = JSON.parse(fs.readFileSync(p, 'utf8'));
  const byId = Object.fromEntries(patches.map((x) => [x[0], x]));
  for (const ev of rows) {
    const patch = byId[ev.id];
    if (!patch) continue;
    const times = etToNascar(patch[1], patch[2]);
    if (times) Object.assign(ev, times);
  }
  fs.writeFileSync(p, JSON.stringify(rows, null, 2) + '\n');
  console.log('Updated', file);
}

patchNascarEtTimes('arca.json', [['ARCA_2026_12', '2026-07-10', '4:00 PM']]);
patchNascarEtTimes('noaps.json', [['NOAPS_2026_21', '2026-07-11', '7:00 PM']]);
patchNascarEtTimes('nascar_cup.json', [['NASCAR_CUP_2026_20', '2026-07-12', '7:00 PM']]);

/** Race time on raceDate; embedded MSK if race day ≠ start_date (multi-day weekends). */
function patchRaceTimes(file, patches) {
  const p = path.join(root, 'data', 'schedules', file);
  const rows = JSON.parse(fs.readFileSync(p, 'utf8'));
  const byId = Object.fromEntries(patches.map((x) => [x[0], x]));
  for (const ev of rows) {
    const patch = byId[ev.id];
    if (!patch) continue;
    const raceDate = patch[1];
    const hhmm = patch[2];
    const tz = patch[3];
    const [h, m] = hhmm.split(':').map(Number);
    const utcMs = utcMsFromLocal(raceDate, h, m, tz);
    const plain = local24ToF1Style(raceDate, hhmm, tz);
    const eventStart = String(ev.start_date || '').slice(0, 10);
    ev.time_est = plain.time_est;
    ev.time_msk = raceDate === eventStart ? plain.time_msk : formatMskEmbedded(utcMs);
  }
  fs.writeFileSync(p, JSON.stringify(rows, null, 2) + '\n');
  console.log('Updated', file);
}

// ELMS — official race starts (CEST/BST +1h → MSK, except Silverstone BST +2h)
patchRaceTimes('elms.json', [
  ['ELMS_2026_PROLOGUE', '2026-04-06', '09:00', 'Europe/Madrid'],
  ['ELMS_2026_1', '2026-04-12', '12:00', 'Europe/Madrid'],
  ['ELMS_2026_2', '2026-05-03', '12:00', 'Europe/Paris'],
  ['ELMS_2026_3', '2026-07-05', '13:00', 'Europe/Rome'],
  ['ELMS_2026_4', '2026-08-23', '13:00', 'Europe/Brussels'],
  ['ELMS_2026_5', '2026-09-13', '12:00', 'Europe/London'],
  ['ELMS_2026_6', '2026-10-10', '12:00', 'Europe/Lisbon'],
]);

// GTWCE Endurance — main race starts (gt-world-challenge-europe.com timetables)
patchRaceTimes('gtwce_end.json', [
  ['GTWCE_END_2026_1', '2026-04-11', '18:00', 'Europe/Paris'],
  ['GTWCE_END_2026_2', '2026-05-31', '15:30', 'Europe/Rome'],
  ['GTWCE_END_2026_3', '2026-06-27', '16:30', 'Europe/Brussels'],
  ['GTWCE_END_2026_4', '2026-08-30', '15:00', 'Europe/Berlin'],
  ['GTWCE_END_2026_5', '2026-10-18', '15:15', 'Europe/Lisbon'],
]);

// Porsche Supercup — F1 support race starts (F1.com timetables)
patchRaceTimes('psc.json', [
  ['PSC_2026_1', '2026-06-07', '11:45', 'Europe/Monaco'],
  ['PSC_2026_3', '2026-06-28', '11:55', 'Europe/Vienna'],
  ['PSC_2026_4', '2026-07-19', '11:45', 'Europe/Brussels'],
  ['PSC_2026_5', '2026-07-26', '11:55', 'Europe/Budapest'],
  ['PSC_2026_6', '2026-08-22', '18:00', 'Europe/Amsterdam'],
  ['PSC_2026_8', '2026-09-06', '12:05', 'Europe/Rome'],
]);

// Weekend-level times for multi-race series (expanded per-session in multi-race-schedule-sessions.js)
patchSchedule('dtm.json', [
  ['DTM_2026_1', '2026-04-25', '13:30', 'Europe/Berlin'],
  ['DTM_2026_2', '2026-05-23', '13:30', 'Europe/Berlin'],
  ['DTM_2026_3', '2026-06-20', '13:30', 'Europe/Berlin'],
  ['DTM_2026_4', '2026-07-04', '13:30', 'Europe/Berlin'],
  ['DTM_2026_5', '2026-07-25', '13:30', 'Europe/Berlin'],
  ['DTM_2026_6', '2026-08-15', '13:30', 'Europe/Berlin'],
  ['DTM_2026_7', '2026-09-12', '13:30', 'Europe/Berlin'],
  ['DTM_2026_8', '2026-10-10', '13:30', 'Europe/Berlin'],
], (date, t, tz) => local24ToF1Style(date, t, tz));

patchSchedule('frec.json', [
  ['FREC_2026_1', '2026-04-24', '11:35', 'Europe/Vienna'],
  ['FREC_2026_2', '2026-05-22', '11:35', 'Europe/Amsterdam'],
  ['FREC_2026_3', '2026-05-29', '11:35', 'Europe/Brussels'],
  ['FREC_2026_4', '2026-06-20', '11:35', 'Europe/Rome'],
  ['FREC_2026_5', '2026-07-03', '11:35', 'Europe/Budapest'],
  ['FREC_2026_6', '2026-07-18', '16:25', 'Europe/Paris'],
  ['FREC_2026_7', '2026-09-04', '13:00', 'Europe/Rome'],
  ['FREC_2026_8', '2026-09-11', '13:00', 'Europe/Berlin'],
], (date, t, tz) => local24ToF1Style(date, t, tz));

patchSchedule('f4_it.json', [
  ['F4_IT_2026_1', '2026-05-09', '12:30', 'Europe/Rome'],
  ['F4_IT_2026_2', '2026-05-22', '12:30', 'Europe/Rome'],
  ['F4_IT_2026_3', '2026-06-21', '12:30', 'Europe/Rome'],
  ['F4_IT_2026_4', '2026-07-25', '12:30', 'Europe/Rome'],
  ['F4_IT_2026_5', '2026-09-05', '12:30', 'Europe/Rome'],
  ['F4_IT_2026_6', '2026-09-19', '12:30', 'Europe/Rome'],
  ['F4_IT_2026_7', '2026-10-24', '12:30', 'Europe/Rome'],
], (date, t, tz) => local24ToF1Style(date, t, tz));

patchSchedule('gtwce_sprint.json', [
  ['GTWCE_SPRINT_2026_1', '2026-05-02', '15:30', 'Europe/London'],
  ['GTWCE_SPRINT_2026_2', '2026-07-18', '21:30', 'Europe/Rome'],
  ['GTWCE_SPRINT_2026_3', '2026-08-01', '15:30', 'Europe/Berlin'],
  ['GTWCE_SPRINT_2026_4', '2026-08-21', '15:30', 'Europe/Amsterdam'],
  ['GTWCE_SPRINT_2026_5', '2026-10-02', '15:30', 'Europe/Madrid'],
], (date, t, tz) => local24ToF1Style(date, t, tz));

// IMSA / IndyCar — local track time (12h) with correct US/CA timezone per venue.
const imsaLocal = [
  ['IMSA_2026_1', '2026-01-24', 'America/New_York'],
  ['IMSA_2026_2', '2026-03-21', 'America/New_York'],
  ['IMSA_2026_3', '2026-04-19', 'America/Los_Angeles'],
  ['IMSA_2026_4', '2026-05-03', 'America/Los_Angeles'],
  ['IMSA_2026_5', '2026-05-30', 'America/Detroit'],
  ['IMSA_2026_6', '2026-06-28', 'America/New_York'],
  ['IMSA_2026_7', '2026-07-12', 'America/Toronto', '2:05 PM'],
  ['IMSA_2026_8', '2026-08-02', 'America/Chicago'],
  ['IMSA_2026_9', '2026-08-23', 'America/New_York'],
  ['IMSA_2026_10', '2026-09-20', 'America/Indiana/Indianapolis'],
  ['IMSA_2026_11', '2026-10-03', 'America/New_York'],
];
patchLocal12Times('imsa.json', imsaLocal, { plainWhenSameMskDay: false });

const indycarLocal = [
  ['INDYCAR_2026_1', '2026-03-01', 'America/New_York'],
  ['INDYCAR_2026_2', '2026-03-07', 'America/Phoenix'],
  ['INDYCAR_2026_3', '2026-03-15', 'America/Chicago'],
  ['INDYCAR_2026_4', '2026-03-29', 'America/Chicago'],
  ['INDYCAR_2026_5', '2026-04-19', 'America/Los_Angeles'],
  ['INDYCAR_2026_6', '2026-05-09', 'America/Indiana/Indianapolis'],
  ['INDYCAR_2026_7', '2026-05-24', 'America/Indiana/Indianapolis'],
  ['INDYCAR_2026_8', '2026-05-31', 'America/Detroit'],
  ['INDYCAR_2026_9', '2026-06-07', 'America/Chicago'],
  ['INDYCAR_2026_10', '2026-06-21', 'America/Chicago'],
  ['INDYCAR_2026_11', '2026-07-05', 'America/New_York'],
  ['INDYCAR_2026_13', '2026-08-09', 'America/Los_Angeles'],
  ['INDYCAR_2026_14', '2026-08-16', 'America/Toronto'],
  ['INDYCAR_2026_16', '2026-08-29', 'America/Chicago'],
  ['INDYCAR_2026_17', '2026-08-30', 'America/Chicago'],
  ['INDYCAR_2026_18', '2026-09-06', 'America/Los_Angeles'],
];
patchLocal12Times('indycar.json', indycarLocal);

// Super GT — races start 14:00 JST (time_est was placeholder 12:00).
patchRaceTimes('super_gt.json', [
  ['SUPER_GT_2026_1', '2026-04-12', '14:00', 'Asia/Tokyo'],
  ['SUPER_GT_2026_2', '2026-05-04', '14:00', 'Asia/Tokyo'],
  ['SUPER_GT_2026_4', '2026-08-02', '14:00', 'Asia/Tokyo'],
  ['SUPER_GT_2026_5', '2026-08-23', '14:00', 'Asia/Tokyo'],
  ['SUPER_GT_2026_6', '2026-09-20', '14:00', 'Asia/Tokyo'],
  ['SUPER_GT_2026_7', '2026-10-18', '14:00', 'Asia/Tokyo'],
  ['SUPER_GT_2026_8', '2026-11-08', '14:00', 'Asia/Tokyo'],
]);

// Fix NASCAR_MODIFIED_2026_1 MSK embedded format
const nmPath = path.join(root, 'data', 'schedules', 'nascar_modified.json');
const nm = JSON.parse(fs.readFileSync(nmPath, 'utf8'));
const r1 = nm.find((e) => e.id === 'NASCAR_MODIFIED_2026_1');
if (r1) Object.assign(r1, etToNascar('2026-02-07', '7:30 PM'));
fs.writeFileSync(nmPath, JSON.stringify(nm, null, 2) + '\n');

console.log('Done');
