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
    if (sid === 'PSC' || sid === 'SUPER_FORMULA') return true;
    if (sid === 'SUPERCARS') {
      var w = card.winners;
      return Array.isArray(w) && w.length > 1;
    }
    return false;
  }

  /** First/last calendar day shown on card (24h races span two days). */
  function lastResultsCardRaceDateRange(card) {
    var e = (card && card.event) || {};
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
        var schedMr = getRangeMr(e);
        var ss = pickIsoDate(schedMr.start);
        var se = pickIsoDate(schedMr.end);
        if (ss && se && se > ss && (!rs || !re || rs === re)) {
          rs = ss;
          re = se;
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
    if (formatEventRaceStartDate) {
      var primary = formatEventRaceStartDate(e);
      if (primary && primary !== '—') return primary;
    }
    var getRange = window.TGA && window.TGA.getEventRaceDateRangeIso;
    if (getRange) {
      var schedRange = getRange(e);
      var spanStart = pickIsoDate(schedRange.start);
      var spanEnd = pickIsoDate(schedRange.end);
      if (spanStart && spanEnd && spanEnd > spanStart) {
        return formatDateRange(spanStart, spanEnd);
      }
    }
    var range = lastResultsCardRaceDateRange(card);
    var rs = range.start;
    var re = range.end;
    if (lastResultsCardHasMultipleRaces(card) || lastResultsCardIs24HourRace(card)) {
      if (!rs || !re || rs === re) {
        if (getRange) {
          var schedRange2 = getRange(e);
          rs = rs || pickIsoDate(schedRange2.start);
          re = re || pickIsoDate(schedRange2.end);
        }
      }
      if (rs) return formatDateRange(rs, re || rs);
    }
    var getIso = window.TGA && window.TGA.getEventRaceStartDateIso;
    var raceIso = (getIso ? getIso(e) : '') ||
      re || rs ||
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

  /** Multi-race weekends (Supercars, Super Formula): map each race id → last day of its block. */
  function buildGroupedWeekendLastRaceByEventId(items) {
    var map = {};
    if (!Array.isArray(items) || items.length === 0) return map;
    var grouped = [];
    items.forEach(function (p) {
      var sid = lastResultsEventSeriesUpper(p.event);
      if (sid === 'SUPERCARS' || sid === 'SUPER_FORMULA') grouped.push(p);
    });
    grouped.sort(function (a, b) {
      var da = eventLastRaceDateIso(a.event, a);
      var db = eventLastRaceDateIso(b.event, b);
      return da < db ? -1 : da > db ? 1 : 0;
    });
    for (var i = 0; i < grouped.length; i++) {
      var c = grouped[i];
      var e = c.event || {};
      var run = [c];
      var c0 = String(e.circuit_name || '').trim();
      var l0 = String(e.location || '').trim();
      var prev = eventLastRaceDateIso(e, c);
      var j = i + 1;
      while (j < grouped.length) {
        var c2 = grouped[j];
        var e2 = c2.event || {};
        if (String(e2.circuit_name || '').trim() !== c0 || String(e2.location || '').trim() !== l0) break;
        var d2 = eventLastRaceDateIso(e2, c2);
        var diffMs = new Date(d2 + 'T12:00:00').getTime() - new Date(prev + 'T12:00:00').getTime();
        if (diffMs > 86400000) break;
        run.push(c2);
        if (!prev || d2 > prev) prev = d2;
        j++;
      }
      var lastIso = prev || eventLastRaceDateIso(e, c);
      run.forEach(function (x) {
        var id = String((x.event && x.event.id) || '').toUpperCase();
        if (id) map[id] = lastIso;
      });
      i = j - 1;
    }
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
