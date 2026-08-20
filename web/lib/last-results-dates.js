// Last Results card date helpers (range vs single day, 24h, multi-race weekends).
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  window.TGA = window.TGA || {};

  function isIsoYMD(s) {
    return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  }

  function pickIsoDate(s) {
    var x = String(s || '').slice(0, 10);
    return isIsoYMD(x) ? x : '';
  }

  function isoAddDays(iso, delta) {
    var fn = window.TGA && window.TGA.isoAddDays;
    if (fn) return fn(iso, delta);
    if (!isIsoYMD(iso)) return iso;
    var t = new Date(iso + 'T12:00:00').getTime() + delta * 86400000;
    var d = new Date(t);
    return d.getFullYear() + '-' +
      ('0' + (d.getMonth() + 1)).slice(-2) + '-' +
      ('0' + d.getDate()).slice(-2);
  }

  function lastResultsEventSeriesUpper(ev) {
    return String((ev && (ev._seriesId || ev.series_id)) || '').toUpperCase();
  }

  function lastResultsCardIs24HourRace(card) {
    if (!card) return false;
    if (card.gtwceSpa24Hours) return true;
    var e = card.event || {};
    var parseHours = window.TGA && window.TGA.parseNamedRaceDurationHours;
    if (!parseHours) return false;
    var name = String(e.name || e.race || '').trim();
    return parseHours(name) === 24;
  }

  function lastResultsCardHasMultipleRaces(card) {
    if (!card) return false;
    if (card.isF1SprintWeekend) return true;
    var sid = lastResultsEventSeriesUpper(card.event);
    if (sid === 'F2' || sid === 'F3') return true;
    if (sid === 'FREC' || sid === 'F4_IT') return true;
    if (sid === 'GTWCE_SPRINT' || sid === 'DTM') return true;
    // Super Formula: only real double/triple headers (multi sessions or merged winners).
    // Single-race weekends (e.g. SUGO) keep schedule start≠end for practice/qual — not a date range.
    if (sid === 'SUPER_FORMULA') {
      var wSf = card.winners;
      if (Array.isArray(wSf) && wSf.length > 1) return true;
      var evSf = card.event || {};
      var sfIds = evSf._sfEventIds;
      if (Array.isArray(sfIds) && sfIds.length > 1) return true;
      var getSessions = window.TGA && window.TGA.getEventRaceSessions;
      if (getSessions) {
        var sess = getSessions(evSf);
        if (Array.isArray(sess) && sess.length > 1) return true;
      }
      return false;
    }
    // PSC is race_day_only: schedule start≠end is practice/qual weekend, not multi-race.
    // Real double-headers (e.g. Zandvoort) show as multi-race only after weekend merge (winners>1).
    if (sid === 'PSC') {
      var wPsc = card.winners;
      return Array.isArray(wPsc) && wPsc.length > 1;
    }
    // IndyCar: single race day on cards; only Milwaukee-style merges (2+ winners) span dates.
    // Do not treat schedule practice weekend (start_date < end_date) as multi-race.
    if (sid === 'INDYCAR') {
      var wIndy = card.winners;
      return Array.isArray(wIndy) && wIndy.length > 1;
    }
    if (sid === 'SUPERCARS') {
      var w = card.winners;
      if (Array.isArray(w) && w.length > 1) return true;
      var rs = pickIsoDate(card.rangeStart);
      var re = pickIsoDate(card.rangeEnd);
      return !!(rs && re && re > rs);
    }
    return false;
  }

  function eventForWeekendDateRange(ev) {
    if (!ev) return ev;
    var out = Object.assign({}, ev);
    delete out._scheduleSessionKind;
    delete out._scheduleSessionLabel;
    delete out._sessionLabel;
    return out;
  }

  /** First/last calendar day shown on card (24h races span two days). */
  function lastResultsCardRaceDateRange(card) {
    var e = (card && card.event) || {};
    var evRange = eventForWeekendDateRange(e);
    var rs = pickIsoDate(card && card.rangeStart);
    var re = pickIsoDate(card && card.rangeEnd);
    if (lastResultsCardIs24HourRace(card)) {
      var getIso = window.TGA && window.TGA.getEventRaceStartDateIso;
      var raceStart = pickIsoDate(getIso ? getIso(e) : '') || rs || re;
      if (raceStart) {
        return { start: raceStart, end: isoAddDays(raceStart, 1) };
      }
    }
    if (lastResultsCardHasMultipleRaces(card)) {
      var getRangeMr = window.TGA && window.TGA.getEventRaceDateRangeIso;
      if (getRangeMr) {
        var schedMr = getRangeMr(evRange);
        var ss = pickIsoDate(schedMr.start);
        var se = pickIsoDate(schedMr.end);
        if (ss && se && se > ss && (!rs || !re || rs === re)) {
          rs = ss;
          re = se;
        }
      }
    } else {
      // race_day_only (PSC/IMSA/WEC/…): prefer resolved race day over seeded weekend span.
      var getRangeRd = window.TGA && window.TGA.getEventRaceDateRangeIso;
      if (getRangeRd) {
        var rd = getRangeRd(evRange);
        var rds = pickIsoDate(rd.start);
        var rde = pickIsoDate(rd.end);
        if (rds && rde && rds === rde) {
          return { start: rds, end: rde };
        }
      }
    }
    if (rs && re) return { start: rs, end: re };
    if (rs) return { start: rs, end: rs };
    if (re) return { start: re, end: re };
    return { start: '', end: '' };
  }

  /** Last calendar day of racing for an event (multi-race weekends use the final session). */
  function eventLastRaceDateIso(ev, hints) {
    hints = hints || {};
    if (!ev) return pickIsoDate(hints.dateStr);
    var getRange = window.TGA && window.TGA.getEventRaceDateRangeIso;
    if (getRange) {
      var range = getRange(ev);
      if (range.end) return pickIsoDate(range.end);
    }
    var end = pickIsoDate(ev.end_date);
    var start = pickIsoDate(ev.start_date || ev.date);
    if (end && start && end > start) return end;
    var wk = pickIsoDate(hints.weekendEnd);
    if (wk) return wk;
    if (end) return end;
    return start || pickIsoDate(hints.dateStr);
  }

  function cardLastRaceDateIso(card) {
    if (!card) return '';
    var range = lastResultsCardRaceDateRange(card);
    if (range.end) return pickIsoDate(range.end);
    var e = card.event || {};
    return eventLastRaceDateIso(e, card);
  }

  function cardFirstRaceDateIso(card) {
    if (!card) return '';
    var range = lastResultsCardRaceDateRange(card);
    var rs = pickIsoDate(range.start);
    var re = pickIsoDate(range.end);
    if (lastResultsCardHasMultipleRaces(card) || lastResultsCardIs24HourRace(card)) {
      if (rs && re && rs !== re) return rs;
      if (rs) return rs;
    }
    var e = card.event || {};
    var getIso = window.TGA && window.TGA.getEventRaceStartDateIso;
    return pickIsoDate(getIso ? getIso(e) : '') || rs || re || cardLastRaceDateIso(card);
  }

  function cardFirstRaceSortKey(card) {
    var e = (card && card.event) || {};
    var getFirst = window.TGA && window.TGA.getEventFirstRaceStartUtcMs;
    if (getFirst) {
      var ms = getFirst(e);
      if (ms) return ms;
    }
    var iso = cardFirstRaceDateIso(card);
    return iso ? new Date(iso + 'T12:00:00').getTime() : 0;
  }

  function formatLastResultsCardDate(card) {
    if (!card) return '—';
    var e = card.event || {};
    var formatShortDate = window.TGA && window.TGA.formatShortDate;
    var formatDateRange = window.TGA && window.TGA.formatDateRange;
    if (!formatShortDate || !formatDateRange) return '—';
    var formatEventRaceStartDate = window.TGA && window.TGA.formatEventRaceStartDate;
    if (lastResultsCardHasMultipleRaces(card) || lastResultsCardIs24HourRace(card)) {
      var evRange = eventForWeekendDateRange(e);
      var getRange = window.TGA && window.TGA.getEventRaceDateRangeIso;
      if (getRange) {
        var schedRange = getRange(evRange);
        var spanStart = pickIsoDate(schedRange.start);
        var spanEnd = pickIsoDate(schedRange.end);
        if (spanStart && spanEnd && spanEnd > spanStart) {
          return formatDateRange(spanStart, spanEnd);
        }
      }
      var range = lastResultsCardRaceDateRange(card);
      var rs = range.start;
      var re = range.end;
      if (!rs || !re || rs === re) {
        if (getRange) {
          var schedRange2 = getRange(evRange);
          rs = rs || pickIsoDate(schedRange2.start);
          re = re || pickIsoDate(schedRange2.end);
        }
      }
      if (rs) return formatDateRange(rs, re || rs);
    }
    if (formatEventRaceStartDate) {
      var primary = formatEventRaceStartDate(e);
      if (primary && primary !== '—') return primary;
    }
    var getRangeFallback = window.TGA && window.TGA.getEventRaceDateRangeIso;
    if (getRangeFallback) {
      var schedRangeFb = getRangeFallback(e);
      var spanStartFb = pickIsoDate(schedRangeFb.start);
      var spanEndFb = pickIsoDate(schedRangeFb.end);
      if (spanStartFb && spanEndFb && spanEndFb > spanStartFb) {
        return formatDateRange(spanStartFb, spanEndFb);
      }
    }
    var rangeFb = lastResultsCardRaceDateRange(card);
    var rsFb = rangeFb.start;
    var reFb = rangeFb.end;
    var getIso = window.TGA && window.TGA.getEventRaceStartDateIso;
    var raceIso = (getIso ? getIso(e) : '') ||
      reFb || rsFb ||
      pickIsoDate(e.end_date) ||
      pickIsoDate(e.start_date) ||
      pickIsoDate(card.dateStr);
    return formatShortDate(raceIso) || raceIso || '—';
  }

  /** Last Results card: show only while within 7 days after last race finish. */
  function isWithinLastResultsWindowForItem(item) {
    var ev = (item && item.event) || item || {};
    var lastIso = cardLastRaceDateIso(item);
    if (lastIso) {
      ev = Object.assign({}, ev, {
        end_date: lastIso,
        start_date: pickIsoDate(item && item.rangeStart) || ev.start_date || ev.date
      });
    }
    if (window.TGA && typeof window.TGA.isWithinLastResultsWindow === 'function') {
      return window.TGA.isWithinLastResultsWindow(ev);
    }
    var endStr = lastIso || eventLastRaceDateIso(ev, item);
    if (!isIsoYMD(endStr)) return false;
    var parts = endStr.split('-');
    var y = parseInt(parts[0], 10);
    var mo = parseInt(parts[1], 10) - 1;
    var da = parseInt(parts[2], 10);
    var limit = new Date(y, mo, da + 7, 23, 59, 59, 999);
    return Date.now() <= limit.getTime();
  }

  /** Multi-race weekends (Supercars, PSC, IndyCar, Super Formula): map each race id to last day of its block. */
  function buildGroupedWeekendLastRaceByEventId(items) {
    var map = {};
    if (!Array.isArray(items) || items.length === 0) return map;
    var events = items.map(function (p) { return p && p.event ? p.event : p; }).filter(Boolean);
    var lastById = (window.TGA && typeof window.TGA.buildGroupedWeekendLastEventById === 'function')
      ? window.TGA.buildGroupedWeekendLastEventById(events)
      : {};
    Object.keys(lastById).forEach(function (id) {
      var lastEv = lastById[id];
      if (!lastEv) return;
      map[id] = eventLastRaceDateIso(lastEv, {}) ||
        pickIsoDate(lastEv.end_date) ||
        pickIsoDate(lastEv.start_date || lastEv.date);
    });
    return map;
  }

  window.TGA.isIsoYMD = isIsoYMD;
  window.TGA.pickIsoDate = pickIsoDate;
  window.TGA.lastResultsEventSeriesUpper = lastResultsEventSeriesUpper;
  window.TGA.lastResultsCardIs24HourRace = lastResultsCardIs24HourRace;
  window.TGA.lastResultsCardHasMultipleRaces = lastResultsCardHasMultipleRaces;
  window.TGA.lastResultsCardRaceDateRange = lastResultsCardRaceDateRange;
  window.TGA.eventLastRaceDateIso = eventLastRaceDateIso;
  window.TGA.cardLastRaceDateIso = cardLastRaceDateIso;
  window.TGA.cardFirstRaceDateIso = cardFirstRaceDateIso;
  window.TGA.cardFirstRaceSortKey = cardFirstRaceSortKey;
  window.TGA.formatLastResultsCardDate = formatLastResultsCardDate;
  window.TGA.isWithinLastResultsWindowForItem = isWithinLastResultsWindowForItem;
  window.TGA.buildGroupedWeekendLastRaceByEventId = buildGroupedWeekendLastRaceByEventId;
})();
