// Event page table rendering (buildTableSection, driver/team cells, race stats table).
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  window.TGA = window.TGA || {};

  var RACE_STAT_DISPLAY_ORDER = ['Average speed', 'Cautions / Laps', 'Lead changes', 'Red flags', 'Time of race'];

  function teamLink(name) {
    var TGA = window.TGA;
    var esc = TGA.esc;
    var slugify = TGA.slugify;
    var teamLabel = TGA.teamLabel;
    var raw = name != null ? String(name).trim() : '';
    if (!raw) return '—';
    var label = teamLabel ? teamLabel(raw) : raw;
    return '<a href="/team/' + encodeURIComponent(slugify(raw)) + '" class="track-link">' + esc(label) + '</a>';
  }

  function renderDriverCell(name, joiner) {
    var driverTableCell = window.TGA.driverTableCell;
    var cell = driverTableCell ? driverTableCell(name, joiner) : '';
    return cell || '—';
  }

  function parseStatRow(row) {
    var first = row[0] != null ? String(row[0]).trim() : '';
    var second = row[1] != null ? String(row[1]).trim() : '';
    if (!first) return null;
    var colonIdx = first.indexOf(':');
    if (colonIdx >= 0) {
      return { key: first.slice(0, colonIdx).trim(), val: (first.slice(colonIdx + 1).trim() || second) };
    }
    return { key: first, val: second };
  }

  function getEventRaceStats(d) {
    var stats = d.race_statistics && Object.keys(d.race_statistics).length > 0 ? d.race_statistics : null;
    if (!stats && d.tables && d.tables.race_statistics && d.tables.race_statistics.rows) {
      stats = {};
      d.tables.race_statistics.rows.forEach(function (row) {
        var p = parseStatRow(row);
        if (p && p.key) stats[p.key] = p.val;
      });
    }
    if ((!stats || Object.keys(stats).length === 0) && d.tables && d.tables.race_results && d.tables.race_results.rows) {
      var statKeys = ['Lead changes', 'Cautions / Laps', 'Red flags', 'Time of race', 'Average speed'];
      stats = {};
      d.tables.race_results.rows.forEach(function (row) {
        var p = parseStatRow(row);
        if (!p || !p.key) return;
        var nk = p.key.replace(/\s*\/\s*/g, ' / ').trim();
        if (statKeys.indexOf(nk) >= 0) stats[nk] = p.val;
      });
    }
    return stats && Object.keys(stats).length > 0 ? stats : null;
  }

  function orderedRaceStatKeys(stats) {
    var keys = Object.keys(stats);
    var ordered = [];
    RACE_STAT_DISPLAY_ORDER.forEach(function (k) {
      if (keys.indexOf(k) >= 0) ordered.push(k);
    });
    keys.forEach(function (k) {
      if (RACE_STAT_DISPLAY_ORDER.indexOf(k) < 0) ordered.push(k);
    });
    return ordered;
  }

  function renderRaceStatsTable(stats) {
    var TGA = window.TGA;
    var t = TGA.t;
    var esc = TGA.esc;
    var dash = TGA.dash;
    var localizeStatKey = TGA.localizeStatKey;
    var localizeStatValue = TGA.localizeStatValue;
    return '<h4 class="table-section-title">' + t('section.race_statistics') + '</h4>' +
      '<div class="table-wrap"><table class="data-table table-field-value"><thead><tr><th>' + t('th.field') + '</th><th>' + t('th.value') + '</th></tr></thead><tbody>' +
      orderedRaceStatKeys(stats).map(function (k) {
        return '<tr><td class="col-field">' + esc(dash(localizeStatKey(k))) + '</td><td>' + esc(dash(localizeStatValue(stats[k]))) + '</td></tr>';
      }).join('') +
      '</tbody></table></div>';
  }

  function buildTableSection(title, tableData, extraClass, getRowClass, colWidths, subtitle, titleClass, mergeTeamCells) {
    var TGA = window.TGA;
    var t = TGA.t;
    var esc = TGA.esc;
    var driverTableCell = TGA.driverTableCell;
    var localizeTableHeader = TGA.localizeTableHeader;
    var localizeQualifyingSeparator = TGA.localizeQualifyingSeparator;
    var localizeCellNote = TGA.localizeCellNote;
    var localizeRaceReason = TGA.localizeRaceReason;
    var localizeCautionFlagLabel = TGA.localizeCautionFlagLabel;
    var translateValueHeaders = TGA.translateValueHeaders || [];
    var translateReasonHeaders = TGA.translateReasonHeaders || [];
    var localizeSectionTitle = TGA.localizeSectionTitle;

    if (!tableData || typeof tableData !== 'object') return null;
    var rows = Array.isArray(tableData.rows) ? tableData.rows : [];
    var headers = Array.isArray(tableData.headers) ? tableData.headers : [];
    if (headers.length === 0 && rows.length > 0 && rows[0] && rows[0].length > 0) {
      for (var hi = 0; hi < rows[0].length; hi++) headers.push('');
    }
    var cls = 'data-table' + (extraClass ? ' ' + extraClass : '');
    var noteColIndices = {};
    var reasonColIndices = {};
    var noColIndices = {};
    var driverColIndices = {};
    var driversColIndices = {};
    var teamColIndices = {};
    var cautionConditionColIdx = -1;
    var cautionReasonColIdx = -1;
    var isCautionBreakdown = extraClass && extraClass.indexOf('caution-breakdown') >= 0;
    headers.forEach(function (h, idx) {
      var lh = (h || '').toLowerCase().trim();
      if (translateValueHeaders.indexOf(lh) >= 0) noteColIndices[idx] = true;
      if (translateReasonHeaders.indexOf(lh) >= 0) reasonColIndices[idx] = true;
      if (lh === 'no' || lh === 'no.') noColIndices[idx] = true;
      if (lh === 'driver' || lh === 'driver name' || (lh.indexOf('driver') === 0 && lh.length <= 12)) driverColIndices[idx] = true;
      if (lh === 'drivers') driversColIndices[idx] = true;
      if (lh === 'team') teamColIndices[idx] = true;
      if (isCautionBreakdown && lh === 'condition') cautionConditionColIdx = idx;
      if (isCautionBreakdown && (lh === 'reason' || lh === 'причина')) cautionReasonColIdx = idx;
    });
    var teamColIdx = -1;
    for (var ti = 0; ti < headers.length; ti++) { if (teamColIndices[ti]) { teamColIdx = ti; break; } }
    function isSeparatorRow(row) {
      if (!row || row.length === 0) return false;
      var first = (row[0] != null && String(row[0]).trim() !== '');
      if (!first) return false;
      for (var i = 1; i < row.length; i++) { if (row[i] != null && String(row[i]).trim() !== '') return false; }
      return true;
    }
    var teamRowSpan = [];
    if (mergeTeamCells && teamColIdx >= 0 && rows.length > 0) {
      for (var ri = 0; ri < rows.length; ri++) teamRowSpan[ri] = 0;
      for (var i = 0; i < rows.length; i++) {
        if (teamRowSpan[i] === -1) continue;
        if (isSeparatorRow(rows[i])) continue;
        var teamVal = (rows[i][teamColIdx] != null ? String(rows[i][teamColIdx]).trim() : '');
        var span = 1;
        for (var j = i + 1; j < rows.length; j++) {
          if (isSeparatorRow(rows[j])) break;
          var nextVal = (rows[j][teamColIdx] != null ? String(rows[j][teamColIdx]).trim() : '');
          if (nextVal === teamVal) { span++; teamRowSpan[j] = -1; } else break;
        }
        teamRowSpan[i] = span;
      }
    }
    function stripNumberPrefix(s) {
      if (s == null) return s;
      return String(s).replace(/^[\*\+]+/, '').trim();
    }
    var colgroup = '';
    if (colWidths && Array.isArray(colWidths) && colWidths.length === headers.length) {
      colgroup = '<colgroup>' + colWidths.map(function (w) { return '<col style="width:' + (w || '') + '">'; }).join('') + '</colgroup>';
    }
    var isPreSeasonTable = extraClass && extraClass.indexOf('pre-season-results-table') >= 0;
    var theadStyle = isPreSeasonTable ? ' style="display:table-header-group !important;visibility:visible !important"' : '';
    var theadTrStyle = isPreSeasonTable ? ' style="display:table-row !important;visibility:visible !important"' : '';
    var thStyle = isPreSeasonTable ? ' style="display:table-cell !important;visibility:visible !important"' : '';
    var thead = '<thead' + theadStyle + '><tr' + theadTrStyle + '>' + headers.map(function (h) {
      return '<th' + thStyle + '>' + esc(localizeTableHeader(h || '')) + '</th>';
    }).join('') + '</tr></thead>';
    var tbodyRows = rows.length
      ? rows.map(function (row, rowIndex) {
        if (isSeparatorRow(row)) {
          var text = (row[0] != null ? String(row[0]).trim() : '');
          if (typeof localizeQualifyingSeparator === 'function') text = localizeQualifyingSeparator(text);
          return '<tr class="table-separator-row"><td colspan="' + Math.max(1, headers.length) + '">' + esc(text) + '</td></tr>';
        }
        var rc = getRowClass ? getRowClass(row) : '';
        var emptyCell = (extraClass && extraClass.indexOf('caution-breakdown') >= 0) ? '' : '—';
        return '<tr' + (rc ? ' class="' + rc + '"' : '') + '>' + row.map(function (cell, ci) {
          if (mergeTeamCells && ci === teamColIdx && teamColIdx >= 0) {
            if (teamRowSpan[rowIndex] === -1) return '';
            if (teamRowSpan[rowIndex] > 0) {
              var teamValCell = (cell != null && String(cell).trim() !== '') ? teamLink(String(cell).trim()) : emptyCell;
              return '<td rowspan="' + teamRowSpan[rowIndex] + '" class="stockcar-team-cell">' + teamValCell + '</td>';
            }
          }
          var val;
          if (teamColIndices[ci]) {
            val = (cell != null && String(cell).trim() !== '') ? teamLink(String(cell).trim()) : emptyCell;
          } else if (driverColIndices[ci]) {
            var rawDriver = (cell != null ? String(cell) : '').trim();
            val = rawDriver ? (driverTableCell(rawDriver) || emptyCell) : emptyCell;
          } else if (driversColIndices[ci]) {
            var rawDrivers = (cell != null ? String(cell) : '').trim();
            val = rawDrivers ? (driverTableCell(rawDrivers, '<br>') || emptyCell) : emptyCell;
          } else if (ci === cautionConditionColIdx && cautionConditionColIdx >= 0) {
            var condRaw = (cell != null ? String(cell).trim() : '');
            if (condRaw) {
              val = typeof localizeCautionFlagLabel === 'function' ? localizeCautionFlagLabel(condRaw, false) : condRaw;
            } else {
              var isCautionPeriod = typeof window.TGA.isCautionBreakdownCautionRow === 'function'
                ? window.TGA.isCautionBreakdownCautionRow(row, headers)
                : (function () {
                  var reasonIdx = cautionReasonColIdx >= 0 ? cautionReasonColIdx : 4;
                  return row[reasonIdx] != null && String(row[reasonIdx]).trim() !== '';
                })();
              val = typeof localizeCautionFlagLabel === 'function'
                ? localizeCautionFlagLabel('', isCautionPeriod)
                : (isCautionPeriod ? 'Caution' : 'Green flag');
            }
          } else {
            val = noteColIndices[ci] ? localizeCellNote(cell)
              : reasonColIndices[ci] ? localizeRaceReason(cell)
                : noColIndices[ci] ? stripNumberPrefix(String(cell != null ? cell : ''))
                  : cell;
          }
          var displayVal = (val == null || val === '' || (typeof val === 'string' && val.trim() === '')) ? emptyCell : val;
          var isHtml = typeof displayVal === 'string' && (displayVal.indexOf('<span') >= 0 || displayVal.indexOf('<a') >= 0);
          return '<td>' + (isHtml ? displayVal : esc(displayVal)) + '</td>';
        }).join('') + '</tr>';
      }).join('')
      : '<tr><td class="empty-row" colspan="' + Math.max(1, headers.length) + '">' + esc(t('error.no_section_data')) + '</td></tr>';
    var tbody = '<tbody>' + tbodyRows + '</tbody>';
    var titleCls = 'table-section-title' + (titleClass ? ' ' + titleClass : '');
    var titleBlock = (title ? '<h4 class="' + titleCls + '">' + esc((typeof localizeSectionTitle === 'function' ? localizeSectionTitle(title) : title)) + '</h4>' : '');
    var subtitleBlock = (subtitle ? '<p class="table-section-subtitle">' + esc(subtitle) + '</p>' : '');
    var html = titleBlock + subtitleBlock +
      '<div class="table-wrap"><table class="' + cls + '">' + colgroup + thead + tbody + '</table></div>';
    return { html: html, rows: rows.slice(), getRowClass: getRowClass };
  }

  window.TGA.teamLink = teamLink;
  window.TGA.renderDriverCell = renderDriverCell;
  window.TGA.parseStatRow = parseStatRow;
  window.TGA.getEventRaceStats = getEventRaceStats;
  window.TGA.orderedRaceStatKeys = orderedRaceStatKeys;
  window.TGA.renderRaceStatsTable = renderRaceStatsTable;
  window.TGA.buildTableSection = buildTableSection;
})();
