#!/usr/bin/env node
import assert from 'assert';
import { createLastResultsDatesApi } from './lib/load-last-results-dates.mjs';

function test(name, fn) {
  try {
    fn();
    console.log('ok', name);
  } catch (err) {
    console.error('FAIL', name);
    throw err;
  }
}

const TGA = createLastResultsDatesApi();

test('F2 Last Results card shows weekend date range', () => {
  const card = {
    event: {
      id: 'F2_2026_7',
      series_id: 'F2',
      name: 'Silverstone',
      start_date: '2026-07-04',
      end_date: '2026-07-05',
    },
    rangeStart: '2026-07-04',
    rangeEnd: '2026-07-05',
  };
  const display = TGA.formatLastResultsCardDate(card);
  assert.ok(display.indexOf('2026-07-04') >= 0);
  assert.ok(display.indexOf('2026-07-05') >= 0);
});

test('eventLastRaceDateIso uses weekend end for F2', () => {
  const ev = {
    id: 'F2_2026_7',
    series_id: 'F2',
    start_date: '2026-07-04',
    end_date: '2026-07-05',
  };
  assert.strictEqual(TGA.eventLastRaceDateIso(ev), '2026-07-05');
});

test('cardLastRaceDateIso from rangeEnd on card', () => {
  const card = {
    event: { id: 'INDYCAR_2026_5', series_id: 'INDYCAR', start_date: '2026-06-07', end_date: '2026-06-07' },
    rangeStart: '2026-06-07',
    rangeEnd: '2026-06-07',
  };
  assert.strictEqual(TGA.cardLastRaceDateIso(card), '2026-06-07');
});

console.log('All last-results-dates tests passed.');
