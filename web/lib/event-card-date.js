// Card date rules + session building + race-date range resolution (single source of truth).
(function () {
  if (typeof window === 'undefined') return;
  window.TGA = window.TGA || {};

  /**
   * Product rules for home/schedule card dates. Keys are normalized series ids (lowercase).
   * @type {Object<string, {card: string, sessions?: string, notes?: string}>}
   */
  var SERIES_CARD_DATE_RULES = {
    f2: { card: 'weekend_range', next_race: 'session_day', sessions: 'sprint_feature', notes: 'Sprint Sat + Feature Sun' },
    f3: { card: 'weekend_range', next_race: 'session_day', sessions: 'sprint_feature' },
    frec: { card: 'weekend_range', next_race: 'session_day', sessions: 'sprint_feature' },
    f4_it: { card: 'weekend_range', next_race: 'session_day', sessions: 'sprint_feature' },
    gtwce_sprint: { card: 'weekend_range', next_race: 'session_day', sessions: 'race_1_2' },
    dtm: { card: 'weekend_range', next_race: 'session_day', sessions: 'race_1_2' },
    f1: { card: 'weekend_range', next_race: 'session_day', sessions: 'sprint_gp_when_sprint_weekend' },
    super_formula: { card: 'weekend_range', next_race: 'session_day', sessions: 'multi_race_map_or_span' },
    imsa: { card: 'race_day_only', notes: 'Multi-day schedule span; card shows race day only' },
    wec: { card: 'race_day_only' },
    elms: { card: 'race_day_only' },
    gtwce_end: { card: 'race_day_only' },
    psc: { card: 'race_day_only' },
    supercars: { card: 'weekend_merge', next_race: 'session_day', notes: 'Last Results: one card per venue weekend; Next Race: one card per schedule race' },
    default: { card: 'single_day', notes: '24h races show two calendar days from name' }
  };

  var MULTI_RACE_SERIES = {
    f2: true, f3: true, frec: true, f4_it: true,
    gtwce_sprint: true, dtm: true, f1: true, super_formula: true
  };

  var WEEKEND_SPAN_SERIES = {
    f2: true, f3: true, frec: true, f4_it: true, dtm: true, gtwce_sprint: true
  };

  var RACE_DAY_ONLY_SERIES = {
    IMSA: true, WEC: true, ELMS: true, GTWCE_END: true, PSC: true
  };

  function seriesKeyNorm(seriesId) {
    var k = String(seriesId || '').toLowerCase().replace(/-/g, '_');
    if (/^f1_\d{4}$/.test(k)) return 'f1';
    return k;
  }

  function getSeriesCardDateRule(seriesId) {
    var k = seriesKeyNorm(seriesId);
    return SERIES_CARD_DATE_RULES[k] || SERIES_CARD_DATE_RULES.default;
  }

  function buildF1SprintWeekendSet() {
    var staticSched = (typeof window !== 'undefined' && window.TGA_STATIC_SCHEDULES) || {};
    var set = {};
    ['f1Sprint2025', 'f1Sprint2026'].forEach(function (key) {
      var block = staticSched[key] || {};
      Object.keys(block).forEach(function (id) { set[String(id).toUpperCase()] = true; });
    });
    return set;
  }

  var F1_SPRINT_WEEKENDS = buildF1SprintWeekendSet();

  function isoAddDays(iso, delta) {
    var fn = window.TGA && window.TGA.isoAddDays;
    if (fn) return fn(iso, delta);
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

  function buildSessionsFromWeekendSpan(e, raceLabels) {
    var start = String(e.start_date || e.date || '').slice(0, 10);
    var end = String(e.end_date || e.endDate || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(end) || end <= start) return null;
    var labels = raceLabels || ['Race 1', 'Race 2'];
    return [
      sessionRow(labels[0], start, e.time_est || '', e.time_msk || '', ''),
      sessionRow(labels[1], end, e.time_est || '', e.time_msk || '', '')
    ];
  }

  function sessionsNeedWeekendSpanFix(sessions, e) {
    if (!sessions || sessions.length < 2) return false;
    var end = String(e.end_date || e.endDate || '').slice(0, 10);
    var start = String(e.start_date || e.date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(end) || end <= start) return false;
    var first = String(sessions[0].start_date || '').slice(0, 10);
    return sessions.every(function (s) {
      return String(s.start_date || '').slice(0, 10) === first;
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
    var getRaceDay = window.TGA && window.TGA.getEventRaceLocalDateIso;
    var gpDate = getRaceDay
      ? getRaceDay(e)
      : String(e.end_date || e.start_date || e.date || '').slice(0, 10);
    var meta = f1SprintMetaForEvent(idU);
    var sprintDate = meta.sprintDate || isoAddDays(gpDate, -1);
    return [
      sessionRow('Sprint', sprintDate, meta.sprintLocal || '', meta.sprintMsk || '', 'sprint'),
      sessionRow('Feature Race', gpDate, e.time_est || '', e.time_msk || '', 'feature')
    ];
  }

  function openWheelSpanLabels(sid) {
    if (sid === 'f2' || sid === 'f3' || sid === 'frec' || sid === 'f4_it') {
      return ['Sprint', 'Feature'];
    }
    return ['Race 1', 'Race 2'];
  }

  function buildSessionsForEvent(sid, e) {
    var fromMap = buildSessionsFromMultiRaceMap(e);
    if (fromMap && fromMap.length) {
      if (sessionsNeedWeekendSpanFix(fromMap, e)) {
        var fixed = buildSessionsFromWeekendSpan(e, openWheelSpanLabels(sid));
        if (fixed && fixed.length) return fixed;
      }
      return fromMap;
    }
    if (sid === 'f1') return buildF1SprintSessions(e);
    if (WEEKEND_SPAN_SERIES[sid]) {
      var fromSpan = buildSessionsFromWeekendSpan(e, openWheelSpanLabels(sid));
      if (fromSpan && fromSpan.length) return fromSpan;
    }
    return [];
  }

  function namedRaceDurationHours(name) {
    var fn = window.TGA && window.TGA.parseNamedRaceDurationHours;
    return fn ? fn(name) : null;
  }

  function hasScheduleSessionMetadata(e) {
    if (!e) return false;
    return !!(e._scheduleSessionKind || e._scheduleSessionLabel || e._sessionLabel);
  }

  /** True for per-session schedule rows (Full Schedule / series table). */
  function looksLikePerSessionScheduleRow(e) {
    if (!e) return false;
    var name = String(e.name || '');
    if (!/\((Sprint|Feature(?:\s+Race)?|Race\s+\d+|Grand Prix)\)\s*$/i.test(name)) return false;
    var parseIso = window.TGA && window.TGA.parseIsoDatePrefix;
    var iso = parseIso || function (s) {
      var str = String(s || '').trim();
      return /^\d{4}-\d{2}-\d{2}/.test(str) ? str.slice(0, 10) : '';
    };
    var start = iso(e.start_date || e.date);
    var end = iso(e.end_date);
    return !!(start && end && start === end);
  }

  /** True only for rows expanded with explicit session metadata (Full Schedule / series table). */
  function isExpandedScheduleSessionRow(e) {
    if (!e) return false;
    if (hasScheduleSessionMetadata(e)) return true;
    return looksLikePerSessionScheduleRow(e);
  }

  function isF1SprintWeekendEvent(e) {
    return !!F1_SPRINT_WEEKENDS[String(e && e.id || '').toUpperCase()];
  }

  function isMultiRaceSeriesSchedule(seriesId) {
    var raw = String(seriesId || '').toLowerCase();
    var k = seriesKeyNorm(seriesId);
    if (k === 'f1') return raw === 'f1' || raw === 'f1-2026' || raw === 'f1-2025';
    return !!MULTI_RACE_SERIES[k];
  }

  /** Single-race endurance: multi-day weekend in schedule JSON, one race day on cards. */
  function enduranceWeekendRaceDayOnly(e) {
    if (!e) return false;
    var sid = String((e._seriesId || e.series_id) || '').toUpperCase();
    if (!RACE_DAY_ONLY_SERIES[sid]) return false;
    var name = String(e.name || e.race || '').trim();
    if (namedRaceDurationHours(name) === 24) return false;
    var parseIso = window.TGA && window.TGA.parseIsoDatePrefix;
    var iso = parseIso || function (s) {
      var str = String(s || '').trim();
      return /^\d{4}-\d{2}-\d{2}/.test(str) ? str.slice(0, 10) : '';
    };
    var start = iso(e.start_date || e.date);
    var end = iso(e.end_date);
    return !!(start && end && end > start);
  }

  function singleRaceCardDateIso(e) {
    if (!e) return '';
    if (enduranceWeekendRaceDayOnly(e)) {
      var getRaceIso = window.TGA && window.TGA.getEventRaceStartDateIso;
      var raceDay = getRaceIso ? getRaceIso(e) : '';
      if (!raceDay) {
        var parseEnd = window.TGA && window.TGA.parseIsoDatePrefix;
        raceDay = parseEnd ? parseEnd(e.end_date) : String(e.end_date || '').slice(0, 10);
      }
      return raceDay;
    }
    return '';
  }

  function sessionRaceStartDateIso(parent, s) {
    var getStartIso = window.TGA && window.TGA.getEventRaceStartDateIso;
    var normalize = window.TGA && window.TGA.normalizeScheduleEvent;
    if (!getStartIso || !normalize) {
      return String(s.start_date || '').slice(0, 10);
    }
    var temp = Object.assign({}, parent, {
      start_date: s.start_date || parent.start_date,
      end_date: s.end_date || s.start_date || parent.end_date,
      date: s.start_date || parent.start_date,
      time_est: s.time_est != null ? s.time_est : parent.time_est,
      time_msk: s.time_msk != null ? s.time_msk : parent.time_msk
    });
    delete temp._raceUtcMs;
    delete temp._scheduleDate;
    delete temp._raceStartDate;
    delete temp._time_msk_raw;
    temp = normalize(temp);
    return getStartIso(temp) || String(s.start_date || '').slice(0, 10);
  }

  function pushLocalRaceDateIso(dates, isoStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoStr)) return;
    if (dates.indexOf(isoStr) < 0) dates.push(isoStr);
  }

  function eventShowsWeekendDateRange(e) {
    if (!e) return false;
    var rule = getSeriesCardDateRule(seriesKeyNorm(e._seriesId || e.series_id || ''));
    return rule.card === 'weekend_range' || rule.card === 'weekend_merge';
  }

  /** First and last race calendar dates in the viewer timezone (multi-race weekends only). */
  function getEventRaceDateRangeIso(e) {
    if (!e) return { start: '', end: '' };
    var parseIso = window.TGA && window.TGA.parseIsoDatePrefix;
    var iso = parseIso || function (s) {
      var str = String(s || '').trim();
      return /^\d{4}-\d{2}-\d{2}/.test(str) ? str.slice(0, 10) : '';
    };
    if (hasScheduleSessionMetadata(e)) {
      var getIso = window.TGA && window.TGA.getEventRaceStartDateIso;
      var one = getIso ? getIso(e) : '';
      if (!one) one = iso(e.start_date || e.date) || iso(e.end_date);
      return { start: one, end: one };
    }
    var raceOnly = singleRaceCardDateIso(e);
    if (raceOnly) {
      return { start: raceOnly, end: raceOnly };
    }

    var getRaceIso = window.TGA && window.TGA.getEventRaceStartDateIso;
    if (!eventShowsWeekendDateRange(e)) {
      var raceDay = getRaceIso ? getRaceIso(e) : '';
      if (!raceDay) raceDay = iso(e.start_date || e.startDate) || iso(e.date) || iso(e.end_date);
      return { start: raceDay, end: raceDay };
    }

    var dates = [];
    var sid = seriesKeyNorm(e._seriesId || e.series_id || '');
    var sessions = buildSessionsForEvent(sid, e);
    if (sessions && sessions.length) {
      sessions.forEach(function (s) {
        pushLocalRaceDateIso(dates, sessionRaceStartDateIso(e, s));
      });
    } else {
      pushLocalRaceDateIso(dates, iso(e.start_date || e.startDate) || iso(e.date));
      pushLocalRaceDateIso(dates, iso(e.end_date || e.endDate));
      if (getRaceIso) {
        pushLocalRaceDateIso(dates, getRaceIso(e));
      }
    }

    if (!dates.length) return { start: '', end: '' };
    dates.sort();
    return { start: dates[0], end: dates[dates.length - 1] };
  }

  function getEventRaceSessions(ev) {
    if (!ev) return [];
    var sid = seriesKeyNorm(ev._seriesId || ev.series_id || '');
    return buildSessionsForEvent(sid, ev) || [];
  }

  function refreshF1SprintWeekends() {
    F1_SPRINT_WEEKENDS = buildF1SprintWeekendSet();
  }

  /**
   * Calendar date (ISO) for Next Race cards — always the upcoming race day, never a weekend span.
   */
  function nextRaceCardDateIso(e) {
    if (!e) return '';
    var parseIso = window.TGA && window.TGA.parseIsoDatePrefix;
    var iso = parseIso || function (s) {
      var str = String(s || '').trim();
      return /^\d{4}-\d{2}-\d{2}/.test(str) ? str.slice(0, 10) : '';
    };
    if (isExpandedScheduleSessionRow(e)) {
      var getIsoRow = window.TGA && window.TGA.getEventRaceStartDateIso;
      return (getIsoRow ? getIsoRow(e) : '') || iso(e.start_date || e.date) || iso(e.end_date);
    }
    if (enduranceWeekendRaceDayOnly(e)) {
      var raceDay = singleRaceCardDateIso(e);
      if (raceDay) return raceDay;
    }
    var sid = seriesKeyNorm(e._seriesId || e.series_id || '');
    var rule = getSeriesCardDateRule(sid);
    var namedHours = window.TGA && window.TGA.parseNamedRaceDurationHours;
    var name = String(e.name || e.race || '').trim();
    if (namedHours && namedHours(name) === 24) {
      return iso(e.start_date || e.date) || iso(e.end_date);
    }
    if (rule.next_race === 'session_day' || rule.card === 'weekend_range' || rule.card === 'weekend_merge' ||
        isMultiRaceSeriesSchedule(sid)) {
      var getIso = window.TGA && window.TGA.getEventRaceStartDateIso;
      if (getIso) {
        var raceIso = getIso(e);
        if (raceIso) return raceIso;
      }
      var sessions = buildSessionsForEvent(sid, e);
      if (sessions && sessions.length) {
        return sessionRaceStartDateIso(e, sessions[0]) || iso(sessions[0].start_date);
      }
    }
    var getIsoDefault = window.TGA && window.TGA.getEventRaceStartDateIso;
    return (getIsoDefault ? getIsoDefault(e) : '') || iso(e.start_date || e.date) || iso(e.end_date);
  }

  /** Display date for Next Race home cards (single race day). */
  function formatNextRaceCardDate(e) {
    var formatShortDate = window.TGA && window.TGA.formatShortDate;
    if (!formatShortDate) return '—';
    var raceIso = nextRaceCardDateIso(e);
    if (!raceIso) return '—';
    return formatShortDate(raceIso) || raceIso;
  }

  window.TGA.SERIES_CARD_DATE_RULES = SERIES_CARD_DATE_RULES;
  window.TGA.getSeriesCardDateRule = getSeriesCardDateRule;
  window.TGA.buildSessionsForEvent = buildSessionsForEvent;
  window.TGA.isMultiRaceSeriesSchedule = isMultiRaceSeriesSchedule;
  window.TGA.isExpandedScheduleSessionRow = isExpandedScheduleSessionRow;
  window.TGA.isF1SprintWeekendEvent = isF1SprintWeekendEvent;
  window.TGA.enduranceWeekendRaceDayOnly = enduranceWeekendRaceDayOnly;
  window.TGA.singleRaceCardDateIso = singleRaceCardDateIso;
  window.TGA.getEventRaceDateRangeIso = getEventRaceDateRangeIso;
  window.TGA.eventShowsWeekendDateRange = eventShowsWeekendDateRange;
  window.TGA.getEventRaceSessions = getEventRaceSessions;
  window.TGA.nextRaceCardDateIso = nextRaceCardDateIso;
  window.TGA.formatNextRaceCardDate = formatNextRaceCardDate;
  window.TGA.raceSessionDisplayLabel = raceSessionDisplayLabel;
  window.TGA.refreshF1SprintWeekends = refreshF1SprintWeekends;
})();
