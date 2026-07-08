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
  window.TGA.isF4SeriesId = isF4SeriesId;
  window.TGA.isGtwceSpaCheckpointRaceSession = isGtwceSpaCheckpointRaceSession;
  window.TGA.visibleRaceSessionsForDisplay = visibleRaceSessionsForDisplay;
  window.TGA.eventIsMultiRoundWeekend = eventIsMultiRoundWeekend;
})();
