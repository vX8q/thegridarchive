// Expand weekend events into per-race rows for series schedule tables (Supercars-style).
(function () {
  if (typeof window === 'undefined') return;
  window.TGA = window.TGA || {};

  var MULTI_RACE_SERIES = {
    f2: true,
    f3: true,
    frec: true,
    f4_it: true,
    gtwce_sprint: true,
    dtm: true,
    f1: true
  };

  var F1_SPRINT_WEEKENDS = {
    F1_2025_2: true,
    F1_2025_6: true,
    F1_2025_13: true,
    F1_2025_19: true,
    F1_2026_2: true,
    F1_2026_4: true,
    F1_2026_5: true,
    F1_2026_9: true,
    F1_2026_12: true,
    F1_2026_16: true
  };

  function seriesKeyNorm(seriesId) {
    var k = String(seriesId || '').toLowerCase().replace(/-/g, '_');
    if (/^f1_\d{4}$/.test(k)) return 'f1';
    return k;
  }

  function isoAddDays(iso, delta) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
    var t = new Date(iso + 'T12:00:00').getTime() + delta * 86400000;
    var d = new Date(t);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function trLabel(key, fallback) {
    var t = window.TGA && window.TGA.t;
    if (!t) return fallback;
    var v = t(key);
    return (v && v !== key) ? v : fallback;
  }

  function raceSessionDisplayLabel(kind, fallbackLabel) {
    if (kind === 'sprint') return trLabel('standings.sprint', 'Sprint');
    if (kind === 'feature') return trLabel('standings.feature_race', 'Feature Race');
    if (kind === 'test') return trLabel('schedule.test', 'Test');
    return fallbackLabel || '';
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

  function sessionRow(label, startDate, timeEst, timeMsk, kind) {
    return {
      label: label,
      kind: kind || '',
      start_date: startDate || '',
      end_date: startDate || '',
      time_est: timeEst || '',
      time_msk: timeMsk || ''
    };
  }

  function buildSessionsFromMultiRaceMap(e) {
    var map = (typeof window !== 'undefined' && window.TGA_MULTI_RACE_SESSIONS) || {};
    var races = map[String(e.id || '').toUpperCase()];
    if (!Array.isArray(races) || races.length === 0) return null;
    return races.map(function (r) {
      var label = r.label || (r.race != null ? 'Race ' + r.race : 'Race');
      var kind = r.kind || '';
      if (!kind && /^sprint$/i.test(label)) kind = 'sprint';
      if (!kind && /^feature$/i.test(label)) kind = 'feature';
      return sessionRow(
        label,
        String(r.date || '').slice(0, 10),
        r.time_est || r.time_local || '',
        r.time_msk || '',
        kind
      );
    });
  }

  function f1SprintMetaForEvent(idU) {
    var staticSched = (typeof window !== 'undefined' && window.TGA_STATIC_SCHEDULES) || {};
    var byYear = {
      '2025': staticSched.f1Sprint2025 || {},
      '2026': staticSched.f1Sprint2026 || {}
    };
    var year = (String(idU).match(/_(\d{4})_/) || [])[1] || '';
    return (byYear[year] || {})[idU] || {};
  }

  function buildF1SprintSessions(e) {
    var idU = String(e.id || '').toUpperCase();
    if (!F1_SPRINT_WEEKENDS[idU]) return [];
    var gpDate = String(e.start_date || e.date || '').slice(0, 10);
    var meta = f1SprintMetaForEvent(idU);
    var sprintDate = meta.sprintDate || isoAddDays(gpDate, -1);
    return [
      sessionRow('Sprint', sprintDate, meta.sprintLocal || '', meta.sprintMsk || '', 'sprint'),
      sessionRow('Feature Race', gpDate, e.time_est || '', e.time_msk || '', 'feature')
    ];
  }

  function buildSessionsForEvent(sid, e) {
    var fromMap = buildSessionsFromMultiRaceMap(e);
    if (fromMap && fromMap.length) return fromMap;
    if (sid === 'f1') return buildF1SprintSessions(e);
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
    var raw = String(seriesId || '').toLowerCase();
    var k = seriesKeyNorm(seriesId);
    if (k === 'f1') return raw === 'f1' || raw === 'f1-2026' || raw === 'f1-2025';
    return !!MULTI_RACE_SERIES[k];
  }

  function expandSeriesScheduleEvents(seriesId, events) {
    if (!Array.isArray(events) || events.length === 0) return events;
    var sid = seriesKeyNorm(seriesId);
    if (!MULTI_RACE_SERIES[sid]) return events;
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
        var row = Object.assign({}, e, {
          name: baseName,
          start_date: s.start_date || e.start_date,
          end_date: s.end_date || s.start_date || e.end_date,
          date: s.start_date || e.start_date,
          time_est: s.time_est,
          time_msk: s.time_msk,
          _sessionLabel: s.kind ? raceSessionDisplayLabel(s.kind, s.label) : s.label,
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

  function isAlreadyExpandedForFullSchedule(e, sid) {
    var name = String((e && e.name) || '');
    if (/\((Sprint|Feature(?:\s+Race)?|Race\s+\d+|Grand Prix)\)\s*$/i.test(name)) return true;
    if ((sid === 'f2' || sid === 'f3') && /\((Sprint|Feature)\)/i.test(name)) return true;
    return false;
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
      var displayLabel = s.kind ? raceSessionDisplayLabel(s.kind, s.label) : s.label;
      var row = Object.assign({}, e, {
        name: baseName + ' (' + displayLabel + ')',
        start_date: s.start_date || e.start_date,
        end_date: s.end_date || s.start_date || e.end_date,
        date: s.start_date || e.start_date,
        time_est: s.time_est,
        time_msk: s.time_msk,
        _scheduleSessionKind: s.kind || '',
        _scheduleSessionLabel: displayLabel
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

  function isExpandedScheduleSessionRow(e) {
    if (!e) return false;
    if (e._scheduleSessionKind || e._scheduleSessionLabel) return true;
    var sid = seriesKeyNorm(e._seriesId || e.series_id || '');
    return isAlreadyExpandedForFullSchedule(e, sid);
  }

  /** First and last race calendar dates for an event weekend (not per expanded session row). */
  function getEventRaceDateRangeIso(e) {
    if (!e) return { start: '', end: '' };
    var parseIso = window.TGA && window.TGA.parseIsoDatePrefix;
    var iso = parseIso || function (s) {
      var str = String(s || '').trim();
      return /^\d{4}-\d{2}-\d{2}/.test(str) ? str.slice(0, 10) : '';
    };
    var start = iso(e.start_date || e.startDate) || iso(e.date);
    var end = iso(e.end_date || e.endDate);
    if (/^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end) && end > start) {
      return { start: start, end: end };
    }
    var sid = seriesKeyNorm(e._seriesId || e.series_id || '');
    var sessions = buildSessionsForEvent(sid, e);
    if (sessions && sessions.length > 1) {
      var dates = sessions.map(function (s) {
        return String(s.start_date || '').slice(0, 10);
      }).filter(function (d) { return /^\d{4}-\d{2}-\d{2}$/.test(d); }).sort();
      if (dates.length > 1) {
        return { start: dates[0], end: dates[dates.length - 1] };
      }
      if (dates.length === 1) {
        return { start: dates[0], end: dates[0] };
      }
    }
    var getIso = window.TGA && window.TGA.getEventRaceStartDateIso;
    var raceStart = getIso ? getIso(e) : '';
    if (!raceStart) raceStart = start;
    return { start: raceStart, end: raceStart || end || start };
  }

  window.TGA.isMultiRaceSeriesSchedule = isMultiRaceSeriesSchedule;
  window.TGA.isExpandedScheduleSessionRow = isExpandedScheduleSessionRow;
  window.TGA.getEventRaceDateRangeIso = getEventRaceDateRangeIso;
  window.TGA.expandSeriesScheduleEvents = expandSeriesScheduleEvents;
  window.TGA.expandFullScheduleEvents = expandFullScheduleEvents;
  window.TGA.normalizeSeriesScheduleBaseName = normalizeEventBaseName;
  window.TGA.trLabel = trLabel;
  window.TGA.resolveRaceSessionLabel = resolveRaceSessionLabel;
})();
