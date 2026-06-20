#!/usr/bin/env node
/**
 * Generates web/data/multi-race-schedule-sessions.js from schedule JSON + known timetables.
 * Run: node scripts/build-multi-race-schedule-sessions.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outPath = path.join(root, 'web/data/multi-race-schedule-sessions.js');

function isoAddDays(iso, n) {
  const t = new Date(iso + 'T12:00:00').getTime() + n * 86400000;
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function sess(label, date, timeMsk, kind = '') {
  return { label, date, time_msk: timeMsk, kind };
}

const sessions = {};

// ── F2 (Sprint / Feature) — MSK from FIA F2 timetables ─────────────────────
const f2 = {
  F2_2026_1: [
    sess('Sprint', '2026-03-07', '06:10', 'sprint'),
    sess('Feature', '2026-03-08', '03:25', 'feature'),
  ],
  F2_2026_2: [
    sess('Sprint', '2026-05-02', '17:00', 'sprint'),
    sess('Feature', '2026-05-03', '21:00', 'feature'),
  ],
  F2_2026_3: [
    sess('Sprint', '2026-05-23', '21:10', 'sprint'),
    sess('Feature', '2026-05-24', '19:05', 'feature'),
  ],
  F2_2026_4: [
    sess('Sprint', '2026-06-06', '15:15', 'sprint'),
    sess('Feature', '2026-06-07', '10:25', 'feature'),
  ],
  F2_2026_5: [
    sess('Sprint', '2026-06-13', '15:15', 'sprint'),
    sess('Feature', '2026-06-14', '12:25', 'feature'),
  ],
  F2_2026_6: [
    sess('Sprint', '2026-06-27', '15:15', 'sprint'), // 14:15 CEST
    sess('Feature', '2026-06-28', '11:10', 'feature'), // 10:10 CEST
  ],
  F2_2026_7: [
    sess('Sprint', '2026-07-04', '15:45', 'sprint'), // 13:45 BST
    sess('Feature', '2026-07-05', '13:15', 'feature'), // 11:15 BST
  ],
  F2_2026_8: [
    sess('Sprint', '2026-07-18', '15:15', 'sprint'),
    sess('Feature', '2026-07-19', '11:10', 'feature'),
  ],
  F2_2026_9: [
    sess('Sprint', '2026-07-25', '15:15', 'sprint'),
    sess('Feature', '2026-07-26', '11:10', 'feature'),
  ],
  F2_2026_10: [
    sess('Sprint', '2026-09-05', '15:15', 'sprint'),
    sess('Feature', '2026-09-06', '10:45', 'feature'), // 09:45 CEST
  ],
  F2_2026_11: [
    sess('Sprint', '2026-09-12', '15:15', 'sprint'),
    sess('Feature', '2026-09-13', '11:10', 'feature'),
  ],
  F2_2026_12: [
    sess('Sprint', '2026-09-26', '13:00', 'sprint'),
    sess('Feature', '2026-09-27', '15:00', 'feature'),
  ],
  F2_2026_13: [
    sess('Sprint', '2026-11-28', '18:00', 'sprint'),
    sess('Feature', '2026-11-29', '19:00', 'feature'),
  ],
  F2_2026_14: [
    sess('Sprint', '2026-12-05', '15:00', 'sprint'),
    sess('Feature', '2026-12-06', '16:00', 'feature'),
  ],
};
Object.assign(sessions, f2);

// ── F3 — MSK from F1.com weekend timetables (CEST local +1h, BST +2h) ───────
const f3 = {
  F3_2026_1: [
    sess('Sprint', '2026-03-07', '03:15', 'sprint'),
    sess('Feature', '2026-03-08', '00:50', 'feature'),
  ],
  F3_2026_2: [
    sess('Sprint', '2026-06-06', '11:45', 'sprint'), // Monaco: 10:45 CEST
    sess('Feature', '2026-06-07', '08:45', 'feature'), // 07:45 CEST
  ],
  F3_2026_3: [
    sess('Sprint', '2026-06-13', '11:05', 'sprint'), // 10:05 CEST
    sess('Feature', '2026-06-14', '09:40', 'feature'), // 08:40 CEST
  ],
  F3_2026_4: [
    sess('Sprint', '2026-06-27', '11:05', 'sprint'), // 10:05 CEST
    sess('Feature', '2026-06-28', '09:40', 'feature'), // 08:40 CEST
  ],
  F3_2026_5: [
    sess('Sprint', '2026-07-04', '11:35', 'sprint'), // 09:35 BST
    sess('Feature', '2026-07-05', '10:25', 'feature'), // 08:25 BST
  ],
  F3_2026_6: [
    sess('Sprint', '2026-07-18', '11:05', 'sprint'), // 10:05 CEST (standard EU weekend)
    sess('Feature', '2026-07-19', '09:40', 'feature'), // 08:40 CEST
  ],
  F3_2026_7: [
    sess('Sprint', '2026-07-25', '11:05', 'sprint'),
    sess('Feature', '2026-07-26', '09:40', 'feature'),
  ],
  F3_2026_8: [
    sess('Sprint', '2026-09-05', '11:05', 'sprint'),
    sess('Feature', '2026-09-06', '09:40', 'feature'),
  ],
  F3_2026_9: [
    sess('Sprint', '2026-09-12', '12:05', 'sprint'), // Madrid: 11:05 CEST
    sess('Feature', '2026-09-13', '10:55', 'feature'), // 09:55 CEST
  ],
};
Object.assign(sessions, f3);

// ── FREC — typical FRECA weekend (CEST+1h → MSK) ───────────────────────────
function frec3(start, end) {
  const sat = start;
  const sun = end || isoAddDays(start, 2);
  return [
    sess('Race 1', sat, '11:35'),
    sess('Race 2', sat, '15:50'),
    sess('Race 3', sun, '11:35'),
  ];
}
function frec2(start, end) {
  return [
    sess('Race 1', start, '11:35'),
    sess('Race 2', end || isoAddDays(start, 1), '11:35'),
  ];
}
const frecSched = JSON.parse(fs.readFileSync(path.join(root, 'data/schedules/frec.json'), 'utf8'));
for (const e of frecSched) {
  const id = e.id.toUpperCase();
  const start = e.start_date;
  const end = e.end_date;
  sessions[id] = id === 'FREC_2026_2' ? frec2(start, end) : frec3(start, end);
}

// ── Italian F4 — 3 races default; 4 at large-grid rounds (Misano) ───────────
const f4FourRace = {
  F4_IT_2026_1: [
    sess('Race 1', '2026-05-09', '12:30'),
    sess('Race 2', '2026-05-09', '18:15'),
    sess('Race 3', '2026-05-10', '09:30'),
    sess('Race 4', '2026-05-10', '14:50'),
  ],
  F4_IT_2026_6: [
    sess('Race 1', '2026-09-19', '12:30'),
    sess('Race 2', '2026-09-19', '18:15'),
    sess('Race 3', '2026-09-20', '09:30'),
    sess('Race 4', '2026-09-20', '14:50'),
  ],
};
Object.assign(sessions, f4FourRace);

function f4Three(start, end) {
  const sat = isoAddDays(start, 1);
  const sun = end || isoAddDays(start, 2);
  return [
    sess('Race 1', sat, '12:30'),
    sess('Race 2', sat, '18:15'),
    sess('Race 3', sun, '09:30'),
  ];
}
const f4Sched = JSON.parse(fs.readFileSync(path.join(root, 'data/schedules/f4_it.json'), 'utf8'));
for (const e of f4Sched) {
  const id = e.id.toUpperCase();
  if (!sessions[id]) sessions[id] = f4Three(e.start_date, e.end_date);
}

// ── DTM — 13:30 CEST = 14:30 MSK ─────────────────────────────────────────────
const dtmSched = JSON.parse(fs.readFileSync(path.join(root, 'data/schedules/dtm.json'), 'utf8'));
for (const e of dtmSched) {
  const start = e.start_date;
  const end = e.end_date || isoAddDays(start, 1);
  sessions[e.id.toUpperCase()] = [
    sess('Race 1', start, '14:30'),
    sess('Race 2', end, '14:30'),
  ];
}

// ── GTWCE Sprint — 15:30 CEST = 16:30 MSK ────────────────────────────────────
const gtwSched = JSON.parse(fs.readFileSync(path.join(root, 'data/schedules/gtwce_sprint.json'), 'utf8'));
for (const e of gtwSched) {
  const start = e.start_date;
  const end = e.end_date || isoAddDays(start, 1);
  sessions[e.id.toUpperCase()] = [
    sess('Race 1', start, '16:30'),
    sess('Race 2', end, '16:30'),
  ];
}

const body = `// Auto-generated by scripts/build-multi-race-schedule-sessions.mjs — do not edit by hand.
(function () {
  if (typeof window === 'undefined') return;
  window.TGA_MULTI_RACE_SESSIONS = ${JSON.stringify(sessions, null, 2)};
})();
`;

fs.writeFileSync(outPath, body, 'utf8');
console.log('Wrote', outPath, '—', Object.keys(sessions).length, 'events');
