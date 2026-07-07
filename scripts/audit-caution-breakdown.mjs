#!/usr/bin/env node
/**
 * Find caution_breakdown rows with Free Pass but no Reason (rendered green incorrectly).
 * Run: node scripts/audit-caution-breakdown.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadStockcarRaceApi } from './load-stockcar-race.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TGA = loadStockcarRaceApi();

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, out);
    else if (f.name.endsWith('.json')) out.push(p);
  }
  return out;
}

const problems = [];
for (const file of walk(path.join(root, 'data/events'))) {
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  const cb = d.tables?.caution_breakdown;
  if (!cb?.headers || !Array.isArray(cb.rows) || !cb.rows.length) continue;
  const reasonIdx = TGA.cautionBreakdownReasonColIndex(cb.headers);
  const fpIdx = TGA.cautionBreakdownFreePassColIndex(cb.headers);
  if (fpIdx < 0) continue;
  cb.rows.forEach((row, ri) => {
    const reason = reasonIdx >= 0 ? String(row[reasonIdx] ?? '').trim() : '';
    const fp = String(row[fpIdx] ?? '').trim();
    const fpLower = fp.toLowerCase();
    const hasFp = fp && fpLower !== 'none';
    if (hasFp && !reason) {
      const from = row[1] != null ? String(row[1]) : '?';
      const to = row[2] != null ? String(row[2]) : '?';
      problems.push({
        event: d.event_id,
        row: ri + 1,
        laps: `${from}-${to}`,
        freePass: fp,
        file: path.relative(root, file),
      });
    }
  });
}

console.log(`Caution breakdown audit: ${problems.length} row(s) with Free Pass but empty Reason`);
for (const p of problems) {
  console.log(`  WARN ${p.event} laps ${p.laps} FP ${p.freePass} (${p.file} row ${p.row})`);
}
console.log(problems.length ? 'Render treats these as yellow; consider filling Reason in JSON.' : 'No orphan Free Pass rows.');
