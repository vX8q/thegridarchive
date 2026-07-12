#!/usr/bin/env node
/**
 * Home Last Results filter smoke: LIVE WEC 6h must not duplicate while race runs.
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
const wec = loadScheduleEntry('wec.json', 'WEC_2026_4');
assert.ok(wec);

function filterLastResultsCandidates(events, nowMs, liveIds) {
  TGA.liveEventIds = liveIds || {};
  const real = Date.now;
  Date.now = () => nowMs;
  try {
    return events.filter((ev) => TGA.isPastForLastResultsEvent(ev));
  } finally {
    Date.now = real;
    TGA.liveEventIds = {};
  }
}

test('Home Last Results: WEC LIVE 6h excluded while race runs', () => {
  const events = [wec, loadScheduleEntry('f1.json', 'F1_2026_8')].filter(Boolean);
  const startMs = TGA.getEventFirstRaceStartUtcMs(wec);
  const duringMs = startMs + 3 * 3600000;
  const past = filterLastResultsCandidates(events, duringMs, { WEC_2026_4: true });
  assert.ok(!past.some((e) => e.id === 'WEC_2026_4'));
});

test('Home Last Results: WEC included after finish when not LIVE', () => {
  const events = [wec];
  const finishMs = TGA.getEventLastRaceFinishUtcMs(wec);
  const past = filterLastResultsCandidates(events, finishMs + 120000, {});
  assert.ok(past.some((e) => e.id === 'WEC_2026_4'));
});

console.log('All home last-results smoke tests passed.');
