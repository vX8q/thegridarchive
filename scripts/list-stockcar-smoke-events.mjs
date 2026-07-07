#!/usr/bin/env node
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

function isQualSep(row) {
  const x = String(row[0] || '').trim().toLowerCase();
  return x === "qualified by owner's points" || x === 'failed to qualify' || x === 'did not qualify';
}

const dirs = [
  ['NASCAR Cup Series', 'cup'],
  ['NOAPS', 'noaps'],
  ['NASCAR Truck', 'truck'],
  ['ARCA', 'arca'],
  ['NASCAR Modified', 'mod'],
];

const rows = [];
for (const [dir, label] of dirs) {
  const base = path.join(root, 'data/events', dir, '2026');
  if (!fs.existsSync(base)) continue;
  for (const file of fs.readdirSync(base).filter((f) => f.endsWith('.json'))) {
    const d = JSON.parse(fs.readFileSync(path.join(base, file), 'utf8'));
    const t = d.tables || {};
    const plan = TGA.stockCarRaceSectionPlan(d, t);
    const hasRR = !!(t.race_results?.rows?.length);
    const s3 = !!(TGA.tgaStageTable(t, 3)?.rows?.length);
    rows.push({
      label,
      event: d.event_id,
      slug: String(d.event_id || '').toLowerCase().replace(/_/g, '-'),
      race: d.race,
      plan: plan.join(', '),
      hasRR,
      s3only: !hasRR && s3,
      s4: TGA.hasStage4(d, t),
      allstar: TGA.isAllstarStageRace(t),
      dnq: !!(t.did_not_qualify?.rows?.length),
      qualSep: (t.qualifying?.rows || []).some(isQualSep),
      stage3laps: d.stage3_laps || null,
    });
  }
}

const pick = (pred) => rows.filter(pred).map((r) => `${r.slug} — ${r.race}`);

console.log('=== 3-stage + race_results (Stage 3 title) ===');
console.log(pick((r) => r.hasRR && r.plan.includes('race_results_as_stage_3') && !r.s4).slice(0, 5).join('\n') || '(none)');

console.log('\n=== 4-stage Coca-Cola pattern ===');
console.log(pick((r) => r.s4 && r.plan.includes('race_results_as_stage_4')).join('\n') || '(none)');

console.log('\n=== stage_3 only, NO race_results (Race Results title on stage 3) ===');
console.log(pick((r) => r.s3only).join('\n') || '(none)');

console.log('\n=== Clash / no stages ===');
console.log(pick((r) => r.plan === 'table:race_results').join('\n') || '(none)');

console.log('\n=== DNQ table ===');
console.log(pick((r) => r.dnq).join('\n') || '(none)');

console.log('\n=== Qualifying separators ===');
console.log(pick((r) => r.qualSep).join('\n') || '(none)');

console.log('\n=== All-Star ===');
console.log(pick((r) => r.allstar).join('\n') || '(none)');

console.log('\n=== ARCA (no Cup stages) ===');
console.log(pick((r) => r.label === 'arca' && r.hasRR).slice(0, 4).join('\n') || '(none)');

console.log('\n=== Modified (no Cup stages) ===');
console.log(pick((r) => r.label === 'mod').join('\n') || '(none)');
