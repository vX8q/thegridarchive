#!/usr/bin/env node
/**
 * Build web/data/multi-race-schedule-sessions.js from event JSON + schedule JSON.
 * Run after filling tables.race.sessions on an event: node scripts/build-multi-race-schedule-sessions.mjs
 *
 * Sources (priority):
 *  1. data/schedules/f2_f3_sessions.json + CURATED_OVERRIDES — authoritative session times
 *  2. Event JSON tables.race.sessions — dates, labels, meta.Start / time_msk
 *  3. Schedule JSON — fallback dates (weekend span) and times
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outPath = path.join(root, 'web', 'data', 'multi-race-schedule-sessions.js');

const MONTHS = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

const F2_F3_SESSIONS_PATH = path.join(root, 'data', 'schedules', 'f2_f3_sessions.json');
const f2F3Sessions = fs.existsSync(F2_F3_SESSIONS_PATH)
  ? JSON.parse(fs.readFileSync(F2_F3_SESSIONS_PATH, 'utf8'))
  : {};

/** Never overwritten by auto-generation. */
const CURATED_OVERRIDES = {
  ...f2F3Sessions,
  SUPER_FORMULA_2026_6: [
    { label: 'Round 6', date: '2026-07-18', time_est: '16:15', time_msk: '10:15', kind: '' },
    { label: 'Round 3', date: '2026-07-19', time_est: '10:05', time_msk: '04:05', kind: '' },
    { label: 'Round 7', date: '2026-07-19', time_est: '15:35', time_msk: '09:35', kind: '' },
  ],
};

const EVENT_SCAN = [
  { prefix: 'F2_', schedule: 'data/schedules/f2.json', eventsDir: 'data/events/F2' },
  { prefix: 'F3_', schedule: 'data/schedules/f3.json', eventsDir: 'data/events/F3' },
  { prefix: 'FREC_', schedule: 'data/schedules/frec.json', eventsDir: 'data/events/FREC' },
  { prefix: 'F4_IT_', schedule: 'data/schedules/f4_it.json', eventsDir: 'data/events/Italian F4' },
  { prefix: 'SUPER_FORMULA_', schedule: 'data/schedules/super_formula.json', eventsDir: 'data/events/Super Formula' },
];

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}

function isoSlice(v) {
  return String(v || '').slice(0, 10);
}

function parseMetaDate(str) {
  const m = String(str || '').match(/\b(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\b/);
  if (!m) return '';
  const mon = MONTHS[m[2].toLowerCase().slice(0, 3)];
  if (!mon) return '';
  return `${m[3]}-${mon}-${String(m[1]).padStart(2, '0')}`;
}

function parseStartTime12h(str) {
  const m = String(str || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return '';
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ap = m[3].toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${min}`;
}

function labelFromSession(s, index) {
  const session = String(s.meta?.Session || '');
  const title = String(s.title || '');
  if (/sprint/i.test(session) || /sprint/i.test(title)) return { label: 'Sprint', kind: 'sprint' };
  if (/feature/i.test(session) || /feature/i.test(title)) return { label: 'Feature', kind: 'feature' };
  const round = title.match(/Round\s+(\d+)/i);
  if (round) return { label: `Round ${round[1]}`, kind: '' };
  const raceNum = title.match(/Race\s+(\d+)/i);
  if (raceNum) return { label: `Race ${raceNum[1]}`, kind: '' };
  const clean = title.replace(/\s+Results?$/i, '').trim();
  return { label: clean || `Race ${index + 1}`, kind: '' };
}

function scheduleIndex(rel) {
  const out = {};
  for (const ev of readJson(rel)) {
    if (ev.id) out[String(ev.id).toUpperCase()] = ev;
  }
  return out;
}

function inferDate(scheduleEv, eventData, sessionIndex, sessionCount) {
  const start = isoSlice(scheduleEv?.start_date || eventData?.start_date);
  const end = isoSlice(scheduleEv?.end_date || eventData?.end_date);
  if (!start) return '';
  if (sessionCount <= 1) return start;
  if (sessionCount === 2) return sessionIndex === 0 ? start : (end || start);
  const sid = String(scheduleEv?.series_id || eventData?.series_id || '').toUpperCase();
  if (sid === 'FREC' || sid === 'F4_IT') {
    if (sessionIndex < sessionCount - 1 && start !== end) {
      return sessionIndex < 2 ? start : end;
    }
    if (sessionIndex < 2) return start;
    return end || start;
  }
  return sessionIndex === 0 ? start : (end || start);
}

function inferTimes(scheduleEv, date, sessionIndex, sessionCount, meta) {
  const time_est = String(meta?.time_est || '').trim();
  const time_msk = String(meta?.time_msk || '').trim();
  const startLocal = parseStartTime12h(meta?.Start);
  const out = {
    time_est: time_est || startLocal || '',
    time_msk: time_msk || '',
  };
  if (!scheduleEv) return out;
  const start = isoSlice(scheduleEv.start_date);
  const end = isoSlice(scheduleEv.end_date);
  const sid = String(scheduleEv.series_id || '').toUpperCase();

  if (!out.time_msk && end && date === end) {
    out.time_msk = scheduleEv.time_msk || '';
    out.time_est = out.time_est || scheduleEv.time_est || '';
  }
  if (!out.time_msk && start && date === start && sessionCount === 2) {
    out.time_msk = scheduleEv.time_msk || '';
    out.time_est = out.time_est || scheduleEv.time_est || '';
  }
  if (!out.time_msk && sid === 'FREC' && sessionCount >= 2 && date === start) {
    out.time_msk = sessionIndex === 1 ? '15:50' : (scheduleEv.time_msk || '');
    out.time_est = out.time_est || scheduleEv.time_est || '';
  }
  return out;
}

function sessionsFromEvent(eventData, scheduleEv) {
  const raw = eventData?.tables?.race?.sessions;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const sessions = raw.map((s, i) => {
    const { label, kind } = labelFromSession(s, i);
    const meta = s.meta || {};
    let date = parseMetaDate(meta.Date);
    if (!date) date = inferDate(scheduleEv, eventData, i, raw.length);
    const times = inferTimes(scheduleEv, date, i, raw.length, meta);
    return {
      label,
      date,
      time_est: times.time_est,
      time_msk: times.time_msk,
      kind,
    };
  }).filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s.date));
  return sessions.length ? sessions : null;
}

function twoRaceSessions(ev, labels) {
  const start = isoSlice(ev.start_date || ev.date);
  const end = isoSlice(ev.end_date);
  const msk = ev.time_msk || '';
  const est = ev.time_est || '';
  const lbl = labels || ['Race 1', 'Race 2'];
  if (!start) return null;
  if (!end || end <= start) {
    return [{ label: lbl[0], date: start, time_msk: msk, time_est: est, kind: '' }];
  }
  const kinds = lbl[0] === 'Sprint' ? ['sprint', 'feature'] : ['', ''];
  return [
    { label: lbl[0], date: start, time_msk: msk, time_est: est, kind: kinds[0] },
    { label: lbl[1], date: end, time_msk: msk, time_est: est, kind: kinds[1] },
  ];
}

function loadExistingMap() {
  if (!fs.existsSync(outPath)) return {};
  const src = fs.readFileSync(outPath, 'utf8');
  const m = src.match(/window\.TGA_MULTI_RACE_SESSIONS\s*=\s*(\{[\s\S]*\});/);
  if (!m) return {};
  return Function(`"use strict"; return (${m[1]});`)();
}

function mergePreservedTimes(next, prev) {
  if (!Array.isArray(prev) || !prev.length) return next;
  return next.map((ns) => {
    const match = prev.find((o) => o.label === ns.label && o.date === ns.date)
      || (ns.kind && prev.find((o) => o.kind === ns.kind && o.date === ns.date));
    if (!match) return ns;
    return {
      ...ns,
      time_est: match.time_est || ns.time_est || '',
      time_msk: match.time_msk || ns.time_msk || '',
    };
  });
}

function scanEventDir(eventsDir, scheduleById) {
  const abs = path.join(root, eventsDir);
  if (!fs.existsSync(abs)) return {};
  const out = {};
  for (const season of fs.readdirSync(abs).filter((d) => /^\d{4}$/.test(d))) {
    const dir = path.join(abs, season);
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      const id = String(data.event_id || '').toUpperCase();
      if (!id) continue;
      const sessions = sessionsFromEvent(data, scheduleById[id]);
      if (sessions?.length) out[id] = sessions;
    }
  }
  return out;
}

const map = { ...CURATED_OVERRIDES };
const previous = loadExistingMap();

for (const ev of readJson('data/schedules/dtm.json')) {
  const sessions = twoRaceSessions(ev);
  if (sessions) map[ev.id] = sessions;
}

for (const ev of readJson('data/schedules/gtwce_sprint.json')) {
  const sessions = twoRaceSessions(ev);
  if (sessions) map[ev.id] = sessions;
}

for (const { schedule, eventsDir } of EVENT_SCAN) {
  const byId = scheduleIndex(schedule);
  const fromEvents = scanEventDir(eventsDir, byId);
  for (const [id, sessions] of Object.entries(fromEvents)) {
    if (CURATED_OVERRIDES[id]) continue;
    map[id] = mergePreservedTimes(sessions, previous[id]);
  }
  for (const ev of readJson(schedule)) {
    const id = ev.id;
    if (!id || map[id] || CURATED_OVERRIDES[id]) continue;
    const labels = id.startsWith('F2_') || id.startsWith('F3_') ? ['Sprint', 'Feature'] : ['Race 1', 'Race 2'];
    const sessions = twoRaceSessions(ev, labels);
    if (sessions && sessions.length > 1) map[id] = sessions;
  }
}

const sortedKeys = Object.keys(map).sort();
const lines = sortedKeys.map((key) => {
  const rows = map[key];
  const body = rows.map((r) => JSON.stringify(r, null, 2).replace(/^/gm, '    ')).join(',\n');
  return `  ${JSON.stringify(key)}: [\n${body}\n  ]`;
});

const file = `// Auto-generated by scripts/build-multi-race-schedule-sessions.mjs — do not edit by hand.
// Rebuild after updating tables.race.sessions on an event JSON file.
(function () {
  if (typeof window === 'undefined') return;
  window.TGA_MULTI_RACE_SESSIONS = {
${lines.join(',\n')}
};
})();
`;

fs.writeFileSync(outPath, file);
const fromEvents = sortedKeys.filter((k) => !k.startsWith('DTM_') && !k.startsWith('GTWCE_SPRINT_')).length;
console.log('Wrote', outPath, `(${sortedKeys.length} events, ${Object.keys(CURATED_OVERRIDES).length} curated overrides)`);
