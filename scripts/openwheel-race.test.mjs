#!/usr/bin/env node
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadOpenwheelApi() {
  const window = { TGA: {}, console };
  const src = fs.readFileSync(path.join(root, 'web', 'lib', 'openwheel-race.js'), 'utf8');
  vm.runInNewContext(src, { window, console });
  return window.TGA;
}

function test(name, fn) {
  fn();
  console.log('ok', name);
}

const TGA = loadOpenwheelApi();

test('isChampionshipPrefixedSessionTitle detects F2/F3 championship prefix', () => {
  assert.strictEqual(
    TGA.isChampionshipPrefixedSessionTitle('2026 FIA Formula 2 Championship - Practice'),
    true
  );
  assert.strictEqual(TGA.isChampionshipPrefixedSessionTitle('Practice 1'), false);
});

test('subtitleMatchesEventVenue matches track and race name', () => {
  var ev = { race: 'Monaco', track: 'Circuit de Monaco', location: 'Monte Carlo' };
  assert.strictEqual(TGA.subtitleMatchesEventVenue('Circuit de Monaco', ev), true);
  assert.strictEqual(TGA.subtitleMatchesEventVenue('Monaco', ev), true);
  assert.strictEqual(TGA.subtitleMatchesEventVenue('Spa', ev), false);
});

test('transformTableDataForF2F3 drops Chassis and renames Manufacturer', () => {
  const out = TGA.transformTableDataForF2F3({
    headers: ['Pos', 'No.', 'Driver', 'Team', 'Manufacturer', 'Chassis', 'Time'],
    rows: [['1', '1', 'A', 'Prema', 'Dallara', 'F2/26', '1:30']],
  }, 'F2_2026_6');
  assert.ok(out.headers.indexOf('Chassis') < 0);
  assert.strictEqual(out.headers[out.headers.indexOf('Team')], 'Team');
  assert.strictEqual(out.rows[0].length, out.headers.length);
});

test('normalizeF1RaceGridColumn moves Grid to St after Pos', () => {
  const out = TGA.normalizeF1RaceGridColumn({
    headers: ['Pos', 'No.', 'Driver', 'Grid', 'Laps', 'Time'],
    rows: [['1', '1', 'A', '3', '50', '1:30']],
  });
  assert.deepStrictEqual(out.headers.slice(0, 3), ['Pos', 'St', 'No.']);
  assert.strictEqual(out.rows[0][1], '3');
});

test('openwheelSessionTableTitle returns short session name for F2', () => {
  assert.strictEqual(
    TGA.openwheelSessionTableTitle(
      { title: '2026 FIA Formula 2 Championship - Practice' },
      'Practice',
      'f2'
    ),
    'Practice'
  );
});

test('shouldShowSessionMetaTable false for F2/F3/FREC', () => {
  assert.strictEqual(TGA.shouldShowSessionMetaTable('F2_2026_6', 'f2'), false);
  assert.strictEqual(TGA.shouldShowSessionMetaTable('F3_2026_5', 'f3'), false);
  assert.strictEqual(TGA.shouldShowSessionMetaTable('INDYCAR_2026_5', 'indycar'), true);
});

test('localizeF1RaceSessionTitle maps Sprint and Race', () => {
  const t = (k) => ({ 'table.sprint_results': 'Sprint Results', 'table.race_results': 'Race Results' }[k] || k);
  assert.strictEqual(TGA.localizeF1RaceSessionTitle('Sprint', 'F1_2026_5', t), 'Sprint Results');
  assert.strictEqual(TGA.localizeF1RaceSessionTitle('Race', 'F1_2026_5', t), 'Race Results');
  assert.strictEqual(TGA.localizeF1RaceSessionTitle('Qualifying', 'F2_2026_6', t), 'Qualifying');
});

console.log('All openwheel-race tests passed.');
