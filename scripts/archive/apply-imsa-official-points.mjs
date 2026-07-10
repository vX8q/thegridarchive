#!/usr/bin/env node
/**
 * Apply official IMSA points from 2026_IWSC_WGI_OfficialPoints.pdf.
 * PDF pair order per round: DAY, SEB, LB, MON, WG, DET (race, qual each).
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const QUAL_POS = Object.fromEntries(
  [35, 32, 30, 28, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((pts, i) => [pts, i + 1]),
);
const qualPos = (pts) => QUAL_POS[pts] ?? 0;

const ROUNDS = ['DAY24', 'SEB12', 'LB', 'MON', 'WG', 'DET'];
const ROUND_FILE = {
  DAY24: 'imsa_2026_1.json',
  SEB12: 'imsa_2026_2.json',
  LB: 'imsa_2026_3.json',
  MON: 'imsa_2026_4.json',
  WG: 'imsa_2026_6.json',
  DET: 'imsa_2026_5.json',
};

// [race, qual] — from PDF team tables (Jul 3 2026).
const OFFICIAL = {
  GTP: {
    '31': [[320, 35], [300, 28], [320, 32], [320, 35], [350, 35], [350, 20]],
    '93': [[260, 22], [250, 35], [350, 30], [260, 30], [280, 28], [320, 35]],
    '7': [[350, 25], [350, 26], [280, 22], [240, 23], [260, 21], [260, 21]],
    '6': [[280, 28], [320, 23], [300, 23], [250, 21], [250, 23], [230, 23]],
    '5': [[240, 24], [230, 21], [250, 20], [350, 20], [300, 26], [200, 26]],
    '24': [[300, 23], [260, 25], [260, 28], [220, 26], [280, 25], [220, 25]],
    '60': [[220, 32], [280, 20], [240, 26], [280, 25], [210, 32], [240, 32]],
    '25': [[230, 20], [210, 32], [200, 21], [300, 28], [220, 25], [320, 20]],
    '40': [[250, 26], [240, 30], [230, 35], [210, 32], [230, 30], [250, 30]],
    '10': [[200, 30], [200, 22], [210, 24], [200, 24], [240, 24], [300, 24]],
    '23': [[210, 21], [220, 24], [220, 25], [230, 22], [200, 22], [210, 22]],
  },
  LMP2: {
    '04': { DAY24: [350, 26], WG: [320, 28] },
    '99': { DAY24: [260, 28], WG: [350, 32] },
    '22': { DAY24: [280, 32], WG: [260, 30] },
    '43': { DAY24: [320, 30], WG: [280, 35] },
    '18': { DAY24: [220, 21], WG: [300, 21] },
    '2': { DAY24: [210, 23], WG: [220, 23] },
    '8': { DAY24: [230, 22], WG: [240, 21] },
    '52': { DAY24: [250, 35], WG: [250, 26] },
    '73': { DAY24: [200, 25], WG: [230, 22] },
    '11': { DAY24: [190, 24], WG: [210, 24] },
    '37': { DAY24: [240, 20], WG: [200, 20] },
  },
  'GTD Pro': {
    '1': { DAY24: [350, 32], LB: [260, 32], MON: [230, 25], WG: [320, 30] },
    '3': { DAY24: [180, 26], LB: [280, 26], MON: [280, 35], WG: [280, 22] },
    '4': { DAY24: [280, 24], LB: [300, 23], MON: [320, 32], WG: [230, 20] },
    '65': { DAY24: [240, 21], MON: [350, 30], WG: [210, 28] },
    '77': { DAY24: [220, 23], MON: [300, 28], WG: [240, 23] },
    '14': { DAY24: [210, 35], MON: [200, 35], WG: [350, 35] },
    '9': { DAY24: [250, 19], MON: [260, 25], WG: [220, 19] },
    '64': { DAY24: [170, 20], MON: [250, 22], WG: [300, 23] },
    '59': { DAY24: [190, 28], MON: [240, 24], WG: [200, 24] },
    '911': { DAY24: [260, 30], WG: [190, 18] },
    '033': { DAY24: [230, 22], WG: [250, 26] },
    '62': { DAY24: [160, 25], WG: [260, 21] },
  },
  GTD: {
    '27': { DAY24: [300, 35], SEB12: [320, 30], LB: [210, 30], MON: [320, 30], WG: [260, 0] },
    '12': { DAY24: [220, 25], SEB12: [190, 25], LB: [350, 26], WG: [280, 0] },
    '96': { DAY24: [210, 30], SEB12: [260, 26], LB: [320, 24], WG: [240, 0] },
    '120': { DAY24: [110, 24], SEB12: [300, 18], LB: [160, 23], WG: [320, 0] },
    '57': { DAY24: [350, 32], SEB12: [130, 28], LB: [220, 28], WG: [160, 0] },
    '34': { DAY24: [170, 17], SEB12: [240, 24], LB: [300, 35], WG: [250, 0] },
    '068': { DAY24: [200, 23], SEB12: [180, 19], LB: [230, 25], MON: [210, 25], WG: [300, 0] },
    '13': { DAY24: [280, 14], SEB12: [250, 15], LB: [190, 19], WG: [180, 0] },
    '70': { DAY24: [180, 19], SEB12: [140, 20], LB: [280, 22], WG: [130, 0] },
    '45': { DAY24: [230, 20], SEB12: [150, 32], LB: [140, 32], WG: [110, 0] },
    '16': { DAY24: [120, 16], SEB12: [200, 17], LB: [240, 20], WG: [170, 0] },
  },
};

function colIndex(headers, ...names) {
  const lower = headers.map((h) => String(h).toLowerCase());
  for (const name of names) {
    const i = lower.indexOf(name.toLowerCase());
    if (i >= 0) return i;
  }
  return -1;
}

function loadEvent(name) {
  const path = join(root, 'data', 'events', 'IMSA', '2026', name);
  return { path, data: JSON.parse(readFileSync(path, 'utf8')) };
}

function saveEvent(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function entryByCar(data) {
  const m = {};
  for (const e of data.entry_list ?? []) m[e.number] = e;
  return m;
}

function roundSpec(cls, car, roundCode) {
  const block = OFFICIAL[cls]?.[car];
  if (!block) return null;
  if (Array.isArray(block)) {
    const idx = ROUNDS.indexOf(roundCode);
    return idx >= 0 ? block[idx] : null;
  }
  return block[roundCode] ?? null;
}

function ensurePtsColumn(race) {
  let iPts = colIndex(race.headers, 'PTS', 'Points');
  if (iPts >= 0) return iPts;
  const iFl = colIndex(race.headers, 'FASTEST LAP', 'Fastest Lap');
  const insertAt = iFl >= 0 ? iFl + 1 : race.headers.length;
  race.headers.splice(insertAt, 0, 'PTS');
  for (const row of race.rows) row.splice(insertAt, 0, '');
  return insertAt;
}

function applyQualRow(qual, car, cls, qPts, entry) {
  const iCar = colIndex(qual.headers, 'CAR NO', 'No.', '#');
  const iCls = colIndex(qual.headers, 'CLASS', 'Class');
  const iCPos = colIndex(qual.headers, 'CLASS POS', 'Class Pos');
  const iDrv = colIndex(qual.headers, 'DRIVERS', 'Driver');
  const iTeam = colIndex(qual.headers, 'TEAM/CAR/SPONSOR', 'Team');
  const want = qualPos(qPts);
  if (!want) return 0;

  let row = qual.rows.find((r) => r[iCar] === car && (iCls < 0 || r[iCls] === cls));
  if (!row) {
    row = new Array(qual.headers.length).fill('');
    row[colIndex(qual.headers, 'POS', 'Pos')] = '';
    row[iCar] = car;
    if (iCls >= 0) row[iCls] = cls;
    if (entry) {
      if (iDrv >= 0) row[iDrv] = entry.driver;
      if (iTeam >= 0) row[iTeam] = `${entry.team} / ${entry.car || entry.manufacturer || ''}`.replace(/ \/ $/, '');
    }
    row[colIndex(qual.headers, 'STATUS', 'Status')] = 'Running';
    qual.rows.push(row);
    return 1;
  }
  if (row[iCPos] !== String(want)) {
    row[iCPos] = String(want);
    return 1;
  }
  return 0;
}

function applyFile(roundCode, file) {
  const { path, data } = loadEvent(file);
  let qualN = 0;
  let raceN = 0;
  const entries = entryByCar(data);
  const qual = data.tables?.qualifying;
  const race = data.tables?.race;

  if (qual?.rows) {
    for (const [cls, cars] of Object.entries(OFFICIAL)) {
      for (const car of Object.keys(cars)) {
        const spec = roundSpec(cls, car, roundCode);
        if (!spec) continue;
        const [, qPts] = spec;
        if (!qPts) continue;
        qualN += applyQualRow(qual, car, cls, qPts, entries[car]);
      }
    }
  }

  if (race?.rows?.length) {
    const iPts = ensurePtsColumn(race);
    const iCar = colIndex(race.headers, 'CAR NO', 'No.', '#');
    const iCls = colIndex(race.headers, 'CLASS', 'Class');
    for (const row of race.rows) {
      const car = row[iCar];
      const cls = row[iCls];
      const spec = roundSpec(cls, car, roundCode);
      if (!spec) continue;
      const [rPts] = spec;
      if (row[iPts] !== String(rPts)) {
        row[iPts] = String(rPts);
        raceN++;
      }
    }
  }

  if (qualN || raceN) {
    saveEvent(path, data);
    console.log(`${file} (${roundCode}): qual ${qualN}, race ${raceN}`);
  }
}

for (const roundCode of ROUNDS) {
  applyFile(roundCode, ROUND_FILE[roundCode]);
}

console.log('Done.');
