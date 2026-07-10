#!/usr/bin/env node
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'events', 'F3', '2026');
const SPRINT = [10, 8, 6, 5, 4, 3, 2, 1];

for (const file of readdirSync(dir).filter((f) => /^f3_2026_\d+\.json$/.test(f)).sort()) {
  const ev = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  const round = file.match(/_(\d+)/)[1];
  for (const sess of ev.tables?.race?.sessions ?? []) {
    if (!/sprint/i.test(sess.title + sess.meta?.Session)) continue;
    const iPts = sess.headers.indexOf('Pts');
    const iPos = sess.headers.indexOf('Pos');
    const iDrv = sess.headers.indexOf('Driver');
    console.log(`\nR${round} Sprint ${file}:`);
    for (const row of sess.rows) {
      const p = parseInt(row[iPos], 10);
      if (!p || p > 15) continue;
      const pts = row[iPts];
      const exp = p <= 8 ? SPRINT[p - 1] : '0';
      const fl = pts !== String(exp) && parseInt(pts) === parseInt(exp) + 1 ? ' (+FL?)' : '';
      const bad = pts !== String(exp) && !fl ? ' ***' : '';
      if (p <= 10 || bad) console.log(`  P${p} ${row[iDrv]}: ${pts} (std ${exp})${fl}${bad}`);
    }
  }
}
