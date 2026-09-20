// web/pages/team.js — team org profile tabs (Results / Drivers / Staff)
(function () {
  'use strict';
  window.TGA = window.TGA || {};

  var TAB_RESULTS = 'results';
  var TAB_DRIVERS = 'drivers';
  var TAB_STAFF = 'staff';
  var VALID_TABS = {};
  VALID_TABS[TAB_RESULTS] = true;
  VALID_TABS[TAB_DRIVERS] = true;
  VALID_TABS[TAB_STAFF] = true;
  var RESULTS_PAGE_SIZE = 50;
  var STAFF_GROUP_ORDER = ['management', 'sporting', 'technical', 'operations', 'other'];


  function t(key) {
    return (window.TGA.t || function (k) { return k; })(key);
  }
  function esc(s) {
    return (window.TGA.esc || function (x) { return String(x == null ? '' : x); })(s);
  }

  function eventHref(eventId) {
    if (!eventId) return '';
    return '/event/' + encodeURIComponent(String(eventId).toLowerCase().replace(/_/g, '-'));
  }

  function driverHref(name) {
    var raw = name != null ? String(name).trim() : '';
    if (!raw) return '';
    var first = raw.split(',')[0].trim();
    if (!first) return '';
    var slugify = window.TGA && window.TGA.slugify;
    if (!slugify) return '';
    return '/driver/' + encodeURIComponent(slugify(first));
  }

  function parseTab() {
    var hash = String((window.location && window.location.hash) || '').replace(/^#/, '').toLowerCase();
    if (VALID_TABS[hash]) return hash;
    return TAB_RESULTS;
  }

  function setHash(tab) {
    if (!VALID_TABS[tab]) tab = TAB_RESULTS;
    var path = window.location.pathname + (window.location.search || '');
    var next = tab === TAB_RESULTS ? path : path + '#' + tab;
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', next);
    }
  }

  function pickSeason(data) {
    var current = String((data && data.season) || '').trim();
    var available = (data && Array.isArray(data.available_seasons)) ? data.available_seasons.slice() : [];
    if (current && available.indexOf(current) >= 0) return current;
    return available[0] || current || '';
  }

  function filterBySeason(rows, season) {
    rows = Array.isArray(rows) ? rows : [];
    season = String(season || '').trim();
    if (!season) return rows;
    return rows.filter(function (r) {
      return r && String(r.season || '').trim() === season;
    });
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
      return tr.getAttribute('data-series-id') || '';
    });
  }

  function applySeriesZebra(tableEl) {
    if (!tableEl || !tableEl.tBodies || !tableEl.tBodies.length) return;
    var rows = Array.prototype.slice.call(tableEl.tBodies[0].rows || []);
    var lastSeries = null;
    var tone = false;
    rows.forEach(function (tr) {
      var sid = tr.getAttribute('data-series-id') || '';
      if (sid !== lastSeries) {
        lastSeries = sid;
        tone = false;
      } else {
        tone = !tone;
      }
      tr.classList.toggle('team-row--alt', tone);
    });
  }

  function posCellHtml(row) {
    if (row.position != null && row.position !== 0) {
      var n = Number(row.position);
      var cls = 'col-num team-col-pos';
      if (!isNaN(n) && n > 0 && n <= 5) cls += ' team-pos--top';
      return '<td class="' + cls + '">' + n + '</td>';
    }
    return '<td class="col-num team-col-pos">' + esc(row.status || '—') + '</td>';
  }

  /** Page numbers to show: e.g. page 1 of 10 → [1,2,3,4,5,10] */
  function visiblePageNumbers(page, totalPages) {
    if (totalPages <= 7) {
      var all = [];
      for (var i = 1; i <= totalPages; i++) all.push(i);
      return all;
    }
    var set = {};
    var out = [];
    function add(n) {
      n = Math.floor(n);
      if (n < 1 || n > totalPages || set[n]) return;
      set[n] = true;
      out.push(n);
    }
    add(1);
    if (page <= 3) {
      for (var a = 1; a <= 5; a++) add(a);
    } else if (page >= totalPages - 2) {
      for (var b = totalPages - 4; b <= totalPages; b++) add(b);
    } else {
      add(page - 1);
      add(page);
      add(page + 1);
    }
    add(totalPages);
    out.sort(function (x, y) { return x - y; });
    return out;
  }

  function renderResultsPager(page, totalPages) {
    if (totalPages <= 1) return '';
    var prevDisabled = page <= 1;
    var nextDisabled = page >= totalPages;
    var nums = visiblePageNumbers(page, totalPages);
    var buttons = [];
    buttons.push(
      '<button type="button" class="team-pager-btn team-pager-btn--nav' +
      (prevDisabled ? ' is-disabled' : '') +
      '" data-page="' + (page - 1) + '" aria-label="' + esc(t('pager.prev') || 'Previous') + '"' +
      (prevDisabled ? ' disabled' : '') + '>&lt;</button>'
    );
    nums.forEach(function (n) {
      buttons.push(
        '<button type="button" class="team-pager-btn' +
        (n === page ? ' is-current' : '') +
        '" data-page="' + n + '" aria-label="' + esc((t('pager.page') || 'Page') + ' ' + n) + '"' +
        (n === page ? ' aria-current="page"' : '') + '>' + n + '</button>'
      );
    });
    buttons.push(
      '<button type="button" class="team-pager-btn team-pager-btn--nav' +
      (nextDisabled ? ' is-disabled' : '') +
      '" data-page="' + (page + 1) + '" aria-label="' + esc(t('pager.next') || 'Next') + '"' +
      (nextDisabled ? ' disabled' : '') + '>&gt;</button>'
    );
    return '<nav class="team-pager" aria-label="' + esc(t('pager.label') || 'Results pages') + '">' +
      buttons.join('') +
      '</nav>';
  }

  function renderResultsTable(results, page) {
    results = Array.isArray(results) ? results : [];
    if (!results.length) {
      return '<p class="empty-msg">' + esc(t('team.no_results') || t('driver.no_season_results')) + '</p>';
    }
    var totalPages = Math.max(1, Math.ceil(results.length / RESULTS_PAGE_SIZE));
    page = Math.max(1, Math.min(totalPages, Number(page) || 1));
    var start = (page - 1) * RESULTS_PAGE_SIZE;
    var pageRows = results.slice(start, start + RESULTS_PAGE_SIZE);

    var localizeSeriesName = (window.TGA && window.TGA.localizeSeriesName) || function (n, id) { return (n || id || '—'); };
    var localizeEventName = (window.TGA && window.TGA.localizeEventName) || function (n) { return n || '—'; };
    var hasClass = results.some(function (r) { return r && r.class; });
    var rows = pageRows.map(function (row) {
      var seriesLabel = esc(localizeSeriesName(row.series_name, row.series_id));
      var eventDisplay = localizeEventName(row.event_name && String(row.event_name).trim() ? row.event_name : '');
      var eventName = eventDisplay ? esc(eventDisplay) : esc(row.event_id || '—');
      var href = eventHref(row.event_id);
      var eventCell = href ? '<a href="' + href + '" class="event-link">' + eventName + '</a>' : eventName;
      var dHref = driverHref(row.driver_name);
      var driverCell = row.driver_name
        ? (dHref ? '<a href="' + dHref + '" class="track-link">' + esc(row.driver_name) + '</a>' : esc(row.driver_name))
        : '—';
      return '<tr data-series-id="' + esc(row.series_id || '') + '">' +
        '<td>' + seriesLabel + '</td>' +
        '<td>' + eventCell + '</td>' +
        '<td>' + driverCell + '</td>' +
        (hasClass ? '<td>' + esc(row.class || '') + '</td>' : '') +
        posCellHtml(row) +
        '<td class="col-num team-col-pts">' + (row.points != null ? row.points : '—') + '</td>' +
        '<td class="col-num team-col-no">' + esc(row.car_number || '') + '</td>' +
        '</tr>';
    });
    return '<div class="table-wrap"><table class="data-table team-results-table">' +
      '<thead><tr>' +
      '<th>' + (t('home.series_col') || 'Series') + '</th>' +
      '<th>' + t('th.event') + '</th>' +
      '<th>' + (t('th.driver') || 'Driver') + '</th>' +
      (hasClass ? '<th>' + (t('th.class') || 'Class') + '</th>' : '') +
      '<th class="col-num">' + t('th.pos') + '</th>' +
      '<th class="col-num">' + t('th.pts') + '</th>' +
      '<th class="col-num">' + t('th.no') + '</th>' +
      '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>' +
      renderResultsPager(page, totalPages);
  }

  // FT/PT only for stock-car + Supercars (matches Go seriesUsesFullTimeFlag).
  function seriesAllowsFtPt(seriesId) {
    if (window.TGA && typeof window.TGA.seriesUsesFullTimeFlag === 'function') {
      return window.TGA.seriesUsesFullTimeFlag(seriesId);
    }
    var sid = String(seriesId || '').toLowerCase().replace(/-/g, '_');
    if (sid === 'nascar_xfinity') sid = 'noaps';
    return sid === 'nascar_cup' || sid === 'noaps' || sid === 'nascar_truck' ||
      sid === 'arca' || sid === 'nascar_modified' || sid === 'supercars';
  }

  function renderRosterTable(roster) {
    roster = Array.isArray(roster) ? roster : [];
    if (!roster.length) {
      return '<p class="empty-msg">' + esc(t('team.no_roster') || 'No roster for this season.') + '</p>';
    }
    var localizeSeriesName = (window.TGA && window.TGA.localizeSeriesName) || function (n, id) { return (n || id || '—'); };
    var hasClass = roster.some(function (r) { return r && r.class; });
    var hasFT = roster.some(function (r) {
      return r && r.full_time != null && seriesAllowsFtPt(r.series_id);
    });
    var rows = roster.map(function (row) {
      var dHref = driverHref(row.driver_name);
      var driverCell = row.driver_name
        ? (dHref ? '<a href="' + dHref + '" class="track-link">' + esc(row.driver_name) + '</a>' : esc(row.driver_name))
        : '—';
      var ftCell = '—';
      if (hasFT && seriesAllowsFtPt(row.series_id)) {
        if (row.full_time === true) {
          ftCell = '<span class="team-driver-ft team-driver-ft--ft">' + esc(t('team.full_time') || 'FT') + '</span>';
        } else if (row.full_time === false) {
          ftCell = '<span class="team-driver-ft team-driver-ft--pt">' + esc(t('team.part_time') || 'PT') + '</span>';
        }
      }
      var noCell = row.car_number
        ? '<span class="team-driver-no">#' + esc(row.car_number) + '</span>'
        : '';
      return '<tr data-series-id="' + esc(row.series_id || '') + '">' +
        '<td>' + esc(localizeSeriesName(row.series_name, row.series_id)) + '</td>' +
        '<td class="col-num">' + noCell + '</td>' +
        '<td>' + driverCell + '</td>' +
        (hasClass ? '<td>' + esc(row.class || '') + '</td>' : '') +
        (hasFT ? '<td>' + ftCell + '</td>' : '') +
        '<td>' + esc(row.rounds || '') + '</td>' +
        '</tr>';
    });
    return '<div class="table-wrap"><table class="data-table team-roster-table">' +
      '<thead><tr>' +
      '<th>' + (t('home.series_col') || 'Series') + '</th>' +
      '<th class="col-num">' + t('th.no') + '</th>' +
      '<th>' + (t('th.driver') || 'Driver') + '</th>' +
      (hasClass ? '<th>' + (t('th.class') || 'Class') + '</th>' : '') +
      (hasFT ? '<th>' + (t('team.ft_pt') || 'FT/PT') + '</th>' : '') +
      '<th>' + (t('team.rounds') || 'Rounds') + '</th>' +
      '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
  }

  function normalizeStaffGroup(g) {
    var key = String(g || '').trim().toLowerCase();
    if (STAFF_GROUP_ORDER.indexOf(key) >= 0) return key;
    return 'other';
  }

  function staffGroupLabel(group) {
    return t('team.staff.group.' + group) || group;
  }

  /** Empty/missing seasons = applies to every season (legacy flat staff). */
  function filterStaffBySeason(staff, season) {
    staff = Array.isArray(staff) ? staff : [];
    season = String(season || '').trim();
    if (!season) return staff;
    return staff.filter(function (row) {
      if (!row) return false;
      var seasons = row.seasons;
      if (!Array.isArray(seasons) || !seasons.length) return true;
      return seasons.some(function (y) {
        return String(y || '').trim() === season;
      });
    });
  }

  function seasonTeamPrincipal(staff, season, fallback) {
    var list = filterStaffBySeason(staff, season);
    for (var i = 0; i < list.length; i++) {
      var role = String(list[i].role || '').toLowerCase();
      if (role.indexOf('team principal') >= 0) {
        return String(list[i].name || '').trim() || fallback;
      }
    }
    return fallback;
  }

  function renderStaffOverview(staff) {
    staff = Array.isArray(staff) ? staff : [];
    if (!staff.length) {
      return '<p class="empty-msg">' + esc(t('team.staff.empty') || 'No staff listed yet.') + '</p>';
    }
    var byGroup = {};
    staff.forEach(function (row) {
      if (!row) return;
      var name = String(row.name || '').trim();
      var role = String(row.role || '').trim();
      if (!name || !role) return;
      var g = normalizeStaffGroup(row.group);
      if (!byGroup[g]) byGroup[g] = [];
      byGroup[g].push({ name: name, role: role });
    });
    var sections = [];
    STAFF_GROUP_ORDER.forEach(function (g) {
      var people = byGroup[g];
      if (!people || !people.length) return;
      var items = people.map(function (p) {
        return '<li class="team-staff-row">' +
          '<span class="team-staff-name">' + esc(p.name) + '</span>' +
          '<span class="team-staff-role">' + esc(p.role) + '</span>' +
          '</li>';
      }).join('');
      sections.push(
        '<section class="team-staff-section" aria-label="' + esc(staffGroupLabel(g)) + '">' +
          '<h3 class="team-staff-section-title">' + esc(staffGroupLabel(g)) + '</h3>' +
          '<ul class="team-staff-list">' + items + '</ul>' +
        '</section>'
      );
    });
    if (!sections.length) {
      return '<p class="empty-msg">' + esc(t('team.staff.empty') || 'No staff listed yet.') + '</p>';
    }
    return '<div class="team-staff-overview">' + sections.join('') + '</div>';
  }

  function renderTeamCareer(contentEl, data) {
    if (!contentEl) return;
    var career = Array.isArray(data.career_results) ? data.career_results : [];
    var careerRoster = Array.isArray(data.career_roster) ? data.career_roster : [];
    var staff = Array.isArray(data.staff) ? data.staff : [];
    var available = Array.isArray(data.available_seasons) ? data.available_seasons.slice() : [];
    if (!available.length) {
      var seen = {};
      career.concat(careerRoster).forEach(function (r) {
        var s = r && String(r.season || '').trim();
        if (s) seen[s] = true;
      });
      available = Object.keys(seen).sort().reverse();
    }
    var season = pickSeason(data);
    var tab = parseTab();
    var resultsPage = 1;

    function paint() {
      var seasonResults = filterBySeason(career, season);
      var seasonRoster = filterBySeason(careerRoster, season);
      var seasonStaff = filterStaffBySeason(staff, season);
      var totalPages = Math.max(1, Math.ceil(seasonResults.length / RESULTS_PAGE_SIZE));
      if (resultsPage > totalPages) resultsPage = totalPages;
      if (resultsPage < 1) resultsPage = 1;

      var chips = available.map(function (s) {
        var active = s === season ? ' is-active' : '';
        return '<button type="button" class="driver-season-chip' + active + '" data-season="' + esc(s) + '">' + esc(s) + '</button>';
      }).join('');

      var resultsLabel = (t('team.tab_results') || t('driver.tab_results') || 'Results') +
        ' (' + seasonResults.length + ')';
      var driversLabel = (t('team.tab_drivers') || 'Drivers') +
        ' (' + seasonRoster.length + ')';
      var staffLabel = (t('team.tab_staff') || 'Staff') +
        ' (' + seasonStaff.length + ')';

      if (tab === TAB_STAFF && !staff.length) {
        tab = TAB_RESULTS;
        setHash(tab);
      }

      var tabs =
        '<div class="driver-career-tabs" role="tablist">' +
        '<button type="button" class="driver-career-tab' + (tab === TAB_RESULTS ? ' is-active' : '') + '" data-tab="' + TAB_RESULTS + '" role="tab">' +
        esc(resultsLabel) + '</button>' +
        '<button type="button" class="driver-career-tab' + (tab === TAB_DRIVERS ? ' is-active' : '') + '" data-tab="' + TAB_DRIVERS + '" role="tab">' +
        esc(driversLabel) + '</button>';
      if (staff.length) {
        tabs +=
          '<button type="button" class="driver-career-tab' + (tab === TAB_STAFF ? ' is-active' : '') + '" data-tab="' + TAB_STAFF + '" role="tab">' +
          esc(staffLabel) + '</button>';
      }
      tabs += '</div>';

      var statsHtml = '';
      if (tab === TAB_RESULTS) {
        if (typeof window.TGA.renderSeasonStatsBySeries === 'function') {
          statsHtml = window.TGA.renderSeasonStatsBySeries(seasonResults, { season: season });
        } else if (typeof window.TGA.renderSeasonStatsStrip === 'function' && window.TGA.computeSeasonRaceStats) {
          statsHtml = window.TGA.renderSeasonStatsStrip(
            window.TGA.computeSeasonRaceStats(seasonResults),
            { season: season }
          );
        }
      }
      var body;
      if (tab === TAB_STAFF) {
        body = renderStaffOverview(seasonStaff);
      } else if (tab === TAB_DRIVERS) {
        body = renderRosterTable(seasonRoster);
      } else {
        body = renderResultsTable(seasonResults, resultsPage);
      }
      contentEl.innerHTML =
        '<div class="driver-career">' +
        (chips ? '<div class="driver-season-chips">' + chips + '</div>' : '') +
        statsHtml +
        tabs +
        '<div class="driver-career-panel">' + body + '</div>' +
        '</div>';
      var tableEl = contentEl.querySelector('.driver-career-panel .data-table');
      if (tab === TAB_RESULTS || tab === TAB_DRIVERS) {
        mergeRepeatedCells(tableEl);
      }
      if (tab === TAB_RESULTS) applySeriesZebra(tableEl);

      contentEl.querySelectorAll('[data-season]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          season = btn.getAttribute('data-season') || season;
          resultsPage = 1;
          var titleEl = document.getElementById('team-title');
          var map = data.display_name_by_season || {};
          var seriesIds = data.series_ids || [];
          var display = data.canonical_name || data.display_name;
          for (var i = 0; i < seriesIds.length; i++) {
            var key = String(seriesIds[i]).toLowerCase() + '|' + season;
            if (map[key]) {
              display = map[key];
              break;
            }
          }
          if (titleEl && display) titleEl.textContent = display;
          var metaEl = document.getElementById('team-meta');
          if (metaEl && typeof window.TGA.buildTeamHeaderMetaHtml === 'function') {
            var headerData = Object.assign({}, data, {
              season: season,
              season_roster: filterBySeason(careerRoster, season),
              display_name: display,
              team_principal: seasonTeamPrincipal(staff, season, data.team_principal)
            });
            metaEl.innerHTML = window.TGA.buildTeamHeaderMetaHtml(headerData);
          }
          paint();
        });
      });
      contentEl.querySelectorAll('[data-tab]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          tab = btn.getAttribute('data-tab') || TAB_RESULTS;
          resultsPage = 1;
          setHash(tab);
          paint();
        });
      });
      if (tab === TAB_RESULTS) {
        contentEl.querySelectorAll('.team-pager-btn[data-page]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            if (btn.disabled) return;
            var next = parseInt(btn.getAttribute('data-page'), 10);
            if (!next || next === resultsPage) return;
            resultsPage = next;
            paint();
            var panel = contentEl.querySelector('.driver-career-panel');
            if (panel && panel.scrollIntoView) {
              try { panel.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e) { panel.scrollIntoView(true); }
            }
          });
        });
      }
    }

    paint();
  }

  window.TGA.renderTeamCareer = renderTeamCareer;
})();
