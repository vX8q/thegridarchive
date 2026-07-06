#!/usr/bin/env node
/**
 * Unit tests for event card date logic (expanded F2 row, ELMS single day, F1 sprint, 24h).
 */
import assert from 'assert';
import { createEventCardDateApi, createWeekendMergeApi } from './lib/load-event-card-date.mjs';

function test(name, fn) {
  try {
    fn();
    console.log('ok', name);
  } catch (err) {
    console.error('FAIL', name);
    throw err;
  }
}

const TGA = createEventCardDateApi();
const merge = createWeekendMergeApi();

test('F2 weekend shows date range from schedule span', () => {
  const e = {
    id: 'F2_2026_7',
    series_id: 'F2',
    name: 'Silverstone',
    start_date: '2026-07-04',
    end_date: '2026-07-05',
  };
  const range = TGA.getEventRaceDateRangeIso(e);
  assert.strictEqual(range.start, '2026-07-04');
  assert.strictEqual(range.end, '2026-07-05');
});

test('F2 expanded schedule row shows single session day only', () => {
  const e = {
    id: 'F2_2026_7',
    series_id: 'F2',
    name: 'Silverstone (Sprint)',
    start_date: '2026-07-04',
    end_date: '2026-07-04',
    _scheduleSessionKind: 'sprint',
    _scheduleSessionLabel: 'Sprint',
  };
  const range = TGA.getEventRaceDateRangeIso(e);
  assert.strictEqual(range.start, '2026-07-04');
  assert.strictEqual(range.end, '2026-07-04');
});

test('ELMS multi-day schedule shows race day only on cards', () => {
  const e = {
    id: 'ELMS_2026_3',
    series_id: 'ELMS',
    name: '4 Hours of Imola',
    start_date: '2026-07-03',
    end_date: '2026-07-05',
    time_msk: '15:00',
  };
  assert.strictEqual(TGA.enduranceWeekendRaceDayOnly(e), true);
  const range = TGA.getEventRaceDateRangeIso(e);
  assert.strictEqual(range.start, '2026-07-05');
  assert.strictEqual(range.end, '2026-07-05');
});

test('24h race is not race-day-only endurance', () => {
  const e = {
    id: 'WEC_2026_4',
    series_id: 'WEC',
    name: '24 Hours of Le Mans',
    start_date: '2026-06-13',
    end_date: '2026-06-14',
  };
  assert.strictEqual(TGA.enduranceWeekendRaceDayOnly(e), false);
});

test('F1 sprint weekend resolves two-day range from static schedule', () => {
  const e = {
    id: 'F1_2026_9',
    series_id: 'F1',
    name: 'British Grand Prix',
    start_date: '2026-07-04',
    end_date: '2026-07-05',
  };
  assert.strictEqual(TGA.isF1SprintWeekendEvent(e), true);
  const range = TGA.getEventRaceDateRangeIso(e);
  assert.strictEqual(range.start, '2026-07-04');
  assert.strictEqual(range.end, '2026-07-05');
});

test('Supercars next-race entries merge into one weekend card', () => {
  const entries = [
    {
      event: {
        id: 'SUPERCARS_2026_4',
        series_id: 'SUPERCARS',
        circuit_name: 'Albert Park',
        location: 'Melbourne',
        name: 'Melbourne SuperSprint Race 1',
        start_date: '2026-03-06',
        end_date: '2026-03-06',
      },
      date: new Date('2026-03-06T12:00:00'),
      endTs: 1,
    },
    {
      event: {
        id: 'SUPERCARS_2026_5',
        series_id: 'SUPERCARS',
        circuit_name: 'Albert Park',
        location: 'Melbourne',
        name: 'Melbourne SuperSprint Race 2',
        start_date: '2026-03-07',
        end_date: '2026-03-07',
      },
      date: new Date('2026-03-07T12:00:00'),
      endTs: 2,
    },
  ];
  const out = merge.collapseNextRaceWeekends(entries, ['SUPERCARS']);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].event.start_date, '2026-03-06');
  assert.strictEqual(out[0].event.end_date, '2026-03-07');
  assert.ok(!/Race\s*\d+$/i.test(out[0].event.name));
});

test('SERIES_CARD_DATE_RULES documents F2 and Supercars', () => {
  assert.strictEqual(TGA.getSeriesCardDateRule('F2').card, 'weekend_range');
  assert.strictEqual(TGA.getSeriesCardDateRule('SUPERCARS').card, 'weekend_merge');
});

test('F2 Last Results rows collapse by event.id to weekend span', () => {
  const items = [
    {
      event: { id: 'F2_2026_7', series_id: 'F2', name: 'Silverstone (Sprint)', start_date: '2026-07-04', end_date: '2026-07-04' },
      dateStr: '2026-07-04',
    },
    {
      event: { id: 'F2_2026_7', series_id: 'F2', name: 'Silverstone (Feature)', start_date: '2026-07-05', end_date: '2026-07-05' },
      dateStr: '2026-07-05',
    },
  ];
  const out = merge.collapseLastResultsByEventId(items, ['F2']);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].event.start_date, '2026-07-04');
  assert.strictEqual(out[0].event.end_date, '2026-07-05');
  assert.ok(!/\(Sprint\)/i.test(out[0].event.name));
});

console.log('All event-card-date tests passed.');
