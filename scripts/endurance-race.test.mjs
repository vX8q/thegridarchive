#!/usr/bin/env node
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadEnduranceApi() {
  const window = { TGA: {}, console };
  const src = fs.readFileSync(path.join(root, 'web', 'lib', 'endurance-race.js'), 'utf8');
  vm.runInNewContext(src, { window, console });
  return window.TGA;
}

function test(name, fn) {
  fn();
  console.log('ok', name);
}

const TGA = loadEnduranceApi();

test('splitTeamCarDropSponsor splits TEAM/CAR/SPONSOR column', () => {
  const out = TGA.splitTeamCarDropSponsor({
    headers: ['Pos', 'Team/Car/Sponsor', 'Time'],
    rows: [['1', 'Wayne Taylor Racing / 10 / Konica', '1:30.0']],
  });
  assert.deepStrictEqual(out.headers, ['Pos', 'TEAM', 'CAR', 'Time']);
  assert.deepStrictEqual(out.rows[0], ['1', 'Wayne Taylor Racing', '10', '1:30.0']);
});

test('normalizeImsaQualTable adds POINTS for class position', () => {
  const out = TGA.normalizeImsaQualTable({
    headers: ['Pos', 'CLASS POS', 'CLASS'],
    rows: [['1', '1', 'GTP']],
  }, 'IMSA_2026_6', []);
  const ptsIdx = out.headers.indexOf('POINTS');
  assert.ok(ptsIdx >= 0);
  assert.strictEqual(out.rows[0][ptsIdx], '35');
});

test('transformImsaRaceTable renames CAR NO and fills POINTS', () => {
  const out = TGA.transformImsaRaceTable(
    ['Pos', 'CAR NO', 'CLASS POS', 'TEAM/Car/Sponsor'],
    [['1', '10', '1', 'WTR / 10 / Acme']],
    [['3', '10']]
  );
  assert.ok(out.headers.indexOf('#') >= 0);
  assert.ok(out.headers.indexOf('POINTS') >= 0);
  const ptsIdx = out.headers.indexOf('POINTS');
  assert.strictEqual(out.rows[0][ptsIdx], '350');
  const stIdx = out.headers.indexOf('ST POS');
  if (stIdx >= 0) assert.strictEqual(out.rows[0][stIdx], '3');
});

test('gtwceEndTimedSessionTableData drops Laps for GTWCE_END', () => {
  const out = TGA.gtwceEndTimedSessionTableData({
    headers: ['Pos', 'Team/Car/Sponsor', 'Laps'],
    rows: [['1', 'Team / 7 / Sponsor', '120']],
  }, 'GTWCE_END_2026_3');
  assert.ok(out.headers.indexOf('Laps') < 0);
  assert.ok(out.headers.indexOf('TEAM') >= 0);
});

console.log('All endurance-race tests passed.');
