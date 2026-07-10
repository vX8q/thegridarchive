#!/usr/bin/env node
/**
 * Verify per-round [qualPts, racePts] in event JSON vs OFFICIAL_* in apply-imsa-official-points.mjs.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = join(scriptDir, '..', '..');
const apply = readFileSync(join(scriptDir, 'apply-imsa-official-points.mjs'), 'utf8');

const QUAL = [35, 32, 30, 28, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
const RACE = [350, 320, 300, 280, 260, 250, 240, 230, 220, 210, 200, 190, 180, 170, 160, 150, 140, 130, 120, 110, 100, 90, 80, 70, 60, 50, 40, 30, 20, 10];

const ROUNDS = [
  { code: 'DAY24', label: 'DAY', file: 'imsa_2026_1.json', idx: 0 },
  { code: 'SEB12', label: 'SEB', file: 'imsa_2026_2.json', idx: 1 },
  { code: 'LB', label: 'LB', file: 'imsa_2026_3.json', idx: 2 },
  { code: 'MON', label: 'MON', file: 'imsa_2026_4.json', idx: 3 },
  { code: 'WG', label: 'WG', file: 'imsa_2026_6.json', idx: 4 },
  { code: 'DET', label: 'DET', file: 'imsa_2026_5.json', idx: 5 },
];
const WG_FILE = 'imsa_2026_6.json';

function parseMap(name, re) {
  return eval('(' + apply.match(re)[1] + ')');
}

const CLASS_MAP = {
  GTP: parseMap('GTP', /const OFFICIAL_GTP = ({[\s\S]*?});/),
  LMP2: parseMap('LMP2', /const OFFICIAL_LMP2 = ({[\s\S]*?});/),
  'GTD Pro': parseMap('GTD Pro', /const OFFICIAL_GTD_PRO = ({[\s\S]*?});/),
  GTD: parseMap('GTD', /const OFFICIAL_GTD = ({[\s\S]*?});/),
};

const events = new Map();
function loadEvent(file) {
  if (!events.has(file)) {
    events.set(file, JSON.parse(readFileSync(join(root, 'data/events/IMSA/2026', file), 'utf8')));
  }
  return events.get(file);
}

const detroitEntries = Object.fromEntries(
  (loadEvent('imsa_2026_5.json').entry_list ?? []).map((e) => [e.number, e]),
);

function colIndex(headers, ...names) {
  const lower = headers.map((h) => String(h).toLowerCase());
  for (const name of names) {
    const i = lower.indexOf(name.toLowerCase());
    if (i >= 0) return i;
  }
  return -1;
}

function raceTargetFile(cls, idx, file, car) {
  if (idx !== 5) return file;
  if (cls === 'GTD') return WG_FILE;
  if (cls === 'GTD Pro' && car && !detroitEntries[car]) return WG_FILE;
  return file;
}

function qualPtsFromEvent(file, car, cls) {
  const data = loadEvent(file);
  const entry = data.entry_list?.find((e) => e.number === car && e.class === cls);
  if (!entry) return null;
  const qual = data.tables?.qualifying;
  if (!qual?.rows) return 0;
  const iCar = colIndex(qual.headers, 'CAR NO', 'No.', '#');
  const iCls = colIndex(qual.headers, 'CLASS', 'Class');
  const iCp = colIndex(qual.headers, 'CLASS POS', 'Class Pos');
  const row = qual.rows.find((r) => r[iCar] === car && (iCls < 0 || r[iCls] === cls));
  if (!row || iCp < 0) return 0;
  const p = parseInt(row[iCp], 10);
  if (!p) return 0;
  return QUAL[p - 1] ?? (p > 30 ? 1 : 0);
}

function racePtsFromEvent(file, car, cls) {
  const data = loadEvent(file);
  const entry = data.entry_list?.find((e) => e.number === car && e.class === cls);
  if (!entry) return null;
  const race = data.tables?.race;
  if (!race?.rows) return 0;
  const iCar = colIndex(race.headers, 'CAR NO', 'No.', '#');
  const iCls = colIndex(race.headers, 'CLASS', 'Class');
  const iPts = colIndex(race.headers, 'PTS', 'Points');
  const iCp = colIndex(race.headers, 'CLASS POS', 'Class Pos');
  const row = race.rows.find((r) => r[iCar] === car && r[iCls] === cls);
  if (!row) return 0;
  if (iPts >= 0 && row[iPts] !== '') {
    const v = parseInt(String(row[iPts]).replace(/[^\d]/g, ''), 10);
    if (v > 0) return v;
  }
  if (iCp >= 0) {
    const p = parseInt(row[iCp], 10);
    if (p > 0) return RACE[p - 1] ?? (p > 30 ? 10 : 0);
  }
  return 0;
}

let fail = 0;
let checked = 0;

for (const [cls, official] of Object.entries(CLASS_MAP)) {
  for (const [car, rounds] of Object.entries(official)) {
    for (const round of ROUNDS) {
      const [wantQ, wantR] = rounds[round.idx] ?? [0, 0];
      if (!wantQ && !wantR) continue;

      const qualFile = round.file;
      const raceFile = raceTargetFile(cls, round.idx, round.file, car);

      let gotQ = 0;
      let gotR = 0;
      if (wantQ) {
        const q = qualPtsFromEvent(qualFile, car, cls);
        if (q === null) {
          fail++;
          console.log(`MISSING ${cls} #${car} ${round.label} qual: no entry (want ${wantQ})`);
          continue;
        }
        gotQ = q;
      }
      if (wantR) {
        const r = racePtsFromEvent(raceFile, car, cls);
        if (r === null) {
          fail++;
          console.log(`MISSING ${cls} #${car} ${round.label} race @ ${raceFile}: no entry (want ${wantR})`);
          continue;
        }
        gotR = r;
      }

      checked++;
      const qOk = gotQ === wantQ;
      const rOk = gotR === wantR;
      if (!qOk || !rOk) {
        fail++;
        const parts = [];
        if (!qOk) parts.push(`qual got ${gotQ} want ${wantQ}`);
        if (!rOk) parts.push(`race got ${gotR} want ${wantR}`);
        console.log(`${cls} #${car} ${round.label}: ${parts.join(', ')}`);
      }
    }
  }
}

if (fail) {
  console.log(`\n${fail} per-round mismatch(es) of ${checked} non-zero cells checked`);
  process.exit(1);
}
console.log(`All ${checked} non-zero qual/race cells match PDF per round.`);
