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

test('FREC Imola Last Results shows race days Sep 5–6, not Fri–Sun practice weekend', () => {
  const imola = loadScheduleEntry('frec.json', 'FREC_2026_7');
  assert.ok(imola);
  assert.strictEqual(imola.start_date, '2026-09-04');
  assert.strictEqual(imola.end_date, '2026-09-06');
  const range = TGA.getEventRaceDateRangeIso(imola);
  assert.strictEqual(range.start, '2026-09-05');
  assert.strictEqual(range.end, '2026-09-06');

  const pending = {
    event: imola,
    rangeStart: imola.start_date,
    rangeEnd: imola.end_date,
    winners: [],
  };
  assert.strictEqual(TGA.lastResultsCardHasMultipleRaces(pending), true);
  const cardRange = TGA.lastResultsCardRaceDateRange(pending);
  assert.strictEqual(cardRange.start, '2026-09-05');
  assert.strictEqual(cardRange.end, '2026-09-06');
  const display = TGA.formatLastResultsCardDate(pending);
  assert.ok(display.indexOf('2026-09-05') >= 0);
  assert.ok(display.indexOf('2026-09-06') >= 0);
  assert.ok(display.indexOf('2026-09-04') < 0);
});

test('F4 Italy Imola Last Results shows race days Sep 5–6, not Fri–Sun practice weekend', () => {
  const imola = loadScheduleEntry('f4_it.json', 'F4_IT_2026_5');
  assert.ok(imola);
  assert.strictEqual(imola.start_date, '2026-09-04');
  assert.strictEqual(imola.end_date, '2026-09-06');
  const range = TGA.getEventRaceDateRangeIso(imola);
  assert.strictEqual(range.start, '2026-09-05');
  assert.strictEqual(range.end, '2026-09-06');

  const pending = {
    event: imola,
    rangeStart: imola.start_date,
    rangeEnd: imola.end_date,
    winners: [],
  };
  assert.strictEqual(TGA.lastResultsCardHasMultipleRaces(pending), true);
  const cardRange = TGA.lastResultsCardRaceDateRange(pending);
  assert.strictEqual(cardRange.start, '2026-09-05');
  assert.strictEqual(cardRange.end, '2026-09-06');
  const display = TGA.formatLastResultsCardDate(pending);
  assert.ok(display.indexOf('2026-09-05') >= 0);
  assert.ok(display.indexOf('2026-09-06') >= 0);
  assert.ok(display.indexOf('2026-09-04') < 0);
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
      name: 'Snap-on IndyCar Weekend',
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

test('IndyCar Milwaukee pending merge shows date range without winners', () => {
  const card = {
    event: {
      id: 'INDYCAR_2026_16',
      series_id: 'INDYCAR',
      name: 'Snap-on IndyCar Weekend',
      start_date: '2026-08-29',
      end_date: '2026-08-30',
      _weekendEventIds: ['INDYCAR_2026_16', 'INDYCAR_2026_17'],
    },
    rangeStart: '2026-08-29',
    rangeEnd: '2026-08-30',
    winners: [],
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

test('buildGroupedWeekendLastRaceByEventId maps IndyCar Saturday to Sunday race day', () => {
  const items = [
    {
      event: {
        id: 'INDYCAR_2026_16',
        series_id: 'INDYCAR',
        circuit_name: 'Milwaukee Mile',
        location: 'West Allis, Wisconsin, USA',
        start_date: '2026-08-29',
        end_date: '2026-08-29',
      },
    },
    {
      event: {
        id: 'INDYCAR_2026_17',
        series_id: 'INDYCAR',
        circuit_name: 'Milwaukee Mile',
        location: 'West Allis, Wisconsin, USA',
        start_date: '2026-08-30',
        end_date: '2026-08-30',
      },
    },
  ];
  const map = TGA.buildGroupedWeekendLastRaceByEventId(items);
  assert.strictEqual(map.INDYCAR_2026_16, '2026-08-30');
  assert.strictEqual(map.INDYCAR_2026_17, '2026-08-30');
});

test('Supercars single-race enduro card is race day, not practice weekend span', () => {
  const card = {
    event: {
      id: 'SUPERCARS_2026_29',
      series_id: 'SUPERCARS',
      name: 'The Bend 500',
      start_date: '2026-09-11',
      end_date: '2026-09-13',
    },
    rangeStart: '2026-09-11',
    rangeEnd: '2026-09-13',
    winners: [{ name: 'Chaz Mostert', car: '1', label: 'Race 29' }],
  };
  assert.strictEqual(TGA.lastResultsCardHasMultipleRaces(card), false);
});

console.log('All last-results-dates tests passed.');
