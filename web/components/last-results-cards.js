// Last-results cards: shows winners from the most recent completed race day.
(function () {
  if (typeof window === 'undefined') return;
  window.TGA = window.TGA || {};

  function localizeWinnerCardLabel(label) {
    var fn = window.TGA && window.TGA.localizeWinnerCardLabel;
    return fn ? fn(label) : (label == null ? '' : String(label).trim());
  }

  function winnerDriverLabel(name) {
    if (!name) return '';
    return (window.TGA && window.TGA.driverLabel) ? window.TGA.driverLabel(name) : String(name);
  }

  function winnerTeamLabel(name) {
    if (!name) return '';
    return (window.TGA && window.TGA.teamLabel) ? window.TGA.teamLabel(name) : String(name);
  }

  function isGtwceSpa24HoursEvent(meta) {
    if (!meta || typeof meta !== 'object') return false;
    var race = String(meta.race || meta.name || '').trim();
    var track = String(meta.track || meta.circuit_name || '').trim().toLowerCase();
    return /24\s*hours?\s*of\s*spa/i.test(race) ||
      (/crowdstrike/i.test(race) && /spa/i.test(race) && /24/i.test(race)) ||
      (track.indexOf('spa') >= 0 && /24\s*hours?/i.test(race));
  }

  function renderLastResultsCards(allEvents) {
    var t = window.TGA.t;
    var esc = window.TGA.esc;
    var seriesBadge = window.TGA.seriesBadge;
    var formatShortDate = window.TGA.formatShortDate;
    var formatDateRange = window.TGA.formatDateRange;
    if (!t || !esc || !seriesBadge || !formatShortDate || !formatDateRange) return;

    var pickIsoDate = window.TGA.pickIsoDate;
    var isIsoYMD = window.TGA.isIsoYMD;
    var formatLastResultsCardDate = window.TGA.formatLastResultsCardDate;
    var eventLastRaceDateIso = window.TGA.eventLastRaceDateIso;
    var cardLastRaceDateIso = window.TGA.cardLastRaceDateIso;
    var cardFirstRaceSortKey = window.TGA.cardFirstRaceSortKey;
    var lastResultsCardRaceDateRange = window.TGA.lastResultsCardRaceDateRange;
    var isWithinLastResultsWindowForItem = window.TGA.isWithinLastResultsWindowForItem;
    if (!pickIsoDate || !formatLastResultsCardDate || !eventLastRaceDateIso) return;

    var container = document.getElementById('last-results-row');
    if (!container) return;

    // Filter to past events which have detailed JSON (so results can exist).
    // IMPORTANT: use local date, not toISOString(), to avoid UTC shift.
    var today = new Date();
    var todayISO = today.getFullYear() + '-' +
      ('0' + (today.getMonth() + 1)).slice(-2) + '-' +
      ('0' + today.getDate()).slice(-2);

    /**
     * Estimated UTC moment after which race is reasonably finished (start + typical duration).
     * Uses the same UTC start as Full Schedule / Next Race (getEventRaceUtcMs).
     */
    function estimateRaceFinishedUtcMs(ev) {
      return window.TGA.estimateRaceFinishedUtcMs
        ? window.TGA.estimateRaceFinishedUtcMs(ev)
        : null;
    }

    function isPastForLastResults(ev) {
      return window.TGA.isPastForLastResultsEvent
        ? window.TGA.isPastForLastResultsEvent(ev)
        : false;
    }

    function isPastForLastResultsCard(card) {
      var e = card && card.event;
      if (!e) return false;
      var lastIso = cardLastRaceDateIso(card);
      if (!lastIso) return isPastForLastResults(e);
      return isPastForLastResults(Object.assign({}, e, {
        end_date: lastIso,
        start_date: pickIsoDate(card.rangeStart) || e.start_date || e.date
      }));
    }

    var allPast = [];
    var pastDetailed = [];
    var weekendLastById = (window.TGA && typeof window.TGA.buildGroupedWeekendLastEventById === 'function')
      ? window.TGA.buildGroupedWeekendLastEventById(allEvents)
      : {};
    (Array.isArray(allEvents) ? allEvents : []).forEach(function (e) {
      if (!e || !e.id) return;
      var dateStr = (e.end_date || e.start_date || e.date || '').slice(0, 10);
      if (!isIsoYMD(dateStr)) return;
      // Per-race schedule rows (Supercars / PSC / IndyCar): wait until the weekend's last race.
      var gateEv = weekendLastById[String(e.id || '').toUpperCase()] || e;
      if (!isPastForLastResults(gateEv)) return;

      allPast.push({ event: e, dateStr: dateStr });

      // Previously filtered by has_detail, but for F1 / IndyCar / Cup this flag
      // is not always set although detail files and API exist.
      // Now try all past events and ignore those where
      // /api/events/{id} returns no data.
      var sid = String(e._seriesId || e.series_id || '').toUpperCase();
      var eid = String(e.id || '').toUpperCase();

      // Exclude exhibition Cook Out Clash (NASCAR_CUP_*_0) from "Last results" block.
      if (sid === 'NASCAR_CUP' && /_0$/.test(eid)) return;

      pastDetailed.push({ event: e, dateStr: dateStr });
    });

    if (pastDetailed.length === 0) {
      container.innerHTML =
        '<div class="lrc-label">' + esc(t('home.last_results') || 'Last Results') + '</div>' +
        '<div class="lrc-empty">' + esc(t('home.no_results') || 'No recent results') + '</div>';
      container.classList.remove('hidden');
      return;
    }

    pastDetailed.sort(function (a, b) {
      return a.dateStr < b.dateStr ? -1 : a.dateStr > b.dateStr ? 1 : 0;
    });
    var recent = [];
    var buildScheduleGroups = window.TGA && typeof window.TGA.buildScheduleGroups === 'function'
      ? window.TGA.buildScheduleGroups
      : null;
    if (buildScheduleGroups && allPast.length > 0) {
      allPast.sort(function (a, b) {
        return a.dateStr < b.dateStr ? -1 : a.dateStr > b.dateStr ? 1 : 0;
      });
      var groups = buildScheduleGroups(allPast.map(function (p) { return p.event; }));
      var detailedById = {};
      pastDetailed.forEach(function (p) {
        var id = String(p.event.id || '').toUpperCase();
        if (!id) return;
        detailedById[id] = p;
      });
      if (Array.isArray(groups) && groups.length > 0) {
        groups.forEach(function (grp) {
          var eventsInGroup = Array.isArray(grp.events) ? grp.events : [];
          eventsInGroup.forEach(function (e) {
            var id = String(e.id || '').toUpperCase();
            if (!id) return;
            var p = detailedById[id];
            if (!p) return;
            if (grp.startDs) {
              p.weekendStart = grp.startDs;
              p.weekendEnd = grp.endDs || grp.startDs;
            }
            recent.push(p);
          });
        });
      }
    }
    if (recent.length === 0) {
      recent = pastDetailed.slice();
    }

    // Card hidden if more than 7 days since the last race finish.
    recent = recent.filter(function (p) {
      return isWithinLastResultsWindowForItem(p);
    });

    // If no recent events with detail files — exit.
    if (recent.length === 0) {
      container.innerHTML =
        '<div class="lrc-label">' + esc(t('home.last_results') || 'Last Results') + '</div>' +
        '<div class="lrc-empty">' + esc(t('home.no_results') || 'No recent results') + '</div>';
      container.classList.remove('hidden');
      return;
    }

    // Collapse F2/F3 per-race schedule rows → one card per event.id (weekend span from event-card-date).
    var recentUnique = (window.TGA && window.TGA.collapseLastResultsByEventId)
      ? window.TGA.collapseLastResultsByEventId(recent, ['F2', 'F3'])
      : recent;

    if (recentUnique.length === 0) {
      container.innerHTML =
        '<div class="lrc-label">' + esc(t('home.last_results') || 'Last Results') + '</div>' +
        '<div class="lrc-empty">' + esc(t('home.no_results') || 'No recent results') + '</div>';
      container.classList.remove('hidden');
      return;
    }

    // One batch summary request instead of N full event JSON fetches.
    var API = window.TGA && window.TGA.API;

    var pendingCards = [];
    var summaryItems = [];
    recentUnique.forEach(function (item) {
      var e = item.event;
      var eventId = String(e.id || '');
      if (!eventId) return;
      if (e.has_detail === false) {
        var pendingCard = {
          event: e,
          dateStr: item.dateStr,
          winners: [],
          rangeStart: (e.start_date || e.date || item.dateStr || '').slice(0, 10),
          rangeEnd: eventLastRaceDateIso(e, item),
          isF1SprintWeekend: !!(window.TGA && window.TGA.isF1SprintWeekendEvent && window.TGA.isF1SprintWeekendEvent(e))
        };
        var pendingRange = lastResultsCardRaceDateRange(pendingCard);
        if (pendingRange.start) pendingCard.rangeStart = pendingRange.start;
        if (pendingRange.end) pendingCard.rangeEnd = pendingRange.end;
        if (isPastForLastResultsCard(pendingCard)) pendingCards.push(pendingCard);
        return;
      }
      summaryItems.push(item);
    });

    function cardFromEventSummary(item, sum) {
      var e = item.event;
      sum = sum || {};
      var winners = [];
      if (Array.isArray(sum.winners)) {
        for (var wi = 0; wi < sum.winners.length; wi++) {
          var w = sum.winners[wi] || {};
          winners.push({
            name: w.name || '',
            car: w.car || '',
            label: w.label || ''
          });
        }
      }
      var getRangeSeed = window.TGA && window.TGA.getEventRaceDateRangeIso;
      var schedSeed = getRangeSeed ? getRangeSeed(e) : { start: '', end: '' };
      var raceDayStart = pickIsoDate(schedSeed.start);
      var raceDayEnd = pickIsoDate(schedSeed.end);
      // Prefer race-day resolution (PSC/IMSA race_day_only) over raw schedule weekend span.
      var evStart = pickIsoDate(sum.range_start) ||
        (raceDayStart && raceDayEnd && raceDayStart === raceDayEnd ? raceDayStart : '') ||
        pickIsoDate(e.start_date) || pickIsoDate(item.weekendStart) || pickIsoDate(item.dateStr);
      var evEnd = pickIsoDate(sum.range_end) ||
        (raceDayStart && raceDayEnd && raceDayStart === raceDayEnd ? raceDayEnd : '') ||
        pickIsoDate(e.end_date) || evStart || pickIsoDate(item.weekendEnd) || pickIsoDate(item.dateStr);
      if (!evStart && getRangeSeed) {
        evStart = raceDayStart || evStart;
        evEnd = raceDayEnd || evEnd;
      }
      if (evStart && !evEnd) evEnd = evStart;
      if (evEnd && !evStart) evStart = evEnd;
      var isF1SprintWeekend = !!(sum.is_f1_sprint_weekend) ||
        !!(window.TGA && window.TGA.isF1SprintWeekendEvent && window.TGA.isF1SprintWeekendEvent(e));
      var raceName = String(e.name || e.race || '');
      var track = String(e.circuit_name || e.track || '').toLowerCase();
      var gtwceSpa24Hours = /24\s*hours?\s*of\s*spa/i.test(raceName) ||
        (/crowdstrike/i.test(raceName) && /spa/i.test(raceName) && /24/i.test(raceName)) ||
        (track.indexOf('spa') >= 0 && /24\s*hours?/i.test(raceName));
      var cardOut = {
        event: e,
        dateStr: item.dateStr,
        winners: winners,
        raceWasCancelled: !!sum.race_was_cancelled,
        rangeStart: evStart,
        rangeEnd: evEnd,
        isF1SprintWeekend: isF1SprintWeekend,
        gtwceSpa24Hours: gtwceSpa24Hours
      };
      var raceDates = lastResultsCardRaceDateRange(cardOut);
      if (raceDates.start) cardOut.rangeStart = raceDates.start;
      if (raceDates.end) cardOut.rangeEnd = raceDates.end;
      return cardOut;
    }

    var summaryIds = summaryItems.map(function (item) { return String(item.event.id || ''); });
    var summaryPromise;
    if (summaryIds.length === 0) {
      summaryPromise = Promise.resolve({});
    } else if (API && typeof API.getEventSummaries === 'function') {
      summaryPromise = API.getEventSummaries(summaryIds);
    } else {
      summaryPromise = fetch('/api/events/summaries?ids=' + encodeURIComponent(summaryIds.join(',')))
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        });
    }

    summaryPromise.then(function (byId) {
      byId = byId || {};
      var cards = pendingCards.slice();
      summaryItems.forEach(function (item) {
        var e = item.event;
        var idUpper = String(e.id || '').toUpperCase();
        var sum = byId[idUpper] || byId[String(e.id || '')] || null;
        if (sum && sum.not_found) {
          if (isPastForLastResults(e)) {
            cards.push(cardFromEventSummary(item, { winners: [] }));
          }
          return;
        }
        if (!sum) {
          if (isPastForLastResults(e)) {
            cards.push(cardFromEventSummary(item, { winners: [] }));
          }
          return;
        }
        cards.push(cardFromEventSummary(item, sum));
      });


      if (window.TGA && typeof window.TGA.mergeAllLastResultsWeekendCards === 'function') {
        cards = window.TGA.mergeAllLastResultsWeekendCards(cards);
      } else if (window.TGA && window.TGA.mergeLastResultsWeekendCards) {
        cards = window.TGA.mergeLastResultsWeekendCards(cards, 'SUPER_FORMULA');
        cards = window.TGA.mergeLastResultsWeekendCards(cards, 'SUPERCARS');
        cards = window.TGA.mergeLastResultsWeekendCards(cards, 'PSC');
        cards = window.TGA.mergeLastResultsWeekendCards(cards, 'INDYCAR');
      }

      // Do not show calendar-future. Past/today — only if since the last race day
      // at most 7 days passed (otherwise card "sticks" in feed).
      // Show when finished (start + duration) or winners already loaded.
      cards = cards.filter(function (card) {
        if (!isWithinLastResultsWindowForItem(card)) return false;
        var endIso = cardLastRaceDateIso(card);
        if (!isIsoYMD(endIso)) return false;
        var w = card.winners;
        if (w && w.length > 0) return true;
        return isPastForLastResultsCard(card);
      });

      if (cards.length === 0) {
        container.innerHTML =
          '<div class="lrc-label">' + esc(t('home.last_results') || 'Last Results') + '</div>' +
          '<div class="lrc-empty">' + esc(t('home.no_results') || 'No recent results') + '</div>';
        container.classList.remove('hidden');
        return;
      }

      // Left → right: earlier first race start first (UTC, then calendar date).
      cards.sort(function (a, b) {
        var ka = cardFirstRaceSortKey(a);
        var kb = cardFirstRaceSortKey(b);
        if (ka !== kb) return ka - kb;
        var cmp = window.TGA && window.TGA.compareEventsByFirstRaceStart;
        return cmp ? cmp(a.event, b.event) : 0;
      });

      container.innerHTML =
        '<div class="lrc-label">' + esc(t('home.last_results') || 'Last Results') + '</div>' +
        '<div class="lrc-cards">' +
        cards.map(function (card, idx) {
          var e = card.event;
          var dateDisplay = formatLastResultsCardDate(card);
          var name = (window.TGA.localizeEventFromData || function (d) { return d.name || '—'; })(e);
          var seriesIdUpper = String(e._seriesId || e.series_id || '').toUpperCase();
          var stripPrefix = window.TGA && window.TGA.stripSeriesPrefixFromEventName;
          if (stripPrefix) {
            name = stripPrefix(name, seriesIdUpper) || name;
          }
          // For F2/F3 strip "(Sprint)/(Feature)" from event name — already in labels.
          if (seriesIdUpper === 'F2' || seriesIdUpper === 'F3') {
            name = name.replace(/\s*\((Sprint|Feature)\)\s*$/i, '');
          }
          // For Supercars: "Melbourne SuperSprint Race 1" → "Melbourne SuperSprint".
          if (seriesIdUpper === 'SUPERCARS') {
            name = name.replace(/\s*Race\s*\d+\s*$/i, '');
          }
          var eventSlug = (e.id || '').toLowerCase().replace(/_+/g, '-');
          var seriesSlug = (e._seriesId || e.series_id || '').toLowerCase().replace(/_+/g, '-');
          var eventNameLc = String(e.name || '').toLowerCase();
          // In "Last Results" we should always open the event page.
          // Even when results are pending, the event overview is still valid.
          var href = eventSlug
            ? '/event/' + encodeURIComponent(eventSlug)
            : '/series/' + encodeURIComponent(seriesSlug);
          var delayMs = idx * 55;

          // Additional classes for background images (to be styled in CSS).
          var extraClass = '';
          var circuitName = (e.circuit_name || '').toLowerCase();
          var trackName = (e.track || '').toLowerCase();
          var location = (e.location || '').toLowerCase();
          var trackKey = [circuitName, trackName, location].filter(Boolean).join(' ');
          if (trackKey.indexOf('shanghai international circuit') >= 0) {
            extraClass += ' lrc-card--f1-2026-2';
          }
          if (trackKey.indexOf('las vegas motor speedway') >= 0) {
            extraClass += ' lrc-card--cup-2026-3';
          }
          if (trackKey.indexOf('phoenix raceway') >= 0) {
            // Same background for all series at Phoenix.
            extraClass += ' lrc-card--phoenix';
          }
          if (trackKey.indexOf('darlington raceway') >= 0) {
            extraClass += ' lrc-card--darlington';
          }
          if (trackKey.indexOf('rockingham speedway') >= 0) {
            extraClass += ' lrc-card--rockingham';
          }
          if (trackKey.indexOf('martinsville speedway') >= 0) {
            extraClass += ' lrc-card--martinsville';
          }
          if (trackKey.indexOf('suzuka circuit') >= 0 || trackKey.indexOf('suzuka international') >= 0) {
            extraClass += ' lrc-card--suzuka';
          }
          if (trackKey.indexOf('barber motorsports park') >= 0) {
            extraClass += ' lrc-card--barber';
          }
          if (trackKey.indexOf('sebring international raceway') >= 0) {
            extraClass += ' lrc-card--sebring';
          }
          if (trackKey.indexOf('streets of arlington') >= 0) {
            extraClass += ' lrc-card--indycar-2026-3';
          }
          if (trackKey.indexOf('albert park circuit') >= 0) {
            extraClass += ' lrc-card--albert-park';
          }
          if (trackKey.indexOf('mobility resort motegi') >= 0) {
            extraClass += ' lrc-card--motegi';
          }
          if (trackKey.indexOf('circuit de barcelona-catalunya') >= 0 || trackKey.indexOf('barcelona') >= 0 || trackKey.indexOf('montmelo') >= 0) {
            extraClass += ' lrc-card--barcelona';
          }
          if (trackKey.indexOf('taupo') >= 0) {
            extraClass += ' lrc-card--taupo';
          }
          if (trackKey.indexOf('okayama') >= 0 || trackKey.indexOf('okoyama') >= 0) {
            extraClass += ' lrc-card--okayama';
          }
          if (trackKey.indexOf('paul ricard') >= 0 || trackKey.indexOf('le castellet') >= 0) {
            extraClass += ' lrc-card--paul-ricard';
          }
          if (trackKey.indexOf('thompson') >= 0) {
            extraClass += ' lrc-card--thompson';
          }
          if (trackKey.indexOf('imola') >= 0) {
            extraClass += ' lrc-card--imola';
          }
          if (trackKey.indexOf('echopark speedway') >= 0 || trackKey.indexOf('echo park speedway') >= 0) {
            extraClass += ' lrc-card--echopark-speedway';
          }
          if (trackKey.indexOf('interlagos') >= 0) {
            extraClass += ' lrc-card--interlagos';
          }
          if (trackKey.indexOf('hungaroring') >= 0 || trackKey.indexOf('mogyor') >= 0) {
            extraClass += ' lrc-card--hungaroring';
          }
          if (trackKey.indexOf('north wilkesboro') >= 0) {
            extraClass += ' lrc-card--north-wilkesboro';
          }
          if (trackKey.indexOf('canadian tire motorsport') >= 0 || trackKey.indexOf('mosport') >= 0) {
            extraClass += ' lrc-card--canadian-tire-motorsport-park';
          }
          if (trackKey.indexOf('claremont motorsports') >= 0) {
            extraClass += ' lrc-card--claremont-motorsports-park';
          }
          if (trackKey.indexOf('lime rock') >= 0) {
            extraClass += ' lrc-card--lime-rock';
          }
          if (trackKey.indexOf('magny-cours') >= 0 || trackKey.indexOf('magny cours') >= 0 || trackKey.indexOf('nevers magny') >= 0) {
            extraClass += ' lrc-card--magny-cours';
          }
          if (trackKey.indexOf('wanneroo') >= 0 || trackKey.indexOf('barbagallo') >= 0) {
            extraClass += ' lrc-card--wanneroo-raceway';
          }
          if (trackKey.indexOf('norisring') >= 0) {
            extraClass += ' lrc-card--norisring';
          }
          if (trackKey.indexOf('reid park') >= 0) {
            extraClass += ' lrc-card--reid-park-street-circuit';
          }
          if (trackKey.indexOf('silverstone') >= 0) {
            extraClass += ' lrc-card--silverstone';
          }
          if (trackKey.indexOf('mid-ohio') >= 0 || trackKey.indexOf('mid ohio') >= 0) {
            extraClass += ' lrc-card--mid-ohio';
          }
          if (trackKey.indexOf('chicagoland') >= 0) {
            extraClass += ' lrc-card--chicagoland';
          }
          if (trackKey.indexOf('lucas oil') >= 0 || trackKey.indexOf('indianapolis raceway park') >= 0 || trackKey.indexOf('brownsburg') >= 0) {
            extraClass += ' lrc-card--indianapolis-irp';
          }
          if (trackKey.indexOf('monadnock') >= 0) {
            extraClass += ' lrc-card--monadnock-speedway';
          }
          if (trackKey.indexOf('mugello') >= 0) {
            extraClass += ' lrc-card--mugello';
          }
          if (trackKey.indexOf('oschersleben') >= 0) {
            extraClass += ' lrc-card--oschersleben';
          }
          if (trackKey.indexOf('kansas speedway') >= 0 || trackKey.indexOf('kansas city, kansas') >= 0) {
            extraClass += ' lrc-card--kansas';
          }
          if (trackKey.indexOf('autopolis') >= 0) {
            extraClass += ' lrc-card--autopolis';
          }
          if (trackKey.indexOf('talladega') >= 0) {
            extraClass += ' lrc-card--talladega';
          }
          if (trackKey.indexOf('texas motor speedway') >= 0 || trackKey.indexOf('fort worth') >= 0) {
            extraClass += ' lrc-card--texas';
          }
          if (trackKey.indexOf('brands hatch') >= 0) {
            extraClass += ' lrc-card--brands-hatch';
          }
          if (trackKey.indexOf('oxford plains') >= 0 || trackKey.indexOf('oxford') >= 0) {
            extraClass += ' lrc-card--oxford-plains';
          }
          if (trackKey.indexOf('fuji') >= 0 || trackKey.indexOf('fuji speedway') >= 0) {
            extraClass += ' lrc-card--fuji';
          }
          if (trackKey.indexOf('miami international autodrome') >= 0 || trackKey.indexOf('miami') >= 0) {
            extraClass += ' lrc-card--miami';
          }
          if (trackKey.indexOf('gilles villeneuve') >= 0 || trackKey.indexOf('circuit gilles') >= 0 || trackKey.indexOf('montreal') >= 0) {
            extraClass += ' lrc-card--montreal';
          }
          if (trackKey.indexOf('laguna seca') >= 0 || trackKey.indexOf('weathertech raceway') >= 0 || trackKey.indexOf('monterey') >= 0) {
            extraClass += ' lrc-card--laguna-seca';
          }
          if (trackKey.indexOf('sonoma raceway') >= 0 || (trackKey.indexOf('sonoma') >= 0 && trackKey.indexOf('california') >= 0)) {
            extraClass += ' lrc-card--sonoma-raceway';
          }
          if (trackKey.indexOf('misano world circuit') >= 0 || trackKey.indexOf('circuit marco simoncelli') >= 0) {
            extraClass += ' lrc-card--misano';
          }
          if (trackKey.indexOf('watkins glen') >= 0) {
            extraClass += ' lrc-card--watkins-glen';
          }
          if (trackKey.indexOf('indianapolis motor speedway road') >= 0) {
            extraClass += ' lrc-card--indianapolis-rc';
          } else if (trackKey.indexOf('indianapolis motor speedway') >= 0) {
            extraClass += ' lrc-card--indianapolis-ims';
          }
          if (trackKey.indexOf('spa-francorchamps') >= 0) {
            extraClass += ' lrc-card--spa-francorchamps';
          }
          if (trackKey.indexOf('red bull ring') >= 0 || trackKey.indexOf('spielberg') >= 0) {
            extraClass += ' lrc-card--red-bull-ring';
          }
          if (trackKey.indexOf('long beach') >= 0) {
            extraClass += ' lrc-card--long-beach';
          }
          if (trackKey.indexOf('euromarque') >= 0 || trackKey.indexOf('christchurch') >= 0) {
            extraClass += ' lrc-card--euromarque';
          }
          if (trackKey.indexOf('dover motor speedway') >= 0 || (trackKey.indexOf('dover') >= 0 && trackKey.indexOf('delaware') >= 0)) {
            extraClass += ' lrc-card--dover';
          }
          if (trackKey.indexOf('seekonk') >= 0) {
            extraClass += ' lrc-card--seekonk';
          }
          if (trackKey.indexOf('moscow raceway') >= 0) {
            extraClass += ' lrc-card--moscow-raceway';
          }
          if (trackKey.indexOf('toledo speedway') >= 0) {
            extraClass += ' lrc-card--toledo';
          }
          if (trackKey.indexOf('charlotte motor speedway') >= 0) {
            extraClass += ' lrc-card--charlotte';
          }
          if (trackKey.indexOf('circuit zandvoort') >= 0 || trackKey.indexOf('zandvoort') >= 0) {
            extraClass += ' lrc-card--zandvoort';
          }
          if (trackKey.indexOf('vallelunga') >= 0) {
            extraClass += ' lrc-card--vallelunga';
          }
          if (trackKey.indexOf('symmons plains') >= 0) {
            extraClass += ' lrc-card--symmons-plains';
          }
          if (trackKey.indexOf('monaco') >= 0) {
            extraClass += ' lrc-card--monaco';
          }
          if (trackKey.indexOf('monza') >= 0) {
            extraClass += ' lrc-card--monza';
          }
          if (trackKey.indexOf('michigan international speedway') >= 0 || trackKey.indexOf('michigan speedway') >= 0) {
            extraClass += ' lrc-card--michigan';
          }
          if (trackKey.indexOf('nashville superspeedway') >= 0) {
            extraClass += ' lrc-card--nashville-superspeedway';
          }
          if (trackKey.indexOf('riverhead raceway') >= 0) {
            extraClass += ' lrc-card--riverhead-raceway';
          }
          if (trackKey.indexOf('streets of detroit') >= 0) {
            extraClass += ' lrc-card--streets-of-detroit';
          }
          if (trackKey.indexOf('world wide technology raceway') >= 0) {
            extraClass += ' lrc-card--world-wide-technology-raceway';
          }
          if (trackKey.indexOf('kazan ring') >= 0 || trackKey.indexOf('kazan') >= 0) {
            extraClass += ' lrc-card--kazan-ring';
          }
          if (trackKey.indexOf('circuit de la sarthe') >= 0 || (
            trackKey.indexOf('le mans') >= 0 && trackKey.indexOf('lone star') < 0 && trackKey.indexOf('austin') < 0
          )) {
            extraClass += ' lrc-card--circuit-de-la-sarthe';
          }
          if (trackKey.indexOf('road america') >= 0) {
            extraClass += ' lrc-card--road-america';
          }
          if (trackKey.indexOf('white mountain') >= 0) {
            extraClass += ' lrc-card--white-mountain-motorsports-park';
          }
          if (trackKey.indexOf('berlin raceway') >= 0) {
            extraClass += ' lrc-card--berlin-raceway';
          }
          if (trackKey.indexOf('elko speedway') >= 0 || (trackKey.indexOf('elko') >= 0 && trackKey.indexOf('minnesota') >= 0)) {
            extraClass += ' lrc-card--elko-speedway';
          }
          if (trackKey.indexOf('lausitzring') >= 0 || trackKey.indexOf('lausitz') >= 0) {
            extraClass += ' lrc-card--lausitzring';
          }
          if (trackKey.indexOf('hidden valley') >= 0) {
            extraClass += ' lrc-card--hidden-valley-raceway';
          }
          if (trackKey.indexOf('sepang') >= 0) {
            extraClass += ' lrc-card--sepang';
          }
          if (trackKey.indexOf('coronado') >= 0) {
            extraClass += ' lrc-card--coronado-street';
          }
          if (trackKey.indexOf('silverstone') >= 0) {
            extraClass += ' lrc-card--silverstone';
          }
          if (trackKey.indexOf('mid-ohio') >= 0 || trackKey.indexOf('mid ohio') >= 0) {
            extraClass += ' lrc-card--mid-ohio';
          }
          if (trackKey.indexOf('chicagoland') >= 0) {
            extraClass += ' lrc-card--chicagoland';
          }
          if (trackKey.indexOf('lucas oil') >= 0 || trackKey.indexOf('indianapolis raceway park') >= 0 || trackKey.indexOf('brownsburg') >= 0) {
            extraClass += ' lrc-card--indianapolis-irp';
          }
          if (trackKey.indexOf('monadnock') >= 0) {
            extraClass += ' lrc-card--monadnock-speedway';
          }
          if (trackKey.indexOf('mugello') >= 0) {
            extraClass += ' lrc-card--mugello';
          }
          if (trackKey.indexOf('oschersleben') >= 0) {
            extraClass += ' lrc-card--oschersleben';
          }
          if (eventNameLc.indexOf('taupo') >= 0 || eventNameLc.indexOf('taupō') >= 0) {
            extraClass += ' lrc-card--taupo';
          }
          if (eventNameLc.indexOf('okayama') >= 0 || eventNameLc.indexOf('okoyama') >= 0) {
            extraClass += ' lrc-card--okayama';
          }
          if (eventNameLc.indexOf('paul ricard') >= 0 || eventNameLc.indexOf('le castellet') >= 0) {
            extraClass += ' lrc-card--paul-ricard';
          }
          if (eventNameLc.indexOf('thompson') >= 0) {
            extraClass += ' lrc-card--thompson';
          }
          if (eventNameLc.indexOf('imola') >= 0) {
            extraClass += ' lrc-card--imola';
          }
          if (eventNameLc.indexOf('echopark') >= 0 || eventNameLc.indexOf('echo park') >= 0) {
            extraClass += ' lrc-card--echopark-speedway';
          }
          if (eventNameLc.indexOf('interlagos') >= 0 || eventNameLc.indexOf('são paulo grand prix') >= 0) {
            extraClass += ' lrc-card--interlagos';
          }
          if (eventNameLc.indexOf('hungaroring') >= 0 || eventNameLc.indexOf('hungarian grand prix') >= 0) {
            extraClass += ' lrc-card--hungaroring';
          }
          if (eventNameLc.indexOf('north wilkesboro') >= 0 || eventNameLc.indexOf('window world 450') >= 0) {
            extraClass += ' lrc-card--north-wilkesboro';
          }
          if (eventNameLc.indexOf('canadian tire motorsport') >= 0 || eventNameLc.indexOf('mosport') >= 0) {
            extraClass += ' lrc-card--canadian-tire-motorsport-park';
          }
          if (eventNameLc.indexOf('claremont motorsports') >= 0) {
            extraClass += ' lrc-card--claremont-motorsports-park';
          }
          if (eventNameLc.indexOf('lime rock') >= 0) {
            extraClass += ' lrc-card--lime-rock';
          }
          if (eventNameLc.indexOf('magny-cours') >= 0 || eventNameLc.indexOf('magny cours') >= 0) {
            extraClass += ' lrc-card--magny-cours';
          }
          if (eventNameLc.indexOf('wanneroo') >= 0 || eventNameLc.indexOf('perth super') >= 0) {
            extraClass += ' lrc-card--wanneroo-raceway';
          }
          if (eventNameLc.indexOf('norisring') >= 0) {
            extraClass += ' lrc-card--norisring';
          }
          if (eventNameLc.indexOf('reid park') >= 0) {
            extraClass += ' lrc-card--reid-park-street-circuit';
          }
          if (eventNameLc.indexOf('kansas') >= 0) {
            extraClass += ' lrc-card--kansas';
          }
          if (eventNameLc.indexOf('autopolis') >= 0) {
            extraClass += ' lrc-card--autopolis';
          }
          if (eventNameLc.indexOf('talladega') >= 0) {
            extraClass += ' lrc-card--talladega';
          }
          if (eventNameLc.indexOf('texas') >= 0 || eventNameLc.indexOf('fort worth') >= 0) {
            extraClass += ' lrc-card--texas';
          }
          if (eventNameLc.indexOf('brands hatch') >= 0) {
            extraClass += ' lrc-card--brands-hatch';
          }
          if (eventNameLc.indexOf('oxford plains') >= 0 || eventNameLc.indexOf('oxford') >= 0) {
            extraClass += ' lrc-card--oxford-plains';
          }
          if (eventNameLc.indexOf('fuji') >= 0) {
            extraClass += ' lrc-card--fuji';
          }
          if (eventNameLc.indexOf('miami') >= 0) {
            extraClass += ' lrc-card--miami';
          }
          if (eventNameLc.indexOf('gilles villeneuve') >= 0 || eventNameLc.indexOf('montreal') >= 0 || eventNameLc.indexOf('canadian grand prix') >= 0) {
            extraClass += ' lrc-card--montreal';
          }
          if (eventNameLc.indexOf('laguna seca') >= 0 || eventNameLc.indexOf('weathertech raceway') >= 0 || eventNameLc.indexOf('monterey') >= 0) {
            extraClass += ' lrc-card--laguna-seca';
          }
          if (eventNameLc.indexOf('sonoma raceway') >= 0 || eventNameLc.indexOf('save mart 350') >= 0 || eventNameLc.indexOf('toyota/save mart') >= 0) {
            extraClass += ' lrc-card--sonoma-raceway';
          }
          if (eventNameLc.indexOf('misano') >= 0 && (
            eventNameLc.indexOf('marco simoncelli') >= 0 ||
            eventNameLc.indexOf('italian f4') >= 0 ||
            eventNameLc.indexOf('gt world challenge') >= 0
          )) {
            extraClass += ' lrc-card--misano';
          }
          if (eventNameLc.indexOf('watkins glen') >= 0) {
            extraClass += ' lrc-card--watkins-glen';
          }
          if (eventNameLc.indexOf('sonsio grand prix') >= 0) {
            extraClass += ' lrc-card--indianapolis-rc';
          }
          if (eventNameLc.indexOf('indianapolis 500') >= 0 || eventNameLc.indexOf('brickyard 400') >= 0 || eventNameLc.indexOf('battle on the bricks') >= 0) {
            extraClass += ' lrc-card--indianapolis-ims';
          }
          if (eventNameLc.indexOf('spa-francorchamps') >= 0 || (
            eventNameLc.indexOf('crowdstrike') >= 0 && eventNameLc.indexOf('spa') >= 0
          )) {
            extraClass += ' lrc-card--spa-francorchamps';
          }
          if (eventNameLc.indexOf('red bull ring') >= 0 || eventNameLc.indexOf('spielberg') >= 0) {
            extraClass += ' lrc-card--red-bull-ring';
          }
          if (eventNameLc.indexOf('long beach') >= 0) {
            extraClass += ' lrc-card--long-beach';
          }
          if (eventNameLc.indexOf('euromarque') >= 0) {
            extraClass += ' lrc-card--euromarque';
          }
          if (eventNameLc.indexOf('dover motor speedway') >= 0) {
            extraClass += ' lrc-card--dover';
          }
          if (eventNameLc.indexOf('seekonk') >= 0) {
            extraClass += ' lrc-card--seekonk';
          }
          if (eventNameLc.indexOf('moscow raceway') >= 0 || (eventNameLc.indexOf('smp f4') >= 0 && eventNameLc.indexOf('moscow') >= 0)) {
            extraClass += ' lrc-card--moscow-raceway';
          }
          if (eventNameLc.indexOf('toledo speedway') >= 0) {
            extraClass += ' lrc-card--toledo';
          }
          if (eventNameLc.indexOf('charlotte motor speedway') >= 0 || eventNameLc.indexOf('coca-cola 600') >= 0) {
            extraClass += ' lrc-card--charlotte';
          }
          if (eventNameLc.indexOf('zandvoort') >= 0 || eventNameLc.indexOf('dutch grand prix') >= 0) {
            extraClass += ' lrc-card--zandvoort';
          }
          if (eventNameLc.indexOf('vallelunga') >= 0) {
            extraClass += ' lrc-card--vallelunga';
          }
          if (eventNameLc.indexOf('symmons plains') >= 0) {
            extraClass += ' lrc-card--symmons-plains';
          }
          if (eventNameLc.indexOf('monaco') >= 0 || eventNameLc.indexOf('monte carlo') >= 0) {
            extraClass += ' lrc-card--monaco';
          }
          if (eventNameLc.indexOf('monza') >= 0 || eventNameLc.indexOf('italian grand prix') >= 0) {
            extraClass += ' lrc-card--monza';
          }
          if (eventNameLc.indexOf('michigan') >= 0) {
            extraClass += ' lrc-card--michigan';
          }
          if (eventNameLc.indexOf('nashville superspeedway') >= 0) {
            extraClass += ' lrc-card--nashville-superspeedway';
          }
          if (eventNameLc.indexOf('riverhead') >= 0) {
            extraClass += ' lrc-card--riverhead-raceway';
          }
          if (eventNameLc.indexOf('detroit') >= 0) {
            extraClass += ' lrc-card--streets-of-detroit';
          }
          if (eventNameLc.indexOf('world wide technology') >= 0) {
            extraClass += ' lrc-card--world-wide-technology-raceway';
          }
          if (eventNameLc.indexOf('pocono') >= 0) {
            extraClass += ' lrc-card--pocono';
          }
          if (eventNameLc.indexOf('kazan') >= 0) {
            extraClass += ' lrc-card--kazan-ring';
          }
          if (eventNameLc.indexOf('24 hours of le mans') >= 0 || eventNameLc.indexOf('hours of le mans') >= 0) {
            extraClass += ' lrc-card--circuit-de-la-sarthe';
          }
          if (eventNameLc.indexOf('road america') >= 0) {
            extraClass += ' lrc-card--road-america';
          }
          if (eventNameLc.indexOf('white mountain') >= 0) {
            extraClass += ' lrc-card--white-mountain-motorsports-park';
          }
          if (eventNameLc.indexOf('berlin raceway') >= 0) {
            extraClass += ' lrc-card--berlin-raceway';
          }
          if (eventNameLc.indexOf('elko speedway') >= 0 || eventNameLc.indexOf('shore lunch') >= 0) {
            extraClass += ' lrc-card--elko-speedway';
          }
          if (eventNameLc.indexOf('lausitzring') >= 0 || eventNameLc.indexOf('lausitz') >= 0) {
            extraClass += ' lrc-card--lausitzring';
          }
          if (eventNameLc.indexOf('hidden valley') >= 0) {
            extraClass += ' lrc-card--hidden-valley-raceway';
          }
          if (eventNameLc.indexOf('sepang') >= 0) {
            extraClass += ' lrc-card--sepang';
          }
          if (eventNameLc.indexOf('coronado') >= 0) {
            extraClass += ' lrc-card--coronado-street';
          }
          if (eventNameLc.indexOf('silverstone') >= 0) {
            extraClass += ' lrc-card--silverstone';
          }
          if (eventNameLc.indexOf('mid-ohio') >= 0 || eventNameLc.indexOf('mid ohio') >= 0) {
            extraClass += ' lrc-card--mid-ohio';
          }
          if (eventNameLc.indexOf('chicagoland') >= 0) {
            extraClass += ' lrc-card--chicagoland';
          }
          if (eventNameLc.indexOf('lucas oil') >= 0 || eventNameLc.indexOf('indianapolis raceway park') >= 0) {
            extraClass += ' lrc-card--indianapolis-irp';
          }
          if (eventNameLc.indexOf('monadnock') >= 0) {
            extraClass += ' lrc-card--monadnock-speedway';
          }
          if (eventNameLc.indexOf('mugello') >= 0) {
            extraClass += ' lrc-card--mugello';
          }
          if (eventNameLc.indexOf('oschersleben') >= 0) {
            extraClass += ' lrc-card--oschersleben';
          }
          if (trackKey.indexOf('pocono raceway') >= 0) {
            extraClass += ' lrc-card--pocono';
          }
          if (trackKey.indexOf('bristol') >= 0) {
            extraClass += ' lrc-card--bristol';
          }
          if (!extraClass) {
            if (eventSlug === 'f1-2026-2') {
              extraClass += ' lrc-card--f1-2026-2';
            } else if (eventSlug === 'nascar-cup-2026-5' || eventSlug === 'cup-2026-5' || eventSlug === 'noaps-2026-5') {
              extraClass += ' lrc-card--cup-2026-3';
            } else if (eventSlug === 'indycar-2026-3') {
              extraClass += ' lrc-card--indycar-2026-3';
            } else if (eventSlug === 'super-formula-2026-1') {
              extraClass += ' lrc-card--motegi';
            } else if (eventSlug === 'elms-2026-prologue') {
              extraClass += ' lrc-card--barcelona';
            } else if (eventSlug.indexOf('taupo') >= 0) {
              extraClass += ' lrc-card--taupo';
            } else if (eventSlug.indexOf('bristol') >= 0) {
              extraClass += ' lrc-card--bristol';
            } else if (eventSlug.indexOf('okayama') >= 0 || eventSlug.indexOf('okoyama') >= 0) {
              extraClass += ' lrc-card--okayama';
            } else if (eventSlug.indexOf('ricard') >= 0 || eventSlug.indexOf('le-castellet') >= 0) {
              extraClass += ' lrc-card--paul-ricard';
            } else if (eventSlug.indexOf('thompson') >= 0) {
              extraClass += ' lrc-card--thompson';
            } else if (eventSlug.indexOf('imola') >= 0) {
              extraClass += ' lrc-card--imola';
            } else if (eventSlug.indexOf('echopark') >= 0 || eventSlug.indexOf('echo-park') >= 0) {
              extraClass += ' lrc-card--echopark-speedway';
            } else if (eventSlug.indexOf('interlagos') >= 0 || eventSlug.indexOf('sao-paulo') >= 0) {
              extraClass += ' lrc-card--interlagos';
            } else if (eventSlug.indexOf('hungaroring') >= 0 || eventSlug.indexOf('hungarian') >= 0) {
              extraClass += ' lrc-card--hungaroring';
            } else if (eventSlug.indexOf('north-wilkesboro') >= 0 || eventSlug.indexOf('wilkesboro') >= 0) {
              extraClass += ' lrc-card--north-wilkesboro';
            } else if (eventSlug.indexOf('canadian-tire') >= 0 || eventSlug.indexOf('mosport') >= 0) {
              extraClass += ' lrc-card--canadian-tire-motorsport-park';
            } else if (eventSlug.indexOf('claremont') >= 0) {
              extraClass += ' lrc-card--claremont-motorsports-park';
            } else if (eventSlug.indexOf('lime-rock') >= 0 || eventSlug.indexOf('lime_rock') >= 0) {
              extraClass += ' lrc-card--lime-rock';
            } else if (eventSlug.indexOf('magny-cours') >= 0 || eventSlug.indexOf('magny_cours') >= 0) {
              extraClass += ' lrc-card--magny-cours';
            } else if (eventSlug.indexOf('wanneroo') >= 0 || eventSlug.indexOf('perth') >= 0) {
              extraClass += ' lrc-card--wanneroo-raceway';
            } else if (eventSlug.indexOf('norisring') >= 0) {
              extraClass += ' lrc-card--norisring';
            } else if (eventSlug.indexOf('reid-park') >= 0 || eventSlug.indexOf('reid_park') >= 0) {
              extraClass += ' lrc-card--reid-park-street-circuit';
            } else if (eventSlug.indexOf('silverstone') >= 0) {
              extraClass += ' lrc-card--silverstone';
            } else if (eventSlug.indexOf('mid-ohio') >= 0 || eventSlug.indexOf('mid_ohio') >= 0) {
              extraClass += ' lrc-card--mid-ohio';
            } else if (eventSlug.indexOf('chicagoland') >= 0) {
              extraClass += ' lrc-card--chicagoland';
            } else if (eventSlug.indexOf('irp') >= 0 || eventSlug.indexOf('lucas-oil') >= 0) {
              extraClass += ' lrc-card--indianapolis-irp';
            } else if (eventSlug.indexOf('monadnock') >= 0) {
              extraClass += ' lrc-card--monadnock-speedway';
            } else if (eventSlug.indexOf('mugello') >= 0) {
              extraClass += ' lrc-card--mugello';
            } else if (eventSlug.indexOf('oschersleben') >= 0) {
              extraClass += ' lrc-card--oschersleben';
            } else if (eventSlug.indexOf('kansas') >= 0) {
              extraClass += ' lrc-card--kansas';
            } else if (eventSlug.indexOf('autopolis') >= 0) {
              extraClass += ' lrc-card--autopolis';
            } else if (eventSlug.indexOf('talladega') >= 0) {
              extraClass += ' lrc-card--talladega';
            } else if (eventSlug.indexOf('texas') >= 0 || eventSlug.indexOf('fort-worth') >= 0 || eventSlug.indexOf('fort_worth') >= 0) {
              extraClass += ' lrc-card--texas';
            } else if (eventSlug.indexOf('brands-hatch') >= 0 || eventSlug.indexOf('brands_hatch') >= 0) {
              extraClass += ' lrc-card--brands-hatch';
            } else if (eventSlug.indexOf('oxford-plains') >= 0 || eventSlug.indexOf('oxford_plains') >= 0 || eventSlug.indexOf('oxford') >= 0) {
              extraClass += ' lrc-card--oxford-plains';
            } else if (eventSlug.indexOf('fuji') >= 0) {
              extraClass += ' lrc-card--fuji';
            } else if (eventSlug.indexOf('miami') >= 0) {
              extraClass += ' lrc-card--miami';
            } else if (eventSlug.indexOf('montreal') >= 0 || eventSlug.indexOf('gilles-villeneuve') >= 0 || eventSlug.indexOf('gilles_villeneuve') >= 0 || eventSlug === 'f2-2026-3' || eventSlug === 'f1-2026-7') {
              extraClass += ' lrc-card--montreal';
            } else if (eventSlug.indexOf('laguna-seca') >= 0 || eventSlug.indexOf('laguna_seca') >= 0 || eventSlug.indexOf('monterey') >= 0) {
              extraClass += ' lrc-card--laguna-seca';
            } else if (eventSlug.indexOf('sonoma') >= 0 || eventSlug === 'nascar-cup-2026-18') {
              extraClass += ' lrc-card--sonoma-raceway';
            } else if (eventSlug.indexOf('elko') >= 0 || eventSlug === 'arca-2026-10') {
              extraClass += ' lrc-card--elko-speedway';
            } else if (
              eventSlug === 'gtwce-sprint-2026-2' ||
              eventSlug === 'f4-it-2026-1' ||
              eventSlug === 'f4-it-2026-6' ||
              eventSlug.indexOf('misano') >= 0
            ) {
              extraClass += ' lrc-card--misano';
            } else if (eventSlug.indexOf('watkins') >= 0 || eventSlug.indexOf('watkins-glen') >= 0) {
              extraClass += ' lrc-card--watkins-glen';
            } else if (eventSlug === 'indycar-2026-6') {
              extraClass += ' lrc-card--indianapolis-rc';
            } else if (eventSlug === 'indycar-2026-7' || eventSlug.indexOf('imsa-2026-10') >= 0) {
              extraClass += ' lrc-card--indianapolis-ims';
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
              extraClass += ' lrc-card--spa-francorchamps';
            } else if (eventSlug.indexOf('red-bull-ring') >= 0 || eventSlug.indexOf('red_bull_ring') >= 0 || eventSlug.indexOf('spielberg') >= 0) {
              extraClass += ' lrc-card--red-bull-ring';
            } else if (eventSlug.indexOf('long-beach') >= 0 || eventSlug.indexOf('long_beach') >= 0) {
              extraClass += ' lrc-card--long-beach';
            } else if (eventSlug.indexOf('euromarque') >= 0) {
              extraClass += ' lrc-card--euromarque';
            } else if (eventSlug.indexOf('dover') >= 0 || eventSlug.indexOf('allstar') >= 0 || eventSlug.indexOf('all-star') >= 0) {
              extraClass += ' lrc-card--dover';
            } else if (eventSlug.indexOf('seekonk') >= 0) {
              extraClass += ' lrc-card--seekonk';
            } else if (eventSlug.indexOf('moscow-raceway') >= 0 || eventSlug.indexOf('moscow_raceway') >= 0 || (eventSlug.indexOf('smp-f4') >= 0 && eventSlug.indexOf('moscow') >= 0)) {
              extraClass += ' lrc-card--moscow-raceway';
            } else if (eventSlug.indexOf('toledo-speedway') >= 0 || eventSlug.indexOf('toledo_speedway') >= 0 || eventSlug.indexOf('toledo') >= 0) {
              extraClass += ' lrc-card--toledo';
            } else if (eventSlug.indexOf('charlotte') >= 0) {
              extraClass += ' lrc-card--charlotte';
            } else if (eventSlug.indexOf('zandvoort') >= 0) {
              extraClass += ' lrc-card--zandvoort';
            } else if (eventSlug.indexOf('vallelunga') >= 0) {
              extraClass += ' lrc-card--vallelunga';
            } else if (eventSlug.indexOf('symmons-plains') >= 0 || eventSlug.indexOf('symmons_plains') >= 0 || eventSlug.indexOf('symmons') >= 0) {
              extraClass += ' lrc-card--symmons-plains';
            } else if (eventSlug.indexOf('brickyard') >= 0 || (eventSlug.indexOf('indianapolis') >= 0 && eventSlug.indexOf('indycar-2026-6') < 0)) {
              extraClass += ' lrc-card--indianapolis-ims';
            } else if (eventSlug.indexOf('monaco') >= 0) {
              extraClass += ' lrc-card--monaco';
            } else if (eventSlug.indexOf('monza') >= 0) {
              extraClass += ' lrc-card--monza';
            } else if (eventSlug.indexOf('michigan') >= 0) {
              extraClass += ' lrc-card--michigan';
            } else if (eventSlug.indexOf('nashville') >= 0) {
              extraClass += ' lrc-card--nashville-superspeedway';
            } else if (eventSlug.indexOf('riverhead') >= 0) {
              extraClass += ' lrc-card--riverhead-raceway';
            } else if (eventSlug.indexOf('detroit') >= 0) {
              extraClass += ' lrc-card--streets-of-detroit';
            } else if (eventSlug.indexOf('world-wide-technology') >= 0 || eventSlug.indexOf('wwtr') >= 0) {
              extraClass += ' lrc-card--world-wide-technology-raceway';
            } else if (eventSlug.indexOf('pocono') >= 0) {
              extraClass += ' lrc-card--pocono';
            } else if (eventSlug.indexOf('kazan') >= 0) {
              extraClass += ' lrc-card--kazan-ring';
            } else if (
              eventSlug === 'wec-2026-3' ||
              (eventSlug.indexOf('le-mans') >= 0 &&
                eventSlug.indexOf('lone-star') < 0 &&
                eventSlug.indexOf('cota') < 0)
            ) {
              extraClass += ' lrc-card--circuit-de-la-sarthe';
            }
          }

          if (extraClass) {
            extraClass += ' race-card-photo';
          }

          // Extra classes by series (for F2/F3 winner styling).
          if (seriesIdUpper === 'F2') {
            extraClass += ' lrc-card--f2';
          } else if (seriesIdUpper === 'F3') {
            extraClass += ' lrc-card--f3';
          } else if (seriesIdUpper === 'SUPERCARS') {
            extraClass += ' lrc-card--supercars';
          } else if (seriesIdUpper === 'FREC' || seriesIdUpper === 'F4_IT') {
            extraClass += ' lrc-card--frec';
            if (seriesIdUpper === 'F4_IT') extraClass += ' lrc-card--f4';
          } else if (seriesIdUpper === 'IMSA') {
            extraClass += ' lrc-card--imsa';
          } else if (seriesIdUpper === 'WEC') {
            extraClass += ' lrc-card--wec';
          } else if (seriesIdUpper === 'ELMS') {
            extraClass += ' lrc-card--elms';
          } else if (seriesIdUpper === 'GTWCE_END' || seriesIdUpper === 'GTWCE_SPRINT') {
            extraClass += ' lrc-card--gtwce';
            if (card.gtwceSpa24Hours) extraClass += ' lrc-card--gtwce-spa24';
          } else if (seriesIdUpper === 'SUPER_GT') {
            extraClass += ' lrc-card--super-gt';
          }

          // Winners: for regular events show one row,
          // for F2/F3 and Supercars — winners of all weekend races (within reasonable limit).
          var winnerHtml = '';
          var list = Array.isArray(card.winners) ? card.winners : [];
          if (list.length > 0) {
            if (seriesIdUpper === 'IMSA') {
              // IMSA: show class winners (up to 4 lines).
              winnerHtml = list.slice(0, 4).map(function (w) {
                var line = winnerTeamLabel(w.name || '');
                if (w.car) line = '#' + w.car + ' ' + line;
                var label = localizeWinnerCardLabel((w.label || '').trim());
                if (label) line = line + ' — ' + label;
                return esc(line);
              }).join('<br>');
            } else if (seriesIdUpper === 'WEC') {
              // WEC: "class — crew" (Hypercar / LMP2 / LMGT3).
              winnerHtml = list.slice(0, 4).map(function (w) {
                var crew = winnerTeamLabel(w.name || '');
                if (w.car) crew = '#' + w.car + ' ' + crew;
                var label = localizeWinnerCardLabel((w.label || '').trim());
                var line = label ? label + ' — ' + crew : crew;
                return '<span class="lrc-winner-line">' + esc(line) + '</span>';
              }).join('');
            } else if (seriesIdUpper === 'ELMS') {
              // ELMS: class winners — «Label - Team #no» (.lrc-winner-line — display:block).
              winnerHtml = list.slice(0, 4).map(function (w) {
                var line = winnerTeamLabel(w.name || '');
                if (w.car) line = line + ' #' + w.car;
                var label = localizeWinnerCardLabel((w.label || '').trim());
                if (label) line = label + ' - ' + line;
                return '<span class="lrc-winner-line">' + esc(line) + '</span>';
              }).join('');
            } else if (seriesIdUpper === 'GTWCE_END') {
              // GTWCE Endurance: "Label - #no Team" (crew = number + team).
              var gtwceWinnerLimit = card.gtwceSpa24Hours ? 5 : 4;
              winnerHtml = list.slice(0, gtwceWinnerLimit).map(function (w) {
                var crew = winnerTeamLabel(w.name || '');
                var line = w.car ? '#' + w.car + ' ' + crew : crew;
                var label = localizeWinnerCardLabel((w.label || '').trim());
                if (label) line = label + ' - ' + line;
                return '<span class="lrc-winner-line">' + esc(line) + '</span>';
              }).join('');
            } else if (seriesIdUpper === 'GTWCE_SPRINT') {
              // GTWCE Sprint: absolute Race 1 / Race 2 winners only — team and # (no driver names).
              winnerHtml = list.slice(0, 2).map(function (w) {
                var line = winnerTeamLabel(w.name || '');
                if (w.car) line = line + ' #' + w.car;
                var label = localizeWinnerCardLabel((w.label || '').trim());
                if (label) line = label + ' - ' + line;
                return '<span class="lrc-winner-line">' + esc(line) + '</span>';
              }).join('');
            } else if (seriesIdUpper === 'FREC' || seriesIdUpper === 'F4_IT') {
              // FREC / Italian F4: compact lines for R1–R3 (+ Final for F4).
              var f4MaxWinners = seriesIdUpper === 'F4_IT' ? 4 : 3;
              winnerHtml = list.slice(0, f4MaxWinners).map(function (w) {
                var line = winnerDriverLabel(w.name || '');
                if (w.car) line = '#' + w.car + ' ' + line;
                var rawLabel = String(w.label || '').trim();
                var rm = rawLabel.match(/race\s*(\d+)/i);
                var label = rm && rm[1] ? ('R' + rm[1]) : localizeWinnerCardLabel(rawLabel);
                if (/^final/i.test(rawLabel)) label = 'Final';
                if (label) line = label + ': ' + line;
                return esc(line);
              }).join('<br>');
            } else if (seriesIdUpper === 'F1' && card.isF1SprintWeekend) {
              // F1 sprint weekends only: "Sprint - #1 …" / "Feature - #12 …".
              winnerHtml = list.slice(0, 4).map(function (w) {
                var label = localizeWinnerCardLabel((w.label || '').trim());
                var line = winnerDriverLabel(w.name || '');
                if (w.car) line = '#' + w.car + ' ' + line;
                if (label) line = label + ' - ' + line;
                return esc(line);
              }).join('<br>');
            } else if (seriesIdUpper === 'F1' || seriesIdUpper === 'F2' || seriesIdUpper === 'F3' || seriesIdUpper === 'SUPERCARS' || seriesIdUpper === 'SUPER_FORMULA' || seriesIdUpper === 'SUPER_GT' || seriesIdUpper === 'DTM' || seriesIdUpper === 'PSC' || seriesIdUpper === 'INDYCAR') {
              // F1/F2/F3: usually Sprint / Feature / Race. Supercars/PSC/IndyCar: weekend races.
              // Super GT: two winners by class (GT500 + GT300). DTM: Race 1 + Race 2.
              // Limit to first four so card does not grow too large.
              winnerHtml = list.slice(0, 4).map(function (w) {
                var label = localizeWinnerCardLabel((w.label || '').trim());
                var line = winnerDriverLabel(w.name || '');
                if (w.car) {
                  line = '#' + w.car + ' ' + line;
                }
                if (label) {
                  line = label + ' — ' + line;
                }
                return esc(line);
              }).join('<br>');
            } else if (list.length === 1) {
              var w1 = list[0] || {};
              var line1 = winnerDriverLabel(w1.name || '');
              if (w1.car) {
                line1 = '#' + w1.car + ' ' + line1;
              }
              winnerHtml = esc(line1);
            }
          }

          var noDataYet = !winnerHtml;
          var eventIdUpper = String(e.id || '').toUpperCase();
          var isPrologueOrPreSeason =
            eventIdUpper.indexOf('PROLOGUE') >= 0 ||
            eventIdUpper.indexOf('PRE_SEASON_TEST') >= 0 ||
            /\bprologue\b/i.test(String(name || ''));
          var pendingHtml = noDataYet
            ? (isPrologueOrPreSeason
              ? ''
              : '<div class="lrc-winner lrc-winner--pending">' + esc(card.raceWasCancelled ? t('home.race_cancelled') : (t('home.awaiting_results') || 'Results pending')) + '</div>')
            : '';

          return (
            '<a href="' + href + '" class="lrc-card lrc-card-enter' + ((noDataYet && !isPrologueOrPreSeason) ? ' lrc-card--pending' : '') + extraClass + '" style="animation-delay:' + delayMs + 'ms">' +
              '<div class="lrc-top">' +
                seriesBadge(e._seriesId || e.series_id || '') +
                '<span class="lrc-date">' + esc(dateDisplay) + '</span>' +
              '</div>' +
              '<div class="lrc-name">' + esc(name) + '</div>' +
              (winnerHtml ? '<div class="lrc-winner">' + winnerHtml + '</div>' : pendingHtml) +
            '</a>'
          );
        }).join('') +
        '</div>';

      container.classList.remove('hidden');
    }).catch(function () {
      container.innerHTML =
        '<div class="lrc-label">' + esc(t('home.last_results') || 'Last Results') + '</div>' +
        '<div class="lrc-empty">' + esc(t('home.no_results') || 'No recent results') + '</div>';
      container.classList.remove('hidden');
    });
  }

  window.TGA.renderLastResultsCards = renderLastResultsCards;
})();