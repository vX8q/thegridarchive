#!/usr/bin/env node
/**
 * Unit tests for web/components/series-schedule-expand.js
 */
import assert from 'assert';
import { createSeriesScheduleExpandApi, loadScheduleEntry } from './lib/load-event-card-date.mjs';

function test(name, fn) {
  fn();
  console.log('ok', name);
}

const TGA = createSeriesScheduleExpandApi();

test('normalizeSeriesScheduleBaseName strips session suffixes', () => {
  assert.strictEqual(TGA.normalizeSeriesScheduleBaseName('Norisring (Race 2)'), 'Norisring');
  assert.strictEqual(TGA.normalizeSeriesScheduleBaseName('Silverstone (Sprint)'), 'Silverstone');
  assert.strictEqual(TGA.normalizeSeriesScheduleBaseName('Townsville Race 3'), 'Townsville');
});

test('expandSeriesScheduleEvents splits DTM weekend into two rows', () => {
  const e = loadScheduleEntry('dtm.json', 'DTM_2026_4');
  const out = TGA.expandSeriesScheduleEvents('DTM', [e]);
  assert.strictEqual(out.length, 2);
  assert.strictEqual(out[0].start_date, '2026-07-04');
  assert.strictEqual(out[1].start_date, '2026-07-05');
  assert.strictEqual(out[0]._scheduleGroupId, 'DTM_2026_4');
  assert.strictEqual(out[0]._scheduleSessionIndex, 1);
  assert.strictEqual(out[1]._scheduleSessionIndex, 2);
  assert.ok(out[0]._sessionLabel === 'Race 1' || out[0]._sessionLabel);
});

test('expandSeriesScheduleEvents splits FREC Monza into three rows', () => {
  const e = loadScheduleEntry('frec.json', 'FREC_2026_4');
  const out = TGA.expandSeriesScheduleEvents('FREC', [e]);
  assert.strictEqual(out.length, 3);
  assert.strictEqual(out[0].start_date, '2026-06-20');
  assert.strictEqual(out[2].start_date, '2026-06-21');
});

test('expandSeriesScheduleEvents leaves pre-season test as single row', () => {
  const e = {
    id: 'IMSA_2026_PRE_SEASON_TEST',
    series_id: 'IMSA',
    name: 'Pre-Season Test',
    start_date: '2026-01-10',
    end_date: '2026-01-10',
  };
  const out = TGA.expandSeriesScheduleEvents('IMSA', [e]);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].id, 'IMSA_2026_PRE_SEASON_TEST');
});

test('expandSeriesScheduleEvents does not expand single-race IndyCar', () => {
  const e = loadScheduleEntry('indycar.json', 'INDYCAR_2026_5');
  if (!e) return;
  const out = TGA.expandSeriesScheduleEvents('INDYCAR', [e]);
  assert.strictEqual(out.length, 1);
});

test('expandFullScheduleEvents appends session label to name', () => {
  const e = loadScheduleEntry('dtm.json', 'DTM_2026_4');
  const rows = TGA.expandFullScheduleEvents([e]);
  assert.strictEqual(rows.length, 2);
  assert.ok(/\(Race 1\)/.test(rows[0].name));
  assert.ok(/\(Race 2\)/.test(rows[1].name));
  assert.strictEqual(rows[0]._scheduleSessionLabel, 'Race 1');
});

test('expandFullScheduleEvents skips already-expanded F2 sprint row', () => {
  const e = {
    id: 'F2_2026_7',
    series_id: 'F2',
    name: 'Silverstone (Sprint)',
    start_date: '2026-07-04',
    end_date: '2026-07-04',
  };
  const rows = TGA.expandFullScheduleEvents([e]);
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].name, 'Silverstone (Sprint)');
});

test('resolveRaceSessionLabel uses sprint kind', () => {
  const label = TGA.resolveRaceSessionLabel({ _scheduleSessionKind: 'sprint' }, 'f2');
  assert.strictEqual(label, 'Sprint');
});

console.log('All series-schedule-expand tests passed.');
