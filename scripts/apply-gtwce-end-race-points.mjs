/**
 * Applies Cup pts / Overall pts to GTWCE Endurance race sessions (one Main Race per event).
 * Class points from class rank; Overall pts from absolute finish rank; +1 pole per class;
 * Pro pole also adds +1 to Overall pts; NC/Ret keeps pole-only.
 *
 * Run: node scripts/apply-gtwce-end-race-points.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');

/** @typedef {{ pro: string, gold: string, silver: string, bronze: string }} PoleMap */

/** @type {Array<{ file: string, pts: number[], pole: PoleMap }>} */
const EVENTS = [
  {
    file: 'data/events/GT World Challenge Europe Endurance/2026/gtwce_end_2026_1.json',
    /** Paul Ricard — 33, 24, 19, 15, 12, 9, 6, 4, 2, 1 + pole */
    pts: [null, 33, 24, 19, 15, 12, 9, 6, 4, 2, 1],
    /** Pro #48 2P; Gold #58 3PF; Silver #21 20PF; Bronze #91 35P */
    pole: { pro: '48', gold: '58', silver: '21', bronze: '91' },
  },
  {
    file: 'data/events/GT World Challenge Europe Endurance/2026/gtwce_end_2026_2.json',
    /** Monza / Nürburgring / Barcelona — 25, 18, 15, 12, 10, 8, 6, 4, 2, 1 + pole */
    pts: [null, 25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
    /** Pro #64 P; Gold #99 P; Silver #65 P; Bronze #87 P (Q3 grid) */
    pole: { pro: '64', gold: '99', silver: '65', bronze: '87' },
  },
];

const CLASS_KEYS = ['Pro Cup', 'Gold Cup', 'Silver Cup', 'Bronze Cup'];

function fmt(n) {
  if (n === 0) return '0';
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

function poleForClass(cls, pole) {
  switch (cls) {
    case 'Pro Cup':
      return pole.pro;
    case 'Gold Cup':
      return pole.gold;
    case 'Silver Cup':
      return pole.silver;
    case 'Bronze Cup':
      return pole.bronze;
    default:
      return '';
  }
}

function computeSession(rows, ptsTable, pole) {
  const pt = (rank) => (rank >= 1 && rank <= 10 ? ptsTable[rank] : 0);

  const classified = rows.filter((r) => /^\d+$/.test(String(r.pos)));
  const byClass = {
    'Pro Cup': [],
    'Gold Cup': [],
    'Silver Cup': [],
    'Bronze Cup': [],
  };
  for (const r of classified) {
    if (byClass[r.cls]) byClass[r.cls].push(r);
  }
  for (const c of CLASS_KEYS) {
    byClass[c].sort((a, b) => parseInt(a.pos, 10) - parseInt(b.pos, 10));
  }

  return rows.map((r) => {
    if (!/^\d+$/.test(String(r.pos))) {
      let cup = 0;
      let overall = 0;
      const p = poleForClass(r.cls, pole);
      if (r.cls === 'Pro Cup' && p && r.num === p) overall = 1;
      else if (p && r.num === p) cup = 1;
      return { cupPts: fmt(cup), overallPts: fmt(overall) };
    }

    const absRank = parseInt(r.pos, 10);
    let overallPts = pt(absRank);
    if (r.cls === 'Pro Cup' && r.num === pole.pro) overallPts += 1;

    const arr = byClass[r.cls] || [];
    const idx = arr.findIndex((x) => x.num === r.num);
    const classRank = idx >= 0 ? idx + 1 : 0;
    let cupPts = pt(classRank);
    const p = poleForClass(r.cls, pole);
    if (p && r.num === p) cupPts += 1;

    return { cupPts: fmt(cupPts), overallPts: fmt(overallPts) };
  });
}

const newHeaders = [
  'Pos',
  'Car #',
  'Class',
  'Drivers',
  'Team',
  'Car',
  'Time',
  'Laps',
  'Gap',
  'Cup pts',
  'Overall pts',
];

for (const ev of EVENTS) {
  const eventPath = path.join(repoRoot, ev.file);
  const raw = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  const sessions = raw.tables?.race?.sessions;
  if (!Array.isArray(sessions) || sessions.length < 1) {
    console.error('Expected tables.race.sessions in', ev.file);
    process.exit(1);
  }

  for (const sess of sessions) {
    const rows = sess.rows.map((row) => ({
      pos: row[0],
      num: String(row[1]),
      cls: row[2],
    }));
    const pts = computeSession(rows, ev.pts, ev.pole);
    sess.headers = newHeaders.slice();
    sess.rows = sess.rows.map((row, i) => {
      const base = row.slice(0, 9);
      const p = pts[i];
      return [...base, p.cupPts, p.overallPts];
    });
  }

  fs.writeFileSync(eventPath, JSON.stringify(raw, null, 2) + '\n', 'utf8');
  console.log('Updated', ev.file);
}
