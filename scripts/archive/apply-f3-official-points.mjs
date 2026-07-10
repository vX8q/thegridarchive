#!/usr/bin/env node
/**
 * Apply FIA Formula 3 2026 championship points (SR/FR per round) to event JSON.
 * Source: https://www.fiaformula3.com/Standings/Driver?seasonId=183 (after Silverstone)
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'events', 'F3', '2026');
const ROUNDS = ['MEL', 'MON', 'BAR', 'SPI', 'GBR'];

/** [sprint, feature] per round code */
const OFFICIAL = {
  'U. Ugochukwu': { MEL: [0, 25], MON: [6, 12], BAR: [0, 15], SPI: [2, 18], GBR: [11, 15] },
  'F. Slater': { MEL: [0, 18], MON: [0, 16], BAR: [9, 4], SPI: [0, 15], GBR: [4, 20] },
  'T. Nael': { MEL: [0, 2], MON: [0, 20], BAR: [3, 27], SPI: [0, 0], GBR: [8, 0] },
  'N. Stromsted': { MEL: [2, 0], MON: [6, 1], BAR: [0, 0], SPI: [6, 26], GBR: [6, 10] },
  'B. Del Pino': { MEL: [5, 13], MON: [9, 8], BAR: [5, 8], SPI: [1, 0], GBR: [0, 0] },
  'M. Gladysz': { MEL: [0, 10], MON: [3, 0], BAR: [0, 1], SPI: [0, 0], GBR: [5, 25] },
  'B. Badoer': { MEL: [3, 0], MON: [0, 25], BAR: [1, 12], SPI: [0, 0], GBR: [0, 0] },
  'P. Clerot': { MEL: [0, 4], MON: [8, 4], BAR: [0, 0], SPI: [10, 12], GBR: [0, 2] },
  'H. Yamakoshi': { MEL: [0, 0], MON: [0, 0], BAR: [4, 19], SPI: [3, 6], GBR: [0, 4] },
  'T. Kato': { MEL: [1, 15], MON: [0, 0], BAR: [0, 2], SPI: [4, 8], GBR: [0, 0] },
  'E. Rivera': { MON: [0, 10], BAR: [0, 6], SPI: [10, 0], GBR: [0, 2] },
  'E. Deligny': { MEL: [4, 8], MON: [0, 0], BAR: [6, 10], SPI: [0, 0], GBR: [0, 0] },
  'J. Nakamura': { MEL: [0, 2], MON: [4, 0], BAR: [0, 0], SPI: [8, 10], GBR: [0, 0] },
  'G. Xie': { MEL: [0, 0], MON: [10, 2], BAR: [8, 0], SPI: [0, 0], GBR: [0, 0] },
  'J. Wharton': { MON: [0, 0], BAR: [11, 0], SPI: [7, 0], GBR: [1, 0] },
  'T. Taponen': { MON: [0, 0], BAR: [7, 0], SPI: [5, 6], GBR: [0, 0] },
  'L. Sharp': { MON: [0, 0], BAR: [2, 0], SPI: [0, 0], GBR: [3, 12] },
  'Y. David': { MON: [0, 0], BAR: [0, 0], SPI: [0, 0], GBR: [9, 6] },
  'A. Giusti': { MON: [7, 6], BAR: [0, 0], SPI: [0, 0], GBR: [0, 0] },
  'K. Le': { MON: [2, 0], BAR: [0, 0], SPI: [0, 1], GBR: [0, 8] },
  'M. De Palo': { MON: [0, 0], BAR: [0, 0], SPI: [0, 0], GBR: [7, 0] },
  'B. Benavides': { MEL: [0, 6] },
  'N. Lacorte': { MON: [0, 0], BAR: [0, 0], SPI: [0, 2], GBR: [0, 0] },
  'F. McLaughlin': { MON: [0, 0], BAR: [0, 0], SPI: [0, 0], GBR: [2, 0] },
  'M. Colnaghi': { MEL: [0, 1], MON: [0, 0], BAR: [0, 0], SPI: [0, 0], GBR: [0, 0] },
  'J. Garfias': { MON: [1, 0], BAR: [0, 0], SPI: [0, 0], GBR: [0, 0] },
  'N. Bhirombhakdi': { MON: [0, 0], BAR: [0, 0], SPI: [0, 0], GBR: [0, 0] },
  'C. Ho': { MON: [0, 0], BAR: [0, 0], SPI: [0, 0], GBR: [0, 0] },
  'P. Heuzenroeder': { MEL: [0, 0] },
  'F. Barrichello': { MON: [0, 0], BAR: [0, 0], SPI: [0, 0], GBR: [0, 0] },
  'M. Shin': { MON: [0, 0], BAR: [0, 0], SPI: [0, 0], GBR: [0, 0] },
  'S. Hanna': { SPI: [0, 0] },
  'R. Escotto': { BAR: [0, 0], GBR: [0, 0] },
};

const ALIASES = {
  'B. del Pino': 'B. Del Pino',
};

function officialPts(drv, code, si) {
  const key = ALIASES[drv] ?? drv;
  return OFFICIAL[key]?.[code]?.[si];
}

let changes = 0;

for (const file of readdirSync(dir).filter((f) => /^f3_2026_\d+\.json$/.test(f)).sort()) {
  const ri = parseInt(file.match(/_(\d+)\.json$/)[1], 10) - 1;
  const code = ROUNDS[ri];
  const path = join(dir, file);
  const ev = JSON.parse(readFileSync(path, 'utf8'));

  for (const sess of ev.tables?.race?.sessions ?? []) {
    const isSprint = /sprint/i.test(sess.meta?.Session || sess.title);
    const si = isSprint ? 0 : 1;
    const iPts = sess.headers.indexOf('Pts');
    const iDrv = sess.headers.indexOf('Driver');
    if (iPts < 0 || iDrv < 0) continue;

    for (const row of sess.rows) {
      const drv = row[iDrv];
      const wantVal = officialPts(drv, code, si);
      if (wantVal == null) continue;
      const want = String(wantVal);
      if (row[iPts] !== want) {
        console.log(`${file} ${code} ${isSprint ? 'SR' : 'FR'} ${drv}: ${row[iPts]} → ${want}`);
        row[iPts] = want;
        changes++;
      }
    }
  }

  writeFileSync(path, JSON.stringify(ev, null, 2) + '\n', 'utf8');
}

console.log(`\nDone: ${changes} cell(s) updated.`);
