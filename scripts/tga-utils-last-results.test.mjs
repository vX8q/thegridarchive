#!/usr/bin/env node
/**
 * isPastForLastResultsEvent — WEC 6h LIVE must not appear in Last Results until finish.
 */
import assert from 'assert';
import { createTgaUtilsApi } from './lib/load-tga-utils.mjs';
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

const TGA = createTgaUtilsApi();

function withNow(ms, fn) {
  const real = Date.now;
  Date.now = () => ms;
  try {
    return fn();
  } finally {
    Date.now = real;
  }
}

const wec = loadScheduleEntry('wec.json', 'WEC_2026_4');
assert.ok(wec, 'WEC_2026_4 schedule row required');

test('WEC 6h: not past while race is running (before start+6h)', () => {
  const startMs = TGA.getEventFirstRaceStartUtcMs(wec);
  assert.ok(startMs > 0, 'race start UTC required');
  const duringMs = startMs + 2 * 3600000;
  withNow(duringMs, () => {
    assert.strictEqual(TGA.isPastForLastResultsEvent(wec), false);
  });
});

test('WEC 6h: past after estimated finish when not in liveEventIds', () => {
  const startMs = TGA.getEventFirstRaceStartUtcMs(wec);
  const finishMs = TGA.getEventLastRaceFinishUtcMs(wec);
  assert.ok(finishMs > startMs, '6h finish must be after start');
  TGA.liveEventIds = {};
  withNow(finishMs + 60000, () => {
    assert.strictEqual(TGA.isPastForLastResultsEvent(wec), true);
  });
});

test('WEC 6h: still not past after finish while liveEventIds marks LIVE', () => {
  const finishMs = TGA.getEventLastRaceFinishUtcMs(wec);
  TGA.liveEventIds = { WEC_2026_4: true };
  withNow(finishMs + 60000, () => {
    assert.strictEqual(TGA.isPastForLastResultsEvent(wec), false);
  });
  TGA.liveEventIds = {};
});

test('WEC 6h: not past before green flag', () => {
  const startMs = TGA.getEventFirstRaceStartUtcMs(wec);
  withNow(startMs - 60000, () => {
    assert.strictEqual(TGA.isPastForLastResultsEvent(wec), false);
  });
});

test('parseNamedRaceDurationHours detects 6 Hours from WEC title', () => {
  assert.strictEqual(TGA.parseNamedRaceDurationHours(wec.name), 6);
});

console.log('All tga-utils last-results tests passed.');
