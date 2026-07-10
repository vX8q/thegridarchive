// Event page — entry list section (extracted from event.js)
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  window.TGA = window.TGA || {};

  function renderEntryListSection(d, contentEl, ctx) {
    var G = window.TGA;
    var P = G.pageDeps();
    var html = '';
    var esc = ctx.esc || P.esc;
    var t = ctx.t || P.t;
    var dash = P.dash;
    var slugify = P.slugify;
    var localizeTableHeader = P.localizeTableHeader;
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
    var byNumber = (isStockCar && d.entry_list && d.entry_list.length)
      ? G.buildTeamNamesByNumberFromEntryList(d.entry_list)
      : (d.team_names_by_number && typeof d.team_names_by_number === 'object' ? d.team_names_by_number : null);
          var entryTables = d && d.tables && d.tables.entry_list;
          if (entryTables && Array.isArray(entryTables.sessions) && entryTables.sessions.length > 0) {
            function idxByName(headers, names) {
              var set = {};
              names.forEach(function (n) { set[String(n).toLowerCase()] = true; });
              for (var i = 0; i < headers.length; i++) {
                var h = String(headers[i] || '').toLowerCase().trim();
                if (set[h]) return i;
              }
              return -1;
            }
            function renderMergedEntrySession(sess) {
              var rawHeaders = Array.isArray(sess.headers) ? sess.headers.slice() : [];
              var rawRows = Array.isArray(sess.rows) ? sess.rows.map(function (r) { return Array.isArray(r) ? r.slice() : []; }) : [];
              var roundsIdxRaw = idxByName(rawHeaders, ['rounds', 'round']);
              var headers = rawHeaders;
              var rows = rawRows;
              if (roundsIdxRaw >= 0) {
                headers = rawHeaders.slice(0, roundsIdxRaw).concat(rawHeaders.slice(roundsIdxRaw + 1));
                rows = rawRows.map(function (r) {
                  return r.slice(0, roundsIdxRaw).concat(r.slice(roundsIdxRaw + 1));
                });
              }
              if (!headers.length) return '';
    
              var entrantIdx = idxByName(headers, ['entrant', 'team']);
              var numberIdx = idxByName(headers, ['no.', 'no', '#']);
              var carIdx = idxByName(headers, ['car']);
              var engineIdx = idxByName(headers, ['engine', 'power unit']);
              var hybridIdx = idxByName(headers, ['hybrid']);
              var tyreIdx = idxByName(headers, ['tyre', 'tire']);
              var classIdx = idxByName(headers, ['class']);
              var seriesIdx = idxByName(headers, ['series']);
              var driverIdx = idxByName(headers, ['drivers', 'driver']);
    
              // Build effective rows: empty Entrant/Car/Engine inherit from previous row.
              var effective = rows.map(function (r) { return r.slice(); });
              for (var ri = 0; ri < effective.length; ri++) {
                if (entrantIdx >= 0 && (effective[ri][entrantIdx] == null || String(effective[ri][entrantIdx]).trim() === '') && ri > 0) {
                  effective[ri][entrantIdx] = effective[ri - 1][entrantIdx];
                }
                if (numberIdx >= 0 && (effective[ri][numberIdx] == null || String(effective[ri][numberIdx]).trim() === '') && ri > 0) {
                  var prevTeamForNo = entrantIdx >= 0 ? String(effective[ri - 1][entrantIdx] || '').trim() : '';
                  var curTeamForNo = entrantIdx >= 0 ? String(effective[ri][entrantIdx] || '').trim() : prevTeamForNo;
                  if (!entrantIdx || prevTeamForNo === curTeamForNo) {
                    effective[ri][numberIdx] = effective[ri - 1][numberIdx];
                  }
                }
                if (carIdx >= 0 && (effective[ri][carIdx] == null || String(effective[ri][carIdx]).trim() === '') && ri > 0) {
                  effective[ri][carIdx] = effective[ri - 1][carIdx];
                }
                if (engineIdx >= 0 && (effective[ri][engineIdx] == null || String(effective[ri][engineIdx]).trim() === '') && ri > 0) {
                  effective[ri][engineIdx] = effective[ri - 1][engineIdx];
                }
                if (hybridIdx >= 0 && (effective[ri][hybridIdx] == null || String(effective[ri][hybridIdx]).trim() === '') && ri > 0) {
                  effective[ri][hybridIdx] = effective[ri - 1][hybridIdx];
                }
                if (tyreIdx >= 0 && (effective[ri][tyreIdx] == null || String(effective[ri][tyreIdx]).trim() === '') && ri > 0) {
                  effective[ri][tyreIdx] = effective[ri - 1][tyreIdx];
                }
                if (classIdx >= 0 && (effective[ri][classIdx] == null || String(effective[ri][classIdx]).trim() === '') && ri > 0) {
                  effective[ri][classIdx] = effective[ri - 1][classIdx];
                }
                if (seriesIdx >= 0 && (effective[ri][seriesIdx] == null || String(effective[ri][seriesIdx]).trim() === '') && ri > 0) {
                  effective[ri][seriesIdx] = effective[ri - 1][seriesIdx];
                }
              }
    
              var entrantSpan = new Array(effective.length).fill(0);
              var numberSpan = new Array(effective.length).fill(0);
              var carSpan = new Array(effective.length).fill(0);
              var engineSpan = new Array(effective.length).fill(0);
              var hybridSpan = new Array(effective.length).fill(0);
              var tyreSpan = new Array(effective.length).fill(0);
    
              if (entrantIdx >= 0) {
                for (var i = 0; i < effective.length; i++) {
                  if (entrantSpan[i] === -1) continue;
                  var teamVal = String(effective[i][entrantIdx] || '').trim();
                  var s = 1;
                  for (var j = i + 1; j < effective.length; j++) {
                    var nextTeam = String(effective[j][entrantIdx] || '').trim();
                    if (nextTeam === teamVal) { s++; entrantSpan[j] = -1; } else break;
                  }
                  entrantSpan[i] = s;
                }
              }
    
              if (numberIdx >= 0 && entrantIdx >= 0) {
                for (var inum = 0; inum < effective.length; inum++) {
                  if (numberSpan[inum] === -1) continue;
                  var teamNum = String(effective[inum][entrantIdx] || '').trim();
                  var noVal = String(effective[inum][numberIdx] || '').trim();
                  var sn = 1;
                  for (var jnum = inum + 1; jnum < effective.length; jnum++) {
                    var teamNumNext = String(effective[jnum][entrantIdx] || '').trim();
                    var noNext = String(effective[jnum][numberIdx] || '').trim();
                    if (teamNumNext === teamNum && noNext === noVal) { sn++; numberSpan[jnum] = -1; } else break;
                  }
                  numberSpan[inum] = sn;
                }
              }
    
              if (carIdx >= 0 && entrantIdx >= 0) {
                for (var i2 = 0; i2 < effective.length; i2++) {
                  if (carSpan[i2] === -1) continue;
                  var teamVal2 = String(effective[i2][entrantIdx] || '').trim();
                  var carVal = String(effective[i2][carIdx] || '').trim();
                  var s2 = 1;
                  for (var j2 = i2 + 1; j2 < effective.length; j2++) {
                    var nextTeam2 = String(effective[j2][entrantIdx] || '').trim();
                    var nextCar = String(effective[j2][carIdx] || '').trim();
                    if (nextTeam2 === teamVal2 && nextCar === carVal) { s2++; carSpan[j2] = -1; } else break;
                  }
                  carSpan[i2] = s2;
                }
              }
    
              if (engineIdx >= 0 && entrantIdx >= 0) {
                for (var i3 = 0; i3 < effective.length; i3++) {
                  if (engineSpan[i3] === -1) continue;
                  var teamVal3 = String(effective[i3][entrantIdx] || '').trim();
                  var engVal = String(effective[i3][engineIdx] || '').trim();
                  var s3 = 1;
                  for (var j3 = i3 + 1; j3 < effective.length; j3++) {
                    var nextTeam3 = String(effective[j3][entrantIdx] || '').trim();
                    var nextEng = String(effective[j3][engineIdx] || '').trim();
                    if (nextTeam3 === teamVal3 && nextEng === engVal) { s3++; engineSpan[j3] = -1; } else break;
                  }
                  engineSpan[i3] = s3;
                }
              }
    
              if (hybridIdx >= 0 && entrantIdx >= 0) {
                for (var i4 = 0; i4 < effective.length; i4++) {
                  if (hybridSpan[i4] === -1) continue;
                  var teamVal4 = String(effective[i4][entrantIdx] || '').trim();
                  var hybridVal = String(effective[i4][hybridIdx] || '').trim();
                  var s4 = 1;
                  for (var j4 = i4 + 1; j4 < effective.length; j4++) {
                    var nextTeam4 = String(effective[j4][entrantIdx] || '').trim();
                    var nextHybrid = String(effective[j4][hybridIdx] || '').trim();
                    if (nextTeam4 === teamVal4 && nextHybrid === hybridVal) { s4++; hybridSpan[j4] = -1; } else break;
                  }
                  hybridSpan[i4] = s4;
                }
              }
    
              if (tyreIdx >= 0 && entrantIdx >= 0) {
                for (var i5 = 0; i5 < effective.length; i5++) {
                  if (tyreSpan[i5] === -1) continue;
                  var teamVal5 = String(effective[i5][entrantIdx] || '').trim();
                  var tyreVal = String(effective[i5][tyreIdx] || '').trim();
                  var s5 = 1;
                  for (var j5 = i5 + 1; j5 < effective.length; j5++) {
                    var nextTeam5 = String(effective[j5][entrantIdx] || '').trim();
                    var nextTyre = String(effective[j5][tyreIdx] || '').trim();
                    if (nextTeam5 === teamVal5 && nextTyre === tyreVal) { s5++; tyreSpan[j5] = -1; } else break;
                  }
                  tyreSpan[i5] = s5;
                }
              }
    
              var thead = '<thead><tr>' + headers.map(function (h) {
                return '<th>' + esc(localizeTableHeader(h || '')) + '</th>';
              }).join('') + '</tr></thead>';
    
              var tbody = rows.map(function (row, rIdx) {
                var cells = '';
                for (var ci = 0; ci < headers.length; ci++) {
                  if (ci === entrantIdx) {
                    if (entrantSpan[rIdx] === -1) continue;
                    var teamRaw = String(effective[rIdx][ci] || '').trim();
                    var teamCell = teamRaw
                      ? G.teamLink(teamRaw)
                      : '—';
                    cells += '<td rowspan="' + Math.max(1, entrantSpan[rIdx]) + '" class="entry-list-team-cell">' + teamCell + '</td>';
                    continue;
                  }
                  if (ci === numberIdx) {
                    if (numberSpan[rIdx] === -1) continue;
                    var noRaw = String(effective[rIdx][ci] || '').trim();
                    cells += '<td rowspan="' + Math.max(1, numberSpan[rIdx]) + '">' + esc(noRaw || '—') + '</td>';
                    continue;
                  }
                  if (ci === carIdx) {
                    if (carSpan[rIdx] === -1) continue;
                    var carRaw = String(effective[rIdx][ci] || '').trim();
                    cells += '<td rowspan="' + Math.max(1, carSpan[rIdx]) + '">' + esc(carRaw || '—') + '</td>';
                    continue;
                  }
                  if (ci === engineIdx) {
                    if (engineSpan[rIdx] === -1) continue;
                    var engRaw = String(effective[rIdx][ci] || '').trim();
                    cells += '<td rowspan="' + Math.max(1, engineSpan[rIdx]) + '">' + esc(engRaw || '—') + '</td>';
                    continue;
                  }
                  if (ci === hybridIdx) {
                    if (hybridSpan[rIdx] === -1) continue;
                    var hybridRaw = String(effective[rIdx][ci] || '').trim();
                    cells += '<td rowspan="' + Math.max(1, hybridSpan[rIdx]) + '">' + esc(hybridRaw || '—') + '</td>';
                    continue;
                  }
                  if (ci === tyreIdx) {
                    if (tyreSpan[rIdx] === -1) continue;
                    var tyreRaw = String(effective[rIdx][ci] || '').trim();
                    cells += '<td rowspan="' + Math.max(1, tyreSpan[rIdx]) + '">' + esc(tyreRaw || '—') + '</td>';
                    continue;
                  }
                  if ((ci === classIdx || ci === seriesIdx) && numberIdx >= 0) {
                    if (numberSpan[rIdx] === -1) continue;
                    var crewMetaRaw = String(effective[rIdx][ci] || '').trim();
                    cells += '<td rowspan="' + Math.max(1, numberSpan[rIdx]) + '">' + esc(crewMetaRaw || '—') + '</td>';
                    continue;
                  }
                  if (ci === driverIdx) {
                    var drvRaw = (row[ci] != null ? String(row[ci]) : '').trim();
                    cells += '<td>' + (drvRaw ? G.renderDriverCell(drvRaw) : '—') + '</td>';
                    continue;
                  }
                  var val = (row[ci] == null || String(row[ci]).trim() === '') ? '—' : row[ci];
                  cells += '<td>' + esc(val) + '</td>';
                }
                return '<tr>' + cells + '</tr>';
              }).join('');
    
              var title = sess.title || (t('section.entry_list') || 'Entry list');
              return '<h4 class="table-section-title">' + esc(title) + '</h4>' +
                '<div class="table-wrap"><table class="data-table entry-list-table">' +
                thead + '<tbody>' + tbody + '</tbody></table></div>';
            }
    
            entryTables.sessions.forEach(function (sess) {
              if (!sess || !Array.isArray(sess.headers) || !Array.isArray(sess.rows)) return;
              html += renderMergedEntrySession(sess);
            });
            if (!html) contentEl.innerHTML = '<p class="empty-msg">' + t('error.no_entry_list') + '</p>';
            else contentEl.innerHTML = html;
            return;
          }
    
          if (!d.entry_list || d.entry_list.length === 0) {
            contentEl.innerHTML = '<p class="empty-msg">' + t('error.no_entry_list') + '</p>';
            return;
          }
          var entryCopy = d.entry_list.slice();
          var evKeyEntry = ((d.event_id || '') + '').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
          var seriesSlugEntryList = (G.eventSeriesId(d.event_id || eventIdFromRoute || '') || '').toLowerCase();
          if (seriesSlugEntryList === 'imsa') {
            // Column order: #, Class, Team, Car, Drivers. For one team merge Team, Class and Car cells (rowspan).
            var headImsa = '<th>' + t('th.no') + '</th><th>' + t('th.class') + '</th><th>' + t('th.team') + '</th><th>' + t('th.car') + '</th><th>' + t('th.driver') + '</th>';
            function buildImsaEntryTbody(arr, byNum) {
              var teamVals = arr.map(function (row) {
                var tv = row.team;
                if (byNum && row.number != null) tv = byNum[String(row.number).trim()] || byNum[String(parseInt(row.number, 10))] || tv;
                return tv != null ? String(tv) : '';
              });
              var classVals = arr.map(function (row) {
                return row.class != null ? String(row.class) : '';
              });
              var teamRowspan = [];
              for (var i = 0; i < arr.length; i++) {
                if (i === 0 || teamVals[i] !== teamVals[i - 1] || classVals[i] !== classVals[i - 1]) {
                  var ts = 1;
                  while (i + ts < arr.length && teamVals[i + ts] === teamVals[i] && classVals[i + ts] === classVals[i]) ts++;
                  teamRowspan.push(ts);
                } else {
                  teamRowspan.push(0);
                }
              }
              return arr.map(function (row, idx) {
                var teamDisplay = teamVals[idx];
                var carDisplay = (row.car != null && String(row.car).trim()) ? String(row.car) : (row.manufacturer != null ? String(row.manufacturer) : '');
                var classDisplay = row.class != null ? String(row.class) : '';
                var driverRaw = row.driver != null ? String(row.driver) : '';
                var driverParts = driverRaw.split(/\s*\/\s*/).map(function (p) { return p.trim(); }).filter(function (p) { return p; });
                var driverCell = driverParts.length
                  ? driverParts.map(function (name) { return G.renderDriverCell(name); }).join(' / ')
                  : '—';
                var span = teamRowspan[idx];
                var teamTd = span > 0
                  ? '<td rowspan="' + span + '" class="entry-list-team-cell">' + (teamDisplay ? G.teamLink(teamDisplay) : '—') + '</td>'
                  : '';
                var classTd = span > 0
                  ? '<td rowspan="' + span + '" class="entry-list-class-cell">' + esc(dash(localizeRacingClass(classDisplay))) + '</td>'
                  : '';
                var carTd = span > 0
                  ? '<td rowspan="' + span + '" class="entry-list-car-cell">' + esc(dash(carDisplay)) + '</td>'
                  : '';
                return '<tr><td>' + esc(dash(row.number)) + '</td>' + classTd + teamTd + carTd + '<td>' + driverCell + '</td></tr>';
              }).join('');
            }
            contentEl.innerHTML = '<div class="table-wrap"><table class="data-table entry-list-table"><thead><tr>' + headImsa + '</tr></thead><tbody>' + buildImsaEntryTbody(entryCopy, byNumber) + '</tbody></table></div>';
            addObjectTableSort(contentEl.querySelector('.data-table'), entryCopy, null, ['number', 'class', 'team', 'car', 'driver'], function (dataCopy) {
              return buildImsaEntryTbody(dataCopy, byNumber);
            });
            return;
          }
          var eventIdLower = (d.event_id || eventIdFromRoute || '').toLowerCase();
          var seriesLowerEntry = (G.eventSeriesId(d.event_id || eventIdFromRoute || '') || '').toLowerCase();
          var isElmsEntry = seriesLowerEntry === 'elms'
            && entryCopy.some(function (e) { return e && e.class != null; })
            && entryCopy.some(function (e) { return e && (e.driver1 != null || e.driver2 != null || e.driver3 != null); });
          if (isElmsEntry) {
            var elmsClassOrder = ['LMP2', 'LMP2 Pro/Am', 'LMP3', 'LMGT3'];
            function normElmsClass(v) {
              return String(v || '')
                .replace(/\u00a0/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .toUpperCase();
            }
            function sortByCarNumber(a, b) {
              var na = parseInt(String((a && a.number) || '').replace(/[^\d]/g, ''), 10);
              var nb = parseInt(String((b && b.number) || '').replace(/[^\d]/g, ''), 10);
              if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
              return String((a && a.number) || '').localeCompare(String((b && b.number) || ''), undefined, { numeric: true, sensitivity: 'base' });
            }
            function renderElmsDriverCell(name) {
              var raw = (name == null) ? '' : String(name).trim();
              if (!raw || raw === '-') return '—';
              return G.renderDriverCell(raw);
            }
            var htmlElms = '';
            for (var ci = 0; ci < elmsClassOrder.length; ci++) {
              var clsName = elmsClassOrder[ci];
              var clsRows = entryCopy
                .filter(function (r) { return normElmsClass(r && r.class) === normElmsClass(clsName); })
                .sort(sortByCarNumber);
              if (!clsRows.length) continue;
              var bodyElms = clsRows.map(function (row) {
                var teamName = (row && row.team != null) ? String(row.team).trim() : '';
                var teamCell = teamName ? G.teamLink(teamName) : '—';
                var carVal = (row && row.car != null) ? String(row.car).trim() : '';
                return '<tr>' +
                  '<td>' + esc(dash(row && row.number)) + '</td>' +
                  '<td>' + teamCell + '</td>' +
                  '<td>' + esc(dash(carVal)) + '</td>' +
                  '<td>' + renderElmsDriverCell(row && row.driver1) + '</td>' +
                  '<td>' + renderElmsDriverCell(row && row.driver2) + '</td>' +
                  '<td>' + renderElmsDriverCell(row && row.driver3) + '</td>' +
                  '</tr>';
              }).join('');
              htmlElms += '<h4 class="table-section-title">' + esc(clsName) + '</h4>' +
                '<div class="table-wrap"><table class="data-table entry-list-table">' +
                '<thead><tr><th>' + t('th.no') + '</th><th>' + t('th.team') + '</th><th>' + t('th.car') + '</th><th>' + t('th.driver1') + '</th><th>' + t('th.driver2') + '</th><th>' + t('th.driver3') + '</th></tr></thead>' +
                '<tbody>' + bodyElms + '</tbody></table></div>';
            }
            contentEl.innerHTML = htmlElms || ('<p class="empty-msg">' + t('error.no_entry_list') + '</p>');
            return;
          }
          var isGtwceEndEntry = (seriesLowerEntry === 'gtwce_end' || seriesLowerEntry === 'gtwce_sprint')
            && entryCopy.some(function (e) { return e && e.class != null; })
            && entryCopy.some(function (e) { return e && (e.driver1 != null || e.driver2 != null || e.driver3 != null); });
          if (isGtwceEndEntry) {
            var gtwceSprintTwoDrivers = seriesLowerEntry === 'gtwce_sprint';
            var gtwceEndFourDrivers = seriesLowerEntry === 'gtwce_end';
            var gtwceClassOrder = ['PRO', 'GOLD', 'SILVER', 'BRONZE', 'PRO-AM'];
            var gtwceClassKeys = { PRO: 'class.gtwce_pro', GOLD: 'class.gtwce_gold', SILVER: 'class.gtwce_silver', BRONZE: 'class.gtwce_bronze', 'PRO-AM': 'class.gtwce_pro_am' };
            function normGtwceClass(v) {
              return String(v || '')
                .replace(/\u00a0/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .toUpperCase()
                .replace(/^PROAM$/, 'PRO-AM')
                .replace(/^PRO AM$/, 'PRO-AM');
            }
            function sortByCarNumberGtwce(a, b) {
              var na = parseInt(String((a && a.number) || '').replace(/[^\d]/g, ''), 10);
              var nb = parseInt(String((b && b.number) || '').replace(/[^\d]/g, ''), 10);
              if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
              return String((a && a.number) || '').localeCompare(String((b && b.number) || ''), undefined, { numeric: true, sensitivity: 'base' });
            }
            function sortByTeamThenCarGtwce(a, b) {
              var ta = (a && a.team != null) ? String(a.team).trim() : '';
              var tb = (b && b.team != null) ? String(b.team).trim() : '';
              var cmp = ta.localeCompare(tb, undefined, { sensitivity: 'base' });
              if (cmp !== 0) return cmp;
              return sortByCarNumberGtwce(a, b);
            }
            function renderGtwceDriverCell(name) {
              var raw = (name == null) ? '' : String(name).trim();
              if (!raw || raw === '-') return '—';
              return G.renderDriverCell(raw);
            }
            var htmlGtwce = '';
            for (var gci = 0; gci < gtwceClassOrder.length; gci++) {
              var clsKey = gtwceClassOrder[gci];
              var clsRowsGtwce = entryCopy
                .filter(function (r) { return normGtwceClass(r && r.class) === clsKey; })
                .sort(sortByTeamThenCarGtwce);
              if (!clsRowsGtwce.length) continue;
              var gtwceClassFourDrivers = gtwceEndFourDrivers && clsKey !== 'PRO';
              var teamValsGtwce = clsRowsGtwce.map(function (row) {
                return (row && row.team != null) ? String(row.team).trim() : '';
              });
              var teamRowspanGtwce = [];
              for (var tri = 0; tri < clsRowsGtwce.length; tri++) {
                if (tri === 0 || teamValsGtwce[tri] !== teamValsGtwce[tri - 1]) {
                  var trs = 1;
                  while (tri + trs < clsRowsGtwce.length && teamValsGtwce[tri + trs] === teamValsGtwce[tri]) trs++;
                  teamRowspanGtwce.push(trs);
                } else {
                  teamRowspanGtwce.push(0);
                }
              }
              var bodyGtwce = clsRowsGtwce.map(function (row, trix) {
                var teamNameG = (row && row.team != null) ? String(row.team).trim() : '';
                var teamCellG = teamNameG ? G.teamLink(teamNameG) : '—';
                var carValG = (row && row.car != null) ? String(row.car).trim() : '';
                var spanG = teamRowspanGtwce[trix];
                var teamTdGtwce = spanG > 0
                  ? '<td rowspan="' + spanG + '" class="entry-list-team-cell">' + teamCellG + '</td>'
                  : '';
                var driverCellsGtwce = gtwceSprintTwoDrivers
                  ? '<td>' + renderGtwceDriverCell(row && row.driver1) + '</td>' +
                    '<td>' + renderGtwceDriverCell(row && row.driver2) + '</td>'
                  : gtwceClassFourDrivers
                    ? '<td>' + renderGtwceDriverCell(row && row.driver1) + '</td>' +
                      '<td>' + renderGtwceDriverCell(row && row.driver2) + '</td>' +
                      '<td>' + renderGtwceDriverCell(row && row.driver3) + '</td>' +
                      '<td>' + renderGtwceDriverCell(row && row.driver4) + '</td>'
                    : '<td>' + renderGtwceDriverCell(row && row.driver1) + '</td>' +
                      '<td>' + renderGtwceDriverCell(row && row.driver2) + '</td>' +
                      '<td>' + renderGtwceDriverCell(row && row.driver3) + '</td>';
                return '<tr>' +
                  '<td>' + esc(dash(row && row.number)) + '</td>' +
                  teamTdGtwce +
                  '<td>' + esc(dash(carValG)) + '</td>' +
                  driverCellsGtwce +
                  '</tr>';
              }).join('');
              var sectionTitle = gtwceClassKeys[clsKey] ? t(gtwceClassKeys[clsKey]) : clsKey;
              var gtwceEntryListHead = '<thead><tr><th>' + t('th.no') + '</th><th>' + t('th.team') + '</th><th>' + t('th.car') + '</th><th>' + t('th.driver1') + '</th><th>' + t('th.driver2') + '</th>' +
                (gtwceSprintTwoDrivers ? '' : '<th>' + t('th.driver3') + '</th>' + (gtwceClassFourDrivers ? '<th>' + t('th.driver4') + '</th>' : '')) + '</tr></thead>';
              htmlGtwce += '<h4 class="table-section-title">' + esc(sectionTitle) + '</h4>' +
                '<div class="table-wrap"><table class="data-table entry-list-table">' +
                gtwceEntryListHead +
                '<tbody>' + bodyGtwce + '</tbody></table></div>';
            }
            contentEl.innerHTML = htmlGtwce || ('<p class="empty-msg">' + t('error.no_entry_list') + '</p>');
            return;
          }
          var isSuperGtEntry = seriesLowerEntry === 'super_gt'
            && entryCopy.some(function (e) { return e && e.class != null; });
          if (isSuperGtEntry) {
            var superGtClassOrder = ['GT500', 'GT300'];
            function normSuperGtClass(v) {
              return String(v || '')
                .replace(/\u00a0/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .toUpperCase();
            }
            function sortBySuperGtNo(a, b) {
              var na = parseInt(String((a && a.number) || '').replace(/[^\d]/g, ''), 10);
              var nb = parseInt(String((b && b.number) || '').replace(/[^\d]/g, ''), 10);
              if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
              return String((a && a.number) || '').localeCompare(String((b && b.number) || ''), undefined, { numeric: true, sensitivity: 'base' });
            }
            function sortBySuperGtTeamCarNo(a, b) {
              var ta = String((a && a.team) || '').trim().toLowerCase();
              var tb = String((b && b.team) || '').trim().toLowerCase();
              if (ta < tb) return -1;
              if (ta > tb) return 1;
              var ca = String((a && a.car) || '').trim().toLowerCase();
              var cb = String((b && b.car) || '').trim().toLowerCase();
              if (ca < cb) return -1;
              if (ca > cb) return 1;
              return sortBySuperGtNo(a, b);
            }
            function renderSuperGtDrivers(row) {
              var names = [];
              ['driver1', 'driver2', 'driver3'].forEach(function (k) {
                var raw = row && row[k] != null ? String(row[k]).trim() : '';
                if (!raw) return;
                if (/^tbc$/i.test(raw)) return;
                names.push(raw);
              });
              if (!names.length && row && row.driver != null) {
                String(row.driver).split(/\s*\/\s*/).forEach(function (p) {
                  var v = String(p || '').trim();
                  if (!v || /^tbc$/i.test(v)) return;
                  names.push(v);
                });
              }
              if (!names.length) return '—';
              return names.map(function (name) { return G.renderDriverCell(name); }).join(' / ');
            }
            var htmlSuperGt = '';
            for (var sci = 0; sci < superGtClassOrder.length; sci++) {
              var clsSuperGt = superGtClassOrder[sci];
              var rowsSuperGt = entryCopy
                .filter(function (r) { return normSuperGtClass(r && r.class) === normSuperGtClass(clsSuperGt); })
                .sort(sortBySuperGtTeamCarNo);
              if (!rowsSuperGt.length) continue;
              var teamValsSuperGt = rowsSuperGt.map(function (row) {
                return (row && row.team != null) ? String(row.team).trim() : '';
              });
              var carValsSuperGt = rowsSuperGt.map(function (row) {
                return (row && row.car != null) ? String(row.car).trim() : '';
              });
              var teamRowspanSuperGt = [];
              var carRowspanSuperGt = [];
              for (var sgi = 0; sgi < rowsSuperGt.length; sgi++) {
                if (sgi === 0 || teamValsSuperGt[sgi] !== teamValsSuperGt[sgi - 1]) {
                  var ts = 1;
                  while (sgi + ts < rowsSuperGt.length && teamValsSuperGt[sgi + ts] === teamValsSuperGt[sgi]) ts++;
                  teamRowspanSuperGt.push(ts);
                } else {
                  teamRowspanSuperGt.push(0);
                }
                if (sgi === 0 || teamValsSuperGt[sgi] !== teamValsSuperGt[sgi - 1] || carValsSuperGt[sgi] !== carValsSuperGt[sgi - 1]) {
                  var cs = 1;
                  while (
                    sgi + cs < rowsSuperGt.length &&
                    teamValsSuperGt[sgi + cs] === teamValsSuperGt[sgi] &&
                    carValsSuperGt[sgi + cs] === carValsSuperGt[sgi]
                  ) cs++;
                  carRowspanSuperGt.push(cs);
                } else {
                  carRowspanSuperGt.push(0);
                }
              }
              var bodySuperGt = rowsSuperGt.map(function (row, idx) {
                var teamName = (row && row.team != null) ? String(row.team).trim() : '';
                var teamCell = teamName ? G.teamLink(teamName) : '—';
                var makeVal = (row && row.make != null) ? String(row.make).trim() : '';
                var carVal = (row && row.car != null) ? String(row.car).trim() : '';
                var tireVal = (row && row.tire != null) ? String(row.tire).trim() : '';
                var teamSpan = teamRowspanSuperGt[idx] || 0;
                var carSpan = carRowspanSuperGt[idx] || 0;
                var teamTd = teamSpan > 0
                  ? '<td rowspan="' + teamSpan + '" class="entry-list-team-cell">' + teamCell + '</td>'
                  : '';
                var carTd = carSpan > 0
                  ? '<td rowspan="' + carSpan + '" class="entry-list-car-cell">' + esc(dash(carVal)) + '</td>'
                  : '';
                return '<tr>' +
                  '<td>' + esc(dash(row && row.number)) + '</td>' +
                  teamTd +
                  '<td>' + esc(dash(makeVal)) + '</td>' +
                  carTd +
                  '<td>' + renderSuperGtDrivers(row) + '</td>' +
                  '<td>' + esc(dash(tireVal)) + '</td>' +
                  '</tr>';
              }).join('');
              htmlSuperGt += '<h4 class="table-section-title">' + esc(clsSuperGt) + '</h4>' +
                '<div class="table-wrap"><table class="data-table entry-list-table">' +
                '<thead><tr><th>' + t('th.no') + '</th><th>' + t('th.team') + '</th><th>' + t('th.make') + '</th><th>' + t('th.car') + '</th><th>' + t('th.driver') + '</th><th>' + t('th.tire') + '</th></tr></thead>' +
                '<tbody>' + bodySuperGt + '</tbody></table></div>';
            }
            contentEl.innerHTML = htmlSuperGt || ('<p class="empty-msg">' + t('error.no_entry_list') + '</p>');
            return;
          }
          var isPscEntry = seriesLowerEntry === 'psc'
            || (String(d.series || '').toLowerCase().indexOf('porsche') >= 0 && String(d.series || '').toLowerCase().indexOf('supercup') >= 0)
            || /^psc[-_]/.test((d.event_id || eventIdFromRoute || '').toLowerCase());
          var isFrecEntry = seriesLowerEntry === 'frec'
            || G.isF4SeriesId(seriesLowerEntry)
            || (String(d.series || '').toLowerCase().indexOf('formula regional european') >= 0)
            || /^frec_/.test((d.event_id || '').toLowerCase())
            || isPscEntry;
          if (isFrecEntry) {
            entryCopy.sort(function (a, b) {
              var ta = String((a && a.team) || '').toLowerCase();
              var tb = String((b && b.team) || '').toLowerCase();
              if (ta < tb) return -1;
              if (ta > tb) return 1;
              var na = String((a && a.number) || '');
              var nb = String((b && b.number) || '');
              return na.localeCompare(nb, undefined, { numeric: true });
            });
            function buildFrecEntryBody(arr) {
              var guestCars = guestCarNumberSet(arr);
              var spans = [];
              for (var fi = 0; fi < arr.length; fi++) {
                var teamVal = String((arr[fi] && arr[fi].team) || '');
                var fs = 1;
                while (fi + fs < arr.length && String((arr[fi + fs] && arr[fi + fs].team) || '') === teamVal) fs++;
                spans.push(fs);
              }
              return arr.map(function (row, idx) {
                var teamDisplay = String((row && row.team) || '');
                var isFirstTeam = (idx === 0 || String((arr[idx - 1] && arr[idx - 1].team) || '') !== teamDisplay);
                var teamCell = (isFirstTeam && spans[idx] > 0)
                  ? '<td rowspan="' + spans[idx] + '" class="entry-list-team-cell">' + (teamDisplay ? G.teamLink(teamDisplay) : '—') + '</td>'
                  : '';
                var driverCell = entryListDriverCell(row, guestCars);
                return '<tr>' + teamCell + '<td>' + esc(dash(row && row.number)) + '</td><td>' + driverCell + '</td></tr>';
              }).join('');
            }
            var headFrec = '<th>' + t('th.team') + '</th><th>' + t('th.no') + '</th><th>' + t('th.driver') + '</th>';
            contentEl.innerHTML = '<div class="table-wrap"><table class="data-table entry-list-table"><thead><tr>' + headFrec + '</tr></thead><tbody>' + buildFrecEntryBody(entryCopy) + '</tbody></table></div>';
            addObjectTableSort(contentEl.querySelector('.data-table'), entryCopy, null, ['team', 'number', 'driver'], function (dataCopy) {
              return buildFrecEntryBody(dataCopy);
            });
            return;
          }
          var isF2OrF3Entry = /^f2_/.test(eventIdLower) || /^f3_/.test(eventIdLower) || (String(d.series || '').toLowerCase().indexOf('formula 2') >= 0) || (String(d.series || '').toLowerCase().indexOf('formula 3') >= 0);
          var hasOnlyNumberTeamDriver = !entryCopy.some(function (e) { return (e.manufacturer != null && String(e.manufacturer).trim() !== '') || (e.constructor != null && String(e.constructor).trim() !== ''); });
          if (isF2OrF3Entry) {
            entryCopy.sort(function (a, b) { var na = parseFloat(a.number); var nb = parseFloat(b.number); if (!isNaN(na) && !isNaN(nb)) return na - nb; return String(a.number || '').localeCompare(String(b.number || '')); });
            function safeTeamStr(r) {
              var v = r && r.team;
              if (v == null) return '';
              if (typeof v === 'string') return v;
              if (typeof v === 'function') return '';
              return String(v);
            }
            function buildF2F3EntryBody(arr) {
              var spans = [];
              for (var ei = 0; ei < arr.length; ei++) {
                var teamVal = safeTeamStr(arr[ei]);
                var ts = 1;
                while (ei + ts < arr.length && safeTeamStr(arr[ei + ts]) === teamVal) ts++;
                spans.push(ts);
              }
              return arr.map(function (row, idx) {
                var driverCell = G.renderDriverCell(row.driver);
                var teamDisplay = safeTeamStr(row);
                var isFirstInTeam = (idx === 0 || safeTeamStr(arr[idx - 1]) !== teamDisplay);
                var teamCell = (isFirstInTeam && spans[idx] > 0)
                  ? '<td rowspan="' + spans[idx] + '" class="entry-list-team-cell">' + (teamDisplay ? G.teamLink(teamDisplay) : '—') + '</td>'
                  : '';
                return '<tr><td>' + esc(dash(row.number)) + '</td>' + teamCell + '<td>' + driverCell + '</td></tr>';
              }).join('');
            }
            var headF2F3 = '<th>' + t('th.no') + '</th><th>' + t('th.team') + '</th><th>' + t('th.driver') + '</th>';
            contentEl.innerHTML = '<div class="table-wrap"><table class="data-table entry-list-table"><thead><tr>' + headF2F3 + '</tr></thead><tbody>' + buildF2F3EntryBody(entryCopy) + '</tbody></table></div>';
            addObjectTableSort(contentEl.querySelector('.data-table'), entryCopy, null, ['number', 'team', 'driver'], function (dataCopy) {
              return buildF2F3EntryBody(dataCopy);
            });
            return;
          }
          var seriesLower = (seriesId || '').toLowerCase();
          var isIndyCar = seriesLower === 'indycar'
            || (String(d.series || '').toLowerCase().indexOf('indycar') >= 0)
            || /^indycar_/.test((d.event_id || '').toLowerCase());
          var isSuperFormulaEntry = seriesLower === 'super_formula'
            || (String(d.series || '').toLowerCase().indexOf('super formula') >= 0)
            || /^super_formula_/.test((d.event_id || '').toLowerCase());
          var isSupercarsEntry = seriesLower === 'supercars';
          var isDtmEntry = seriesLower === 'dtm';
          if (isSupercarsEntry) {
            entryCopy = G.expandSupercarsSubstituteEntryRows(entryCopy);
          }
          var isF1Entry = seriesLower === 'f1' || (String(d.series || '').toLowerCase().indexOf('formula 1') >= 0);
          // IndyCar: No., Driver, Team, Engine. DTM/Supercars: No., Driver, Team, Car/Manufacturer. Stock car: No., Driver, Team, Manufacturer, Crew chief. Others (F1, etc.): No., Driver, Manufacturer, Chassis.
          var head = (isIndyCar || isSuperFormulaEntry)
            ? '<th>' + t('th.no') + '</th><th>' + t('th.driver') + '</th><th>' + t('th.team') + '</th><th>' + t('th.engine') + '</th>' + (isStockCar ? '<th>' + t('th.crew_chief') + '</th>' : '')
            : isDtmEntry
              ? '<th>' + t('th.no') + '</th><th>' + t('th.driver') + '</th><th>' + t('th.team') + '</th><th>' + t('th.car') + '</th>'
            : isSupercarsEntry
              ? '<th>' + t('th.no') + '</th><th>' + t('th.driver') + '</th><th>' + t('th.team') + '</th><th>' + t('th.manufacturer') + '</th>' + (isStockCar ? '<th>' + t('th.crew_chief') + '</th>' : '')
              : isStockCar
                ? '<th>' + t('th.no') + '</th><th>' + t('th.driver') + '</th><th>' + t('th.team') + '</th><th>' + t('th.manufacturer') + '</th><th>' + t('th.crew_chief') + '</th>'
                : '<th>' + t('th.no') + '</th><th>' + t('th.driver') + '</th><th>' + t('th.manufacturer') + '</th><th>' + t('th.chassis') + '</th>';
          function safeTeamStr(v) {
            if (v == null) return '';
            if (typeof v === 'string') return v.trim();
            if (typeof v === 'object' && v !== null && typeof v.name === 'string') return v.name.trim();
            return '';
          }
          function getTeamDisplay(r) {
            var t = safeTeamStr(r.team);
            if (byNumber && r.number != null && typeof byNumber === 'object' && byNumber !== null) {
              var num = String(r.number).trim();
              var v = byNumber[num] || (num ? byNumber[String(parseInt(num, 10))] : undefined);
              if (typeof v === 'string' && v.trim()) t = v.trim();
            }
            return t;
          }
          function getManufacturerDisplay(r) {
            var c = r.constructor;
            if (typeof c === 'string' && c.trim() !== '') return c.trim();
            var m = r.manufacturer;
            if (m != null && typeof m === 'string') return m.trim();
            if (m != null) return String(m);
            return '';
          }
          function getChassisDisplay(r) {
            var manu = (r.manufacturer != null ? String(r.manufacturer).trim() : '');
            return manu || (r.car != null ? String(r.car) : '');
          }
          function getEngineDisplay(r) {
            return (r.manufacturer != null ? String(r.manufacturer) : '') || (r.engine != null ? String(r.engine) : '');
          }
          function renderEntryDriversCell(row) {
            var names = [];
            function addName(v) {
              var raw = (v == null) ? '' : String(v).trim();
              if (!raw || raw === '-') return;
              if (/^tbc$/i.test(raw)) return;
              names.push(raw);
            }
            addName(row && row.driver);
            ['driver1', 'driver2', 'driver3', 'driver4'].forEach(function (k) {
              addName(row && row[k]);
            });
            if (row && Array.isArray(row.drivers)) {
              row.drivers.forEach(function (v) { addName(v); });
            }
            // De-duplicate while preserving order.
            var seen = {};
            names = names.filter(function (name) {
              var key = String(name).toLowerCase();
              if (seen[key]) return false;
              seen[key] = true;
              return true;
            });
            if (!names.length) return '—';
            return names.map(function (name) { return G.renderDriverCell(name); }).join(' / ');
          }
          function getCarDisplay(r) {
            if (r && r.car != null && String(r.car).trim() !== '') return String(r.car).trim();
            return getManufacturerDisplay(r);
          }
          // F1, IndyCar, Super Formula, DTM: default sort by team, then number
          if (isF1Entry || isIndyCar || isSuperFormulaEntry || isDtmEntry) {
            entryCopy.sort(function (a, b) {
              var ta = getTeamDisplay(a).toLowerCase();
              var tb = getTeamDisplay(b).toLowerCase();
              if (ta < tb) return -1;
              if (ta > tb) return 1;
              var na = (a.number != null ? String(a.number) : '');
              var nb = (b.number != null ? String(b.number) : '');
              return na.localeCompare(nb, undefined, { numeric: true });
            });
          }
    
          var entryRowFn = function (row) {
            var driverCell = renderEntryDriversCell(row);
            var teamDisplay = getTeamDisplay(row);
            var teamCell = teamDisplay ? G.teamLink(teamDisplay) : '—';
            if (isIndyCar || isSuperFormulaEntry) {
              var engineDisplay = getEngineDisplay(row);
              var cells = '<td>' + esc(dash(row.number)) + '</td><td>' + driverCell + '</td><td>' + teamCell + '</td><td>' + esc(dash(engineDisplay)) + '</td>';
            } else if (isDtmEntry) {
              var carDisplay = getCarDisplay(row);
              var cells = '<td>' + esc(dash(row.number)) + '</td><td>' + driverCell + '</td><td>' + teamCell + '</td><td>' + esc(dash(carDisplay)) + '</td>';
            } else if (isSupercarsEntry) {
              var manufacturerDisplay = getManufacturerDisplay(row);
              var cells = '<td>' + esc(dash(row.number)) + '</td><td>' + driverCell + '</td><td>' + teamCell + '</td><td>' + esc(dash(manufacturerDisplay)) + '</td>';
            } else if (isStockCar) {
              var manufacturerDisplay = getManufacturerDisplay(row);
              var cells = '<td>' + esc(dash(row.number)) + '</td><td>' + driverCell + '</td><td>' + teamCell + '</td><td>' + esc(dash(manufacturerDisplay)) + '</td><td>' + (row.crew_chief ? '<a href="/crew-chief/' + encodeURIComponent(slugify(row.crew_chief)) + '" class="track-link">' + esc(row.crew_chief) + '</a>' : '—') + '</td>';
            } else {
              var manufacturerDisplay = getManufacturerDisplay(row);
              var chassisDisplay = getChassisDisplay(row);
              var cells = '<td>' + esc(dash(row.number)) + '</td><td>' + driverCell + '</td><td>' + esc(dash(manufacturerDisplay)) + '</td><td>' + esc(dash(chassisDisplay)) + '</td>';
            }
            return '<tr>' + cells + '</tr>';
          };
          var manufacturerSpans = [];
          var chassisSpans = [];
          var teamSpans = [];
          var engineSpans = [];
          var carSpans = [];
          if (!isStockCar) {
            for (var ei = 0; ei < entryCopy.length; ei++) {
              var r = entryCopy[ei];
              if (isIndyCar || isSuperFormulaEntry) {
                var teamDisp = getTeamDisplay(r);
                var engDisp = getEngineDisplay(r);
                var tSpan = 1;
                while (ei + tSpan < entryCopy.length && getTeamDisplay(entryCopy[ei + tSpan]) === teamDisp) tSpan++;
                teamSpans.push(tSpan);
                // Merge by engine only within same team
                var eSpan = 1;
                while (ei + eSpan < entryCopy.length && getTeamDisplay(entryCopy[ei + eSpan]) === teamDisp && getEngineDisplay(entryCopy[ei + eSpan]) === engDisp) eSpan++;
                engineSpans.push(eSpan);
              } else if (isDtmEntry) {
                var teamDisp = getTeamDisplay(r);
                var carDisp = getCarDisplay(r);
                var tSpan = 1;
                while (ei + tSpan < entryCopy.length && getTeamDisplay(entryCopy[ei + tSpan]) === teamDisp) tSpan++;
                teamSpans.push(tSpan);
                // Merge Car only within same team.
                var cSpan = 1;
                while (ei + cSpan < entryCopy.length && getTeamDisplay(entryCopy[ei + cSpan]) === teamDisp && getCarDisplay(entryCopy[ei + cSpan]) === carDisp) cSpan++;
                carSpans.push(cSpan);
              } else if (isSupercarsEntry) {
                var teamDisp = getTeamDisplay(r);
                var manuDisp = getManufacturerDisplay(r);
                var tSpan = 1;
                while (ei + tSpan < entryCopy.length && getTeamDisplay(entryCopy[ei + tSpan]) === teamDisp) tSpan++;
                teamSpans.push(tSpan);
                // merge by manufacturer only within same team
                var manuSpan = 1;
                while (ei + manuSpan < entryCopy.length && getTeamDisplay(entryCopy[ei + manuSpan]) === teamDisp && getManufacturerDisplay(entryCopy[ei + manuSpan]) === manuDisp) manuSpan++;
                manufacturerSpans.push(manuSpan);
              } else {
                var manuDisp = getManufacturerDisplay(r);
                var chDisp = getChassisDisplay(r);
                var manuSpan = 1;
                while (ei + manuSpan < entryCopy.length && getManufacturerDisplay(entryCopy[ei + manuSpan]) === manuDisp) manuSpan++;
                manufacturerSpans.push(manuSpan);
                var chSpan = 1;
                while (ei + chSpan < entryCopy.length && getChassisDisplay(entryCopy[ei + chSpan]) === chDisp) chSpan++;
                chassisSpans.push(chSpan);
              }
            }
          }
          var entryRowDisplayFn = function (row, idx, arr) {
            var driverCell = renderEntryDriversCell(row);
            if (isIndyCar || isSuperFormulaEntry) {
              var teamDisplay = getTeamDisplay(row);
              var engineDisplay = getEngineDisplay(row);
              var tSpan = teamSpans[idx] || 1;
              var eSpan = engineSpans[idx] || 1;
              var isFirstTeam = (idx === 0 || getTeamDisplay(arr[idx - 1]) !== teamDisplay);
              var isFirstEngine = (idx === 0 || getTeamDisplay(arr[idx - 1]) !== teamDisplay || getEngineDisplay(arr[idx - 1]) !== engineDisplay);
              var teamCell = isFirstTeam && tSpan > 0
                ? '<td rowspan="' + tSpan + '" class="entry-list-team-cell">' + (teamDisplay ? G.teamLink(teamDisplay) : '—') + '</td>'
                : '';
              var engineCell = isFirstEngine && eSpan > 0
                ? '<td rowspan="' + eSpan + '">' + esc(dash(engineDisplay)) + '</td>'
                : '';
              return '<tr><td>' + esc(dash(row.number)) + '</td><td>' + driverCell + '</td>' + teamCell + engineCell + '</tr>';
            }
            if (isDtmEntry) {
              var teamDisplay = getTeamDisplay(row);
              var carDisplay = getCarDisplay(row);
              var tSpan = teamSpans[idx] || 1;
              var cSpan = carSpans[idx] || 1;
              var isFirstTeam = (idx === 0 || getTeamDisplay(arr[idx - 1]) !== teamDisplay);
              var isFirstCar = (idx === 0 || getTeamDisplay(arr[idx - 1]) !== teamDisplay || getCarDisplay(arr[idx - 1]) !== carDisplay);
              var teamCell = isFirstTeam && tSpan > 0
                ? '<td rowspan="' + tSpan + '" class="entry-list-team-cell">' + (teamDisplay ? G.teamLink(teamDisplay) : '—') + '</td>'
                : '';
              var carCell = isFirstCar && cSpan > 0
                ? '<td rowspan="' + cSpan + '" class="entry-list-team-cell">' + esc(dash(carDisplay)) + '</td>'
                : '';
              return '<tr><td>' + esc(dash(row.number)) + '</td><td>' + driverCell + '</td>' + teamCell + carCell + '</tr>';
            }
            if (isSupercarsEntry) {
              var teamDisplay = getTeamDisplay(row);
              var manufacturerDisplay = getManufacturerDisplay(row);
              var tSpan = teamSpans[idx] || 1;
              var manuSpan = manufacturerSpans[idx] || 1;
              var isFirstTeam = (idx === 0 || getTeamDisplay(arr[idx - 1]) !== teamDisplay);
              var isFirstManu = (idx === 0 || getTeamDisplay(arr[idx - 1]) !== teamDisplay || getManufacturerDisplay(arr[idx - 1]) !== manufacturerDisplay);
              var teamCell = isFirstTeam && tSpan > 0
                ? '<td rowspan="' + tSpan + '" class="entry-list-team-cell">' + (teamDisplay ? G.teamLink(teamDisplay) : '—') + '</td>'
                : '';
              var manufacturerCell = isFirstManu && manuSpan > 0
                ? '<td rowspan="' + manuSpan + '" class="entry-list-team-cell">' + esc(dash(manufacturerDisplay)) + '</td>'
                : '';
              var driverCell = G.renderDriverCell(row && row.driver);
              var subSize = row && row._substituteGroupSize;
              var subIdx = row && row._substituteGroupIndex;
              var numberCell;
              if (subSize > 1) {
                numberCell = subIdx === 0
                  ? '<td rowspan="' + subSize + '" class="col-num">' + esc(dash(row.number)) + '</td>'
                  : '';
              } else {
                numberCell = '<td class="col-num">' + esc(dash(row.number)) + '</td>';
              }
              return '<tr>' + numberCell + '<td>' + driverCell + '</td>' + teamCell + manufacturerCell + '</tr>';
            }
            var manufacturerDisplay = getManufacturerDisplay(row);
            var chassisDisplay = getChassisDisplay(row);
            var manuSpan = manufacturerSpans[idx] || 1;
            var chSpan = chassisSpans[idx] || 1;
            var isFirstManu = (idx === 0 || getManufacturerDisplay(arr[idx - 1]) !== manufacturerDisplay);
            var isFirstChassis = (idx === 0 || getChassisDisplay(arr[idx - 1]) !== chassisDisplay);
            var manufacturerCell = isFirstManu && manuSpan > 0
              ? '<td rowspan="' + manuSpan + '" class="entry-list-team-cell">' + esc(dash(manufacturerDisplay)) + '</td>'
              : '';
            var chassisCell = isFirstChassis && chSpan > 0
              ? '<td rowspan="' + chSpan + '">' + esc(dash(chassisDisplay)) + '</td>'
              : '';
            return '<tr><td>' + esc(dash(row.number)) + '</td><td>' + driverCell + '</td>' + manufacturerCell + chassisCell + '</tr>';
          };
          var bodyHtml = isStockCar
            ? entryCopy.map(entryRowFn).join('')
            : entryCopy.map(function (row, idx, arr) { return entryRowDisplayFn(row, idx, arr); }).join('');
          contentEl.innerHTML = '<div class="table-wrap"><table class="data-table entry-list-table"><thead><tr>' + head + '</tr></thead><tbody>' + bodyHtml + '</tbody></table></div>';
          var entryKeys = isStockCar ? ['number', 'driver', 'team', 'manufacturer', 'crew_chief'] : ((isIndyCar || isSuperFormulaEntry || isSupercarsEntry || isDtmEntry) ? ['number', 'driver', 'team', 'car', 'manufacturer'] : ['number', 'driver', 'constructor', 'manufacturer']);
          if (!isSuperFormulaEntry) {
            addObjectTableSort(contentEl.querySelector('.data-table'), entryCopy, entryRowFn, entryKeys);
          }
          return;
  }

  window.TGA.renderEntryListSection = renderEntryListSection;
})();
