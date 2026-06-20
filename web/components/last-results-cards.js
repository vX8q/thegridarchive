// Last-results cards: shows winners from the most recent completed race day.
(function () {
  if (typeof window === 'undefined') return;
  window.TGA = window.TGA || {};

  function renderLastResultsCards(allEvents) {
    var t = window.TGA.t;
    var esc = window.TGA.esc;
    var seriesBadge = window.TGA.seriesBadge;
    var formatShortDate = window.TGA.formatShortDate;
    if (!t || !esc || !seriesBadge || !formatShortDate) return;

    var container = document.getElementById('last-results-row');
    if (!container) return;

    // Filter to past events which have detailed JSON (so results can exist).
    // IMPORTANT: use local date, not toISOString(), to avoid UTC shift.
    var today = new Date();
    var todayISO = today.getFullYear() + '-' +
      ('0' + (today.getMonth() + 1)).slice(-2) + '-' +
      ('0' + today.getDate()).slice(-2);

    function isIsoYMD(s) {
      return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
    }

    function pickIsoDate(s) {
      var x = String(s || '').slice(0, 10);
      return isIsoYMD(x) ? x : '';
    }

    /** Last Results card: show only while "today" is not later than event_end + 7 calendar days.  */
    var LAST_RESULTS_DAYS_AFTER_END = 7;
    function isWithinLastResultsWindowByEndDate(endStr) {
      if (!isIsoYMD(endStr)) return false;
      var parts = endStr.split('-');
      var y = parseInt(parts[0], 10);
      var mo = parseInt(parts[1], 10) - 1;
      var da = parseInt(parts[2], 10);
      var limit = new Date(y, mo, da + LAST_RESULTS_DAYS_AFTER_END);
      var ly = limit.getFullYear();
      var lm = ('0' + (limit.getMonth() + 1)).slice(-2);
      var ld = ('0' + limit.getDate()).slice(-2);
      var limitISO = ly + '-' + lm + '-' + ld;
      return todayISO <= limitISO;
    }

    /**
     * Estimated UTC moment after which race is reasonably finished (start + typical duration).
     * Uses the same UTC start as Full Schedule / Next Race (getEventRaceUtcMs).
     */
    function estimateRaceFinishedUtcMs(ev) {
      return window.TGA.estimateRaceFinishedUtcMs
        ? window.TGA.estimateRaceFinishedUtcMs(ev)
        : null;
    }

    function isPastForLastResults(ev) {
      return window.TGA.isPastForLastResultsEvent
        ? window.TGA.isPastForLastResultsEvent(ev)
        : false;
    }

    var allPast = [];
    var pastDetailed = [];
    (Array.isArray(allEvents) ? allEvents : []).forEach(function (e) {
      if (!e || !e.id) return;
      var dateStr = (e.end_date || e.start_date || e.date || '').slice(0, 10);
      if (!isIsoYMD(dateStr)) return;
      if (!isPastForLastResults(e)) return;

      allPast.push({ event: e, dateStr: dateStr });

      // Previously filtered by has_detail, but for F1 / IndyCar / Cup this flag
      // is not always set although detail files and API exist.
      // Now try all past events and ignore those where
      // /api/events/{id} returns no data.
      var sid = String(e._seriesId || e.series_id || '').toUpperCase();
      var eid = String(e.id || '').toUpperCase();

      // Exclude exhibition Cook Out Clash (NASCAR_CUP_*_0) from "Last results" block.
      if (sid === 'NASCAR_CUP' && /_0$/.test(eid)) return;

      pastDetailed.push({ event: e, dateStr: dateStr });
    });

    if (pastDetailed.length === 0) {
      container.innerHTML =
        '<div class="lrc-label">' + esc(t('home.last_results') || 'Last Results') + '</div>' +
        '<div class="lrc-empty">' + esc(t('home.no_results') || 'No recent results') + '</div>';
      container.classList.remove('hidden');
      return;
    }

    pastDetailed.sort(function (a, b) {
      return a.dateStr < b.dateStr ? -1 : a.dateStr > b.dateStr ? 1 : 0;
    });
    var recent = [];
    var buildScheduleGroups = window.TGA && typeof window.TGA.buildScheduleGroups === 'function'
      ? window.TGA.buildScheduleGroups
      : null;
    if (buildScheduleGroups && allPast.length > 0) {
      allPast.sort(function (a, b) {
        return a.dateStr < b.dateStr ? -1 : a.dateStr > b.dateStr ? 1 : 0;
      });
      var groups = buildScheduleGroups(allPast.map(function (p) { return p.event; }));
      var detailedById = {};
      pastDetailed.forEach(function (p) {
        var id = String(p.event.id || '').toUpperCase();
        if (!id) return;
        detailedById[id] = p;
      });
      if (Array.isArray(groups) && groups.length > 0) {
        groups.forEach(function (grp) {
          var eventsInGroup = Array.isArray(grp.events) ? grp.events : [];
          eventsInGroup.forEach(function (e) {
            var id = String(e.id || '').toUpperCase();
            if (!id) return;
            var p = detailedById[id];
            if (!p) return;
            if (grp.startDs) {
              p.weekendStart = grp.startDs;
              p.weekendEnd = grp.endDs || grp.startDs;
            }
            recent.push(p);
          });
        });
      }
    }
    if (recent.length === 0) {
      recent = pastDetailed.slice();
    }

    // Card hidden if more than 7 calendar days since event end date.
    function scheduleItemEndDateStr(p) {
      if (!p) return '';
      var ev = p.event || {};
      var wk = String(p.weekendEnd || '').slice(0, 10);
      if (isIsoYMD(wk)) return wk;
      var end = String(ev.end_date || '').slice(0, 10);
      if (isIsoYMD(end)) return end;
      return String(ev.start_date || ev.date || p.dateStr || '').slice(0, 10);
    }
    recent = recent.filter(function (p) {
      return isWithinLastResultsWindowByEndDate(scheduleItemEndDateStr(p));
    });

    // If no recent events with detail files — exit.
    if (recent.length === 0) {
      container.innerHTML =
        '<div class="lrc-label">' + esc(t('home.last_results') || 'Last Results') + '</div>' +
        '<div class="lrc-empty">' + esc(t('home.no_results') || 'No recent results') + '</div>';
      container.classList.remove('hidden');
      return;
    }

    // Collapse multiple schedule rows pointing to same event.id into one card.
    var byEventId = {};
    recent.forEach(function (p) {
      var eid = String(p.event.id || '').toUpperCase();
      if (!eid) return;
      if (!byEventId[eid]) {
        byEventId[eid] = p;
      }
    });
    var recentUnique = Object.keys(byEventId).map(function (k) { return byEventId[k]; });

    if (recentUnique.length === 0) {
      container.innerHTML =
        '<div class="lrc-label">' + esc(t('home.last_results') || 'Last Results') + '</div>' +
        '<div class="lrc-empty">' + esc(t('home.no_results') || 'No recent results') + '</div>';
      container.classList.remove('hidden');
      return;
    }

    // Fetch event details for each recent event to get race_results winner.
    var API = window.TGA && window.TGA.API;

    var promises = recentUnique.map(function (item) {
      var e = item.event;
      var eventId = String(e.id || '');
      if (!eventId) return Promise.resolve(null);
      // Do not request non-detailed events here: this avoids noisy 404s
      // for schedule-only ids while still showing a pending card.
      if (e.has_detail === false) {
        if (isPastForLastResults(e)) {
          return Promise.resolve({
            event: e,
            dateStr: item.dateStr,
            winners: [],
            rangeStart: (e.start_date || e.date || item.dateStr || '').slice(0, 10),
            rangeEnd: (e.end_date || e.start_date || item.dateStr || '').slice(0, 10),
            isF1SprintWeekend: false
          });
        }
        return Promise.resolve(null);
      }
      var apiEventId = eventId; // keep as-is; backend normalises case.

      return (API ? API.getEvent(apiEventId) : fetch('/api/events/' + encodeURIComponent(apiEventId)).then(function (r) {
          if (!r.ok) throw new Error(r.status === 404 ? 'Not found' : 'HTTP ' + r.status);
          return r.json();
        }))
        .then(function (d) {
          if (!d || typeof d !== 'object') return null;
          if (d.data && typeof d.data === 'object') d = d.data;
          if (d.event && typeof d.event === 'object') d = d.event;
          if (Array.isArray(d) && d.length > 0) d = d[0];

          var tables = d.tables || {};
          var winners = [];
          var raceWasCancelled = false;

          /** F1: tables.race.sessions has sprint only (classification); GP in race_results.  */
          function f1RaceBlockIsSprintSessionsOnly(raceBlock) {
            if (!raceBlock || !Array.isArray(raceBlock.sessions) || raceBlock.sessions.length === 0) return false;
            var anyRows = false;
            for (var sxi = 0; sxi < raceBlock.sessions.length; sxi++) {
              var sess = raceBlock.sessions[sxi];
              if (!sess || !Array.isArray(sess.rows) || sess.rows.length === 0) continue;
              anyRows = true;
              var rawLabel = '';
              if (sess.meta && typeof sess.meta.Session === 'string') {
                rawLabel = sess.meta.Session;
              }
              if ((!rawLabel || /^(Race)$/i.test(rawLabel)) && typeof sess.title === 'string') {
                rawLabel = sess.title;
              } else if (!rawLabel && typeof sess.title === 'string') {
                rawLabel = sess.title;
              }
              if (!/sprint/i.test(String(rawLabel || ''))) return false;
            }
            return anyRows;
          }

          function isCancelledText(text) {
            var s = String(text || '').trim().toLowerCase();
            if (!s) return false;
            return s.indexOf('race cancelled') >= 0 ||
              s.indexOf('race canceled') >= 0 ||
              (s.indexOf('cancelled') >= 0 && s.indexOf('weather') >= 0) ||
              (s.indexOf('canceled') >= 0 && s.indexOf('weather') >= 0);
          }

          function detectCancelledRace(tablesObj) {
            if (!tablesObj || !tablesObj.race) return false;
            var raceBlock = tablesObj.race;
            if (isCancelledText(raceBlock.note) || isCancelledText(raceBlock.subtitle)) return true;
            if (Array.isArray(raceBlock.note_lines)) {
              for (var ni = 0; ni < raceBlock.note_lines.length; ni++) {
                if (isCancelledText(raceBlock.note_lines[ni])) return true;
              }
            }
            if (Array.isArray(raceBlock.sessions)) {
              for (var si = 0; si < raceBlock.sessions.length; si++) {
                var sess = raceBlock.sessions[si] || {};
                if (isCancelledText(sess.note) || isCancelledText(sess.subtitle)) return true;
                if (Array.isArray(sess.note_lines)) {
                  for (var nli = 0; nli < sess.note_lines.length; nli++) {
                    if (isCancelledText(sess.note_lines[nli])) return true;
                  }
                }
              }
            }
            return false;
          }

          // Event date range: prefer the event's own start/end (schedule),
          // not cross-series weekend group bounds from buildScheduleGroups.
          var evStart = '';
          var evEnd = '';
          var scheduleStart = '';
          var scheduleEnd = '';
          scheduleStart = pickIsoDate(e.start_date);
          scheduleEnd = pickIsoDate(e.end_date);
          evStart = scheduleStart || pickIsoDate(item.weekendStart) || pickIsoDate(item.dateStr);
          evEnd = scheduleEnd || pickIsoDate(e.start_date) || pickIsoDate(item.weekendEnd) || pickIsoDate(item.dateStr);
          if (evStart && !evEnd) evEnd = evStart;
          if (evEnd && !evStart) evStart = evEnd;

          function parseMetaDateToISO(str) {
            if (!str || typeof str !== 'string') return null;
            // Expected format: "Thu 05 Mar 2026"
            var m = str.match(/(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/);
            if (!m) return null;
            var day = ('0' + parseInt(m[1], 10)).slice(-2);
            var monMap = {
              jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
              jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
            };
            var monKey = String(m[2] || '').slice(0, 3).toLowerCase();
            var mm = monMap[monKey];
            if (!mm) return null;
            var year = m[3];
            return year + '-' + mm + '-' + day;
          }

          function updateRangeFromMetaDate(metaDate) {
            if (scheduleStart && scheduleEnd) return;
            var iso = parseMetaDateToISO(metaDate);
            if (!iso) return;
            if (!evStart || iso < evStart) evStart = iso;
            if (!evEnd || iso > evEnd) evEnd = iso;
          }

          // Collect dates from all sessions (practice, qualifying, race, etc.), not only race.sessions.
          Object.keys(tables).forEach(function (key) {
            var tbl = tables[key];
            if (!tbl) return;
            if (tbl.meta && typeof tbl.meta.Date === 'string') updateRangeFromMetaDate(tbl.meta.Date);
            if (Array.isArray(tbl.sessions)) {
              tbl.sessions.forEach(function (sess) {
                if (sess && sess.meta && typeof sess.meta.Date === 'string') updateRangeFromMetaDate(sess.meta.Date);
              });
            }
          });

          // GTWCE Sprint: card shows absolute race winner only (Pos 1) — team and number, no driver names.
          function extractGtwceSprintOverallWinnerFromSession(table, label) {
            if (!table || !Array.isArray(table.headers) || !Array.isArray(table.rows) || table.rows.length === 0) {
              return;
            }
            var headers = table.headers;
            var posCol = headers.indexOf('Pos');
            if (posCol < 0) posCol = headers.indexOf('Pos.');
            var teamCol = headers.indexOf('Team');
            var carNoCol = headers.indexOf('Car #');
            if (carNoCol < 0) carNoCol = headers.indexOf('Car No');
            if (carNoCol < 0) carNoCol = headers.indexOf('Car No.');
            if (carNoCol < 0) {
              carNoCol = headers.indexOf('No.');
              if (carNoCol < 0) carNoCol = headers.indexOf('No');
            }
            var winnerRow = null;
            for (var i = 0; i < table.rows.length; i++) {
              var row = table.rows[i] || [];
              if (posCol >= 0 && posCol < row.length) {
                var p = String(row[posCol] || '').trim().toUpperCase();
                if (p === '1' || p === 'P1') {
                  winnerRow = row;
                  break;
                }
              }
            }
            if (!winnerRow) winnerRow = table.rows[0] || null;
            if (!winnerRow) return;
            var team = teamCol >= 0 && teamCol < winnerRow.length ? String(winnerRow[teamCol] || '').trim() : '';
            var car = carNoCol >= 0 && carNoCol < winnerRow.length ? String(winnerRow[carNoCol] || '').trim() : '';
            winners.push({ name: team, car: car, label: label || '' });
          }

          function extractWinnerFromTable(table, label) {
            if (!table || !Array.isArray(table.headers) || !Array.isArray(table.rows) || table.rows.length === 0) {
              return;
            }
            var headers = table.headers;
            var posCol = headers.indexOf('Pos');
            if (posCol < 0) {
              posCol = headers.indexOf('Pos.');
            }
            var drvCol = headers.indexOf('Driver');
            if (drvCol < 0) drvCol = headers.indexOf('Drivers');
            if (drvCol < 0) return;
            var carCol = headers.indexOf('Car');
            if (carCol < 0) {
              carCol = headers.indexOf('#');
            }
            // Many tables (IndyCar, F1, NASCAR, etc.) use "No." / "No" as car number.
            if (carCol < 0) {
              carCol = headers.indexOf('No.');
            }
            if (carCol < 0) {
              carCol = headers.indexOf('No');
            }
            var winnerRow = null;
            for (var i = 0; i < table.rows.length; i++) {
              var row = table.rows[i] || [];
              if (posCol >= 0 && posCol < row.length) {
                var p = String(row[posCol] || '').trim().toUpperCase();
                if (p === '1' || p === 'P1') {
                  winnerRow = row;
                  break;
                }
              }
            }
            if (!winnerRow) {
              winnerRow = table.rows[0] || null;
            }
            if (!winnerRow) return;
            var name = String(winnerRow[drvCol] || '').trim();
            var car = (carCol >= 0 && carCol < winnerRow.length) ? String(winnerRow[carCol] || '').trim() : '';
            winners.push({ name: name, car: car, label: label || '' });
          }

          // TGA-style tables (IMSA, etc.) use uppercase headers like "POS", "CAR NO", "DRIVERS".
          function extractWinnerFromTgaTable(table, label) {
            if (!table || !Array.isArray(table.headers) || !Array.isArray(table.rows) || table.rows.length === 0) {
              return;
            }
            var headers = table.headers.map(function (h) { return String(h || '').trim().toUpperCase(); });
            var posCol = headers.indexOf('POS');
            var drvCol = headers.indexOf('DRIVERS');
            var carCol = headers.indexOf('CAR NO');
            if (drvCol < 0) return;
            var winnerRow = null;
            for (var i = 0; i < table.rows.length; i++) {
              var row = table.rows[i] || [];
              if (posCol >= 0 && posCol < row.length) {
                var p = String(row[posCol] || '').trim().toUpperCase();
                if (p === '1' || p === 'P1') {
                  winnerRow = row;
                  break;
                }
              }
            }
            if (!winnerRow) winnerRow = table.rows[0] || null;
            if (!winnerRow) return;
            var name = String(winnerRow[drvCol] || '').trim();
            // DRIVERS is usually "A; B; C" - keep as crew.
            name = name.split(/\s*;\s*/).filter(Boolean).join(' / ');
            var car = (carCol >= 0 && carCol < winnerRow.length) ? String(winnerRow[carCol] || '').trim() : '';
            winners.push({ name: name, car: car, label: label || '' });
          }

          /** NASCAR All-Star: race_results.stages — winner from final stage (Final Stage Results).  */
          function extractWinnerFromAllstarStages(rr, label) {
            if (!rr || rr.format !== 'allstar_stages' || !Array.isArray(rr.stages) || rr.stages.length === 0) {
              return;
            }
            var finalStage = null;
            for (var si = rr.stages.length - 1; si >= 0; si--) {
              var st = rr.stages[si];
              if (!st || !Array.isArray(st.headers) || !Array.isArray(st.rows) || st.rows.length === 0) continue;
              var titleLc = String(st.title || '').trim().toLowerCase();
              if (titleLc.indexOf('final') >= 0) {
                finalStage = st;
                break;
              }
            }
            if (!finalStage) {
              for (var sj = rr.stages.length - 1; sj >= 0; sj--) {
                var stLast = rr.stages[sj];
                if (stLast && Array.isArray(stLast.headers) && Array.isArray(stLast.rows) && stLast.rows.length > 0) {
                  finalStage = stLast;
                  break;
                }
              }
            }
            if (!finalStage) return;
            extractWinnerFromTable(finalStage, label || '');
          }

          // WEC: class winners from overall race table (Hypercar, LMP2 at Le Mans, LMGT3).
          // On card — class and team only (no driver names): Team column, not Drivers.
          function extractWecClassWinnersFromRaceResults(table) {
            if (!table || !Array.isArray(table.headers) || !Array.isArray(table.rows) || table.rows.length === 0) return;
            var hLower = table.headers.map(function (x) { return String(x || '').trim().toLowerCase(); });
            var classIdx = hLower.indexOf('class');
            var teamIdx = hLower.indexOf('team');
            var noIdx = hLower.indexOf('no.');
            if (noIdx < 0) noIdx = hLower.indexOf('no');
            var posIdx = hLower.indexOf('pos');
            if (posIdx < 0) posIdx = hLower.indexOf('pos.');
            if (classIdx < 0 || teamIdx < 0) return;
            var wantOrder = ['hypercar', 'lmp2', 'lmgt3'];
            var labelByKey = { hypercar: 'Hypercar', lmp2: 'LMP2', lmgt3: 'LMGT3' };
            var seen = {};

            function wecClassKey(clsRaw) {
              if (clsRaw === 'hypercar' || clsRaw === 'lmgt3') return clsRaw;
              if (clsRaw === 'lmp2') return 'lmp2';
              return '';
            }

            (table.rows || []).forEach(function (row) {
              if (!row || !Array.isArray(row)) return;
              var clsRaw = String(row[classIdx] || '').trim().toLowerCase();
              var key = wecClassKey(clsRaw);
              if (!key || seen[key]) return;
              var posCell = String((posIdx >= 0 && posIdx < row.length ? row[posIdx] : row[0]) || '').trim().toUpperCase();
              if (posCell === 'RET' || posCell.indexOf('RET') === 0 || posCell === 'DNF') return;
              var name = String(row[teamIdx] || '').trim();
              var car = (noIdx >= 0 && noIdx < row.length) ? String(row[noIdx] || '').trim() : '';
              seen[key] = { name: name, car: car, label: labelByKey[key] || key };
            });

            wantOrder.forEach(function (key) {
              if (seen[key]) winners.push(seen[key]);
            });
          }

          // IMSA: show class winners (GTP/LMP2/GTD Pro/GTD) from tables.race using CLASS + CLASS POS.
          function extractImsaClassWinnersFromTgaRace(table) {
            if (!table || !Array.isArray(table.headers) || !Array.isArray(table.rows) || table.rows.length === 0) return;
            var headers = table.headers.map(function (h) { return String(h || '').trim().toUpperCase(); });
            var clsCol = headers.indexOf('CLASS');
            var clsPosCol = headers.indexOf('CLASS POS');
            var carCol = headers.indexOf('CAR NO');
            var teamCarCol = headers.indexOf('TEAM/CAR/SPONSOR');
            if (teamCarCol < 0) {
              teamCarCol = headers.indexOf('TEAM/CAR');
            }
            if (clsCol < 0 || clsPosCol < 0) return;

            var want = ['GTP', 'LMP2', 'GTD PRO', 'GTD'];
            var bestByClass = {};

            for (var i = 0; i < table.rows.length; i++) {
              var row = table.rows[i] || [];
              var cls = String(row[clsCol] || '').trim().toUpperCase();
              if (!cls) continue;
              if (want.indexOf(cls) < 0) continue;
              var cp = String(row[clsPosCol] || '').trim().toUpperCase();
              if (cp !== '1' && cp !== 'P1') continue;
              if (!bestByClass[cls]) bestByClass[cls] = row;
            }

            want.forEach(function (cls) {
              var row = bestByClass[cls];
              if (!row) return;
              var teamLine = '';
              if (teamCarCol >= 0 && teamCarCol < row.length) {
                teamLine = String(row[teamCarCol] || '').trim();
              }
              // Usually "Team / Car" — show only team part.
              if (teamLine.indexOf('/') >= 0) {
                teamLine = teamLine.split('/')[0].trim();
              }
              var name = teamLine || '';
              var car = (carCol >= 0 && carCol < row.length) ? String(row[carCol] || '').trim() : '';
              var label = cls === 'GTD PRO' ? 'GTD Pro' : cls;
              winners.push({ name: name, car: car, label: label });
            });
          }

          // ELMS: show class-winning crews from a single race table.
          function extractElmsClassWinnersFromRace(table, entryList) {
            if (!table || !Array.isArray(table.headers) || !Array.isArray(table.rows) || table.rows.length === 0) return;
            var headers = table.headers.map(function (h) { return String(h || '').trim(); });
            var clsCol = -1;
            var posCol = -1;
            var noCol = -1;
            var teamCol = -1;
            for (var hi = 0; hi < headers.length; hi++) {
              var lh = headers[hi].toLowerCase();
              if (lh === 'class') clsCol = hi;
              if (lh === 'pos' || lh === 'pos.') posCol = hi;
              if (lh === 'no' || lh === 'no.') noCol = hi;
              if (lh === 'team') teamCol = hi;
            }
            if (clsCol < 0) return;

            var classOrder = ['LMP2', 'LMP2 Pro/Am', 'LMP3', 'LMGT3'];
            var winnerByClass = {};
            for (var ri = 0; ri < table.rows.length; ri++) {
              var row = table.rows[ri] || [];
              var cls = String(row[clsCol] || '').trim();
              if (!cls || classOrder.indexOf(cls) < 0) continue;
              var posVal = posCol >= 0 ? String(row[posCol] || '').trim() : '';
              // Prefer class winner rows (Pos=1 in class ordering). Fallback to first seen in class.
              if (!winnerByClass[cls] || posVal === '1' || posVal === 'P1') {
                winnerByClass[cls] = row;
              }
            }

            var byNo = {};
            if (Array.isArray(entryList)) {
              entryList.forEach(function (e) {
                var n = String((e && e.number) || '').trim();
                if (n) byNo[n] = e;
              });
            }

            classOrder.forEach(function (cls) {
              var row = winnerByClass[cls];
              if (!row) return;
              var carNo = (noCol >= 0 && noCol < row.length) ? String(row[noCol] || '').trim() : '';
              var team = (teamCol >= 0 && teamCol < row.length) ? String(row[teamCol] || '').trim() : '';
              var entry = carNo ? byNo[carNo] : null;
              var teamName = team || (entry && entry.team ? String(entry.team).trim() : '');
              winners.push({
                name: teamName || '',
                car: carNo || '',
                label: cls
              });
            });
          }

          // GTWCE Endurance card: Overall = race winner (P1); Gold/Silver/Bronze = class winners
          // unless the overall winner already won that class (no duplicate line).
          function extractGtwceClassWinnersFromRace(raceBlock, entryList) {
            if (!raceBlock) return;
            var table = raceBlock;
            if (Array.isArray(raceBlock.sessions) &&
                (!Array.isArray(raceBlock.headers) || !Array.isArray(raceBlock.rows) || raceBlock.rows.length === 0)) {
              table = null;
              for (var sIdx = 0; sIdx < raceBlock.sessions.length; sIdx++) {
                var sess = raceBlock.sessions[sIdx];
                if (!sess || !Array.isArray(sess.headers) || !Array.isArray(sess.rows) || sess.rows.length === 0) continue;
                var st = String(sess.title || '').trim();
                if (/^main\s+race$/i.test(st) || /^race$/i.test(st)) {
                  table = sess;
                  break;
                }
              }
              if (!table) {
                for (var sIdx2 = 0; sIdx2 < raceBlock.sessions.length; sIdx2++) {
                  var sess2 = raceBlock.sessions[sIdx2];
                  if (!sess2 || !Array.isArray(sess2.headers) || !Array.isArray(sess2.rows) || sess2.rows.length === 0) continue;
                  var hasClass = false;
                  for (var hci = 0; hci < sess2.headers.length; hci++) {
                    if (String(sess2.headers[hci] || '').trim().toLowerCase() === 'class') {
                      hasClass = true;
                      break;
                    }
                  }
                  if (hasClass) {
                    table = sess2;
                    break;
                  }
                }
              }
            }
            if (!table || !Array.isArray(table.headers) || !Array.isArray(table.rows) || table.rows.length === 0) return;
            var headers = table.headers.map(function (h) { return String(h || '').trim(); });
            var clsCol = -1;
            var posCol = -1;
            var noCol = -1;
            var teamCol = -1;
            for (var hi = 0; hi < headers.length; hi++) {
              var lh = headers[hi].toLowerCase();
              if (lh === 'class') clsCol = hi;
              if (lh === 'pos' || lh === 'pos.') posCol = hi;
              if (lh === 'no' || lh === 'no.' || lh === 'car #' || lh === 'car no') noCol = hi;
              if (lh === 'team') teamCol = hi;
            }
            if (clsCol < 0) return;

            var cupClassOrder = ['Gold Cup', 'Silver Cup', 'Bronze Cup'];
            var cupCardLabel = {
              'Gold Cup': 'Gold',
              'Silver Cup': 'Silver',
              'Bronze Cup': 'Bronze'
            };

            function rowPosVal(row) {
              return posCol >= 0 ? String(row[posCol] || '').trim().toUpperCase() : '';
            }
            function isClassifiedRow(row) {
              var posVal = rowPosVal(row);
              return posVal !== 'NC' && posVal.indexOf('NC') !== 0;
            }

            var overallRow = null;
            for (var oi = 0; oi < table.rows.length; oi++) {
              var orow = table.rows[oi] || [];
              if (!isClassifiedRow(orow)) continue;
              var op = rowPosVal(orow);
              if (op === '1' || op === 'P1') {
                overallRow = orow;
                break;
              }
            }
            if (!overallRow) {
              for (var oi2 = 0; oi2 < table.rows.length; oi2++) {
                var orow2 = table.rows[oi2] || [];
                if (isClassifiedRow(orow2)) {
                  overallRow = orow2;
                  break;
                }
              }
            }
            if (!overallRow) return;

            var byNo = {};
            if (Array.isArray(entryList)) {
              entryList.forEach(function (e) {
                var n = String((e && e.number) || '').trim();
                if (n) byNo[n] = e;
              });
            }

            function pushWinner(row, label) {
              if (!row) return;
              var carNo = (noCol >= 0 && noCol < row.length) ? String(row[noCol] || '').trim() : '';
              var entry = carNo ? byNo[carNo] : null;
              var team = (teamCol >= 0 && teamCol < row.length) ? String(row[teamCol] || '').trim() : '';
              if (!team && entry && entry.team) team = String(entry.team).trim();
              winners.push({
                name: team || '',
                car: carNo || '',
                label: label
              });
            }

            var overallClass = String(overallRow[clsCol] || '').trim();
            pushWinner(overallRow, 'Overall');

            var winnerByCup = {};
            for (var ri = 0; ri < table.rows.length; ri++) {
              var row = table.rows[ri] || [];
              var cls = String(row[clsCol] || '').trim();
              if (cupClassOrder.indexOf(cls) < 0) continue;
              if (!isClassifiedRow(row)) continue;
              if (winnerByCup[cls]) continue;
              winnerByCup[cls] = row;
            }

            cupClassOrder.forEach(function (cls) {
              if (overallClass === cls) return;
              pushWinner(winnerByCup[cls], cupCardLabel[cls] || cls);
            });
          }

          // Super GT: show two class winners from one race table (GT500 + GT300).
          function extractSuperGtClassWinnersFromRace(table) {
            if (!table || !Array.isArray(table.headers) || !Array.isArray(table.rows) || table.rows.length === 0) return;
            var headers = table.headers.map(function (h) { return String(h || '').trim().toUpperCase(); });
            var clsCol = headers.indexOf('CLASS');
            var posCol = headers.indexOf('POS.');
            if (posCol < 0) posCol = headers.indexOf('POS');
            var noCol = headers.indexOf('NO.');
            if (noCol < 0) noCol = headers.indexOf('NO');
            var drvCol = headers.indexOf('DRIVERS');
            var teamCol = headers.indexOf('TEAM');
            if (clsCol < 0) return;

            var want = ['GT500', 'GT300'];
            var byClass = {};
            for (var ri = 0; ri < table.rows.length; ri++) {
              var row = table.rows[ri] || [];
              var cls = String(row[clsCol] || '').trim().toUpperCase();
              if (!cls || want.indexOf(cls) < 0) continue;
              var pos = posCol >= 0 ? String(row[posCol] || '').trim().toUpperCase() : '';
              if (!byClass[cls] || pos === '1' || pos === 'P1') byClass[cls] = row;
            }

            want.forEach(function (cls) {
              var row = byClass[cls];
              if (!row) return;
              var crew = drvCol >= 0 && drvCol < row.length ? String(row[drvCol] || '').trim() : '';
              crew = crew.split(/\s*;\s*/).filter(Boolean).join(' / ');
              var team = teamCol >= 0 && teamCol < row.length ? String(row[teamCol] || '').trim() : '';
              var name = crew || team || '';
              var carNo = noCol >= 0 && noCol < row.length ? String(row[noCol] || '').trim() : '';
              winners.push({ name: name, car: carNo, label: cls });
            });
          }

          function lastResultsRaceSessionLabel(sess) {
            var rawLabel = '';
            if (sess.meta && typeof sess.meta.Session === 'string') {
              rawLabel = sess.meta.Session;
            }
            if ((!rawLabel || /^(Race)$/i.test(rawLabel)) && typeof sess.title === 'string') {
              rawLabel = sess.title;
            } else if (!rawLabel && typeof sess.title === 'string') {
              rawLabel = sess.title;
            }
            var label = String(rawLabel || '');
            label = label.replace(/\s*Results?$/i, '');
            label = label.replace(/^Race\s+(Round\s+\d+)$/i, '$1');
            var m = label.match(/(Race\s+\d+)\b/i);
            if (m) {
              label = m[1];
            } else {
              label = label.replace(/\s*Race$/i, '');
            }
            return label;
          }

          var seriesIdForSessions = String(e._seriesId || '').toUpperCase();

          // GTWCE Endurance: class-winning crews from Main Race (Overall / Gold / Silver / Bronze).
          if (seriesIdForSessions === 'GTWCE_END' && tables.race) {
            if (Array.isArray(tables.race.sessions)) {
              tables.race.sessions.forEach(function (sess) {
                if (sess.meta && typeof sess.meta.Date === 'string') {
                  updateRangeFromMetaDate(sess.meta.Date);
                }
              });
            }
            extractGtwceClassWinnersFromRace(tables.race, d.entry_list || []);
          } else if (tables.race && Array.isArray(tables.race.sessions)) {
            // If split into separate races in tables.race.sessions (Supercars, F2/F3, etc.),
            // take winners from there only.
            tables.race.sessions.forEach(function (sess) {
              var label = lastResultsRaceSessionLabel(sess);
              if (sess.meta && typeof sess.meta.Date === 'string') {
                updateRangeFromMetaDate(sess.meta.Date);
              }
              if (seriesIdForSessions === 'GTWCE_SPRINT') {
                extractGtwceSprintOverallWinnerFromSession(sess, label);
              } else {
                extractWinnerFromTable(sess, label);
              }
            });
          }
          if (tables.race_results) {
            // Main race: always add separately (even if sessions exist).
            var mainRaceLabel = (tables.race && Array.isArray(tables.race.sessions)) ? 'Race' : '';
            var sidUpperForRr = String(e._seriesId || '').toUpperCase();
            var rr = tables.race_results;
            if (rr.format === 'allstar_stages' && Array.isArray(rr.stages) && rr.stages.length > 0) {
              extractWinnerFromAllstarStages(rr, mainRaceLabel);
            } else if (sidUpperForRr === 'WEC') {
              extractWecClassWinnersFromRaceResults(rr);
            }
            if (winners.length === 0) {
              extractWinnerFromTable(rr, mainRaceLabel);
            } else if (sidUpperForRr === 'F1' && f1RaceBlockIsSprintSessionsOnly(tables.race)) {
              // "Feature" label set below for sprint weekend card.
              extractWinnerFromTable(rr, '');
            }
          }
          if (winners.length === 0 && tables.race) {
            // Fallback: some series (e.g. IMSA) store results in tables.race without race_results.
            var sidUpper = String(e._seriesId || '').toUpperCase();
            if (sidUpper === 'IMSA') {
              extractImsaClassWinnersFromTgaRace(tables.race);
            } else if (sidUpper === 'SUPER_GT') {
              extractSuperGtClassWinnersFromRace(tables.race);
            } else if (sidUpper === 'ELMS') {
              extractElmsClassWinnersFromRace(tables.race, d.entry_list || []);
            } else if (sidUpper === 'GTWCE_SPRINT' && tables.race && Array.isArray(tables.race.sessions)) {
              tables.race.sessions.forEach(function (sess) {
                extractGtwceSprintOverallWinnerFromSession(sess, lastResultsRaceSessionLabel(sess));
              });
            } else {
              extractWinnerFromTgaTable(tables.race, '');
            }
          }
          var sidUpperF1Check = String(e._seriesId || '').toUpperCase();
          var isF1SprintWeekend = sidUpperF1Check === 'F1' && !!tables.race_results &&
            f1RaceBlockIsSprintSessionsOnly(tables.race);
          if (isF1SprintWeekend) {
            if (winners[0]) winners[0].label = 'Sprint';
            if (winners[1]) winners[1].label = 'Feature';
          }
          raceWasCancelled = detectCancelledRace(tables);

          return {
            event: e,
            dateStr: item.dateStr,
            winners: winners,
            raceWasCancelled: raceWasCancelled,
            rangeStart: evStart,
            rangeEnd: evEnd,
            isF1SprintWeekend: isF1SprintWeekend
          };
        })
        .catch(function () {
          if (isPastForLastResults(e)) {
            return {
              event: e,
              dateStr: item.dateStr,
              winners: [],
              raceWasCancelled: false,
              rangeStart: (e.start_date || e.date || item.dateStr || '').slice(0, 10),
              rangeEnd: (e.end_date || e.start_date || item.dateStr || '').slice(0, 10),
              isF1SprintWeekend: false
            };
          }
          return null;
        });
    });

    Promise.all(promises).then(function (results) {
      var cards = results.filter(Boolean);

      function eventSeriesUpperLrc(ev) {
        return String((ev && (ev._seriesId || ev.series_id)) || '').toUpperCase();
      }

      function mergeSuperFormulaLastResultCards(arr) {
        if (!Array.isArray(arr) || arr.length === 0) return arr;
        var sf = [];
        var rest = [];
        arr.forEach(function (c) {
          if (eventSeriesUpperLrc(c.event) === 'SUPER_FORMULA') sf.push(c);
          else rest.push(c);
        });
        sf.sort(function (a, b) {
          var da = (a.rangeStart || a.dateStr || '').slice(0, 10);
          var db = (b.rangeStart || b.dateStr || '').slice(0, 10);
          return da < db ? -1 : da > db ? 1 : 0;
        });
        var outSf = [];
        for (var i = 0; i < sf.length; i++) {
          var c = sf[i];
          var e = c.event;
          var run = [c];
          var c0 = String(e.circuit_name || '').trim();
          var l0 = String(e.location || '').trim();
          var prev = (c.rangeEnd || c.rangeStart || c.dateStr || '').slice(0, 10);
          var j = i + 1;
          while (j < sf.length) {
            var c2 = sf[j];
            var e2 = c2.event;
            if (String(e2.circuit_name || '').trim() !== c0 || String(e2.location || '').trim() !== l0) break;
            var d2 = (c2.rangeStart || c2.dateStr || '').slice(0, 10);
            var diffMs = new Date(d2 + 'T12:00:00').getTime() - new Date(prev + 'T12:00:00').getTime();
            if (diffMs !== 86400000) break;
            run.push(c2);
            prev = (c2.rangeEnd || c2.dateStr || d2).slice(0, 10);
            j++;
          }
          if (run.length === 1) {
            outSf.push(c);
          } else {
            var first = run[0];
            var last = run[run.length - 1];
            var fe = first.event;
            var rs = (first.rangeStart || first.dateStr || '').slice(0, 10);
            var re = (last.rangeEnd || last.dateStr || '').slice(0, 10);
            var allWinners = [];
            run.forEach(function (x) {
              var w = x.winners;
              if (Array.isArray(w)) {
                for (var wi = 0; wi < w.length; wi++) allWinners.push(w[wi]);
              }
            });
            outSf.push({
              event: Object.assign({}, fe, {
                start_date: rs,
                end_date: re,
                name: String(fe.circuit_name || fe.name || '').trim(),
                _seriesId: fe._seriesId || fe.series_id || 'SUPER_FORMULA'
              }),
              dateStr: re,
              rangeStart: rs,
              rangeEnd: re,
              winners: allWinners
            });
          }
          i = j - 1;
        }
        var merged = rest.concat(outSf);
        merged.sort(function (a, b) {
          var ka = (a.rangeStart || a.dateStr || '').slice(0, 10);
          var kb = (b.rangeStart || b.dateStr || '').slice(0, 10);
          return ka < kb ? -1 : ka > kb ? 1 : 0;
        });
        return merged;
      }

      function mergeSupercarsLastResultCards(arr) {
        if (!Array.isArray(arr) || arr.length === 0) return arr;
        var sc = [];
        var rest = [];
        arr.forEach(function (c) {
          if (eventSeriesUpperLrc(c.event) === 'SUPERCARS') sc.push(c);
          else rest.push(c);
        });
        sc.sort(function (a, b) {
          var da = (a.rangeStart || a.dateStr || '').slice(0, 10);
          var db = (b.rangeStart || b.dateStr || '').slice(0, 10);
          return da < db ? -1 : da > db ? 1 : 0;
        });
        var outSc = [];
        for (var i = 0; i < sc.length; i++) {
          var c = sc[i];
          var e = c.event || {};
          var run = [c];
          var c0 = String(e.circuit_name || '').trim();
          var l0 = String(e.location || '').trim();
          var prev = (c.rangeEnd || c.rangeStart || c.dateStr || '').slice(0, 10);
          var j = i + 1;
          while (j < sc.length) {
            var c2 = sc[j];
            var e2 = c2.event || {};
            if (String(e2.circuit_name || '').trim() !== c0 || String(e2.location || '').trim() !== l0) break;
            var d2 = (c2.rangeStart || c2.dateStr || '').slice(0, 10);
            var diffMs = new Date(d2 + 'T12:00:00').getTime() - new Date(prev + 'T12:00:00').getTime();
            // Same/next day and also overlapping ranges (diff < 0 when one card already spans
            // more days from detailed session metadata) belong to one merged weekend card.
            if (diffMs > 86400000) break;
            run.push(c2);
            var c2End = (c2.rangeEnd || c2.dateStr || d2).slice(0, 10);
            if (!prev || c2End > prev) prev = c2End;
            j++;
          }
          if (run.length === 1) {
            outSc.push(c);
          } else {
            var first = run[0];
            var last = run[run.length - 1];
            var fe = first.event || {};
            var rs = (first.rangeStart || first.dateStr || '').slice(0, 10);
            var re = (last.rangeEnd || last.dateStr || '').slice(0, 10);
            var allWinners = [];
            run.forEach(function (x) {
              var w = x.winners;
              if (Array.isArray(w)) {
                for (var wi = 0; wi < w.length; wi++) allWinners.push(w[wi]);
              }
            });
            // Dedupe winners: same winner sometimes appears twice when building sessions.
            (function () {
              var seen = {};
              allWinners = allWinners.filter(function (w) {
                var key = String((w && w.label) || '') + '|' + String((w && w.car) || '') + '|' + String((w && w.name) || '');
                if (seen[key]) return false;
                seen[key] = true;
                return true;
              });
            })();
            outSc.push({
              event: Object.assign({}, fe, {
                start_date: rs,
                end_date: re,
                // Drop trailing race number in merged card title.
                name: String(fe.name || fe.circuit_name || '').replace(/\s*Race\s*\d+\s*$/i, '').trim() || String(fe.circuit_name || '').trim(),
                _seriesId: fe._seriesId || fe.series_id || 'SUPERCARS'
              }),
              dateStr: re,
              rangeStart: rs,
              rangeEnd: re,
              winners: allWinners
            });
          }
          i = j - 1;
        }
        var merged = rest.concat(outSc);
        merged.sort(function (a, b) {
          var ka = (a.rangeStart || a.dateStr || '').slice(0, 10);
          var kb = (b.rangeStart || b.dateStr || '').slice(0, 10);
          return ka < kb ? -1 : ka > kb ? 1 : 0;
        });
        return merged;
      }

      cards = mergeSuperFormulaLastResultCards(cards);
      cards = mergeSupercarsLastResultCards(cards);

      // Do not show calendar-future. Past/today — only if since event end date
      // at most 7 days passed (otherwise card "sticks" in feed).
      // Show when finished (start + duration) or winners already loaded.
      cards = cards.filter(function (card) {
        var e = card.event || {};
        var endIso = (card.rangeEnd || e.end_date || e.start_date || card.dateStr || '').slice(0, 10);
        if (!isIsoYMD(endIso)) return false;
        if (!isWithinLastResultsWindowByEndDate(endIso)) return false;
        var w = card.winners;
        if (w && w.length > 0) return true;
        return isPastForLastResults(e);
      });

      if (cards.length === 0) {
        container.innerHTML =
          '<div class="lrc-label">' + esc(t('home.last_results') || 'Last Results') + '</div>' +
          '<div class="lrc-empty">' + esc(t('home.no_results') || 'No recent results') + '</div>';
        container.classList.remove('hidden');
        return;
      }

      container.innerHTML =
        '<div class="lrc-label">' + esc(t('home.last_results') || 'Last Results') + '</div>' +
        '<div class="lrc-cards">' +
        cards.map(function (card, idx) {
          var e = card.event;
          // For each card show its own event date range (not cross-series group bounds).
          var startIso = pickIsoDate(card.rangeStart) || pickIsoDate(e.start_date) || pickIsoDate(card.dateStr);
          var endIso = pickIsoDate(card.rangeEnd) || pickIsoDate(e.end_date) || startIso;
          var rangeStart = startIso || card.dateStr || '';
          var rangeEnd = endIso || rangeStart;
          var name = e.name || '—';
          var seriesIdUpper = String(e._seriesId || e.series_id || '').toUpperCase();
          // For F2/F3 strip "(Sprint)/(Feature)" from event name — already in labels.
          if (seriesIdUpper === 'F2' || seriesIdUpper === 'F3') {
            name = name.replace(/\s*\((Sprint|Feature)\)\s*$/i, '');
          }
          // For Supercars: "Melbourne SuperSprint Race 1" → "Melbourne SuperSprint".
          if (seriesIdUpper === 'SUPERCARS') {
            name = name.replace(/\s*Race\s*\d+\s*$/i, '');
          }
          var eventSlug = (e.id || '').toLowerCase().replace(/_+/g, '-');
          var seriesSlug = (e._seriesId || e.series_id || '').toLowerCase().replace(/_+/g, '-');
          var eventNameLc = String(e.name || '').toLowerCase();
          // In "Last Results" we should always open the event page.
          // Even when results are pending, the event overview is still valid.
          var href = eventSlug
            ? '/event/' + encodeURIComponent(eventSlug)
            : '/series/' + encodeURIComponent(seriesSlug);
          var delayMs = idx * 55;

          // Additional classes for background images (to be styled in CSS).
          var extraClass = '';
          var circuitName = (e.circuit_name || '').toLowerCase();
          var trackName = (e.track || '').toLowerCase();
          var location = (e.location || '').toLowerCase();
          var trackKey = [circuitName, trackName, location].filter(Boolean).join(' ');
          if (trackKey.indexOf('shanghai international circuit') >= 0) {
            extraClass += ' lrc-card--f1-2026-2';
          }
          if (trackKey.indexOf('las vegas motor speedway') >= 0) {
            extraClass += ' lrc-card--cup-2026-3';
          }
          if (trackKey.indexOf('phoenix raceway') >= 0) {
            // Same background for all series at Phoenix.
            extraClass += ' lrc-card--phoenix';
          }
          if (trackKey.indexOf('darlington raceway') >= 0) {
            extraClass += ' lrc-card--darlington';
          }
          if (trackKey.indexOf('rockingham speedway') >= 0) {
            extraClass += ' lrc-card--rockingham';
          }
          if (trackKey.indexOf('martinsville speedway') >= 0) {
            extraClass += ' lrc-card--martinsville';
          }
          if (trackKey.indexOf('suzuka circuit') >= 0 || trackKey.indexOf('suzuka international') >= 0) {
            extraClass += ' lrc-card--suzuka';
          }
          if (trackKey.indexOf('barber motorsports park') >= 0) {
            extraClass += ' lrc-card--barber';
          }
          if (trackKey.indexOf('sebring international raceway') >= 0) {
            extraClass += ' lrc-card--sebring';
          }
          if (trackKey.indexOf('streets of arlington') >= 0) {
            extraClass += ' lrc-card--indycar-2026-3';
          }
          if (trackKey.indexOf('albert park circuit') >= 0) {
            extraClass += ' lrc-card--albert-park';
          }
          if (trackKey.indexOf('mobility resort motegi') >= 0) {
            extraClass += ' lrc-card--motegi';
          }
          if (trackKey.indexOf('circuit de barcelona-catalunya') >= 0 || trackKey.indexOf('barcelona') >= 0 || trackKey.indexOf('montmelo') >= 0) {
            extraClass += ' lrc-card--barcelona';
          }
          if (trackKey.indexOf('taupo') >= 0) {
            extraClass += ' lrc-card--taupo';
          }
          if (trackKey.indexOf('okayama') >= 0 || trackKey.indexOf('okoyama') >= 0) {
            extraClass += ' lrc-card--okayama';
          }
          if (trackKey.indexOf('paul ricard') >= 0 || trackKey.indexOf('le castellet') >= 0) {
            extraClass += ' lrc-card--paul-ricard';
          }
          if (trackKey.indexOf('thompson') >= 0) {
            extraClass += ' lrc-card--thompson';
          }
          if (trackKey.indexOf('imola') >= 0) {
            extraClass += ' lrc-card--imola';
          }
          if (trackKey.indexOf('kansas speedway') >= 0 || trackKey.indexOf('kansas city, kansas') >= 0) {
            extraClass += ' lrc-card--kansas';
          }
          if (trackKey.indexOf('autopolis') >= 0) {
            extraClass += ' lrc-card--autopolis';
          }
          if (trackKey.indexOf('talladega') >= 0) {
            extraClass += ' lrc-card--talladega';
          }
          if (trackKey.indexOf('texas motor speedway') >= 0 || trackKey.indexOf('fort worth') >= 0) {
            extraClass += ' lrc-card--texas';
          }
          if (trackKey.indexOf('brands hatch') >= 0) {
            extraClass += ' lrc-card--brands-hatch';
          }
          if (trackKey.indexOf('oxford plains') >= 0 || trackKey.indexOf('oxford') >= 0) {
            extraClass += ' lrc-card--oxford-plains';
          }
          if (trackKey.indexOf('fuji') >= 0 || trackKey.indexOf('fuji speedway') >= 0) {
            extraClass += ' lrc-card--fuji';
          }
          if (trackKey.indexOf('miami international autodrome') >= 0 || trackKey.indexOf('miami') >= 0) {
            extraClass += ' lrc-card--miami';
          }
          if (trackKey.indexOf('gilles villeneuve') >= 0 || trackKey.indexOf('circuit gilles') >= 0 || trackKey.indexOf('montreal') >= 0) {
            extraClass += ' lrc-card--montreal';
          }
          if (trackKey.indexOf('laguna seca') >= 0 || trackKey.indexOf('weathertech raceway') >= 0 || trackKey.indexOf('monterey') >= 0) {
            extraClass += ' lrc-card--laguna-seca';
          }
          if (trackKey.indexOf('misano world circuit') >= 0 || trackKey.indexOf('circuit marco simoncelli') >= 0) {
            extraClass += ' lrc-card--misano';
          }
          if (trackKey.indexOf('watkins glen') >= 0) {
            extraClass += ' lrc-card--watkins-glen';
          }
          if (trackKey.indexOf('indianapolis motor speedway road') >= 0) {
            extraClass += ' lrc-card--indianapolis-rc';
          } else if (trackKey.indexOf('indianapolis motor speedway') >= 0) {
            extraClass += ' lrc-card--indianapolis-ims';
          }
          if (trackKey.indexOf('spa-francorchamps') >= 0) {
            extraClass += ' lrc-card--spa-francorchamps';
          }
          if (trackKey.indexOf('red bull ring') >= 0 || trackKey.indexOf('spielberg') >= 0) {
            extraClass += ' lrc-card--red-bull-ring';
          }
          if (trackKey.indexOf('long beach') >= 0) {
            extraClass += ' lrc-card--long-beach';
          }
          if (trackKey.indexOf('euromarque') >= 0 || trackKey.indexOf('christchurch') >= 0) {
            extraClass += ' lrc-card--euromarque';
          }
          if (trackKey.indexOf('dover motor speedway') >= 0 || (trackKey.indexOf('dover') >= 0 && trackKey.indexOf('delaware') >= 0)) {
            extraClass += ' lrc-card--dover';
          }
          if (trackKey.indexOf('seekonk') >= 0) {
            extraClass += ' lrc-card--seekonk';
          }
          if (trackKey.indexOf('moscow raceway') >= 0) {
            extraClass += ' lrc-card--moscow-raceway';
          }
          if (trackKey.indexOf('toledo speedway') >= 0) {
            extraClass += ' lrc-card--toledo';
          }
          if (trackKey.indexOf('charlotte motor speedway') >= 0) {
            extraClass += ' lrc-card--charlotte';
          }
          if (trackKey.indexOf('circuit zandvoort') >= 0 || trackKey.indexOf('zandvoort') >= 0) {
            extraClass += ' lrc-card--zandvoort';
          }
          if (trackKey.indexOf('vallelunga') >= 0) {
            extraClass += ' lrc-card--vallelunga';
          }
          if (trackKey.indexOf('symmons plains') >= 0) {
            extraClass += ' lrc-card--symmons-plains';
          }
          if (trackKey.indexOf('monaco') >= 0) {
            extraClass += ' lrc-card--monaco';
          }
          if (trackKey.indexOf('monza') >= 0) {
            extraClass += ' lrc-card--monza';
          }
          if (trackKey.indexOf('michigan international speedway') >= 0 || trackKey.indexOf('michigan speedway') >= 0) {
            extraClass += ' lrc-card--michigan';
          }
          if (trackKey.indexOf('nashville superspeedway') >= 0) {
            extraClass += ' lrc-card--nashville-superspeedway';
          }
          if (trackKey.indexOf('riverhead raceway') >= 0) {
            extraClass += ' lrc-card--riverhead-raceway';
          }
          if (trackKey.indexOf('streets of detroit') >= 0) {
            extraClass += ' lrc-card--streets-of-detroit';
          }
          if (trackKey.indexOf('world wide technology raceway') >= 0) {
            extraClass += ' lrc-card--world-wide-technology-raceway';
          }
          if (trackKey.indexOf('kazan ring') >= 0 || trackKey.indexOf('kazan') >= 0) {
            extraClass += ' lrc-card--kazan-ring';
          }
          if (trackKey.indexOf('circuit de la sarthe') >= 0 || (
            trackKey.indexOf('le mans') >= 0 && trackKey.indexOf('lone star') < 0 && trackKey.indexOf('austin') < 0
          )) {
            extraClass += ' lrc-card--circuit-de-la-sarthe';
          }
          if (trackKey.indexOf('road america') >= 0) {
            extraClass += ' lrc-card--road-america';
          }
          if (trackKey.indexOf('white mountain') >= 0) {
            extraClass += ' lrc-card--white-mountain-motorsports-park';
          }
          if (trackKey.indexOf('berlin raceway') >= 0) {
            extraClass += ' lrc-card--berlin-raceway';
          }
          if (trackKey.indexOf('lausitzring') >= 0 || trackKey.indexOf('lausitz') >= 0) {
            extraClass += ' lrc-card--lausitzring';
          }
          if (trackKey.indexOf('hidden valley') >= 0) {
            extraClass += ' lrc-card--hidden-valley-raceway';
          }
          if (trackKey.indexOf('sepang') >= 0) {
            extraClass += ' lrc-card--sepang';
          }
          if (trackKey.indexOf('coronado') >= 0) {
            extraClass += ' lrc-card--coronado-street';
          }
          if (eventNameLc.indexOf('taupo') >= 0 || eventNameLc.indexOf('taupō') >= 0) {
            extraClass += ' lrc-card--taupo';
          }
          if (eventNameLc.indexOf('okayama') >= 0 || eventNameLc.indexOf('okoyama') >= 0) {
            extraClass += ' lrc-card--okayama';
          }
          if (eventNameLc.indexOf('paul ricard') >= 0 || eventNameLc.indexOf('le castellet') >= 0) {
            extraClass += ' lrc-card--paul-ricard';
          }
          if (eventNameLc.indexOf('thompson') >= 0) {
            extraClass += ' lrc-card--thompson';
          }
          if (eventNameLc.indexOf('imola') >= 0) {
            extraClass += ' lrc-card--imola';
          }
          if (eventNameLc.indexOf('kansas') >= 0) {
            extraClass += ' lrc-card--kansas';
          }
          if (eventNameLc.indexOf('autopolis') >= 0) {
            extraClass += ' lrc-card--autopolis';
          }
          if (eventNameLc.indexOf('talladega') >= 0) {
            extraClass += ' lrc-card--talladega';
          }
          if (eventNameLc.indexOf('texas') >= 0 || eventNameLc.indexOf('fort worth') >= 0) {
            extraClass += ' lrc-card--texas';
          }
          if (eventNameLc.indexOf('brands hatch') >= 0) {
            extraClass += ' lrc-card--brands-hatch';
          }
          if (eventNameLc.indexOf('oxford plains') >= 0 || eventNameLc.indexOf('oxford') >= 0) {
            extraClass += ' lrc-card--oxford-plains';
          }
          if (eventNameLc.indexOf('fuji') >= 0) {
            extraClass += ' lrc-card--fuji';
          }
          if (eventNameLc.indexOf('miami') >= 0) {
            extraClass += ' lrc-card--miami';
          }
          if (eventNameLc.indexOf('gilles villeneuve') >= 0 || eventNameLc.indexOf('montreal') >= 0 || eventNameLc.indexOf('canadian grand prix') >= 0) {
            extraClass += ' lrc-card--montreal';
          }
          if (eventNameLc.indexOf('laguna seca') >= 0 || eventNameLc.indexOf('weathertech raceway') >= 0 || eventNameLc.indexOf('monterey') >= 0) {
            extraClass += ' lrc-card--laguna-seca';
          }
          if (eventNameLc.indexOf('misano') >= 0 && (
            eventNameLc.indexOf('marco simoncelli') >= 0 ||
            eventNameLc.indexOf('italian f4') >= 0 ||
            eventNameLc.indexOf('gt world challenge') >= 0
          )) {
            extraClass += ' lrc-card--misano';
          }
          if (eventNameLc.indexOf('watkins glen') >= 0) {
            extraClass += ' lrc-card--watkins-glen';
          }
          if (eventNameLc.indexOf('sonsio grand prix') >= 0) {
            extraClass += ' lrc-card--indianapolis-rc';
          }
          if (eventNameLc.indexOf('indianapolis 500') >= 0 || eventNameLc.indexOf('brickyard 400') >= 0 || eventNameLc.indexOf('battle on the bricks') >= 0) {
            extraClass += ' lrc-card--indianapolis-ims';
          }
          if (eventNameLc.indexOf('spa-francorchamps') >= 0 || (
            eventNameLc.indexOf('crowdstrike') >= 0 && eventNameLc.indexOf('spa') >= 0
          )) {
            extraClass += ' lrc-card--spa-francorchamps';
          }
          if (eventNameLc.indexOf('red bull ring') >= 0 || eventNameLc.indexOf('spielberg') >= 0) {
            extraClass += ' lrc-card--red-bull-ring';
          }
          if (eventNameLc.indexOf('long beach') >= 0) {
            extraClass += ' lrc-card--long-beach';
          }
          if (eventNameLc.indexOf('euromarque') >= 0) {
            extraClass += ' lrc-card--euromarque';
          }
          if (eventNameLc.indexOf('dover motor speedway') >= 0) {
            extraClass += ' lrc-card--dover';
          }
          if (eventNameLc.indexOf('seekonk') >= 0) {
            extraClass += ' lrc-card--seekonk';
          }
          if (eventNameLc.indexOf('moscow raceway') >= 0 || (eventNameLc.indexOf('smp f4') >= 0 && eventNameLc.indexOf('moscow') >= 0)) {
            extraClass += ' lrc-card--moscow-raceway';
          }
          if (eventNameLc.indexOf('toledo speedway') >= 0) {
            extraClass += ' lrc-card--toledo';
          }
          if (eventNameLc.indexOf('charlotte motor speedway') >= 0 || eventNameLc.indexOf('coca-cola 600') >= 0) {
            extraClass += ' lrc-card--charlotte';
          }
          if (eventNameLc.indexOf('zandvoort') >= 0 || eventNameLc.indexOf('dutch grand prix') >= 0) {
            extraClass += ' lrc-card--zandvoort';
          }
          if (eventNameLc.indexOf('vallelunga') >= 0) {
            extraClass += ' lrc-card--vallelunga';
          }
          if (eventNameLc.indexOf('symmons plains') >= 0) {
            extraClass += ' lrc-card--symmons-plains';
          }
          if (eventNameLc.indexOf('monaco') >= 0 || eventNameLc.indexOf('monte carlo') >= 0) {
            extraClass += ' lrc-card--monaco';
          }
          if (eventNameLc.indexOf('monza') >= 0 || eventNameLc.indexOf('italian grand prix') >= 0) {
            extraClass += ' lrc-card--monza';
          }
          if (eventNameLc.indexOf('michigan') >= 0) {
            extraClass += ' lrc-card--michigan';
          }
          if (eventNameLc.indexOf('nashville superspeedway') >= 0) {
            extraClass += ' lrc-card--nashville-superspeedway';
          }
          if (eventNameLc.indexOf('riverhead') >= 0) {
            extraClass += ' lrc-card--riverhead-raceway';
          }
          if (eventNameLc.indexOf('detroit') >= 0) {
            extraClass += ' lrc-card--streets-of-detroit';
          }
          if (eventNameLc.indexOf('world wide technology') >= 0) {
            extraClass += ' lrc-card--world-wide-technology-raceway';
          }
          if (eventNameLc.indexOf('pocono') >= 0) {
            extraClass += ' lrc-card--pocono';
          }
          if (eventNameLc.indexOf('kazan') >= 0) {
            extraClass += ' lrc-card--kazan-ring';
          }
          if (eventNameLc.indexOf('24 hours of le mans') >= 0 || eventNameLc.indexOf('hours of le mans') >= 0) {
            extraClass += ' lrc-card--circuit-de-la-sarthe';
          }
          if (eventNameLc.indexOf('road america') >= 0) {
            extraClass += ' lrc-card--road-america';
          }
          if (eventNameLc.indexOf('white mountain') >= 0) {
            extraClass += ' lrc-card--white-mountain-motorsports-park';
          }
          if (eventNameLc.indexOf('berlin raceway') >= 0) {
            extraClass += ' lrc-card--berlin-raceway';
          }
          if (eventNameLc.indexOf('lausitzring') >= 0 || eventNameLc.indexOf('lausitz') >= 0) {
            extraClass += ' lrc-card--lausitzring';
          }
          if (eventNameLc.indexOf('hidden valley') >= 0) {
            extraClass += ' lrc-card--hidden-valley-raceway';
          }
          if (eventNameLc.indexOf('sepang') >= 0) {
            extraClass += ' lrc-card--sepang';
          }
          if (eventNameLc.indexOf('coronado') >= 0) {
            extraClass += ' lrc-card--coronado-street';
          }
          if (trackKey.indexOf('pocono raceway') >= 0) {
            extraClass += ' lrc-card--pocono';
          }
          if (trackKey.indexOf('bristol') >= 0) {
            extraClass += ' lrc-card--bristol';
          }
          if (!extraClass) {
            if (eventSlug === 'f1-2026-2') {
              extraClass += ' lrc-card--f1-2026-2';
            } else if (eventSlug === 'nascar-cup-2026-5' || eventSlug === 'cup-2026-5' || eventSlug === 'noaps-2026-5') {
              extraClass += ' lrc-card--cup-2026-3';
            } else if (eventSlug === 'indycar-2026-3') {
              extraClass += ' lrc-card--indycar-2026-3';
            } else if (eventSlug === 'super-formula-2026-1') {
              extraClass += ' lrc-card--motegi';
            } else if (eventSlug === 'elms-2026-prologue') {
              extraClass += ' lrc-card--barcelona';
            } else if (eventSlug.indexOf('taupo') >= 0) {
              extraClass += ' lrc-card--taupo';
            } else if (eventSlug.indexOf('bristol') >= 0) {
              extraClass += ' lrc-card--bristol';
            } else if (eventSlug.indexOf('okayama') >= 0 || eventSlug.indexOf('okoyama') >= 0) {
              extraClass += ' lrc-card--okayama';
            } else if (eventSlug.indexOf('ricard') >= 0 || eventSlug.indexOf('le-castellet') >= 0) {
              extraClass += ' lrc-card--paul-ricard';
            } else if (eventSlug.indexOf('thompson') >= 0) {
              extraClass += ' lrc-card--thompson';
            } else if (eventSlug.indexOf('imola') >= 0) {
              extraClass += ' lrc-card--imola';
            } else if (eventSlug.indexOf('kansas') >= 0) {
              extraClass += ' lrc-card--kansas';
            } else if (eventSlug.indexOf('autopolis') >= 0) {
              extraClass += ' lrc-card--autopolis';
            } else if (eventSlug.indexOf('talladega') >= 0) {
              extraClass += ' lrc-card--talladega';
            } else if (eventSlug.indexOf('texas') >= 0 || eventSlug.indexOf('fort-worth') >= 0 || eventSlug.indexOf('fort_worth') >= 0) {
              extraClass += ' lrc-card--texas';
            } else if (eventSlug.indexOf('brands-hatch') >= 0 || eventSlug.indexOf('brands_hatch') >= 0) {
              extraClass += ' lrc-card--brands-hatch';
            } else if (eventSlug.indexOf('oxford-plains') >= 0 || eventSlug.indexOf('oxford_plains') >= 0 || eventSlug.indexOf('oxford') >= 0) {
              extraClass += ' lrc-card--oxford-plains';
            } else if (eventSlug.indexOf('fuji') >= 0) {
              extraClass += ' lrc-card--fuji';
            } else if (eventSlug.indexOf('miami') >= 0) {
              extraClass += ' lrc-card--miami';
            } else if (eventSlug.indexOf('montreal') >= 0 || eventSlug.indexOf('gilles-villeneuve') >= 0 || eventSlug.indexOf('gilles_villeneuve') >= 0 || eventSlug === 'f2-2026-3' || eventSlug === 'f1-2026-7') {
              extraClass += ' lrc-card--montreal';
            } else if (eventSlug.indexOf('laguna-seca') >= 0 || eventSlug.indexOf('laguna_seca') >= 0 || eventSlug.indexOf('monterey') >= 0) {
              extraClass += ' lrc-card--laguna-seca';
            } else if (
              eventSlug === 'gtwce-sprint-2026-2' ||
              eventSlug === 'f4-it-2026-1' ||
              eventSlug === 'f4-it-2026-6' ||
              eventSlug.indexOf('misano') >= 0
            ) {
              extraClass += ' lrc-card--misano';
            } else if (eventSlug.indexOf('watkins') >= 0 || eventSlug.indexOf('watkins-glen') >= 0) {
              extraClass += ' lrc-card--watkins-glen';
            } else if (eventSlug === 'indycar-2026-6') {
              extraClass += ' lrc-card--indianapolis-rc';
            } else if (eventSlug === 'indycar-2026-7' || eventSlug.indexOf('imsa-2026-10') >= 0) {
              extraClass += ' lrc-card--indianapolis-ims';
            } else if (
              eventSlug.indexOf('spa-francorchamps') >= 0 ||
              (eventSlug.indexOf('elms') >= 0 && eventSlug.indexOf('spa') >= 0) ||
              (eventSlug.indexOf('wec') >= 0 && eventSlug.indexOf('spa') >= 0) ||
              (eventSlug.indexOf('f2') >= 0 && eventSlug.indexOf('spa') >= 0) ||
              (eventSlug.indexOf('f3') >= 0 && eventSlug.indexOf('spa') >= 0) ||
              (eventSlug.indexOf('frec') >= 0 && eventSlug.indexOf('spa') >= 0) ||
              (eventSlug.indexOf('psc') >= 0 && eventSlug.indexOf('spa') >= 0) ||
              (eventSlug.indexOf('gtwce-end') >= 0 && eventSlug.indexOf('spa') >= 0) ||
              eventSlug === 'f1-2025-13' ||
              eventSlug === 'f1-2026-12'
            ) {
              extraClass += ' lrc-card--spa-francorchamps';
            } else if (eventSlug.indexOf('red-bull-ring') >= 0 || eventSlug.indexOf('red_bull_ring') >= 0 || eventSlug.indexOf('spielberg') >= 0) {
              extraClass += ' lrc-card--red-bull-ring';
            } else if (eventSlug.indexOf('long-beach') >= 0 || eventSlug.indexOf('long_beach') >= 0) {
              extraClass += ' lrc-card--long-beach';
            } else if (eventSlug.indexOf('euromarque') >= 0) {
              extraClass += ' lrc-card--euromarque';
            } else if (eventSlug.indexOf('dover') >= 0 || eventSlug.indexOf('allstar') >= 0 || eventSlug.indexOf('all-star') >= 0) {
              extraClass += ' lrc-card--dover';
            } else if (eventSlug.indexOf('seekonk') >= 0) {
              extraClass += ' lrc-card--seekonk';
            } else if (eventSlug.indexOf('moscow-raceway') >= 0 || eventSlug.indexOf('moscow_raceway') >= 0 || (eventSlug.indexOf('smp-f4') >= 0 && eventSlug.indexOf('moscow') >= 0)) {
              extraClass += ' lrc-card--moscow-raceway';
            } else if (eventSlug.indexOf('toledo-speedway') >= 0 || eventSlug.indexOf('toledo_speedway') >= 0 || eventSlug.indexOf('toledo') >= 0) {
              extraClass += ' lrc-card--toledo';
            } else if (eventSlug.indexOf('charlotte') >= 0) {
              extraClass += ' lrc-card--charlotte';
            } else if (eventSlug.indexOf('zandvoort') >= 0) {
              extraClass += ' lrc-card--zandvoort';
            } else if (eventSlug.indexOf('vallelunga') >= 0) {
              extraClass += ' lrc-card--vallelunga';
            } else if (eventSlug.indexOf('symmons-plains') >= 0 || eventSlug.indexOf('symmons_plains') >= 0 || eventSlug.indexOf('symmons') >= 0) {
              extraClass += ' lrc-card--symmons-plains';
            } else if (eventSlug.indexOf('brickyard') >= 0 || (eventSlug.indexOf('indianapolis') >= 0 && eventSlug.indexOf('indycar-2026-6') < 0)) {
              extraClass += ' lrc-card--indianapolis-ims';
            } else if (eventSlug.indexOf('monaco') >= 0) {
              extraClass += ' lrc-card--monaco';
            } else if (eventSlug.indexOf('monza') >= 0) {
              extraClass += ' lrc-card--monza';
            } else if (eventSlug.indexOf('michigan') >= 0) {
              extraClass += ' lrc-card--michigan';
            } else if (eventSlug.indexOf('nashville') >= 0) {
              extraClass += ' lrc-card--nashville-superspeedway';
            } else if (eventSlug.indexOf('riverhead') >= 0) {
              extraClass += ' lrc-card--riverhead-raceway';
            } else if (eventSlug.indexOf('detroit') >= 0) {
              extraClass += ' lrc-card--streets-of-detroit';
            } else if (eventSlug.indexOf('world-wide-technology') >= 0 || eventSlug.indexOf('wwtr') >= 0) {
              extraClass += ' lrc-card--world-wide-technology-raceway';
            } else if (eventSlug.indexOf('pocono') >= 0) {
              extraClass += ' lrc-card--pocono';
            } else if (eventSlug.indexOf('kazan') >= 0) {
              extraClass += ' lrc-card--kazan-ring';
            } else if (
              eventSlug === 'wec-2026-3' ||
              (eventSlug.indexOf('le-mans') >= 0 &&
                eventSlug.indexOf('lone-star') < 0 &&
                eventSlug.indexOf('cota') < 0)
            ) {
              extraClass += ' lrc-card--circuit-de-la-sarthe';
            }
          }

          if (extraClass) {
            extraClass += ' race-card-photo';
          }

          // Extra classes by series (for F2/F3 winner styling).
          if (seriesIdUpper === 'F2') {
            extraClass += ' lrc-card--f2';
          } else if (seriesIdUpper === 'F3') {
            extraClass += ' lrc-card--f3';
          } else if (seriesIdUpper === 'SUPERCARS') {
            extraClass += ' lrc-card--supercars';
          } else if (seriesIdUpper === 'FREC') {
            extraClass += ' lrc-card--frec';
          } else if (seriesIdUpper === 'IMSA') {
            extraClass += ' lrc-card--imsa';
          } else if (seriesIdUpper === 'WEC') {
            extraClass += ' lrc-card--wec';
          } else if (seriesIdUpper === 'ELMS') {
            extraClass += ' lrc-card--elms';
          } else if (seriesIdUpper === 'GTWCE_END' || seriesIdUpper === 'GTWCE_SPRINT') {
            extraClass += ' lrc-card--gtwce';
          } else if (seriesIdUpper === 'SUPER_GT') {
            extraClass += ' lrc-card--super-gt';
          }

          // Winners: for regular events show one row,
          // for F2/F3 and Supercars — winners of all weekend races (within reasonable limit).
          var winnerHtml = '';
          var list = Array.isArray(card.winners) ? card.winners : [];
          if (list.length > 0) {
            if (seriesIdUpper === 'IMSA') {
              // IMSA: show class winners (up to 4 lines).
              winnerHtml = list.slice(0, 4).map(function (w) {
                var line = w.name || '';
                if (w.car) line = '#' + w.car + ' ' + line;
                var label = (w.label || '').trim();
                if (label) line = line + ' — ' + label;
                return esc(line);
              }).join('<br>');
            } else if (seriesIdUpper === 'WEC') {
              // WEC: "class — crew" (Hypercar / LMP2 / LMGT3).
              winnerHtml = list.slice(0, 4).map(function (w) {
                var crew = w.name || '';
                if (w.car) crew = '#' + w.car + ' ' + crew;
                var label = (w.label || '').trim();
                var line = label ? label + ' — ' + crew : crew;
                return '<span class="lrc-winner-line">' + esc(line) + '</span>';
              }).join('');
            } else if (seriesIdUpper === 'ELMS') {
              // ELMS: class winners — «Label - Team #no» (.lrc-winner-line — display:block).
              winnerHtml = list.slice(0, 4).map(function (w) {
                var line = w.name || '';
                if (w.car) line = line + ' #' + w.car;
                var label = (w.label || '').trim();
                if (label) line = label + ' - ' + line;
                return '<span class="lrc-winner-line">' + esc(line) + '</span>';
              }).join('');
            } else if (seriesIdUpper === 'GTWCE_END') {
              // GTWCE Endurance: "Label - #no Team" (crew = number + team).
              winnerHtml = list.slice(0, 4).map(function (w) {
                var crew = w.name || '';
                var line = w.car ? '#' + w.car + ' ' + crew : crew;
                var label = (w.label || '').trim();
                if (label) line = label + ' - ' + line;
                return '<span class="lrc-winner-line">' + esc(line) + '</span>';
              }).join('');
            } else if (seriesIdUpper === 'GTWCE_SPRINT') {
              // GTWCE Sprint: absolute Race 1 / Race 2 winners only — team and # (no driver names).
              winnerHtml = list.slice(0, 2).map(function (w) {
                var line = w.name || '';
                if (w.car) line = line + ' #' + w.car;
                var label = (w.label || '').trim();
                if (label) line = label + ' - ' + line;
                return '<span class="lrc-winner-line">' + esc(line) + '</span>';
              }).join('');
            } else if (seriesIdUpper === 'FREC') {
              // FREC: compact 3-line format to fit Race 1/2/3 winners.
              winnerHtml = list.slice(0, 3).map(function (w) {
                var line = w.name || '';
                if (w.car) line = '#' + w.car + ' ' + line;
                var label = String(w.label || '').trim();
                var rm = label.match(/race\s*(\d+)/i);
                if (rm && rm[1]) label = 'R' + rm[1];
                if (label) line = label + ': ' + line;
                return esc(line);
              }).join('<br>');
            } else if (seriesIdUpper === 'F1' && card.isF1SprintWeekend) {
              // F1 sprint weekends only: "Sprint - #1 …" / "Feature - #12 …".
              winnerHtml = list.slice(0, 4).map(function (w) {
                var label = (w.label || '').trim();
                var line = w.name || '';
                if (w.car) line = '#' + w.car + ' ' + line;
                if (label) line = label + ' - ' + line;
                return esc(line);
              }).join('<br>');
            } else if (seriesIdUpper === 'F1' || seriesIdUpper === 'F2' || seriesIdUpper === 'F3' || seriesIdUpper === 'SUPERCARS' || seriesIdUpper === 'SUPER_FORMULA' || seriesIdUpper === 'SUPER_GT' || seriesIdUpper === 'DTM') {
              // F1/F2/F3: usually Sprint / Feature / Race. Supercars: multiple races (Race 4–7).
              // Super GT: two winners by class (GT500 + GT300). DTM: Race 1 + Race 2.
              // Limit to first four so card does not grow too large.
              winnerHtml = list.slice(0, 4).map(function (w) {
                var line = w.name || '';
                if (w.car) {
                  line = '#' + w.car + ' ' + line;
                }
                var label = (w.label || '').trim();
                if (label) {
                  line = line + ' — ' + label;
                }
                return esc(line);
              }).join('<br>');
            } else if (list.length === 1) {
              var w1 = list[0] || {};
              var line1 = w1.name || '';
              if (w1.car) {
                line1 = '#' + w1.car + ' ' + line1;
              }
              winnerHtml = esc(line1);
            }
          }

          var noDataYet = !winnerHtml;
          var eventIdUpper = String(e.id || '').toUpperCase();
          var isPrologueOrPreSeason =
            eventIdUpper.indexOf('PROLOGUE') >= 0 ||
            eventIdUpper.indexOf('PRE_SEASON_TEST') >= 0 ||
            /\bprologue\b/i.test(String(name || ''));
          var pendingHtml = noDataYet
            ? (isPrologueOrPreSeason
              ? ''
              : '<div class="lrc-winner lrc-winner--pending">' + esc(card.raceWasCancelled ? 'Race was cancelled' : (t('home.awaiting_results') || 'Results pending')) + '</div>')
            : '';

          return (
            '<a href="' + href + '" class="lrc-card lrc-card-enter' + ((noDataYet && !isPrologueOrPreSeason) ? ' lrc-card--pending' : '') + extraClass + '" style="animation-delay:' + delayMs + 'ms">' +
              '<div class="lrc-top">' +
                seriesBadge(e._seriesId || e.series_id || '') +
                '<span class="lrc-date">' + esc(window.TGA.formatDateRangeLong ? window.TGA.formatDateRangeLong(rangeStart, rangeEnd) : (window.TGA.formatDateRange ? window.TGA.formatDateRange(rangeStart, rangeEnd) : formatShortDate(rangeStart))) + '</span>' +
              '</div>' +
              '<div class="lrc-name">' + esc(name) + '</div>' +
              (winnerHtml ? '<div class="lrc-winner">' + winnerHtml + '</div>' : pendingHtml) +
            '</a>'
          );
        }).join('') +
        '</div>';

      container.classList.remove('hidden');
    });
  }

  window.TGA.renderLastResultsCards = renderLastResultsCards;
})();

