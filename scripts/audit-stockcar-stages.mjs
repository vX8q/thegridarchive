#!/usr/bin/env node
/**
 * Audit NASCAR national series (Cup / NOAPS / Truck) race JSON + expected stage layout.
 * Run: node scripts/audit-stockcar-stages.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  stockCarRaceSectionPlan,
  stockCarHasStageFormat,
  hasStage4,
  isAllstarStageRace,
} from './stockcar-stages-plan.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERIES_DIRS = [
  { dir: 'NASCAR Cup Series', label: 'Cup' },
  { dir: 'NOAPS', label: 'NOAPS' },
  { dir: 'NASCAR Truck', label: 'Truck' },
];

function loadEvents(seriesDir) {
  const base = path.join(root, 'data/events', seriesDir, '2026');
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const full = path.join(base, f);
      const d = JSON.parse(fs.readFileSync(full, 'utf8'));
      return { file: f, data: d };
    });
}

function countLabel(plan, label) {
  return plan.filter((x) => x === label).length;
}

const problems = [];
const summary = { Cup: 0, NOAPS: 0, Truck: 0 };

for (const { dir, label } of SERIES_DIRS) {
  for (const { file, data: d } of loadEvents(dir)) {
    summary[label]++;
    const tables = d.tables || {};
    const id = d.event_id || file;
    const plan = stockCarRaceSectionPlan(d, tables);

    if (isAllstarStageRace(tables)) continue;

    const hasRR = !!(tables.race_results?.rows?.length);
    if (!hasRR) continue;

    const four = hasStage4(d, tables);
    const stageFmt = stockCarHasStageFormat(d, tables);

    const s3pts = countLabel(plan, 'table:stage_3_points');
    const s4pts = countLabel(plan, 'table:stage_4_points');
    const asS3 = countLabel(plan, 'table:race_results_as_stage_3');
    const asS4 = countLabel(plan, 'table:race_results_as_stage_4');
    const asRR = countLabel(plan, 'table:race_results');

    if (four) {
      if (asS4 !== 1) problems.push({ id, file, issue: `4-stage: expected race_results_as_stage_4 once, got ${asS4}` });
      if (asS3 > 0) problems.push({ id, file, issue: '4-stage: race_results must not be labeled as stage 3' });
      if (s4pts > 0) problems.push({ id, file, issue: '4-stage: stage_4 points table must be skipped when race_results exists' });
      if (s3pts > 1) problems.push({ id, file, issue: '4-stage: duplicate stage_3 points' });
    } else if (stageFmt) {
      if (asS3 !== 1) problems.push({ id, file, issue: `3-stage: expected race_results_as_stage_3 once, got ${asS3}` });
      if (asS4 > 0) problems.push({ id, file, issue: '3-stage: unexpected stage 4 race results' });
      if (s3pts > 0 && asS3 > 0) problems.push({ id, file, issue: '3-stage: both stage_3 points and full race_results (duplicate final stage)' });
    } else {
      if (asRR !== 1) problems.push({ id, file, issue: `non-stage event: expected single race_results table, plan=${plan.join(',')}` });
      if (countLabel(plan, 'heading:race_results') > 0) problems.push({ id, file, issue: 'non-stage event: should not use stage section heading' });
    }
  }
}

console.log('Stock-car stage audit — events per series:', summary);
if (problems.length) {
  console.error('FAILURES:', problems.length);
  for (const p of problems) console.error(`  ${p.id} (${p.file}): ${p.issue}`);
  process.exit(1);
}
console.log('All stock-car stage layout checks passed.');
