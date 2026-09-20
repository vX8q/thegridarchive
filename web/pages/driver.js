// web/pages/driver.js — driver profile career tabs (Results / Teams / Achievements / Titles)
(function () {
  'use strict';
  window.TGA = window.TGA || {};

  var TAB_RESULTS = 'results';
  var TAB_TEAMS = 'teams';
  var TAB_ACHIEVEMENTS = 'achievements';
  var TAB_TITLES = 'titles';
  var VALID_TABS = {};
  VALID_TABS[TAB_RESULTS] = true;
  VALID_TABS[TAB_TEAMS] = true;
  VALID_TABS[TAB_ACHIEVEMENTS] = true;
  VALID_TABS[TAB_TITLES] = true;

  function t(key) {
    return (window.TGA.t || function (k) { return k; })(key);
  }
  function esc(s) {
    return (window.TGA.esc || function (x) { return String(x == null ? '' : x); })(s);
  }
  function getLang() {
    return (window.TGA.getLang || function () { return 'en'; })();
  }

  function honorLabel(item) {
    if (!item) return '';
    if (getLang() === 'ru' && item.label_ru && String(item.label_ru).trim()) {
      return String(item.label_ru).trim();
    }
    return String(item.label || '').trim();
  }

  function eventHref(eventId) {
    if (!eventId) return '';
    return '/event/' + encodeURIComponent(String(eventId).toLowerCase().replace(/_/g, '-'));
  }

  function parseCareerTab() {
    var hash = String((window.location && window.location.hash) || '').replace(/^#/, '').toLowerCase();
    if (VALID_TABS[hash]) return hash;
    return TAB_RESULTS;
  }

  function setCareerHash(tab) {
    if (!VALID_TABS[tab]) tab = TAB_RESULTS;
    var path = window.location.pathname + (window.location.search || '');
    var next = tab === TAB_RESULTS ? path : path + '#' + tab;
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', next);
    }
  }

  function pickDefaultSeason(data, career) {
    var current = String((data && data.season) || '').trim();
    var available = (data && Array.isArray(data.available_seasons)) ? data.available_seasons.slice() : [];
    if (!available.length) {
      var seen = {};
      (career || []).forEach(function (r) {
        var s = r && String(r.season || '').trim();
        if (s) seen[s] = true;
      });
      available = Object.keys(seen).sort().reverse();
    }
    if (current && available.indexOf(current) >= 0) return current;
    return available[0] || current || '';
  }

  function careerRows(data) {
    if (data && Array.isArray(data.career_results) && data.career_results.length) {
      return data.career_results;
    }
    if (data && Array.isArray(data.season_results)) return data.season_results;
    return [];
  }

  function mergeRepeatedCells(tableEl) {
    if (!tableEl || !tableEl.tBodies || !tableEl.tBodies.length) return;
    var tbody = tableEl.tBodies[0];
    var rows = Array.prototype.slice.call(tbody.rows || []);
    if (rows.length < 2) return;
    function mergeByKey(colIndex, keyFn) {
      var i = 0;
      while (i < rows.length) {
        var key = keyFn(rows[i]);
        var start = i;
        var end = i + 1;
        while (end < rows.length && keyFn(rows[end]) === key) {
          end++;
        }
        var span = end - start;
        if (span > 1 && rows[start].cells[colIndex]) {
          rows[start].cells[colIndex].rowSpan = span;
          for (var k = start + 1; k < end; k++) {
            if (rows[k].cells[colIndex]) rows[k].cells[colIndex].style.display = 'none';
          }
        }
        i = end;
      }
    }
    mergeByKey(0, function (tr) {
      return (tr.getAttribute('data-series-id') || '') + '|' + (tr.getAttribute('data-event-id') || '');
    });
    mergeByKey(1, function (tr) {
      return tr.getAttribute('data-event-id') || '';
    });
  }

  function renderResultsTable(results) {
    results = Array.isArray(results) ? results : [];
    if (!results.length) {
      return '<p class="empty-msg">' + esc(t('driver.no_season_results')) + '</p>';
    }
    var hasRaceName = results.some(function (r) {
      return r && r.race_name && String(r.race_name).trim() !== '';
    });
    var hasSprintByEvent = {};
    results.forEach(function (r) {
      if (!r) return;
      if (String(r.series_id || '').toUpperCase() !== 'F1') return;
      if (/sprint/i.test(String(r.race_name || ''))) {
        hasSprintByEvent[r.event_id] = true;
      }
    });
    var localizeSeriesName = (window.TGA && window.TGA.localizeSeriesName) || function (n, id) { return (n || id || '—'); };
    var localizeEventName = (window.TGA && window.TGA.localizeEventName) || function (n) { return n || '—'; };
    var localizeDriverRaceLabel = (window.TGA && window.TGA.localizeDriverRaceLabel) || function (n) { return n || ''; };
    var localizeDriverStatus = (window.TGA && window.TGA.localizeDriverStatus) || function (n) { return n || ''; };
    var tableRows = results.map(function (row) {
      var seriesLabel = esc(localizeSeriesName(row.series_name, row.series_id));
      var eventDisplay = localizeEventName(row.event_name && String(row.event_name).trim() ? row.event_name : '');
      var eventName = eventDisplay ? esc(eventDisplay) : (row.event_id || '—');
      var href = eventHref(row.event_id);
      var eventCell = href ? '<a href="' + href + '" class="event-link">' + eventName + '</a>' : eventName;
      var raceCell = '';
      if (hasRaceName) {
        var raceLabel = '';
        var rawRaceName = (row.race_name || '').trim();
        if (rawRaceName) {
          var seriesIdUpper = String(row.series_id || '').toUpperCase();
          if (seriesIdUpper === 'F1') {
            if (/sprint/i.test(rawRaceName)) {
              raceLabel = localizeDriverRaceLabel('Sprint');
            } else {
              raceLabel = hasSprintByEvent[row.event_id] ? localizeDriverRaceLabel('Feature') : '';
            }
          } else {
            raceLabel = localizeDriverRaceLabel(rawRaceName);
          }
        }
        raceCell = '<td>' + esc(raceLabel) + '</td>';
      }
      return '<tr data-series-id="' + esc(row.series_id || '') + '" data-event-id="' + esc(row.event_id || '') + '">' +
        '<td>' + seriesLabel + '</td>' +
        '<td>' + eventCell + '</td>' +
        raceCell +
        '<td class="col-num">' + (row.position != null ? row.position : '—') + '</td>' +
        '<td class="col-num">' + (row.points != null ? row.points : '—') + '</td>' +
        (row.car_number ? '<td class="col-num">' + esc(row.car_number) + '</td>' : '') +
        '<td>' + (row.laps != null ? row.laps : '') + '</td>' +
        (row.status ? '<td>' + esc(localizeDriverStatus(row.status)) + '</td>' : '') +
        '</tr>';
    });
    var carHeader = results.some(function (r) { return r.car_number; }) ? '<th class="col-num">' + t('th.no') + '</th>' : '';
    var statusHeader = results.some(function (r) { return r.status; }) ? '<th>' + t('th.status') + '</th>' : '';
    return '<div class="table-wrap"><table class="data-table">' +
      '<thead><tr>' +
      '<th>' + (t('home.series_col') || 'Series') + '</th>' +
      '<th>' + t('th.event') + '</th>' +
      (hasRaceName ? '<th>' + t('th.race_col') + '</th>' : '') +
      '<th class="col-num">' + t('th.pos') + '</th>' +
      '<th class="col-num">' + t('th.pts') + '</th>' +
      carHeader +
      '<th>' + t('section.laps') + '</th>' +
      statusHeader +
      '</tr></thead><tbody>' + tableRows.join('') + '</tbody></table></div>';
  }

  function yearLinks(years, eventIds) {
    years = Array.isArray(years) ? years : [];
    eventIds = Array.isArray(eventIds) ? eventIds : [];
    if (!years.length) return '';
    return years.map(function (year, i) {
      var href = eventHref(eventIds[i] || eventIds[0]);
      var label = esc(String(year));
      if (href) return '<a href="' + href + '" class="driver-honor-year">' + label + '</a>';
      return '<span class="driver-honor-year">' + label + '</span>';
    }).join('');
  }

  function teamHref(name) {
    var raw = name != null ? String(name).trim() : '';
    if (!raw) return '';
    if (window.TGA && typeof window.TGA.teamHref === 'function') {
      return window.TGA.teamHref(raw);
    }
    var slugify = window.TGA && window.TGA.slugify;
    if (!slugify) return '';
    return '/team/' + encodeURIComponent(slugify(raw));
  }

  function renderTeamHistory(stints) {
    stints = Array.isArray(stints) ? stints : [];
    if (!stints.length) {
      return '<p class="empty-msg">' + esc(t('driver.no_team_history')) + '</p>';
    }
    var localizeSeriesName = (window.TGA && window.TGA.localizeSeriesName) || function (n, id) { return (n || id || '—'); };
    var teamLabel = (window.TGA && window.TGA.teamLabel) || function (n) { return n; };
    var hasCar = stints.some(function (s) { return s && s.car_number; });
    var rows = stints.map(function (s) {
      if (!s) return '';
      var seriesLabel = esc(localizeSeriesName(s.series_name, s.series_id));
      var rawTeam = String(s.team_name || '').trim();
      var teamDisplay = esc(teamLabel(rawTeam) || rawTeam || '—');
      var href = teamHref(rawTeam);
      var teamCell = href ? '<a href="' + href + '" class="track-link">' + teamDisplay + '</a>' : teamDisplay;
      var years = esc(s.years_label || (Array.isArray(s.years) ? s.years.join(', ') : ''));
      return '<tr>' +
        '<td class="driver-team-years">' + years + '</td>' +
        '<td>' + teamCell + '</td>' +
        '<td>' + seriesLabel + '</td>' +
        '<td class="col-num">' + (s.starts != null ? s.starts : '—') + '</td>' +
        (hasCar ? '<td class="col-num">' + (s.car_number ? esc(String(s.car_number)) : '') + '</td>' : '') +
        '</tr>';
    }).join('');
    return '<div class="table-wrap"><table class="data-table driver-team-history">' +
      '<thead><tr>' +
      '<th class="driver-team-years">' + esc(t('driver.th.years')) + '</th>' +
      '<th>' + esc(t('th.team')) + '</th>' +
      '<th>' + esc(t('home.series_col') || 'Series') + '</th>' +
      '<th class="col-num">' + esc(t('stats.starts')) + '</th>' +
      (hasCar ? '<th class="col-num">' + esc(t('th.no')) + '</th>' : '') +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function renderHonorCard(item, extraClass) {
    if (!item) return '';
    var localizeSeriesName = (window.TGA && window.TGA.localizeSeriesName) || function (n, id) { return (n || id || ''); };
    var series = localizeSeriesName(item.series_name, item.series_id);
    var count = item.count > 1 ? '<span class="driver-honor-count">' + esc(String(item.count)) + '×</span>' : '';
    var kicker = series ? '<div class="driver-honor-kicker">' + esc(series) + '</div>' : '';
    var years = yearLinks(item.years || item.seasons, item.event_ids);
    return '<article class="driver-honor-card' + (extraClass ? ' ' + extraClass : '') + '">' +
      kicker +
      '<div class="driver-honor-head">' +
        '<h4 class="driver-honor-title">' + esc(honorLabel(item)) + '</h4>' +
        count +
      '</div>' +
      (years ? '<div class="driver-honor-years">' + years + '</div>' : '') +
    '</article>';
  }

  function renderHonors(list, emptyKey) {
    if (!Array.isArray(list) || !list.length) {
      return '<p class="empty-msg">' + esc(t(emptyKey)) + '</p>';
    }
    var html = '<div class="driver-honor-grid">';
    list.forEach(function (item) {
      var extra = (item && item.kind === 'triple_crown') ? 'driver-honor-card--crown' : '';
      html += renderHonorCard(item, extra);
    });
    html += '</div>';
    return html;
  }

  function renderSeasonChips(available, selected) {
    if (!available || available.length < 2) return '';
    return '<div class="driver-season-chips" role="tablist" aria-label="' + esc(t('driver.season_picker')) + '">' +
      available.map(function (year) {
        var on = String(year) === String(selected);
        return '<button type="button" class="driver-season-chip' + (on ? ' is-active' : '') + '" data-season="' + esc(String(year)) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + esc(String(year)) + '</button>';
      }).join('') +
      '</div>';
  }

  function renderDriverCareer(contentEl, data) {
    if (!contentEl) return;
    data = data || {};
    var career = careerRows(data);
    var available = Array.isArray(data.available_seasons) ? data.available_seasons.slice() : [];
    if (!available.length) {
      var seen = {};
      career.forEach(function (r) {
        var s = r && String(r.season || '').trim();
        if (s) seen[s] = true;
      });
      available = Object.keys(seen).sort().reverse();
    }
    var selectedSeason = pickDefaultSeason(data, career);
    var activeTab = parseCareerTab();
    var achievements = Array.isArray(data.achievements) ? data.achievements : [];
    var titles = Array.isArray(data.titles) ? data.titles : [];
    var teamHistory = Array.isArray(data.team_history) ? data.team_history : [];

    function tabBtn(id, labelKey) {
      var on = activeTab === id;
      return '<button type="button" class="driver-career-tab' + (on ? ' is-active' : '') + '" role="tab" data-career-tab="' + id + '" aria-selected="' + (on ? 'true' : 'false') + '">' + esc(t(labelKey)) + '</button>';
    }

    contentEl.innerHTML =
      '<div class="driver-career">' +
        '<div class="driver-career-tabs" role="tablist" aria-label="' + esc(t('driver.career_tabs')) + '">' +
          tabBtn(TAB_RESULTS, 'driver.tab.results') +
          tabBtn(TAB_TEAMS, 'driver.tab.teams') +
          tabBtn(TAB_ACHIEVEMENTS, 'driver.tab.achievements') +
          tabBtn(TAB_TITLES, 'driver.tab.titles') +
        '</div>' +
        '<div class="driver-career-panel" data-career-panel></div>' +
      '</div>';

    var panel = contentEl.querySelector('[data-career-panel]');
    if (!panel) return;

    function resultsForSeason(season) {
      if (!season) return career;
      return career.filter(function (r) { return r && String(r.season || '') === String(season); });
    }

    function paint() {
      var tabs = contentEl.querySelectorAll('.driver-career-tab');
      Array.prototype.forEach.call(tabs, function (btn) {
        var on = btn.getAttribute('data-career-tab') === activeTab;
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      if (activeTab === TAB_TEAMS) {
        panel.innerHTML = renderTeamHistory(teamHistory);
        return;
      }
      if (activeTab === TAB_ACHIEVEMENTS) {
        panel.innerHTML = renderHonors(achievements, 'driver.no_achievements');
        return;
      }
      if (activeTab === TAB_TITLES) {
        panel.innerHTML = renderHonors(titles, 'driver.no_titles');
        return;
      }
      var seasonRows = resultsForSeason(selectedSeason);
      var statsHtml = '';
      if (typeof window.TGA.renderSeasonStatsBySeries === 'function') {
        statsHtml = window.TGA.renderSeasonStatsBySeries(seasonRows, { season: selectedSeason });
      } else if (typeof window.TGA.renderSeasonStatsStrip === 'function' && window.TGA.computeSeasonRaceStats) {
        statsHtml = window.TGA.renderSeasonStatsStrip(
          window.TGA.computeSeasonRaceStats(seasonRows),
          { season: selectedSeason }
        );
      }
      panel.innerHTML = renderSeasonChips(available, selectedSeason) + statsHtml + renderResultsTable(seasonRows);
      mergeRepeatedCells(panel.querySelector('table.data-table'));
    }

    contentEl.onclick = function (ev) {
      var tabBtnEl = ev.target && ev.target.closest ? ev.target.closest('[data-career-tab]') : null;
      if (tabBtnEl && contentEl.contains(tabBtnEl)) {
        var next = tabBtnEl.getAttribute('data-career-tab');
        if (!VALID_TABS[next] || next === activeTab) return;
        activeTab = next;
        setCareerHash(activeTab);
        paint();
        return;
      }
      var chip = ev.target && ev.target.closest ? ev.target.closest('[data-season]') : null;
      if (chip && contentEl.contains(chip)) {
        var year = chip.getAttribute('data-season');
        if (!year || year === selectedSeason) return;
        selectedSeason = year;
        paint();
      }
    };

    paint();

    if (contentEl._careerHashHandler) {
      window.removeEventListener('hashchange', contentEl._careerHashHandler);
    }
    contentEl._careerHashHandler = function () {
      if (!contentEl.isConnected) {
        window.removeEventListener('hashchange', contentEl._careerHashHandler);
        return;
      }
      var next = parseCareerTab();
      if (next === activeTab) return;
      activeTab = next;
      paint();
    };
    window.addEventListener('hashchange', contentEl._careerHashHandler);
  }

  window.TGA.renderDriverCareer = renderDriverCareer;
})();
