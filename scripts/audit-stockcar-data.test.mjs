#!/usr/bin/env node
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  buildTeamMap,
  lookupTeam,
  carsMissingFromEntryList,
  headerIndex,
  TEAM_HEADERS,
  CAR_HEADERS,
  maxQualifyingPos,
  isSeparatorRow,
} from './lib/stockcar-event-utils.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function load(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}

function dnqWouldFlag(tables) {
  const dnq = tables?.did_not_qualify;
  const qual = tables?.qualifying;
  if (!dnq?.rows?.length || !qual) return false;
  const posIdx = headerIndex(dnq.headers, ['pos', 'pos.']);
  if (posIdx < 0) return false;
  const maxQual = maxQualifyingPos(qual);
  if (maxQual < 1) return false;
  const dnqPos = dnq.rows
    .filter((r) => Array.isArray(r))
    .map((r) => parseInt(String(r[posIdx] ?? '').trim(), 10))
    .filter((n) => !Number.isNaN(n));
  return (
    dnqPos.length > 0 &&
    dnqPos[0] === 1 &&
    dnqPos.every((p, i) => p === i + 1) &&
    maxQual >= dnqPos.length
  );
}

function countTeamMismatches(data) {
  const teamMap = buildTeamMap(data.entry_list);
  let n = 0;
  const qual = data.tables?.qualifying;
  if (!qual?.headers || !qual.rows) return 0;
  const ci = headerIndex(qual.headers, CAR_HEADERS);
  const ti = headerIndex(qual.headers, TEAM_HEADERS);
  if (ci < 0 || ti < 0) return 0;
  for (const row of qual.rows) {
    if (!Array.isArray(row) || isSeparatorRow(row)) continue;
    const got = String(row[ti] ?? '').trim();
    const want = lookupTeam(teamMap, row[ci]);
    if (want && got && got !== want) n++;
  }
  return n;
}

function test(name, fn) {
  fn();
  console.log('ok', name);
}

test('Clash DNQ positions are overall field positions after fix', () => {
  const d = load('data/events/NASCAR Cup Series/2026/nascar_cup_2026_0.json');
  assert.equal(dnqWouldFlag(d.tables), false);
  const pos = d.tables.did_not_qualify.rows[0][0];
  assert.strictEqual(pos, '39');
});

test('Daytona qualifying has no team mismatches', () => {
  const d = load('data/events/NASCAR Cup Series/2026/nascar_cup_2026_1.json');
  assert.strictEqual(countTeamMismatches(d), 0);
  const duel2 = d.tables.duel2.rows.find((r) => String(r[2]) === '45');
  assert.strictEqual(duel2[4], '23XI Racing');
});

test('NOAPS Atlanta DNQ position 39', () => {
  const d = load('data/events/NOAPS/2026/noaps_2026_2.json');
  assert.strictEqual(d.tables.did_not_qualify.rows[0][0], '39');
});

test('#07 never resolves to the #7 entry', () => {
  const map = buildTeamMap([
    { number: '7', team: 'JR Motorsports' },
    { number: '07', team: 'SS-Green Light Racing' },
  ]);
  assert.strictEqual(lookupTeam(map, '07'), 'SS-Green Light Racing');
  assert.strictEqual(lookupTeam(map, '7'), 'JR Motorsports');

  const onlySeven = buildTeamMap([{ number: '7', team: 'JR Motorsports' }]);
  assert.strictEqual(lookupTeam(onlySeven, '07'), null);
  assert.deepStrictEqual(carsMissingFromEntryList(onlySeven, ['7', '07', '—']), ['07']);
});

console.log('All audit-stockcar-data tests passed.');
