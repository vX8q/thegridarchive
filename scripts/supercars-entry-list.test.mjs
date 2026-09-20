#!/usr/bin/env node
import assert from 'assert';
import { loadEventRenderModules, createAuditPageDeps } from './lib/load-event-render-audit.mjs';

function mockContentEl() {
  return { innerHTML: '', querySelector() { return { querySelector() { return null; } }; } };
}

function test(name, fn) {
  fn();
  console.log('ok', name);
}

const G = loadEventRenderModules();
const P = createAuditPageDeps();

function render(d, seriesId) {
  const el = mockContentEl();
  G.renderEntryListSection(d, el, {
    esc: P.esc,
    t: P.t,
    seriesId,
    isStockCar: false,
    evKeyEvent: d.event_id,
    eventIdFromRoute: 'supercars-2026-10',
    entryListDriverCell: P.entryListDriverCell,
    entryListDriverLabel: P.entryListDriverLabel,
    isGuestEntryRow: P.isGuestEntryRow,
    guestCarNumberSet: P.guestCarNumberSet,
    teamLabel: P.teamLabel,
    countryHtml: P.countryHtml,
    localizeRacingClass: P.localizeRacingClass,
    addObjectTableSort: P.addObjectTableSort,
  });
  return el.innerHTML;
}

test('Supercars enduro entry list shows Co-driver column', () => {
  const html = render({
    event_id: 'SUPERCARS_2026_10',
    series: 'Supercars Championship',
    entry_list: [
      { number: '88', driver: 'Broc Feeney', team: 'Triple Eight Race Engineering', manufacturer: 'Ford', co_driver: 'Nick Percat' },
    ],
  }, 'supercars');
  assert.ok(html.indexOf('th.co_driver') >= 0, 'missing Co-driver header');
  assert.ok(html.indexOf('Broc Feeney') >= 0);
  assert.ok(html.indexOf('Nick Percat') >= 0);
});

test('Supercars sprint entry list omits Co-driver column', () => {
  const html = render({
    event_id: 'SUPERCARS_2026_9',
    series: 'Supercars Championship',
    entry_list: [
      { number: '88', driver: 'Broc Feeney', team: 'Triple Eight Race Engineering', manufacturer: 'Ford' },
    ],
  }, 'supercars');
  assert.ok(html.indexOf('th.co_driver') < 0, 'sprint should not show Co-driver');
  assert.ok(html.indexOf('Broc Feeney') >= 0);
});

console.log('All supercars-entry-list tests passed.');
