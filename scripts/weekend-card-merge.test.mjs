#!/usr/bin/env node
/**
 * Unit tests for web/lib/weekend-card-merge.js (Last Results / Next Race weekend logic).
 */
import assert from 'assert';
import { createWeekendMergeApi } from './lib/load-event-card-date.mjs';

function test(name, fn) {
  fn();
  console.log('ok', name);
}

const TGA = createWeekendMergeApi();

function supercarsCard(id, name, start, end, winnerLabel) {
  return {
    event: {
      id,
      series_id: 'SUPERCARS',
      circuit_name: 'Townsville Street Circuit',
      location: 'Townsville',
      name,
    },
    rangeStart: start,
    rangeEnd: end,
    dateStr: end,
    winners: winnerLabel ? [{ label: winnerLabel, car: '1', name: 'Winner' }] : [],
  };
}

test('mergeLastResultsWeekendCards merges Townsville triple-header', () => {
  const cards = [
    supercarsCard('SUPERCARS_2026_20', 'Townsville Race 1', '2026-07-10', '2026-07-10', 'Race 1'),
    supercarsCard('SUPERCARS_2026_21', 'Townsville Race 2', '2026-07-11', '2026-07-11', 'Race 2'),
    supercarsCard('SUPERCARS_2026_22', 'Townsville Race 3', '2026-07-12', '2026-07-12', 'Race 3'),
  ];
  const out = TGA.mergeLastResultsWeekendCards(cards, 'SUPERCARS');
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].rangeStart, '2026-07-10');
  assert.strictEqual(out[0].rangeEnd, '2026-07-12');
  assert.strictEqual(out[0].winners.length, 3);
  assert.ok(!/Race\s*\d+$/i.test(out[0].event.name));
});

test('mergeLastResultsWeekendCards leaves non-Supercars cards untouched', () => {
  const cards = [
    {
      event: { series_id: 'INDYCAR', circuit_name: 'Long Beach', location: 'LB', name: 'Long Beach' },
      rangeStart: '2026-04-19',
      rangeEnd: '2026-04-19',
    },
    supercarsCard('SUPERCARS_2026_5', 'Tasmania Race 14', '2026-05-23', '2026-05-23'),
  ];
  const out = TGA.mergeLastResultsWeekendCards(cards, 'SUPERCARS');
  assert.strictEqual(out.length, 2);
});

test('mergeLastResultsWeekendCards does not merge different venues', () => {
  const cards = [
    supercarsCard('SUPERCARS_2026_1', 'Sydney Race 1', '2026-02-28', '2026-02-28'),
    {
      event: {
        series_id: 'SUPERCARS',
        circuit_name: 'Albert Park',
        location: 'Melbourne',
        name: 'Melbourne Race 1',
      },
      rangeStart: '2026-03-06',
      rangeEnd: '2026-03-06',
    },
  ];
  const out = TGA.mergeLastResultsWeekendCards(cards, 'SUPERCARS');
  assert.strictEqual(out.length, 2);
});

test('mergeNextRaceWeekendEntries merges consecutive Supercars days', () => {
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
  const out = TGA.collapseNextRaceWeekends(entries, ['SUPERCARS']);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].event.start_date, '2026-03-06');
  assert.strictEqual(out[0].event.end_date, '2026-03-07');
});

test('collapseLastResultsByEventId collapses F2 sprint+feature to one row', () => {
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
  const out = TGA.collapseLastResultsByEventId(items, ['F2']);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].event.start_date, '2026-07-04');
  assert.strictEqual(out[0].event.end_date, '2026-07-05');
  assert.ok(!/\(Sprint\)/i.test(out[0].event.name));
});

console.log('All weekend-card-merge tests passed.');
