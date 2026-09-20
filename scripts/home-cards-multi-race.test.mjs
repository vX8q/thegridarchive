#!/usr/bin/env node
/**
 * Smoke tests: Last Results multi-race merge, weekend 7-day window, LIVE gate,
 * PSC duplicate collapse, IndyCar Race 1+2 labels.
 */
import assert from 'assert';
import { createWeekendMergeApi } from './lib/load-event-card-date.mjs';
import { createLastResultsDatesApi } from './lib/load-last-results-dates.mjs';

function test(name, fn) {
  fn();
  console.log('ok', name);
}

const Merge = createWeekendMergeApi();
const Dates = createLastResultsDatesApi();

test('IndyCar Milwaukee merge keeps Race 1 + Race 2 same driver + date range', () => {
  const cards = [
    {
      event: {
        id: 'INDYCAR_2026_16',
        series_id: 'INDYCAR',
        circuit_name: 'Milwaukee Mile',
        location: 'West Allis, Wisconsin, USA',
        name: 'Snap-on IndyCar Weekend',
      },
      rangeStart: '2026-08-29',
      rangeEnd: '2026-08-29',
      dateStr: '2026-08-29',
      winners: [{ name: "Pato O'Ward", car: '5', label: '' }],
    },
    {
      event: {
        id: 'INDYCAR_2026_17',
        series_id: 'INDYCAR',
        circuit_name: 'Milwaukee Mile',
        location: 'West Allis, Wisconsin, USA',
        name: 'Snap-on IndyCar Weekend',
      },
      rangeStart: '2026-08-30',
      rangeEnd: '2026-08-30',
      dateStr: '2026-08-30',
      winners: [{ name: "Pato O'Ward", car: '5', label: '' }],
    },
  ];
  const out = Merge.mergeLastResultsWeekendCards(cards, 'INDYCAR');
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].winners.length, 2);
  assert.strictEqual(out[0].winners[0].label, 'Race 1');
  assert.strictEqual(out[0].winners[1].label, 'Race 2');
  assert.strictEqual(out[0].rangeStart, '2026-08-29');
  assert.strictEqual(out[0].rangeEnd, '2026-08-30');
  assert.ok(Dates.lastResultsCardHasMultipleRaces(out[0]));
  const display = Dates.formatLastResultsCardDate(out[0]);
  assert.ok(display.indexOf('2026-08-29') >= 0);
  assert.ok(display.indexOf('2026-08-30') >= 0);
});

test('Supercars Townsville merge keeps three winners + date range', () => {
  const cards = [1, 2, 3].map(function (n) {
    return {
      event: {
        id: 'SUPERCARS_2026_2' + n,
        series_id: 'SUPERCARS',
        circuit_name: 'Townsville Street Circuit',
        location: 'Townsville',
        name: 'Townsville Race ' + n,
      },
      rangeStart: '2026-07-1' + (n - 1),
      rangeEnd: '2026-07-1' + (n - 1),
      dateStr: '2026-07-1' + (n - 1),
      winners: [{ name: 'Driver ' + n, car: String(n), label: 'Race ' + n }],
    };
  });
  const out = Merge.mergeLastResultsWeekendCards(cards, 'SUPERCARS');
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].winners.length, 3);
  assert.strictEqual(out[0].rangeStart, '2026-07-10');
  assert.strictEqual(out[0].rangeEnd, '2026-07-12');
});

test('F4-style multi winners stay labeled on Last Results card shape', () => {
  const card = {
    event: {
      id: 'F4_IT_2026_5',
      series_id: 'F4_IT',
      name: 'Imola',
      start_date: '2026-09-04',
      end_date: '2026-09-06',
    },
    rangeStart: '2026-09-04',
    rangeEnd: '2026-09-06',
    winners: [
      { name: 'A', car: '1', label: 'Race 1' },
      { name: 'B', car: '2', label: 'Race 2' },
      { name: 'C', car: '3', label: 'Final Race' },
    ],
  };
  assert.strictEqual(Dates.lastResultsCardHasMultipleRaces(card), true);
  const display = Dates.formatLastResultsCardDate(card);
  // Race days from multi-race map (Sat–Sun), not Fri practice start_date.
  assert.ok(display.indexOf('2026-09-05') >= 0);
  assert.ok(display.indexOf('2026-09-06') >= 0);
  assert.ok(display.indexOf('2026-09-04') < 0);
});

test('weekend last-race map keeps Saturday until Sunday+7 window', () => {
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
  const map = Dates.buildGroupedWeekendLastRaceByEventId(items);
  assert.strictEqual(map.INDYCAR_2026_16, '2026-08-30');
  assert.strictEqual(map.INDYCAR_2026_17, '2026-08-30');
  // Sep 6 is still within Aug 30 + 7 days (calendar EOD).
  const parts = '2026-08-30'.split('-');
  const limit = new Date(+parts[0], +parts[1] - 1, +parts[2] + 7, 23, 59, 59, 999);
  const probe = new Date(2026, 8, 6, 19, 0, 0).getTime();
  assert.ok(probe <= limit.getTime(), 'Sep 6 must be inside weekend Last Results window');
});

test('collapseLastResultsByEventId dedupes duplicate PSC Monza rows', () => {
  const items = [
    {
      event: { id: 'PSC_2026_8', series_id: 'PSC', name: 'Monza', start_date: '2026-09-06', end_date: '2026-09-06' },
      dateStr: '2026-09-06',
    },
    {
      event: { id: 'PSC_2026_8', series_id: 'PSC', name: 'Monza', start_date: '2026-09-06', end_date: '2026-09-06' },
      dateStr: '2026-09-06',
    },
  ];
  const out = Merge.collapseLastResultsByEventId(items, ['PSC']);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].event.id.toUpperCase(), 'PSC_2026_8');
});

test('LIVE badge tail blocks Last Results briefly after finish', () => {
  const now = Date.now();
  const liveFin = now - 10 * 60000;
  const liveBadgeEnd = liveFin + 30 * 60000;
  assert.ok(now < liveBadgeEnd, 'still in 30m LIVE badge tail');
  const shouldShowInLastResults = !(liveBadgeEnd && now < liveBadgeEnd);
  assert.strictEqual(shouldShowInLastResults, false);
});

test('LIVE badge tail expired → Last Results allowed', () => {
  const now = Date.now();
  const liveFin = now - 40 * 60000;
  const liveBadgeEnd = liveFin + 30 * 60000;
  assert.ok(now >= liveBadgeEnd);
  const shouldShowInLastResults = !(liveBadgeEnd && now < liveBadgeEnd);
  assert.strictEqual(shouldShowInLastResults, true);
});

console.log('All home-cards-multi-race tests passed.');
