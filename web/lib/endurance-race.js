// Endurance series table transforms (IMSA, ELMS, GTWCE Endurance, WEC helpers).
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  window.TGA = window.TGA || {};

  function isImsaRoundId(evKey) {
    return /^IMSA_\d{4}_\d+$/.test(String(evKey || ''));
  }

  function isElmsRoundId(evKey) {
    return /^ELMS_\d{4}_\d+$/.test(String(evKey || ''));
  }

  function isGtwceEndId(evKey) {
    return String(evKey || '').indexOf('GTWCE_END_') === 0;
  }

  function dropStartPosColumn(tableData) {
    if (!tableData || !Array.isArray(tableData.headers) || !Array.isArray(tableData.rows)) return tableData;
    var idx = -1;
    for (var i = 0; i < tableData.headers.length; i++) {
      var n = (tableData.headers[i] || '').toUpperCase().trim();
      if (n === 'ST POS' || n === 'START POS' || n === 'START POSITION') { idx = i; break; }
    }
    if (idx < 0) return tableData;
    return {
      headers: tableData.headers.slice(0, idx).concat(tableData.headers.slice(idx + 1)),
      rows: tableData.rows.map(function (r) { return r.slice(0, idx).concat(r.slice(idx + 1)); })
    };
  }

  function splitTeamCarDropSponsor(tableData) {
    if (!tableData || !Array.isArray(tableData.headers) || !Array.isArray(tableData.rows)) return tableData;
    var idx = -1;
    for (var i = 0; i < tableData.headers.length; i++) {
      var h = (tableData.headers[i] || '').toLowerCase().trim();
      if (h === 'team/car/sponsor' || h.indexOf('team/car') === 0) { idx = i; break; }
    }
    if (idx < 0) return tableData;
    return {
      headers: tableData.headers.slice(0, idx).concat(['TEAM', 'CAR'], tableData.headers.slice(idx + 1)),
      rows: tableData.rows.map(function (r) {
        var cell = r[idx] != null ? String(r[idx]) : '';
        var parts = cell.split(/\s*\/\s*/);
        var team = (parts[0] || '').trim();
        var car = (parts[1] != null ? String(parts[1]).trim() : '');
        return r.slice(0, idx).concat([team, car], r.slice(idx + 1));
      })
    };
  }

  function dropColumnsByHeader(tableData, names) {
    if (!tableData || !Array.isArray(tableData.headers) || !Array.isArray(tableData.rows)) return tableData;
    var targets = (names || []).map(function (n) { return String(n || '').trim().toLowerCase(); });
    var dropIdx = [];
    for (var i = 0; i < tableData.headers.length; i++) {
      var h = String(tableData.headers[i] || '').trim().toLowerCase();
      if (targets.indexOf(h) >= 0) dropIdx.push(i);
    }
    if (!dropIdx.length) return tableData;
    return {
      headers: tableData.headers.filter(function (_h, idx) { return dropIdx.indexOf(idx) < 0; }),
      rows: tableData.rows.map(function (r) {
        return Array.isArray(r) ? r.filter(function (_c, idx) { return dropIdx.indexOf(idx) < 0; }) : r;
      })
    };
  }

  function applyClassFromEntryList(tableData, entryList) {
    if (!tableData || !Array.isArray(tableData.headers) || !Array.isArray(tableData.rows)) return tableData;
    if (!entryList || !entryList.length) return tableData;
    var classByNumber = {};
    entryList.forEach(function (row) {
      var num = row.number != null ? String(row.number).trim() : '';
      if (num) {
        var cls = row.class != null ? String(row.class).trim() : '';
        classByNumber[num] = cls;
        var numNorm = String(parseInt(num, 10));
        if (numNorm !== num) classByNumber[numNorm] = cls;
      }
    });
    var classColIdx = -1;
    var carNoColIdx = -1;
    for (var i = 0; i < tableData.headers.length; i++) {
      var h = (tableData.headers[i] || '').toUpperCase().trim();
      if (h === 'CLASS') classColIdx = i;
      if ((h === 'CAR NO' || h === '#' || h === 'NO') && carNoColIdx < 0) carNoColIdx = i;
    }
    if (carNoColIdx < 0) carNoColIdx = 1;
    if (classColIdx < 0 || classColIdx >= tableData.headers.length) return tableData;
    var rows = tableData.rows.map(function (r) {
      var newRow = r.slice();
      var num = newRow[carNoColIdx] != null ? String(newRow[carNoColIdx]).trim() : '';
      var cls = classByNumber[num] || classByNumber[String(parseInt(num, 10))];
      if (cls !== undefined && newRow.length > classColIdx) newRow[classColIdx] = cls;
      return newRow;
    });
    return { headers: tableData.headers, rows: rows };
  }

  function recomputeClassPos(tableData) {
    if (!tableData || !Array.isArray(tableData.headers) || !Array.isArray(tableData.rows)) return tableData;
    var posColIdx = -1;
    var classColIdx = -1;
    var classPosColIdx = -1;
    for (var i = 0; i < tableData.headers.length; i++) {
      var h = (tableData.headers[i] || '').toUpperCase().trim();
      if (h === 'POS') posColIdx = i;
      if (h === 'CLASS') classColIdx = i;
      if (h === 'CLASS POS') classPosColIdx = i;
    }
    if (posColIdx < 0) posColIdx = 0;
    if (classColIdx < 0 || classPosColIdx < 0 || classPosColIdx >= tableData.headers.length) return tableData;
    var rows = tableData.rows;
    var isSeparator = function (row) {
      if (!row || row.length === 0) return false;
      var first = (row[0] != null && String(row[0]).trim() !== '');
      if (!first) return false;
      for (var j = 1; j < row.length; j++) { if (row[j] != null && String(row[j]).trim() !== '') return false; }
      return true;
    };
    var dataRows = rows.filter(function (r) { return !isSeparator(r); });
    var posNum = function (row) {
      var v = row[posColIdx];
      var n = parseInt(v, 10);
      return isNaN(n) ? 9999 : n;
    };
    var getClass = function (row) {
      return (row[classColIdx] != null ? String(row[classColIdx]).trim() : '') || '\0';
    };
    var rowsWithClassPos = rows.map(function (row) {
      if (isSeparator(row)) return row;
      var cls = getClass(row);
      var myPos = posNum(row);
      var classPos = 1;
      for (var k = 0; k < dataRows.length; k++) {
        if (getClass(dataRows[k]) === cls && posNum(dataRows[k]) < myPos) classPos++;
      }
      var newRow = row.slice();
      if (newRow.length > classPosColIdx) newRow[classPosColIdx] = classPos;
      return newRow;
    });
    return { headers: tableData.headers, rows: rowsWithClassPos };
  }

  function ensureQualClassColumn(tableData) {
    if (!tableData || !Array.isArray(tableData.headers) || !Array.isArray(tableData.rows)) return tableData;
    var headers = tableData.headers.slice();
    var classIdx = -1;
    var classPosIdx = -1;
    for (var i = 0; i < headers.length; i++) {
      var h = (headers[i] || '').toUpperCase().trim();
      if (h === 'CLASS') classIdx = i;
      if (h === 'CLASS POS') classPosIdx = i;
    }
    if (classIdx >= 0 || classPosIdx < 0) return tableData;
    return {
      headers: headers.slice(0, classPosIdx).concat(['CLASS'], headers.slice(classPosIdx)),
      rows: tableData.rows.map(function (r) { return r.slice(0, classPosIdx).concat([''], r.slice(classPosIdx)); })
    };
  }

  function imsaQualifyingPointsByClassPos(classPos) {
    var n = parseInt(classPos, 10);
    if (isNaN(n) || n < 1) return 0;
    if (n === 1) return 35;
    if (n === 2) return 32;
    if (n === 3) return 30;
    if (n === 4) return 28;
    if (n === 5) return 26;
    if (n === 6) return 25;
    if (n === 7) return 24;
    if (n === 8) return 23;
    if (n === 9) return 22;
    if (n === 10) return 21;
    if (n === 11) return 20;
    if (n === 12) return 19;
    if (n === 13) return 18;
    if (n === 14) return 17;
    if (n === 15) return 16;
    if (n === 16) return 15;
    if (n === 17) return 14;
    if (n === 18) return 13;
    if (n === 19) return 12;
    if (n === 20) return 11;
    if (n === 21) return 10;
    if (n === 22) return 9;
    if (n === 23) return 8;
    if (n === 24) return 7;
    if (n === 25) return 6;
    if (n === 26) return 5;
    if (n === 27) return 4;
    if (n === 28) return 3;
    if (n === 29) return 2;
    return 1;
  }

  function imsaRacePointsByClassPos(classPos) {
    var n = parseInt(classPos, 10);
    if (isNaN(n) || n < 1) return 0;
    if (n === 1) return 350;
    if (n === 2) return 320;
    if (n === 3) return 300;
    if (n === 4) return 280;
    if (n === 5) return 260;
    if (n === 6) return 250;
    if (n === 7) return 240;
    if (n === 8) return 230;
    if (n === 9) return 220;
    if (n === 10) return 210;
    if (n === 11) return 200;
    if (n === 12) return 190;
    if (n === 13) return 180;
    if (n === 14) return 170;
    if (n === 15) return 160;
    if (n === 16) return 150;
    if (n === 17) return 140;
    if (n === 18) return 130;
    if (n === 19) return 120;
    if (n === 20) return 110;
    if (n === 21) return 100;
    if (n === 22) return 90;
    if (n === 23) return 80;
    if (n === 24) return 70;
    if (n === 25) return 60;
    if (n === 26) return 50;
    if (n === 27) return 40;
    if (n === 28) return 30;
    if (n === 29) return 20;
    return 10;
  }

  function normalizeImsaQualTable(tableData, evKey, entryList) {
    if (!isImsaRoundId(evKey)) return tableData;
    var data = dropColumnsByHeader(dropStartPosColumn(splitTeamCarDropSponsor(tableData)), ['Status']);
    data = ensureQualClassColumn(data);
    if (entryList && entryList.length) data = applyClassFromEntryList(data, entryList);
    data = recomputeClassPos(data);
    if (!data || !Array.isArray(data.headers) || !Array.isArray(data.rows)) return data;
    var headers = data.headers.slice();
    var classPosIdx = -1;
    var pointsIdx = -1;
    for (var i = 0; i < headers.length; i++) {
      var h = (headers[i] || '').toUpperCase().trim();
      if (h === 'CLASS POS') classPosIdx = i;
      if (h === 'POINTS') pointsIdx = i;
    }
    if (classPosIdx < 0) return data;
    if (pointsIdx < 0) {
      pointsIdx = headers.length;
      headers.push('POINTS');
    }
    var rows = data.rows.map(function (r) {
      var row = r.slice();
      while (row.length <= pointsIdx) row.push('');
      row[pointsIdx] = String(imsaQualifyingPointsByClassPos(row[classPosIdx]));
      return row;
    });
    return { headers: headers, rows: rows };
  }

  function transformImsaRaceTable(headers, rows, qualRows) {
    var raceHeaders = (headers || []).slice();
    var raceRows = (rows || []).map(function (r) { return r.slice(); });
    if (!raceHeaders.length) return { headers: raceHeaders, rows: raceRows };

    var teamCarColIdx = -1;
    for (var hi = 0; hi < raceHeaders.length; hi++) {
      var hText = (raceHeaders[hi] || '').toLowerCase().trim();
      if (hText === 'team/car/sponsor' || hText.indexOf('team/car') === 0) {
        teamCarColIdx = hi;
        break;
      }
    }
    if (teamCarColIdx >= 0) {
      raceHeaders = raceHeaders.slice(0, teamCarColIdx).concat(['TEAM', 'CAR'], raceHeaders.slice(teamCarColIdx + 1));
      raceRows = raceRows.map(function (r) {
        var cell = r[teamCarColIdx] != null ? String(r[teamCarColIdx]) : '';
        var parts = cell.split(/\s*\/\s*/);
        var team = (parts[0] || '').trim();
        var car = (parts.slice(1, 2).join(' / ') || '').trim();
        return r.slice(0, teamCarColIdx).concat([team, car], r.slice(teamCarColIdx + 1));
      });
    }

    var fastestLapIdx = -1;
    for (var fl = 0; fl < raceHeaders.length; fl++) {
      if ((raceHeaders[fl] || '').toLowerCase().trim() === 'fastest lap') {
        fastestLapIdx = fl;
        break;
      }
    }
    if (fastestLapIdx >= 0) {
      raceHeaders = raceHeaders.slice(0, fastestLapIdx).concat(raceHeaders.slice(fastestLapIdx + 1));
      raceRows = raceRows.map(function (r) {
        return r.slice(0, fastestLapIdx).concat(r.slice(fastestLapIdx + 1));
      });
    }

    if (qualRows && qualRows.length) {
      var qualPosByCar = {};
      qualRows.forEach(function (qRow) {
        var carNo = qRow[1] != null ? String(qRow[1]).trim() : '';
        var pos = qRow[0] != null ? String(qRow[0]).trim() : '';
        if (carNo) qualPosByCar[carNo] = pos;
      });
      var stPosColIdx = -1;
      for (var si = 0; si < raceHeaders.length; si++) {
        if ((raceHeaders[si] || '').toUpperCase().trim() === 'ST POS') { stPosColIdx = si; break; }
      }
      if (stPosColIdx >= 0) {
        raceRows = raceRows.map(function (r) {
          var row = r.slice();
          var carNo = row[1] != null ? String(row[1]).trim() : '';
          var startPos = qualPosByCar[carNo];
          if (startPos != null && row.length > stPosColIdx) row[stPosColIdx] = startPos;
          return row;
        });
      }
    }

    for (var cn = 0; cn < raceHeaders.length; cn++) {
      if ((raceHeaders[cn] || '').toUpperCase().trim() === 'CAR NO') {
        raceHeaders = raceHeaders.slice();
        raceHeaders[cn] = '#';
        break;
      }
    }

    var classPosIdx = -1;
    var pointsIdx = -1;
    for (var ci = 0; ci < raceHeaders.length; ci++) {
      var ch = (raceHeaders[ci] || '').toUpperCase().trim();
      if (ch === 'CLASS POS') classPosIdx = ci;
      if (ch === 'POINTS') pointsIdx = ci;
    }
    if (classPosIdx >= 0) {
      if (pointsIdx < 0) {
        pointsIdx = raceHeaders.length;
        raceHeaders = raceHeaders.slice();
        raceHeaders.push('POINTS');
      }
      raceRows = raceRows.map(function (r) {
        var row = r.slice();
        while (row.length <= pointsIdx) row.push('');
        row[pointsIdx] = String(imsaRacePointsByClassPos(row[classPosIdx]));
        return row;
      });
    }

    return { headers: raceHeaders, rows: raceRows };
  }

  function gtwceEndTimedSessionTableData(tableData, evKey) {
    if (!tableData || !isGtwceEndId(evKey)) return tableData;
    return dropColumnsByHeader(dropStartPosColumn(splitTeamCarDropSponsor(tableData)), ['Laps']);
  }

  window.TGA.isImsaRoundId = isImsaRoundId;
  window.TGA.isElmsRoundId = isElmsRoundId;
  window.TGA.isGtwceEndId = isGtwceEndId;
  window.TGA.dropStartPosColumn = dropStartPosColumn;
  window.TGA.splitTeamCarDropSponsor = splitTeamCarDropSponsor;
  window.TGA.dropColumnsByHeader = dropColumnsByHeader;
  window.TGA.applyClassFromEntryList = applyClassFromEntryList;
  window.TGA.recomputeClassPos = recomputeClassPos;
  window.TGA.ensureQualClassColumn = ensureQualClassColumn;
  window.TGA.imsaQualifyingPointsByClassPos = imsaQualifyingPointsByClassPos;
  window.TGA.imsaRacePointsByClassPos = imsaRacePointsByClassPos;
  window.TGA.normalizeImsaQualTable = normalizeImsaQualTable;
  window.TGA.transformImsaRaceTable = transformImsaRaceTable;
  window.TGA.gtwceEndTimedSessionTableData = gtwceEndTimedSessionTableData;
})();
