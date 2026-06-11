#!/usr/bin/env node
/**
 * Sync SMP F4 Moscow 2026 session Pts from smpkarting.ru statistics.
 * Source: https://smpkarting.ru/competitions/formula-4/statistics
 */
import fs from 'fs';
import path from 'path';

const eventPath = path.join('data', 'events', 'SMP F4 Russia', '2026', 'smp_f4_ru_2026_1.json');

// [Q1, R1, R2, Q2, R3, R4] by car number (championship order on site)
const official = {
  // Q1=5 for #74: site qual column shows qual position (2nd), not points (5 per rules)
  74: [5, 20, 15, 0, 20, 17],
  50: [6, 25, 13, 4, 13, 13],
  79: [3, 16, 17, 3, 10, 20],
  11: [0, 9, 11, 5, 25, 15],
  27: [0, 7, 20, 6, 16, 8],
  18: [2, 13, 8, 2, 7, 10],
  19: [0, 10, 7, 0, 11, 11],
  73: [1, 11, 9, 0, 8, 5],
  33: [4, 8, 10, 0, 3, 6],
  97: [0, 6, 6, 1, 6, 9],
  21: [0, 3, 0, 0, 9, 7],
  38: [0, 4, 5, 0, 5, 2],
  78: [0, 1, 4, 0, 4, 1],
  45: [0, 0, 3, 0, 0, 4],
  34: [0, 5, 0, 0, 2, 0],
  77: [0, 2, 0, 0, 0, 3],
  22: [0, 0, 2, 0, 1, 0],
  17: [0, 0, 1, 0, 0, 0],
};

const j = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
const carCol = (h) => h.findIndex((x) => /^no\.?$/i.test(String(x).trim()) || x === 'No.');
const ptsCol = (h) => h.indexOf('Pts');
const raceIdx = [1, 2, 4, 5];

let n = 0;
for (let qi = 0; qi < 2; qi++) {
  const s = j.tables.qualifying.sessions[qi];
  const ci = carCol(s.headers);
  const pi = ptsCol(s.headers);
  for (const row of s.rows) {
    const car = row[ci];
    const want = official[car]?.[qi === 0 ? 0 : 3];
    if (want == null) continue;
    if (row[pi] !== String(want)) {
      row[pi] = String(want);
      n++;
    }
  }
}
for (let ri = 0; ri < 4; ri++) {
  const s = j.tables.race.sessions[ri];
  const ci = carCol(s.headers);
  const pi = ptsCol(s.headers);
  for (const row of s.rows) {
    const car = row[ci];
    const want = official[car]?.[raceIdx[ri]];
    if (want == null) continue;
    if (row[pi] !== String(want)) {
      row[pi] = String(want);
      n++;
    }
  }
}

fs.writeFileSync(eventPath, JSON.stringify(j, null, 2) + '\n');
console.log('Updated', n, 'Pts cells in', eventPath);
