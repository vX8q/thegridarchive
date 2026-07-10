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

  /** Double-header weekends (e.g. Super Formula R1–2): no laps/distance table on overview. */
  var SERIES_EVENT_NAME_PREFIX = {
    F1: /^F1\s*[—-]\s*/i,
    F2: /^F2\s*[—-]\s*/i,
    F3: /^F3\s*[—-]\s*/i,
    FREC: /^FREC\s*[—-]\s*/i,
    F4_IT: /^Italian F4\s*[—-]\s*/i,
    DTM: /^DTM\s*[—-]\s*/i
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

  window.TGA.eventSeriesId = eventSeriesId;
  window.TGA.stripSeriesPrefixFromEventName = stripSeriesPrefixFromEventName;
  window.TGA.eventDisplayNameOverlapsTrack = eventDisplayNameOverlapsTrack;
  window.TGA.isF4SeriesId = isF4SeriesId;
  window.TGA.isGtwceSpaCheckpointRaceSession = isGtwceSpaCheckpointRaceSession;
  window.TGA.visibleRaceSessionsForDisplay = visibleRaceSessionsForDisplay;
  window.TGA.eventIsMultiRoundWeekend = eventIsMultiRoundWeekend;
})();
