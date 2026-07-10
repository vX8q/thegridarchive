// Event page — Race tab (extracted from event.js)
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  window.TGA = window.TGA || {};

  function buildTeamNamesByNumberFromEntryList(entryList) {
    var map = {};
    if (!entryList || !entryList.length) return map;
    for (var i = 0; i < entryList.length; i++) {
      var e = entryList[i];
      var num = e.number != null ? String(e.number).trim() : '';
      if (num === '') continue;
      var team = (e.team != null && String(e.team).trim() !== '') ? String(e.team).trim() : '';
      map[num] = team;
      var parsed = parseInt(num, 10);
      if (!isNaN(parsed)) map[String(parsed)] = team;
    }
    return map;
  }

  function buildSessionMetaTable(meta) {
    if (!meta || typeof meta !== 'object') return '';
    var esc = window.TGA.pageDeps().esc;
    var order = ['Date', 'Time', 'Race day', 'Length', 'Session', 'Start'];
    var keys = order.filter(function (k) { return meta.hasOwnProperty(k) && meta[k] != null && String(meta[k]).trim() !== ''; });
    var extra = Object.keys(meta).filter(function (k) {
      if (k === 'Championship') return false;
      if (keys.indexOf(k) >= 0) return false;
      return meta[k] != null && String(meta[k]).trim() !== '';
    });
    extra.sort();
    keys = keys.concat(extra);
    if (!keys.length) return '';
    var head = keys.map(function (k) { return '<th>' + esc(k) + '</th>'; }).join('');
    var vals = keys.map(function (k) { return '<td>' + esc(String(meta[k]).trim()) + '</td>'; }).join('');
    return '<h4 class="table-section-title">Session info</h4>' +
      '<div class="table-wrap event-pre-season-meta-wrap">' +
      '<table class="data-table table-field-value session-meta-table session-meta-table--horizontal">' +
      '<thead><tr>' + head + '</tr></thead><tbody><tr>' + vals + '</tr></tbody></table></div>';
  }

  function renderRaceContent(d, contentEl) {
    var G = window.TGA;
    var P = G.pageDeps();
    var esc = P.esc;
    var t = P.t;
    var localizeSectionTitle = P.localizeSectionTitle;
    var localizeCompoundLegend = P.localizeCompoundLegend;
    var makeTableSortable = function () { return P.makeTableSortable.apply(null, arguments); };
        var tables = (d && d.tables && typeof d.tables === 'object') ? d.tables
          : (d && d.Tables && typeof d.Tables === 'object') ? d.Tables
          : {};
        var html = '';
        var sortQueue = [];
    
        var seriesId = G.eventSeriesId(d.event_id || '');
        var seriesIdLower = (seriesId || '').toLowerCase();
        var isSupercars = G.isSupercarsSeriesId(seriesIdLower);
        var isStockCarSeriesRace = G.isStockCarSeriesId(seriesIdLower);
        var isNascarModified = seriesIdLower === 'nascar_modified';
        var evKeyEvent = ((d.event_id || '') + '').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
        var isImsaChampionshipRound = /^IMSA_\d{4}_\d+$/.test(evKeyEvent);
        function normalizeRaceEngineColumns(tableData) {
          if (!tableData || !Array.isArray(tableData.headers) || !Array.isArray(tableData.rows)) return tableData;
          if ((seriesId || '').toUpperCase() !== 'SUPER_FORMULA') return tableData;
          var engineIdx = -1;
          for (var hi = 0; hi < tableData.headers.length; hi++) {
            if (String(tableData.headers[hi] || '').trim().toLowerCase() === 'engine') {
              engineIdx = hi;
              break;
            }
          }
          if (engineIdx < 0) return tableData;
          var rows = tableData.rows.map(function (r) {
            var row = Array.isArray(r) ? r.slice() : [];
            if (engineIdx >= row.length) return row;
            var s = String(row[engineIdx] == null ? '' : row[engineIdx]).trim();
            var u = s.toUpperCase();
            if (u.indexOf('HONDA') >= 0 || u.indexOf('HR-417E') >= 0) row[engineIdx] = 'Honda HR-417E';
            else if (u.indexOf('TOYOTA') >= 0 || u.indexOf('TRD01F') >= 0 || u.indexOf('TRD-01F') >= 0) row[engineIdx] = 'Toyota TRD-01F';
            return row;
          });
          return { headers: tableData.headers.slice(), rows: rows };
        }
        var byNumber = (isStockCarSeriesRace && d.entry_list && d.entry_list.length)
          ? G.buildTeamNamesByNumberFromEntryList(d.entry_list)
          : (d.team_names_by_number && typeof d.team_names_by_number === 'object' ? d.team_names_by_number : null);
        function applyTeamNameByNumber(rows, numberColIdx, teamColIdx) {
          if (!byNumber) return rows;
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
        // Temporarily disable Grid/Pos special columns (arrows) in races
        var enableGridDelta = false;
    
        function renderOneRaceSession(sess, eventData) {
          var out = '';
          var titleText = G.localizeF1RaceSessionTitle(sess && sess.title ? String(sess.title) : '', evKeyEvent);
          var hasRaceResultRows = sess && Array.isArray(sess.rows) && sess.rows.length > 0;
          var skipVenueSubtitle = G.shouldSkipOpenwheelRaceVenueSubtitle(seriesIdLower);
          var isSuperGtClassTitle = G.isSuperGtRaceClassTitle(seriesIdLower, titleText);
          var isF1Event = evKeyEvent && evKeyEvent.indexOf('F1_') === 0;
          var skipSessionMetaTable = seriesIdLower === 'gtwce_end' || seriesIdLower === 'gtwce_sprint';
          if (isSuperGtClassTitle) {
            if (!isImsaChampionshipRound && seriesIdLower !== 'f2' && !isF1Event && !skipSessionMetaTable) {
              out += buildSessionMetaTable(sess.meta);
            }
            if (titleText && hasRaceResultRows) out += '<h3 class="event-pre-season-title">' + esc(localizeSectionTitle(titleText)) + '</h3>';
            if (!skipVenueSubtitle && sess.subtitle) out += '<p class="event-pre-season-subtitle">' + esc(sess.subtitle) + '</p>';
          } else {
            if (titleText && hasRaceResultRows) out += '<h3 class="event-pre-season-title">' + esc(localizeSectionTitle(titleText)) + '</h3>';
            if (!skipVenueSubtitle && sess.subtitle) out += '<p class="event-pre-season-subtitle">' + esc(sess.subtitle) + '</p>';
            if (!isImsaChampionshipRound && seriesIdLower !== 'f2' && !isF1Event && !skipSessionMetaTable) {
              out += buildSessionMetaTable(sess.meta);
            }
          }
          if (sess.headers && Array.isArray(sess.rows)) {
            var h = sess.headers;
            var raceRows;
            var raceHeaders;
    
            if (isSupercars && Array.isArray(h) && h.length >= 8) {
              var scRace = G.transformSupercarsRaceTable(h, sess.rows || [], byNumber);
              raceRows = scRace.rows;
              raceHeaders = scRace.headers;
            } else {
              // Other series/races — team lookup by car number only
              var teamColIdxRace = (evKeyEvent && (evKeyEvent.indexOf('GTWCE_END_') === 0 || evKeyEvent.indexOf('GTWCE_SPRINT_') === 0)) ? 4 : 3;
              raceRows = applyTeamNameByNumber((sess.rows || []), 1, teamColIdxRace);
              raceHeaders = (sess.headers || []).slice();
              // IMSA: split TEAM/CAR, ST POS from qual, class points
              if (seriesIdLower === 'imsa' && raceHeaders.length > 0) {
                var qualRowsForImsa = (eventData && eventData.tables && eventData.tables.qualifying && Array.isArray(eventData.tables.qualifying.rows))
                  ? eventData.tables.qualifying.rows
                  : null;
                var imsaTransformed = G.transformImsaRaceTable(raceHeaders, raceRows, qualRowsForImsa);
                raceHeaders = imsaTransformed.headers;
                raceRows = imsaTransformed.rows;
              }
            }
    
            if (evKeyEvent && evKeyEvent.indexOf('F1_') === 0) {
              var f1GridNorm = G.normalizeF1RaceGridColumn({ headers: raceHeaders, rows: raceRows });
              raceHeaders = f1GridNorm.headers;
              raceRows = f1GridNorm.rows;
            }

            // For all F1 events: empty points and laps led in race table shown as 0.
            if (evKeyEvent && evKeyEvent.indexOf('F1_') === 0 && Array.isArray(raceHeaders) && Array.isArray(raceRows)) {
              var ptsIdx = -1;
              var lapsLedIdx = -1;
              for (var ni = 0; ni < raceHeaders.length; ni++) {
                var nh = String(raceHeaders[ni] || '').toLowerCase();
                if (nh.indexOf('pts') >= 0 || nh.indexOf('points') >= 0) ptsIdx = ni;
                if (nh.indexOf('laps led') >= 0) lapsLedIdx = ni;
              }
              if (ptsIdx >= 0 || lapsLedIdx >= 0) {
                raceRows = raceRows.map(function (row) {
                  var r = row.slice();
                  if (ptsIdx >= 0 && ptsIdx < r.length && (r[ptsIdx] == null || String(r[ptsIdx]).trim() === '')) r[ptsIdx] = '0';
                  if (lapsLedIdx >= 0 && lapsLedIdx < r.length && (r[lapsLedIdx] == null || String(r[lapsLedIdx]).trim() === '')) r[lapsLedIdx] = '0';
                  return r;
                });
              }
            }
    
            if (raceRows.length > 0) {
              // For all F1 events do not show separate "Results" heading (already in session title).
              if (!evKeyEvent || evKeyEvent.indexOf('F1_') !== 0) {
                out += '<h4 class="table-section-title">Results</h4>';
              }
              var raceTbl = { headers: raceHeaders, rows: raceRows };
              raceTbl = G.normalizeFinStTable(raceTbl);
              raceTbl = normalizeRaceEngineColumns(raceTbl);
              raceTbl = G.dropTouringRaceDisplayColumns(raceTbl, seriesIdLower, evKeyEvent);
              // F1, 10 columns (like race_results on F1_2026_3): same look as "Race Results" —
              // .race-results-table + fixed colgroup, not .pre-season-results-table.
              // IMSA: reference race table layout — `/event/imsa-2026-1/race` (body.series-imsa … race-session-results-table in style.css).
              var raceSessTableClass = 'pre-season-results-table race-session-results-table';
              var raceSessColWidths = null;
              if (G.isF4SeriesId(seriesIdLower)) {
                raceSessTableClass = 'race-starting-lineup-table f4-race-results-table';
              } else if (evKeyEvent && evKeyEvent.indexOf('F1_') === 0 && raceHeaders.length === 10) {
                raceSessTableClass = 'race-results-table';
                raceSessColWidths = raceResultsWidths10;
              }
              if (evKeyEvent && (evKeyEvent.indexOf('GTWCE_END_') === 0 || evKeyEvent.indexOf('GTWCE_SPRINT_') === 0)) raceSessTableClass += ' gtwce-race-results-table';
              var raceResult = G.buildTableSection(null, raceTbl, raceSessTableClass, null, raceSessColWidths);
              if (raceResult) { out += raceResult.html; sortQueue.push({ rows: raceResult.rows, getRowClass: raceResult.getRowClass }); }
            }
          }
          if (sess && sess.vsc && Array.isArray(sess.vsc.rows) && sess.vsc.rows.length > 0) {
            var sessVscTitle = (sess.vsc.title && String(sess.vsc.title).trim())
              ? String(sess.vsc.title).trim()
              : ((typeof t === 'function' && t('table.vsc')) ? t('table.vsc') : 'Race neutralisation');
            var sessVscTable = {
              headers: Array.isArray(sess.vsc.headers) && sess.vsc.headers.length ? sess.vsc.headers : ['Type', 'Laps'],
              rows: sess.vsc.rows
            };
            var vscResult = G.buildTableSection(sessVscTitle, sessVscTable, 'vsc-table', null);
            if (vscResult) { out += vscResult.html; sortQueue.push({ rows: vscResult.rows, getRowClass: vscResult.getRowClass }); }
          }
          if (sess && Array.isArray(sess.note_lines) && sess.note_lines.length > 0) {
            var raceNoteHtml = sess.note_lines
              .map(function (line) { return String(line == null ? '' : line).trim(); })
              .filter(function (line) { return line !== ''; })
              .map(function (line) { return esc(line); })
              .join('<br>');
            if (raceNoteHtml) out += '<p class="race-note">' + raceNoteHtml + '</p>';
          } else if (sess && typeof sess.note === 'string' && sess.note.trim()) {
            out += '<p class="race-note">' + esc(sess.note.trim()) + '</p>';
          }
          return out;
        }
    
        var stagePointsWidths = ['4%', '4%', '22%', '34%', '16%', '10%'];
        var stageNotesWidths  = ['4%', '4%', '22%', '34%', '14%', '22%'];
        var raceResultsWidths8  = ['5%', '5%', '4%', '22%', '36%', '14%', '8%', '8%'];
        var raceResultsWidths10 = ['5%', '4%', '4%', '18%', '24%', '6%', '12%', '6%', '12%', '6%'];
    
        function add(title, data, cssClass, getRowClass, colWidths, subtitle, titleClass, mergeTeamCells) {
          var r = G.buildTableSection(title, data, cssClass, getRowClass, colWidths, subtitle, titleClass, mergeTeamCells);
          if (!r) return;
          html += r.html;
          sortQueue.push(r);
        }
    
        var rrAllstar = tables.race_results;
        var isAllstarStageRaceEvent = G.isAllstarStageRace(tables);
    
        function isAllstarStageSeparatorRow(row) {
          if (!row || row.length === 0) return false;
          if (row[0] == null || String(row[0]).trim() === '') return false;
          for (var i = 1; i < row.length; i++) { if (row[i] != null && String(row[i]).trim() !== '') return false; }
          return true;
        }
        function allstarTeamColIdx(headers) {
          for (var i = 0; i < headers.length; i++) {
            if (String(headers[i] || '').trim().toLowerCase() === 'team') return i;
          }
          return 3;
        }
        function allstarNumberColIdx(headers) {
          for (var i = 0; i < headers.length; i++) {
            var h = String(headers[i] || '').trim().toLowerCase();
            if (h === 'no' || h === 'no.') return i;
          }
          return 1;
        }
        function renderAllstarStageRace(stage) {
          var headers = stage.headers || [];
          var numCol = allstarNumberColIdx(headers);
          var teamCol = allstarTeamColIdx(headers);
          var rows = applyTeamNameByNumber((stage.rows || []).slice(), numCol, teamCol);
          var parts = [], sepTexts = [], cur = [];
          rows.forEach(function (row) {
            if (isAllstarStageSeparatorRow(row)) {
              if (cur.length) { parts.push(cur); cur = []; }
              sepTexts.push(String(row[0]).trim());
            } else { cur.push(row); }
          });
          if (cur.length) parts.push(cur);
          var stageTitle = String(stage.title || '').trim();
          if (stage.laps) stageTitle = stageTitle + ' Laps: ' + stage.laps;
          parts.forEach(function (part, pi) {
            if (pi > 0 && sepTexts[pi - 1]) {
              html += '<p class="race-starting-lineup-separator allstar-stage-separator">' + esc(sepTexts[pi - 1]) + '</p>';
            }
            if (pi === 0 && stageTitle) {
              html += '<h3 class="event-pre-season-title">' + esc(stageTitle) + '</h3>';
            }
            add('', { headers: headers, rows: part }, 'race-starting-lineup-table allstar-stage-table', null, null, null, null, false);
          });
        }
        if (isAllstarStageRaceEvent) {
          var allstarTitle = (rrAllstar.title && String(rrAllstar.title).trim()) ? localizeSectionTitle(String(rrAllstar.title).trim()) : t('table.stage_results');
          html += '<h2 class="race-section-title">' + esc(allstarTitle) + '</h2>';
          rrAllstar.stages.forEach(function (stage) { renderAllstarStageRace(stage); });
        }
    
        var hideStartingLineupOnRace = G.shouldHideStartingLineupOnRaceTab(seriesIdLower);
        var slSessions = (!hideStartingLineupOnRace && tables.starting_lineup && Array.isArray(tables.starting_lineup.sessions)) ? tables.starting_lineup.sessions : [];
        var slFlat = !hideStartingLineupOnRace && tables.starting_lineup && tables.starting_lineup.headers && Array.isArray(tables.starting_lineup.rows) && tables.starting_lineup.rows.length > 0;
    
        var raceBlock = tables.race;
        // Whelen Modified: race result only in race_results (like NASCAR_MODIFIED_2026_1), no tables.race duplicate.
        if (isNascarModified && tables.race_results && Array.isArray(tables.race_results.rows) && tables.race_results.rows.length > 0) {
          raceBlock = null;
        }
        var penaltiesAndVscAddedAfterSprint = false;
        if (raceBlock && Array.isArray(raceBlock.sessions) && raceBlock.sessions.length > 0) {
          var raceSessionsDisplay = G.visibleRaceSessionsForDisplay(raceBlock, seriesIdLower);
          if (raceSessionsDisplay.length > 0) {
          html += '<div class="event-pre-season-block">';
          raceSessionsDisplay.forEach(function (sess, idx) {
            if (idx > 0) html += '<hr class="event-pre-season-divider">';
            // Starting Grid N before Race N
            var slSess = slSessions[idx];
            if (slSess && slSess.headers && Array.isArray(slSess.rows) && slSess.rows.length > 0) {
              var raceNo = slSess.meta && slSess.meta.race_no != null ? slSess.meta.race_no : idx + 1;
              var slTitle = (slSess.title && String(slSess.title).trim())
                ? String(slSess.title).trim()
                : (t('table.starting_lineup') + ' — Race ' + raceNo);
              var slRows = applyTeamNameByNumber(slSess.rows.slice(), 1, 3);
              add(slTitle, { headers: slSess.headers, rows: slRows }, 'race-starting-lineup-table', null, null, null, 'table-section-title--starting-grid-race', false);
            }
            html += renderOneRaceSession(sess, d);
            // Penalties and neutralization tables — directly under sprint result table.
            var sessTitleLc = (sess && sess.title && String(sess.title).toLowerCase().trim()) || '';
            if (sessTitleLc.indexOf('sprint') >= 0) {
              // For sprint try separate *_sprint tables first.
              var sprintPenaltiesTable       = tables.penalties_sprint || null;
              var sprintPenaltiesAfterTable  = tables.penalties_sprint_after || null;
              var sprintVscTable             = tables.vsc_sprint || null;
              var usedSprintSpecificTables   = sprintPenaltiesTable || sprintPenaltiesAfterTable || sprintVscTable;
    
              if (sprintPenaltiesTable && sprintPenaltiesTable.rows && sprintPenaltiesTable.rows.length > 0) {
                add((typeof t === 'function' && t('table.penalties')) ? t('table.penalties') : 'Penalties during the race', sprintPenaltiesTable, 'penalties-table', null, null, null, null, false);
              }
              if (sprintPenaltiesAfterTable && sprintPenaltiesAfterTable.rows && sprintPenaltiesAfterTable.rows.length > 0) {
                add(t('table.penalties_after'), sprintPenaltiesAfterTable, 'penalties-table penalties-table--after', null, null, null, null, false);
              }
              if (sprintVscTable && sprintVscTable.rows && sprintVscTable.rows.length > 0) {
                var vscSprintTitle = (sprintVscTable.title && String(sprintVscTable.title).trim())
                  ? sprintVscTable.title
                  : ((typeof t === 'function' && t('table.vsc')) ? t('table.vsc') : 'Race neutralisation');
                add(vscSprintTitle, { headers: sprintVscTable.headers || ['Type', 'Laps'], rows: sprintVscTable.rows }, 'vsc-table', null, null, null, null, false);
              }
    
              // If no sprint tables, still use shared penalties / penalties_after / vsc
              // and mark as rendered to avoid duplicating under Race Results.
              if (!usedSprintSpecificTables) {
                if (tables.penalties && tables.penalties.headers && tables.penalties.rows && tables.penalties.rows.length > 0) {
                  add((typeof t === 'function' && t('table.penalties')) ? t('table.penalties') : 'Penalties during the race', tables.penalties, 'penalties-table', null, null, null, null, false);
                }
                if (tables.penalties_after && tables.penalties_after.rows && tables.penalties_after.rows.length > 0) {
                  add(t('table.penalties_after'), tables.penalties_after, 'penalties-table penalties-table--after', null, null, null, null, false);
                }
                if (tables.vsc && tables.vsc.rows && tables.vsc.rows.length > 0) {
                  var vscTitleSprint = (tables.vsc.title && String(tables.vsc.title).trim()) ? tables.vsc.title : ((typeof t === 'function' && t('table.vsc')) ? t('table.vsc') : 'Race neutralisation');
                  add(vscTitleSprint, tables.vsc, 'vsc-table', null, null, null, null, false);
                }
                penaltiesAndVscAddedAfterSprint = true;
              }
            }
          });
          // Grids without race (e.g. Starting Grid 7 when Race 7 results not yet available)
          for (var j = raceSessionsDisplay.length; j < slSessions.length; j++) {
            var slSess = slSessions[j];
            if (slSess && slSess.headers && Array.isArray(slSess.rows) && slSess.rows.length > 0) {
              html += '<hr class="event-pre-season-divider">';
              var raceNo = slSess.meta && slSess.meta.race_no != null ? slSess.meta.race_no : j + 1;
              var slTitle = (slSess.title && String(slSess.title).trim())
                ? String(slSess.title).trim()
                : (t('table.starting_lineup') + ' — Race ' + raceNo);
              var slRows = applyTeamNameByNumber(slSess.rows.slice(), 1, 3);
              add(slTitle, { headers: slSess.headers, rows: slRows }, 'race-starting-lineup-table', null, null, null, 'table-section-title--starting-grid-race', false);
            }
          }
          html += '</div>';
          }
        } else if (raceBlock && raceBlock.headers && Array.isArray(raceBlock.rows)) {
          html += '<div class="event-pre-season-block">';
          if (slFlat && !isNascarModified) {
            var slRows = applyTeamNameByNumber(tables.starting_lineup.rows.slice(), 1, 3);
            function isStartingLineupSeparator(row) {
              if (!row || row.length === 0) return false;
              if (row[0] == null || String(row[0]).trim() === '') return false;
              for (var i = 1; i < row.length; i++) { if (row[i] != null && String(row[i]).trim() !== '') return false; }
              return true;
            }
            var segments = [], separatorTexts = [], cur = [];
            slRows.forEach(function (row) {
              if (isStartingLineupSeparator(row)) {
                if (cur.length) { segments.push(cur); cur = []; }
                separatorTexts.push(String(row[0]).trim());
              } else { cur.push(row); }
            });
            if (cur.length) segments.push(cur);
            var slHeaders = tables.starting_lineup.headers;
            var timeColIdx = -1;
            for (var hi = 0; hi < slHeaders.length; hi++) {
              if (String(slHeaders[hi] || '').trim().toLowerCase() === 'time') { timeColIdx = hi; break; }
            }
            var slHeadersUse = timeColIdx >= 0 ? slHeaders.slice(0, timeColIdx).concat(slHeaders.slice(timeColIdx + 1)) : slHeaders;
            function dropTimeCol(rows) {
              if (timeColIdx < 0) return rows;
              return rows.map(function (row) { return row.slice(0, timeColIdx).concat(row.slice(timeColIdx + 1)); });
            }
            segments.forEach(function (seg, i) {
              if (i > 0 && separatorTexts[i - 1]) html += '<p class="race-starting-lineup-separator">' + esc(separatorTexts[i - 1]) + '</p>';
              add(i === 0 ? t('table.starting_lineup') : '', { headers: slHeadersUse, rows: dropTimeCol(seg) }, 'race-starting-lineup-table', null, null, null, null, false);
            });
          }
          if (G.isSuperGtSeriesId(seriesIdLower) && Array.isArray(raceBlock.headers) && Array.isArray(raceBlock.rows)) {
            var superGtSessions = G.splitSuperGtRaceBlockByClass(raceBlock);
            if (superGtSessions.length === 1 && superGtSessions[0] === raceBlock) {
              html += renderOneRaceSession(raceBlock, d);
            } else {
              superGtSessions.forEach(function (classSession) {
                html += renderOneRaceSession(classSession, d);
              });
            }
          } else {
            html += renderOneRaceSession(raceBlock, d);
          }
          html += '</div>';
        }
    
        // For stock-car series do not set fixed colWidths so width auto-fits.
        // Race Results section: stage points (1–2, or 1–3 for 4-stage) then full results as final stage.
        var raceResultsFirstStock = !isAllstarStageRaceEvent && isStockCarSeriesRace && tables.race_results && Array.isArray(tables.race_results.rows) && tables.race_results.rows.length > 0;
        var stockCarStageFormat = G.stockCarHasStageFormat(d, tables);
        var eventHasStage4 = G.hasStage4(d, tables);
    
        function appendRaceResultsBlock() {
          var rp = tables.race_points;
          if (rp && Array.isArray(rp.headers) && Array.isArray(rp.rows) && rp.rows.length > 0) {
            var rpTitle = (rp.title != null && String(rp.title).trim()) ? localizeSectionTitle(String(rp.title).trim()) : t('table.points_system');
            add(rpTitle, { headers: rp.headers, rows: rp.rows }, 'wec-race-points-table', null, null, null, null, false);
          }
          var rr = tables.race_results;
          if (rr && typeof rr.intro === 'string' && rr.intro.trim() && ((rr.rows && rr.rows.length > 0) || (Array.isArray(rr.sessions) && rr.sessions.length > 0))) {
            html += '<p class="race-note">' + esc(rr.intro.trim()) + '</p>';
          }
          if (rr && Array.isArray(rr.sessions) && rr.sessions.length > 0) {
            var raceResultsMainTitle = (typeof t === 'function' && t('table.race_results')) ? t('table.race_results') : 'Race Results';
            html += '<h4 class="table-section-title table-section-title--main">' + esc(raceResultsMainTitle) + '</h4>';
            rr.sessions.forEach(function (sess, idx) {
              if (!sess || !Array.isArray(sess.headers) || !Array.isArray(sess.rows) || !sess.rows.length) return;
              if (idx > 0) html += '<hr class="event-pre-season-divider">';
              var sessTitle = (sess.title && String(sess.title).trim()) ? String(sess.title).trim() : raceResultsMainTitle;
              add(sessTitle, { headers: sess.headers, rows: sess.rows }, 'race-results-table', null, null, null, null, false);
            });
            if (d.race_results_note) {
              html += esc(String(d.race_results_note || '').trim());
            }
            return;
          }
          if (rr && rr.rows) {
            var statKeysForFilter = ['Statistic', 'Value', 'Lead changes', 'Cautions / Laps', 'Red flags', 'Time of race', 'Average speed'];
            rr = {
              headers: rr.headers,
              rows: rr.rows.filter(function (row) {
                var p = G.parseStatRow(row);
                if (!p || !p.key) return true;
                var nk = p.key.replace(/\s*\/\s*/g, ' / ').trim();
                return statKeysForFilter.indexOf(nk) < 0;
              })
            };
            // For all F1 events normalize empty points and laps led
            // in race_results table: show 0 instead of empty cell.
            var isF1SeriesForResults = (evKeyEvent && evKeyEvent.indexOf('F1_') === 0);
            if (isF1SeriesForResults) {
              rr = G.normalizeF1RaceGridColumn(rr);
            }
            if (G.isIndycarSeriesId(seriesIdLower) && rr) {
              rr = G.normalizeIndycarRaceTable(rr);
            }
            if (isF1SeriesForResults && Array.isArray(rr.headers) && Array.isArray(rr.rows)) {
              var ptsColIdxRr = -1;
              var lapsLedColIdxRr = -1;
              var bestLapColIdxRr = -1;
              var noColIdxRr = -1;
              var lapsColIdxRr = -1;
              for (var hri = 0; hri < rr.headers.length; hri++) {
                var hh = String(rr.headers[hri] || '').toLowerCase();
                if (hh.indexOf('pts') >= 0 || hh.indexOf('points') >= 0) ptsColIdxRr = hri;
                if (hh.indexOf('laps led') >= 0) lapsLedColIdxRr = hri;
                if (hh === 'best lap') bestLapColIdxRr = hri;
                if (hh === 'no.' || hh === 'no') noColIdxRr = hri;
                if (hh === 'laps') lapsColIdxRr = hri;
              }
              if (ptsColIdxRr >= 0 || lapsLedColIdxRr >= 0) {
                rr = {
                  headers: rr.headers,
                  rows: rr.rows.map(function (row) {
                    var r = row.slice();
                    if (ptsColIdxRr >= 0 && ptsColIdxRr < r.length) {
                      var rawPts = r[ptsColIdxRr];
                      if (rawPts == null || String(rawPts).trim() === '') r[ptsColIdxRr] = '0';
                    }
                    if (lapsLedColIdxRr >= 0 && lapsLedColIdxRr < r.length) {
                      var rawLapsLed = r[lapsLedColIdxRr];
                      if (rawLapsLed == null || String(rawLapsLed).trim() === '') r[lapsLedColIdxRr] = '0';
                    }
                    return r;
                  })
                };
              }
              if (bestLapColIdxRr >= 0 && noColIdxRr >= 0 && tables.best_laps && Array.isArray(tables.best_laps.rows)) {
                var bestLapByNoRr = {};
                tables.best_laps.rows.forEach(function (blRow) {
                  var blNo = blRow[1] != null ? String(blRow[1]).trim() : '';
                  var blTime = blRow[6] != null ? String(blRow[6]).trim() : '';
                  if (blNo && blTime) bestLapByNoRr[blNo] = blTime;
                });
                rr = {
                  headers: rr.headers,
                  rows: rr.rows.map(function (row) {
                    var r = row.slice();
                    if (bestLapColIdxRr >= r.length) return r;
                    if (r[bestLapColIdxRr] != null && String(r[bestLapColIdxRr]).trim() !== '') return r;
                    var carNo = r[noColIdxRr] != null ? String(r[noColIdxRr]).trim() : '';
                    var posRaw = r[0] != null ? String(r[0]).trim() : '';
                    var lapsRaw = lapsColIdxRr >= 0 && lapsColIdxRr < r.length ? r[lapsColIdxRr] : '';
                    var lapsNum = parseInt(String(lapsRaw).trim(), 10);
                    if (/^dns/i.test(posRaw) || lapsNum === 0) return r;
                    if (carNo && bestLapByNoRr[carNo]) r[bestLapColIdxRr] = bestLapByNoRr[carNo];
                    return r;
                  })
                };
              }
            }
          }
          // Do not set colWidths for race_results — cell width auto,
          // except Formula 1 events needing fixed column grid like template.
          var raceResultsSubtitle = (d.stage3_laps ? t('table.stage3') + ' (' + d.stage3_laps + ' ' + t('stage.laps') + ')' : null);
          if (isStockCarSeriesRace) raceResultsSubtitle = null;
          var raceResultsColWidths = null;
          var isF1SeriesForResults2 = (evKeyEvent && evKeyEvent.indexOf('F1_') === 0);
          if (isF1SeriesForResults2 && rr && Array.isArray(rr.headers) && rr.headers.length === 10) {
            raceResultsColWidths = raceResultsWidths10;
          }
          var raceResultsTitle;
          if (isF1SeriesForResults2) {
            raceResultsTitle = (typeof t === 'function' && t('table.race_results')) ? t('table.race_results') : 'Race Results';
          } else if (raceResultsFirstStock) {
            var stockTitles = G.stockCarRaceResultsTitles(d, stockCarStageFormat, eventHasStage4, isStockCarSeriesRace, t);
            raceResultsTitle = stockTitles.title;
            raceResultsSubtitle = stockTitles.subtitle;
          } else {
            raceResultsTitle = (typeof t === 'function' && t('table.race_results')) ? t('table.race_results') : 'Race Results';
          }
          var raceResultsTitleClass = null;
          if (raceResultsSubtitle) {
            raceResultsTitleClass = 'table-section-title--main';
          }
          // F1: single large "Race Results" heading (like Sprint/Race in China 2026)
          // for all events where heading is shown explicitly.
          if (isF1SeriesForResults2 && raceResultsTitle) {
            raceResultsTitleClass = 'table-section-title--starting-grid';
          }
          if (rr && Array.isArray(rr.rows) && rr.rows.length > 0) {
            if (Array.isArray(rr.headers)) {
              var finStIdx = -1;
              for (var fsi = 0; fsi < rr.headers.length; fsi++) {
                var fh = String(rr.headers[fsi] || '').trim().toLowerCase();
                if (fh === 'fin / st' || fh === 'фин / st') { finStIdx = fsi; break; }
              }
              if (finStIdx >= 0) {
                rr = {
                  headers: rr.headers.slice(0, finStIdx).concat(['Fin', 'ST'], rr.headers.slice(finStIdx + 1)),
                  rows: rr.rows.map(function (row) {
                    var r = row.slice();
                    var cell = (finStIdx < r.length && r[finStIdx] != null) ? String(r[finStIdx]).trim() : '';
                    var fin = cell;
                    var st = '';
                    if (cell.indexOf('/') >= 0) {
                      var parts = cell.split('/');
                      fin = String(parts[0] || '').trim();
                      st = String(parts.slice(1).join('/') || '').trim();
                    }
                    if (st) {
                      var sm = st.match(/ST\s*\d+/i);
                      st = sm ? sm[0].replace(/[^0-9]/g, '') : '';
                    }
                    r.splice(finStIdx, 1, fin, st);
                    return r;
                  })
                };
              }
            }
            add(raceResultsTitle, rr, 'race-results-table', null, raceResultsColWidths, raceResultsSubtitle, raceResultsTitleClass, false);
          }
          if (d.race_results_note) {
            html += esc(String(d.race_results_note || '').trim());
          }
        }
    
        if (!isAllstarStageRaceEvent) {
        if (raceResultsFirstStock && stockCarStageFormat) {
          var raceResultsHeading = (typeof t === 'function' && t('table.race_results')) ? t('table.race_results') : 'Race Results';
          html += '<h4 class="table-section-title table-section-title--main">' + esc(raceResultsHeading) + '</h4>';
        }
    
        var stageWidthsForUse = isStockCarSeriesRace ? null : stagePointsWidths;
        if (G.seriesUsesStages(seriesIdLower)) {
          add((d.stage1_laps ? t('table.stage1') + ' (' + d.stage1_laps + ' ' + t('stage.laps') + ')' : t('table.stage1')), G.tgaStageTable(tables, 1), 'race-stage-table race-stage-table--points', null, stageWidthsForUse, null, null, false);
          add((d.stage2_laps ? t('table.stage2') + ' (' + d.stage2_laps + ' ' + t('stage.laps') + ')' : t('table.stage2')), G.tgaStageTable(tables, 2), 'race-stage-table race-stage-table--points', null, stageWidthsForUse, null, null, false);
          var stage3Title = G.stockCarStage3TableTitle(d, tables, isStockCarSeriesRace, t);
          var skipStage3PointsTable = G.shouldSkipStage3PointsTable(isStockCarSeriesRace, eventHasStage4, tables);
          if (!skipStage3PointsTable) {
            add(stage3Title, G.tgaStageTable(tables, 3), 'race-stage-table race-stage-table--points', null, stageWidthsForUse, null, null, false);
          }
          if (!tables.race_results) {
            add((d.stage4_laps ? t('table.stage4') + ' (' + d.stage4_laps + ' ' + t('stage.laps') + ')' : t('table.stage4')), G.tgaStageTable(tables, 4), 'race-stage-table race-stage-table--points', null, stageWidthsForUse, null, null, false);
          }
        }
    
        appendRaceResultsBlock();
        }
    
          // Laps led / Best laps — separate tables only if not embedded in F1 results.
          function f1HidesSeparateLapsTables(evKey, tbls) {
            if (!evKey || evKey.indexOf('F1_') !== 0) return false;
            var rrTbl = tbls && tbls.race_results;
            if (rrTbl && Array.isArray(rrTbl.headers)) {
              for (var fhi = 0; fhi < rrTbl.headers.length; fhi++) {
                var fh = String(rrTbl.headers[fhi] || '').trim().toLowerCase();
                if (fh === 'best lap' || fh === 'laps led') return true;
              }
            }
            return false;
          }
          if (!f1HidesSeparateLapsTables(evKeyEvent, tables)) {
          if (tables.laps_led && tables.laps_led.rows && tables.laps_led.rows.length > 0) {
            add((typeof t === 'function' && t('table.laps_led')) ? t('table.laps_led') : 'Laps Led', tables.laps_led, 'laps-led-table', null, null, null, null, false);
          }
          // Fastest laps tables: sprint and/or race, if present.
          if (tables.best_laps_sprint && tables.best_laps_sprint.rows && tables.best_laps_sprint.rows.length > 0) {
            add('Sprint — ' + ((typeof t === 'function' && t('table.best_laps')) ? t('table.best_laps') : 'Best Laps'), tables.best_laps_sprint, 'best-laps-table', null, null, null, null, false);
          }
          if (tables.best_laps && tables.best_laps.rows && tables.best_laps.rows.length > 0) {
            add((typeof t === 'function' && t('table.best_laps')) ? t('table.best_laps') : 'Best Laps', tables.best_laps, 'best-laps-table', null, null, null, null, false);
          }
        }
        if (!penaltiesAndVscAddedAfterSprint) {
          if (tables.penalties) {
            var penaltiesTitle = (typeof t === 'function' && t('table.penalties')) ? t('table.penalties') : 'Penalties during the race';
            add(penaltiesTitle, tables.penalties, 'penalties-table', null, null, null, null, false);
          }
          if (tables.penalties_after && tables.penalties_after.rows && tables.penalties_after.rows.length > 0) {
            var penaltiesAfterTitle = t('table.penalties_after');
            add(penaltiesAfterTitle, tables.penalties_after, 'penalties-table penalties-table--after', null, null, null, null, false);
          }
          if (tables.vsc) {
            var vscTitle = (tables.vsc.title && String(tables.vsc.title).trim()) ? tables.vsc.title : ((typeof t === 'function' && t('table.vsc')) ? t('table.vsc') : 'Race neutralisation');
            add(vscTitle, tables.vsc, 'vsc-table', null, null, null, null, false);
          }
        }
        if (tables.pit_stops) {
          var pitEntryList = Array.isArray(d.entry_list) ? d.entry_list : [];
          var pitOut = G.renderPitStopsChart(tables.pit_stops, d, esc, t, localizeSectionTitle, localizeCompoundLegend, pitEntryList);
          html += pitOut.html;
          if (pitOut.sortRows) sortQueue.push({ rows: pitOut.sortRows, getRowClass: null });
        }
        if (tables.caution_breakdown) {
          var cbData = tables.caution_breakdown;
          if (G.isIndycarSeriesId(seriesIdLower) && cbData.headers && Array.isArray(cbData.rows)) {
            cbData = G.dropIndycarCautionFreePassColumn(cbData);
          }
          var cbRowClass = function (row) {
            return G.cautionBreakdownRowClass(row, cbData.headers);
          };
          add(t('table.caution_breakdown'), cbData, 'caution-breakdown-table', cbRowClass, null);
        }
    
        var emptyMsg = (t('error.race_no_data') || t('error.no_section_data') || 'Race results will appear here after the event.');
        contentEl.innerHTML = html || ('<p class="empty-msg">' + esc(emptyMsg) + '</p>');
        if (html) {
          var raceTables = contentEl.querySelectorAll('.data-table:not(.table-field-value)');
          [].forEach.call(raceTables, function (table, idx) {
            var q = sortQueue[idx];
            if (q && q.rows) makeTableSortable(table, q.rows, esc, q.getRowClass);
          });
        }
  }

  window.TGA.renderRaceContent = renderRaceContent;
  window.TGA.buildSessionMetaTable = buildSessionMetaTable;
  window.TGA.buildTeamNamesByNumberFromEntryList = buildTeamNamesByNumberFromEntryList;
})();
