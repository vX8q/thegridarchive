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
  var localizeDriverNamesInText = P.localizeDriverNamesInText;
  var isGuestEntryRow = P.isGuestEntryRow;
  var guestCarNumberSet = P.guestCarNumberSet;
  var entryListDriverCell = P.entryListDriverCell;
  var entryListDriverLabel = P.entryListDriverLabel;
  var localizeTableHeader = P.localizeTableHeader;
  var localizeDate = P.localizeDate;
  var localizeDistance = P.localizeDistance;
  var localizeEventPreview = P.localizeEventPreview;
  var localizeTyreCompounds = P.localizeTyreCompounds;
  var localizeSectionTitle = P.localizeSectionTitle;
  var localizeCircuitName = P.localizeCircuitName;
  var localizeLocation = P.localizeLocation;
  var localizeEventFromData = P.localizeEventFromData;
  var localizeRacingClass = P.localizeRacingClass;
  var teamLabel = P.teamLabel;
  var localizeQualifyingSeparator = P.localizeQualifyingSeparator;
  var documentTitle = P.documentTitle;
  var trimTrailingZeros = P.trimTrailingZeros;
  var countryHtml = P.countryHtml;
  var categoryBySeriesId = P.categoryBySeriesId;
  var buildEventMetaDate = P.buildEventMetaDate || (window.TGA && window.TGA.buildEventMetaDate);
  var addObjectTableSort = P.addObjectTableSort;
  var adjustEventPanelPadding = P.adjustEventPanelPadding;
  var adjustDetailPanelPadding = P.adjustDetailPanelPadding;
  var translateStaticUI = P.translateStaticUI;
  var logger = P.logger;
  var state = P.state;
  var API = P.API;
  var G = window.TGA;


  function makeTableSortable() { return P.makeTableSortable.apply(null, arguments); }
  function showView(activeId) { P.showView(activeId); }

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
        var sid = d.event_id && (G.eventSeriesId(d.event_id) || '').toLowerCase();
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
          (d.event_id && (G.eventSeriesId(d.event_id) || '').toLowerCase() === 'supercars');
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
          (d.event_id && (G.eventSeriesId(d.event_id) || '').toLowerCase() === 'supercars');
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
        var series = (d.event_id && G.eventSeriesId(d.event_id)) ? (G.eventSeriesId(d.event_id) || '').toLowerCase() : '';
        var isStockCar = G.isStockCarSeriesId(series);
        if (series === 'supercars') return true;
        if (d.tables && (d.tables.starting_lineup || G.tgaStageTable(d.tables, 1) || G.tgaStageTable(d.tables, 2) || G.tgaStageTable(d.tables, 3) || G.tgaStageTable(d.tables, 4) || d.tables.race_results || d.tables.caution_breakdown || d.tables.race)) return true;
        if (d.race_statistics && Object.keys(d.race_statistics).length > 0) return true;
        if (isStockCar && d.tables && (d.tables.practice || d.tables.qualifying)) return true;
        return false;
      },
      meta: function (d) {
        var s = [];
        var seriesMeta = (d.event_id && G.eventSeriesId(d.event_id)) ? (G.eventSeriesId(d.event_id) || '').toLowerCase() : '';
        var isStockCarMeta = G.isStockCarSeriesId(seriesMeta);
        var raceResultsFirstMeta = isStockCarMeta && d.tables && d.tables.race_results && (
          (Array.isArray(d.tables.race_results.rows) && d.tables.race_results.rows.length > 0) ||
          (d.tables.race_results.format === 'allstar_stages' && Array.isArray(d.tables.race_results.stages) && d.tables.race_results.stages.length > 0)
        );
        var seriesMetaLc = (d.event_id && G.eventSeriesId(d.event_id)) ? (G.eventSeriesId(d.event_id) || '').toLowerCase() : '';
        if (d.tables && d.tables.starting_lineup && seriesMetaLc !== 'f4_it') s.push(t('meta.starting_grid'));
        if (raceResultsFirstMeta && d.tables.race_results) s.push(t('meta.race_results'));
        if (G.seriesUsesStages(seriesMeta)) {
          if (d.tables && G.tgaStageTable(d.tables, 1)) s.push(t('meta.stage1'));
          if (d.tables && G.tgaStageTable(d.tables, 2)) s.push(t('meta.stage2'));
          if (d.tables && G.tgaStageTable(d.tables, 3)) s.push(t('meta.stage3'));
          if (d.tables && G.tgaStageTable(d.tables, 4)) s.push(t('meta.stage4'));
        }
        if (!raceResultsFirstMeta && d.tables && d.tables.race_results) s.push(t('meta.race_results'));
        return s.join(' · ');
      }
    }
  ];


  // Try to fill event header from schedule data (when full event JSON is missing).
  // Works in two steps:
  // 1) Try to find event in already loaded global cache (Next Events / Schedule).
  // 2) If missing — lazily fetch series events from /api/series/{series}/events and search there.
  function applyScheduleHeaderFallback(apiEventId, titleEl, metaEl) {
    try {
      if (!apiEventId) return;
      var upperId = String(apiEventId).toUpperCase();
      var seriesIdFromEvent = typeof G.eventSeriesId === 'function' ? G.eventSeriesId(upperId) : (upperId.split('_')[0] || '');

      function fillFromEventLike(match) {
        if (!match) return;
        var rawFallbackName = (match.name && String(match.name).trim()) || match.race || match.id || apiEventId || '';
        if (seriesIdFromEvent) {
          rawFallbackName = G.stripSeriesPrefixFromEventName(rawFallbackName, seriesIdFromEvent) || rawFallbackName;
        }
        var name = localizeEventFromData(Object.assign({}, match, { name: rawFallbackName })) || rawFallbackName || '';
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
        if (circuit && !G.eventDisplayNameOverlapsTrack(name, circuit)) {
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
      var sid0 = G.eventSeriesId(apiEventId);
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
      if (d.canonical_event_id && (G.eventSeriesId(d.canonical_event_id) || '').toLowerCase() === 'supercars') {
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
      var seriesIdForName = G.eventSeriesId(d.event_id || apiEventId);
      // Strip series prefix when breadcrumb already shows the series (F1, FREC, DTM, …).
      if (seriesIdForName) {
        rawName = G.stripSeriesPrefixFromEventName(rawName, seriesIdForName) || rawName;
      }
      var eventName = localizeEventFromData(Object.assign({}, d, { name: rawName }));
      var seriesId    = G.eventSeriesId(d.event_id || apiEventId);
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
      if (d.track && !G.eventDisplayNameOverlapsTrack(eventName, d.track)) {
        datePart += (datePart ? ' · ' : '') + localizeCircuitName(d.track);
      }
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
      if (window.TGA && typeof window.TGA.normalizeF1EventTo2026Format === 'function') {
        d = window.TGA.normalizeF1EventTo2026Format(d);
      }
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
    var seriesLc = (G.eventSeriesId(eventId) || '').toLowerCase();
    var isFujiSuperGt2026 = evKeyOverview === 'SUPER_GT_2026_2';
    var isMultiRoundWeekend = G.eventIsMultiRoundWeekend(d);
    if (!isMultiRoundWeekend && seriesLc !== 'supercars' && seriesLc !== 'imsa' && seriesLc !== 'wec' && seriesLc !== 'f2' && seriesLc !== 'f3' && seriesLc !== 'dtm' && seriesLc !== 'frec' && seriesLc !== 'psc' && !isFujiSuperGt2026 && !G.isF4SeriesId(seriesLc)) {
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
        var seriesForBlocks = (G.eventSeriesId(eventId) || '').toLowerCase();
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
      try {
      var hasSingleRaceSession = false;
      if (tablesOverview && tablesOverview.race && Array.isArray(tablesOverview.race.sessions)) {
        var overviewSid = G.eventSeriesId(d.event_id || '').toLowerCase();
        if (typeof G.visibleRaceSessionsForDisplay === 'function') {
          hasSingleRaceSession = G.visibleRaceSessionsForDisplay(tablesOverview.race, overviewSid).length === 1;
        } else {
          hasSingleRaceSession = tablesOverview.race.sessions.length === 1;
        }
      } else if (tablesOverview && tablesOverview.race_results &&
                 !G.tgaStageTable(tablesOverview, 1) && !G.tgaStageTable(tablesOverview, 2) && !G.tgaStageTable(tablesOverview, 3)) {
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
          var safeUrl = G.safeHref(url);
          if (!safeUrl) return;
          var extLabel = item.title || t('section.highlights') || 'Highlights';
          var thumbAttr = '';
          if (item.thumb) {
            var thumbUrl = G.safeHref(item.thumb);
            if (thumbUrl) {
              thumbAttr = '<img class="video-external-thumb" src="' + thumbUrl + '" alt="' + esc(extLabel) + '" loading="lazy" decoding="async">';
            }
          }
          html += '<div class="video-facade-wrap">' +
            '<a class="video-external-link" href="' + safeUrl + '" target="_blank" rel="noopener noreferrer">' +
              thumbAttr +
              '<span class="video-external-label">' + esc(extLabel) + '</span>' +
            '</a>' +
          '</div>';
        }
      });
      html += '</div>';
      } catch (highlightErr) {
        logger.error('renderEventOverviewContent highlights', highlightErr);
      }
    }

    // Fallback: if highlights list is empty for some reason,
    // but event has highlights_url, show simple external link.
    if ((!highlightsList || highlightsList.length === 0) &&
        d.highlights_url && typeof d.highlights_url === 'string' &&
        d.highlights_url.trim().length > 0) {
      var hlUrl = G.safeHref(d.highlights_url.trim());
      if (hlUrl) {
        html += '<p class="event-preview-text"><a class="video-external-inline-link" href="' +
          hlUrl + '" target="_blank" rel="noopener noreferrer">' +
          esc(t('section.highlights') || 'Highlights') + '</a></p>';
      }
    }

    // Race statistics — same table (FIELD / VALUE, colon parsing) for all series
    var stats = G.getEventRaceStats(d);
    if (stats && Object.keys(stats).length > 0) {
      html += G.renderRaceStatsTable(stats);
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

  function renderEventSectionContent(d, section, contentEl, eventIdFromRoute) {
    if (contentEl) contentEl.setAttribute('data-event-section', section || '');
    var seriesId  = G.eventSeriesId(d.event_id || eventIdFromRoute || '');
    var isStockCar = G.isStockCarSeriesId(seriesId);
    var html = '';
    var sortQueue = [];
    var byNumber = (isStockCar && d.entry_list && d.entry_list.length)
      ? G.buildTeamNamesByNumberFromEntryList(d.entry_list)
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
      tableData = G.transformTableDataForF2F3(tableData, evKeyEvent);
      tableData = normalizeSuperFormulaEngineColumns(tableData);
      tableData = dropTimeOfDayColumn(tableData);
      if (G.isSupercarsSeriesId(seriesId) && G.isSupercarsSydneyEvent(evKeyEvent)) {
        tableData = G.supercarsSydneyCarDisplay(tableData);
      }
      var subtitle = (tableData && tableData.meta) ? buildStartSubtitle(tableData.meta) : '';
      var result = G.buildTableSection(title, tableData, extraClass, getRowClass, null, subtitle, null, mergeTeamCells);
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
      G.renderRaceContent(d, contentEl);
      return;
    }

    if (section === 'bop') {
      contentEl.innerHTML = G.renderBopContent(esc, d);
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
          out += G.buildSessionMetaTable(sess.meta);
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
            var pstData = G.applyClassFromEntryList({ headers: headersForTable, rows: rows }, d.entry_list);
            pstData = G.recomputeClassPos(pstData);
            headersForTable = pstData.headers;
            rows = pstData.rows;
          }
          var tbl = { headers: headersForTable, rows: rows };
          var pstTableClass = 'pre-season-results-table pre-season-results-table--session';
          if (evKeyPst === 'F1_2026_PRE_SEASON_TEST_1' || evKeyPst === 'F1_2026_PRE_SEASON_TEST_2') pstTableClass += ' pre-season-results-table--fit';
          if ((seriesId || '').toLowerCase() === 'imsa') pstTableClass += ' race-session-results-table';
          var result = G.buildTableSection(null, tbl, pstTableClass);
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
      G.renderEntryListSection(d, contentEl, {
        esc: esc, t: t, seriesId: seriesId, isStockCar: isStockCar, evKeyEvent: evKeyEvent,
        eventIdFromRoute: eventIdFromRoute,
        entryListDriverCell: entryListDriverCell, entryListDriverLabel: entryListDriverLabel,
        isGuestEntryRow: isGuestEntryRow, guestCarNumberSet: guestCarNumberSet,
        teamLabel: teamLabel, countryHtml: countryHtml, localizeRacingClass: localizeRacingClass,
        addObjectTableSort: addObjectTableSort
      });
      return;
    }

    if (section === 'test') {
      var testTbl = d.tables && d.tables.test;
      function testSessionTableData(sess) {
        return G.gtwceEndTimedSessionTableData({ headers: sess.headers, rows: sess.rows }, evKeyEvent);
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
      var isSupercarsPractice = G.isSupercarsSeriesId(seriesId);
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
        return G.dropStartPosColumn(G.splitTeamCarDropSponsor(t));
      }
      function practiceDataWithClass(t) {
        var data = ensureClassColumn(practiceTableData(t));
        data = ((seriesId || '').toLowerCase() === 'imsa' && d.entry_list && d.entry_list.length)
          ? G.applyClassFromEntryList(data, d.entry_list)
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
          data = G.dropColumnsByHeader(data, ['Driver', 'Drivers', 'Time of the day']);
        }
        // GTWCE Endurance: same table shape as test (no Laps column).
        if (evKeyEvent.indexOf('GTWCE_END_') === 0) {
          data = G.dropColumnsByHeader(data, ['Laps']);
        }
        if (/^IMSA_\d{4}_\d+$/.test(evKeyEvent)) {
          data = G.dropColumnsByHeader(data, ['Status']);
        }
        return data;
      }
      /** Supercars practice: team names + canonical car numbers. */
      function practiceDataForSupercars(t) {
        if (!t || !t.headers || !Array.isArray(t.rows)) return t;
        var data = practiceDataWithClass({ headers: t.headers, rows: applyTeamNameByNumber(t.rows, 1, 3) });
        return G.normalizeSupercarsTableNumberColumn(data, 1);
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
          appendTable(G.openwheelSessionTableTitle(sess, practiceFallback, seriesId), data);
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
      appendTable(G.openwheelSessionTableTitle(prac, t('table.practice'), seriesId), prac1Data);
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
        q = G.qualifyingExcludingDidNotQualify(q, dnqForQualFilter);
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
        return G.normalizeImsaQualTable(tableData, evKeyEvent, d.entry_list);
      }
      function renderOneQualSession(sess) {
        var out = '';
        var qualHeading = G.openwheelSessionDisplayTitle(sess.title, seriesId, t('table.qualifying'));
        if (qualHeading) {
          out += '<h3 class="event-pre-season-title">' + esc(qualHeading) + '</h3>';
        }
        if (sess.subtitle && !G.shouldHideOpenwheelSessionSubtitle(seriesId, sess.subtitle, d)) {
          out += '<p class="event-pre-season-subtitle">' + esc(sess.subtitle) + '</p>';
        }
        if (G.shouldShowSessionMetaTable(evKeyEvent, seriesId)) {
          out += G.buildSessionMetaTable(sess.meta);
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
          if (G.shouldShowOpenwheelQualResultsHeading(evKeyEvent, seriesId)) {
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
              return G.renderDriverCell(s, '; ');
            }
            function teamToLink(s) {
              if (s == null || String(s).trim() === '') return '—';
              var t = String(s).trim();
              return G.teamLink(t);
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
            var qualTbl = G.transformTableDataForF2F3({ headers: qualHeaders, rows: qualRows }, evKeyEvent);
            var imsaQualFitClass = /^IMSA_\d{4}_\d+$/.test(evKeyEvent) ? ' imsa-qual-fit' : '';
            var qualResult = G.buildTableSection(null, qualTbl, 'pre-season-results-table qualifying-results-table' + imsaQualFitClass);
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
          qBase = G.dropColumnsByHeader(qBase, ['Driver', 'Drivers', 'Time of the day']);
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

    // Optional note under qualifying (e.g. grid penalties).
    if (section === 'qualifying') {
      var qualNoteFromData = d.tables && d.tables.qualifying && d.tables.qualifying.note;
      if (qualNoteFromData) {
        var qualNote = document.createElement('p');
        qualNote.className = 'race-note';
        qualNote.textContent = String(qualNoteFromData).trim();
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
