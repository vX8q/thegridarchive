#!/usr/bin/env node
import assert from 'assert';
import { createLastResultsDatesApi } from './lib/load-last-results-dates.mjs';
import { loadScheduleEntry } from './lib/load-event-card-date.mjs';

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

test('WEC Last Results race day iso uses race-day-only card rule', () => {
  const wec = loadScheduleEntry('wec.json', 'WEC_2026_4');
  assert.ok(wec);
  const range = TGA.getEventRaceDateRangeIso(wec);
  assert.strictEqual(range.start, '2026-07-12');
  assert.strictEqual(range.end, '2026-07-12');
  assert.strictEqual(TGA.eventLastRaceDateIso(wec), '2026-07-12');
});

test('PSC Hungaroring Last Results shows race day, not weekend span', () => {
  const card = {
    event: {
      id: 'PSC_2026_5',
      series_id: 'PSC',
      name: 'Hungaroring',
      start_date: '2026-07-24',
      end_date: '2026-07-26',
    },
    rangeStart: '2026-07-24',
    rangeEnd: '2026-07-26',
    winners: [{ name: 'Driver A', car: '1', label: '' }],
  };
  assert.strictEqual(TGA.lastResultsCardHasMultipleRaces(card), false);
  const range = TGA.lastResultsCardRaceDateRange(card);
  assert.strictEqual(range.start, '2026-07-26');
  assert.strictEqual(range.end, '2026-07-26');
  assert.strictEqual(TGA.formatLastResultsCardDate(card), '2026-07-26');

  const pending = Object.assign({}, card, { winners: [] });
  assert.strictEqual(TGA.lastResultsCardHasMultipleRaces(pending), false);
  assert.strictEqual(TGA.formatLastResultsCardDate(pending), '2026-07-26');
});

test('IndyCar Portland pending card shows race day, not practice weekend', () => {
  const portland = loadScheduleEntry('indycar.json', 'INDYCAR_2026_13');
  assert.ok(portland);
  assert.strictEqual(portland.start_date, '2026-08-07');
  assert.strictEqual(portland.end_date, '2026-08-09');
  const range = TGA.getEventRaceDateRangeIso(portland);
  assert.strictEqual(range.start, '2026-08-09');
  assert.strictEqual(range.end, '2026-08-09');

  const pending = {
    event: portland,
    rangeStart: portland.start_date,
    rangeEnd: portland.end_date,
    winners: [],
  };
  assert.strictEqual(TGA.lastResultsCardHasMultipleRaces(pending), false);
  const cardRange = TGA.lastResultsCardRaceDateRange(pending);
  assert.strictEqual(cardRange.start, '2026-08-09');
  assert.strictEqual(cardRange.end, '2026-08-09');
  assert.strictEqual(TGA.formatLastResultsCardDate(pending), '2026-08-09');
});

test('Super Formula SUGO pending card shows race day, not Aug 8–9 practice weekend', () => {
  const sugo = loadScheduleEntry('super_formula.json', 'SUPER_FORMULA_2026_8');
  assert.ok(sugo);
  assert.strictEqual(sugo.start_date, '2026-08-08');
  assert.strictEqual(sugo.end_date, '2026-08-09');
  const range = TGA.getEventRaceDateRangeIso(sugo);
  assert.strictEqual(range.start, '2026-08-09');
  assert.strictEqual(range.end, '2026-08-09');

  const pending = {
    event: sugo,
    rangeStart: sugo.start_date,
    rangeEnd: sugo.end_date,
    winners: [],
  };
  assert.strictEqual(TGA.lastResultsCardHasMultipleRaces(pending), false);
  const cardRange = TGA.lastResultsCardRaceDateRange(pending);
  assert.strictEqual(cardRange.start, '2026-08-09');
  assert.strictEqual(cardRange.end, '2026-08-09');
  assert.strictEqual(TGA.formatLastResultsCardDate(pending), '2026-08-09');
});

test('Super Formula Motegi multi-session weekend still shows date range', () => {
  const motegi = loadScheduleEntry('super_formula.json', 'SUPER_FORMULA_2026_1');
  assert.ok(motegi);
  const range = TGA.getEventRaceDateRangeIso(motegi);
  assert.strictEqual(range.start, '2026-04-04');
  assert.strictEqual(range.end, '2026-04-05');
  const pending = {
    event: motegi,
    rangeStart: motegi.start_date,
    rangeEnd: motegi.end_date,
    winners: [],
  };
  assert.strictEqual(TGA.lastResultsCardHasMultipleRaces(pending), true);
  const display = TGA.formatLastResultsCardDate(pending);
  assert.ok(display.indexOf('2026-04-04') >= 0);
  assert.ok(display.indexOf('2026-04-05') >= 0);
});

test('IndyCar merged double-header Last Results still shows date range', () => {
  const card = {
    event: {
      id: 'INDYCAR_2026_16',
      series_id: 'INDYCAR',
      name: 'Milwaukee',
      start_date: '2026-08-29',
      end_date: '2026-08-30',
    },
    rangeStart: '2026-08-29',
    rangeEnd: '2026-08-30',
    winners: [
      { name: 'Driver A', car: '1', label: 'Race 1' },
      { name: 'Driver B', car: '2', label: 'Race 2' },
    ],
  };
  assert.strictEqual(TGA.lastResultsCardHasMultipleRaces(card), true);
  const display = TGA.formatLastResultsCardDate(card);
  assert.ok(display.indexOf('2026-08-29') >= 0);
  assert.ok(display.indexOf('2026-08-30') >= 0);
});

test('PSC merged double-header Last Results still shows date range', () => {
  const card = {
    event: {
      id: 'PSC_2026_6',
      series_id: 'PSC',
      name: 'Circuit Zandvoort',
      start_date: '2026-08-22',
      end_date: '2026-08-23',
    },
    rangeStart: '2026-08-22',
    rangeEnd: '2026-08-23',
    winners: [
      { name: 'Driver A', car: '1', label: 'Race 1' },
      { name: 'Driver B', car: '2', label: 'Race 2' },
    ],
  };
  assert.strictEqual(TGA.lastResultsCardHasMultipleRaces(card), true);
  const display = TGA.formatLastResultsCardDate(card);
  assert.ok(display.indexOf('2026-08-22') >= 0);
  assert.ok(display.indexOf('2026-08-23') >= 0);
});

console.log('All last-results-dates tests passed.');
