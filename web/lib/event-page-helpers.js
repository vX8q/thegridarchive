// Shared helpers for event.js and extracted event page modules.
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  window.TGA = window.TGA || {};

  function eventSeriesId(eventId) {
    if (!eventId) return '';
    var u = String(eventId).toUpperCase();
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

  /** Separate event_id files that still share one weekend (IndyCar Milwaukee). */
  var MULTI_FILE_WEEKEND_IDS = {
    INDYCAR_2026_16: true,
    INDYCAR_2026_17: true
  };

  /** Double-header weekends (e.g. Super Formula R1–2): no laps/distance table on overview. */
  var SERIES_EVENT_NAME_PREFIX = {
    F1: /^F1\s*[—–-]\s*/i,
    F2: /^F2\s*[—–-]\s*/i,
    F3: /^F3\s*[—–-]\s*/i,
    FREC: /^FREC\s*[—–-]\s*/i,
    F4_IT: /^Italian F4\s*[—–-]\s*/i,
    DTM: /^DTM\s*[—–-]\s*/i,
    GTWCE_SPRINT: /^GT World Challenge Europe Sprint\s*[—–-]\s*/i,
    GTWCE_END: /^GT World Challenge Europe Endurance\s*[—–-]\s*/i
  };

  /** Drop "FREC — …" style prefix when breadcrumb already shows the series. */
  function stripSeriesPrefixFromEventName(name, seriesId) {
    if (name == null) return '';
    var s = String(name).trim();
    if (!s || !seriesId) return s;
    var re = SERIES_EVENT_NAME_PREFIX[String(seriesId).toUpperCase()];
    return re ? s.replace(re, '').trim() : s;
  }

  /** True when event title already names the circuit (skip duplicate in meta line). */
  function eventDisplayNameOverlapsTrack(displayName, track) {
    var n = String(displayName || '').trim().toLowerCase();
    var t = String(track || '').trim().toLowerCase();
    if (!n || !t) return false;
    if (n === t) return true;
    return n.indexOf(t) >= 0 || t.indexOf(n) >= 0;
  }

  function eventIsMultiRoundWeekend(d) {
    if (!d || typeof d !== 'object') return false;
    var eid = String(d.event_id || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
    if (MULTI_FILE_WEEKEND_IDS[eid]) return true;
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

  var INDY_MILWAUKEE_WEEKEND_TITLE = 'Snap-on IndyCar Weekend';

  function isIndyMilwaukeeWeekendEvent(e) {
    if (!e) return false;
    var eidU = String(e.id || '').toUpperCase();
    if (MULTI_FILE_WEEKEND_IDS[eidU]) return true;
    var wkIds = e._weekendEventIds;
    if (!Array.isArray(wkIds)) return false;
    for (var i = 0; i < wkIds.length; i++) {
      if (MULTI_FILE_WEEKEND_IDS[String(wkIds[i] || '').toUpperCase()]) return true;
    }
    return false;
  }

  /** Home cards: canonical Milwaukee double-header title (not track name or single-race title). */
  function indyMilwaukeeWeekendCardTitle() {
    return INDY_MILWAUKEE_WEEKEND_TITLE;
  }

  /**
   * Home cards: race-day range from merge (_weekendEventIds / rangeStart–rangeEnd).
   * No hardcoded Aug 29–30 fallback — a single-race card keeps a single day so bugs stay visible.
   */
  function indyMilwaukeeWeekendDateRange(cardOrEvent) {
    var pickIso = window.TGA && window.TGA.pickIsoDate;
    var iso = pickIso || function (s) {
      var x = String(s || '').trim().slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : '';
    };
    var src = cardOrEvent || {};
    var ev = src.event || src;
    var start = iso(src.rangeStart) || iso(ev.start_date || ev.date);
    var end = iso(src.rangeEnd) || iso(ev.end_date);
    var wkIds = ev._weekendEventIds;
    if (Array.isArray(wkIds) && wkIds.length > 1 && start && end && end > start) {
      return { start: start, end: end };
    }
    if (start && end && end > start) return { start: start, end: end };
    if (start) return { start: start, end: start };
    if (end) return { start: end, end: end };
    return { start: '', end: '' };
  }

  /** Prefer first race id of a merged multi-file weekend for /event/ links. */
  function weekendCardPrimaryEventId(cardOrEvent) {
    var src = cardOrEvent || {};
    var ev = src.event || src;
    var wk = ev && ev._weekendEventIds;
    if (Array.isArray(wk) && wk.length) {
      var first = String(wk[0] || '').trim();
      if (first) return first;
    }
    return String((ev && ev.id) || '').trim();
  }

  window.TGA.eventSeriesId = eventSeriesId;
  window.TGA.stripSeriesPrefixFromEventName = stripSeriesPrefixFromEventName;
  window.TGA.eventDisplayNameOverlapsTrack = eventDisplayNameOverlapsTrack;
  window.TGA.isF4SeriesId = isF4SeriesId;
  window.TGA.isGtwceSpaCheckpointRaceSession = isGtwceSpaCheckpointRaceSession;
  window.TGA.visibleRaceSessionsForDisplay = visibleRaceSessionsForDisplay;
  window.TGA.eventIsMultiRoundWeekend = eventIsMultiRoundWeekend;
  window.TGA.isIndyMilwaukeeWeekendEvent = isIndyMilwaukeeWeekendEvent;
  window.TGA.indyMilwaukeeWeekendCardTitle = indyMilwaukeeWeekendCardTitle;
  window.TGA.indyMilwaukeeWeekendDateRange = indyMilwaukeeWeekendDateRange;
  window.TGA.weekendCardPrimaryEventId = weekendCardPrimaryEventId;
})();
