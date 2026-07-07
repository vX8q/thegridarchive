// Touring-car race/practice/entry transforms (Supercars, IndyCar, DTM, Super GT).
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  window.TGA = window.TGA || {};

  var TOURING_SERIES = ['supercars', 'indycar', 'dtm', 'super_gt'];

  function isTouringSeriesId(seriesId) {
    return TOURING_SERIES.indexOf(String(seriesId || '').toLowerCase()) >= 0;
  }

  function isSupercarsSeriesId(seriesId) {
    return String(seriesId || '').toLowerCase() === 'supercars';
  }

  function isIndycarSeriesId(seriesId) {
    var s = String(seriesId || '').toLowerCase();
    if (s === 'indycar') return true;
    return /^indycar_/.test(s);
  }

  function isDtmSeriesId(seriesId) {
    return String(seriesId || '').toLowerCase() === 'dtm';
  }

  function isSuperGtSeriesId(seriesId) {
    return String(seriesId || '').toLowerCase() === 'super_gt';
  }

  function isSuperGtRaceClassTitle(seriesId, titleText) {
    if (!isSuperGtSeriesId(seriesId)) return false;
    var t = String(titleText || '').trim();
    return t === 'GT500' || t === 'GT300';
  }

  function shouldHideStartingLineupOnRaceTab(seriesId) {
    var s = String(seriesId || '').toLowerCase();
    return s === 'f4_it' || s === 'supercars';
  }

  function normalizeFinStTable(tbl) {
    if (!tbl || !Array.isArray(tbl.headers) || !Array.isArray(tbl.rows)) return tbl;
    var idx = -1;
    for (var i = 0; i < tbl.headers.length; i++) {
      var h = String(tbl.headers[i] || '').trim().toLowerCase();
      if (h === 'fin / st' || h === 'фин / st') { idx = i; break; }
    }
    if (idx < 0) return tbl;
    var headers = tbl.headers.slice();
    headers.splice(idx, 1, 'Fin', 'ST');
    var rows = tbl.rows.map(function (row) {
      var r = Array.isArray(row) ? row.slice() : [];
      var cell = (idx < r.length && r[idx] != null) ? String(r[idx]).trim() : '';
      var fin = cell;
      var st = '';
      if (cell.indexOf('/') >= 0) {
        var parts = cell.split('/');
        fin = String(parts[0] || '').trim();
        st = String(parts.slice(1).join('/') || '').trim();
      }
      if (st) {
        var m = st.match(/ST\s*\d+/i);
        st = m ? m[0].replace(/[^0-9]/g, '') : '';
      }
      r.splice(idx, 1, fin, st);
      return r;
    });
    return { headers: headers, rows: rows };
  }

  function applyTeamNamesToRows(rows, numberColIdx, teamColIdx, byNumber) {
    if (!byNumber || !Array.isArray(rows)) return rows;
    return rows.map(function (row) {
      var r = row.slice();
      if (r.length > Math.max(numberColIdx, teamColIdx) && r[numberColIdx] != null) {
        var num = String(r[numberColIdx]).trim();
        var teamFromTeams = byNumber[num] || byNumber[String(parseInt(num, 10))];
        if (teamFromTeams == null && num === '800') teamFromTeams = byNumber['8'];
        if (teamFromTeams != null) r[teamColIdx] = teamFromTeams;
      }
      return r;
    });
  }

  /** Supercars race: Pos, ST, No., Driver, Team, Race time, Laps, Pts (+ legacy layout). */
  function transformSupercarsRaceTable(headers, rows, byNumber) {
    var h = Array.isArray(headers) ? headers : [];
    if (h.length < 8) {
      return { headers: h.slice(), rows: Array.isArray(rows) ? rows.slice() : [] };
    }
    var raceRows = applyTeamNamesToRows(rows || [], 2, 4, byNumber).map(function (r) {
      return [r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7]];
    });
    var raceHeaders = ['Pos', 'ST', 'No.', 'Driver', 'Team', 'Race time', 'Laps', 'Pts'];
    if (String(h[1] || '').trim().toLowerCase() !== 'st') {
      var legacySt = String(h[4] || '').trim().toLowerCase();
      if (legacySt === 'st' || legacySt === 'grid δ' || legacySt === 'grid delta') {
        raceRows = applyTeamNamesToRows(rows || [], 1, 3, byNumber).map(function (r) {
          return [r[0], r[4], r[1], r[2], r[3], r[5], r[6], r[7]];
        });
      }
    }
    return normalizeSupercarsTableNumberColumn({ headers: raceHeaders, rows: raceRows }, 2);
  }

  function normalizeIndycarRaceTable(tbl) {
    if (!tbl || !Array.isArray(tbl.headers) || !Array.isArray(tbl.rows)) return tbl;
    var headers = tbl.headers.map(function (h) { return String(h || '').trim(); });
    for (var i = 0; i < headers.length; i++) {
      var lh = headers[i].toLowerCase();
      if (lh === 'start pos' || lh === 'start pos.') {
        headers[i] = 'St';
        break;
      }
    }
    return { headers: headers, rows: tbl.rows.map(function (r) { return Array.isArray(r) ? r.slice() : r; }) };
  }

  function normalizeSupercarsTableNumberColumn(tableData, colIdx) {
    if (!tableData || !Array.isArray(tableData.rows)) return tableData;
    var rows = tableData.rows.map(function (row) {
      if (!Array.isArray(row) || row.length <= colIdx) return row;
      var r = row.slice();
      var v = r[colIdx];
      if (v == null || v === '') return r;
      var s = String(v).trim();
      if (!/^\d+$/.test(s)) return r;
      if (s === '800') {
        r[colIdx] = '8';
        return r;
      }
      var n = parseInt(s, 10);
      if (!isNaN(n)) r[colIdx] = String(n);
      return r;
    });
    return { headers: (tableData.headers || []).slice(), rows: rows };
  }

  function isSupercarsSydneyEvent(evKey) {
    return /^SUPERCARS_2026_[123]$/.test((evKey || '').toUpperCase().replace(/[^A-Z0-9_]/g, '_'));
  }

  function supercarsSydneyCarDisplay(tableData) {
    if (!tableData || !Array.isArray(tableData.headers) || !Array.isArray(tableData.rows)) return tableData;
    var noColIdx = -1;
    for (var i = 0; i < tableData.headers.length; i++) {
      var h = (tableData.headers[i] || '').toLowerCase().trim();
      if (h === 'no' || h === 'no.' || h === '#' || h === 'car') { noColIdx = i; break; }
    }
    if (noColIdx < 0) return tableData;
    return {
      headers: tableData.headers,
      rows: tableData.rows.map(function (row) {
        var r = row.slice();
        if (r.length > noColIdx && String(r[noColIdx] || '').trim() === '8') r[noColIdx] = '800';
        return r;
      })
    };
  }

  function dropIndycarCautionFreePassColumn(tableData) {
    if (!tableData || !Array.isArray(tableData.headers) || !Array.isArray(tableData.rows)) return tableData;
    var h = tableData.headers;
    var lastIdx = h.length - 1;
    if (lastIdx < 0 || String(h[lastIdx] || '').toLowerCase().indexOf('free pass') < 0) return tableData;
    return {
      headers: h.slice(0, lastIdx),
      rows: tableData.rows.map(function (r) { return r.slice(0, lastIdx); })
    };
  }

  function dropTouringRaceDisplayColumns(tableData, seriesId, evKey) {
    if (!tableData || !Array.isArray(tableData.headers) || !Array.isArray(tableData.rows)) return tableData;
    var sid = String(seriesId || '').toLowerCase();
    var ev = String(evKey || '');
    var dropTargets = null;
    if (/^ELMS_\d{4}_\d+$/.test(ev)) {
      dropTargets = { 'best lap': true, 'time of the day': true };
    } else if (sid === 'super_gt') {
      dropTargets = { 'interval': true, 'avg. (km/h)': true, 'time of the day': true };
    }
    if (!dropTargets) return tableData;
    var dropIdx = [];
    for (var rhi = 0; rhi < tableData.headers.length; rhi++) {
      var rh = String(tableData.headers[rhi] || '').trim().toLowerCase();
      if (dropTargets[rh]) dropIdx.push(rhi);
    }
    if (!dropIdx.length) return tableData;
    return {
      headers: tableData.headers.filter(function (_h, idx) { return dropIdx.indexOf(idx) < 0; }),
      rows: tableData.rows.map(function (row) {
        return Array.isArray(row) ? row.filter(function (_c, idx) { return dropIdx.indexOf(idx) < 0; }) : row;
      })
    };
  }

  function collectEntryDriverNames(row) {
    var names = [];
    function addName(v) {
      var raw = (v == null) ? '' : String(v).trim();
      if (!raw || raw === '-' || /^tbc$/i.test(raw)) return;
      names.push(raw);
    }
    addName(row && row.driver);
    ['driver1', 'driver2', 'driver3', 'driver4'].forEach(function (k) {
      addName(row && row[k]);
    });
    if (row && Array.isArray(row.drivers)) {
      row.drivers.forEach(function (v) { addName(v); });
    }
    var seen = {};
    return names.filter(function (name) {
      var key = String(name).toLowerCase();
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function expandSupercarsSubstituteEntryRows(rows) {
    var out = [];
    (rows || []).forEach(function (row) {
      var names = collectEntryDriverNames(row);
      if (names.length <= 1) {
        out.push(row);
        return;
      }
      names.forEach(function (name, idx) {
        var copy = Object.assign({}, row);
        copy.driver = name;
        delete copy.driver1;
        delete copy.driver2;
        delete copy.driver3;
        delete copy.driver4;
        copy._substituteGroupSize = names.length;
        copy._substituteGroupIndex = idx;
        out.push(copy);
      });
    });
    return out;
  }

  /** Split flat Super GT race_results by CLASS column into GT500/GT300 session objects. */
  function splitSuperGtRaceBlockByClass(raceBlock) {
    if (!raceBlock || !Array.isArray(raceBlock.headers) || !Array.isArray(raceBlock.rows)) return [];
    var raceClassIdx = -1;
    for (var rci = 0; rci < raceBlock.headers.length; rci++) {
      if (String(raceBlock.headers[rci] || '').trim().toUpperCase() === 'CLASS') {
        raceClassIdx = rci;
        break;
      }
    }
    if (raceClassIdx < 0) return [raceBlock];
    var out = [];
    ['GT500', 'GT300'].forEach(function (raceClassName, classIdx) {
      var classRows = raceBlock.rows.filter(function (row) {
        return String((row && row[raceClassIdx]) || '').trim().toUpperCase() === raceClassName;
      });
      if (!classRows.length) return;
      var classSession = Object.assign({}, raceBlock, {
        title: raceClassName,
        headers: raceBlock.headers.filter(function (_h, idx) { return idx !== raceClassIdx; }),
        rows: classRows.map(function (row) {
          return Array.isArray(row) ? row.filter(function (_c, idx) { return idx !== raceClassIdx; }) : row;
        })
      });
      if (classIdx > 0) classSession.meta = null;
      out.push(classSession);
    });
    return out.length ? out : [raceBlock];
  }

  window.TGA.isTouringSeriesId = isTouringSeriesId;
  window.TGA.isSupercarsSeriesId = isSupercarsSeriesId;
  window.TGA.isIndycarSeriesId = isIndycarSeriesId;
  window.TGA.isDtmSeriesId = isDtmSeriesId;
  window.TGA.isSuperGtSeriesId = isSuperGtSeriesId;
  window.TGA.isSuperGtRaceClassTitle = isSuperGtRaceClassTitle;
  window.TGA.shouldHideStartingLineupOnRaceTab = shouldHideStartingLineupOnRaceTab;
  window.TGA.normalizeFinStTable = normalizeFinStTable;
  window.TGA.transformSupercarsRaceTable = transformSupercarsRaceTable;
  window.TGA.normalizeIndycarRaceTable = normalizeIndycarRaceTable;
  window.TGA.normalizeSupercarsTableNumberColumn = normalizeSupercarsTableNumberColumn;
  window.TGA.isSupercarsSydneyEvent = isSupercarsSydneyEvent;
  window.TGA.supercarsSydneyCarDisplay = supercarsSydneyCarDisplay;
  window.TGA.dropIndycarCautionFreePassColumn = dropIndycarCautionFreePassColumn;
  window.TGA.dropTouringRaceDisplayColumns = dropTouringRaceDisplayColumns;
  window.TGA.expandSupercarsSubstituteEntryRows = expandSupercarsSubstituteEntryRows;
  window.TGA.splitSuperGtRaceBlockByClass = splitSuperGtRaceBlockByClass;
})();
