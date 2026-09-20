#!/usr/bin/env node
import assert from 'assert';
import {
  P1_GAP,
  forEachP1GapCell,
  isLeaderPlaceholder,
  isP1Pos,
} from './lib/p1-gap.mjs';

function test(name, fn) {
  fn();
  console.log('ok', name);
}

test('P1 pos accepts 1 and 1.', () => {
  assert.strictEqual(isP1Pos('1'), true);
  assert.strictEqual(isP1Pos('1.'), true);
  assert.strictEqual(isP1Pos(' 1 '), true);
  assert.strictEqual(isP1Pos('2'), false);
  assert.strictEqual(isP1Pos('DNF'), false);
  assert.strictEqual(isP1Pos('10'), false);
});

test('hyphen empty and protocol zeros are placeholders', () => {
  assert.strictEqual(isLeaderPlaceholder('-'), true);
  assert.strictEqual(isLeaderPlaceholder(''), true);
  assert.strictEqual(isLeaderPlaceholder('--.----'), true);
  assert.strictEqual(isLeaderPlaceholder('0.0000'), true);
  assert.strictEqual(isLeaderPlaceholder(P1_GAP), false);
  assert.strictEqual(isLeaderPlaceholder('+0.932'), false);
  assert.strictEqual(isLeaderPlaceholder('3.787'), false);
  assert.strictEqual(isLeaderPlaceholder('1 LAP'), false);
});

test('rewrites only P1 Gap/Int in nested sessions', () => {
  const event = {
    tables: {
      qualifying: {
        sessions: [
          {
            headers: ['Pos', 'Driver', 'Gap', 'Int'],
            rows: [
              ['1', 'A', '-', '-'],
              ['2', 'B', '0.015', '0.015'],
            ],
          },
        ],
      },
      race: {
        headers: ['Pos', 'Gap', 'Laps'],
        rows: [['1', '--.----', '52']],
      },
    },
  };
  let n = 0;
  forEachP1GapCell(event, (value, set) => {
    if (!isLeaderPlaceholder(value)) return;
    set(P1_GAP);
    n++;
  });
  assert.strictEqual(n, 3);
  assert.strictEqual(event.tables.qualifying.sessions[0].rows[0][2], P1_GAP);
  assert.strictEqual(event.tables.qualifying.sessions[0].rows[0][3], P1_GAP);
  assert.strictEqual(event.tables.qualifying.sessions[0].rows[1][2], '0.015');
  assert.strictEqual(event.tables.race.rows[0][1], P1_GAP);
});

test('leaves Diff and DNF rows alone', () => {
  const event = {
    tables: {
      practice: {
        headers: ['Rank', 'Diff', 'Gap'],
        rows: [['1', '--.----', '--.----']],
      },
      race: {
        headers: ['Pos', 'Gap', 'Int'],
        rows: [['DNF', 'DNF', '-']],
      },
    },
  };
  const seen = [];
  forEachP1GapCell(event, (value) => {
    seen.push(value);
  });
  assert.deepStrictEqual(seen, ['--.----']);
});

console.log('All p1-gap tests passed.');
