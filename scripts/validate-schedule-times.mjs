#!/usr/bin/env node
/**
 * Validate time_est / time_msk consistency across data/schedules/*.json
 * Uses IANA timezones + DST from data/timezones-reference.json
 * Run: node scripts/validate-schedule-times.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  NASCAR_EASTERN_SERIES,
  expectedUtcMs,
  formatMskEmbedded,
  getRaceDateIso,
  matchesUtc,
  mskUtcCandidates,
  resolveEventTimezone,
} from './lib/timezones.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const schedulesDir = path.join(root, 'data', 'schedules');

const issues = [];
const skipped = [];
const ok = [];

for (const file of fs.readdirSync(schedulesDir).filter((f) => f.endsWith('.json')).sort()) {
  const rows = JSON.parse(fs.readFileSync(path.join(schedulesDir, file), 'utf8').replace(/^\uFEFF/, ''));
  if (!Array.isArray(rows)) continue;
  for (const ev of rows) {
    const id = ev.id || '';
    const sid = String(ev.series_id || '').toUpperCase();
    const timeEst = ev.time_est || '';
    const timeMsk = ev.time_msk || '';
    const raceDateIso = getRaceDateIso(ev);

    if (!timeEst || !timeMsk || /^tbd$/i.test(timeEst) || /^tbd$/i.test(timeMsk)) {
      skipped.push({ file, id, reason: 'TBD or missing' });
      continue;
    }
    if (!raceDateIso) {
      skipped.push({ file, id, reason: 'no date' });
      continue;
    }

    const gotCandidates = mskUtcCandidates(timeMsk, raceDateIso, sid);
    const expUtc = expectedUtcMs(ev, sid, raceDateIso, timeEst);
    const tz = resolveEventTimezone(ev, sid);

    if (!expUtc) {
      skipped.push({ file, id, reason: tz ? 'could not parse time_est' : 'no timezone rule' });
      continue;
    }
    if (!gotCandidates.length) {
      skipped.push({ file, id, reason: 'could not parse time_msk' });
      continue;
    }

    if (!matchesUtc(gotCandidates, expUtc)) {
      issues.push({
        file, id, sid, raceDateIso, timeEst, tz,
        got: timeMsk, expected: formatMskEmbedded(expUtc),
      });
    } else {
      ok.push(id);
    }
  }
}

console.log(`OK: ${ok.length}, Issues: ${issues.length}, Skipped: ${skipped.length}\n`);

if (issues.length) {
  console.log('=== MISMATCHES ===');
  for (const i of issues) {
    console.log(`${i.file}\t${i.id}\tlocal ${i.timeEst} (${i.tz})\trace ${i.raceDateIso}\tgot ${i.got}\texpected ${i.expected}`);
  }
}

const byFile = {};
for (const i of issues) {
  byFile[i.file] = (byFile[i.file] || 0) + 1;
}
if (Object.keys(byFile).length) {
  console.log('\n=== BY FILE ===');
  for (const [f, n] of Object.entries(byFile).sort((a, b) => b[1] - a[1])) {
    console.log(`${f}: ${n}`);
  }
}

process.exit(issues.length ? 1 : 0);
