#!/usr/bin/env node
/** Generate web/lib/event-pit-stops.js only */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
fs.writeFileSync(path.join(root, 'web/lib/event-pit-stops.js'), `// F1 pit stop stint chart (extracted from event.js)
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  window.TGA = window.TGA || {};

  function parsePitStint(str) {
    if (!str || typeof str !== 'string') return null;
    str = str.trim();
    function mapCompound(code) {
      code = String(code || '').toUpperCase();
      if (code === 'C1' || code === 'C2') return 'H';
      if (code === 'C3' || code === 'C4') return 'M';
      if (code === 'C5' || code === 'C6') return 'S';
      return code.charAt(0);
    }
    var clean = str.replace(/^((?:C[1-6])|[HMSIW])(?:[NU])?/i, function (match) {
      return match.replace(/[NU]$/i, '');
    }).replace(/\\s*\\(\\s*(\\d+)\\s*\\)\\s*$/i, ' $1');
    var m = clean.match(/^((?:C[1-6])|[HMSIW])\\s*\\(?([0-9]+)\\)?\\s*[\\u2013\\u2014\\-]\\s*\\(?([0-9]+)\\)?$/i);
    if (m) return { compound: mapCompound(m[1]), from: parseInt(m[2], 10), to: parseInt(m[3], 10) };
    var single = clean.match(/^((?:C[1-6])|[HMSIW])\\s*\\(?([0-9]+)\\)?$/i);
    if (single) {
      var n = parseInt(single[2], 10);
      return { compound: mapCompound(single[1]), from: n, to: n };
    }
    var plain = clean.match(/^((?:C[1-6])|[HMSIW])$/i);
    if (plain) return { compound: mapCompound(plain[1]), from: 0, to: 0 };
    if (/^((?:C[1-6])|[HMSIW])\\s*0\\s*\\(DNS\\)/i.test(clean)) return { compound: mapCompound(RegExp.$1), from: 0, to: 0 };
    return null;
  }

  function renderPitStopsChart(ps, d, esc, t, localizeSectionTitle, localizeCompoundLegend, pitEntryList) {
    if (!ps) return { html: '', sortRows: null };
    var psTitle = (ps.title && String(ps.title).trim())
      ? localizeSectionTitle(ps.title)
      : t('table.pit_stops');
    var psRows = ps.rows || [];
    var resolvePitDriver = (window.TGA && window.TGA.resolveDriverFromEntryList) || function (n) { return n; };
    var maxLaps = 58;
    if (d && d.laps != null && String(d.laps).trim() !== '') {
      var lapsInt = parseInt(String(d.laps).trim(), 10);
      if (!isNaN(lapsInt) && lapsInt > 0) maxLaps = lapsInt;
    }
    var html = '';
    html += '<div class="pit-stops-chart-wrap">';
    html += (psTitle ? '<h4 class="pit-stops-chart-title">' + esc(psTitle) + '</h4>' : '');
    html += '<div class="pit-stops-chart">';
    var totalPitStops = 0;
    var usedCompounds = {};
    psRows.forEach(function (row) {
      var driver = (row[0] != null ? String(row[0]) : '').trim();
      var totalLaps = parseInt(row[6], 10) || 0;
      var stints = [];
      for (var s = 1; s <= 5; s++) {
        var seg = parsePitStint(row[s]);
        if (seg) { stints.push(seg); usedCompounds[seg.compound] = true; }
      }
      if (stints.length === 0 && totalLaps === 0 && row[1]) {
        var first = String(row[1]).trim();
        if (first) {
          var comp = first.charAt(0).toUpperCase();
          stints.push({ compound: comp, from: 0, to: 0 });
          usedCompounds[comp] = true;
        }
      }
      if (totalLaps > 0 && totalLaps < maxLaps) {
        stints.push({ compound: '_', from: totalLaps + 1, to: maxLaps });
      }
      var nonDnsStints = stints.filter(function (seg) {
        return !(totalLaps === 0 && seg.from === 0 && seg.to === 0);
      });
      if (nonDnsStints.length > 1) totalPitStops += (nonDnsStints.length - 1);
      var barStyle = totalLaps > 0 ? 'width: 100%;' : 'width: 20px; min-width: 20px;';
      html += '<div class="pit-stops-chart-row">';
      html += '<span class="pit-stops-chart-driver">' + esc((window.TGA && window.TGA.driverLabel) ? window.TGA.driverLabel(resolvePitDriver(driver, pitEntryList)) : driver) + '</span>';
      html += '<div class="pit-stops-chart-bar-wrap"><div class="pit-stops-chart-bar pit-stops-chart-bar--overlay" style="' + barStyle + '">';
      stints.forEach(function (seg, i) {
        var laps = seg.to - seg.from + 1;
        var isDns = totalLaps === 0 && seg.to === 0 && seg.from === 0;
        var isEmpty = seg.compound === '_';
        var cls = 'pit-stops-seg';
        if (isEmpty) cls += ' pit-stops-seg-empty';
        else if (seg.compound === 'H') cls += ' pit-stops-seg-hard';
        else if (seg.compound === 'M') cls += ' pit-stops-seg-medium';
        else if (seg.compound === 'S') cls += ' pit-stops-seg-soft';
        else if (seg.compound === 'I') cls += ' pit-stops-seg-intermediate';
        else if (seg.compound === 'W') cls += ' pit-stops-seg-wet';
        if (isDns) cls += ' pit-stops-seg-dns';
        var segStyle;
        if (isDns) segStyle = 'width:20px;min-width:20px;max-width:20px;flex:0 0 auto';
        else {
          var pct = maxLaps > 0 ? (laps / maxLaps) * 100 : 0;
          var minW = isEmpty ? '0' : '4px';
          segStyle = 'width:' + (Math.round(pct * 100) / 100) + '%;flex:0 0 auto;min-width:' + minW;
        }
        html += '<div class="' + cls + '" style="' + segStyle + '">';
        var nextSeg = stints[i + 1];
        var nextIsEmpty = nextSeg && nextSeg.compound === '_';
        if (i < stints.length - 1 && seg.to > 0 && !isDns && !isEmpty && !nextIsEmpty) {
          var pitLap = seg.to <= 2 ? seg.to : seg.to + 1;
          html += '<span class="pit-stops-divider pit-stops-divider--overlay" aria-hidden="true">' +
            '<svg class="pit-stops-divider-svg" width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="10" fill="#0d0d0d"/></svg>' +
            '<span class="pit-stops-divider-lap">' + esc(String(pitLap)) + '</span></span>';
        }
        html += '</div>';
      });
      html += '</div></div>';
      html += '<span class="pit-stops-chart-laps">' + esc(String(totalLaps)) + '</span>';
      html += '</div>';
    });
    html += '</div>';
    html += '<div class="pit-stops-chart-legend">';
    var legendParts = [];
    if (usedCompounds.H) legendParts.push('C3 — Hard (white)');
    if (usedCompounds.M) legendParts.push('C4 — Medium (yellow)');
    if (usedCompounds.S) legendParts.push('C5 — Soft (red)');
    if (usedCompounds.I) legendParts.push('I — Intermediate (green)');
    if (usedCompounds.W) legendParts.push('W — Wet (blue)');
    var legendText = legendParts.length ? localizeCompoundLegend(legendParts.join(', ') + '.') : '';
    html += '<span class="pit-stops-legend-text">' + esc(legendText) + '</span>';
    html += '<span class="pit-stops-chart-total">' + esc(t('event.total_pit_stops').replace('{n}', String(totalPitStops))) + '</span>';
    html += '</div></div>';
    return { html: html, sortRows: psRows };
  }

  window.TGA.renderPitStopsChart = renderPitStopsChart;
})();
`);
console.log('event-pit-stops.js OK');
