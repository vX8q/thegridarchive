#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const eventPath = path.join(root, 'web', 'pages', 'event.js');
const lines = fs.readFileSync(eventPath, 'utf8').split(/\r?\n/);

const sl = (a, b) => lines.slice(a - 1, b).join('\n');

const WRAPPERS = [
  'teamLink', 'renderDriverCell', 'dropStartPosColumn', 'splitTeamCarDropSponsor',
  'dropColumnsByHeader', 'applyClassFromEntryList', 'recomputeClassPos', 'transformImsaRaceTable',
  'gtwceEndTimedSessionTableData', 'tgaStageTable', 'seriesUsesStages', 'isStockCarSeriesId',
  'stockCarHasStageFormat', 'hasStage4', 'isAllstarStageRace', 'shouldSkipStage3PointsTable',
  'stockCarStage3TableTitle', 'stockCarRaceResultsTitles', 'qualifyingExcludingDidNotQualify',
  'cautionBreakdownRowClass', 'shouldSkipOpenwheelRaceVenueSubtitle', 'shouldHideOpenwheelSessionSubtitle',
  'openwheelSessionTableTitle', 'openwheelSessionDisplayTitle', 'shouldShowSessionMetaTable',
  'shouldShowOpenwheelQualResultsHeading', 'transformTableDataForF2F3', 'normalizeF1RaceGridColumn',
  'localizeF1RaceSessionTitle', 'isTouringSeriesId', 'isSupercarsSeriesId', 'isIndycarSeriesId',
  'isSuperGtSeriesId', 'isSuperGtRaceClassTitle', 'shouldHideStartingLineupOnRaceTab',
  'normalizeFinStTable', 'transformSupercarsRaceTable', 'normalizeIndycarRaceTable',
  'normalizeSupercarsTableNumberColumn', 'isSupercarsSydneyEvent', 'supercarsSydneyCarDisplay',
  'dropIndycarCautionFreePassColumn', 'dropTouringRaceDisplayColumns', 'expandSupercarsSubstituteEntryRows',
  'splitSuperGtRaceBlockByClass', 'parseStatRow', 'getEventRaceStats', 'renderRaceStatsTable',
  'buildTableSection',
];

function gify(code) {
  let out = code;
  for (const name of WRAPPERS) {
    out = out.replace(new RegExp(`(?<![.\\wG])${name}\\(`, 'g'), `G.${name}(`);
  }
  return out.replace(/G\.G\./g, 'G.');
}

const pitBlock = `    if (tables.pit_stops) {
      var pitEntryList = Array.isArray(d.entry_list) ? d.entry_list : [];
      var pitOut = G.renderPitStopsChart(tables.pit_stops, d, esc, t, localizeSectionTitle, localizeCompoundLegend, pitEntryList);
      html += pitOut.html;
      if (pitOut.sortRows) sortQueue.push({ rows: pitOut.sortRows, getRowClass: null });
    }`;

let raceInner = sl(949, 1717) + '\n' + pitBlock + '\n' + sl(1853, 1872);
raceInner = gify(raceInner);
raceInner = raceInner.replace(/G\.stockCarStage3TableTitle\(([^)]+)\)/g, 'G.stockCarStage3TableTitle($1, t)');
raceInner = raceInner.replace(/G\.stockCarRaceResultsTitles\(([^)]+)\)/g, 'G.stockCarRaceResultsTitles($1, t)');
raceInner = raceInner.replace(/G\.localizeF1RaceSessionTitle\(([^)]+)\)/g, 'G.localizeF1RaceSessionTitle($1, t)');

const raceFile = `// Event page — Race tab (extracted from event.js)
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  window.TGA = window.TGA || {};

${gify(sl(928, 946))}

  function renderRaceContent(d, contentEl) {
    var G = window.TGA;
    var P = G.pageDeps();
    var esc = P.esc;
    var t = P.t;
    var localizeSectionTitle = P.localizeSectionTitle;
    var localizeCompoundLegend = P.localizeCompoundLegend;
    var makeTableSortable = function () { return P.makeTableSortable.apply(null, arguments); };
${raceInner.split('\n').map((l) => '    ' + l).join('\n')}
  }

  window.TGA.renderRaceContent = renderRaceContent;
  window.TGA.buildSessionMetaTable = buildSessionMetaTable;
  window.TGA.buildTeamNamesByNumberFromEntryList = buildTeamNamesByNumberFromEntryList;
})();
`;

const bopFile = `// IMSA Balance of Performance (extracted from event.js)
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  window.TGA = window.TGA || {};
  function t(key) { return window.TGA.t(key); }
  function getLang() { return window.TGA.getLang(); }
${sl(1875, 2075)}
  window.TGA.renderBopContent = renderBopContent;
})();
`;

let entryInner = sl(2378, 3281);
entryInner = gify(entryInner);

const entryFile = `// Event page — entry list section (extracted from event.js)
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  window.TGA = window.TGA || {};

  function renderEntryListSection(d, contentEl, ctx) {
    var G = window.TGA;
    var html = '';
    var esc = ctx.esc;
    var t = ctx.t;
    var seriesId = ctx.seriesId;
    var isStockCar = ctx.isStockCar;
    var evKeyEvent = ctx.evKeyEvent;
    var eventIdFromRoute = ctx.eventIdFromRoute;
    var entryListDriverCell = ctx.entryListDriverCell;
    var entryListDriverLabel = ctx.entryListDriverLabel;
    var isGuestEntryRow = ctx.isGuestEntryRow;
    var guestCarNumberSet = ctx.guestCarNumberSet;
    var teamLabel = ctx.teamLabel;
    var countryHtml = ctx.countryHtml;
    var localizeRacingClass = ctx.localizeRacingClass;
    var addObjectTableSort = ctx.addObjectTableSort;
    function eventSeriesId(eventId) {
      if (!eventId) return '';
      return String(eventId).toUpperCase().replace(/_\\d+.*$/, '');
    }
    var byNumber = (isStockCar && d.entry_list && d.entry_list.length)
      ? G.buildTeamNamesByNumberFromEntryList(d.entry_list)
      : (d.team_names_by_number && typeof d.team_names_by_number === 'object' ? d.team_names_by_number : null);
${entryInner.split('\n').map((l) => '    ' + l).join('\n')}
  }

  window.TGA.renderEntryListSection = renderEntryListSection;
})();
`;

// pit stops - read from split or embed
const pitStopsPath = path.join(root, 'web/lib/event-pit-stops.js');
if (!fs.existsSync(pitStopsPath)) {
  execSync('node scripts/split-event-page.mjs', { cwd: root, stdio: 'inherit' });
}

fs.writeFileSync(path.join(root, 'web/lib/event-bop.js'), bopFile);
fs.writeFileSync(path.join(root, 'web/lib/event-race-content.js'), raceFile);
fs.writeFileSync(path.join(root, 'web/lib/event-entry-list.js'), entryFile);

// --- patch event.js ---
const removeSet = new Set();
for (const [s, e] of [[68, 160], [346, 351], [928, 2090], [2377, 3282]]) {
  for (let n = s; n <= e; n++) removeSet.add(n);
}

const newLines = [];
for (let ln = 1; ln <= lines.length; ln++) {
  if (ln === 67) newLines.push('  var G = window.TGA;');
  if (ln === 2377) {
    newLines.push("    if (section === 'entry-list') {");
    newLines.push('      G.renderEntryListSection(d, contentEl, {');
    newLines.push('        esc: esc, t: t, seriesId: seriesId, isStockCar: isStockCar, evKeyEvent: evKeyEvent,');
    newLines.push('        eventIdFromRoute: eventIdFromRoute,');
    newLines.push('        entryListDriverCell: entryListDriverCell, entryListDriverLabel: entryListDriverLabel,');
    newLines.push('        isGuestEntryRow: isGuestEntryRow, guestCarNumberSet: guestCarNumberSet,');
    newLines.push('        teamLabel: teamLabel, countryHtml: countryHtml, localizeRacingClass: localizeRacingClass,');
    newLines.push('        addObjectTableSort: addObjectTableSort');
    newLines.push('      });');
    newLines.push('      return;');
    newLines.push('    }');
  }
  if (removeSet.has(ln)) continue;
  newLines.push(lines[ln - 1]);
}

let patched = newLines.join('\n');
patched = patched.replace(/\brenderRaceContent\(d, contentEl\)/g, 'G.renderRaceContent(d, contentEl)');
patched = patched.replace(/\brenderBopContent\(esc, d\)/g, 'G.renderBopContent(esc, d)');
for (const name of WRAPPERS) {
  patched = patched.replace(new RegExp(`(?<![.\\w])${name}\\(`, 'g'), `G.${name}(`);
}

fs.writeFileSync(eventPath, patched);
console.log('Patched event.js, wrote lib modules');
console.log('Size bytes:', fs.statSync(eventPath).size);
