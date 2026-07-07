#!/usr/bin/env node
/**
 * Gate tests for tga-dates-*.js (blocks Phase 3.0 merge).
 */
import assert from 'assert';
import { createTgaDatesApi } from './lib/load-tga-dates.mjs';

function test(name, fn) {
  try {
    fn();
    console.log('ok', name);
  } catch (err) {
    console.error('FAIL', name);
    throw err;
  }
}

const TGA = createTgaDatesApi({ lang: 'en' });

test('parseIsoDatePrefix accepts ISO prefix', () => {
  assert.strictEqual(TGA.parseIsoDatePrefix('2026-06-05'), '2026-06-05');
  assert.strictEqual(TGA.parseIsoDatePrefix('2026-06-05T00:00:00'), '2026-06-05');
});

test('parseIsoDatePrefix parses prose date', () => {
  assert.strictEqual(TGA.parseIsoDatePrefix('Friday, May 22, 2026'), '2026-05-22');
});

test('parseIsoDatePrefix empty input', () => {
  assert.strictEqual(TGA.parseIsoDatePrefix(''), '');
  assert.strictEqual(TGA.parseIsoDatePrefix(null), '');
});

test('parseMetaDateToISO', () => {
  assert.strictEqual(TGA.parseMetaDateToISO('Thu 05 Mar 2026'), '2026-03-05');
  assert.strictEqual(TGA.parseMetaDateToISO('bad'), null);
});

test('parseNamedRaceDurationHours', () => {
  assert.strictEqual(TGA.parseNamedRaceDurationHours('24 Hours of Le Mans'), 24);
  assert.strictEqual(TGA.parseNamedRaceDurationHours('Mobil 1 Twelve Hours of Sebring'), 12);
  assert.strictEqual(TGA.parseNamedRaceDurationHours('Rolex 24 at Daytona'), 24);
  assert.strictEqual(TGA.parseNamedRaceDurationHours('6 Hours of Spa'), 6);
  assert.strictEqual(TGA.parseNamedRaceDurationHours('Canadian Grand Prix'), null);
});

test('isoAddDays crosses month boundary', () => {
  assert.strictEqual(TGA.isoAddDays('2026-01-31', 1), '2026-02-01');
});

test('formatDateRange same month EN', () => {
  assert.strictEqual(TGA.formatDateRange('2026-06-05', '2026-06-07'), 'Jun\u00a05\u20137');
});

test('formatDateRange cross month EN', () => {
  var s = TGA.formatDateRange('2026-06-28', '2026-07-02');
  assert.ok(s.indexOf('Jun') >= 0);
  assert.ok(s.indexOf('Jul') >= 0);
});

test('formatDateRangeLong single day', () => {
  assert.strictEqual(TGA.formatDateRangeLong('2026-06-07', ''), 'June 7, 2026');
});

test('formatDateRangeLong span same month', () => {
  assert.strictEqual(TGA.formatDateRangeLong('2026-06-05', '2026-06-07'), 'June 5–7, 2026');
});

test('buildEventMetaDate ISO span', () => {
  var s = TGA.buildEventMetaDate({
    start_date: '2026-06-05',
    end_date: '2026-06-07',
  });
  assert.strictEqual(s, 'Jun\u00a05\u20137');
});

test('buildEventMetaDate prose date field', () => {
  assert.strictEqual(TGA.buildEventMetaDate({ date: '7 June 2026' }), '7 June 2026');
});

test('getEventSessionDateRange prefers weekend bounds over session meta', () => {
  var r = TGA.getEventSessionDateRange({
    start_date: '2026-06-05',
    end_date: '2026-06-07',
    tables: {
      practice: {
        sessions: [{
          meta: { Date: 'Thu 04 Jun 2026' },
        }],
      },
    },
  });
  assert.strictEqual(r.minIso, '2026-06-05');
  assert.strictEqual(r.maxIso, '2026-06-07');
});

test('getEventSessionDateRange from session meta when no weekend span', () => {
  var r = TGA.getEventSessionDateRange({
    start_date: '2026-06-05',
    tables: {
      race: {
        sessions: [
          { meta: { Date: 'Fri 05 Jun 2026' } },
          { meta: { Date: 'Sat 06 Jun 2026' } },
        ],
      },
    },
  });
  assert.strictEqual(r.minIso, '2026-06-05');
  assert.strictEqual(r.maxIso, '2026-06-06');
});

console.log('All tga-dates tests passed.');
