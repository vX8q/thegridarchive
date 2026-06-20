// Schedule: buildScheduleGroups (pure), buildScheduleHTML. Uses window.TGA at call time.
(function () {
  if (typeof window === 'undefined') return;
  window.TGA = window.TGA || {};

  function scheduleEventSeriesUpper(e) {
    return String((e && (e._seriesId || e.series_id)) || '').toUpperCase();
  }

  function sfRoundNumFromId(id) {
    var m = String(id || '').match(/_(\d+)$/);
    return m ? parseInt(m[1], 10) : 0;
  }

  /** Circuit + locality on one line (Super Formula full schedule / series table). */
  function superFormulaVenueLine(e) {
    var c = (e && e.circuit_name && String(e.circuit_name).trim()) || '';
    var l = (e && e.location && String(e.location).trim()) || '';
    if (c && l) return c + ' — ' + l;
    return c || l || '—';
  }

  /**
   * Collapses two-day Super Formula events (same track, consecutive dates) into one schedule row.
   * Other series and events pass through unchanged. Array sorted by start date.
   */
  function collapseSuperFormulaScheduleEvents(events) {
    if (!Array.isArray(events) || events.length === 0) return events;
    var sorted = events.slice().sort(function (a, b) {
      var da = (a.start_date || a.date || '').slice(0, 10);
      var db = (b.start_date || b.date || '').slice(0, 10);
      if (da < db) return -1;
      if (da > db) return 1;
      var sa = scheduleEventSeriesUpper(a);
      var sb = scheduleEventSeriesUpper(b);
      if (sa < sb) return -1;
      if (sa > sb) return 1;
      return 0;
    });
    var out = [];
    for (var i = 0; i < sorted.length; i++) {
      var e = sorted[i];
      if (scheduleEventSeriesUpper(e) !== 'SUPER_FORMULA') {
        out.push(e);
        continue;
      }
      var run = [e];
      var c0 = String(e.circuit_name || '').trim();
      var l0 = String(e.location || '').trim();
      var prevDate = (e.start_date || e.date || '').slice(0, 10);
      var j = i + 1;
      while (j < sorted.length) {
        var n = sorted[j];
        if (scheduleEventSeriesUpper(n) !== 'SUPER_FORMULA') break;
        var cn = String(n.circuit_name || '').trim();
        var ln = String(n.location || '').trim();
        if (cn !== c0 || ln !== l0) break;
        var dn = (n.start_date || n.date || '').slice(0, 10);
        var diff = (new Date(dn + 'T12:00:00').getTime() - new Date(prevDate + 'T12:00:00').getTime()) / 86400000;
        if (diff !== 1) break;
        run.push(n);
        prevDate = dn;
        j++;
      }
      var first = run[0];
      var last = run[run.length - 1];
      var d0 = (first.start_date || first.date || '').slice(0, 10);
      var d1 = (last.start_date || last.date || '').slice(0, 10);
      var baseName = String(first.circuit_name || first.name || '').trim();
      var r1 = sfRoundNumFromId(first.id);
      var r2 = sfRoundNumFromId(last.id);
      var rdLabel = run.length > 1 && r1 && r2 ? (r1 + '–' + r2) : String(r1 || r2 || '');
      function allSameNonEmptyTime(key) {
        var vals = run.map(function (x) { return String((x && x[key]) || '').trim(); }).filter(function (v) { return v.length > 0; });
        if (vals.length === 0) return '';
        var base = vals[0];
        for (var vi = 1; vi < vals.length; vi++) {
          if (vals[vi] !== base) return '';
        }
        return base;
      }
      var mergedTimeEst = allSameNonEmptyTime('time_est') || String((first && first.time_est) || '').trim();
      var mergedTimeMsk = allSameNonEmptyTime('time_msk') || String((first && first.time_msk) || '').trim();
      if (!mergedTimeEst) mergedTimeEst = 'TBD';
      if (!mergedTimeMsk) mergedTimeMsk = 'TBD';

      var merged = Object.assign({}, first, {
        start_date: d0,
        end_date: run.length > 1 ? d1 : (first.end_date || d0).slice(0, 10),
        date: d0,
        name: baseName,
        circuit_name: first.circuit_name,
        location: first.location,
        id: first.id,
        _seriesId: first._seriesId || first.series_id || 'SUPER_FORMULA',
        has_detail: run.some(function (x) { return x.has_detail; }),
        _sfEventIds: run.map(function (x) { return x && x.id ? String(x.id) : ''; }).filter(function (id) { return id.length > 0; }),
        time_est: mergedTimeEst,
        time_msk: mergedTimeMsk,
        _sfRdLabel: rdLabel
      });
      out.push(merged);
      i = j - 1;
    }
    return out;
  }

  /** Per-race rows (FREC, DTM, F4 IT, GTWCE Sprint, F1 sprint, …) + UTC times.  */
  function prepareScheduleSessionEvents(events) {
    if (!Array.isArray(events) || events.length === 0) return events;
    var expanded = (window.TGA && window.TGA.expandFullScheduleEvents)
      ? window.TGA.expandFullScheduleEvents(events)
      : events;
    var normalize = window.TGA.normalizeScheduleEvent;
    if (!normalize) return expanded;
    return expanded.map(function (e) {
      return normalize(Object.assign({}, e));
    });
  }

  function buildScheduleGroups(allEvents) {
    var getEventScheduleLocalDate = window.TGA.getEventScheduleLocalDate || function (e) {
      return String((e && (e.start_date || e.date)) || '').slice(0, 10);
    };
    var groups = [], curGroup = null;
    allEvents.forEach(function (e) {
      // Group by local race date (Sunday at track), not MSK calendar.
      var ds = e._scheduleDate || getEventScheduleLocalDate(e);
      var ms = ds ? new Date(ds + 'T12:00:00').getTime() : 0;
      if (!curGroup || ms - curGroup.endMs > 3 * 86400000) {
        curGroup = { startDs: ds, endDs: ds, ms: ms, endMs: ms, events: [] };
        groups.push(curGroup);
      } else if (ds > curGroup.endDs) {
        curGroup.endDs = ds;
        curGroup.endMs = ms;
      }
      curGroup.events.push(e);
    });
    return groups;
  }

  function buildScheduleHTML(allEvents, bodyId) {
    var esc = window.TGA.esc;
    var t = window.TGA.t;
    var formatDateRange = window.TGA.formatDateRange;
    var formatDateRangeLong = window.TGA.formatDateRangeLong;
    var formatShortDate = window.TGA.formatShortDate;
    var seriesBadge = window.TGA.seriesBadge;
    var makeSimpleTableSortable = window.TGA.makeSimpleTableSortable;
    var applySchedulePastVisibility = window.TGA.applySchedulePastVisibility;
    var timePlaceholder = (t && t('schedule.tbd')) ? t('schedule.tbd') : 'TBD';
    if (!esc || !formatDateRange || !formatShortDate || !seriesBadge) return;
    var formatDateForGroup = formatDateRangeLong || formatDateRange;

    var body = document.getElementById(bodyId);
    if (!body) return;
    if (allEvents.length === 0) { body.innerHTML = ''; return; }

    allEvents = prepareScheduleSessionEvents(allEvents);
    allEvents = collapseSuperFormulaScheduleEvents(allEvents);

    var normalizeScheduleEvent = window.TGA.normalizeScheduleEvent;
    if (normalizeScheduleEvent) {
      allEvents = allEvents.map(function (e) { return normalizeScheduleEvent(Object.assign({}, e)); });
    }

    var todayMs = new Date(); todayMs.setHours(0, 0, 0, 0); todayMs = todayMs.getTime();
    var groups = buildScheduleGroups(allEvents);
    var nextMarked = false;
    var html = '';

    var getEventRaceUtcMs = window.TGA.getEventRaceUtcMs;
    var formatRaceUtcForDisplay = window.TGA.formatRaceUtcForDisplay;

    // Sort timestamp: actual start moment (MSK / EST / embedded MSK date).
    function getEventSortTimeMs(e) {
      if (getEventRaceUtcMs) {
        var utc = getEventRaceUtcMs(e);
        if (utc) return utc;
      }
      var ds = (e._scheduleDate || e.start_date || e.date || '').slice(0, 10);
      if (!ds) return 0;
      return new Date(ds + 'T12:00:00').getTime();
    }

    groups.forEach(function (g) {
      // Weekend header: treat as past when the group's last day has ended (not only the first).
      var isPastGroup = g.endMs > 0 && g.endMs < todayMs;
      html += '<tr class="weekend-hdr' + (isPastGroup ? ' sched-past' : '') + '">' +
        '<td colspan="5"><span class="wknd-date">' + esc(formatDateForGroup(g.startDs, g.endDs)) + '</span></td></tr>';

      var eventsInGroup = g.events.slice().sort(function (a, b) {
        return getEventSortTimeMs(a) - getEventSortTimeMs(b);
      });

      eventsInGroup.forEach(function (e) {
        var getLocalDate = window.TGA.getEventScheduleLocalDate || function (ev) {
          return String((ev && (ev.start_date || ev.date)) || '').slice(0, 10);
        };
        var ds = e._scheduleDate || getLocalDate(e);
        var endDs = (e.end_date || '').slice(0, 10);
        // Past: by event's last calendar day (for Sat–Sun weekends end_date = Sunday).
        var lastDs = (endDs && ds && endDs >= ds) ? endDs : ds;
        var ms = lastDs ? new Date(lastDs + 'T12:00:00').getTime() : 0;
        var isPast = ms > 0 && ms < todayMs;
        var isNext = !isPast && !nextMarked;
        if (isNext) nextMarked = true;

        var seriesSlug = (e._seriesId || e.series_id || '').toLowerCase().replace(/_+/g, '-');
        var link;
        if (e.has_detail && e.id) {
          var eventSlug = (e.id || '').toLowerCase().replace(/_+/g, '-');
          link = '<a href="/event/' + encodeURIComponent(eventSlug) + '" class="event-link">' + esc(e.name || '—') + '</a>';
        } else if (seriesSlug) {
          // No event detail file but series exists — link to series page.
          link = '<a href="/series/' + encodeURIComponent(seriesSlug) + '" class="event-link event-link--series">' + esc(e.name || '—') + '</a>';
        } else {
          link = '<span class="event-no-data">' + esc(e.name || '—') + '</span>';
        }

        var dateShort = (ds && endDs && ds !== endDs && formatDateRangeLong)
          ? formatDateRangeLong(e.start_date, e.end_date)
          : (ds ? formatShortDate(ds) : '');
        var estRaw = e.time_est || e.timeEst || e.time_et || '';
        var mskRaw = e.time_msk || e.timeMsk || '';
        var seriesIdUpper = scheduleEventSeriesUpper(e);

        // Base is Moscow time (race UTC moment); display in browser timezone.
        var timeOnlyLabel = timePlaceholder;
        if (formatRaceUtcForDisplay && getEventRaceUtcMs) {
          var raceUtc = getEventRaceUtcMs(e);
          if (raceUtc) timeOnlyLabel = formatRaceUtcForDisplay(raceUtc) || timePlaceholder;
        }
        if (timeOnlyLabel === timePlaceholder) {
          var rawTime = (mskRaw || estRaw || '').trim();
          if (rawTime && rawTime.toUpperCase() !== 'TBD') timeOnlyLabel = rawTime;
        }

        var locCombined = seriesIdUpper === 'SUPER_FORMULA'
          ? superFormulaVenueLine(e)
          : (e.circuit_name || e.location || '—');
        html += '<tr class="sched-row' + (isPast ? ' sched-past' : isNext ? ' sched-next' : '') + '">' +
          '<td class="sched-series">'  + seriesBadge(e._seriesId || e.series_id || '') + '</td>' +
          '<td class="sched-race">'    + link + '</td>' +
          '<td class="sched-date">'    + esc(dateShort || '—') + '</td>' +
          '<td class="sched-location">' + esc(locCombined) + '</td>' +
          '<td class="col-time sched-time">' + esc(timeOnlyLabel) + '</td>' +
        '</tr>';
      });
    });

    body.innerHTML = html;
    var table = body.closest('table');
    if (table && makeSimpleTableSortable) makeSimpleTableSortable(table);
    if (applySchedulePastVisibility) applySchedulePastVisibility();
  }

  /** Returns one time label for event e (MSK base → user local timezone). */
  function getScheduleTimeLabel(e, seriesId) {
    var tFn = window.TGA.t;
    var formatRaceUtcForDisplay = window.TGA.formatRaceUtcForDisplay;
    var getEventRaceUtcMs = window.TGA.getEventRaceUtcMs;
    var normalizeScheduleEvent = window.TGA.normalizeScheduleEvent;
    var tbdLabel = (tFn && tFn('schedule.tbd')) ? tFn('schedule.tbd') : 'TBD';
    var ev = e;
    if (normalizeScheduleEvent && !e._raceUtcMs) {
      ev = normalizeScheduleEvent(Object.assign({}, e));
    }
    if (formatRaceUtcForDisplay && getEventRaceUtcMs) {
      var utc = getEventRaceUtcMs(ev);
      if (utc) {
        var label = formatRaceUtcForDisplay(utc);
        if (label) return label;
      }
    }
    var raw = String(ev.time_msk || ev.time_est || '').trim();
    if (!raw || /^tbd$/i.test(raw) || raw === '—') return tbdLabel;
    return raw;
  }

  window.TGA.buildScheduleGroups = buildScheduleGroups;
  window.TGA.buildScheduleHTML = buildScheduleHTML;
  window.TGA.getScheduleTimeLabel = getScheduleTimeLabel;
  window.TGA.collapseSuperFormulaScheduleEvents = collapseSuperFormulaScheduleEvents;
  window.TGA.prepareScheduleSessionEvents = prepareScheduleSessionEvents;
  window.TGA.superFormulaVenueLine = superFormulaVenueLine;
})();
