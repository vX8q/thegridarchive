// Merge per-race home-feed cards into one weekend card (Supercars, Super Formula, etc.).
(function () {
  if (typeof window === 'undefined') return;
  window.TGA = window.TGA || {};

  function isoSlice(v) {
    return String(v || '').slice(0, 10);
  }

  function sameVenue(e1, e2) {
    return String(e1.circuit_name || '').trim() === String(e2.circuit_name || '').trim() &&
      String(e1.location || '').trim() === String(e2.location || '').trim();
  }

  function dayDiffMs(fromIso, toIso) {
    return new Date(toIso + 'T12:00:00').getTime() - new Date(fromIso + 'T12:00:00').getTime();
  }

  /**
   * @param {Array} items
   * @param {Object} opts
   * @param {function} opts.matchSeries - (item) => boolean
   * @param {function} opts.getEvent - (item) => object
   * @param {function} opts.getRangeStart - (item) => string
   * @param {function} opts.getRangeEnd - (item) => string
   * @param {function} opts.mergeRun - (run: Array) => item
   * @param {number} [opts.maxGapDays=1] - max calendar gap between consecutive races (1 = next day)
   * @param {boolean} [opts.allowOverlap=false] - Supercars: merge when ranges overlap (diff <= 1 day)
   */
  function mergeWeekendCards(items, opts) {
    if (!Array.isArray(items) || items.length === 0) return items;
    opts = opts || {};
    var maxGapMs = (opts.maxGapDays != null ? opts.maxGapDays : 1) * 86400000;
    var allowOverlap = !!opts.allowOverlap;
    var matched = [];
    var rest = [];
    items.forEach(function (item) {
      if (opts.matchSeries(item)) matched.push(item);
      else rest.push(item);
    });
    matched.sort(function (a, b) {
      var da = isoSlice(opts.getRangeStart(a));
      var db = isoSlice(opts.getRangeStart(b));
      return da < db ? -1 : da > db ? 1 : 0;
    });
    var out = [];
    for (var i = 0; i < matched.length; i++) {
      var c = matched[i];
      var e = opts.getEvent(c);
      var run = [c];
      var prev = isoSlice(opts.getRangeEnd(c) || opts.getRangeStart(c));
      var j = i + 1;
      while (j < matched.length) {
        var c2 = matched[j];
        var e2 = opts.getEvent(c2);
        if (!sameVenue(e, e2)) break;
        var d2 = isoSlice(opts.getRangeStart(c2));
        var diffMs = dayDiffMs(prev, d2);
        if (allowOverlap) {
          if (diffMs > maxGapMs) break;
        } else if (diffMs !== maxGapMs) {
          break;
        }
        run.push(c2);
        var c2End = isoSlice(opts.getRangeEnd(c2) || d2);
        if (!prev || c2End > prev) prev = c2End;
        j++;
      }
      out.push(run.length === 1 ? c : opts.mergeRun(run));
      i = j - 1;
    }
    var merged = rest.concat(out);
    merged.sort(function (a, b) {
      var ka = isoSlice(opts.getRangeStart(a));
      var kb = isoSlice(opts.getRangeStart(b));
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
    return merged;
  }

  function mergeLastResultsWeekendCards(cards, seriesId) {
    var sid = String(seriesId || '').toUpperCase();
    return mergeWeekendCards(cards, {
      matchSeries: function (c) {
        return String((c.event && (c.event._seriesId || c.event.series_id)) || '').toUpperCase() === sid;
      },
      getEvent: function (c) { return c.event || {}; },
      getRangeStart: function (c) { return c.rangeStart || c.dateStr || ''; },
      getRangeEnd: function (c) { return c.rangeEnd || c.rangeStart || c.dateStr || ''; },
      maxGapDays: sid === 'SUPERCARS' ? 1 : 1,
      allowOverlap: sid === 'SUPERCARS',
      mergeRun: function (run) {
        var first = run[0];
        var last = run[run.length - 1];
        var fe = first.event || {};
        var rs = isoSlice(first.rangeStart || first.dateStr);
        var re = isoSlice(last.rangeEnd || last.dateStr);
        var allWinners = [];
        run.forEach(function (x) {
          var w = x.winners;
          if (Array.isArray(w)) {
            for (var wi = 0; wi < w.length; wi++) allWinners.push(w[wi]);
          }
        });
        if (sid === 'SUPERCARS') {
          var seen = {};
          allWinners = allWinners.filter(function (w) {
            var key = String((w && w.label) || '') + '|' + String((w && w.car) || '') + '|' + String((w && w.name) || '');
            if (seen[key]) return false;
            seen[key] = true;
            return true;
          });
        }
        var mergedName = sid === 'SUPERCARS'
          ? String(fe.name || fe.circuit_name || '').replace(/\s*Race\s*\d+\s*$/i, '').trim() || String(fe.circuit_name || '').trim()
          : String(fe.circuit_name || fe.name || '').trim();
        return {
          event: Object.assign({}, fe, {
            start_date: rs,
            end_date: re,
            name: mergedName,
            _seriesId: fe._seriesId || fe.series_id || sid
          }),
          dateStr: re,
          rangeStart: rs,
          rangeEnd: re,
          winners: allWinners
        };
      }
    });
  }

  function mergeNextRaceWeekendEntries(entries, seriesId) {
    var sid = String(seriesId || '').toUpperCase();
    return mergeWeekendCards(entries, {
      matchSeries: function (ent) {
        return String((ent.event && (ent.event._seriesId || ent.event.series_id)) || '').toUpperCase() === sid;
      },
      getEvent: function (ent) { return ent.event || {}; },
      getRangeStart: function (ent) {
        var e = ent.event || {};
        return e.start_date || e.date || '';
      },
      getRangeEnd: function (ent) {
        var e = ent.event || {};
        return e.end_date || e.start_date || e.date || '';
      },
      maxGapDays: 1,
      allowOverlap: sid === 'SUPERCARS',
      mergeRun: function (run) {
        var first = run[0];
        var last = run[run.length - 1];
        var fe = first.event || {};
        var le = last.event || {};
        var d0 = isoSlice(fe.start_date || fe.date);
        var d1 = isoSlice(le.end_date || le.start_date || le.date);
        var mergedName = sid === 'SUPERCARS'
          ? String(fe.name || fe.circuit_name || '').replace(/\s*Race\s*\d+\s*$/i, '').trim() || String(fe.circuit_name || '').trim()
          : String(fe.circuit_name || fe.name || '').trim();
        var mergedEvent = Object.assign({}, fe, {
          start_date: d0,
          end_date: d1,
          date: d0,
          name: mergedName,
          id: fe.id,
          _seriesId: fe._seriesId || fe.series_id || sid,
          has_detail: run.some(function (x) { return x.event && x.event.has_detail; })
        });
        return { event: mergedEvent, date: first.date, endTs: last.endTs, liveEndTs: last.liveEndTs };
      }
    });
  }

  function collapseNextRaceWeekends(weekEntries, seriesIds) {
    if (!Array.isArray(weekEntries) || weekEntries.length === 0) return weekEntries;
    var ids = Array.isArray(seriesIds) ? seriesIds : ['SUPER_FORMULA', 'SUPERCARS'];
    var out = weekEntries.slice();
    ids.forEach(function (sid) {
      var matched = [];
      var rest = [];
      out.forEach(function (ent) {
        var es = String((ent.event && (ent.event._seriesId || ent.event.series_id)) || '').toUpperCase();
        if (es === String(sid).toUpperCase()) matched.push(ent);
        else rest.push(ent);
      });
      matched.sort(function (a, b) {
        var ta = a.date && a.date.getTime ? a.date.getTime() : 0;
        var tb = b.date && b.date.getTime ? b.date.getTime() : 0;
        return ta - tb;
      });
      out = rest.concat(mergeNextRaceWeekendEntries(matched, sid));
    });
    return out;
  }

  window.TGA.mergeWeekendCards = mergeWeekendCards;
  window.TGA.mergeLastResultsWeekendCards = mergeLastResultsWeekendCards;
  window.TGA.mergeNextRaceWeekendEntries = mergeNextRaceWeekendEntries;
  window.TGA.collapseNextRaceWeekends = collapseNextRaceWeekends;

  function pickIsoDate(v) {
    var s = String(v || '').trim();
    return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : '';
  }

  /**
   * Collapse duplicate Last Results rows that share event.id (F2/F3 per-race schedule expansion).
   * Weekend span comes from getEventRaceDateRangeIso on the parent event.
   */
  function collapseLastResultsByEventId(items, seriesIds) {
    if (!Array.isArray(items) || items.length === 0) return items;
    var ids = Array.isArray(seriesIds) ? seriesIds : ['F2', 'F3'];
    var byEventId = {};
    items.forEach(function (p) {
      var eid = String((p.event && p.event.id) || '').toUpperCase();
      if (!eid) return;
      if (!byEventId[eid]) {
        byEventId[eid] = p;
        return;
      }
      var sid = String((p.event && (p.event._seriesId || p.event.series_id)) || '').toUpperCase();
      if (ids.indexOf(sid) < 0) return;
      var prev = byEventId[eid];
      var parent = Object.assign({}, prev.event, p.event, { _seriesId: sid, series_id: sid });
      var getRange = window.TGA && window.TGA.getEventRaceDateRangeIso;
      var range = getRange ? getRange(parent) : { start: '', end: '' };
      var spanStart = pickIsoDate(range.start);
      var spanEnd = pickIsoDate(range.end);
      var baseName = String(p.event.name || prev.event.name || '')
        .replace(/\s*\((Sprint|Feature)\)\s*$/i, '').trim();
      byEventId[eid] = Object.assign({}, prev, {
        event: Object.assign({}, parent, {
          name: baseName || prev.event.name,
          start_date: spanStart || prev.event.start_date,
          end_date: spanEnd || prev.event.end_date
        }),
        weekendStart: spanStart || prev.weekendStart,
        weekendEnd: spanEnd || prev.weekendEnd
      });
    });
    return Object.keys(byEventId).map(function (k) { return byEventId[k]; });
  }

  window.TGA.collapseLastResultsByEventId = collapseLastResultsByEventId;
})();
