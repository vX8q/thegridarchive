// Open-wheel table/session transforms (F1, F2, F3, FREC).
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  window.TGA = window.TGA || {};

  function isOpenwheelJuniorSeries(seriesId) {
    var s = String(seriesId || '').toLowerCase();
    return s === 'f2' || s === 'f3' || s === 'frec';
  }

  function shouldSkipOpenwheelRaceVenueSubtitle(seriesId) {
    var s = String(seriesId || '').toLowerCase();
    return s === 'f2' || s === 'f3';
  }

  function isChampionshipPrefixedSessionTitle(title) {
    var raw = String(title || '').trim();
    if (!raw) return false;
    return /fia\s+formula\s*[23]\s+championship\s*-\s*/i.test(raw);
  }

  function subtitleMatchesEventVenue(subtitle, ev) {
    var sub = String(subtitle || '').trim().toLowerCase();
    if (!sub) return false;
    var keys = ['race', 'track', 'location'];
    for (var vi = 0; vi < keys.length; vi++) {
      var p = String((ev && ev[keys[vi]]) || '').trim().toLowerCase();
      if (!p) continue;
      var short = p.split(',')[0].trim();
      var noCircuit = p.replace(/\s+circuit$/i, '').trim();
      if (sub === p || sub === short || sub === noCircuit) return true;
      if (p.indexOf(sub) >= 0 || sub.indexOf(short) >= 0 || sub.indexOf(noCircuit) >= 0) return true;
    }
    return false;
  }

  function shouldHideOpenwheelSessionTitle(seriesId, title) {
    return isOpenwheelJuniorSeries(seriesId) && isChampionshipPrefixedSessionTitle(title);
  }

  function shouldHideOpenwheelSessionSubtitle(seriesId, subtitle, ev) {
    if (!isOpenwheelJuniorSeries(seriesId)) return false;
    if (subtitleMatchesEventVenue(subtitle, ev)) return true;
    return false;
  }

  function openwheelSessionDisplayTitle(title, seriesId, fallback) {
    var raw = String(title || '').trim();
    if (!isOpenwheelJuniorSeries(seriesId)) {
      if (raw) return raw;
      return fallback != null && String(fallback).trim() !== '' ? String(fallback).trim() : null;
    }
    if (isChampionshipPrefixedSessionTitle(raw)) {
      var dash = raw.lastIndexOf(' - ');
      if (dash >= 0) {
        var short = raw.slice(dash + 3).trim();
        if (short) return short;
      }
    }
    if (raw) return raw;
    return fallback != null && String(fallback).trim() !== '' ? String(fallback).trim() : null;
  }

  function openwheelSessionTableTitle(tbl, fallback, seriesId) {
    var title = tbl && tbl.title ? String(tbl.title).trim() : '';
    if (!isOpenwheelJuniorSeries(seriesId)) {
      if (title) return title;
      return fallback != null ? fallback : null;
    }
    return openwheelSessionDisplayTitle(title, seriesId, fallback);
  }

  function shouldShowSessionMetaTable(evKey, seriesId) {
    var ev = String(evKey || '');
    if (/^IMSA_\d{4}_\d+$/.test(ev)) return false;
    if (/^F1_/.test(ev)) return false;
    if (isOpenwheelJuniorSeries(seriesId)) return false;
    return true;
  }

  function shouldShowOpenwheelQualResultsHeading(evKey, seriesId) {
    if (/^INDYCAR_/.test(String(evKey || ''))) return false;
    if (/^F1_/.test(String(evKey || ''))) return false;
    return !isOpenwheelJuniorSeries(seriesId);
  }

  function transformTableDataForF2F3(tableData, evKey) {
    if (!tableData || !/^F2_|^F3_/.test(String(evKey || ''))) return tableData;
    var headers = Array.isArray(tableData.headers) ? tableData.headers.slice() : [];
    var rows = Array.isArray(tableData.rows) ? tableData.rows.map(function (r) { return r.slice(); }) : [];
    if (headers.length === 0) return tableData;
    var chassisIdx = -1;
    for (var i = 0; i < headers.length; i++) {
      var h = (headers[i] || '').toLowerCase().trim();
      if (h === 'chassis') chassisIdx = i;
      if (h === 'manufacturer') headers[i] = 'Team';
    }
    if (chassisIdx >= 0) {
      headers.splice(chassisIdx, 1);
      rows = rows.map(function (r) {
        if (r.length > chassisIdx) return r.slice(0, chassisIdx).concat(r.slice(chassisIdx + 1));
        return r;
      });
    }
    return { headers: headers, rows: rows };
  }

  function normalizeF1RaceGridColumn(tbl) {
    if (!tbl || !Array.isArray(tbl.headers) || !Array.isArray(tbl.rows)) return tbl;
    var headers = tbl.headers.map(function (h) { return String(h || '').trim(); });
    var lower = headers.map(function (h) { return h.toLowerCase(); });
    var gridIdx = -1;
    for (var gi = 0; gi < lower.length; gi++) {
      if (lower[gi] === 'grid') { gridIdx = gi; break; }
    }
    if (gridIdx < 0) return tbl;
    if (lower.indexOf('q1') >= 0 || lower.indexOf('final grid') >= 0 || lower.indexOf('sprint grid') >= 0) return tbl;
    if (lower[0] !== 'pos' && lower[0] !== 'pos.') return tbl;
    var isRaceTable = false;
    for (var ri = 0; ri < lower.length; ri++) {
      var lh = lower[ri];
      if (lh === 'laps' || lh.indexOf('time') >= 0 || lh.indexOf('laps led') >= 0 || lh === 'points' || lh.indexOf('pts') >= 0) {
        isRaceTable = true;
        break;
      }
    }
    if (!isRaceTable) return tbl;
    var newHeaders = headers.filter(function (_h, idx) { return idx !== gridIdx; });
    newHeaders.splice(1, 0, 'St');
    var rows = tbl.rows.map(function (row) {
      if (!Array.isArray(row)) return row;
      var r = row.slice();
      var gridVal = gridIdx < r.length ? r[gridIdx] : '';
      r.splice(gridIdx, 1);
      r.splice(1, 0, gridVal);
      return r;
    });
    return { headers: newHeaders, rows: rows };
  }

  function localizeF1RaceSessionTitle(titleText, evKey, t) {
    var out = String(titleText || '');
    if (!evKey || String(evKey).indexOf('F1_') !== 0) return out;
    var baseTitle = out.trim();
    if (/^sprint$/i.test(baseTitle)) {
      return (typeof t === 'function' && t('table.sprint_results')) ? t('table.sprint_results') : 'Sprint Results';
    }
    if (/^race$/i.test(baseTitle) || /^race\s+classification$/i.test(baseTitle)) {
      return (typeof t === 'function' && t('table.race_results')) ? t('table.race_results') : 'Race Results';
    }
    return out;
  }

  window.TGA.isOpenwheelJuniorSeries = isOpenwheelJuniorSeries;
  window.TGA.shouldSkipOpenwheelRaceVenueSubtitle = shouldSkipOpenwheelRaceVenueSubtitle;
  window.TGA.isChampionshipPrefixedSessionTitle = isChampionshipPrefixedSessionTitle;
  window.TGA.subtitleMatchesEventVenue = subtitleMatchesEventVenue;
  window.TGA.shouldHideOpenwheelSessionTitle = shouldHideOpenwheelSessionTitle;
  window.TGA.shouldHideOpenwheelSessionSubtitle = shouldHideOpenwheelSessionSubtitle;
  window.TGA.openwheelSessionDisplayTitle = openwheelSessionDisplayTitle;
  window.TGA.openwheelSessionTableTitle = openwheelSessionTableTitle;
  window.TGA.shouldShowSessionMetaTable = shouldShowSessionMetaTable;
  window.TGA.shouldShowOpenwheelQualResultsHeading = shouldShowOpenwheelQualResultsHeading;
  window.TGA.transformTableDataForF2F3 = transformTableDataForF2F3;
  window.TGA.normalizeF1RaceGridColumn = normalizeF1RaceGridColumn;
  window.TGA.localizeF1RaceSessionTitle = localizeF1RaceSessionTitle;
})();
