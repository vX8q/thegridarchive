#!/usr/bin/env node
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadTouringApi() {
  const window = { TGA: {}, console };
  const src = fs.readFileSync(path.join(root, 'web', 'lib', 'touring-race.js'), 'utf8');
  vm.runInNewContext(src, { window, console });
  return window.TGA;
}

function test(name, fn) {
  fn();
  console.log('ok', name);
}

const TGA = loadTouringApi();

test('transformSupercarsRaceTable normalizes ST layout and teams', () => {
  const byNumber = { '1': 'Team One' };
  const out = TGA.transformSupercarsRaceTable(
    ['Pos', 'ST', 'No.', 'Driver', 'Team', 'Race time', 'Laps', 'Pts'],
    [['1', '1', '01', 'A. Driver', 'Old Team', '44:00', '50', '80']],
    byNumber
  );
  assert.strictEqual(out.headers.join('|'), 'Pos|ST|No.|Driver|Team|Race time|Laps|Pts');
  assert.strictEqual(out.rows[0][2], '1');
  assert.strictEqual(out.rows[0][4], 'Team One');
});

test('normalizeIndycarRaceTable renames Start Pos to St', () => {
  const out = TGA.normalizeIndycarRaceTable({
    headers: ['Pos', 'Start Pos', 'No.', 'Driver'],
    rows: [['1', '3', '10', 'A. Driver']],
  });
  assert.strictEqual(out.headers[1], 'St');
});

test('normalizeSupercarsTableNumberColumn strips leading zeros', () => {
  const out = TGA.normalizeSupercarsTableNumberColumn({
    headers: ['Pos', 'No.', 'Driver'],
    rows: [['1', '01', 'A'], ['2', '800', 'B']],
  }, 1);
  assert.strictEqual(out.rows[0][1], '1');
  assert.strictEqual(out.rows[1][1], '8');
});

test('supercarsSydneyCarDisplay shows 800 for car 8', () => {
  const out = TGA.supercarsSydneyCarDisplay({
    headers: ['Pos', 'No.', 'Driver'],
    rows: [['1', '8', 'A']],
  });
  assert.strictEqual(out.rows[0][1], '800');
});

test('dropIndycarCautionFreePassColumn removes Free Pass column', () => {
  const out = TGA.dropIndycarCautionFreePassColumn({
    headers: ['Reason', 'From Lap', 'Free Pass'],
    rows: [['Debris', '10', '']],
  });
  assert.deepStrictEqual(out.headers, ['Reason', 'From Lap']);
  assert.strictEqual(out.rows[0].length, 2);
});

test('normalizeFinStTable splits Fin / ST column', () => {
  const out = TGA.normalizeFinStTable({
    headers: ['Pos', 'Fin / ST', 'Driver'],
    rows: [['1', '1 / ST 3', 'A']],
  });
  assert.deepStrictEqual(out.headers, ['Pos', 'Fin', 'ST', 'Driver']);
  assert.strictEqual(out.rows[0][1], '1');
  assert.strictEqual(out.rows[0][2], '3');
});

test('expandSupercarsSubstituteEntryRows expands multi-driver entries', () => {
  const out = TGA.expandSupercarsSubstituteEntryRows([
    { number: '1', driver: 'A', driver1: 'B', team: 'T' },
  ]);
  assert.strictEqual(out.length, 2);
  assert.strictEqual(out[0].driver, 'A');
  assert.strictEqual(out[1].driver, 'B');
});

test('splitSuperGtRaceBlockByClass splits GT500 and GT300', () => {
  const sessions = TGA.splitSuperGtRaceBlockByClass({
    headers: ['Pos', 'CLASS', 'Driver'],
    rows: [['1', 'GT500', 'A'], ['1', 'GT300', 'B']],
    meta: { Date: 'Sun' },
  });
  assert.strictEqual(sessions.length, 2);
  assert.strictEqual(sessions[0].title, 'GT500');
  assert.strictEqual(sessions[1].title, 'GT300');
  assert.ok(sessions[0].headers.indexOf('CLASS') < 0);
  assert.strictEqual(sessions[1].meta, null);
});

console.log('All touring-race tests passed.');
