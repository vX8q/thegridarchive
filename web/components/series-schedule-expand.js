// Expand weekend events into per-race rows for series schedule tables (Supercars-style).
(function () {
  if (typeof window === 'undefined') return;
  window.TGA = window.TGA || {};

  function seriesKeyNorm(seriesId) {
    var k = String(seriesId || '').toLowerCase().replace(/-/g, '_');
    if (/^f1_\d{4}$/.test(k)) return 'f1';
    return k;
  }

  function trLabel(key, fallback) {
    var t = window.TGA && window.TGA.t;
    if (!t) return fallback;
    var v = t(key);
    return (v && v !== key) ? v : fallback;
  }

  function raceSessionDisplayLabel(kind, fallbackLabel) {
    if (window.TGA && window.TGA.raceSessionDisplayLabel) {
      return window.TGA.raceSessionDisplayLabel(kind, fallbackLabel);
    }
    if (kind === 'sprint') return trLabel('standings.sprint', 'Sprint');
    if (kind === 'feature') return trLabel('standings.feature_race', 'Feature Race');
    if (kind === 'test') return trLabel('schedule.test', 'Test');
    return fallbackLabel || '';
  }

  function buildSessionsForEvent(sid, e) {
    if (window.TGA && window.TGA.buildSessionsForEvent) {
      return window.TGA.buildSessionsForEvent(sid, e);
    }
    return [];
  }

  function localizedScheduleBaseName(e) {
    var base = normalizeEventBaseName(e && e.name);
    var loc = window.TGA && window.TGA.localizeEventFromData;
    if (loc) return loc(Object.assign({}, e, { name: base }));
    var locName = window.TGA && window.TGA.localizeEventName;
    if (locName) return locName(base);
    return base;
  }

  function normalizeEventBaseName(name) {
    return String(name || '')
      .replace(/\s*\((Sprint|Feature(?:\s+Race)?|Race\s+\d+)\)\s*/gi, ' ')
      .replace(/\s*\([^)]*rescheduled[^)]*\)\s*/gi, ' ')
      .replace(/\s+Race\s+\d+$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isMultiRaceSeriesSchedule(seriesId) {
    if (window.TGA && window.TGA.isMultiRaceSeriesSchedule) {
      return window.TGA.isMultiRaceSeriesSchedule(seriesId);
    }
    return false;
  }

  function expandSeriesScheduleEvents(seriesId, events) {
    if (!Array.isArray(events) || events.length === 0) return events;
    var sid = seriesKeyNorm(seriesId);
    if (!isMultiRaceSeriesSchedule(seriesId)) return events;
    var out = [];
    events.forEach(function (e) {
      if (!e) return;
      if (String(e.id || '').indexOf('PRE_SEASON') >= 0 || /_\d{4}_PROLOGUE$/i.test(String(e.id || ''))) {
        out.push(e);
        return;
      }
      var sessions = buildSessionsForEvent(sid, e);
      if (!sessions || sessions.length <= 1) {
        out.push(e);
        return;
      }
      var baseName = localizedScheduleBaseName(e);
      var groupId = String(e.id || baseName);
      sessions.forEach(function (s, idx) {
        var sessionDate = String(s.start_date || s.date || '').slice(0, 10);
        var displayLabel = s.kind ? raceSessionDisplayLabel(s.kind, s.label) : (s.label || '');
        var row = Object.assign({}, e, {
          name: baseName,
          start_date: sessionDate || e.start_date,
          end_date: String(s.end_date || s.start_date || s.date || '').slice(0, 10) || sessionDate || e.start_date,
          date: sessionDate || e.start_date,
          time_est: s.time_est,
          time_msk: s.time_msk,
          _sessionLabel: displayLabel,
          _scheduleSessionLabel: displayLabel,
          _scheduleSessionKind: s.kind || '',
          _scheduleGroupId: groupId,
          _scheduleSessionIndex: idx + 1
        });
        delete row._raceUtcMs;
        delete row._scheduleDate;
        delete row._time_msk_raw;
        delete row._raceStartDate;
        out.push(row);
      });
    });
    if (window.TGA.normalizeScheduleEvent) {
      out = out.map(function (ev) { return window.TGA.normalizeScheduleEvent(Object.assign({}, ev)); });
    }
    return out;
  }

  function isAlreadyExpandedForFullSchedule(e) {
    if (!e) return false;
    return !!(e._scheduleSessionKind || e._scheduleSessionLabel || e._sessionLabel);
  }

  function expandFullScheduleEvent(e) {
    if (!e) return [e];
    var sid = seriesKeyNorm(e._seriesId || e.series_id || '');
    if (!sid || isAlreadyExpandedForFullSchedule(e, sid)) return [e];
    if (String(e.id || '').indexOf('PRE_SEASON') >= 0 || /_\d{4}_PROLOGUE$/i.test(String(e.id || ''))) {
      return [e];
    }
    var sessions = buildSessionsForEvent(sid, e);
    if (!sessions || sessions.length <= 1) return [e];
    var baseName = localizedScheduleBaseName(e);
    return sessions.map(function (s) {
      var sessionDate = String(s.start_date || s.date || '').slice(0, 10);
      var displayLabel = s.kind ? raceSessionDisplayLabel(s.kind, s.label) : (s.label || '');
      var row = Object.assign({}, e, {
        name: baseName + ' (' + displayLabel + ')',
        start_date: sessionDate || e.start_date,
        end_date: String(s.end_date || s.start_date || s.date || '').slice(0, 10) || sessionDate || e.start_date,
        date: sessionDate || e.start_date,
        time_est: s.time_est,
        time_msk: s.time_msk,
        _scheduleSessionKind: s.kind || '',
        _scheduleSessionLabel: displayLabel,
        _sessionLabel: displayLabel
      });
      delete row._raceUtcMs;
      delete row._scheduleDate;
      delete row._time_msk_raw;
      delete row._raceStartDate;
      return row;
    });
  }

  function expandFullScheduleEvents(events) {
    if (!Array.isArray(events) || events.length === 0) return events;
    var out = [];
    events.forEach(function (e) {
      expandFullScheduleEvent(e).forEach(function (row) { out.push(row); });
    });
    return out;
  }

  function resolveRaceSessionLabel(e, seriesKey) {
    if (!e) return '';
    var kind = e._scheduleSessionKind;
    if (kind) return raceSessionDisplayLabel(kind, '');
    if (e._sessionLabel && String(e._sessionLabel).indexOf('standings.') !== 0) {
      return String(e._sessionLabel);
    }
    if (String(e.id || '').indexOf('PRE_SEASON') >= 0) {
      return trLabel('schedule.test', 'Test');
    }
    var sk = String(seriesKey || '').toLowerCase();
    if (sk === 'f1' || sk === 'f1-2026' || sk === 'f1-2025') {
      return trLabel('standings.feature_race', 'Feature Race');
    }
    return e._sessionLabel ? String(e._sessionLabel) : '';
  }

  window.TGA.expandSeriesScheduleEvents = expandSeriesScheduleEvents;
  window.TGA.expandFullScheduleEvents = expandFullScheduleEvents;
  window.TGA.normalizeSeriesScheduleBaseName = normalizeEventBaseName;
  window.TGA.trLabel = trLabel;
  window.TGA.resolveRaceSessionLabel = resolveRaceSessionLabel;
})();
