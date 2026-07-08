#!/usr/bin/env node
/**
 * Post-split audit: exercise event render modules against real event JSON.
 * Catches ReferenceError and missing G.* exports before they reach the browser.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEventJson } from './lib/load-event-json.mjs';
import {
  collectGCallsFromModules,
  loadEventRenderModules,
  mockContentEl,
} from './lib/load-event-render-audit.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const EVENTS = [
  'F1_2026_5', 'F2_2026_6', 'F3_2026_5', 'FREC_2026_4',
  'IMSA_2026_6', 'IMSA_2026_5', 'WEC_2026_2', 'ELMS_2026_2',
  'NASCAR_CUP_2026_19', 'NOAPS_2026_4', 'INDYCAR_2026_5',
  'SUPERCARS_2026_5', 'GTWCE_END_2026_3', 'GTWCE_SPRINT_2026_1',
  'DTM_2026_4', 'PSC_2026_3', 'SUPER_FORMULA_2026_6',
  'NASCAR_CUP_2026_ALLSTAR_RACE',
];

const MODULE_FILES = [
  'web/pages/event.js',
  'web/lib/event-page-helpers.js',
  'web/lib/event-race-content.js',
  'web/lib/event-entry-list.js',
  'web/lib/event-bop.js',
  'web/lib/event-pit-stops.js',
];

function seriesIdFromEvent(eventId) {
  return String(eventId || '').toUpperCase().replace(/_\d+.*$/, '').toLowerCase();
}

const G = loadEventRenderModules();
const allCalls = collectGCallsFromModules();
const missingExports = [...allCalls].filter((n) => n !== 'pageDeps' && typeof G[n] !== 'function' && G[n] == null);

const syntaxErrors = [];
for (const rel of MODULE_FILES) {
  try {
    execSync(`node --check "${path.join(root, rel)}"`, { stdio: 'pipe' });
  } catch (err) {
    syntaxErrors.push({ file: rel, message: String(err.stderr || err.message) });
  }
}

const renderErrors = [];
let renderOk = 0;

for (const eventId of EVENTS) {
  const d = loadEventJson(eventId);
  if (!d) {
    renderErrors.push({ label: `${eventId}:load`, message: 'event JSON not found' });
    continue;
  }
  const seriesId = seriesIdFromEvent(d.event_id || eventId);
  const evKeyEvent = ((d.event_id || eventId) + '').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  const isStockCar = G.isStockCarSeriesId(seriesId);
  const P = G.pageDeps();

  for (const [section, fn] of [
    ['race', () => G.renderRaceContent(d, mockContentEl())],
    ['entry_list', () => G.renderEntryListSection(d, mockContentEl(), {
      esc: P.esc,
      t: P.t,
      seriesId,
      isStockCar,
      evKeyEvent,
      eventIdFromRoute: eventId.toLowerCase().replace(/_/g, '-'),
      entryListDriverCell: P.entryListDriverCell,
      entryListDriverLabel: P.entryListDriverLabel,
      isGuestEntryRow: P.isGuestEntryRow,
      guestCarNumberSet: P.guestCarNumberSet,
      teamLabel: P.teamLabel,
      countryHtml: P.countryHtml,
      localizeRacingClass: P.localizeRacingClass,
      addObjectTableSort: P.addObjectTableSort,
    })],
  ]) {
    try {
      fn();
      renderOk++;
    } catch (err) {
      renderErrors.push({
        label: `${eventId}:${section}`,
        message: err.message,
      });
    }
  }

  if (/^IMSA_/i.test(eventId)) {
    try {
      const html = G.renderBopContent(P.esc, d);
      if (!html || html.length < 50) throw new Error('bop HTML too short');
      renderOk++;
    } catch (err) {
      renderErrors.push({ label: `${eventId}:bop`, message: err.message });
    }
  }
}

console.log('=== audit-event-render ===\n');

if (syntaxErrors.length) {
  console.error('SYNTAX ERRORS:');
  for (const e of syntaxErrors) console.error(`  ${e.file}: ${e.message}`);
  process.exit(1);
}
console.log(`Syntax: OK (${MODULE_FILES.length} files)`);

if (missingExports.length) {
  console.error('\nMISSING G.* exports:');
  for (const n of missingExports.sort()) console.error(`  - G.${n}`);
  process.exit(1);
}
console.log('G.* exports: OK');

console.log(`Render: ${renderOk} OK, ${renderErrors.length} failed`);

if (renderErrors.length) {
  console.error('\nFailures:');
  for (const e of renderErrors) console.error(`  [${e.label}] ${e.message}`);
  process.exit(1);
}

console.log('\nAll event render audit checks passed.');
