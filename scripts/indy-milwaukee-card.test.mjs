#!/usr/bin/env node
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadHelpers() {
  const src = fs.readFileSync(path.join(root, 'web/lib/event-page-helpers.js'), 'utf8');
  const ctx = { window: { TGA: {} } };
  vm.runInNewContext(src, ctx);
  return ctx.window.TGA;
}

const TGA = loadHelpers();

const merged = {
  id: 'INDYCAR_2026_16',
  name: 'Milwaukee Mile',
  circuit_name: 'Milwaukee Mile',
  start_date: '2026-08-29',
  end_date: '2026-08-30',
  _weekendEventIds: ['INDYCAR_2026_16', 'INDYCAR_2026_17'],
};

assert.strictEqual(TGA.isIndyMilwaukeeWeekendEvent(merged), true);
assert.strictEqual(TGA.indyMilwaukeeWeekendCardTitle(), 'Snap-on IndyCar Weekend');
const range = TGA.indyMilwaukeeWeekendDateRange({
  event: merged,
  rangeStart: '2026-08-29',
  rangeEnd: '2026-08-30',
});
assert.strictEqual(range.start, '2026-08-29');
assert.strictEqual(range.end, '2026-08-30');
assert.strictEqual(TGA.weekendCardPrimaryEventId({ event: merged }), 'INDYCAR_2026_16');

// Single-race Milwaukee id without merge span: no hardcoded Aug 29–30 mask.
const sundayOnly = {
  id: 'INDYCAR_2026_17',
  start_date: '2026-08-30',
  end_date: '2026-08-30',
};
const single = TGA.indyMilwaukeeWeekendDateRange({ event: sundayOnly });
assert.strictEqual(single.start, '2026-08-30');
assert.strictEqual(single.end, '2026-08-30');

console.log('ok indy Milwaukee home card helpers');
