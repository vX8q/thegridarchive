#!/usr/bin/env node
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'events', 'F3', '2026');
const ROUNDS = ['MEL', 'MON', 'BAR', 'SPI', 'GBR'];
const byDrv = {};

for (const file of readdirSync(dir).filter((f) => /^f3_2026_\d+\.json$/.test(f)).sort()) {
  const ri = parseInt(file.match(/_(\d+)\.json$/)[1], 10) - 1;
  const code = ROUNDS[ri];
  const ev = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  for (const sess of ev.tables?.race?.sessions ?? []) {
    const kind = /sprint/i.test(sess.title) ? 'S' : 'F';
    const iPts = sess.headers.indexOf('Pts');
    const iDrv = sess.headers.indexOf('Driver');
    for (const row of sess.rows) {
      const drv = row[iDrv];
      const pts = parseInt(row[iPts], 10) || 0;
      if (!pts) continue;
      if (!byDrv[drv]) byDrv[drv] = { total: 0, rounds: {} };
      byDrv[drv].total += pts;
      byDrv[drv].rounds[`${code}${kind}`] = pts;
    }
  }
}

const OFF = {
  'U. Ugochukwu': 104, 'F. Slater': 86, 'T. Nael': 60, 'N. Stromsted': 57,
  'B. Del Pino': 49, 'B. del Pino': 49, 'M. Gladysz': 44, 'B. Badoer': 41,
  'P. Clerot': 40, 'H. Yamakoshi': 36, 'T. Kato': 30, 'E. Rivera': 28,
  'E. Deligny': 28, 'J. Nakamura': 24, 'G. Xie': 20, 'J. Wharton': 19,
  'T. Taponen': 18, 'L. Sharp': 17, 'Y. David': 15, 'A. Giusti': 13, 'K. Le': 11,
};

console.log('Driver breakdown (pts by round):');
for (const [drv, d] of Object.entries(byDrv).sort((a, b) => b[1].total - a[1].total).slice(0, 12)) {
  const want = OFF[drv];
  const diff = want != null ? want - d.total : null;
  console.log(`\n${drv}: ${d.total}${diff != null ? ` (FIA ${want}, ${diff > 0 ? '+' + diff : diff})` : ''}`);
  console.log('  ', Object.entries(d.rounds).map(([k, v]) => `${k}=${v}`).join(' '));
}
