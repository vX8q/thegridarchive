#!/usr/bin/env node
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadEventTablesApi() {
  const TGA = {
    t(k) { return k; },
    esc(s) { return String(s == null ? '' : s); },
    dash(v) { return v == null || v === '' ? '—' : v; },
    slugify(s) { return String(s).toLowerCase().replace(/\s+/g, '-'); },
    teamLabel(s) { return s; },
    driverTableCell(n) { return String(n); },
    localizeTableHeader(h) { return h; },
    localizeQualifyingSeparator(s) { return s; },
    localizeCellNote(c) { return c; },
    localizeRaceReason(c) { return c; },
    localizeSectionTitle(s) { return s; },
    localizeStatKey(k) { return k; },
    localizeStatValue(v) { return v; },
    translateValueHeaders: [],
    translateReasonHeaders: [],
  };
  const window = { TGA, console };
  const src = fs.readFileSync(path.join(root, 'web', 'lib', 'event-tables.js'), 'utf8');
  vm.runInNewContext(src, { window, console });
  return window.TGA;
}

function test(name, fn) {
  try {
    fn();
    console.log('ok', name);
  } catch (err) {
    console.error('FAIL', name);
    throw err;
  }
}

const TGA = loadEventTablesApi();

test('buildTableSection renders driver and team columns', () => {
  const out = TGA.buildTableSection('Practice', {
    headers: ['Pos', 'Driver', 'Team'],
    rows: [['1', 'J. Smith', 'Acme Racing']],
  });
  assert.ok(out && out.html.indexOf('J. Smith') >= 0);
  assert.ok(out.html.indexOf('Acme Racing') >= 0);
  assert.ok(out.html.indexOf('/team/') >= 0);
});

test('buildTableSection qualifying separator row', () => {
  const out = TGA.buildTableSection(null, {
    headers: ['Pos', 'Driver', 'Team'],
    rows: [
      ['Failed to qualify', '', ''],
      ['1', 'A. Driver', 'Team A'],
    ],
  }, 'qualifying-results-table');
  assert.ok(out.html.indexOf('table-separator-row') >= 0);
  assert.ok(out.html.indexOf('Failed to qualify') >= 0);
});

test('buildTableSection stockcar team rowspan merge', () => {
  const out = TGA.buildTableSection(null, {
    headers: ['Pos', 'Driver', 'Team'],
    rows: [
      ['1', 'D1', 'Same Team'],
      ['2', 'D2', 'Same Team'],
      ['3', 'D3', 'Other Team'],
    ],
  }, 'race-results-table', null, null, null, null, true);
  assert.ok(out.html.indexOf('rowspan="2"') >= 0);
  assert.ok(out.html.indexOf('stockcar-team-cell') >= 0);
});

test('teamLink produces track link', () => {
  const html = TGA.teamLink('Joe Gibbs Racing');
  assert.ok(html.indexOf('href="/team/') >= 0);
  assert.ok(html.indexOf('Joe Gibbs Racing') >= 0);
});

console.log('All event-tables tests passed.');
