#!/usr/bin/env node
/**
 * Unit tests for event card date logic (expanded F2 row, ELMS single day, F1 sprint, 24h).
 */
import assert from 'assert';
import { createEventCardDateApi, createWeekendMergeApi, loadScheduleEntry } from './lib/load-event-card-date.mjs';

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

test('F2 sprint row without metadata still treated as session row for display', () => {
  const e = {
    id: 'F2_2026_8',
    series_id: 'F2',
    name: 'Spa-Francorchamps (Sprint)',
    start_date: '2026-07-18',
    end_date: '2026-07-18',
  };
  assert.strictEqual(TGA.isExpandedScheduleSessionRow(e), true);
  const withMeta = Object.assign({}, e, {
    _scheduleSessionKind: 'sprint',
    _scheduleSessionLabel: 'Sprint',
  });
  const range = TGA.getEventRaceDateRangeIso(withMeta);
  assert.strictEqual(range.start, '2026-07-18');
  assert.strictEqual(range.end, '2026-07-18');
});

test('Next Race F2 sprint row shows single session day not weekend span', () => {
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
  const weekend = {
    id: 'F2_2026_7',
    series_id: 'F2',
    name: 'Silverstone',
    start_date: '2026-07-04',
    end_date: '2026-07-05',
  };
  const weekendRange = TGA.getEventRaceDateRangeIso(weekend);
  assert.ok(weekendRange.end > weekendRange.start);
  assert.strictEqual(TGA.nextRaceCardDateIso(e), '2026-07-04');
  const nextWeekend = TGA.nextRaceCardDateIso(weekend);
  assert.strictEqual(nextWeekend.length, 10);
  assert.notStrictEqual(nextWeekend, '');
  assert.strictEqual(TGA.formatNextRaceCardDate(e), 'Jul 4');
});

test('SERIES_CARD_DATE_RULES documents FREC and DTM', () => {
  assert.strictEqual(TGA.getSeriesCardDateRule('FREC').card, 'weekend_range');
  assert.strictEqual(TGA.getSeriesCardDateRule('FREC').sessions, 'sprint_feature');
  assert.strictEqual(TGA.getSeriesCardDateRule('DTM').card, 'weekend_range');
  assert.strictEqual(TGA.getSeriesCardDateRule('DTM').sessions, 'race_1_2');
});

test('FREC and DTM are multi-race schedule series', () => {
  assert.strictEqual(TGA.isMultiRaceSeriesSchedule('FREC'), true);
  assert.strictEqual(TGA.isMultiRaceSeriesSchedule('DTM'), true);
});

test('FREC_2026_4 weekend span from multi-race session map', () => {
  const e = loadScheduleEntry('frec.json', 'FREC_2026_4');
  assert.ok(e);
  const range = TGA.getEventRaceDateRangeIso(e);
  assert.strictEqual(range.start, '2026-06-20');
  assert.strictEqual(range.end, '2026-06-21');
  const sessions = TGA.getEventRaceSessions(e);
  assert.strictEqual(sessions.length, 3);
});

test('DTM_2026_4 weekend span and Race 1 / Race 2 sessions', () => {
  const e = loadScheduleEntry('dtm.json', 'DTM_2026_4');
  assert.ok(e);
  const range = TGA.getEventRaceDateRangeIso(e);
  assert.strictEqual(range.start, '2026-07-04');
  assert.strictEqual(range.end, '2026-07-05');
  const sessions = TGA.getEventRaceSessions(e);
  assert.strictEqual(sessions.length, 2);
  assert.strictEqual(sessions[0].label, 'Race 1');
  assert.strictEqual(sessions[0].start_date, '2026-07-04');
  assert.strictEqual(sessions[1].label, 'Race 2');
  assert.strictEqual(sessions[1].start_date, '2026-07-05');
});

test('FREC expanded schedule row shows single session day', () => {
  const e = {
    id: 'FREC_2026_4',
    series_id: 'FREC',
    name: 'FREC — Monza (Race 2)',
    start_date: '2026-06-20',
    end_date: '2026-06-20',
    _scheduleSessionKind: '',
    _scheduleSessionLabel: 'Race 2',
  };
  const range = TGA.getEventRaceDateRangeIso(e);
  assert.strictEqual(range.start, '2026-06-20');
  assert.strictEqual(range.end, '2026-06-20');
  assert.strictEqual(TGA.nextRaceCardDateIso(e), '2026-06-20');
});

test('DTM Next Race row uses session start date not weekend end', () => {
  const e = {
    id: 'DTM_2026_4',
    series_id: 'DTM',
    name: 'Norisring (Race 1)',
    start_date: '2026-07-04',
    end_date: '2026-07-04',
    _scheduleSessionLabel: 'Race 1',
  };
  assert.strictEqual(TGA.nextRaceCardDateIso(e), '2026-07-04');
  assert.strictEqual(TGA.formatNextRaceCardDate(e), 'Jul 4');
});

test('SERIES_CARD_DATE_RULES documents INDYCAR and WEC', () => {
  assert.strictEqual(TGA.getSeriesCardDateRule('INDYCAR').card, 'single_day');
  assert.strictEqual(TGA.getSeriesCardDateRule('WEC').card, 'race_day_only');
});

test('INDYCAR single-race weekend shows one calendar day on cards', () => {
  const e = loadScheduleEntry('indycar.json', 'INDYCAR_2026_5');
  assert.ok(e);
  assert.strictEqual(TGA.isMultiRaceSeriesSchedule('INDYCAR'), false);
  const range = TGA.getEventRaceDateRangeIso(e);
  assert.strictEqual(range.start, '2026-04-19');
  assert.strictEqual(range.end, '2026-04-19');
  assert.strictEqual(TGA.nextRaceCardDateIso(e), '2026-04-19');
  assert.strictEqual(TGA.formatNextRaceCardDate(e), 'Apr 19');
});

test('WEC multi-day São Paulo weekend shows race day only on cards', () => {
  const e = loadScheduleEntry('wec.json', 'WEC_2026_4');
  assert.ok(e);
  assert.strictEqual(TGA.enduranceWeekendRaceDayOnly(e), true);
  const range = TGA.getEventRaceDateRangeIso(e);
  assert.strictEqual(range.start, '2026-07-12');
  assert.strictEqual(range.end, '2026-07-12');
  assert.strictEqual(TGA.nextRaceCardDateIso(e), '2026-07-12');
});

test('WEC single-day Lone Star Le Mans stays one day', () => {
  const e = loadScheduleEntry('wec.json', 'WEC_2026_5');
  assert.ok(e);
  assert.strictEqual(TGA.enduranceWeekendRaceDayOnly(e), false);
  const range = TGA.getEventRaceDateRangeIso(e);
  assert.strictEqual(range.start, '2026-09-06');
  assert.strictEqual(range.end, '2026-09-06');
});

console.log('All event-card-date tests passed.');
