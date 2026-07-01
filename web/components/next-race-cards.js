// Next-race cards: uses window.TGA (t, esc, seriesBadge, formatShortDate, parseEventDate) at call time.
(function () {
  if (typeof window === 'undefined') return;
  window.TGA = window.TGA || {};

  var nrcCards = [];
  var nrcInterval = null;
  var nrcLiveRefresh = null;
  /** Live event IDs from API (data/live.json). Mutated when refetching. */
  var nrcLiveSet = {};
  /** Series with server-side livesync — schedule-time LIVE fallback is disabled. */
  var NRC_LIVE_SYNC_PREFIXES = [
    'NASCAR_CUP_', 'NOAPS_', 'NASCAR_TRUCK_', 'F1_', 'WEC_', 'SUPER_FORMULA_'
  ];

  function eventUsesLiveSync(eventId) {
    var u = String(eventId || '').toUpperCase();
    if (!u) return false;
    for (var i = 0; i < NRC_LIVE_SYNC_PREFIXES.length; i++) {
      if (u.indexOf(NRC_LIVE_SYNC_PREFIXES[i]) === 0) return true;
    }
    return false;
  }

  function stopNextRaceTimers() {
    if (nrcInterval) { clearInterval(nrcInterval); nrcInterval = null; }
    if (nrcLiveRefresh) { clearInterval(nrcLiveRefresh); nrcLiveRefresh = null; }
    nrcCards = [];
  }

  function applyLiveIds(ids) {
    var k;
    for (k in nrcLiveSet) { delete nrcLiveSet[k]; }
    (Array.isArray(ids) ? ids : []).forEach(function (id) {
      var u = (id || '').toUpperCase();
      if (u) nrcLiveSet[u] = true;
    });
  }

  function renderNextRaceCards(allEvents) {
    var t = window.TGA.t;
    var esc = window.TGA.esc;
    var seriesBadge = window.TGA.seriesBadge;
    var formatShortDate = window.TGA.formatShortDate;
    var parseEventDate = window.TGA.parseEventDate;
    if (!t || !esc || !seriesBadge || !formatShortDate || !parseEventDate) return;

    stopNextRaceTimers();
    var container = document.getElementById('next-races-row');
    if (!container) return;
    container.classList.remove('hidden');

    // Same per-race rows and UTC times as Full Schedule (multi-race weekends).
    var prepareScheduleSessionEvents = window.TGA.prepareScheduleSessionEvents;
    if (prepareScheduleSessionEvents) {
      allEvents = prepareScheduleSessionEvents(Array.isArray(allEvents) ? allEvents.slice() : []);
    }

    var todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    var windowStart = todayStart.getTime();
    var windowEnd = windowStart + 7 * 24 * 60 * 60 * 1000 - 1;
    var nowTs = Date.now();

    var liveEndTsForEvent = window.TGA.liveEndTsForEvent;
    var nextRaceEndTs = window.TGA.nextRaceEndTs;

    // When to remove card from "Next": named endurance duration, else calendar/heuristic fallback.
    function endTsForEvent(e, startTs) {
      var calendarEnd = (function () {
        var startStr = (e.start_date || e.date || '').slice(0, 10);
        var endStr = (e.end_date || e.start_date || e.date || '').slice(0, 10);
        if (!endStr) return startTs ? startTs + 3 * 60 * 60 * 1000 : null;
        var endOfDay = new Date(endStr + 'T23:59:59').getTime();
        if (endStr > startStr) {
          return endOfDay;
        }
        var threeHoursAfter = startTs ? startTs + 3 * 60 * 60 * 1000 : endOfDay;
        return threeHoursAfter < endOfDay ? threeHoursAfter : endOfDay;
      })();
      if (nextRaceEndTs) {
        return nextRaceEndTs(e, startTs, calendarEnd);
      }
      return calendarEnd;
    }

    function eventSeriesUpper(ev) {
      return String((ev && (ev._seriesId || ev.series_id)) || '').toUpperCase();
    }

    var weekEntries = [];
    allEvents.forEach(function (e) {
      var sid = e._seriesId || e.series_id;
      if (!sid) return;
      var endDs = (e.end_date || e.start_date || e.date || '').slice(0, 10);
      var raceUtc = (window.TGA && window.TGA.getEventRaceUtcMs) ? window.TGA.getEventRaceUtcMs(e) : 0;
      var dt = raceUtc ? new Date(raceUtc) : parseEventDate(e.start_date || e.date, e.time_est || e.time_msk, '+03:00');
      if (!dt || isNaN(dt.getTime())) return;
      var ts = dt.getTime();
      var spanEndTs = ts;
      if (/^\d{4}-\d{2}-\d{2}$/.test(endDs)) {
        spanEndTs = new Date(endDs + 'T23:59:59').getTime();
      }
      // Overlap with [today; today+7]: otherwise event starting yesterday (FREC, etc.)
      // drops from feed although weekend is still ongoing.
      if (ts > windowEnd || spanEndTs < windowStart) return;
      var startTs = dt.getTime();
      var endTs = endTsForEvent(e, startTs);
      if (!endTs) endTs = startTs + 3 * 60 * 60 * 1000;
      var liveEndTs = liveEndTsForEvent ? liveEndTsForEvent(e, startTs, endTs) : endTs;
      // Show only events not yet finished (start or LIVE window not passed).
      if (endTs >= nowTs) {
        weekEntries.push({ event: e, date: dt, endTs: endTs, liveEndTs: liveEndTs });
      }
    });

    // NOTE: Next Race cards — weekend overlap with "today + 7 days" window (see spanEndTs).
    // (Previously we forced NASCAR Cup into the row even when it was >7 days away,
    // which caused "next week" cards to appear unexpectedly.)

    weekEntries.sort(function (a, b) { return a.date - b.date; });

    // Super Formula: one card per weekend when two races at same track on consecutive days.
    // First isolate SF and collapse among themselves — otherwise other series cards appear between days.
    function collapseSuperFormulaNextRaceWeekEntries(sfEntriesSorted) {
      if (!Array.isArray(sfEntriesSorted) || sfEntriesSorted.length === 0) return sfEntriesSorted;
      var out = [];
      for (var i = 0; i < sfEntriesSorted.length; i++) {
        var entry = sfEntriesSorted[i];
        var e = entry.event;
        var run = [entry];
        var c0 = String(e.circuit_name || '').trim();
        var l0 = String(e.location || '').trim();
        var prevDate = (e.start_date || e.date || '').slice(0, 10);
        var j = i + 1;
        while (j < sfEntriesSorted.length) {
          var e2 = sfEntriesSorted[j].event;
          if (String(e2.circuit_name || '').trim() !== c0 || String(e2.location || '').trim() !== l0) break;
          var dn = (e2.start_date || e2.date || '').slice(0, 10);
          var diff = (new Date(dn + 'T12:00:00').getTime() - new Date(prevDate + 'T12:00:00').getTime()) / 86400000;
          if (diff !== 1) break;
          run.push(sfEntriesSorted[j]);
          prevDate = dn;
          j++;
        }
        if (run.length === 1) {
          out.push(entry);
        } else {
          var first = run[0];
          var last = run[run.length - 1];
          var fe = first.event;
          var le = last.event;
          var d0 = (fe.start_date || fe.date || '').slice(0, 10);
          var d1 = (le.start_date || le.date || '').slice(0, 10);
          var mergedEvent = Object.assign({}, fe, {
            start_date: d0,
            end_date: d1,
            date: d0,
            name: String(fe.circuit_name || fe.name || '').trim(),
            id: fe.id,
            _seriesId: fe._seriesId || fe.series_id || 'SUPER_FORMULA',
            has_detail: run.some(function (x) { return x.event && x.event.has_detail; })
          });
          out.push({ event: mergedEvent, date: first.date, endTs: last.endTs });
        }
        i = j - 1;
      }
      return out;
    }
    var sfWeek = [];
    var weekRest = [];
    weekEntries.forEach(function (ent) {
      if (eventSeriesUpper(ent.event) === 'SUPER_FORMULA') sfWeek.push(ent);
      else weekRest.push(ent);
    });
    sfWeek.sort(function (a, b) { return a.date - b.date; });
    weekEntries = weekRest.concat(collapseSuperFormulaNextRaceWeekEntries(sfWeek));
    weekEntries.sort(function (a, b) { return a.date - b.date; });

    if (weekEntries.length === 0) {
      container.innerHTML =
        '<div class="nrc-label">' + t('home.next_race') + '</div>' +
        '<div class="nrc-empty">' + t('home.no_upcoming') + '</div>';
      return;
    }

    // Render cards and start countdown + LIVE polling, without waiting for /api/live-events
    function pad(n) { return n < 10 ? '0' + n : '' + n; }

    function renderWithLiveSet() {
      container.innerHTML =
        '<div class="nrc-label">' + t('home.next_race') + '</div>' +
        '<div class="nrc-cards">' +
        weekEntries.map(function (entry, idx) {
          var e = entry.event;
          var formatEventRaceStartDate = window.TGA && window.TGA.formatEventRaceStartDate;
          var dateDisplay = formatEventRaceStartDate
            ? formatEventRaceStartDate(e)
            : formatShortDate((e.start_date || e.date || '').slice(0, 10));
          var name = (window.TGA.localizeEventFromData || function (d) { return d.name || '—'; })(e);
          // Always strip title sponsor "Java House" from event name,
          // so UI shows just "Grand Prix of Arlington".
          if (name && name.indexOf('Java House') === 0) {
            name = name.replace(/^Java House\s+/i, '');
            name = (window.TGA.localizeEventFromData || function (d) { return d.name || '—'; })(Object.assign({}, e, { name: name }));
          }
          var eventSlug = (e.id || '').toLowerCase().replace(/_+/g, '-');
          var seriesSlug = (e._seriesId || e.series_id || '').toLowerCase().replace(/_+/g, '-');
          var eventNameLc = String(e.name || '').toLowerCase();
          var href = e.has_detail
            ? '/event/' + encodeURIComponent(eventSlug)
            : '/series/' + encodeURIComponent(seriesSlug);
          var delayMs = idx * 55;
          // Extra classes for track background images.
          var extraClass = '';
          var circuitName = (e.circuit_name || '').toLowerCase();
          var trackName = (e.track || '').toLowerCase();
          var location = (e.location || '').toLowerCase();
          var trackKey = [circuitName, trackName, location].filter(Boolean).join(' ');
          if (trackKey.indexOf('shanghai international circuit') >= 0) {
            extraClass += ' nrc-card--f1-2026-2';
          }
          if (trackKey.indexOf('las vegas motor speedway') >= 0) {
            extraClass += ' nrc-card--cup-2026-3';
          }
          if (trackKey.indexOf('phoenix raceway') >= 0) {
            // Same background for all series at Phoenix.
            extraClass += ' nrc-card--phoenix';
          }
          if (trackKey.indexOf('darlington raceway') >= 0) {
            extraClass += ' nrc-card--darlington';
          }
          if (trackKey.indexOf('rockingham speedway') >= 0) {
            extraClass += ' nrc-card--rockingham';
          }
          if (trackKey.indexOf('martinsville speedway') >= 0) {
            extraClass += ' nrc-card--martinsville';
          }
          if (trackKey.indexOf('suzuka circuit') >= 0 || trackKey.indexOf('suzuka international') >= 0) {
            extraClass += ' nrc-card--suzuka';
          }
          if (trackKey.indexOf('barber motorsports park') >= 0) {
            extraClass += ' nrc-card--barber';
          }
          if (trackKey.indexOf('sebring international raceway') >= 0) {
            extraClass += ' nrc-card--sebring';
          }
          if (trackKey.indexOf('streets of arlington') >= 0) {
            extraClass += ' nrc-card--indycar-2026-3';
          }
          if (trackKey.indexOf('albert park circuit') >= 0) {
            extraClass += ' nrc-card--albert-park';
          }
          if (trackKey.indexOf('mobility resort motegi') >= 0) {
            extraClass += ' nrc-card--motegi';
          }
          if (trackKey.indexOf('circuit de barcelona-catalunya') >= 0 || trackKey.indexOf('barcelona') >= 0 || trackKey.indexOf('montmelo') >= 0) {
            extraClass += ' nrc-card--barcelona';
          }
          if (trackKey.indexOf('taupo') >= 0) {
            extraClass += ' nrc-card--taupo';
          }
          if (trackKey.indexOf('okayama') >= 0 || trackKey.indexOf('okoyama') >= 0) {
            extraClass += ' nrc-card--okayama';
          }
          if (trackKey.indexOf('paul ricard') >= 0 || trackKey.indexOf('le castellet') >= 0) {
            extraClass += ' nrc-card--paul-ricard';
          }
          if (trackKey.indexOf('thompson') >= 0) {
            extraClass += ' nrc-card--thompson';
          }
          if (trackKey.indexOf('imola') >= 0) {
            extraClass += ' nrc-card--imola';
          }
          if (trackKey.indexOf('silverstone') >= 0) {
            extraClass += ' nrc-card--silverstone';
          }
          if (trackKey.indexOf('mid-ohio') >= 0 || trackKey.indexOf('mid ohio') >= 0) {
            extraClass += ' nrc-card--mid-ohio';
          }
          if (trackKey.indexOf('chicagoland') >= 0) {
            extraClass += ' nrc-card--chicagoland';
          }
          if (trackKey.indexOf('kansas speedway') >= 0 || trackKey.indexOf('kansas city, kansas') >= 0) {
            extraClass += ' nrc-card--kansas';
          }
          if (trackKey.indexOf('autopolis') >= 0) {
            extraClass += ' nrc-card--autopolis';
          }
          if (trackKey.indexOf('talladega') >= 0) {
            extraClass += ' nrc-card--talladega';
          }
          if (trackKey.indexOf('texas motor speedway') >= 0 || trackKey.indexOf('fort worth') >= 0) {
            extraClass += ' nrc-card--texas';
          }
          if (trackKey.indexOf('brands hatch') >= 0) {
            extraClass += ' nrc-card--brands-hatch';
          }
          if (trackKey.indexOf('oxford plains') >= 0 || trackKey.indexOf('oxford') >= 0) {
            extraClass += ' nrc-card--oxford-plains';
          }
          if (trackKey.indexOf('fuji') >= 0 || trackKey.indexOf('fuji speedway') >= 0) {
            extraClass += ' nrc-card--fuji';
          }
          if (trackKey.indexOf('miami international autodrome') >= 0 || trackKey.indexOf('miami') >= 0) {
            extraClass += ' nrc-card--miami';
          }
          if (trackKey.indexOf('gilles villeneuve') >= 0 || trackKey.indexOf('circuit gilles') >= 0 || trackKey.indexOf('montreal') >= 0) {
            extraClass += ' nrc-card--montreal';
          }
          if (trackKey.indexOf('laguna seca') >= 0 || trackKey.indexOf('weathertech raceway') >= 0 || trackKey.indexOf('monterey') >= 0) {
            extraClass += ' nrc-card--laguna-seca';
          }
          if (trackKey.indexOf('sonoma raceway') >= 0 || (trackKey.indexOf('sonoma') >= 0 && trackKey.indexOf('california') >= 0)) {
            extraClass += ' nrc-card--sonoma-raceway';
          }
          if (trackKey.indexOf('misano world circuit') >= 0 || trackKey.indexOf('circuit marco simoncelli') >= 0) {
            extraClass += ' nrc-card--misano';
          }
          if (trackKey.indexOf('watkins glen') >= 0) {
            extraClass += ' nrc-card--watkins-glen';
          }
          if (trackKey.indexOf('indianapolis motor speedway road') >= 0) {
            extraClass += ' nrc-card--indianapolis-rc';
          } else if (trackKey.indexOf('indianapolis motor speedway') >= 0) {
            extraClass += ' nrc-card--indianapolis-ims';
          }
          if (trackKey.indexOf('spa-francorchamps') >= 0) {
            extraClass += ' nrc-card--spa-francorchamps';
          }
          if (trackKey.indexOf('red bull ring') >= 0 || trackKey.indexOf('spielberg') >= 0) {
            extraClass += ' nrc-card--red-bull-ring';
          }
          if (trackKey.indexOf('long beach') >= 0) {
            extraClass += ' nrc-card--long-beach';
          }
          if (trackKey.indexOf('euromarque') >= 0 || trackKey.indexOf('christchurch') >= 0) {
            extraClass += ' nrc-card--euromarque';
          }
          if (trackKey.indexOf('dover motor speedway') >= 0 || (trackKey.indexOf('dover') >= 0 && trackKey.indexOf('delaware') >= 0)) {
            extraClass += ' nrc-card--dover';
          }
          if (trackKey.indexOf('seekonk') >= 0) {
            extraClass += ' nrc-card--seekonk';
          }
          if (trackKey.indexOf('moscow raceway') >= 0) {
            extraClass += ' nrc-card--moscow-raceway';
          }
          if (trackKey.indexOf('toledo speedway') >= 0) {
            extraClass += ' nrc-card--toledo';
          }
          if (trackKey.indexOf('charlotte motor speedway') >= 0) {
            extraClass += ' nrc-card--charlotte';
          }
          if (trackKey.indexOf('circuit zandvoort') >= 0 || trackKey.indexOf('zandvoort') >= 0) {
            extraClass += ' nrc-card--zandvoort';
          }
          if (trackKey.indexOf('vallelunga') >= 0) {
            extraClass += ' nrc-card--vallelunga';
          }
          if (trackKey.indexOf('symmons plains') >= 0) {
            extraClass += ' nrc-card--symmons-plains';
          }
          if (trackKey.indexOf('monaco') >= 0) {
            extraClass += ' nrc-card--monaco';
          }
          if (trackKey.indexOf('monza') >= 0) {
            extraClass += ' nrc-card--monza';
          }
          if (trackKey.indexOf('michigan international speedway') >= 0 || trackKey.indexOf('michigan speedway') >= 0) {
            extraClass += ' nrc-card--michigan';
          }
          if (trackKey.indexOf('nashville superspeedway') >= 0) {
            extraClass += ' nrc-card--nashville-superspeedway';
          }
          if (trackKey.indexOf('riverhead raceway') >= 0) {
            extraClass += ' nrc-card--riverhead-raceway';
          }
          if (trackKey.indexOf('streets of detroit') >= 0) {
            extraClass += ' nrc-card--streets-of-detroit';
          }
          if (trackKey.indexOf('world wide technology raceway') >= 0) {
            extraClass += ' nrc-card--world-wide-technology-raceway';
          }
          if (trackKey.indexOf('kazan ring') >= 0 || trackKey.indexOf('kazan') >= 0) {
            extraClass += ' nrc-card--kazan-ring';
          }
          if (trackKey.indexOf('circuit de la sarthe') >= 0 || (
            trackKey.indexOf('le mans') >= 0 && trackKey.indexOf('lone star') < 0 && trackKey.indexOf('austin') < 0
          )) {
            extraClass += ' nrc-card--circuit-de-la-sarthe';
          }
          if (trackKey.indexOf('road america') >= 0) {
            extraClass += ' nrc-card--road-america';
          }
          if (trackKey.indexOf('white mountain') >= 0) {
            extraClass += ' nrc-card--white-mountain-motorsports-park';
          }
          if (trackKey.indexOf('berlin raceway') >= 0) {
            extraClass += ' nrc-card--berlin-raceway';
          }
          if (trackKey.indexOf('elko speedway') >= 0 || (trackKey.indexOf('elko') >= 0 && trackKey.indexOf('minnesota') >= 0)) {
            extraClass += ' nrc-card--elko-speedway';
          }
          if (trackKey.indexOf('lausitzring') >= 0 || trackKey.indexOf('lausitz') >= 0) {
            extraClass += ' nrc-card--lausitzring';
          }
          if (trackKey.indexOf('hidden valley') >= 0) {
            extraClass += ' nrc-card--hidden-valley-raceway';
          }
          if (trackKey.indexOf('sepang') >= 0) {
            extraClass += ' nrc-card--sepang';
          }
          if (trackKey.indexOf('coronado') >= 0) {
            extraClass += ' nrc-card--coronado-street';
          }
          if (trackKey.indexOf('silverstone') >= 0) {
            extraClass += ' nrc-card--silverstone';
          }
          if (trackKey.indexOf('mid-ohio') >= 0 || trackKey.indexOf('mid ohio') >= 0) {
            extraClass += ' nrc-card--mid-ohio';
          }
          if (trackKey.indexOf('chicagoland') >= 0) {
            extraClass += ' nrc-card--chicagoland';
          }
          if (eventNameLc.indexOf('taupo') >= 0 || eventNameLc.indexOf('taupō') >= 0) {
            extraClass += ' nrc-card--taupo';
          }
          if (eventNameLc.indexOf('okayama') >= 0 || eventNameLc.indexOf('okoyama') >= 0) {
            extraClass += ' nrc-card--okayama';
          }
          if (eventNameLc.indexOf('paul ricard') >= 0 || eventNameLc.indexOf('le castellet') >= 0) {
            extraClass += ' nrc-card--paul-ricard';
          }
          if (eventNameLc.indexOf('thompson') >= 0) {
            extraClass += ' nrc-card--thompson';
          }
          if (eventNameLc.indexOf('imola') >= 0) {
            extraClass += ' nrc-card--imola';
          }
          if (eventNameLc.indexOf('kansas') >= 0) {
            extraClass += ' nrc-card--kansas';
          }
          if (eventNameLc.indexOf('autopolis') >= 0) {
            extraClass += ' nrc-card--autopolis';
          }
          if (eventNameLc.indexOf('talladega') >= 0) {
            extraClass += ' nrc-card--talladega';
          }
          if (eventNameLc.indexOf('texas') >= 0 || eventNameLc.indexOf('fort worth') >= 0) {
            extraClass += ' nrc-card--texas';
          }
          if (eventNameLc.indexOf('brands hatch') >= 0) {
            extraClass += ' nrc-card--brands-hatch';
          }
          if (eventNameLc.indexOf('oxford plains') >= 0 || eventNameLc.indexOf('oxford') >= 0) {
            extraClass += ' nrc-card--oxford-plains';
          }
          if (eventNameLc.indexOf('fuji') >= 0) {
            extraClass += ' nrc-card--fuji';
          }
          if (eventNameLc.indexOf('miami') >= 0) {
            extraClass += ' nrc-card--miami';
          }
          if (eventNameLc.indexOf('gilles villeneuve') >= 0 || eventNameLc.indexOf('montreal') >= 0 || eventNameLc.indexOf('canadian grand prix') >= 0) {
            extraClass += ' nrc-card--montreal';
          }
          if (eventNameLc.indexOf('laguna seca') >= 0 || eventNameLc.indexOf('weathertech raceway') >= 0 || eventNameLc.indexOf('monterey') >= 0) {
            extraClass += ' nrc-card--laguna-seca';
          }
          if (eventNameLc.indexOf('sonoma raceway') >= 0 || eventNameLc.indexOf('save mart 350') >= 0 || eventNameLc.indexOf('toyota/save mart') >= 0) {
            extraClass += ' nrc-card--sonoma-raceway';
          }
          if (eventNameLc.indexOf('misano') >= 0 && (
            eventNameLc.indexOf('marco simoncelli') >= 0 ||
            eventNameLc.indexOf('italian f4') >= 0 ||
            eventNameLc.indexOf('gt world challenge') >= 0
          )) {
            extraClass += ' nrc-card--misano';
          }
          if (eventNameLc.indexOf('watkins glen') >= 0) {
            extraClass += ' nrc-card--watkins-glen';
          }
          if (eventNameLc.indexOf('sonsio grand prix') >= 0) {
            extraClass += ' nrc-card--indianapolis-rc';
          }
          if (eventNameLc.indexOf('indianapolis 500') >= 0 || eventNameLc.indexOf('brickyard 400') >= 0 || eventNameLc.indexOf('battle on the bricks') >= 0) {
            extraClass += ' nrc-card--indianapolis-ims';
          }
          if (eventNameLc.indexOf('spa-francorchamps') >= 0 || (
            eventNameLc.indexOf('crowdstrike') >= 0 && eventNameLc.indexOf('spa') >= 0
          )) {
            extraClass += ' nrc-card--spa-francorchamps';
          }
          if (eventNameLc.indexOf('red bull ring') >= 0 || eventNameLc.indexOf('spielberg') >= 0) {
            extraClass += ' nrc-card--red-bull-ring';
          }
          if (eventNameLc.indexOf('long beach') >= 0) {
            extraClass += ' nrc-card--long-beach';
          }
          if (eventNameLc.indexOf('euromarque') >= 0) {
            extraClass += ' nrc-card--euromarque';
          }
          if (eventNameLc.indexOf('dover motor speedway') >= 0) {
            extraClass += ' nrc-card--dover';
          }
          if (eventNameLc.indexOf('seekonk') >= 0) {
            extraClass += ' nrc-card--seekonk';
          }
          if (eventNameLc.indexOf('moscow raceway') >= 0 || (eventNameLc.indexOf('smp f4') >= 0 && eventNameLc.indexOf('moscow') >= 0)) {
            extraClass += ' nrc-card--moscow-raceway';
          }
          if (eventNameLc.indexOf('toledo speedway') >= 0) {
            extraClass += ' nrc-card--toledo';
          }
          if (eventNameLc.indexOf('charlotte motor speedway') >= 0 || eventNameLc.indexOf('coca-cola 600') >= 0) {
            extraClass += ' nrc-card--charlotte';
          }
          if (eventNameLc.indexOf('zandvoort') >= 0 || eventNameLc.indexOf('dutch grand prix') >= 0) {
            extraClass += ' nrc-card--zandvoort';
          }
          if (eventNameLc.indexOf('vallelunga') >= 0) {
            extraClass += ' nrc-card--vallelunga';
          }
          if (eventNameLc.indexOf('symmons plains') >= 0) {
            extraClass += ' nrc-card--symmons-plains';
          }
          if (eventNameLc.indexOf('monaco') >= 0 || eventNameLc.indexOf('monte carlo') >= 0) {
            extraClass += ' nrc-card--monaco';
          }
          if (eventNameLc.indexOf('monza') >= 0 || eventNameLc.indexOf('italian grand prix') >= 0) {
            extraClass += ' nrc-card--monza';
          }
          if (eventNameLc.indexOf('michigan') >= 0) {
            extraClass += ' nrc-card--michigan';
          }
          if (eventNameLc.indexOf('nashville superspeedway') >= 0) {
            extraClass += ' nrc-card--nashville-superspeedway';
          }
          if (eventNameLc.indexOf('riverhead') >= 0) {
            extraClass += ' nrc-card--riverhead-raceway';
          }
          if (eventNameLc.indexOf('detroit') >= 0) {
            extraClass += ' nrc-card--streets-of-detroit';
          }
          if (eventNameLc.indexOf('world wide technology') >= 0) {
            extraClass += ' nrc-card--world-wide-technology-raceway';
          }
          if (eventNameLc.indexOf('pocono') >= 0) {
            extraClass += ' nrc-card--pocono';
          }
          if (eventNameLc.indexOf('kazan') >= 0) {
            extraClass += ' nrc-card--kazan-ring';
          }
          if (eventNameLc.indexOf('24 hours of le mans') >= 0 || eventNameLc.indexOf('hours of le mans') >= 0) {
            extraClass += ' nrc-card--circuit-de-la-sarthe';
          }
          if (eventNameLc.indexOf('road america') >= 0) {
            extraClass += ' nrc-card--road-america';
          }
          if (eventNameLc.indexOf('white mountain') >= 0) {
            extraClass += ' nrc-card--white-mountain-motorsports-park';
          }
          if (eventNameLc.indexOf('berlin raceway') >= 0) {
            extraClass += ' nrc-card--berlin-raceway';
          }
          if (eventNameLc.indexOf('elko speedway') >= 0 || eventNameLc.indexOf('shore lunch') >= 0) {
            extraClass += ' nrc-card--elko-speedway';
          }
          if (eventNameLc.indexOf('lausitzring') >= 0 || eventNameLc.indexOf('lausitz') >= 0) {
            extraClass += ' nrc-card--lausitzring';
          }
          if (eventNameLc.indexOf('hidden valley') >= 0) {
            extraClass += ' nrc-card--hidden-valley-raceway';
          }
          if (eventNameLc.indexOf('sepang') >= 0) {
            extraClass += ' nrc-card--sepang';
          }
          if (eventNameLc.indexOf('coronado') >= 0) {
            extraClass += ' nrc-card--coronado-street';
          }
          if (eventNameLc.indexOf('silverstone') >= 0) {
            extraClass += ' nrc-card--silverstone';
          }
          if (eventNameLc.indexOf('mid-ohio') >= 0 || eventNameLc.indexOf('mid ohio') >= 0) {
            extraClass += ' nrc-card--mid-ohio';
          }
          if (eventNameLc.indexOf('chicagoland') >= 0) {
            extraClass += ' nrc-card--chicagoland';
          }
          if (trackKey.indexOf('pocono raceway') >= 0) {
            extraClass += ' nrc-card--pocono';
          }
          if (trackKey.indexOf('bristol') >= 0) {
            extraClass += ' nrc-card--bristol';
          }
          // Fallback for specific events (legacy/special data without circuit_name).
          if (!extraClass) {
            if (eventSlug === 'f1-2026-2') {
              extraClass += ' nrc-card--f1-2026-2';
            } else if (eventSlug === 'nascar-cup-2026-5' || eventSlug === 'cup-2026-5' || eventSlug === 'noaps-2026-5') {
              extraClass += ' nrc-card--cup-2026-3';
            } else if (eventSlug === 'indycar-2026-3') {
              extraClass += ' nrc-card--indycar-2026-3';
            } else if (eventSlug === 'super-formula-2026-1') {
              extraClass += ' nrc-card--motegi';
            } else if (eventSlug === 'elms-2026-prologue') {
              extraClass += ' nrc-card--barcelona';
            } else if (eventSlug.indexOf('taupo') >= 0) {
              extraClass += ' nrc-card--taupo';
            } else if (eventSlug.indexOf('bristol') >= 0) {
              extraClass += ' nrc-card--bristol';
            } else if (eventSlug.indexOf('okayama') >= 0 || eventSlug.indexOf('okoyama') >= 0) {
              extraClass += ' nrc-card--okayama';
            } else if (eventSlug.indexOf('ricard') >= 0 || eventSlug.indexOf('le-castellet') >= 0) {
              extraClass += ' nrc-card--paul-ricard';
            } else if (eventSlug.indexOf('thompson') >= 0) {
              extraClass += ' nrc-card--thompson';
            } else if (eventSlug.indexOf('imola') >= 0) {
              extraClass += ' nrc-card--imola';
            } else if (eventSlug.indexOf('silverstone') >= 0) {
              extraClass += ' nrc-card--silverstone';
            } else if (eventSlug.indexOf('mid-ohio') >= 0 || eventSlug.indexOf('mid_ohio') >= 0) {
              extraClass += ' nrc-card--mid-ohio';
            } else if (eventSlug.indexOf('chicagoland') >= 0) {
              extraClass += ' nrc-card--chicagoland';
            } else if (eventSlug.indexOf('kansas') >= 0) {
              extraClass += ' nrc-card--kansas';
            } else if (eventSlug.indexOf('autopolis') >= 0) {
              extraClass += ' nrc-card--autopolis';
            } else if (eventSlug.indexOf('talladega') >= 0) {
              extraClass += ' nrc-card--talladega';
            } else if (eventSlug.indexOf('texas') >= 0 || eventSlug.indexOf('fort-worth') >= 0 || eventSlug.indexOf('fort_worth') >= 0) {
              extraClass += ' nrc-card--texas';
            } else if (eventSlug.indexOf('brands-hatch') >= 0 || eventSlug.indexOf('brands_hatch') >= 0) {
              extraClass += ' nrc-card--brands-hatch';
            } else if (eventSlug.indexOf('oxford-plains') >= 0 || eventSlug.indexOf('oxford_plains') >= 0 || eventSlug.indexOf('oxford') >= 0) {
              extraClass += ' nrc-card--oxford-plains';
            } else if (eventSlug.indexOf('fuji') >= 0) {
              extraClass += ' nrc-card--fuji';
            } else if (eventSlug.indexOf('miami') >= 0) {
              extraClass += ' nrc-card--miami';
            } else if (eventSlug.indexOf('montreal') >= 0 || eventSlug.indexOf('gilles-villeneuve') >= 0 || eventSlug.indexOf('gilles_villeneuve') >= 0 || eventSlug === 'f2-2026-3' || eventSlug === 'f1-2026-7') {
              extraClass += ' nrc-card--montreal';
            } else if (eventSlug.indexOf('laguna-seca') >= 0 || eventSlug.indexOf('laguna_seca') >= 0 || eventSlug.indexOf('monterey') >= 0) {
              extraClass += ' nrc-card--laguna-seca';
            } else if (eventSlug.indexOf('sonoma') >= 0 || eventSlug === 'nascar-cup-2026-18') {
              extraClass += ' nrc-card--sonoma-raceway';
            } else if (eventSlug.indexOf('elko') >= 0 || eventSlug === 'arca-2026-10') {
              extraClass += ' nrc-card--elko-speedway';
            } else if (
              eventSlug === 'gtwce-sprint-2026-2' ||
              eventSlug === 'f4-it-2026-1' ||
              eventSlug === 'f4-it-2026-6' ||
              eventSlug.indexOf('misano') >= 0
            ) {
              extraClass += ' nrc-card--misano';
            } else if (eventSlug.indexOf('watkins') >= 0 || eventSlug.indexOf('watkins-glen') >= 0) {
              extraClass += ' nrc-card--watkins-glen';
            } else if (eventSlug === 'indycar-2026-6') {
              extraClass += ' nrc-card--indianapolis-rc';
            } else if (eventSlug === 'indycar-2026-7' || eventSlug.indexOf('imsa-2026-10') >= 0) {
              extraClass += ' nrc-card--indianapolis-ims';
            } else if (
              eventSlug.indexOf('spa-francorchamps') >= 0 ||
              (eventSlug.indexOf('elms') >= 0 && eventSlug.indexOf('spa') >= 0) ||
              (eventSlug.indexOf('wec') >= 0 && eventSlug.indexOf('spa') >= 0) ||
              (eventSlug.indexOf('f2') >= 0 && eventSlug.indexOf('spa') >= 0) ||
              (eventSlug.indexOf('f3') >= 0 && eventSlug.indexOf('spa') >= 0) ||
              (eventSlug.indexOf('frec') >= 0 && eventSlug.indexOf('spa') >= 0) ||
              (eventSlug.indexOf('psc') >= 0 && eventSlug.indexOf('spa') >= 0) ||
              (eventSlug.indexOf('gtwce-end') >= 0 && eventSlug.indexOf('spa') >= 0) ||
              eventSlug === 'f1-2025-13' ||
              eventSlug === 'f1-2026-12'
            ) {
              extraClass += ' nrc-card--spa-francorchamps';
            } else if (eventSlug.indexOf('red-bull-ring') >= 0 || eventSlug.indexOf('red_bull_ring') >= 0 || eventSlug.indexOf('spielberg') >= 0) {
              extraClass += ' nrc-card--red-bull-ring';
            } else if (eventSlug.indexOf('long-beach') >= 0 || eventSlug.indexOf('long_beach') >= 0) {
              extraClass += ' nrc-card--long-beach';
            } else if (eventSlug.indexOf('euromarque') >= 0) {
              extraClass += ' nrc-card--euromarque';
            } else if (eventSlug.indexOf('dover') >= 0 || eventSlug.indexOf('allstar') >= 0 || eventSlug.indexOf('all-star') >= 0) {
              extraClass += ' nrc-card--dover';
            } else if (eventSlug.indexOf('seekonk') >= 0) {
              extraClass += ' nrc-card--seekonk';
            } else if (eventSlug.indexOf('moscow-raceway') >= 0 || eventSlug.indexOf('moscow_raceway') >= 0 || (eventSlug.indexOf('smp-f4') >= 0 && eventSlug.indexOf('moscow') >= 0)) {
              extraClass += ' nrc-card--moscow-raceway';
            } else if (eventSlug.indexOf('toledo-speedway') >= 0 || eventSlug.indexOf('toledo_speedway') >= 0 || eventSlug.indexOf('toledo') >= 0) {
              extraClass += ' nrc-card--toledo';
            } else if (eventSlug.indexOf('charlotte') >= 0) {
              extraClass += ' nrc-card--charlotte';
            } else if (eventSlug.indexOf('zandvoort') >= 0) {
              extraClass += ' nrc-card--zandvoort';
            } else if (eventSlug.indexOf('vallelunga') >= 0) {
              extraClass += ' nrc-card--vallelunga';
            } else if (eventSlug.indexOf('symmons-plains') >= 0 || eventSlug.indexOf('symmons_plains') >= 0 || eventSlug.indexOf('symmons') >= 0) {
              extraClass += ' nrc-card--symmons-plains';
            } else if (eventSlug.indexOf('brickyard') >= 0 || (eventSlug.indexOf('indianapolis') >= 0 && eventSlug.indexOf('indycar-2026-6') < 0)) {
              extraClass += ' nrc-card--indianapolis-ims';
            } else if (eventSlug.indexOf('monaco') >= 0) {
              extraClass += ' nrc-card--monaco';
            } else if (eventSlug.indexOf('monza') >= 0) {
              extraClass += ' nrc-card--monza';
            } else if (eventSlug.indexOf('michigan') >= 0) {
              extraClass += ' nrc-card--michigan';
            } else if (eventSlug.indexOf('nashville') >= 0) {
              extraClass += ' nrc-card--nashville-superspeedway';
            } else if (eventSlug.indexOf('riverhead') >= 0) {
              extraClass += ' nrc-card--riverhead-raceway';
            } else if (eventSlug.indexOf('detroit') >= 0) {
              extraClass += ' nrc-card--streets-of-detroit';
            } else if (eventSlug.indexOf('world-wide-technology') >= 0 || eventSlug.indexOf('wwtr') >= 0) {
              extraClass += ' nrc-card--world-wide-technology-raceway';
            } else if (eventSlug.indexOf('pocono') >= 0) {
              extraClass += ' nrc-card--pocono';
            } else if (eventSlug.indexOf('kazan') >= 0) {
              extraClass += ' nrc-card--kazan-ring';
            } else if (
              eventSlug === 'wec-2026-3' ||
              (eventSlug.indexOf('le-mans') >= 0 &&
                eventSlug.indexOf('lone-star') < 0 &&
                eventSlug.indexOf('cota') < 0)
            ) {
              extraClass += ' nrc-card--circuit-de-la-sarthe';
            }
          }
          if (extraClass) {
            extraClass += ' race-card-photo';
          }
          return (
            '<a href="' + href + '" class="nrc-card nrc-card-enter' + extraClass + '" style="animation-delay: ' + delayMs + 'ms">' +
              '<div class="nrc-top">' + seriesBadge(e._seriesId || e.series_id || '') +
                '<span class="nrc-date">' + esc(dateDisplay) + '</span>' +
                '<span class="nrc-live" data-nrc-live="' + idx + '" aria-hidden="true">' + esc((window.TGA.t && window.TGA.t('live.badge')) || 'LIVE') + '</span>' +
              '</div>' +
              '<div class="nrc-name">' + esc(name) + '</div>' +
              '<div class="nrc-timer" data-nrc="' + idx + '">—</div>' +
            '</a>'
          );
        }).join('') +
        '</div>';

      // If title does not fit the card — shrink font for that card only
      (function shrinkNameFontToFit() {
        function run() {
          var cardsWrap = container.querySelector('.nrc-cards');
          if (!cardsWrap) return;
          var cards = cardsWrap.querySelectorAll('.nrc-card');
          var minPx = 10;
          cards.forEach(function (card) {
            var nameEl = card.querySelector('.nrc-name');
            if (!nameEl) return;
            var style = nameEl.style;
            while (nameEl.scrollWidth > nameEl.clientWidth && nameEl.clientWidth > 0) {
              var current = parseFloat(window.getComputedStyle(nameEl).fontSize) || 16;
              if (current <= minPx) break;
              var next = Math.max(minPx, current - 2);
              style.fontSize = next + 'px';
            }
          });
        }
        if (typeof requestAnimationFrame !== 'undefined') {
          requestAnimationFrame(function () { requestAnimationFrame(run); });
        } else {
          run();
        }
      })();

      nrcCards = weekEntries.map(function (entry, idx) {
        var e = entry.event;
        var raceUtc = (window.TGA && window.TGA.getEventRaceUtcMs) ? window.TGA.getEventRaceUtcMs(e) : 0;
        var cardAnchor = container.querySelectorAll('.nrc-cards .nrc-card')[idx];
        return {
          el: container.querySelector('[data-nrc="' + idx + '"]'),
          cardEl: cardAnchor,
          liveEl: container.querySelector('[data-nrc-live="' + idx + '"]'),
          date: entry.date,
          raceUtcMs: raceUtc || (entry.date && entry.date.getTime ? entry.date.getTime() : 0),
          liveEndTs: entry.liveEndTs != null ? entry.liveEndTs : entry.endTs,
          endTs: entry.endTs,
          eventId: (e.id || '').toUpperCase(),
          expired: false
        };
      });

      var nrcRefreshPending = false;
      function scheduleNextRaceRefresh() {
        if (nrcRefreshPending) return;
        nrcRefreshPending = true;
        setTimeout(function () {
          nrcRefreshPending = false;
          var cache = window.TGA && window.TGA.getGlobalEventsCache && window.TGA.getGlobalEventsCache();
          if (!cache) return;
          renderNextRaceCards(cache);
          if (window.TGA && typeof window.TGA.renderLastResultsCards === 'function') {
            window.TGA.renderLastResultsCards(cache);
          }
        }, 200);
      }

      function tick() {
        var now2 = Date.now();
        var needRefresh = false;
        nrcCards.forEach(function (c) {
          if (!c.el || c.expired) return;
          if (c.endTs && now2 > c.endTs) {
            c.expired = true;
            if (c.cardEl) c.cardEl.style.display = 'none';
            needRefresh = true;
            return;
          }
          var startTs = c.raceUtcMs || (c.date && c.date.getTime ? c.date.getTime() : 0);
          var fromApi = c.eventId && nrcLiveSet[c.eventId];
          var inLiveWindow = startTs && now2 >= startTs && c.liveEndTs && now2 <= c.liveEndTs;
          // Live-sync series prefer API; fall back to schedule window when sync is offline.
          var isLive = fromApi || inLiveWindow;
          if (c.liveEl) {
            if (isLive) {
              c.liveEl.classList.add('nrc-live-visible');
              c.liveEl.setAttribute('aria-hidden', 'false');
            } else {
              c.liveEl.classList.remove('nrc-live-visible');
              c.liveEl.setAttribute('aria-hidden', 'true');
            }
          }
          if (isLive) {
            c.el.textContent = (window.TGA.t && window.TGA.t('live.badge')) || 'LIVE';
            return;
          }
          var diff = startTs - now2;
          if (!startTs || diff <= 0) {
            if (inLiveWindow) {
              c.el.textContent = (window.TGA.t && window.TGA.t('live.badge')) || 'LIVE';
            } else {
              c.el.textContent = '0' + ((window.TGA.t && window.TGA.t('cd.secs')) || 's');
            }
            return;
          }
          var days  = Math.floor(diff / 86400000);
          var hours = Math.floor((diff % 86400000) / 3600000);
          var mins  = Math.floor((diff % 3600000)  / 60000);
          var secs  = Math.floor((diff % 60000)    / 1000);
          c.el.textContent = days > 0
            ? pad(days) + (window.TGA.t('cd.days') || 'd') + ' ' + pad(hours) + (window.TGA.t('cd.hours') || 'h') + ' ' + pad(mins) + (window.TGA.t('cd.mins') || 'm')
            : pad(hours) + ':' + pad(mins) + ':' + pad(secs);
        });
        if (needRefresh) scheduleNextRaceRefresh();
      }

      container.classList.remove('hidden');
      tick();
      nrcInterval = setInterval(tick, 1000);
    }

    renderWithLiveSet();
    var API = window.TGA && window.TGA.API;
    function fetchLiveIds() {
      return API ? API.getLiveEvents() : fetch('/api/live-events').then(function (r) { return r.json(); });
    }
    fetchLiveIds()
      .then(function (ids) {
        applyLiveIds(ids);
        nrcLiveRefresh = setInterval(function () {
          fetchLiveIds().then(applyLiveIds).catch(function () {});
        }, 60000);
      })
      .catch(function () {});
  }

  window.TGA.renderNextRaceCards = renderNextRaceCards;
  window.TGA.stopNextRaceTimers = stopNextRaceTimers;
})();
