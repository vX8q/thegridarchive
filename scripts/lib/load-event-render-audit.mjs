#!/usr/bin/env node
/**
 * Load browser event render modules in Node for audit-event-render.mjs.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function identity(s) { return s == null ? '' : String(s); }

function esc(s) {
  return identity(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function createAuditPageDeps() {
  return {
    t: (k) => k,
    getLang: () => 'en',
    esc,
    dash: (v) => (v == null || String(v).trim() === '' ? '—' : String(v)),
    slugify: (s) => String(s || '').toLowerCase().replace(/\s+/g, '-'),
    driverDisplayName: identity,
    driverLabel: identity,
    resolveDriverFromEntryList: (n) => n,
    teamLabel: identity,
    isGuestEntryRow: () => false,
    guestCarNumberSet: () => new Set(),
    entryListDriverCell: (r) => identity(r?.driver),
    entryListDriverLabel: (r) => identity(r?.driver),
    localizeStatKey: identity,
    localizeStatValue: identity,
    localizeSpecKey: identity,
    localizeSpecSection: identity,
    localizeSpecValue: identity,
    normalizeSpecKey: identity,
    specKeySkip: () => false,
    localizeTableHeader: identity,
    localizeCellNote: identity,
    localizeRaceReason: identity,
    localizeFreePass: identity,
    localizeCautionFlagLabel: identity,
    translateValueHeaders: [],
    translateReasonHeaders: [],
    translateFreePassHeaders: [],
    localizeDate: identity,
    localizeDistance: identity,
    localizeEventPreview: identity,
    localizeTyreCompounds: identity,
    localizeSectionTitle: identity,
    localizeCompoundLegend: identity,
    localizeEventName: identity,
    localizeEventFromData: identity,
    localizeRacingClass: identity,
    localizeTeamName: identity,
    localizeImsaScheduleLength: identity,
    localizeImsaScheduleClasses: identity,
    localizeQualifyingSeparator: identity,
    documentTitle: identity,
    localizeSeriesName: identity,
    localizeCircuitName: identity,
    localizeVenueLine: identity,
    localizeLocation: identity,
    localizeDriverName: identity,
    localizeDriverNamesInText: identity,
    driverTableCell: (r) => identity(r),
    driverLinkHtml: identity,
    trimTrailingZeros: identity,
    countryHtml: () => '',
    categories: [],
    categoryBySeriesId: () => null,
    seriesBadge: () => '',
    formatShortDate: identity,
    formatEventRaceStartDate: identity,
    buildEventMetaDate: identity,
    formatDateRange: identity,
    parseEventDate: () => null,
    formatDateRangeLong: identity,
    getEventSessionDateRange: () => '',
    addObjectTableSort: () => {},
    typeLabel: identity,
    syncStandingsScrollBars: () => {},
    adjustEventPanelPadding: () => {},
    adjustDetailPanelPadding: () => {},
    makeTableSortable: () => {},
    makeSimpleTableSortable: () => {},
    showView: () => {},
  };
}

export function loadEventRenderModules() {
  const TGA = createAuditPageDeps();
  const ctx = {
    window: { TGA },
    console,
    document: { createElement: () => ({ style: {}, appendChild() {} }) },
  };

  const scripts = [
    'web/lib/deps.js',
    'web/lib/event-page-helpers.js',
    'web/lib/event-tables.js',
    'web/lib/endurance-race.js',
    'web/lib/stockcar-race.js',
    'web/lib/openwheel-race.js',
    'web/lib/touring-race.js',
    'web/lib/event-pit-stops.js',
    'web/lib/event-bop.js',
    'web/lib/event-race-content.js',
    'web/lib/event-entry-list.js',
  ];

  for (const rel of scripts) {
    const src = fs.readFileSync(path.join(root, rel), 'utf8');
    vm.runInNewContext(src, ctx, { filename: rel });
  }

  return ctx.window.TGA;
}

export function collectGCallsFromModules() {
  const moduleFiles = [
    'web/lib/event-race-content.js',
    'web/lib/event-entry-list.js',
    'web/lib/event-bop.js',
    'web/lib/event-pit-stops.js',
  ];
  const names = new Set();
  for (const rel of moduleFiles) {
    const src = fs.readFileSync(path.join(root, rel), 'utf8');
    const re = /G\.([a-zA-Z_][a-zA-Z0-9_]*)/g;
    let m;
    while ((m = re.exec(src))) names.add(m[1]);
  }
  return names;
}

export function mockContentEl() {
  return {
    innerHTML: '',
    querySelector: () => null,
    querySelectorAll: () => [],
  };
}
