#!/usr/bin/env node
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadStockcarRaceApi } from './load-stockcar-race.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TGA = loadStockcarRaceApi();

function load(relPath) {
  return JSON.parse(fs.readFileSync(path.join(root, relPath), 'utf8'));
}

function test(name, fn) {
  fn();
  console.log('ok', name);
}

test('3-stage Sonoma: stage_3 points skipped, full results as stage 3', () => {
  const d = load('data/events/NASCAR Cup Series/2026/nascar_cup_2026_18.json');
  const plan = TGA.stockCarRaceSectionPlan(d, d.tables);
  assert.ok(plan.includes('table:stage_1'));
  assert.ok(plan.includes('table:stage_2'));
  assert.ok(!plan.includes('table:stage_3_points'));
  assert.ok(plan.includes('table:race_results_as_stage_3'));
  assert.equal(plan.filter((x) => x === 'table:race_results_as_stage_3').length, 1);
});

test('4-stage Coca-Cola 600: stage_3 points kept, race_results as stage 4', () => {
  const d = load('data/events/NASCAR Cup Series/2026/nascar_cup_2026_13.json');
  const plan = TGA.stockCarRaceSectionPlan(d, d.tables);
  assert.ok(TGA.hasStage4(d, d.tables));
  assert.ok(plan.includes('table:stage_3_points'));
  assert.ok(!plan.includes('table:stage_4_points'));
  assert.ok(plan.includes('table:race_results_as_stage_4'));
  assert.ok(!plan.includes('table:race_results_as_stage_3'));
});

test('Clash: no stage format, plain race results', () => {
  const d = load('data/events/NASCAR Cup Series/2026/nascar_cup_2026_0.json');
  assert.equal(TGA.stockCarHasStageFormat(d, d.tables), false);
  const plan = TGA.stockCarRaceSectionPlan(d, d.tables);
  assert.deepEqual(plan, ['table:race_results']);
});

test('typical NOAPS: stage 1/2 + race as stage 3', () => {
  const d = load('data/events/NOAPS/2026/noaps_2026_4.json');
  const plan = TGA.stockCarRaceSectionPlan(d, d.tables);
  assert.ok(plan.includes('table:stage_1'));
  assert.ok(plan.includes('table:stage_2'));
  assert.ok(plan.includes('table:race_results_as_stage_3'));
});

test('qualifyingExcludingDidNotQualify removes DNQ car numbers', () => {
  const out = TGA.qualifyingExcludingDidNotQualify(
    { headers: ['Pos', 'No.', 'Driver'], rows: [['1', '5', 'A'], ['2', '99', 'B']] },
    { headers: ['No.', 'Driver'], rows: [['99', 'B']] }
  );
  assert.strictEqual(out.rows.length, 1);
  assert.strictEqual(out.rows[0][1], '5');
});

test('shouldSkipStage3PointsTable for 3-stage with race_results', () => {
  // 3-stage events no longer keep a separate stage_3 table in JSON; race_results
  // is stage 3. Skip only when a redundant stage_3 points table is still present.
  const three = {
    race_results: { headers: ['Pos'], rows: [['1']] },
    stage_3: { headers: ['Pos'], rows: [['1']] },
  };
  assert.strictEqual(TGA.shouldSkipStage3PointsTable(true, false, three), true);
  const four = load('data/events/NASCAR Cup Series/2026/nascar_cup_2026_13.json');
  assert.strictEqual(TGA.shouldSkipStage3PointsTable(true, true, four.tables), false);
});

test('caution row yellow when Free Pass set but Reason empty (Charlotte 600 #38)', () => {
  const d = load('data/events/NASCAR Cup Series/2026/nascar_cup_2026_13.json');
  const cb = d.tables.caution_breakdown;
  const row = cb.rows.find((r) => String(r[5] || '').trim() === '#38');
  assert.ok(row, 'expected #38 free pass row');
  assert.strictEqual(TGA.isCautionBreakdownCautionRow(row, cb.headers), true);
  assert.ok(TGA.cautionBreakdownRowClass(row, cb.headers).includes('caution-row-caution'));
});

test('caution row green when Reason and Free Pass both empty', () => {
  const headers = ['Condition', 'From Lap', 'To Lap', '# Of Laps', 'Reason', 'Free Pass'];
  const row = ['', '208', '210', '3', '', ''];
  assert.strictEqual(TGA.isCautionBreakdownCautionRow(row, headers), false);
});

console.log('All stockcar-race tests passed.');
