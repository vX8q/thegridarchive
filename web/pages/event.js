// web/pages/event.js — event detail page (renderEventPage)
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  window.TGA = window.TGA || {};

  var P = window.TGA.pageDeps();
  var t = P.t;
  var getLang = P.getLang;
  var esc = P.esc;
  var dash = P.dash;
  var slugify = P.slugify;
  var driverTableCell = P.driverTableCell;
  var localizeDriverNamesInText = P.localizeDriverNamesInText;
  var isGuestEntryRow = P.isGuestEntryRow;
  var guestCarNumberSet = P.guestCarNumberSet;
  var entryListDriverCell = P.entryListDriverCell;
  var entryListDriverLabel = P.entryListDriverLabel;
  var localizeStatKey = P.localizeStatKey;
  var localizeStatValue = P.localizeStatValue;
  var localizeSpecKey = P.localizeSpecKey;
  var localizeSpecValue = P.localizeSpecValue;
  var normalizeSpecKey = P.normalizeSpecKey;
  var specKeySkip = P.specKeySkip;
  var localizeTableHeader = P.localizeTableHeader;
  var localizeCellNote = P.localizeCellNote;
  var localizeRaceReason = P.localizeRaceReason;
  var localizeCautionFlagLabel = P.localizeCautionFlagLabel;
  var translateValueHeaders = P.translateValueHeaders;
  var translateReasonHeaders = P.translateReasonHeaders;
  var localizeDate = P.localizeDate;
  var localizeDistance = P.localizeDistance;
  var localizeEventPreview = P.localizeEventPreview;
  var localizeTyreCompounds = P.localizeTyreCompounds;
  var localizeSectionTitle = P.localizeSectionTitle;
  var localizeCompoundLegend = P.localizeCompoundLegend;
  var localizeCircuitName = P.localizeCircuitName;
  var localizeLocation = P.localizeLocation;
  var localizeDriverName = P.localizeDriverName;
  var localizeEventName = P.localizeEventName;
  var localizeEventFromData = P.localizeEventFromData;
  var localizeRacingClass = P.localizeRacingClass;
  var teamLabel = P.teamLabel;
  var localizeQualifyingSeparator = P.localizeQualifyingSeparator;
  var documentTitle = P.documentTitle;
  var trimTrailingZeros = P.trimTrailingZeros;
  var countryHtml = P.countryHtml;
  var categories = P.categories;
  var categoryBySeriesId = P.categoryBySeriesId;
  var seriesBadge = P.seriesBadge;
  var formatShortDate = P.formatShortDate;
  var formatDateRange = P.formatDateRange;
  var parseEventDate = P.parseEventDate;
  var formatDateRangeLong = P.formatDateRangeLong;
  var buildEventMetaDate = P.buildEventMetaDate || (window.TGA && window.TGA.buildEventMetaDate);
  var getEventSessionDateRange = P.getEventSessionDateRange;
  var addObjectTableSort = P.addObjectTableSort;
  var typeLabel = P.typeLabel;
  var syncStandingsScrollBars = P.syncStandingsScrollBars;
  var adjustEventPanelPadding = P.adjustEventPanelPadding;
  var adjustDetailPanelPadding = P.adjustDetailPanelPadding;
  var renderSupercarsStaticSpecs = P.renderSupercarsStaticSpecs;
  var translateStaticUI = P.translateStaticUI;
  var logger = P.logger;
  var state = P.state;
  var API = P.API;

  function teamLink(name) { return window.TGA.teamLink(name); }
  function renderDriverCell(name, joiner) { return window.TGA.renderDriverCell(name, joiner); }
  function dropStartPosColumn(tableData) { return window.TGA.dropStartPosColumn(tableData); }
  function splitTeamCarDropSponsor(tableData) { return window.TGA.splitTeamCarDropSponsor(tableData); }
  function dropColumnsByHeader(tableData, names) { return window.TGA.dropColumnsByHeader(tableData, names); }
  function applyClassFromEntryList(tableData, entryList) { return window.TGA.applyClassFromEntryList(tableData, entryList); }
  function recomputeClassPos(tableData) { return window.TGA.recomputeClassPos(tableData); }
  function transformImsaRaceTable(headers, rows, qualRows) { return window.TGA.transformImsaRaceTable(headers, rows, qualRows); }
  function normalizeImsaQualTableForEvent(tableData, evKey, entryList) {
    return window.TGA.normalizeImsaQualTable(tableData, evKey, entryList);
  }
  function gtwceEndTimedSessionTableData(tableData, evKey) {
    return window.TGA.gtwceEndTimedSessionTableData(tableData, evKey);
  }
  function tgaStageTable(tables, n) { return window.TGA.tgaStageTable(tables, n); }
  function seriesUsesStages(seriesId) { return window.TGA.seriesUsesStages(seriesId); }
  function isStockCarSeriesId(seriesId) { return window.TGA.isStockCarSeriesId(seriesId); }
  function stockCarHasStageFormat(d, tbls) { return window.TGA.stockCarHasStageFormat(d, tbls); }
  function hasStage4(d, tbls) { return window.TGA.hasStage4(d, tbls); }
  function isAllstarStageRace(tables) { return window.TGA.isAllstarStageRace(tables); }
  function shouldSkipStage3PointsTable(isStockCar, fourStage, tbls) {
    return window.TGA.shouldSkipStage3PointsTable(isStockCar, fourStage, tbls);
  }
  function stockCarStage3TableTitle(d, tbls, isStockCar) {
    return window.TGA.stockCarStage3TableTitle(d, tbls, isStockCar, t);
  }
  function stockCarRaceResultsTitles(d, stageFormat, fourStage, isStockCar) {
    return window.TGA.stockCarRaceResultsTitles(d, stageFormat, fourStage, isStockCar, t);
  }
  function qualifyingExcludingDidNotQualify(qualTable, dnqTable) {
    return window.TGA.qualifyingExcludingDidNotQualify(qualTable, dnqTable);
  }
  function cautionBreakdownRowClass(row, headers) {
    return window.TGA.cautionBreakdownRowClass(row, headers);
  }
  function isOpenwheelJuniorSeries(seriesId) { return window.TGA.isOpenwheelJuniorSeries(seriesId); }
  function shouldSkipOpenwheelRaceVenueSubtitle(seriesId) {
    return window.TGA.shouldSkipOpenwheelRaceVenueSubtitle(seriesId);
  }
  function shouldHideOpenwheelSessionSubtitle(seriesId, subtitle, ev) {
    return window.TGA.shouldHideOpenwheelSessionSubtitle(seriesId, subtitle, ev);
  }
  function openwheelSessionTableTitle(tbl, fallback, seriesId) {
    return window.TGA.openwheelSessionTableTitle(tbl, fallback, seriesId);
  }
  function openwheelSessionDisplayTitle(title, seriesId, fallback) {
    return window.TGA.openwheelSessionDisplayTitle(title, seriesId, fallback);
  }
  function shouldShowSessionMetaTable(evKey, seriesId) {
    return window.TGA.shouldShowSessionMetaTable(evKey, seriesId);
  }
  function shouldShowOpenwheelQualResultsHeading(evKey, seriesId) {
    return window.TGA.shouldShowOpenwheelQualResultsHeading(evKey, seriesId);
  }
  function transformTableDataForF2F3(tableData, evKey) {
    return window.TGA.transformTableDataForF2F3(tableData, evKey);
  }
  function normalizeF1RaceGridColumn(tbl) { return window.TGA.normalizeF1RaceGridColumn(tbl); }
  function localizeF1RaceSessionTitle(titleText, evKey) {
    return window.TGA.localizeF1RaceSessionTitle(titleText, evKey, t);
  }
  function isTouringSeriesId(seriesId) { return window.TGA.isTouringSeriesId(seriesId); }
  function isSupercarsSeriesId(seriesId) { return window.TGA.isSupercarsSeriesId(seriesId); }
  function isIndycarSeriesId(seriesId) { return window.TGA.isIndycarSeriesId(seriesId); }
  function isSuperGtSeriesId(seriesId) { return window.TGA.isSuperGtSeriesId(seriesId); }
  function isSuperGtRaceClassTitle(seriesId, titleText) {
    return window.TGA.isSuperGtRaceClassTitle(seriesId, titleText);
  }
  function shouldHideStartingLineupOnRaceTab(seriesId) {
    return window.TGA.shouldHideStartingLineupOnRaceTab(seriesId);
  }
  function normalizeFinStTable(tbl) { return window.TGA.normalizeFinStTable(tbl); }
  function transformSupercarsRaceTable(headers, rows, byNumber) {
    return window.TGA.transformSupercarsRaceTable(headers, rows, byNumber);
  }
  function normalizeIndycarRaceTable(tbl) { return window.TGA.normalizeIndycarRaceTable(tbl); }
  function normalizeSupercarsTableNumberColumn(tableData, colIdx) {
    return window.TGA.normalizeSupercarsTableNumberColumn(tableData, colIdx);
  }
  function isSupercarsSydneyEvent(evKey) { return window.TGA.isSupercarsSydneyEvent(evKey); }
  function supercarsSydneyCarDisplay(tableData) { return window.TGA.supercarsSydneyCarDisplay(tableData); }
  function dropIndycarCautionFreePassColumn(tableData) {
    return window.TGA.dropIndycarCautionFreePassColumn(tableData);
  }
  function dropTouringRaceDisplayColumns(tableData, seriesId, evKey) {
    return window.TGA.dropTouringRaceDisplayColumns(tableData, seriesId, evKey);
  }
  function expandSupercarsSubstituteEntryRows(rows) {
    return window.TGA.expandSupercarsSubstituteEntryRows(rows);
  }
  function splitSuperGtRaceBlockByClass(raceBlock) {
    return window.TGA.splitSuperGtRaceBlockByClass(raceBlock);
  }

  function makeTableSortable() { return P.makeTableSortable.apply(null, arguments); }
  function makeSimpleTableSortable(tableEl) { P.makeSimpleTableSortable(tableEl); }
  function showView(activeId) { P.showView(activeId); }

  function eventSeriesId(eventId) {
    if (!eventId) return '';
    var u = String(eventId).toUpperCase();
    // Universally extract series_id from event_id:
    // SUPER_FORMULA_2026_1 -> SUPER_FORMULA, NASCAR_TRUCK_2026_5 -> NASCAR_TRUCK, F1_2026_3 -> F1
    return u.replace(/_\d+.*$/, '');
  }

  function isF4SeriesId(seriesId) {
    var s = String(seriesId || '').toLowerCase();
    return s === 'f4_it';
  }

  /** Spa 24H interim checkpoints — stored for standings/points, hidden on Race tab. */
  function isGtwceSpaCheckpointRaceSession(sess) {
    if (!sess) return false;
    var title = String(sess.title || '').toLowerCase();
    if (title.indexOf('after 6 hour') >= 0 || title.indexOf('after 12 hour') >= 0) return true;
    if (sess.meta && String(sess.meta.Length || '').toLowerCase() === 'checkpoint') return true;
    return false;
  }

  function visibleRaceSessionsForDisplay(raceBlock, seriesIdLower) {
    if (!raceBlock || !Array.isArray(raceBlock.sessions)) return [];
    if (String(seriesIdLower || '').toLowerCase() !== 'gtwce_end') return raceBlock.sessions;
    return raceBlock.sessions.filter(function (sess) {
      return !isGtwceSpaCheckpointRaceSession(sess);
    });
  }

  /** Double-header weekends (e.g. Super Formula R1–2): no laps/distance table on overview; nav blocks in a row. */
  function eventIsMultiRoundWeekend(d) {
    if (!d || typeof d !== 'object') return false;
    var tables = (d.tables && typeof d.tables === 'object') ? d.tables
      : (d.Tables && typeof d.Tables === 'object') ? d.Tables
      : null;
    if (!tables) return false;
    var race = tables.race;
    if (race && Array.isArray(race.sessions)) {
      var sid = eventSeriesId(d.event_id || '').toLowerCase();
      var n = visibleRaceSessionsForDisplay(race, sid).length;
      if (n > 1) return true;
    }
    var qual = tables.qualifying;
    if (qual && Array.isArray(qual.sessions) && qual.sessions.length > 1) return true;
    return false;
  }

  // ── Event page (blocks navigation) ──────────────────────────────────────
  var eventBlockDefs = [
    {
      id: 'bop', icon: '⚖',
      check: function (d) {
        var ev = ((d.event_id || '') + '').toLowerCase().replace(/\s+/g, '_');
        return /^imsa_2026_\d+$/.test(ev);
      },
      meta: function (d) { return ''; }
    },
    {
      id: 'pre_season_tests', icon: '🔧',
      check: function (d) { return !!(d.tables && d.tables.pre_season_tests); },
      meta: function (d) { return d.tables && d.tables.pre_season_tests ? '' : ''; }
    },
    {
      id: 'entry-list', icon: '📋',
      check: function (d) {
        var sid = d.event_id && (eventSeriesId(d.event_id) || '').toLowerCase();
        return !!(d.entry_list) || sid === 'supercars' || sid === 'arca';
      },
      meta:  function (d) {
        var n = (d.entry_list && d.entry_list.length) ? d.entry_list.length : 0;
        return n + ' ' + (n === 1 ? t('meta.drivers.one') : t('meta.drivers.many'));
      }
    },
    {
      id: 'test', icon: '🧪',
      check: function (d) {
        var testTbl = d.tables && d.tables.test;
        if (testTbl && Array.isArray(testTbl.sessions) && testTbl.sessions.some(function (s) {
          return s && Array.isArray(s.rows) && s.rows.length > 0;
        })) return true;
        return !!(testTbl && testTbl.headers && Array.isArray(testTbl.rows) && testTbl.rows.length > 0);
      },
      meta: function (d) {
        var testTbl = d.tables && d.tables.test;
        if (!testTbl || !Array.isArray(testTbl.sessions)) return '';
        return testTbl.sessions.map(function (s) {
          return (s && s.title) ? String(s.title).trim() : '';
        }).filter(Boolean).join(' · ');
      }
    },
    {
      id: 'practice', icon: '⏱',
      check: function (d) {
        var tables = d.tables || {};
        var prac = tables.practice;
        if (prac && Array.isArray(prac.sessions) && prac.sessions.length > 0) return true;
        if (prac && prac.headers && Array.isArray(prac.rows) && prac.rows.length > 0) return true;
        return !!(tables.practice2 || tables.practice3 || tables.final_practice || tables.practice5) ||
          (d.event_id && (eventSeriesId(d.event_id) || '').toLowerCase() === 'supercars');
      },
      meta:  function (d) {
        var s = [];
        var tables = d.tables || {};
        var evKey = ((d.event_id || '') + '').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
        if (tables.practice && Array.isArray(tables.practice.sessions) && tables.practice.sessions.length) {
          tables.practice.sessions.forEach(function (sess, idx) {
            var tlabel = (sess && sess.title && String(sess.title).trim()) ? String(sess.title).trim() : (t('meta.practice1') + (idx > 0 ? ' ' + String(idx + 1) : ''));
            s.push(tlabel);
          });
        } else if (tables.practice) {
          s.push(t('meta.practice1'));
        }
        if (tables.practice2)      s.push(t('meta.practice2'));
        if (tables.practice3)      s.push(t('meta.practice3'));
        if (tables.final_practice) s.push(evKey === 'ELMS_2026_PROLOGUE' ? 'Practice 4' : t('meta.final_practice'));
        if (tables.practice5)      s.push('Practice 5');
        return s.join(' · ');
      }
    },
    {
      id: 'qualifying', icon: '⚡',
      check: function (d) {
        var tables = d.tables || {};
        if (tables.qualifying && Array.isArray(tables.qualifying.sessions) && tables.qualifying.sessions.length > 0) return true;
        return !!(tables.qualifying || tables.superpole || tables.duel1 || tables.duel2 || tables.last_chance || tables.did_not_qualify) ||
          (d.event_id && (eventSeriesId(d.event_id) || '').toLowerCase() === 'supercars');
      },
      meta:  function (d) {
        var s = [];
        var tables = d.tables || {};
        if (tables.duel1)           s.push(t('meta.duel1'));
        if (tables.duel2)           s.push(t('meta.duel2'));
        if (tables.last_chance)     s.push(t('meta.last_chance'));
        if (tables.superpole)       s.push(t('meta.superpole'));
        if (tables.qualifying && Array.isArray(tables.qualifying.sessions) && tables.qualifying.sessions.length) {
          tables.qualifying.sessions.forEach(function (sess) {
            if (sess && sess.title) s.push(String(sess.title).trim());
          });
        } else if (tables.qualifying) {
          s.push(t('meta.qualifying'));
        }
        if (tables.did_not_qualify) s.push(t('meta.dnq'));
        return s.join(' · ');
      }
    },
    {
      id: 'race', icon: '🏁',
      check: function (d) {
        var series = (d.event_id && eventSeriesId(d.event_id)) ? (eventSeriesId(d.event_id) || '').toLowerCase() : '';
        var isStockCar = isStockCarSeriesId(series);
        if (series === 'supercars') return true;
        if (d.tables && (d.tables.starting_lineup || tgaStageTable(d.tables, 1) || tgaStageTable(d.tables, 2) || tgaStageTable(d.tables, 3) || tgaStageTable(d.tables, 4) || d.tables.race_results || d.tables.caution_breakdown || d.tables.race)) return true;
        if (d.race_statistics && Object.keys(d.race_statistics).length > 0) return true;
        if (isStockCar && d.tables && (d.tables.practice || d.tables.qualifying)) return true;
        return false;
      },
      meta: function (d) {
        var s = [];
        var seriesMeta = (d.event_id && eventSeriesId(d.event_id)) ? (eventSeriesId(d.event_id) || '').toLowerCase() : '';
        var isStockCarMeta = isStockCarSeriesId(seriesMeta);
        var raceResultsFirstMeta = isStockCarMeta && d.tables && d.tables.race_results && (
          (Array.isArray(d.tables.race_results.rows) && d.tables.race_results.rows.length > 0) ||
          (d.tables.race_results.format === 'allstar_stages' && Array.isArray(d.tables.race_results.stages) && d.tables.race_results.stages.length > 0)
        );
        var seriesMetaLc = (d.event_id && eventSeriesId(d.event_id)) ? (eventSeriesId(d.event_id) || '').toLowerCase() : '';
        if (d.tables && d.tables.starting_lineup && seriesMetaLc !== 'f4_it') s.push(t('meta.starting_grid'));
        if (raceResultsFirstMeta && d.tables.race_results) s.push(t('meta.race_results'));
        if (seriesUsesStages(seriesMeta)) {
          if (d.tables && tgaStageTable(d.tables, 1)) s.push(t('meta.stage1'));
          if (d.tables && tgaStageTable(d.tables, 2)) s.push(t('meta.stage2'));
          if (d.tables && tgaStageTable(d.tables, 3)) s.push(t('meta.stage3'));
          if (d.tables && tgaStageTable(d.tables, 4)) s.push(t('meta.stage4'));
        }
        if (!raceResultsFirstMeta && d.tables && d.tables.race_results) s.push(t('meta.race_results'));
        return s.join(' · ');
      }
    }
  ];

  function parseStatRow(row) { return window.TGA.parseStatRow(row); }
  function getEventRaceStats(d) { return window.TGA.getEventRaceStats(d); }
  function renderRaceStatsTable(stats) { return window.TGA.renderRaceStatsTable(stats); }
  function buildTableSection(title, tableData, extraClass, getRowClass, colWidths, subtitle, titleClass, mergeTeamCells) {
    return window.TGA.buildTableSection(title, tableData, extraClass, getRowClass, colWidths, subtitle, titleClass, mergeTeamCells);
  }

  // Try to fill event header from schedule data (when full event JSON is missing).
  // Works in two steps:
  // 1) Try to find event in already loaded global cache (Next Events / Schedule).
  // 2) If missing — lazily fetch series events from /api/series/{series}/events and search there.
  function applyScheduleHeaderFallback(apiEventId, titleEl, metaEl) {
    try {
      if (!apiEventId) return;
      var upperId = String(apiEventId).toUpperCase();
      var seriesIdFromEvent = typeof eventSeriesId === 'function' ? eventSeriesId(upperId) : (upperId.split('_')[0] || '');

      function fillFromEventLike(match) {
        if (!match) return;
        var name = localizeEventFromData(match) || match.id || apiEventId || '';
        if (titleEl && name && (!titleEl.textContent || titleEl.textContent === '—')) {
          titleEl.textContent = name;
        }
        if (!metaEl) return;
        if (metaEl.textContent && metaEl.textContent.trim()) return;

        var datePart = typeof buildEventMetaDate === 'function' ? buildEventMetaDate(match) : '';
        if (!datePart && match.date) {
          datePart = String(match.date).trim();
        }
        var circuit = match.circuit_name || match.track || '';
        var location = match.location || '';
        if (circuit) {
          datePart += (datePart ? ' · ' : '') + localizeCircuitName(circuit);
        }
        if (location) {
          var locTrim = String(location).trim();
          var circTrim = String(circuit).trim();
          // Do not duplicate if location matches circuit_name/track or fully contains it.
          if (!circTrim ||
              (locTrim !== circTrim &&
               locTrim.indexOf(circTrim) === -1 &&
               circTrim.indexOf(locTrim) === -1)) {
            datePart += (datePart ? ', ' : '') + localizeLocation(location);
          }
        }
        if (datePart) metaEl.textContent = datePart;
      }

      var getGlobalEventsCache = window.TGA && window.TGA.getGlobalEventsCache;
      var cache = getGlobalEventsCache ? getGlobalEventsCache() : null;
      if (Array.isArray(cache) && cache.length > 0) {
        var target = upperId;
        for (var i = 0; i < cache.length; i++) {
          var ev = cache[i];
          if ((ev && String(ev.id || '').toUpperCase()) === target) {
            fillFromEventLike(ev);
            return;
          }
        }
      }

      // If global cache is empty (direct URL visit), try loading
      // that series' events and take header from there.
      if (!seriesIdFromEvent) return;
      var seriesSlug = seriesIdFromEvent.toLowerCase();
      API.getSeriesEvents(seriesSlug, null, { cacheBust: false })
        .then(function (events) {
          if (!Array.isArray(events)) return;
          var i;
          for (i = 0; i < events.length; i++) {
            var e = events[i];
            if ((e && String(e.id || '').toUpperCase()) === upperId) {
              fillFromEventLike(e);
              break;
            }
          }
        })
        .catch(function () {});
    } catch (e) {
      // Fallback must be safe; on error do nothing.
    }
  }

  function renderEventPage(eventId, section) {
    var loadGen = ++state.eventPageLoadGeneration;
    showView('view-event');
    state.loadedSeriesId = null;
    window.scrollTo(0, 0);
    var apiEventId = (eventId || '').toLowerCase().replace(/-/g, '_');
    var titleEl      = document.getElementById('event-title');
    var metaEl       = document.getElementById('event-meta');
    var crumbEl      = document.getElementById('event-breadcrumb');
    var sectionNavEl = document.getElementById('event-section-nav');
    var contentEl    = document.getElementById('event-content');
    titleEl.textContent = '—';
    metaEl.textContent  = '';
    if (crumbEl) {
      var sid0 = eventSeriesId(apiEventId);
      var seriesSlug0 = (sid0 || '').toLowerCase().replace(/_/g, '-');
      var seriesLabel0 = (sid0 || '').replace(/_/g, ' ');
      var evSlug0 = (eventId || '').toLowerCase();
      crumbEl.innerHTML =
        '<a href="/">' + t('breadcrumb.all') + '</a><span class="breadcrumb-sep">/</span>' +
        (sid0 ? '<a href="/series/' + encodeURIComponent(seriesSlug0) + '">' + esc(seriesLabel0) + '</a>' : '<span>' + esc(seriesLabel0 || '—') + '</span>') +
        '<span class="breadcrumb-sep">/</span>' +
        '<span>' + esc(evSlug0 || '—') + '</span>';
    }
    if (sectionNavEl) sectionNavEl.innerHTML = '';
    contentEl.innerHTML = '<p class="loading">' + t('loading') + '</p>';
    adjustEventPanelPadding();

    // If full event data not yet available, try at least to pull
    // name and date from global schedule (Next Events / Schedule).
    applyScheduleHeaderFallback(apiEventId.toUpperCase(), titleEl, metaEl);

    function renderWithData(d) {
      if (d.canonical_event_id && (eventSeriesId(d.canonical_event_id) || '').toLowerCase() === 'supercars') {
        var canonSlug = String(d.canonical_event_id).toLowerCase().replace(/_/g, '-');
        var routeSlug = (eventId || '').toLowerCase();
        if (canonSlug && canonSlug !== routeSlug) {
          var newPath = '/event/' + encodeURIComponent(canonSlug);
          if (section) newPath += '/' + encodeURIComponent(section);
          if (window.location.pathname !== newPath) {
            history.replaceState(null, '', newPath);
            eventId = canonSlug;
            apiEventId = canonSlug.replace(/-/g, '_');
          }
        }
      }
      var rawEventIdUpper = String(d.event_id || apiEventId || '').toUpperCase();
      var isElmsPrologue = rawEventIdUpper === 'ELMS_2026_PROLOGUE';
      var isWecPrologue = rawEventIdUpper === 'WEC_2026_PROLOGUE';
      var elmsClassBlockDefs = [
        { id: 'lmp2', label: 'LMP2' },
        { id: 'lmp2-pro-am', label: 'LMP2 Pro/Am' },
        { id: 'lmp3', label: 'LMP3' },
        { id: 'lmgt3', label: 'LMGT3' }
      ];
      var elmsClassLabelsById = {
        'lmp2': 'LMP2',
        'lmp2-pro-am': 'LMP2 Pro/Am',
        'lmp3': 'LMP3',
        'lmgt3': 'LMGT3'
      };
      var wecSessionBlockDefs = [
        { id: 'hypercar', label: 'Hypercar' },
        { id: 'lmgt3', label: 'LMGT3' }
      ];
      var wecSessionLabelsById = {
        'hypercar': 'Hypercar',
        'lmgt3': 'LMGT3'
      };
      var activeSection = section;
      if (isElmsPrologue && (activeSection === 'entry-list' || activeSection === 'practice')) {
        activeSection = 'lmp2';
      }
      if (isWecPrologue && (activeSection === 'entry-list' || activeSection === 'practice')) {
        activeSection = 'hypercar';
      }
      var rawName = (d.name && String(d.name).trim()) || d.race || d.event_id || 'Event';
      var seriesIdForName = eventSeriesId(d.event_id || apiEventId);
      // Strip series prefix from event name when breadcrumb already shows the series (F1, DTM, …).
      if (seriesIdForName && typeof rawName === 'string') {
        var sidUpperName = seriesIdForName.toUpperCase();
        if (sidUpperName === 'F1') {
          rawName = rawName.replace(/^F1\s*[—-]\s*/i, '');
        } else if (sidUpperName === 'DTM') {
          rawName = rawName.replace(/^DTM\s*[—-]\s*/i, '');
        }
      }
      var eventName = localizeEventFromData(Object.assign({}, d, { name: rawName }));
      var seriesId    = eventSeriesId(d.event_id || apiEventId);
      var seriesLabel = seriesId.replace(/_/g, ' ');

      // Update category class on <body> for contextual styles (incl. stock-car tables on event page)
      var bodyEl = document.body;
      if (bodyEl) {
        var seriesIdUpper = (seriesId || '').toUpperCase();
        var seriesIdLower = (seriesId || '').toLowerCase();
        bodyEl.classList.remove('cat-openwheel', 'cat-stockcar', 'cat-endurance', 'cat-touring');
        var catKey = categoryBySeriesId[seriesIdUpper];
        if (catKey) bodyEl.classList.add('cat-' + catKey);
        Array.from(bodyEl.classList).forEach(function (cls) {
          if (cls.indexOf('series-') === 0) bodyEl.classList.remove(cls);
        });
        if (seriesIdLower) bodyEl.classList.add('series-' + seriesIdLower);
        Array.from(bodyEl.classList).forEach(function (cls) {
          if (/^ev-/.test(cls)) bodyEl.classList.remove(cls);
        });
        if (apiEventId) {
          bodyEl.classList.add('ev-' + String(apiEventId).toLowerCase().replace(/_/g, '-'));
        }
      }
      var blockDef    = null;
      for (var bi = 0; bi < eventBlockDefs.length; bi++) {
        if (eventBlockDefs[bi].id === activeSection) { blockDef = eventBlockDefs[bi]; break; }
      }
      var sectionLabel = '';
      if (isWecPrologue && activeSection && wecSessionLabelsById[activeSection]) {
        sectionLabel = localizeRacingClass(wecSessionLabelsById[activeSection]);
      } else if (isElmsPrologue && activeSection && elmsClassLabelsById[activeSection]) {
        sectionLabel = localizeRacingClass(elmsClassLabelsById[activeSection]);
      } else {
        sectionLabel = blockDef ? t('block.' + blockDef.id) : '';
      }
      titleEl.textContent = activeSection ? sectionLabel : eventName;
      var datePart = typeof buildEventMetaDate === 'function' ? buildEventMetaDate(d) : '';
      if (!datePart && d.date) {
        datePart = typeof localizeDate === 'function' ? localizeDate(d.date || '') : String(d.date || '').trim();
      }
      if (d.track) datePart += (datePart ? ' · ' : '') + localizeCircuitName(d.track);
      if (d.location) {
        var locTrimMeta = String(d.location).trim();
        var trackTrimMeta = String(d.track || '').trim();
        if (!trackTrimMeta ||
            (locTrimMeta !== trackTrimMeta &&
             locTrimMeta.indexOf(trackTrimMeta) === -1 &&
             trackTrimMeta.indexOf(locTrimMeta) === -1)) {
          datePart += (datePart ? ', ' : '') + localizeLocation(d.location);
        }
      }
      metaEl.textContent = datePart;
      document.title = documentTitle((activeSection ? sectionLabel + ' — ' : '') + eventName);
      // Section nav uses the canonical weekend slug from the URL (supercars-2026-2, not race number).
      var routeEventSlug = (eventId || '').toLowerCase().replace(/_/g, '-');
      var eventSlugForUrl = routeEventSlug || (d.event_id || '').toLowerCase().replace(/_/g, '-');

      // Breadcrumbs: All series / F1 / (optional F1 20XX) / Event / Section
      var crumb = '<a href="/">' + t('breadcrumb.all') + '</a><span class="breadcrumb-sep">/</span>' +
        '<a href="/series/' + encodeURIComponent((seriesId || '').toLowerCase().replace(/_/g, '-')) + '">' + esc(seriesLabel) + '</a>';

      // For F1 try to extract season year from event_id (F1_2025_1) or URL slug (f1-2025-1)
      var isF1Series = ((seriesId || '').toUpperCase() === 'F1');
      if (isF1Series) {
        var evIdRaw = String(d.event_id || eventId || '');
        var evIdUpper = evIdRaw.toUpperCase();
        var seasonYear = null;
        var mId = evIdUpper.match(/^F1_(\d{4})_/);
        if (mId && mId[1]) {
          seasonYear = mId[1];
        } else {
          var mSlug = evIdRaw.match(/f1-(\d{4})-/i);
          if (mSlug && mSlug[1]) seasonYear = mSlug[1];
        }
        if (seasonYear) {
          var seasonSlug = 'f1-' + seasonYear;
          crumb += '<span class="breadcrumb-sep">/</span>' +
            '<a href="/season/' + seasonSlug + '">F1 ' + seasonYear + '</a>';
        }
      }

      crumb += '<span class="breadcrumb-sep">/</span>';
      if (activeSection) {
        crumb += '<a href="/event/' + encodeURIComponent(eventSlugForUrl) + '">' + esc(eventName) + '</a>' +
          '<span class="breadcrumb-sep">/</span><span>' + esc(sectionLabel) + '</span>';
      } else {
        crumb += '<span>' + esc(eventName) + '</span>';
      }
      crumbEl.innerHTML = crumb;

      // Section nav — within subsection only
      if (sectionNavEl) {
        if (activeSection) {
          var visibleBlocks = [];
          if (isWecPrologue) {
            visibleBlocks = wecSessionBlockDefs.slice();
          } else if (isElmsPrologue) {
            visibleBlocks = elmsClassBlockDefs.slice();
          } else {
            for (var bj = 0; bj < eventBlockDefs.length; bj++) {
              if (eventBlockDefs[bj].check(d)) visibleBlocks.push(eventBlockDefs[bj]);
            }
          }
          var base = '/event/' + encodeURIComponent(eventSlugForUrl);
          sectionNavEl.innerHTML = visibleBlocks.map(function (b) {
            var active = activeSection === b.id ? ' active' : '';
            var label = ((isWecPrologue || isElmsPrologue) && b.label) ? localizeRacingClass(b.label) : t('block.' + b.id);
            return '<a href="' + base + '/' + b.id + '" class="nav-link' + active + '">' + esc(label) + '</a>';
        }).join('');
        } else {
          sectionNavEl.innerHTML = '';
        }
      }

      if (activeSection) {
        renderEventSectionContent(d, activeSection, contentEl, apiEventId);
      } else {
        if (contentEl) contentEl.removeAttribute('data-event-section');
        renderEventOverviewContent(d, apiEventId, contentEl);
      }
      adjustEventPanelPadding();
      translateStaticUI();
    }

    // If event is already cached, show it immediately,
    // but still fetch fresh data from server (cache must not hide JSON edits).
    if (state.eventCache[apiEventId]) {
      renderWithData(state.eventCache[apiEventId]);
    }

    function normalizeEventPayload(d) {
      if (!d || typeof d !== 'object') return d;
      if (d.data && typeof d.data === 'object') d = d.data;
      if (d.event && typeof d.event === 'object') d = d.event;
      if (Array.isArray(d) && d.length > 0) d = d[0];
      return d;
    }

    function hasDetailedEventPayload(d) {
      if (!d || typeof d !== 'object') return false;
      var tables = d.tables && typeof d.tables === 'object' ? d.tables : null;
      if (tables && Object.keys(tables).length > 0) return true;
      if (Array.isArray(d.entry_list) && d.entry_list.length > 0) return true;
      if (d.event_preview && String(d.event_preview).trim()) return true;
      if (d.event_preview_ru && String(d.event_preview_ru).trim()) return true;
      if (d.laps != null && String(d.laps).trim() !== '') return true;
      if (d.distance != null && String(d.distance).trim() !== '') return true;
      if (Array.isArray(d.youtube_highlights) && d.youtube_highlights.length > 0) return true;
      if (d.youtube_id && String(d.youtube_id).trim()) return true;
      if (d.highlights_url && String(d.highlights_url).trim()) return true;
      return false;
    }

    function fetchEventPayloadOnce() {
      return API.getEvent(apiEventId)
        .then(normalizeEventPayload);
    }

    fetchEventPayloadOnce()
      .then(function (d) {
        if (loadGen !== state.eventPageLoadGeneration) return null;
        if (!d || typeof d !== 'object') throw new Error('Invalid response');
        // Sometimes SPA navigation returns short payload without tables.
        // Make second request and prefer more detailed response.
        if (!hasDetailedEventPayload(d)) {
          return fetchEventPayloadOnce()
            .then(function (d2) {
              if (loadGen !== state.eventPageLoadGeneration) return null;
              if (d2 && hasDetailedEventPayload(d2)) return d2;
              return d;
            })
            .catch(function () {
              return d;
            });
        }
        return d;
      })
      .then(function (d) {
        if (loadGen !== state.eventPageLoadGeneration || !d) return;
        state.eventCache[apiEventId] = d;
        try {
          renderWithData(d);
        } catch (err) {
          logger.error('renderEventPage render error', err);
          contentEl.innerHTML = '<p class="empty-msg">' + (t('error.no_section_data') || 'Error displaying content') + '.</p>';
          adjustEventPanelPadding();
        }
      })
      .catch(function (err) {
        if (loadGen !== state.eventPageLoadGeneration) return;
        var msg = (err && err.message) ? String(err.message) : '';
        var isNotFound = msg === 'Not found' || msg.indexOf('404') >= 0;
        titleEl.textContent = isNotFound ? t('error.event_not_found') : '—';
        if (sectionNavEl) sectionNavEl.innerHTML = '';
        contentEl.innerHTML = '<p class="empty-msg">' + (isNotFound ? t('error.event_not_found') : (t('error.no_section_data') || 'Error loading event')) + '.</p>';
        adjustEventPanelPadding();
      });
  }

  function renderEventOverviewContent(d, eventId, contentEl) {
    if (!d || typeof d !== 'object') {
      contentEl.innerHTML = '<p class="empty-msg">' + t('error.no_section_data') + '</p>';
        return;
      }
    // Special case: for IMSA 2026 Pre Season Test show Pre-Season Tests immediately,
    // without tile block on overview.
    var evKeyOverview = ((d.event_id || eventId || '') + '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_');
    var eventName = localizeEventFromData(d) || d.event_id || eventId || 'Event';
    var datePart = d.date || d.start_date || d.startDate || '';
    if (evKeyOverview === 'IMSA_2026_PRE_SEASON_TEST' || evKeyOverview === 'F1_2026_PRE_SEASON_TEST_1' || evKeyOverview === 'F1_2026_PRE_SEASON_TEST_2') {
      renderEventSectionContent(d, 'pre_season_tests', contentEl, null);
      return;
    }
    var html = '';
    try {
    var tablesOverview = (d && d.tables && typeof d.tables === 'object') ? d.tables
      : (d && d.Tables && typeof d.Tables === 'object') ? d.Tables
      : {};
    // Laps/Distance — hide for Supercars, IMSA, WEC, Formula 2, Formula 3 and Formula 4
    var infoItems = [];
    var seriesLc = (eventSeriesId(eventId) || '').toLowerCase();
    var isFujiSuperGt2026 = evKeyOverview === 'SUPER_GT_2026_2';
    var isMultiRoundWeekend = eventIsMultiRoundWeekend(d);
    if (!isMultiRoundWeekend && seriesLc !== 'supercars' && seriesLc !== 'imsa' && seriesLc !== 'wec' && seriesLc !== 'f2' && seriesLc !== 'f3' && seriesLc !== 'dtm' && seriesLc !== 'frec' && seriesLc !== 'psc' && !isFujiSuperGt2026 && !isF4SeriesId(seriesLc)) {
      if (Object.prototype.hasOwnProperty.call(d, 'laps')) {
        var lapsTrim = d.laps != null ? String(d.laps).trim() : '';
        infoItems.push([t('section.laps'), lapsTrim !== '' ? trimTrailingZeros(String(d.laps)) : '']);
      }
      if (Object.prototype.hasOwnProperty.call(d, 'distance')) {
        var distTrim = d.distance != null ? String(d.distance).trim() : '';
        infoItems.push([t('section.distance'), distTrim !== '' ? localizeDistance(String(d.distance)) : '']);
      }
    }
    var visibleBlocks = [];
    if (evKeyOverview === 'ELMS_2026_PROLOGUE') {
      visibleBlocks = [
        { id: 'lmp2', label: 'LMP2' },
        { id: 'lmp2-pro-am', label: 'LMP2 Pro/Am' },
        { id: 'lmp3', label: 'LMP3' },
        { id: 'lmgt3', label: 'LMGT3' }
      ];
    } else if (evKeyOverview === 'WEC_2026_PROLOGUE') {
      visibleBlocks = [
        { id: 'hypercar', label: 'Hypercar' },
        { id: 'lmgt3', label: 'LMGT3' }
      ];
    } else {
      for (var bi = 0; bi < eventBlockDefs.length; bi++) {
        if (eventBlockDefs[bi].check(d)) visibleBlocks.push(eventBlockDefs[bi]);
      }
    }
    if (infoItems.length > 0 || visibleBlocks.length > 0) {
      html += '<div class="event-overview-laps-and-blocks">';
      if (infoItems.length > 0) {
        html += '<div class="table-wrap"><table class="data-table table-field-value"><thead><tr><th>' + t('th.field') + '</th><th>' + t('th.value') + '</th></tr></thead><tbody>' +
          infoItems.map(function (p) { return '<tr><td class="col-field">' + esc(dash(p[0])) + '</td><td>' + esc(dash(p[1])) + '</td></tr>'; }).join('') +
          '</tbody></table></div>';
      }
      if (visibleBlocks.length > 0) {
        var seriesForBlocks = (eventSeriesId(eventId) || '').toLowerCase();
        var isRowBlocksEvent = isMultiRoundWeekend || seriesForBlocks === 'supercars' || seriesForBlocks === 'elms' || seriesForBlocks === 'dtm' || seriesForBlocks === 'frec' || seriesForBlocks === 'f2' || seriesForBlocks === 'f4_it' || seriesForBlocks === 'gtwce_end' || seriesForBlocks === 'gtwce_sprint' || seriesForBlocks === 'imsa' || seriesForBlocks === 'wec' || seriesForBlocks === 'psc' || evKeyOverview === 'ELMS_2026_PROLOGUE' || evKeyOverview === 'WEC_2026_PROLOGUE' || evKeyOverview === 'SUPER_GT_2026_2';
        var blocksClass = 'event-blocks ' + (isRowBlocksEvent ? 'event-blocks--row' : 'event-blocks--2x2');
        html += '<div class="' + blocksClass + '">' +
          visibleBlocks.map(function (b) {
            var blockLabel = b.label ? localizeRacingClass(b.label) : (t('block.' + b.id) || b.id);
            return '<a href="/event/' + encodeURIComponent((eventId || '').toLowerCase().replace(/_/g, '-')) + '/' + b.id + '" class="event-block">' +
              '<span class="event-block-label">' + esc(blockLabel) + '</span>' +
            '</a>';
          }).join('') + '</div>';
      }
      html += '</div>';
    }

    // Track info — pick Russian version when getLang() === 'ru' and it exists.
    // Empty event_preview / event_preview_ru: show heading and paragraph (draft for JSON edits).
    var hasPreviewKey = Object.prototype.hasOwnProperty.call(d, 'event_preview') ||
      Object.prototype.hasOwnProperty.call(d, 'event_preview_ru');
    var previewRu = (d.event_preview_ru != null && typeof d.event_preview_ru === 'string') ? d.event_preview_ru.trim() : '';
    var previewEn = (d.event_preview != null && typeof d.event_preview === 'string') ? d.event_preview : '';
    var previewTextCombined = (getLang() === 'ru' && previewRu) ? previewRu : previewEn;
    var previewTextBody = '';
    if (previewTextCombined && previewTextCombined.length > 0) {
      previewTextBody = previewTextCombined
        .replace(/\s*\[\d+\]\s*/g, ' ')
        .replace(/—/g, '-')
        .replace(/\s+/g, ' ')
        .trim();
      if (getLang() === 'ru') {
        if (d.event_preview_ru && d.event_preview_ru.trim()) {
          previewTextBody = localizeDriverNamesInText(previewTextBody);
        } else {
          previewTextBody = localizeEventPreview(previewTextBody);
        }
      }
    }
    var overviewPreviewBlock = previewTextBody.length > 0 || hasPreviewKey;
    if (overviewPreviewBlock) {
      html += '<h4 class="table-section-title">' + t('section.event_preview') + '</h4><p class="event-preview-text">' +
        (previewTextBody.length > 0 ? esc(previewTextBody) : '') + '</p>';
    }
    if (d.tyre_compounds && typeof d.tyre_compounds === 'string' && d.tyre_compounds.trim()) {
      html += '<p class="event-preview-text tyre-compounds-text">' + esc(localizeTyreCompounds(d.tyre_compounds.trim())) + '</p>';
    }

    // Highlights — YouTube (preferred) or external link.
    var highlightsList = Array.isArray(d.youtube_highlights) && d.youtube_highlights.length > 0
      ? d.youtube_highlights
      : (d.youtube_id && typeof d.youtube_id === 'string' && d.youtube_id.trim().length > 0)
        ? [{ id: d.youtube_id.trim(), title: t('section.highlights') }]
        : (d.highlights_url && typeof d.highlights_url === 'string' && d.highlights_url.trim().length > 0)
          ? [{ url: d.highlights_url.trim(), title: t('section.highlights') }]
          : [];
    if (highlightsList.length > 0) {
      var hasSingleRaceSession = false;
      if (tablesOverview && tablesOverview.race && Array.isArray(tablesOverview.race.sessions)) {
        var overviewSid = eventSeriesId(d.event_id || '').toLowerCase();
        hasSingleRaceSession = visibleRaceSessionsForDisplay(tablesOverview.race, overviewSid).length === 1;
      } else if (tablesOverview && tablesOverview.race_results &&
                 !tgaStageTable(tablesOverview, 1) && !tgaStageTable(tablesOverview, 2) && !tgaStageTable(tablesOverview, 3)) {
        hasSingleRaceSession = true;
      }
      var videoWrapCls = 'video-embed-wrap' + ((highlightsList.length === 1 && hasSingleRaceSession) ? ' video-embed-wrap--single' : '');
      html += '<div class="' + videoWrapCls + '">';
      if (highlightsList.length === 1) {
        html += '<h4 class="table-section-title">' + esc(localizeSectionTitle(highlightsList[0].title || t('section.highlights'))) + '</h4>';
      } else {
        html += '<h4 class="table-section-title">' + t('section.highlights') + '</h4>';
      }
      highlightsList.forEach(function (item, idx) {
        var rawId = (item.id || item.youtube_id || '').toString().trim();
        var hasYoutubeId = rawId.length > 0;
        if (hasYoutubeId) {
          var yid = rawId.replace(/[^a-zA-Z0-9_\-]/g, '');
          if (!yid) return;
          // Remove caption under preview if it is the only video (heading already above).
          var showLabel = (highlightsList.length > 1);
          var label = (showLabel && item.title)
            ? '<p class="video-facade-label">' + esc(localizeSectionTitle(item.title)) + '</p>'
            : '';
          var thumbBase = 'https://img.youtube.com/vi/' + yid + '/';
          var thumbFallback = 'onerror="var s=this.src;if(s.indexOf(\'maxresdefault\')!==-1){this.src=s.replace(\'maxresdefault\',\'sddefault\');this.onerror=function(){this.src=s.replace(\'maxresdefault\',\'hqdefault\');this.onerror=null;};}else if(s.indexOf(\'sddefault\')!==-1){this.src=s.replace(\'sddefault\',\'hqdefault\');this.onerror=null;}"';
          var watchUrl = 'https://www.youtube.com/watch?v=' + encodeURIComponent(yid);
          html += '<div class="video-facade-wrap">' +
            '<a class="video-facade video-facade--youtube" href="' + esc(watchUrl) + '" target="_blank" rel="noopener noreferrer" ' +
              'aria-label="' + esc((item.title || t('section.highlights')) + ' — ' + t('section.watch_on_youtube')) + '">' +
              '<img src="' + thumbBase + 'maxresdefault.jpg" ' + thumbFallback + ' ' +
                'alt="' + esc(item.title || 'Highlights') + '" loading="lazy" decoding="async">' +
              '<span class="video-play-btn" aria-hidden="true"></span>' +
            '</a>' +
            label +
          '</div>';
        } else {
          // External source (e.g. official video on formula1.com).
          var url = (item && (item.url || item.href || item.link)) || (d && d.highlights_url);
          if (!url) return;
          var extLabel = item.title || t('section.highlights') || 'Highlights';
          var thumbAttr = '';
          if (item.thumb) {
            var thumbUrl = String(item.thumb || '').trim();
            if (thumbUrl) {
              thumbAttr = '<img class="video-external-thumb" src="' + esc(thumbUrl) + '" alt="' + esc(extLabel) + '" loading="lazy" decoding="async">';
            }
          }
          html += '<div class="video-facade-wrap">' +
            '<a class="video-external-link" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' +
              thumbAttr +
              '<span class="video-external-label">' + esc(extLabel) + '</span>' +
            '</a>' +
          '</div>';
        }
      });
      html += '</div>';
    }

    // Fallback: if highlights list is empty for some reason,
    // but event has highlights_url, show simple external link.
    if ((!highlightsList || highlightsList.length === 0) &&
        d.highlights_url && typeof d.highlights_url === 'string' &&
        d.highlights_url.trim().length > 0) {
      var hlUrl = d.highlights_url.trim();
      html += '<p class="event-preview-text"><a class="video-external-inline-link" href="' +
        esc(hlUrl) + '" target="_blank" rel="noopener noreferrer">' +
        esc(t('section.highlights') || 'Highlights') + '</a></p>';
    }

    // Race statistics — same table (FIELD / VALUE, colon parsing) for all series
    var stats = getEventRaceStats(d);
    if (stats && Object.keys(stats).length > 0) {
      html += renderRaceStatsTable(stats);
    }

    var hasHighlightsSection = (highlightsList && highlightsList.length > 0) ||
      (d.highlights_url && typeof d.highlights_url === 'string' && d.highlights_url.trim().length > 0);
    var hasTyreLine = !!(d.tyre_compounds && typeof d.tyre_compounds === 'string' && d.tyre_compounds.trim());
    if (infoItems.length === 0 && visibleBlocks.length === 0 && !overviewPreviewBlock && !hasTyreLine &&
        !hasHighlightsSection && !(stats && Object.keys(stats).length > 0)) {
      html += '<p class="empty-msg">' + t('error.no_data') + '</p>';
    }

    } catch (err) {
      logger.error('renderEventOverviewContent', err);
      contentEl.innerHTML = '<p class="empty-msg">' + t('error.no_section_data') + '</p>';
      return;
    }

    contentEl.innerHTML = html || ('<p class="empty-msg">' + t('error.no_section_data') + '</p>');
  }

  // Session meta: horizontal table — Date, Time, optional Race day, Length, Session, Start
  function buildSessionMetaTable(meta) {
    if (!meta || typeof meta !== 'object') return '';
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
    var tables = (d && d.tables && typeof d.tables === 'object') ? d.tables
      : (d && d.Tables && typeof d.Tables === 'object') ? d.Tables
      : {};
    var html = '';
    var sortQueue = [];

    var seriesId = eventSeriesId(d.event_id || '');
    var seriesIdLower = (seriesId || '').toLowerCase();
    var isSupercars = isSupercarsSeriesId(seriesIdLower);
    var isStockCarSeriesRace = isStockCarSeriesId(seriesIdLower);
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
      ? buildTeamNamesByNumberFromEntryList(d.entry_list)
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
      var titleText = localizeF1RaceSessionTitle(sess && sess.title ? String(sess.title) : '', evKeyEvent);
      var hasRaceResultRows = sess && Array.isArray(sess.rows) && sess.rows.length > 0;
      var skipVenueSubtitle = shouldSkipOpenwheelRaceVenueSubtitle(seriesIdLower);
      var isSuperGtClassTitle = isSuperGtRaceClassTitle(seriesIdLower, titleText);
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
          var scRace = transformSupercarsRaceTable(h, sess.rows || [], byNumber);
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
            var imsaTransformed = transformImsaRaceTable(raceHeaders, raceRows, qualRowsForImsa);
            raceHeaders = imsaTransformed.headers;
            raceRows = imsaTransformed.rows;
          }
        }

        if (evKeyEvent && evKeyEvent.indexOf('F1_') === 0) {
          var f1GridNorm = normalizeF1RaceGridColumn({ headers: raceHeaders, rows: raceRows });
          raceHeaders = f1GridNorm.headers;
          raceRows = f1GridNorm.rows;
        }

        // F1_2025_2 … F1_2025_11: add Laps Led and Best Lap columns directly in result tables.
        // Also normalize points and laps led: if driver scored no points or led no laps, show 0.
        if ((evKeyEvent === 'F1_2025_2' || evKeyEvent === 'F1_2025_3' || evKeyEvent === 'F1_2025_4' || evKeyEvent === 'F1_2025_5' || evKeyEvent === 'F1_2025_6' || evKeyEvent === 'F1_2025_7' || evKeyEvent === 'F1_2025_8' || evKeyEvent === 'F1_2025_9' || evKeyEvent === 'F1_2025_10' || evKeyEvent === 'F1_2025_11') && eventData && eventData.tables) {
          var isSprintSession = /^sprint/i.test(String(sess.title || ''));
          var lapsLedByDriver = {};
          var bestLapByNo = {};
          var ptsColIdx = -1;
          for (var pi = 0; pi < raceHeaders.length; pi++) {
            var ph = (raceHeaders[pi] || '').toLowerCase();
            if (ph.indexOf('pts') >= 0 || ph.indexOf('points') >= 0) {
              ptsColIdx = pi;
              break;
            }
          }

          // Laps led: sprint or race.
          if (isSprintSession && eventData.tables.laps_led_sprint && Array.isArray(eventData.tables.laps_led_sprint.rows)) {
            eventData.tables.laps_led_sprint.rows.forEach(function (row) {
              var drv = row[1] != null ? String(row[1]).trim() : '';
              var total = row[3] != null ? String(row[3]).trim() : '';
              if (drv && total) lapsLedByDriver[drv] = total;
            });
          } else if (!isSprintSession && eventData.tables.laps_led && Array.isArray(eventData.tables.laps_led.rows)) {
            eventData.tables.laps_led.rows.forEach(function (row) {
              var range = row[0] != null ? String(row[0]).trim() : '';
              var drv = row[1] != null ? String(row[1]).trim() : '';
              if (!drv || !range) return;
              var count = 0;
              var mRange = range.match(/^(\d+)\s*[\u2013\u2014\-]\s*(\d+)$/);
              if (mRange) {
                var a = parseInt(mRange[1], 10);
                var b = parseInt(mRange[2], 10);
                if (!isNaN(a) && !isNaN(b) && b >= a) count = (b - a + 1);
              } else if (/^\d+$/.test(range)) {
                count = 1;
              }
              if (count > 0) {
                lapsLedByDriver[drv] = (lapsLedByDriver[drv] || 0) + count;
              }
            });
          }

          // Special cases (laps led totals only, no ranges in data):
          // Monaco 2025 (F1_2025_8), Spain 2025 (F1_2025_9), Canada 2025 (F1_2025_10), Austria 2025 (F1_2025_11).
          if (!isSprintSession) {
            if (evKeyEvent === 'F1_2025_8') {
              lapsLedByDriver = {
                'Lando Norris': 42,
                'Charles Leclerc': 3,
                'Max Verstappen': 33
              };
            } else if (evKeyEvent === 'F1_2025_9') {
              lapsLedByDriver = {
                'Oscar Piastri': 60,
                'Max Verstappen': 6
              };
            } else if (evKeyEvent === 'F1_2025_10') {
              lapsLedByDriver = {
                'George Russell': 43,
                'Kimi Antonelli': 1,
                'Oscar Piastri': 5,
                'Lando Norris': 15,
                'Charles Leclerc': 6
              };
            } else if (evKeyEvent === 'F1_2025_11') {
              lapsLedByDriver = {
                'Lando Norris': 62,
                'Oscar Piastri': 7,
                'Lewis Hamilton': 1
              };
            }
          }

          // Fastest laps.
          if (isSprintSession && eventData.tables.best_laps_sprint && Array.isArray(eventData.tables.best_laps_sprint.rows)) {
            eventData.tables.best_laps_sprint.rows.forEach(function (row) {
              var no = row[1] != null ? String(row[1]).trim() : '';
              var time = row[6] != null ? String(row[6]).trim() : '';
              if (no && time) bestLapByNo[no] = time;
            });
          } else if (!isSprintSession && eventData.tables.best_laps && Array.isArray(eventData.tables.best_laps.rows)) {
            eventData.tables.best_laps.rows.forEach(function (row) {
              var no = row[1] != null ? String(row[1]).trim() : '';
              var time = row[6] != null ? String(row[6]).trim() : '';
              if (no && time) bestLapByNo[no] = time;
            });
          }

          // Extend headers and rows.
          if (ptsColIdx >= 0) {
            // For F1_2025_2 and F1_2025_3 insert Laps Led and Best Lap BEFORE Pts. column,
            // so order matches F1_2025_1 template: ... St, Laps Led, Best Lap, Pts.
            var newHeaders = [];
            for (var hi2 = 0; hi2 < raceHeaders.length; hi2++) {
              if (hi2 === ptsColIdx) {
                newHeaders.push('Laps Led', 'Best Lap', raceHeaders[hi2]);
              } else {
                newHeaders.push(raceHeaders[hi2]);
              }
            }
            raceHeaders = newHeaders;
            raceRows = raceRows.map(function (r) {
              var baseRow = r.slice();
              var drv = baseRow[2] != null ? String(baseRow[2]).trim() : '';
              var no = baseRow[1] != null ? String(baseRow[1]).trim() : '';
              var posRaw = baseRow[0] != null ? String(baseRow[0]).trim() : '';
              var lapsRaw = baseRow[4] != null ? String(baseRow[4]).trim() : '';
              var lapsVal = lapsLedByDriver[drv];
              var bestVal = bestLapByNo[no];
              // For DNS/0-lap do not show best lap,
              // even if present in fastest laps table.
              var isDns = /^dns/i.test(posRaw);
              var lapsNum = parseInt(lapsRaw, 10);
              if (isNaN(lapsNum)) lapsNum = null;
              if (isDns || lapsNum === 0) bestVal = '';
              var out = [];
              for (var ci2 = 0; ci2 < baseRow.length; ci2++) {
                if (ci2 === ptsColIdx) {
                  // Insert Laps Led and Best Lap before points.
                  var lapsCell = lapsVal != null ? String(lapsVal) : '0';
                  out.push(lapsCell);
                  out.push(bestVal || '');
                  // Normalize points — if empty, show 0.
                  var rawPts3 = baseRow[ci2];
                  if (rawPts3 == null || String(rawPts3).trim() === '') rawPts3 = '0';
                  out.push(rawPts3);
                } else {
                  out.push(baseRow[ci2]);
                }
              }
              return out;
            });
          } else {
            // If Pts. column not found — append Laps Led and Best Lap at end.
            raceHeaders = raceHeaders.slice();
            raceHeaders.push('Laps Led', 'Best Lap');
            raceRows = raceRows.map(function (r) {
              var row = r.slice();
              var drv = row[2] != null ? String(row[2]).trim() : '';
              var no = row[1] != null ? String(row[1]).trim() : '';
              var lapsVal = lapsLedByDriver[drv];
              var bestVal = bestLapByNo[no];
              // If no points or empty — show 0.
              if (ptsColIdx >= 0 && ptsColIdx < row.length) {
                var rawPts = row[ptsColIdx];
                if (rawPts == null || String(rawPts).trim() === '') row[ptsColIdx] = '0';
              }
              // If driver led no laps — show 0.
              var lapsCell2 = lapsVal != null ? String(lapsVal) : '0';
              row.push(lapsCell2);
              row.push(bestVal || '');
              return row;
            });
          }
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
          raceTbl = normalizeFinStTable(raceTbl);
          raceTbl = normalizeRaceEngineColumns(raceTbl);
          raceTbl = dropTouringRaceDisplayColumns(raceTbl, seriesIdLower, evKeyEvent);
          // F1, 10 columns (like race_results on F1_2026_3): same look as "Race Results" —
          // .race-results-table + fixed colgroup, not .pre-season-results-table.
          // IMSA: reference race table layout — `/event/imsa-2026-1/race` (body.series-imsa … race-session-results-table in style.css).
          var raceSessTableClass = 'pre-season-results-table race-session-results-table';
          var raceSessColWidths = null;
          if (isF4SeriesId(seriesIdLower)) {
            raceSessTableClass = 'race-starting-lineup-table f4-race-results-table';
          } else if (evKeyEvent && evKeyEvent.indexOf('F1_') === 0 && raceHeaders.length === 10) {
            raceSessTableClass = 'race-results-table';
            raceSessColWidths = raceResultsWidths10;
          }
          if (evKeyEvent && (evKeyEvent.indexOf('GTWCE_END_') === 0 || evKeyEvent.indexOf('GTWCE_SPRINT_') === 0)) raceSessTableClass += ' gtwce-race-results-table';
          var raceResult = buildTableSection(null, raceTbl, raceSessTableClass, null, raceSessColWidths);
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
        var vscResult = buildTableSection(sessVscTitle, sessVscTable, 'vsc-table', null);
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
      var r = buildTableSection(title, data, cssClass, getRowClass, colWidths, subtitle, titleClass, mergeTeamCells);
      if (!r) return;
      html += r.html;
      sortQueue.push(r);
    }

    var rrAllstar = tables.race_results;
    var isAllstarStageRaceEvent = isAllstarStageRace(tables);

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

    var hideStartingLineupOnRace = shouldHideStartingLineupOnRaceTab(seriesIdLower);
    var slSessions = (!hideStartingLineupOnRace && tables.starting_lineup && Array.isArray(tables.starting_lineup.sessions)) ? tables.starting_lineup.sessions : [];
    var slFlat = !hideStartingLineupOnRace && tables.starting_lineup && tables.starting_lineup.headers && Array.isArray(tables.starting_lineup.rows) && tables.starting_lineup.rows.length > 0;

    var raceBlock = tables.race;
    // Whelen Modified: race result only in race_results (like NASCAR_MODIFIED_2026_1), no tables.race duplicate.
    if (isNascarModified && tables.race_results && Array.isArray(tables.race_results.rows) && tables.race_results.rows.length > 0) {
      raceBlock = null;
    }
    var penaltiesAndVscAddedAfterSprint = false;
    if (raceBlock && Array.isArray(raceBlock.sessions) && raceBlock.sessions.length > 0) {
      var raceSessionsDisplay = visibleRaceSessionsForDisplay(raceBlock, seriesIdLower);
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
      if (isSuperGtSeriesId(seriesIdLower) && Array.isArray(raceBlock.headers) && Array.isArray(raceBlock.rows)) {
        var superGtSessions = splitSuperGtRaceBlockByClass(raceBlock);
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
    var stockCarStageFormat = stockCarHasStageFormat(d, tables);
    var eventHasStage4 = hasStage4(d, tables);

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
            var p = parseStatRow(row);
            if (!p || !p.key) return true;
            var nk = p.key.replace(/\s*\/\s*/g, ' / ').trim();
            return statKeysForFilter.indexOf(nk) < 0;
          })
        };
        // For all F1 events normalize empty points and laps led
        // in race_results table: show 0 instead of empty cell.
        var isF1SeriesForResults = (evKeyEvent && evKeyEvent.indexOf('F1_') === 0);
        if (isF1SeriesForResults) {
          rr = normalizeF1RaceGridColumn(rr);
        }
        if (isIndycarSeriesId(seriesIdLower) && rr) {
          rr = normalizeIndycarRaceTable(rr);
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
        var stockTitles = stockCarRaceResultsTitles(d, stockCarStageFormat, eventHasStage4, isStockCarSeriesRace);
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
    if (seriesUsesStages(seriesIdLower)) {
      add((d.stage1_laps ? t('table.stage1') + ' (' + d.stage1_laps + ' ' + t('stage.laps') + ')' : t('table.stage1')), tgaStageTable(tables, 1), 'race-stage-table race-stage-table--points', null, stageWidthsForUse, null, null, false);
      add((d.stage2_laps ? t('table.stage2') + ' (' + d.stage2_laps + ' ' + t('stage.laps') + ')' : t('table.stage2')), tgaStageTable(tables, 2), 'race-stage-table race-stage-table--points', null, stageWidthsForUse, null, null, false);
      var stage3Title = stockCarStage3TableTitle(d, tables, isStockCarSeriesRace);
      var skipStage3PointsTable = shouldSkipStage3PointsTable(isStockCarSeriesRace, eventHasStage4, tables);
      if (!skipStage3PointsTable) {
        add(stage3Title, tgaStageTable(tables, 3), 'race-stage-table race-stage-table--points', null, stageWidthsForUse, null, null, false);
      }
      if (!tables.race_results) {
        add((d.stage4_laps ? t('table.stage4') + ' (' + d.stage4_laps + ' ' + t('stage.laps') + ')' : t('table.stage4')), tgaStageTable(tables, 4), 'race-stage-table race-stage-table--points', null, stageWidthsForUse, null, null, false);
      }
    }

    appendRaceResultsBlock();
    }

      // Laps led / Best laps — separate tables only if not embedded in F1 results.
      function f1HidesSeparateLapsTables(evKey, tbls) {
        if (!evKey || evKey.indexOf('F1_') !== 0) return false;
        var legacyEmbedded = {
          F1_2025_1: true, F1_2025_2: true, F1_2025_3: true, F1_2025_4: true, F1_2025_5: true,
          F1_2025_6: true, F1_2025_7: true, F1_2025_8: true, F1_2025_9: true, F1_2025_10: true,
          F1_2025_11: true, F1_2025_12: true, F1_2025_14: true, F1_2025_16: true, F1_2025_18: true,
          F1_2025_19: true, F1_2025_20: true, F1_2026_1: true, F1_2026_2: true, F1_2026_3: true, F1_2026_4: true,
          F1_2026_5: true, F1_2026_6: true, F1_2026_7: true, F1_2026_8: true
        };
        if (legacyEmbedded[evKey]) return true;
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
        var penaltiesTitle;
        if (evKeyEvent === 'F1_2025_2') {
          penaltiesTitle = t('table.penalties_after');
        } else {
          penaltiesTitle = (typeof t === 'function' && t('table.penalties')) ? t('table.penalties') : 'Penalties during the race';
        }
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
      var ps = tables.pit_stops;
      var psTitle = (ps.title && String(ps.title).trim())
        ? localizeSectionTitle(ps.title)
        : t('table.pit_stops');
      var psRows = ps.rows || [];
      var pitEntryList = Array.isArray(d.entry_list) ? d.entry_list : [];
      var resolvePitDriver = (window.TGA && window.TGA.resolveDriverFromEntryList) || function (n) { return n; };
      function parseStint(str) {
        if (!str || typeof str !== 'string') return null;
        str = str.trim();
        function mapCompound(code) {
          code = String(code || '').toUpperCase();
          if (code === 'C1' || code === 'C2') return 'H';
          if (code === 'C3' || code === 'C4') return 'M';
          if (code === 'C5' || code === 'C6') return 'S';
          return code.charAt(0);
        }
        // Ignore transient U/N markers and normalize parentheses.
        var clean = str.replace(/^((?:C[1-6])|[HMSIW])(?:[NU])?/i, function (match) {
          return match.replace(/[NU]$/i, '');
        }).replace(/\s*\(\s*(\d+)\s*\)\s*$/i, ' $1');
        var m = clean.match(/^((?:C[1-6])|[HMSIW])\s*\(?([0-9]+)\)?\s*[\u2013\u2014\-]\s*\(?([0-9]+)\)?$/i);
        if (m) return { compound: mapCompound(m[1]), from: parseInt(m[2], 10), to: parseInt(m[3], 10) };
        var single = clean.match(/^((?:C[1-6])|[HMSIW])\s*\(?([0-9]+)\)?$/i);
        if (single) {
          var n = parseInt(single[2], 10);
          return { compound: mapCompound(single[1]), from: n, to: n };
        }
        var plain = clean.match(/^((?:C[1-6])|[HMSIW])$/i);
        if (plain) return { compound: mapCompound(plain[1]), from: 0, to: 0 };
        if (/^((?:C[1-6])|[HMSIW])\s*0\s*\(DNS\)/i.test(clean)) return { compound: mapCompound(RegExp.$1), from: 0, to: 0 };
        return null;
      }
      // Max laps for bar width normalization.
      // If event has total laps — use it, else fallback 58.
      var maxLaps = 58;
      if (d && d.laps != null && String(d.laps).trim() !== '') {
        var lapsInt = parseInt(String(d.laps).trim(), 10);
        if (!isNaN(lapsInt) && lapsInt > 0) maxLaps = lapsInt;
      }
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
          var seg = parseStint(row[s]);
          if (seg) {
            stints.push(seg);
            usedCompounds[seg.compound] = true;
          }
        }
        if (stints.length === 0 && totalLaps === 0 && row[1]) {
          var first = String(row[1]).trim();
          if (first) {
            var comp = first.charAt(0).toUpperCase();
            stints.push({ compound: comp, from: 0, to: 0 });
            usedCompounds[comp] = true;
          }
        }
        // Empty segment to maxLaps — so bar right edge aligns for all.
        if (totalLaps > 0 && totalLaps < maxLaps) {
          stints.push({ compound: '_', from: totalLaps + 1, to: maxLaps });
        }
        // Pit stop count: stints minus one (ignoring DNS).
        var nonDnsStints = stints.filter(function (seg) {
          return !(totalLaps === 0 && seg.from === 0 && seg.to === 0);
        });
        if (nonDnsStints.length > 1) {
          totalPitStops += (nonDnsStints.length - 1);
        }

        // Single-width bar (100% wrap) when totalLaps > 0 for aligned right edge.
        var barStyle = totalLaps > 0
          ? 'width: 100%;'
          : 'width: 20px; min-width: 20px;';
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
          if (isDns) {
            segStyle = 'width:20px;min-width:20px;max-width:20px;flex:0 0 auto';
          } else {
            // Share on 0..maxLaps scale so bar right edge aligns for all.
            var pct = maxLaps > 0 ? (laps / maxLaps) * 100 : 0;
            var minW = isEmpty ? '0' : '4px';
            segStyle = 'width:' + (Math.round(pct * 100) / 100) + '%;flex:0 0 auto;min-width:' + minW;
          }
          html += '<div class="' + cls + '" style="' + segStyle + '">';
          var nextSeg = stints[i + 1];
          var nextIsEmpty = nextSeg && nextSeg.compound === '_';
          if (i < stints.length - 1 && seg.to > 0 && !isDns && !isEmpty && !nextIsEmpty) {
            // Pit lap number: early stints (1–2) — pit on that lap; else first out lap (seg.to + 1).
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
      sortQueue.push({ rows: psRows, getRowClass: null });
    }
    if (tables.caution_breakdown) {
      var cbData = tables.caution_breakdown;
      if (isIndycarSeriesId(seriesIdLower) && cbData.headers && Array.isArray(cbData.rows)) {
        cbData = dropIndycarCautionFreePassColumn(cbData);
      }
      var cbRowClass = function (row) {
        return cautionBreakdownRowClass(row, cbData.headers);
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

  function renderBopContent(escapeFn, eventData) {
    var e = escapeFn || function (s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
    var evKey = ((eventData && eventData.event_id) || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
    var isImsa2026Round1 = evKey === 'IMSA_2026_1';
    var isImsa2026Round2 = evKey === 'IMSA_2026_2';
    var isImsa2026Round3 = evKey === 'IMSA_2026_3';
    var isImsa2026Round4 = evKey === 'IMSA_2026_4';
    var isImsa2026Round5 = evKey === 'IMSA_2026_5';
    var isImsa2026Round6 = evKey === 'IMSA_2026_6';
    function bopH(key) { return t('event.bop.h.' + key); }
    function bopHeaders(keys) { return keys.map(bopH); }
    function localizeBopCell(val) {
      var s = String(val == null ? '' : val);
      if (getLang() !== 'ru') return s;
      if (s === 'BoP Table') return t('event.bop.bop_table');
      return s
        .replace(/\(2026 Homologation\)/g, t('event.bop.homologation_2026'))
        .replace(/\(2025 Homologation\)/g, t('event.bop.homologation_2025'));
    }
    function row(cells) {
      return '<tr>' + cells.map(function (c) {
        return '<td>' + e(localizeBopCell(c)).replace(/\n/g, '<br>') + '</td>';
      }).join('') + '</tr>';
    }
    function theadRow(cells) { return '<tr>' + cells.map(function (c) { return '<th>' + e(c) + '</th>'; }).join('') + '</tr>'; }
    function bopNotes(noteKeys) {
      var items = noteKeys.map(function (k) {
        return '<li>' + e(t('event.bop.note.' + k)) + '</li>';
      }).join('');
      return '<p class="bop-notes"><strong>' + e(t('event.bop.notes_label')) + '</strong></p><ul class="bop-notes-list">' + items + '</ul>';
    }
    var gtpCars = isImsa2026Round3 ? [
      ['Acura', 'ARX-06', '1059', '9512', '96.2', '97.1', '190', '200', '901', '22.525', 'R80'],
      ['Aston Martin', 'Valkyrie', '1030', '8400', '100.0', '100.0', '190', '200', '913', '22.825', 'R80'],
      ['BMW', 'M Hybrid V8', '1059', '8000', '99.0', '96.9', '190', '200', '908', '22.700', 'R80'],
      ['Cadillac', 'V-Series.R', '1058', '8800', '98.3', '97.1', '190', '200', '906', '22.650', 'R80'],
      ['Porsche', '963 (2026 Homologation)', '1100', '8158', '92.3', '100.0', '190', '200', '913', '22.825', 'R80'],
      ['Porsche', '963 (2025 Homologation)', '1060', '8158', '96.0', '96.0', '190', '200', '906', '22.650', 'R80']
    ] : isImsa2026Round5 ? [
      ['Acura', 'ARX-06', '1051', '9512', '100.0', '96.2', '190', '200', '907', '22.675', 'R80'],
      ['Aston Martin', 'Valkyrie', '1030', '8400', '100.0', '100.0', '190', '200', '909', '22.725', 'R80'],
      ['BMW', 'M Hybrid V8', '1031', '8000', '99.6', '94.0', '190', '200', '896', '22.400', 'R80'],
      ['Cadillac', 'V-Series.R', '1038', '8800', '98.5', '95.2', '190', '200', '896', '22.400', 'R80'],
      ['Porsche', '963 (2026 Homologation)', '1100', '8158', '94.0', '100.0', '190', '200', '910', '22.750', 'R80'],
      ['Porsche', '963 (2025 Homologation)', '1082', '8158', '98.8', '98.3', '190', '200', '914', '22.850', 'R80']
    ] : isImsa2026Round4 ? [
      ['Acura', 'ARX-06', '1056', '9512', '97.7', '97.3', '190', '200', '904', '22.600', 'R80'],
      ['Aston Martin', 'Valkyrie', '1030', '8400', '100.0', '100.0', '190', '200', '913', '22.825', 'R80'],
      ['BMW', 'M Hybrid V8', '1042', '8000', '98.5', '95.4', '190', '200', '902', '22.550', 'R80'],
      ['Cadillac', 'V-Series.R', '1043', '8800', '98.1', '96.0', '190', '200', '901', '22.525', 'R80'],
      ['Porsche', '963 (2026 Homologation)', '1084', '8158', '92.3', '100.0', '190', '200', '891', '22.275', 'R80'],
      ['Porsche', '963 (2025 Homologation)', '1052', '8158', '96.0', '97.3', '190', '200', '895', '22.375', 'R80']
    ] : isImsa2026Round6 ? [
      ['Acura', 'ARX-06', '1045', '9512', '98.3', '99.6', '230', '240', '911', '22.775', 'R80'],
      ['Aston Martin', 'Valkyrie', '1020', '8400', '100.0', '100.0', '230', '240', '914', '22.850', 'R80'],
      ['BMW', 'M Hybrid V8', '1030', '8000', '98.8', '96.9', '230', '240', '901', '22.525', 'R80'],
      ['Cadillac', 'V-Series.R', '1032', '8800', '97.1', '99.0', '230', '240', '903', '22.575', 'R80'],
      ['Porsche', '963 (2026 Homologation)', '1073', '8158', '96.3', '100.0', '230', '240', '913', '22.825', 'R80'],
      ['Porsche', '963 (2025 Homologation)', '1058', '8158', '100.0', '97.3', '230', '240', '909', '22.725', 'R80']
    ] : [
      ['Acura', 'ARX-06', '1051', '9512', '98.1', '96.3', '230', '240', '898', '22.450', 'R80'],
      ['Aston Martin', 'Valkyrie', '1030', '8400', '100.0', '100.0', '230', '240', '912', '22.800', 'R80'],
      ['BMW', 'M Hybrid V8', '1048', '8000', '97.7', '97.1', '230', '240', '900', '22.500', 'R80'],
      ['Cadillac', 'V-Series.R', '1043', '8800', '98.1', '96.2', '230', '240', '895', '22.375', 'R80'],
      ['Porsche', '963', '1055', '8158', '97.7', '97.1', '230', '240', '902', '22.550', 'R80']
    ];
    var gtpReg = [
      ['PPULimit_BoP', '0', 'kW'],
      ['PPULimitRate_BoP', '1.0', 'kW'],
      ['PPUMaxIntegral_BoP', '10', 'kJ'],
      ['PPURate_BoP', '20', 'kW'],
      ['TDT_LimitRate_BoP', '10', 'Nm*s'],
      ['TDT_MaxIntegral_BoP', '150', 'Nm*s']
    ];
    var gtpRegForRender = (isImsa2026Round4 || isImsa2026Round5 || isImsa2026Round6)
      ? [['PPUEnergyStint_BoP', 'BoP Table', 'MJ'], ['ReplenTime_BoP', '40', 's']].concat(gtpReg)
      : gtpReg;
    var gtdCars = isImsa2026Round3 ? [
      ['Aston Martin', 'Vantage GT3 EVO', '1328', '7000', '91.8', '87.0', '190', '200', '5.0', '11.1', '867', '21.675'],
      ['BMW', 'M4 GT3 EVO', '1346', '7500', '89.6', '93.8', '190', '200', '-2.0', '5.0', '864', '21.600'],
      ['Corvette', 'Z06 GT3.R', '1356', '8000', '95.5', '97.0', '190', '200', '-1.8', '6.4', '876', '21.900'],
      ['Ferrari', '296 GT3 EVO', '1340', '7750', '83.3', '87.9', '190', '200', '-1.7', '4.1', '853', '21.325'],
      ['Ford', 'Mustang GT3', '1330', '8250', '97.2', '96.4', '190', '200', '-0.4', '7.1', '876', '21.900'],
      ['Lamborghini', 'Huracan GT3 EVO2', '1342', '8300', '83.2', '88.8', '190', '200', '2.0', '8.4', '868', '21.700'],
      ['Lamborghini', 'Temerario GT3', '1337', '8000', '86.4', '88.5', '190', '200', '1.0', '5.1', '877', '21.925'],
      ['Lexus', 'RC F GT3', '1356', '7200', '96.9', '96.8', '190', '200', '4.0', '11.0', '919', '22.975'],
      ['Mercedes-AMG', 'GT3', '1356', '7900', '89.7', '90.9', '190', '200', '0.0', '9.0', '897', '22.425'],
      ['Porsche', '911 GT3 R (992)', '1384', '8950', '89.6', '100.0', '190', '200', '7.3', '9.3', '855', '21.375']
    ] : isImsa2026Round5 ? [
      ['BMW', 'M4 GT3 EVO', '1338', '7500', '92.3', '90.3', '170', '180', '-2.0', '5.0', '875', '21.875'],
      ['Corvette', 'Z06 GT3.R', '1370', '8000', '97.6', '96.1', '170', '180', '-1.8', '6.4', '889', '22.225'],
      ['Ford', 'Mustang GT3', '1326', '8250', '100.0', '96.5', '170', '180', '-0.4', '7.1', '890', '22.250'],
      ['Lamborghini', 'Temerario GT3', '1337', '8000', '87.9', '88.0', '170', '180', '1.0', '5.2', '888', '22.200'],
      ['Lexus', 'RC F GT3', '1356', '7200', '95.6', '95.8', '170', '180', '4.0', '11.0', '914', '22.850'],
      ['McLaren', '720S GT3 EVO', '1330', '8100', '93.2', '92.3', '170', '180', '3.1', '11.3', '887', '22.175'],
      ['Porsche', '911 GT3 R (992)', '1384', '8950', '92.7', '97.3', '170', '180', '7.3', '9.3', '874', '21.850']
    ] : isImsa2026Round6 ? [
      ['Aston Martin', 'Vantage GT3 EVO', '1287', '7000', '87.6', '86.3', '190', '200', '5.0', '11.1', '858', '21.450'],
      ['BMW', 'M4 GT3 EVO', '1340', '7500', '91.0', '93.2', '190', '200', '-2.0', '5.0', '890', '22.250'],
      ['Corvette', 'Z06 GT3.R', '1373', '8000', '98.4', '99.8', '190', '200', '-1.8', '6.4', '926', '23.150'],
      ['Ferrari', '296 GT3 EVO', '1350', '7750', '83.9', '88.6', '190', '200', '-1.7', '4.1', '875', '21.875'],
      ['Ford', 'Mustang GT3', '1332', '8250', '99.3', '98.7', '190', '200', '-0.4', '7.1', '932', '23.300'],
      ['Lamborghini', 'Huracan GT3 EVO2', '1353', '8300', '85.8', '90.8', '190', '200', '2.0', '8.4', '917', '22.925'],
      ['Lamborghini', 'Temerario GT3', '1340', '8000', '86.3', '91.5', '190', '200', '1.0', '5.2', '923', '23.075'],
      ['Lexus', 'RC F GT3', '1356', '7200', '96.1', '98.6', '190', '200', '4.0', '11.0', '988', '24.700'],
      ['McLaren', '720S GT3 EVO', '1330', '8100', '94.6', '94.3', '190', '200', '3.1', '11.3', '924', '23.100'],
      ['Mercedes-AMG', 'GT3', '1356', '7900', '95.5', '90.9', '190', '200', '0.0', '9.0', '964', '24.100'],
      ['Porsche', '911 GT3 R (992)', '1374', '8950', '97.1', '100.0', '190', '200', '7.3', '9.3', '887', '22.175']
    ] : isImsa2026Round4 ? [
      ['Aston Martin', 'Vantage GT3 EVO', '1287', '7000', '85.9', '83.4', '170', '180', '5.0', '11.1', '833', '20.825'],
      ['BMW', 'M4 GT3 EVO', '1334', '7500', '90.8', '94.9', '170', '180', '-2.0', '5.0', '864', '21.600'],
      ['Corvette', 'Z06 GT3.R', '1360', '8000', '97.5', '98.7', '170', '180', '-1.8', '6.4', '885', '22.125'],
      ['Ferrari', '296 GT3 EVO', '1350', '7750', '85.1', '90.7', '170', '180', '-1.7', '4.1', '862', '21.550'],
      ['Ford', 'Mustang GT3', '1315', '8250', '99.6', '94.5', '170', '180', '-0.4', '7.1', '880', '22.000'],
      ['Lamborghini', 'Huracan GT3 EVO2', '1342', '8300', '89.0', '89.2', '170', '180', '2.0', '8.4', '889', '22.225'],
      ['Lamborghini', 'Temerario GT3', '1337', '8000', '90.4', '89.7', '170', '180', '1.0', '5.1', '893', '22.325'],
      ['Lexus', 'RC F GT3', '1356', '7200', '96.1', '100.0', '170', '180', '4.0', '11.0', '920', '23.000'],
      ['McLaren', '720S GT3 EVO', '1327', '8100', '94.5', '90.7', '170', '180', '3.1', '11.3', '880', '22.000'],
      ['Mercedes-AMG', 'GT3', '1356', '7900', '91.6', '87.5', '170', '180', '0.0', '9.0', '898', '22.450'],
      ['Porsche', '911 GT3 R (992)', '1373', '8950', '97.2', '95.7', '170', '180', '7.3', '9.3', '867', '21.675']
    ] : [
      ['Aston Martin', 'Vantage GT3 EVO', '1323', '7000', '91.9', '88.2', '190', '200', '5.0', '8.1', '871', '21.775'],
      ['BMW', 'M4 GT3 EVO', '1344', '7500', '91.9', '90.5', '190', '200', '-2.0', '2.1', '867', '21.675'],
      ['Corvette', 'Z06 GT3.R', '1360', '8000', '97.3', '92.3', '190', '200', '-1.8', '2.4', '876', '21.900'],
      ['Ferrari', '296 GT3 EVO', '1335', '7750', '85.9', '85.1', '190', '200', '-1.7', '1.1', '856', '21.400'],
      ['Ford', 'Mustang GT3', '1362', '8250', '97.0', '94.6', '190', '200', '-0.4', '2.8', '877', '21.925'],
      ['Lamborghini', 'Huracan GT3 EVO2', '1370', '8300', '84.6', '84.7', '190', '200', '2.0', '4.4', '862', '21.550'],
      ['Lamborghini', 'Temerario GT3', '1351', '8000', '87.9', '86.6', '190', '200', '1.0', '4.1', '885', '22.125'],
      ['Lexus', 'RC F GT3', '1356', '7200', '95.3', '94.7', '190', '200', '4.0', '7.1', '920', '23.000'],
      ['McLaren', '720S GT3 EVO', '1330', '8100', '94.0', '90.0', '190', '200', '3.1', '7.7', '879', '21.975'],
      ['Mercedes', 'AMG GT3', '1356', '7900', '91.9', '91.8', '190', '200', '0.0', '6.9', '910', '22.750'],
      ['Porsche', '911 GT3 R (992)', '1362', '8950', '94.8', '100.0', '190', '200', '7.3', '9.3', '863', '21.575']
    ];
    var gtdReg = [
      ['PPULimit_BoP', '0', 'kW'],
      ['PPULimitRate_BoP', '1.0', 'kW'],
      ['PPUMaxIntegral_BoP', '10', 'kJ'],
      ['PPURate_BoP', '20', 'kW']
    ];
    var gtpHead = bopHeaders(['manufacturer', 'car_model', 'weight_kg', 'nmax_rpm', 'power_le_v1', 'power_ge_v2', 'v1_kmh', 'v2_kmh', 'max_stint_energy', 'replenishment_rate', 'fuel']);
    var gtpRegHead = bopHeaders(['regulatory_param', 'gtp', 'unit']);
    var gtdHead = bopHeaders(['manufacturer', 'car_model', 'weight_kg', 'nmax_rpm', 'power_le_v1', 'power_ge_v2', 'v1_kmh', 'v2_kmh', 'wing_min', 'wing_max', 'max_stint_energy', 'replenishment_rate']);
    var gtdRegHead = bopHeaders(['parameter', 'value', 'unit']);
    var out = '';
    out += '<div class="bop-content">';
    var bopTitleKey = 'event.bop.title.daytona';
    var bopRound = '1';
    if (isImsa2026Round2) {
      bopTitleKey = 'event.bop.title.sebring';
      bopRound = '2';
    } else if (isImsa2026Round3) {
      bopTitleKey = 'event.bop.title.long_beach';
      bopRound = '3';
    } else if (isImsa2026Round4) {
      bopTitleKey = 'event.bop.title.monterey';
      bopRound = '4';
    } else if (isImsa2026Round5) {
      bopTitleKey = 'event.bop.title.detroit';
      bopRound = '5';
    } else if (isImsa2026Round6) {
      bopTitleKey = 'event.bop.title.watkins_glen';
      bopRound = '6';
    } else if (isImsa2026Round1) {
      bopTitleKey = 'event.bop.title.daytona';
      bopRound = '1';
    }
    var bopTitle = t(bopTitleKey);
    var bopSubtitle = t('event.bop.subtitle').replace('{round}', bopRound);
    out += '<h2 class="bop-main-title">' + e(bopTitle) + '</h2>';
    out += '<p class="bop-subtitle">' + e(bopSubtitle) + '</p>';
    out += '<hr class="bop-divider">';
    out += '<h3 class="bop-class-title">' + e(t('event.bop.gtp_class')) + '</h3>';
    out += '<div class="table-wrap"><table class="data-table bop-table">';
    out += '<thead>' + theadRow(gtpHead) + '</thead><tbody>';
    gtpCars.forEach(function (r) { out += row(r); });
    out += '</tbody></table></div>';
    out += bopNotes(['gtp_1', 'gtp_2', 'gtp_3']);
    if (!isImsa2026Round3) {
      out += '<h4 class="table-section-title">' + e(t('event.bop.gtp_reg_title')) + '</h4>';
      out += '<div class="table-wrap"><table class="data-table bop-table">';
      out += '<thead>' + theadRow(gtpRegHead) + '</thead><tbody>';
      gtpRegForRender.forEach(function (r) { out += row(r); });
      out += '</tbody></table></div>';
    }
    out += '<hr class="bop-divider">';
    out += '<h3 class="bop-class-title">' + e(t(isImsa2026Round3 ? 'event.bop.gtd_class' : 'event.bop.gtd_pro_class')) + '</h3>';
    out += '<div class="table-wrap"><table class="data-table bop-table bop-table--wide">';
    out += '<thead>' + theadRow(gtdHead) + '</thead><tbody>';
    gtdCars.forEach(function (r) { out += row(r); });
    out += '</tbody></table></div>';
    out += bopNotes(['gtd_1', 'gtd_2', 'gtd_3', 'gtd_4', 'gtd_5', 'gtd_6']);
    if (!isImsa2026Round3) {
      out += '<h4 class="table-section-title">' + e(t('event.bop.gtd_reg_title')) + '</h4>';
      out += '<div class="table-wrap"><table class="data-table bop-table">';
      out += '<thead>' + theadRow(gtdRegHead) + '</thead><tbody>';
      gtdReg.forEach(function (r) { out += row(r); });
      out += '</tbody></table></div>';
    }
    out += '</div>';
    return out;
  }

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

  function renderEventSectionContent(d, section, contentEl, eventIdFromRoute) {
    if (contentEl) contentEl.setAttribute('data-event-section', section || '');
    var seriesId  = eventSeriesId(d.event_id || eventIdFromRoute || '');
    var isStockCar = isStockCarSeriesId(seriesId);
    var html = '';
    var sortQueue = [];
    var byNumber = (isStockCar && d.entry_list && d.entry_list.length)
      ? buildTeamNamesByNumberFromEntryList(d.entry_list)
      : (d.team_names_by_number && typeof d.team_names_by_number === 'object' ? d.team_names_by_number : null);
    var evKeyEvent = ((d.event_id || '') + '').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
    if (contentEl) contentEl.setAttribute('data-event-id', evKeyEvent || '');

    function applyTeamNameByNumber(rows, numberColIdx, teamColIdx) {
      if (!byNumber) return rows;
      return rows.map(function (row) {
        var r = row.slice();
        if (r.length > Math.max(numberColIdx, teamColIdx) && r[numberColIdx] != null) {
          var num = String(r[numberColIdx]).trim();
          var teamFromTeams = byNumber[num] || byNumber[String(parseInt(num, 10))];
          if (teamFromTeams != null) r[teamColIdx] = teamFromTeams;
        }
        return r;
      });
    }

    function formatSuperFormulaEngineLabel(raw) {
      var s = (raw == null ? '' : String(raw)).trim();
      if (!s) return s;
      var u = s.toUpperCase();
      if (u.indexOf('HONDA') >= 0 || u.indexOf('HR-417E') >= 0) return 'Honda HR-417E';
      if (u.indexOf('TOYOTA') >= 0 || u.indexOf('TRD01F') >= 0 || u.indexOf('TRD-01F') >= 0) return 'Toyota TRD-01F';
      return s;
    }
    function normalizeSuperFormulaEngineColumns(tableData) {
      if (!tableData || !Array.isArray(tableData.headers) || !Array.isArray(tableData.rows)) return tableData;
      var seriesUpper = (seriesId || '').toUpperCase();
      if (seriesUpper !== 'SUPER_FORMULA') return tableData;
      var engineIdx = [];
      for (var hi = 0; hi < tableData.headers.length; hi++) {
        if (String(tableData.headers[hi] || '').trim().toLowerCase() === 'engine') engineIdx.push(hi);
      }
      if (engineIdx.length === 0) return tableData;
      return {
        headers: tableData.headers.slice(),
        rows: tableData.rows.map(function (r) {
          var row = Array.isArray(r) ? r.slice() : [];
          engineIdx.forEach(function (idx) {
            if (idx >= 0 && idx < row.length) row[idx] = formatSuperFormulaEngineLabel(row[idx]);
          });
          return row;
        })
      };
    }
    function appendTable(title, tableData, extraClass, getRowClass, mergeTeamCells) {
      function dropTimeOfDayColumn(td) {
        if (!td || !Array.isArray(td.headers) || !Array.isArray(td.rows)) return td;
        var idx = -1;
        for (var i = 0; i < td.headers.length; i++) {
          var h = String(td.headers[i] || '').toLowerCase().trim();
          if (h === 'time of the day') {
            idx = i;
            break;
          }
        }
        if (idx < 0) return td;
        return {
          headers: td.headers.slice(0, idx).concat(td.headers.slice(idx + 1)),
          rows: td.rows.map(function (r) {
            return Array.isArray(r) ? r.slice(0, idx).concat(r.slice(idx + 1)) : r;
          }),
          meta: td.meta
        };
      }
      function buildStartSubtitle(meta) {
        if (!meta || typeof meta !== 'object') return '';
        var parts = [];
        Object.keys(meta).forEach(function (k) {
          if (!/^start/i.test(String(k || '').trim())) return;
          var v = meta[k];
          if (v == null || String(v).trim() === '') return;
          var key = String(k).trim();
          var label = 'Start';
          var m = key.match(/^start\s*\((.+)\)$/i);
          if (m && m[1] && String(m[1]).trim()) label = String(m[1]).trim();
          parts.push(label + ': ' + String(v).trim());
        });
        return parts.join(' · ');
      }
      tableData = transformTableDataForF2F3(tableData, evKeyEvent);
      tableData = normalizeSuperFormulaEngineColumns(tableData);
      tableData = dropTimeOfDayColumn(tableData);
      if (isSupercarsSeriesId(seriesId) && isSupercarsSydneyEvent(evKeyEvent)) {
        tableData = supercarsSydneyCarDisplay(tableData);
      }
      var subtitle = (tableData && tableData.meta) ? buildStartSubtitle(tableData.meta) : '';
      var result = buildTableSection(title, tableData, extraClass, getRowClass, null, subtitle, null, mergeTeamCells);
      if (!result) return;
      html += result.html;
      sortQueue.push({ rows: result.rows, getRowClass: result.getRowClass });
    }

    var eventIdUpperForClass = String(d.event_id || eventIdFromRoute || '').toUpperCase();
    var elmsClassMap = {
      'lmp2': 'LMP2',
      'lmp2-pro-am': 'LMP2 Pro/Am',
      'lmp3': 'LMP3',
      'lmgt3': 'LMGT3'
    };
    function normalizeClassName(v) {
      return String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    }
    function filterTableRowsByClass(tableData, className) {
      if (!tableData || !Array.isArray(tableData.headers) || !Array.isArray(tableData.rows)) return tableData;
      var clsIdx = -1;
      for (var i = 0; i < tableData.headers.length; i++) {
        if (String(tableData.headers[i] || '').trim().toLowerCase() === 'class') {
          clsIdx = i;
          break;
        }
      }
      if (clsIdx < 0) return tableData;
      var wanted = normalizeClassName(className);
      var out = {
        headers: tableData.headers.slice(),
        rows: tableData.rows.filter(function (row) {
          return normalizeClassName(row && row[clsIdx]) === wanted;
        })
      };
      // Preserve session metadata (title/meta/note/etc.) so UI labels do not regress to defaults.
      Object.keys(tableData).forEach(function (k) {
        if (k === 'headers' || k === 'rows') return;
        out[k] = tableData[k];
      });
      return out;
    }
    if (eventIdUpperForClass === 'ELMS_2026_PROLOGUE' && elmsClassMap[section]) {
      var className = elmsClassMap[section];
      var scopedTables = Object.assign({}, d.tables || {});
      scopedTables.practice = filterTableRowsByClass(scopedTables.practice, className);
      scopedTables.practice2 = filterTableRowsByClass(scopedTables.practice2, className);
      scopedTables.practice3 = filterTableRowsByClass(scopedTables.practice3, className);
      scopedTables.final_practice = filterTableRowsByClass(scopedTables.final_practice, className);
      scopedTables.practice5 = filterTableRowsByClass(scopedTables.practice5, className);
      d = Object.assign({}, d, {
        tables: scopedTables,
        entry_list: Array.isArray(d.entry_list)
          ? d.entry_list.filter(function (e) { return normalizeClassName(e && e.class) === normalizeClassName(className); })
          : []
      });
      section = 'practice';
    }
    if (eventIdUpperForClass === 'WEC_2026_PROLOGUE' && (section === 'hypercar' || section === 'lmgt3')) {
      var prWec = d.tables && d.tables.practice;
      if (prWec && Array.isArray(prWec.sessions)) {
        var sessFiltered = prWec.sessions.filter(function (s) {
          var t = String((s && s.title) || '').trim();
          var isLmgt3Block = /^LMGT3\b/i.test(t);
          if (section === 'lmgt3') return isLmgt3Block;
          return !isLmgt3Block;
        });
        d = Object.assign({}, d, {
          tables: Object.assign({}, d.tables, {
            practice: Object.assign({}, prWec, { sessions: sessFiltered })
          })
        });
      }
      section = 'practice';
    }

    if (section === 'race') {
      renderRaceContent(d, contentEl);
      return;
    }

    if (section === 'bop') {
      contentEl.innerHTML = renderBopContent(esc, d);
      return;
    }

    if (section === 'pre_season_tests') {
      var evKeyPst = ((d.event_id || '') + '').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
      var pst = d.tables && d.tables.pre_season_tests;
      function renderOneSession(sess) {
        var out = '';
        if (sess.title) out += '<h3 class="event-pre-season-title">' + esc(sess.title) + '</h3>';
        if (sess.subtitle) out += '<p class="event-pre-season-subtitle">' + esc(sess.subtitle) + '</p>';
        if (sess.caption) out += '<p class="event-pre-season-caption">' + esc(sess.caption) + '</p>';
        if (!( /^IMSA_\d{4}_\d+$/.test(evKeyPst) || evKeyPst === 'IMSA_2026_PRE_SEASON_TEST') && evKeyPst !== 'F1_2026_PRE_SEASON_TEST_1' && evKeyPst !== 'F1_2026_PRE_SEASON_TEST_2') {
          out += buildSessionMetaTable(sess.meta);
        }
        if (sess.headers && Array.isArray(sess.rows)) {
          var rows = sess.rows;
          if (evKeyPst === 'IMSA_2026_PRE_SEASON_TEST' || evKeyPst === 'IMSA_2026_1') {
            var stIdx = sess.headers.indexOf('ST POS');
            if (stIdx >= 0) {
              sess.headers = sess.headers.slice(0, stIdx).concat(sess.headers.slice(stIdx + 1));
              rows = rows.map(function (r) { return r.slice(0, stIdx).concat(r.slice(stIdx + 1)); });
            }
          }
          var teamColIdx = -1;
          for (var hi = 0; hi < sess.headers.length; hi++) {
            var hText = (sess.headers[hi] || '').toLowerCase().trim();
            if (hText === 'team/car/sponsor' || hText.indexOf('team/car') === 0) {
              teamColIdx = hi;
              break;
            }
          }
          if (teamColIdx >= 0) {
            var newHeaders = [];
            for (var hi2 = 0; hi2 < sess.headers.length; hi2++) {
              if (hi2 === teamColIdx) {
                newHeaders.push('TEAM', 'CAR');
              } else {
                newHeaders.push(sess.headers[hi2]);
              }
            }
            sess.headers = newHeaders;
            var dropSponsorInCar = (evKeyPst === 'IMSA_2026_PRE_SEASON_TEST' || evKeyPst === 'IMSA_2026_1');
            rows = rows.map(function (r) {
              var cell = r[teamColIdx] != null ? String(r[teamColIdx]) : '';
              var parts = cell.split(/\s*\/\s*/);
              var team = (parts[0] || '').trim();
              var car = dropSponsorInCar ? (parts[1] != null ? String(parts[1]).trim() : '') : parts.slice(1).join(' / ');
              var before = r.slice(0, teamColIdx);
              var after = r.slice(teamColIdx + 1);
              return before.concat([team, car], after);
            });
          }
          /* Do not filter by NO LAPS for IMSA pre_season_tests — otherwise Session 1 may be empty  */
          var numberColIdx = sess.headers.indexOf('CAR NO');
          var teamColIdxAfterSplit = sess.headers.indexOf('TEAM');
          if (numberColIdx < 0) numberColIdx = 1;
          if (teamColIdxAfterSplit < 0) teamColIdxAfterSplit = 3;
          if (evKeyPst !== 'F1_2026_PRE_SEASON_TEST_1' && evKeyPst !== 'F1_2026_PRE_SEASON_TEST_2') {
            rows = applyTeamNameByNumber(rows, numberColIdx, teamColIdxAfterSplit);
          }
          var resultsTitle = (evKeyPst === 'F1_2026_PRE_SEASON_TEST_1' || evKeyPst === 'F1_2026_PRE_SEASON_TEST_2') ? '' : '<h4 class="table-section-title">' + esc(t('table.results')) + '</h4>';
          out += resultsTitle;
          var defaultHeaders = ['POS', 'CAR NO', 'DRIVERS', 'TEAM', 'CAR', 'CLASS', 'CLASS POS', 'ST POS', 'NO LAPS', 'FASTEST LAP', 'STATUS'];
          var headersForTable = sess.headers && sess.headers.length > 0 ? sess.headers : defaultHeaders;
          if (rows.length > 0 && headersForTable.length !== rows[0].length) {
            if (headersForTable.length < rows[0].length) {
              while (headersForTable.length < rows[0].length) headersForTable.push(defaultHeaders[headersForTable.length] || '');
            } else {
              headersForTable = headersForTable.slice(0, rows[0].length);
            }
          }
          if ((/^IMSA_\d{4}_\d+$/.test(evKeyPst) || evKeyPst === 'IMSA_2026_PRE_SEASON_TEST') && d.entry_list && d.entry_list.length) {
            var pstData = applyClassFromEntryList({ headers: headersForTable, rows: rows }, d.entry_list);
            pstData = recomputeClassPos(pstData);
            headersForTable = pstData.headers;
            rows = pstData.rows;
          }
          var tbl = { headers: headersForTable, rows: rows };
          var pstTableClass = 'pre-season-results-table pre-season-results-table--session';
          if (evKeyPst === 'F1_2026_PRE_SEASON_TEST_1' || evKeyPst === 'F1_2026_PRE_SEASON_TEST_2') pstTableClass += ' pre-season-results-table--fit';
          if ((seriesId || '').toLowerCase() === 'imsa') pstTableClass += ' race-session-results-table';
          var result = buildTableSection(null, tbl, pstTableClass);
          if (result) {
            var htmlFrag = result.html;
            out += htmlFrag;
            sortQueue.push({ rows: result.rows, getRowClass: result.getRowClass });
          }
        }
        return out;
      }
      if (pst && Array.isArray(pst.sessions) && pst.sessions.length > 0) {
        html += '<div class="event-pre-season-block">';
        pst.sessions.forEach(function (sess, idx) {
          if (idx > 0) html += '<hr class="event-pre-season-divider">';
          html += renderOneSession(sess);
        });
        html += '</div>';
      } else if (pst && (pst.title || pst.headers)) {
        html += '<div class="event-pre-season-block">';
        html += renderOneSession(pst);
        html += '</div>';
      } else if (pst && pst.headers && Array.isArray(pst.rows)) {
        appendTable(t('block.pre_season_tests'), pst);
      }
      if (!html) contentEl.innerHTML = '<p class="empty-msg">' + (t('error.no_section_data') || 'No data yet') + '</p>';
      else { contentEl.innerHTML = html; var tables = contentEl.querySelectorAll('.data-table'); [].forEach.call(tables, function (table, idx) { var q = sortQueue[idx]; if (q && q.rows) makeTableSortable(table, q.rows, esc, q.getRowClass); }); }
      return;
    }

    if (section === 'entry-list') {
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
                  ? teamLink(teamRaw)
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
                cells += '<td>' + (drvRaw ? renderDriverCell(drvRaw) : '—') + '</td>';
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
      var seriesSlugEntryList = (eventSeriesId(d.event_id || eventIdFromRoute || '') || '').toLowerCase();
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
              ? driverParts.map(function (name) { return renderDriverCell(name); }).join(' / ')
              : '—';
            var span = teamRowspan[idx];
            var teamTd = span > 0
              ? '<td rowspan="' + span + '" class="entry-list-team-cell">' + (teamDisplay ? teamLink(teamDisplay) : '—') + '</td>'
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
      var seriesLowerEntry = (eventSeriesId(d.event_id || eventIdFromRoute || '') || '').toLowerCase();
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
          return renderDriverCell(raw);
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
            var teamCell = teamName ? teamLink(teamName) : '—';
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
          return renderDriverCell(raw);
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
            var teamCellG = teamNameG ? teamLink(teamNameG) : '—';
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
          return names.map(function (name) { return renderDriverCell(name); }).join(' / ');
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
            var teamCell = teamName ? teamLink(teamName) : '—';
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
        || isF4SeriesId(seriesLowerEntry)
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
              ? '<td rowspan="' + spans[idx] + '" class="entry-list-team-cell">' + (teamDisplay ? teamLink(teamDisplay) : '—') + '</td>'
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
            var driverCell = renderDriverCell(row.driver);
            var teamDisplay = safeTeamStr(row);
            var isFirstInTeam = (idx === 0 || safeTeamStr(arr[idx - 1]) !== teamDisplay);
            var teamCell = (isFirstInTeam && spans[idx] > 0)
              ? '<td rowspan="' + spans[idx] + '" class="entry-list-team-cell">' + (teamDisplay ? teamLink(teamDisplay) : '—') + '</td>'
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
        entryCopy = expandSupercarsSubstituteEntryRows(entryCopy);
      }
      var isF1Entry = seriesLower === 'f1' || (String(d.series || '').toLowerCase().indexOf('formula 1') >= 0);
      // F1 2025, Australian GP: "constructor → chassis" mapping for entry list.
      var F1_2025_ENTRY_CHASSIS = {
        'Alpine-Renault': 'A525',
        'Aston Martin Aramco-Mercedes': 'AMR25',
        'Ferrari': 'SF-25',
        'Haas-Ferrari': 'VF-25',
        'Kick Sauber-Ferrari': 'C45',
        'McLaren-Mercedes': 'MCL39',
        'Mercedes': 'F1 W16',
        'Racing Bulls-Honda RBPT': 'VCARB02',
        'Red Bull Racing-Honda RBPT': 'RB21',
        'Williams-Mercedes': 'FW47'
      };
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
        // F1 2025: for all season events substitute chassis code instead of repeating constructor.
        if (isF1Entry && evKeyEntry && evKeyEntry.indexOf('F1_2025_') === 0 && manu) {
          var code = F1_2025_ENTRY_CHASSIS[manu];
          if (code) return code;
        }
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
        return names.map(function (name) { return renderDriverCell(name); }).join(' / ');
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
        var teamCell = teamDisplay ? teamLink(teamDisplay) : '—';
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
            ? '<td rowspan="' + tSpan + '" class="entry-list-team-cell">' + (teamDisplay ? teamLink(teamDisplay) : '—') + '</td>'
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
            ? '<td rowspan="' + tSpan + '" class="entry-list-team-cell">' + (teamDisplay ? teamLink(teamDisplay) : '—') + '</td>'
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
            ? '<td rowspan="' + tSpan + '" class="entry-list-team-cell">' + (teamDisplay ? teamLink(teamDisplay) : '—') + '</td>'
            : '';
          var manufacturerCell = isFirstManu && manuSpan > 0
            ? '<td rowspan="' + manuSpan + '" class="entry-list-team-cell">' + esc(dash(manufacturerDisplay)) + '</td>'
            : '';
          var driverCell = renderDriverCell(row && row.driver);
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

    if (section === 'test') {
      var testTbl = d.tables && d.tables.test;
      function testSessionTableData(sess) {
        return gtwceEndTimedSessionTableData({ headers: sess.headers, rows: sess.rows }, evKeyEvent);
      }
      if (testTbl && Array.isArray(testTbl.sessions) && testTbl.sessions.length > 0) {
        testTbl.sessions.forEach(function (sess) {
          if (!sess || !sess.headers || !Array.isArray(sess.rows) || !sess.rows.length) return;
          var title = (sess.title && String(sess.title).trim())
            ? sess.title
            : (t('block.test') || 'Test');
          appendTable(title, testSessionTableData(sess));
        });
        if (!html) {
          contentEl.innerHTML = '<p class="empty-msg">' + t('error.no_section_data') + '</p>';
        } else {
          contentEl.innerHTML = html;
          var tablesTest = contentEl.querySelectorAll('.data-table:not(.table-field-value)');
          [].forEach.call(tablesTest, function (table, idx) {
            var q = sortQueue[idx];
            if (q && q.rows) makeTableSortable(table, q.rows, esc, q.getRowClass);
          });
        }
        return;
      }
      if (testTbl && testTbl.headers && Array.isArray(testTbl.rows)) {
        appendTable((testTbl.title && String(testTbl.title).trim()) ? testTbl.title : (t('block.test') || 'Test'), testTbl);
      }
    }

    if (section === 'practice') {
      var prac = d.tables && d.tables.practice;
      if (prac && Array.isArray(prac.headers) && prac.headers.length === 1 && (prac.headers[0] || '').toLowerCase().trim() === 'note' && Array.isArray(prac.rows) && prac.rows.length === 1 && prac.rows[0] && prac.rows[0].length === 1) {
        contentEl.innerHTML = '<p class="race-note">' + esc(String(prac.rows[0][0] || '').trim()) + '</p>';
        return;
      }
      var isSupercarsPractice = isSupercarsSeriesId(seriesId);
      function ensureClassColumn(tableData) {
        if (!tableData || !Array.isArray(tableData.headers) || !Array.isArray(tableData.rows)) return tableData;
        var headers = tableData.headers.slice();
        var classIdx = -1;
        var classPosIdx = -1;
        for (var i = 0; i < headers.length; i++) {
          var h = (headers[i] || '').toUpperCase().trim();
          if (h === 'CLASS') classIdx = i;
          if (h === 'CLASS POS') classPosIdx = i;
        }
        if (classIdx >= 0) return tableData;
        if (classPosIdx < 0) return tableData;
        var outHeaders = headers.slice(0, classPosIdx).concat(['CLASS'], headers.slice(classPosIdx));
        var outRows = tableData.rows.map(function (r) {
          return r.slice(0, classPosIdx).concat([''], r.slice(classPosIdx));
        });
        return { headers: outHeaders, rows: outRows };
      }
      function practiceTableData(t) {
        return dropStartPosColumn(splitTeamCarDropSponsor(t));
      }
      function practiceDataWithClass(t) {
        var data = ensureClassColumn(practiceTableData(t));
        data = ((seriesId || '').toLowerCase() === 'imsa' && d.entry_list && d.entry_list.length)
          ? applyClassFromEntryList(data, d.entry_list)
          : data;
        // ELMS Prologue: Driver column is intentionally hidden.
        if (evKeyEvent === 'ELMS_2026_PROLOGUE' && data && Array.isArray(data.headers) && Array.isArray(data.rows)) {
          var drvIdx = -1;
          for (var di = 0; di < data.headers.length; di++) {
            var dh = String(data.headers[di] || '').trim().toLowerCase();
            if (dh === 'driver' || dh === 'drivers') { drvIdx = di; break; }
          }
          if (drvIdx >= 0) {
            data = {
              headers: data.headers.slice(0, drvIdx).concat(data.headers.slice(drvIdx + 1)),
              rows: data.rows.map(function (r) {
                return Array.isArray(r) ? r.slice(0, drvIdx).concat(r.slice(drvIdx + 1)) : r;
              })
            };
          }
        }
        // ELMS championship rounds (not Prologue): hide Driver and Time of the day on practice page.
        if (/^ELMS_\d{4}_\d+$/.test(evKeyEvent || '')) {
          data = dropColumnsByHeader(data, ['Driver', 'Drivers', 'Time of the day']);
        }
        // GTWCE Endurance: same table shape as test (no Laps column).
        if (evKeyEvent.indexOf('GTWCE_END_') === 0) {
          data = dropColumnsByHeader(data, ['Laps']);
        }
        if (/^IMSA_\d{4}_\d+$/.test(evKeyEvent)) {
          data = dropColumnsByHeader(data, ['Status']);
        }
        return data;
      }
      /** Supercars practice: team names + canonical car numbers. */
      function practiceDataForSupercars(t) {
        if (!t || !t.headers || !Array.isArray(t.rows)) return t;
        var data = practiceDataWithClass({ headers: t.headers, rows: applyTeamNameByNumber(t.rows, 1, 3) });
        return normalizeSupercarsTableNumberColumn(data, 1);
      }
      // New format: tables.practice.sessions — multiple practice sessions (Practice 1, Practice 2, ...).
      if (prac && Array.isArray(prac.sessions) && prac.sessions.length > 0) {
        prac.sessions.forEach(function (sess, idx) {
          if (!sess || !sess.headers || !Array.isArray(sess.rows)) return;
          var base = isSupercarsPractice
            ? { headers: sess.headers, rows: applyTeamNameByNumber(sess.rows, 1, 3) }
            : { headers: sess.headers, rows: sess.rows };
          var data = isSupercarsPractice ? practiceDataForSupercars(base) : practiceDataWithClass(base);
          var practiceFallback;
          if (idx === 0) practiceFallback = t('table.practice');
          else if (idx === 1) practiceFallback = t('table.practice2');
          else if (idx === 2) practiceFallback = t('table.practice3');
          else practiceFallback = (t('table.practice') || 'Practice') + ' ' + String(idx + 1);
          appendTable(openwheelSessionTableTitle(sess, practiceFallback, seriesId), data);
        });
        if (!html) {
          contentEl.innerHTML = '<p class="empty-msg">' + t('error.no_section_data') + '</p>';
        } else {
          contentEl.innerHTML = html;
          var tablesPractice = contentEl.querySelectorAll('.data-table:not(.table-field-value)');
          [].forEach.call(tablesPractice, function (table, idx) {
            var q = sortQueue[idx];
            if (q && q.rows) makeTableSortable(table, q.rows, esc, q.getRowClass);
          });
        }
        return;
      }
      // Legacy format: separate practice / practice2 / practice3 / final_practice / practice5 tables.
      var prac1Data = prac && prac.headers && Array.isArray(prac.rows)
        ? (isSupercarsPractice ? practiceDataForSupercars(prac) : practiceDataWithClass(prac))
        : practiceDataWithClass(prac);
      appendTable(openwheelSessionTableTitle(prac, t('table.practice'), seriesId), prac1Data);
      var prac2Data = isSupercarsPractice && d.tables && d.tables.practice2 ? practiceDataForSupercars(d.tables.practice2) : practiceDataWithClass(d.tables && d.tables.practice2);
      var prac3Data = isSupercarsPractice && d.tables && d.tables.practice3 ? practiceDataForSupercars(d.tables.practice3) : practiceDataWithClass(d.tables && d.tables.practice3);
      var finalPracData = isSupercarsPractice && d.tables && d.tables.final_practice ? practiceDataForSupercars(d.tables.final_practice) : practiceDataWithClass(d.tables && d.tables.final_practice);
      var prac5Data = isSupercarsPractice && d.tables && d.tables.practice5 ? practiceDataForSupercars(d.tables.practice5) : practiceDataWithClass(d.tables && d.tables.practice5);
      appendTable((d.tables.practice2 && d.tables.practice2.title) ? d.tables.practice2.title : t('table.practice2'), prac2Data);
      appendTable((d.tables.practice3 && d.tables.practice3.title) ? d.tables.practice3.title : t('table.practice3'), prac3Data);
      appendTable((d.tables.final_practice && d.tables.final_practice.title) ? d.tables.final_practice.title : t('table.final_practice'), finalPracData);
      appendTable((d.tables.practice5 && d.tables.practice5.title) ? d.tables.practice5.title : 'Practice 5', prac5Data);
    } else if (section === 'qualifying') {
      appendTable(t('table.duel1'),           d.tables && d.tables.duel1, null, null, false);
      appendTable(t('table.duel2'),           d.tables && d.tables.duel2, null, null, false);
      var q = d.tables && d.tables.qualifying;
      var dnqForQualFilter = d.tables && d.tables.did_not_qualify;
      if (q && dnqForQualFilter && Array.isArray(dnqForQualFilter.rows) && dnqForQualFilter.rows.length > 0) {
        q = qualifyingExcludingDidNotQualify(q, dnqForQualFilter);
      }
      if (evKeyEvent === 'SUPER_GT_2026_1' && q && Array.isArray(q.sessions) && q.sessions.length > 0) {
        var qClassOrder = ['GT500', 'GT300'];
        var qExtraClassSuperGt = 'pre-season-results-table qualifying-results-table';
        qClassOrder.forEach(function (cls) {
          var classSessions = q.sessions.filter(function (sess) {
            return String((sess && sess.class) || '').trim().toUpperCase() === cls;
          });
          if (!classSessions.length) return;
          html += '<h3 class="event-pre-season-title">' + esc(cls) + '</h3>';
          classSessions.forEach(function (sess, idx) {
            if (!sess || !Array.isArray(sess.headers) || !Array.isArray(sess.rows)) return;
            var sessTitle = (sess.title && String(sess.title).trim())
              ? String(sess.title).trim()
              : ('Qualifying ' + String(idx + 1));
            appendTable(sessTitle, { headers: sess.headers, rows: sess.rows }, qExtraClassSuperGt, null, false);
          });
        });
      } else {
      function normalizeImsaQualTable(tableData) {
        return normalizeImsaQualTableForEvent(tableData, evKeyEvent, d.entry_list);
      }
      function renderOneQualSession(sess) {
        var out = '';
        var qualHeading = openwheelSessionDisplayTitle(sess.title, seriesId, t('table.qualifying'));
        if (qualHeading) {
          out += '<h3 class="event-pre-season-title">' + esc(qualHeading) + '</h3>';
        }
        if (sess.subtitle && !shouldHideOpenwheelSessionSubtitle(seriesId, sess.subtitle, d)) {
          out += '<p class="event-pre-season-subtitle">' + esc(sess.subtitle) + '</p>';
        }
        if (shouldShowSessionMetaTable(evKeyEvent, seriesId)) {
          out += buildSessionMetaTable(sess.meta);
        }
        if (sess.headers && Array.isArray(sess.rows)) {
          var qualData = normalizeImsaQualTable({ headers: sess.headers, rows: sess.rows });
          qualData = normalizeSuperFormulaEngineColumns(qualData);
          // GTWCE Endurance & Sprint qualifying: drop Laps column for display (data in JSON may still include it).
          if ((evKeyEvent.indexOf('GTWCE_END_') === 0 || evKeyEvent.indexOf('GTWCE_SPRINT_') === 0) && qualData && Array.isArray(qualData.headers)) {
            var lapsQualIdx = -1;
            for (var lqi = 0; lqi < qualData.headers.length; lqi++) {
              if (String(qualData.headers[lqi] || '').trim().toLowerCase() === 'laps') {
                lapsQualIdx = lqi;
                break;
              }
            }
            if (lapsQualIdx >= 0) {
              qualData = {
                headers: qualData.headers.filter(function (_h, i) { return i !== lapsQualIdx; }),
                rows: qualData.rows.map(function (r) {
                  return Array.isArray(r) ? r.filter(function (_c, i) { return i !== lapsQualIdx; }) : r;
                })
              };
            }
          }
          var qualHeaders = qualData.headers.slice();
          var qualRows = qualData.rows.map(function (r) { return r.slice(); });
          qualRows = applyTeamNameByNumber(qualRows, 1, 3);
          // CLASS POS and POINTS already normalized in normalizeImsaQualTable().
          // For IndyCar, F1, F2/F3/FREC do not insert extra "Results" heading before table,
          // to avoid duplicating session context (Sprint Qualifying / Qualifying, etc.).
          if (shouldShowOpenwheelQualResultsHeading(evKeyEvent, seriesId)) {
            out += '<h4 class="table-section-title">Results</h4>';
          }

          // Split rows into segments by separator
          var segments = [];
          var segRows = [];
          var segTitle = null;
          qualRows.forEach(function (row) {
            var isSep = row.length > 0 && String(row[0] || '').trim() !== '' &&
              row.slice(1).every(function (c) { return c == null || String(c).trim() === ''; });
            if (isSep) {
              segments.push({ title: segTitle, rows: segRows });
              segRows = [];
              segTitle = String(row[0]).trim();
            } else {
              segRows.push(row);
            }
          });
          segments.push({ title: segTitle, rows: segRows });

          if (segments.length === 2) {
            // Merged table: rows 1–10 by Shoot Out position, rows 11–24 by qualifying position
            var seg0 = segments[0];
            var seg1 = segments[1];
            var h = qualHeaders;

            var seg0ByNum = {};
            seg0.rows.forEach(function (r) {
              var num = String(r[1] || '').trim();
              if (num) seg0ByNum[num] = r;
            });
            var seg1ByNum = {};
            seg1.rows.forEach(function (r) {
              var num = String(r[1] || '').trim();
              if (num) seg1ByNum[num] = r;
            });
            var top10Nums = {};
            seg1.rows.forEach(function (r) {
              var num = String(r[1] || '').trim();
              if (num) top10Nums[num] = true;
            });

            var commonIdx = [0, 1, 2, 3];
            var dataIdx   = [4, 5, 6, 7];
            var soDataIdx = [4, 5]; // Shoot Out: only Fastest Lap, Gap (no Lap, Laps)

            var seg0Label = seg0.title || 'Qualifying';
            var seg1Label = seg1.title || 'Shoot Out';

            out += '<div class="table-wrap"><table class="data-table pre-season-results-table qualifying-results-table qual-merged-table">';
            out += '<thead>';
            out += '<tr class="qual-group-header-row">';
            out += '<th colspan="' + commonIdx.length + '"></th>';
            out += '<th colspan="' + dataIdx.length + '" class="col-group-header">' + esc(seg0Label) + '</th>';
            out += '<th colspan="' + (soDataIdx.length + 1) + '" class="col-group-header">' + esc(seg1Label) + '</th>';
            out += '</tr>';
            out += '<tr>';
            commonIdx.forEach(function (i) { out += '<th>' + esc(h[i] || '') + '</th>'; });
            dataIdx.forEach(function (i) { out += '<th>' + esc(h[i] || '') + '</th>'; });
            out += '<th>' + esc(h[0] || 'Pos') + '</th>';
            soDataIdx.forEach(function (i) { out += '<th>' + esc(h[i] || '') + '</th>'; });
            out += '</tr>';
            out += '</thead><tbody>';

            var mergedRows = [];
            var displayOrder = [];
            // Rows 1–10: by Shoot Out position (seg1.rows already ordered 1..10)
            seg1.rows.forEach(function (soRow, i) {
              var num = String(soRow[1] || '').trim();
              var qualRow = seg0ByNum[num] || null;
              if (!qualRow) return;
              var pos = i + 1;
              var rowCells = [pos, qualRow[1], qualRow[2], qualRow[3]];
              dataIdx.forEach(function (j) { rowCells.push(qualRow[j] != null ? qualRow[j] : ''); });
              rowCells.push(soRow[0]);
              soDataIdx.forEach(function (j) { rowCells.push(soRow[j] != null ? soRow[j] : '—'); });
              mergedRows.push(rowCells);
              displayOrder.push({ row: qualRow, so: soRow, cells: rowCells });
            });
            // Rows 11–24: by qualifying position (seg0 rows not in top 10)
            var restQual = seg0.rows.filter(function (row) {
              var num = String(row[1] || '').trim();
              return !top10Nums[num];
            });
            restQual.sort(function (a, b) {
              var pa = parseInt(a[0], 10) || 0;
              var pb = parseInt(b[0], 10) || 0;
              return pa - pb;
            });
            restQual.forEach(function (qualRow) {
              var rowCells = [];
              commonIdx.forEach(function (i) { rowCells.push(qualRow[i] != null ? qualRow[i] : ''); });
              dataIdx.forEach(function (i) { rowCells.push(qualRow[i] != null ? qualRow[i] : ''); });
              rowCells.push('—');
              soDataIdx.forEach(function () { rowCells.push('—'); });
              mergedRows.push(rowCells);
              displayOrder.push({ row: qualRow, so: null, cells: rowCells });
            });

            function driversToLinks(s) {
              if (s == null || String(s).trim() === '') return '—';
              return renderDriverCell(s, '; ');
            }
            function teamToLink(s) {
              if (s == null || String(s).trim() === '') return '—';
              var t = String(s).trim();
              return teamLink(t);
            }
            displayOrder.forEach(function (item) {
              var row = item.row;
              var so = item.so;
              var rowCells = item.cells;
              out += '<tr' + (so ? ' class="qual-row-in-shootout"' : '') + '>';
              out += '<td>' + esc(String(rowCells[0] != null ? rowCells[0] : '')) + '</td>';
              out += '<td>' + esc(String(rowCells[1] != null ? rowCells[1] : '')) + '</td>';
              out += '<td>' + driversToLinks(rowCells[2]) + '</td>';
              out += '<td>' + teamToLink(rowCells[3]) + '</td>';
              dataIdx.forEach(function (_, j) { out += '<td>' + esc(String(rowCells[4 + j] != null ? rowCells[4 + j] : '')) + '</td>'; });
              out += '<td class="' + (so ? 'qual-so-pos' : 'qual-so-empty') + '">' + esc(String(rowCells[8] != null ? rowCells[8] : '—')) + '</td>';
              for (var k = 0; k < soDataIdx.length; k++) {
                var val = rowCells[9 + k];
                out += '<td class="' + (so ? '' : 'qual-so-empty') + '">' + esc(val != null ? String(val) : '—') + '</td>';
              }
              out += '</tr>';
            });

            out += '</tbody></table></div>';
            sortQueue.push({
              rows: mergedRows,
              getRowClass: function (row) {
                var soPos = row[8];
                return (soPos != null && String(soPos).trim() !== '' && String(soPos).trim() !== '—') ? 'qual-row-in-shootout' : '';
              }
          });
        } else {
            var qualTbl = transformTableDataForF2F3({ headers: qualHeaders, rows: qualRows }, evKeyEvent);
            var imsaQualFitClass = /^IMSA_\d{4}_\d+$/.test(evKeyEvent) ? ' imsa-qual-fit' : '';
            var qualResult = buildTableSection(null, qualTbl, 'pre-season-results-table qualifying-results-table' + imsaQualFitClass);
            if (qualResult) {
              var qualHtml = qualResult.html;
              if (/^IMSA_\d{4}_\d+$/.test(evKeyEvent)) {
                qualHtml = qualHtml.replace('<div class="table-wrap">', '<div class="table-wrap table-wrap--no-scroll">');
              }
              out += qualHtml;
              sortQueue.push({ rows: qualResult.rows, getRowClass: qualResult.getRowClass });
            }
          }
        }
        return out;
      }
      if (q && Array.isArray(q.sessions) && q.sessions.length > 0) {
        html += '<div class="event-pre-season-block">';
        q.sessions.forEach(function (sess, idx) {
          if (idx > 0) html += '<hr class="event-pre-season-divider">';
          html += renderOneQualSession(sess);
        });
        html += '</div>';
        if (q.note && typeof q.note === 'string' && q.note.trim()) {
          html += '<p class="race-note">' + esc(q.note.trim()) + '</p>';
        }
      } else if (q && (q.title || q.meta) && q.headers && Array.isArray(q.rows) && q.format !== 'starting_lineup') {
        if (/^ELMS_\d{4}_\d+$/.test(evKeyEvent || '')) {
          function dropQualColumnsByHeader(tableData, names) {
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
          var qElms = normalizeImsaQualTable(q);
          qElms = dropQualColumnsByHeader(qElms, ['Driver', 'Drivers', 'Time of the day']);
          var clsIdxElms = -1;
          for (var qei = 0; qei < qElms.headers.length; qei++) {
            if (String(qElms.headers[qei] || '').trim().toLowerCase() === 'class') { clsIdxElms = qei; break; }
          }
          var elmsOrder = ['LMGT3', 'LMP3', 'LMP2 Pro/Am', 'LMP2'];
          var qExtraElms = 'pre-season-results-table qualifying-results-table';
          if (clsIdxElms >= 0) {
            elmsOrder.forEach(function (cls) {
              var rowsCls = (qElms.rows || []).filter(function (row) { return String(row && row[clsIdxElms] || '').trim() === cls; });
              if (!rowsCls.length) return;
              var classStart = '';
              if (q && q.meta && typeof q.meta === 'object') {
                classStart = q.meta['Start (' + cls + ')'] || '';
                if (!classStart && cls === 'LMP2 Pro/Am') classStart = q.meta['Start (LMP2 Pro-Am)'] || '';
              }
              var metaForClass = classStart ? { 'Start': classStart } : null;
              var tbl = { headers: qElms.headers, rows: rowsCls, meta: metaForClass };
              appendTable(cls, tbl, qExtraElms, null, false);
            });
          } else {
            appendTable((q && q.title && String(q.title).trim()) ? String(q.title).trim() : t('table.qualifying'), { headers: qElms.headers, rows: qElms.rows, meta: q.meta }, qExtraElms, null, false);
          }
        } else {
          html += '<div class="event-pre-season-block">';
          html += renderOneQualSession(q);
          html += '</div>';
        }
      } else if (q && Array.isArray(q.headers) && q.headers.length === 1 && (q.headers[0] || '').toLowerCase().trim() === 'note' && Array.isArray(q.rows) && q.rows.length === 1 && q.rows[0] && q.rows[0].length === 1) {
        html += '<p class="race-note">' + esc(String(q.rows[0][0] || '').trim()) + '</p>';
      } else if (q) {
        // For some series (e.g. NOAPS_2026_3) qualifying table contains
        // separator rows ["Qualified by owner's points", "", ...] and ["Failed to qualify", "", ...].
        // Split into multiple tables: main qualifying, then blocks with those headings.
        var qBase = normalizeImsaQualTable(q);
        if (/^ELMS_\d{4}_\d+$/.test(evKeyEvent || '')) {
          qBase = dropColumnsByHeader(qBase, ['Driver', 'Drivers', 'Time of the day']);
          var elmsClassOrder = ['LMGT3', 'LMP3', 'LMP2 Pro/Am', 'LMP2'];
          var qExtraClassElms = 'pre-season-results-table qualifying-results-table';
          var clsIdx = -1;
          for (var qi = 0; qi < qBase.headers.length; qi++) {
            if (String(qBase.headers[qi] || '').trim().toLowerCase() === 'class') { clsIdx = qi; break; }
          }
          if (clsIdx >= 0) {
            elmsClassOrder.forEach(function (cls) {
              var rowsForClass = (qBase.rows || []).filter(function (row) { return String(row && row[clsIdx] || '').trim() === cls; });
              if (!rowsForClass.length) return;
              appendTable(cls, { headers: qBase.headers, rows: rowsForClass }, qExtraClassElms, null, false);
            });
          } else {
            appendTable(t('table.qualifying'), qBase, qExtraClassElms, null, false);
          }
        } else {
          var rowsQ = Array.isArray(qBase.rows) ? qBase.rows.slice() : [];
          var segmentsQ = [];
          var labelsQ = [];
          var currentSeg = [];
          function isQualSeparatorRow(row) {
            if (!row || row.length === 0) return false;
            var first = String(row[0] || '').trim();
            if (!first) return false;
            var nonEmptyRest = false;
            for (var i = 1; i < row.length; i++) {
              if (row[i] != null && String(row[i]).trim() !== '') { nonEmptyRest = true; break; }
            }
            if (nonEmptyRest) return false;
            var l = first.toLowerCase();
            return l === "qualified by owner's points" || l === 'failed to qualify' || l === 'did not qualify';
          }
          rowsQ.forEach(function (row) {
            if (isQualSeparatorRow(row)) {
              if (currentSeg.length) {
                segmentsQ.push(currentSeg);
                currentSeg = [];
              }
              labelsQ.push(String(row[0] || '').trim());
            } else {
              currentSeg.push(row);
            }
          });
          if (currentSeg.length) segmentsQ.push(currentSeg);

          function qualRowsWithTeamNames(rows) {
            if (!rows || !rows.length) return rows;
            if (!(isStockCar && byNumber)) return rows;
            var hdrs = (qBase && Array.isArray(qBase.headers)) ? qBase.headers : [];
            var h3 = hdrs.length > 3 ? String(hdrs[3] || '').trim().toLowerCase() : '';
            // Substitute team names only if 4th column is actually Team.
            if (h3 !== 'team') return rows;
            return applyTeamNameByNumber(rows, 1, 3);
          }
          var qTitle = (q && q.title && String(q.title).trim()) ? String(q.title).trim() : t('table.qualifying');
          var qExtraClass = (q && q.format === 'starting_lineup')
            ? 'pre-season-results-table qualifying-results-table allstar-starting-lineup-table'
            : ('pre-season-results-table qualifying-results-table' + (/^IMSA_\d{4}_\d+$/.test(evKeyEvent) ? ' imsa-qual-fit' : ''));
          if (segmentsQ.length === 0) {
            appendTable(qTitle, { headers: qBase.headers, rows: qualRowsWithTeamNames(qBase.rows) }, qExtraClass, null, false);
          } else {
            // first table — main qualifying
            appendTable(qTitle, { headers: qBase.headers, rows: qualRowsWithTeamNames(segmentsQ[0]) }, qExtraClass, null, false);
            // others — by headings from separator rows
            for (var si = 1; si < segmentsQ.length; si++) {
              var lbl = localizeQualifyingSeparator(labelsQ[si - 1] || t('table.qualifying'));
              appendTable(lbl, { headers: qBase.headers, rows: qualRowsWithTeamNames(segmentsQ[si]) }, qExtraClass, null, false);
            }
          }
        }
      }
      if (q && q.note && typeof q.note === 'string' && q.note.trim() && !(q.sessions && Array.isArray(q.sessions) && q.sessions.length > 0)) {
        html += '<p class="race-note">' + esc(q.note.trim()) + '</p>';
      }
      var superpoleTbl = d.tables && d.tables.superpole;
      if (superpoleTbl && Array.isArray(superpoleTbl.rows) && superpoleTbl.rows.length > 0) {
        var superpoleTitle = (superpoleTbl.title && String(superpoleTbl.title).trim())
          ? String(superpoleTbl.title).trim()
          : t('table.superpole');
        appendTable(superpoleTitle, superpoleTbl, null, null, false);
      }
      appendTable(t('table.last_chance'),     d.tables && d.tables.last_chance, null, null, false);
      var dnqTable = d.tables && d.tables.did_not_qualify;
      if (dnqTable && Array.isArray(dnqTable.rows) && dnqTable.rows.length > 0) {
        appendTable(t('table.did_not_qualify'), dnqTable, null, null, false);
      }
      }
    }

    if (!html) { contentEl.innerHTML = '<p class="empty-msg">' + t('error.no_section_data') + '</p>'; return; }
    contentEl.innerHTML = html;

    // Special notes under qualifying for specific F1 events.
    if (section === 'qualifying') {
      var qualNoteText = null;
      if (evKeyEvent === 'F1_2025_3') {
        qualNoteText = 'Carlos Sainz Jr. received a three-place grid penalty for impeding Lewis Hamilton in Q2.';
      } else if (evKeyEvent === 'F1_2025_4') {
        qualNoteText = 'George Russell and Kimi Antonelli both received a one-place grid penalty for entering the fast lane in the pit lane before a re-start time was confirmed.';
      }
      if (qualNoteText) {
        var qualNote = document.createElement('p');
        qualNote.className = 'race-note';
        qualNote.textContent = qualNoteText;
        contentEl.appendChild(qualNote);
      }
    }
    // Data tables only (exclude Session info field-value) so order matches sortQueue
    var tables = contentEl.querySelectorAll('.data-table:not(.table-field-value)');
    [].forEach.call(tables, function (table, idx) {
      var q = sortQueue[idx];
      if (q && q.rows) makeTableSortable(table, q.rows, esc, q.getRowClass);
    });
  }

  window.TGA.renderEventPage = renderEventPage;
})();
