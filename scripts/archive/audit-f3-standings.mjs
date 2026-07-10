#!/usr/bin/env node
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'data', 'events', 'F3', '2026');

const OFFICIAL = {
  'U. Ugochukwu': 104,
  'F. Slater': 86,
  'T. Naël': 60,
  'N. Strømsted': 57,
  'B. Del Pino': 49,
  'M. Gładysz': 44,
  'B. Badoer': 41,
  'P. Clerot': 40,
  'H. Yamakoshi': 36,
  'T. Kato': 30,
  'E. Rivera': 28,
  'E. Deligny': 28,
  'J. Nakamura': 24,
  'G. Xie': 20,
  'J. Wharton': 19,
  'T. Taponen': 18,
  'L. Sharp': 17,
  'Y. David': 15,
  'A. Giusti': 13,
  'K. Le': 11,
  'M. De Palo': 7,
  'B. Benavides': 6,
  'N. Lacorte': 2,
  'F. McLaughlin': 2,
};

const SPRINT_SCALE = [10, 8, 6, 5, 4, 3, 2, 1];
const FEATURE_SCALE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

function ptsCol(headers) {
  return headers.findIndex((h) => /^pts$/i.test(h));
}
function posCol(headers) {
  return headers.findIndex((h) => /^pos$/i.test(h));
}
function drvCol(headers) {
  return headers.findIndex((h) => /^driver$/i.test(h));
}

const totals = {};
const issues = [];

for (const file of readdirSync(dir).filter((f) => /^f3_2026_\d+\.json$/.test(f)).sort()) {
  const ev = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  const round = file.match(/_(\d+)\.json$/)[1];
  for (const sess of ev.tables?.race?.sessions ?? []) {
    const kind = /sprint/i.test(sess.meta?.Session || sess.title) ? 'sprint' : 'feature';
    const iPts = ptsCol(sess.headers);
    const iPos = posCol(sess.headers);
    const iDrv = drvCol(sess.headers);
    for (const row of sess.rows) {
      const drv = row[iDrv];
      const pos = row[iPos];
      const pts = parseInt(row[iPts], 10) || 0;
      if (!drv || pos === 'DNF' || pos === 'DNS') continue;
      totals[drv] = (totals[drv] || 0) + pts;
      const p = parseInt(pos, 10);
      if (!p) continue;
      const scale = kind === 'sprint' ? SPRINT_SCALE : FEATURE_SCALE;
      const maxFinish = kind === 'sprint' ? 8 : 10;
      let expected = p <= maxFinish ? scale[p - 1] : 0;
      // bonuses only in feature - detect if pts > expected finish
      if (kind === 'feature' && pts > expected && pts <= expected + 3) {
        expected = pts; // pole +2 or FL +1
      }
      if (kind === 'sprint' && pts > expected && pts === expected + 1) {
        expected = pts; // FL +1
      }
      if (pts !== expected && !(kind === 'feature' && pts > scale[0])) {
        // allow feature with pole+fl combos
        const base = p <= maxFinish ? scale[p - 1] : 0;
        const okBonuses = [base, base + 1, base + 2, base + 3].includes(pts);
        if (!okBonuses) {
          issues.push({ file, round, kind, drv, pos, pts, expected: base, session: sess.meta?.Session });
        }
      }
    }
  }
}

console.log('=== Standings vs FIA (top 15) ===');
const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
for (const [drv, pts] of sorted.slice(0, 15)) {
  const want = OFFICIAL[drv];
  const mark = want == null ? '?' : want === pts ? 'OK' : `DIFF ${pts - want}`;
  console.log(`${String(pts).padStart(3)} ${drv.padEnd(16)} ${mark}${want != null && want !== pts ? ` (FIA ${want})` : ''}`);
}

console.log(`\n=== Pts anomalies (${issues.length}) ===`);
for (const i of issues.slice(0, 40)) {
  console.log(`R${i.round} ${i.kind} ${i.drv} P${i.pos}: pts=${i.pts} expected~${i.expected}`);
}
if (issues.length > 40) console.log(`... +${issues.length - 40} more`);
