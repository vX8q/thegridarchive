(function () {
  // Centralized logger. Respects an existing window.TGA.logger,
  // or creates its own if missing. All UI logging goes through it,
  // so Sentry can be wired in later / output suppressed in production
  // (via window.TGA.onError and window.TGA.debug = false).
  var logger = (function () {
    window.TGA = window.TGA || {};
    if (window.TGA.logger && typeof window.TGA.logger.error === 'function') {
      return window.TGA.logger;
    }
    var hasConsole = typeof window !== 'undefined' && !!window.console;
    var debugEnabled = false;
    try { debugEnabled = !!window.TGA.debug || localStorage.getItem('tga-debug') === '1'; } catch (e) {}
    var report = (typeof window.TGA.onError === 'function') ? window.TGA.onError : function () {};
    function call(level, args) {
      if (!hasConsole) return;
      var fn = console[level] || console.log;
      if (typeof fn !== 'function' || typeof fn.apply !== 'function') return;
      try { fn.apply(console, ['[TGA]'].concat(Array.prototype.slice.call(args))); } catch (e) { /* ignore */ }
    }
    var impl = {
      error: function (msg, err) { call('error', arguments); try { report(msg, err); } catch (e) {} },
      warn:  function (msg, err) { call('warn', arguments);  try { report(msg, err); } catch (e) {} },
      info:  function () { if (debugEnabled) call('info', arguments); },
      debug: function () { if (debugEnabled) call('log', arguments); }
    };
    window.TGA.logger = impl;
    return impl;
  })();
  window.TGA = window.TGA || {};
  var state = window.TGA._state;

  var API = window.TGA.API;

  var P = window.TGA.pageDeps();
  var t = P.t;
  var getLang = P.getLang;
  var esc = P.esc;
  var dash = P.dash;
  var slugify = P.slugify;
  var driverDisplayName = P.driverDisplayName;
  var isGuestEntryRow = P.isGuestEntryRow;
  var guestCarNumberSet = P.guestCarNumberSet;
  var entryListDriverCell = P.entryListDriverCell;
  var entryListDriverLabel = P.entryListDriverLabel;
  var localizeStatKey = P.localizeStatKey;
  var localizeStatValue = P.localizeStatValue;
  var localizeSpecKey = P.localizeSpecKey;
  var localizeSpecValue = P.localizeSpecValue;
  var normalizeSpecKey = P.normalizeSpecKey;
  var specKeySkip = P.specKeySkip;
  var localizeTableHeader = P.localizeTableHeader;
  var localizeCellNote = P.localizeCellNote;
  var localizeRaceReason = P.localizeRaceReason;
  var translateValueHeaders = P.translateValueHeaders;
  var translateReasonHeaders = P.translateReasonHeaders;
  var localizeDate = P.localizeDate;
  var localizeDistance = P.localizeDistance;
  var localizeEventPreview = P.localizeEventPreview;
  var trimTrailingZeros = P.trimTrailingZeros;
  var countryHtml = P.countryHtml;
  var categories = P.categories;
  var categoryBySeriesId = P.categoryBySeriesId;
  var seriesBadge = P.seriesBadge;
  var formatShortDate = P.formatShortDate;
  var formatDateRange = P.formatDateRange;
  var parseEventDate = P.parseEventDate;
  var formatDateRangeLong = P.formatDateRangeLong;
  var getEventSessionDateRange = P.getEventSessionDateRange;
  var addObjectTableSort = P.addObjectTableSort;
  var typeLabel = P.typeLabel;
  var syncStandingsScrollBars = P.syncStandingsScrollBars;
  var adjustEventPanelPadding = P.adjustEventPanelPadding;
  var adjustDetailPanelPadding = P.adjustDetailPanelPadding;
  var renderSupercarsStaticSpecs = P.renderSupercarsStaticSpecs;
  var translateStaticUI = P.translateStaticUI;

  var renderNextRaceCards = (window.TGA && window.TGA.renderNextRaceCards) || function () {};
  var stopNextRaceTimers = (window.TGA && window.TGA.stopNextRaceTimers) || function () {};
  var renderList = (window.TGA && window.TGA.renderList) || function () {};

  var allViewIds = ['view-list', 'view-search', 'view-detail', 'view-event', 'view-track', 'view-driver', 'view-team', 'view-crew-chief', 'view-schedule'];
  function showView(activeId) {
    if (activeId !== 'view-list') {
      stopNextRaceTimers();
      if (window.TGA.stopLiveDebugRefresh) window.TGA.stopLiveDebugRefresh();
    }
    allViewIds.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList[id === activeId ? 'remove' : 'add']('hidden');
    });
    if (activeId !== 'view-event') {
      var bodyEl = document.body;
      if (bodyEl) {
        Array.from(bodyEl.classList).forEach(function (cls) {
          if (/^ev-/.test(cls)) bodyEl.classList.remove(cls);
        });
      }
    }
  }

  var searchPriorityList = (function () {
    if (window.TGA_SEARCH_PRIORITY && Array.isArray(window.TGA_SEARCH_PRIORITY) && window.TGA_SEARCH_PRIORITY.length > 0) {
      return window.TGA_SEARCH_PRIORITY.slice();
    }
    return [
      'F1', 'INDYCAR', 'WEC', 'NASCAR_CUP', 'SUPER_FORMULA', 'IMSA',
      'DTM', 'SUPER_GT', 'F2', 'GTWCE_END', 'GTWCE_SPRINT', 'ELMS',
      'SUPERCARS', 'NOAPS', 'F3', 'NASCAR_TRUCK', 'PSC', 'ARCA',
      'FREC', 'F4_IT', 'NASCAR_MODIFIED'
    ];
  })();
  var seriesPopularity = {};
  searchPriorityList.forEach(function (sid, idx) {
    // Earlier in the list = higher score.
    seriesPopularity[String(sid || '').toUpperCase()] = (searchPriorityList.length - idx) + 100;
  });

  function seriesSearchAliases(seriesID) {
    var sid = String(seriesID || '').toUpperCase();
    var map = window.TGA_SEARCH_ALIASES;
    if (!map || typeof map !== 'object') return '';
    var aliases = map[sid];
    return aliases ? String(aliases).trim() : '';
  }

  function seriesSearchExtra(seriesID, baseExtra) {
    var parts = [String(baseExtra || '').trim(), seriesSearchAliases(seriesID)].filter(Boolean);
    return parts.join(' ');
  }

  var popularTeamHints = [
    'red bull', 'ferrari', 'mercedes', 'mclaren', 'aston martin',
    'williams', 'haas', 'alpine', 'sauber', 'penske', 'ganassi',
    'hendrick', 'joe gibbs', 'rfk', '23xi', 'trackhouse', 'toyota gazoo',
    'porsche', 'bmw', 'cadillac', 'ford', 'chevrolet'
  ];

  function normalizeSearchText(value) {
    if (value == null) return '';
    return String(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function seriesPopularityScore(seriesID) {
    var sid = String(seriesID || '').toUpperCase();
    return seriesPopularity[sid] || 0;
  }

  function teamPopularityBoost(teamName) {
    var team = normalizeSearchText(teamName);
    if (!team) return 0;
    for (var i = 0; i < popularTeamHints.length; i++) {
      if (team.indexOf(popularTeamHints[i]) >= 0) return 8;
    }
    return 0;
  }

  function normalizeDisplayTeamName(teamName) {
    var raw = String(teamName || '').trim();
    if (!raw) return '';
    var map = {
      'Oracle Red Bull Racing': 'Red Bull Racing',
      'Visa Cash App Racing Bulls F1 Team': 'Racing Bulls',
      'Mercedes-AMG Petronas F1 Team': 'Mercedes',
      'Scuderia Ferrari HP': 'Ferrari',
      'McLaren Formula 1 Team': 'McLaren',
      'Aston Martin Aramco F1 Team': 'Aston Martin',
      'BWT Alpine F1 Team': 'Alpine',
      'MoneyGram Haas F1 Team': 'Haas',
      'Stake F1 Team Kick Sauber': 'Kick Sauber',
      'Atlassian Williams Racing': 'Williams'
    };
    if (map[raw]) return map[raw];
    return raw
      .replace(/\b(oracle|visa|cash app|aramco|petronas|moneygram|atlassian|stake|bwt)\b/gi, '')
      .replace(/\b(formula 1|f1)\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim() || raw;
  }

  function teamAgeFromMeta(meta) {
    if (!meta || typeof meta !== 'object') return '';
    var yearRaw = meta.founded_year || meta.founded || meta.year_established || meta.established || '';
    if (yearRaw == null || String(yearRaw).trim() === '') return '';
    var year = parseInt(String(yearRaw).replace(/[^\d]/g, ''), 10);
    if (!year || isNaN(year)) return '';
    var nowYear = new Date().getFullYear();
    if (year > nowYear || year < 1900) return '';
    return String(nowYear - year);
  }

  function ageFromBirthDate(value) {
    var s = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
    var p = s.split('-');
    var by = parseInt(p[0], 10);
    var bm = parseInt(p[1], 10);
    var bd = parseInt(p[2], 10);
    if (!by || !bm || !bd) return '';
    var now = new Date();
    var age = now.getFullYear() - by;
    var md = now.getMonth() + 1 - bm;
    if (md < 0 || (md === 0 && now.getDate() < bd)) age--;
    return isNaN(age) ? '' : String(age);
  }

  function getBestDriverPhotoURL(rawURL) {
    var src = String(rawURL || '').trim();
    if (!src) return '';
    // Prefer one high-quality source and let browser downscale it.
    // Wikimedia thumb URL example:
    // https://.../thumb/.../320px-File.jpg
    // Convert to original file URL:
    // https://.../.../File.jpg
    var wm = src.match(/^(.*\/thumb\/.*\/)(\d+)px-([^/?#]+)(.*)$/i);
    if (wm) {
      return wm[1].replace('/thumb/', '/') + wm[3];
    }
    return src;
  }

  function isSearchPhotoHighQuality(url) {
    var src = String(url || '').trim();
    if (!src) return Promise.resolve(false);
    if (state.driverPhotoQualityCache[src] != null) {
      return Promise.resolve(!!state.driverPhotoQualityCache[src]);
    }
    return new Promise(function (resolve) {
      var img = new Image();
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        state.driverPhotoQualityCache[src] = false;
        resolve(false);
      }, 3500);
      img.onload = function () {
        if (done) return;
        clearTimeout(timer);
        done = true;
        var w = img.naturalWidth || 0;
        var h = img.naturalHeight || 0;
        var ok = w >= 180 && h >= 180;
        state.driverPhotoQualityCache[src] = ok;
        resolve(ok);
      };
      img.onerror = function () {
        if (done) return;
        clearTimeout(timer);
        done = true;
        state.driverPhotoQualityCache[src] = false;
        resolve(false);
      };
      img.src = src;
    });
  }

  function pushSearchItem(list, dedupe, title, kind, href, extra, subtext, seriesID, teamName, seriesName, meta) {
    var cleanTitle = String(title || '').trim();
    if (!cleanTitle || !href) return;
    var key = (kind === 'driver')
      ? kind + '|' + href
      : kind + '|' + href + '|' + cleanTitle.toLowerCase();
    if (dedupe[key]) {
      if (kind === 'driver') {
        var existing = list.find(function (item) {
          return item.kind === 'driver' && item.href === href;
        });
        if (existing && cleanTitle.length > String(existing.title || '').length) {
          existing.title = cleanTitle;
          existing.haystack = normalizeSearchText(cleanTitle + ' ' + (extra || ''));
        }
      }
      return;
    }
    dedupe[key] = true;
    var hay = normalizeSearchText(cleanTitle + ' ' + (extra || ''));
    var pop = seriesPopularityScore(seriesID) + teamPopularityBoost(teamName);
    list.push({
      title: cleanTitle,
      kind: kind,
      href: href,
      haystack: hay,
      subtext: subtext || '',
      popularity: pop,
      seriesID: seriesID || '',
      seriesName: seriesName || '',
      teamName: teamName || '',
      meta: (meta && typeof meta === 'object') ? meta : {}
    });
  }

  function rankSearchItems(queryNorm, a, b) {
    var aStarts = a.haystack.indexOf(queryNorm) === 0 ? 0 : 1;
    var bStarts = b.haystack.indexOf(queryNorm) === 0 ? 0 : 1;
    if (aStarts !== bStarts) return aStarts - bStarts;
    var aPop = a.popularity || 0;
    var bPop = b.popularity || 0;
    if (aPop !== bPop) return bPop - aPop;
    return a.title.localeCompare(b.title);
  }

  function pickPrimaryDriverContext(agg, primaryBySlug, slugKey) {
    if (primaryBySlug && slugKey && primaryBySlug[slugKey]) {
      var p = primaryBySlug[slugKey];
      if (p && (p.series_id || p.series_name)) {
        return {
          seriesID: p.series_id || '',
          seriesName: p.series_name || '',
          teamName: p.team_name || ''
        };
      }
    }
    var bestSeriesID = '';
    var bestSeriesCount = -1;
    var bestSeriesPop = -1;
    Object.keys(agg.seriesCounts).forEach(function (sid) {
      var cnt = agg.seriesCounts[sid] || 0;
      var pop = seriesPopularityScore(sid);
      if (
        cnt > bestSeriesCount ||
        (cnt === bestSeriesCount && pop > bestSeriesPop) ||
        (cnt === bestSeriesCount && pop === bestSeriesPop && String(sid) < String(bestSeriesID))
      ) {
        bestSeriesID = sid;
        bestSeriesCount = cnt;
        bestSeriesPop = pop;
      }
    });
    var teams = (agg.teamCountsBySeries && agg.teamCountsBySeries[bestSeriesID]) || {};
    var bestTeam = '';
    var bestTeamCount = -1;
    Object.keys(teams).forEach(function (tn) {
      var cnt = teams[tn] || 0;
      if (cnt > bestTeamCount || (cnt === bestTeamCount && tn < bestTeam)) {
        bestTeam = tn;
        bestTeamCount = cnt;
      }
    });
    return {
      seriesID: bestSeriesID,
      seriesName: agg.seriesNames[bestSeriesID] || bestSeriesID || '',
      teamName: bestTeam || ''
    };
  }

  function ensureSearchIndex() {
    if (state.searchIndexReady) return Promise.resolve(state.searchIndexItems);
    if (state.searchIndexLoading) return Promise.resolve(state.searchIndexItems);
    state.searchIndexLoading = true;
    var items = [];
    var dedupe = {};
    var driverAggBySlug = {};
    var legalNameBySlug = {};
    return API.getDriversPrimaryContext()
      .catch(function () { return {}; })
      .then(function (primaryBySlug) {
        if (!primaryBySlug || typeof primaryBySlug !== 'object') primaryBySlug = {};
        return API.getDrivers()
          .catch(function () { return []; })
          .then(function (drivers) {
            if (Array.isArray(drivers)) {
              drivers.forEach(function (d) {
                if (!d || typeof d !== 'object') return;
                var slug = String(d.slug || '').trim();
                var extra = String(d.search_extra || '').trim();
                if (slug && extra) legalNameBySlug[slug] = extra;
              });
            }
            return primaryBySlug;
          });
      })
      .then(function (primaryBySlug) {
        if (!primaryBySlug || typeof primaryBySlug !== 'object') primaryBySlug = {};
        return API.getSeries()
          .then(function (seriesList) {
            if (!Array.isArray(seriesList)) return primaryBySlug;
            var reqs = seriesList.map(function (series) {
              var id = String((series && series.id) || '').trim();
              if (!id) return Promise.resolve(null);
              var name = String((series && series.name) || id).trim();
              var slug = id.toLowerCase().replace(/_+/g, '-');
              pushSearchItem(items, dedupe, name, 'Championship', '/series/' + encodeURIComponent(slug), seriesSearchExtra(id, id), '', id, name, name, null);
              var season = (series && series.season) ? String(series.season) : '';
              if (season && name) {
                pushSearchItem(items, dedupe, name + ' ' + season, 'Season', '/series/' + encodeURIComponent(slug), seriesSearchExtra(id, id + ' ' + name), '', id, name, name, null);
              }
              return API.getSeriesTeams(id)
                .then(function (teamsResp) {
                  var teamList = (teamsResp && Array.isArray(teamsResp.teams)) ? teamsResp.teams : (Array.isArray(teamsResp) ? teamsResp : []);
                  teamList.forEach(function (row) {
                    if (!row || typeof row !== 'object') return;
                    var teamName = String(row.team || '').trim();
                    var manufacturer = String(row.manufacturer || '').trim();
                    if (teamName) {
                      var teamMeta = {
                        base: row.base || row.hq || row.headquarters || row.location || '',
                        licence: row.licence || row.license || row.nationality || '',
                        age: teamAgeFromMeta(row)
                      };
                      pushSearchItem(items, dedupe, normalizeDisplayTeamName(teamName), 'team', '/team/' + encodeURIComponent(slugify(teamName)), seriesSearchExtra(id, name + ' ' + manufacturer), name, id, teamName, name, teamMeta);
                    }
                    var drivers = [];
                    if (Array.isArray(row.drivers)) {
                      row.drivers.forEach(function (d) {
                        var s = String(d || '').trim();
                        if (s) drivers.push(s);
                      });
                    }
                    if (row.driver != null && String(row.driver).trim() !== '') {
                      var splitNames = (window.TGA && window.TGA.splitDriverNames)
                        ? window.TGA.splitDriverNames(String(row.driver))
                        : [String(row.driver).trim()];
                      splitNames.forEach(function (d) {
                        if (d) drivers.push(d);
                      });
                    }
                    drivers.forEach(function (driverNameRaw) {
                      var driverName = driverDisplayName(String(driverNameRaw || '').trim());
                      if (!driverName || /^(?:tba|tbc|tbd)$/i.test(driverName)) return;
                      var dSlug = slugify(driverName);
                      if (!dSlug) return;
                      if (!driverAggBySlug[dSlug]) {
                        driverAggBySlug[dSlug] = {
                          title: driverName,
                          href: '/driver/' + encodeURIComponent(dSlug),
                          seriesCounts: {},
                          seriesNames: {},
                          teamCountsBySeries: {}
                        };
                      }
                      var agg = driverAggBySlug[dSlug];
                      if (!agg.seriesCounts[id]) agg.seriesCounts[id] = 0;
                      agg.seriesCounts[id] += 1;
                      agg.seriesNames[id] = name;
                      if (!agg.teamCountsBySeries[id]) agg.teamCountsBySeries[id] = {};
                      if (teamName) {
                        if (!agg.teamCountsBySeries[id][teamName]) agg.teamCountsBySeries[id][teamName] = 0;
                        agg.teamCountsBySeries[id][teamName] += 1;
                      }
                    });
                    var crewChiefName = String(row.crew_chief || row.crewChief || '').trim();
                    if (crewChiefName) {
                      var crewMeta = {
                        nationality: row.crew_chief_nationality || row.crewChiefNationality || row.crew_chief_citizenship || '',
                        age: row.crew_chief_age || row.crewChiefAge || ageFromBirthDate(row.crew_chief_birth_date || row.crewChiefBirthDate || '')
                      };
                      pushSearchItem(items, dedupe, crewChiefName, 'crew_chief', '/crew-chief/' + encodeURIComponent(slugify(crewChiefName)), name + ' ' + teamName, teamName || name, id, teamName, name, crewMeta);
                    }
                    var teamPrincipalName = String(row.team_principal || row.teamPrincipal || row.principal || '').trim();
                    if (teamPrincipalName) {
                      var principalHref = teamName ? '/team/' + encodeURIComponent(slugify(teamName)) : '/';
                      pushSearchItem(items, dedupe, teamPrincipalName, 'team_principal', principalHref, name + ' ' + teamName, teamName || name, id, teamName, name, null);
                    }
                  });
                })
                .catch(function () { return null; });
            });
            return Promise.all(reqs).then(function () { return primaryBySlug; });
          });
      })
      .then(function (primaryBySlug) {
        Object.keys(driverAggBySlug).forEach(function (slugKey) {
          var agg = driverAggBySlug[slugKey];
          var primary = pickPrimaryDriverContext(agg, primaryBySlug, slugKey);
          var legalExtra = legalNameBySlug[slugKey] || '';
          pushSearchItem(
            items,
            dedupe,
            agg.title,
            'driver',
            agg.href,
            [primary.seriesName, primary.teamName, legalExtra].filter(Boolean).join(' '),
            primary.teamName || primary.seriesName,
            primary.seriesID,
            primary.teamName,
            primary.seriesName,
            null
          );
        });
        return API.getDrivers()
          .then(function (drivers) {
            if (!Array.isArray(drivers)) return;
            drivers.forEach(function (d) {
              if (!d || typeof d !== 'object') return;
              var driverName = driverDisplayName(String(d.name || '').trim());
              var dSlug = String(d.slug || '').trim();
              if (!driverName) return;
              if (!dSlug) dSlug = slugify(driverName);
              if (!dSlug) return;
              if (driverAggBySlug[dSlug]) return;
              var searchExtra = String(d.search_extra || '').trim();
              pushSearchItem(
                items,
                dedupe,
                driverName,
                'driver',
                '/driver/' + encodeURIComponent(dSlug),
                searchExtra,
                '',
                '',
                '',
                '',
                null
              );
            });
          })
          .catch(function () { return null; });
      })
      .then(function () {
        state.searchIndexItems = items;
        state.searchIndexReady = true;
      })
      .catch(function () {
        state.searchIndexItems = [];
      })
      .finally(function () {
        state.searchIndexLoading = false;
      })
      .then(function () { return state.searchIndexItems; });
  }

  function initHeaderSearch() {
    if (state.searchInitDone) return;
    state.searchInitDone = true;
    var wrapper = document.getElementById('header-search');
    var toggle = document.getElementById('search-toggle');
    var popover = document.getElementById('search-popover');
    var input = document.getElementById('search-input');
    var results = document.getElementById('search-results');
    if (!wrapper || !toggle || !popover || !input || !results) return;

    function closeSearch() {
      popover.classList.add('hidden');
      toggle.setAttribute('aria-expanded', 'false');
    }

    function openSearch() {
      popover.classList.remove('hidden');
      toggle.setAttribute('aria-expanded', 'true');
      input.focus();
      ensureSearchIndex().then(function () {
        if (!input.value.trim()) results.innerHTML = '';
      });
    }

    function renderSearchResults(query) {
      results.innerHTML = '';
    }

    function navigateToSearch(query) {
      var q = String(query || '').trim();
      if (!q) return;
      closeSearch();
      input.value = '';
      var href = '/search?q=' + encodeURIComponent(q);
      if (window.TGA.navigate) window.TGA.navigate(href);
      else if (window.TGA.route) window.TGA.route();
    }

    toggle.addEventListener('click', function () {
      if (popover.classList.contains('hidden')) openSearch();
      else closeSearch();
    });
    input.addEventListener('input', function () {
      renderSearchResults(input.value);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeSearch();
        toggle.focus();
        return;
      }
      if (e.key === 'Enter') {
        navigateToSearch(input.value);
      }
    });
    document.addEventListener('click', function (e) {
      if (!wrapper.contains(e.target)) closeSearch();
    });
    results.addEventListener('click', function (e) {
      var a = e.target && e.target.closest && e.target.closest('a.search-result-link');
      if (!a) return;
      closeSearch();
      input.value = '';
    });
  }

  function renderSearchPage(query) {
    showView('view-search');
    var q = String(query || '').trim();
    var titleEl = document.getElementById('search-title');
    var metaEl = document.getElementById('search-meta');
    var breadcrumbEl = document.getElementById('search-breadcrumb');
    var contentEl = document.getElementById('search-results-content');
    if (!contentEl) return;
    if (titleEl) titleEl.textContent = 'Search results';
    if (breadcrumbEl) {
      breadcrumbEl.innerHTML =
        '<a href="/">' + (t('breadcrumb.all') || 'All series') + '</a>' +
        '<span class="breadcrumb-sep">/</span><span>' + esc(q || 'Search') + '</span>';
    }
    if (!q) {
      if (metaEl) metaEl.textContent = 'Type query in search box';
      contentEl.innerHTML = '<p class="empty-msg">No query provided.</p>';
      document.title = 'Search — The Grid Archive (TGA)';
      translateStaticUI();
      state.loadedSeriesId = null;
      return;
    }

    var groupsMeta = [
      { key: 'driver', label: 'Drivers' },
      { key: 'team', label: 'Teams' },
      { key: 'team_principal', label: 'Team principals' },
      { key: 'crew_chief', label: 'Crew chiefs' },
      { key: 'Championship', label: 'Championships' },
      { key: 'Season', label: 'Seasons' }
    ];

    function renderFromMatches(matches, driverMetaBySlug, driverPhotoOkBySlug) {
      var total = matches.length;
      if (metaEl) metaEl.textContent = '';
      if (total === 0) {
        contentEl.innerHTML = '<p class="empty-msg">No matches found.</p>';
        translateStaticUI();
        return;
      }
      var byKind = {};
      matches.forEach(function (m) {
        if (!byKind[m.kind]) byKind[m.kind] = [];
        byKind[m.kind].push(m);
      });
      var html = '<div class="search-groups">';
      groupsMeta.forEach(function (g) {
        var list = byKind[g.key] || [];
        if (!list.length) return;
        html += '<section class="search-group">';
        html += '<div class="search-group-header"><span>' + esc(g.label) + '</span><span class="search-group-count">' + list.length + ' matches</span></div>';
        if (g.key === 'driver') {
          html += '<div class="table-wrap"><table class="data-table"><thead><tr>' +
            '<th>name</th><th>nation</th><th>series</th><th>team</th><th>age</th>' +
            '</tr></thead><tbody>';
          list.forEach(function (item) {
            var slug = decodeURIComponent((item.href || '').replace(/^\/driver\//, ''));
            var m = driverMetaBySlug[slug] || {};
            var inferredSeries = '';
            var inferredTeam = '';
            if (m.primary_series_name && String(m.primary_series_name).trim()) {
              inferredSeries = String(m.primary_series_name).trim();
            } else if (m.primary_series_id && String(m.primary_series_id).trim()) {
              inferredSeries = String(m.primary_series_id).trim();
            }
            if (m.primary_team_name && String(m.primary_team_name).trim()) {
              inferredTeam = String(m.primary_team_name).trim();
            } else if (Array.isArray(m.season_results) && m.season_results.length > 0) {
              var firstRes = m.season_results[0] || {};
              if (!inferredSeries) inferredSeries = String(firstRes.series_name || firstRes.series_id || '').trim();
              if (!inferredTeam) inferredTeam = String(firstRes.team_name || '').trim();
            }
            var nation = '—';
            if (m.citizenship && String(m.citizenship).trim()) {
              var parts = String(m.citizenship)
                .split(',')
                .map(function (x) { return String(x).trim(); })
                .filter(function (x) { return x; });
              if (parts.length > 1) {
                var mainNation = parts[parts.length - 1];
                var rest = parts.slice(0, parts.length - 1);
                nation = [mainNation].concat(rest).join(', ');
              } else if (parts.length === 1) {
                nation = parts[0];
              }
            } else if (m.nationality && String(m.nationality).trim()) {
              nation = String(m.nationality).trim();
            }
            var age = '—';
            if (m.birth_date && /^\d{4}-\d{2}-\d{2}$/.test(String(m.birth_date))) {
              var p = String(m.birth_date).split('-');
              var by = parseInt(p[0], 10);
              var bm = parseInt(p[1], 10);
              var bd = parseInt(p[2], 10);
              var now = new Date();
              var a = now.getFullYear() - by;
              var md = now.getMonth() + 1 - bm;
              if (md < 0 || (md === 0 && now.getDate() < bd)) a--;
              age = isNaN(a) ? '—' : String(a);
            }
            var photoUrl = (m.photo_url && String(m.photo_url).trim()) ? String(m.photo_url).trim() : '';
            var photoOk = !!(driverPhotoOkBySlug && driverPhotoOkBySlug[slug]);
            var photoSrc = '/api/driver-thumb/' + encodeURIComponent(slug) + '?_=search-thumb-v4';
            var photoHtml = (photoUrl && photoOk)
              ? '<img class="search-driver-photo" src="' + esc(photoSrc) + '"' +
                ' alt="" loading="lazy" decoding="async">'
              : '<span class="search-driver-photo search-driver-photo--empty" aria-hidden="true"></span>';
            html += '<tr>' +
              '<td><a class="search-page-link search-driver-link" href="' + item.href + '">' + photoHtml + '<span class="search-page-title">' + esc(item.title) + '</span></a></td>' +
              '<td>' + esc(String(nation)) + '</td>' +
              '<td>' + esc(item.seriesName || inferredSeries || '—') + '</td>' +
              '<td>' + esc(normalizeDisplayTeamName(item.teamName || inferredTeam) || '—') + '</td>' +
              '<td class="col-num">' + esc(age) + '</td>' +
              '</tr>';
          });
          html += '</tbody></table></div>';
        } else if (g.key === 'team') {
          html += '<div class="table-wrap"><table class="data-table"><thead><tr>' +
            '<th>name</th><th>series</th><th>base</th><th>licence</th><th>age</th>' +
            '</tr></thead><tbody>';
          list.forEach(function (item) {
            var meta = item.meta || {};
            var teamSlugFromHref = decodeURIComponent((item.href || '').replace(/^\/team\//, ''));
            var teamLogoURL = '/api/team-logo/' + encodeURIComponent(teamSlugFromHref) + '?_=team-logo-v1';
            html += '<tr>' +
              '<td><a class="search-page-link search-team-link" href="' + item.href + '"><img class="search-team-logo" src="' + esc(teamLogoURL) + '" alt="" loading="lazy" decoding="async"><span class="search-page-title">' + esc(item.title) + '</span></a></td>' +
              '<td>' + esc(item.seriesName || '—') + '</td>' +
              '<td>' + esc(meta.base || '—') + '</td>' +
              '<td>' + esc(meta.licence || '—') + '</td>' +
              '<td class="col-num">' + esc(meta.age || '—') + '</td>' +
              '</tr>';
          });
          html += '</tbody></table></div>';
        } else if (g.key === 'team_principal') {
          html += '<div class="table-wrap"><table class="data-table"><thead><tr>' +
            '<th>name</th><th>team</th><th>series</th>' +
            '</tr></thead><tbody>';
          list.forEach(function (item) {
            html += '<tr>' +
              '<td><a class="search-page-link" href="' + item.href + '"><span class="search-page-title">' + esc(item.title) + '</span></a></td>' +
              '<td>' + esc(normalizeDisplayTeamName(item.teamName) || '—') + '</td>' +
              '<td>' + esc(item.seriesName || '—') + '</td>' +
              '</tr>';
          });
          html += '</tbody></table></div>';
        } else if (g.key === 'crew_chief') {
          html += '<div class="table-wrap"><table class="data-table"><thead><tr>' +
            '<th>name</th><th>team</th><th>series</th><th>nationality</th><th>age</th>' +
            '</tr></thead><tbody>';
          list.forEach(function (item) {
            var metaCrew = item.meta || {};
            html += '<tr>' +
              '<td><a class="search-page-link" href="' + item.href + '"><span class="search-page-title">' + esc(item.title) + '</span></a></td>' +
              '<td>' + esc(normalizeDisplayTeamName(item.teamName) || '—') + '</td>' +
              '<td>' + esc(item.seriesName || '—') + '</td>' +
              '<td>' + esc(metaCrew.nationality || '—') + '</td>' +
              '<td class="col-num">' + esc(metaCrew.age || '—') + '</td>' +
              '</tr>';
          });
          html += '</tbody></table></div>';
        } else if (g.key === 'Championship' || g.key === 'Season') {
          html += '<div class="table-wrap"><table class="data-table"><thead><tr>' +
            '<th>name</th>' +
            '</tr></thead><tbody>';
          list.forEach(function (item) {
            html += '<tr>' +
              '<td><a class="search-page-link" href="' + item.href + '"><span class="search-page-title">' + esc(item.title) + '</span></a></td>' +
              '</tr>';
          });
          html += '</tbody></table></div>';
        } else {
          html += '<ul class="search-group-list">';
          list.forEach(function (item) {
            var sub = item.subtext ? '<div class="search-page-sub">' + esc(item.subtext) + '</div>' : '';
            html += '<li><a class="search-page-link" href="' + item.href + '"><span><span class="search-page-title">' + esc(item.title) + '</span>' + sub + '</span></a></li>';
          });
          html += '</ul>';
        }
        html += '</section>';
      });
      html += '</div>';
      contentEl.innerHTML = html;
      translateStaticUI();
    }

    ensureSearchIndex().then(function () {
      var qNorm = normalizeSearchText(q);
      var matches = state.searchIndexItems
        .filter(function (item) { return item.haystack.indexOf(qNorm) !== -1; })
        .sort(function (a, b) { return rankSearchItems(qNorm, a, b); });
      var drivers = matches.filter(function (m) { return m.kind === 'driver'; });
      var driverReqs = drivers.map(function (m) {
        var slug = decodeURIComponent((m.href || '').replace(/^\/driver\//, ''));
        return API.getDriver(slug)
          .then(function (d) { return { slug: slug, data: d || {} }; })
          .catch(function () { return { slug: slug, data: {} }; });
      });
      Promise.all(driverReqs).then(function (arr) {
        var bySlug = {};
        arr.forEach(function (x) { bySlug[x.slug] = x.data || {}; });
        var photoChecks = drivers.map(function (m) {
          var slug = decodeURIComponent((m.href || '').replace(/^\/driver\//, ''));
          var d = bySlug[slug] || {};
          var photoUrl = (d.photo_url && String(d.photo_url).trim()) ? String(d.photo_url).trim() : '';
          photoUrl = getBestDriverPhotoURL(photoUrl);
          return isSearchPhotoHighQuality(photoUrl).then(function (ok) {
            return { slug: slug, ok: ok };
          }).catch(function () {
            return { slug: slug, ok: false };
          });
        });
        Promise.all(photoChecks).then(function (photoArr) {
          var photoBySlug = {};
          photoArr.forEach(function (p) { photoBySlug[p.slug] = !!p.ok; });
          renderFromMatches(matches, bySlug, photoBySlug);
        }).catch(function () {
          renderFromMatches(matches, bySlug, {});
        });
      }).catch(function () {
        renderFromMatches(matches, {}, {});
      });
    }).catch(function () {
      if (metaEl) metaEl.textContent = '"' + q + '"';
      contentEl.innerHTML = '<p class="empty-msg">Failed to load search index.</p>';
      translateStaticUI();
    });
    document.title = 'Search: ' + q + ' — The Grid Archive (TGA)';
    state.loadedSeriesId = null;
  }

  function renderEntityPage(type, slug, placeholder) {
    showView('view-' + type);
    var name = decodeURIComponent(slug).replace(/-+/g, ' ');
    document.getElementById(type + '-title').textContent = name;
    document.getElementById(type + '-meta').textContent = '';
    document.getElementById(type + '-breadcrumb').innerHTML =
      '<a href="/">' + t('breadcrumb.all') + '</a>' +
      '<span class="breadcrumb-sep">/</span>' +
      '<span>' + esc(name) + '</span>';
    document.getElementById(type + '-content').innerHTML = '<p class="empty-msg">' + placeholder + '</p>';
    document.title = name + ' — The Grid Archive (TGA)';
    translateStaticUI();
    state.loadedSeriesId = null;
  }

  /** Slug (as in /track/…) → hero image under /web/images/. */
  var trackPagePhotoBySlug = {
    'rockingham-speedway-rockingham-north-carolina': '/web/images/rockingham-speedway.jpg',
    'rockingham-speedway': '/web/images/rockingham-speedway.jpg',
    'brands-hatch': '/web/images/brands-hatch.jpg',
    'misano-world-circuit-marco-simoncelli': '/web/images/misano.jpg',
    'watkins-glen-international': '/web/images/watkins-glen-international.png',
    'watkins-glen-international-watkins-glen-new-york': '/web/images/watkins-glen-international.png',
    'indianapolis-motor-speedway-road-course': '/web/images/IndyRoadCourse.jpg',
    'circuit-de-spa-francorchamps': '/web/images/Circuit-de-Spa-Francorchamps19.jpg',
    'dover-motor-speedway': '/web/images/Dover-Motor-Speedway.jpg',
    'dover-motor-speedway-dover-delaware': '/web/images/Dover-Motor-Speedway.jpg',
    'seekonk-speedway': '/web/images/seekonk-speedway.jpg',
    'seekonk-speedway-seekonk-massachusetts': '/web/images/seekonk-speedway.jpg',
    'moscow-raceway': '/web/images/moscow-raceway.jpg',
    'toledo-speedway': '/web/images/Toledo-Speedway.jpg',
    'toledo-speedway-toledo-ohio': '/web/images/Toledo-Speedway.jpg',
    'circuit-gilles-villeneuve': '/web/images/circuit-gilles-villeneuve.jpg',
    'charlotte-motor-speedway': '/web/images/charlotte-motor-speedway.jpg',
    'charlotte-motor-speedway-concord-north-carolina': '/web/images/charlotte-motor-speedway.jpg',
    'circuit-zandvoort': '/web/images/zandvoort.jpg',
    'autodromo-di-vallelunga': '/web/images/Autodromo-Vallelunga.png',
    'symmons-plains-raceway': '/web/images/Symmons-Plains-Raceway.jpg',
    'indianapolis-motor-speedway': '/web/images/indianapolis-motor-speedway.jpg',
    'indianapolis-motor-speedway-speedway-indiana': '/web/images/indianapolis-motor-speedway.jpg',
    'monaco-circuit': '/web/images/Monaco-circuit.jpg',
    'circuit-de-monaco': '/web/images/Monaco-circuit.jpg',
    'circuit-de-monaco-monaco': '/web/images/Monaco-circuit.jpg',
    'monza-circuit': '/web/images/monza.png',
    'autodromo-nazionale-di-monza': '/web/images/monza.png',
    'autodromo-nazionale-di-monza-monza-italy': '/web/images/monza.png',
    'monza': '/web/images/monza.png',
    'michigan-international-speedway': '/web/images/michigan-speedway.jpg',
    'michigan-international-speedway-brooklyn-michigan': '/web/images/michigan-speedway.jpg',
    'michigan-speedway': '/web/images/michigan-speedway.jpg',
    'nashville-superspeedway': '/web/images/nashville-superspeedway.jpg',
    'nashville-superspeedway-lebanon-tennessee': '/web/images/nashville-superspeedway.jpg',
    'riverhead-raceway': '/web/images/riverhead-raceway.jpg',
    'riverhead-raceway-riverhead-new-york': '/web/images/riverhead-raceway.jpg',
    'streets-of-detroit': '/web/images/streets-of-detroit.jpg',
    'streets-of-detroit-detroit-michigan': '/web/images/streets-of-detroit.jpg',
    'world-wide-technology-raceway': '/web/images/world-wide-technology-raceway.png',
    'world-wide-technology-raceway-madison-illinois': '/web/images/world-wide-technology-raceway.png',
    'pocono-raceway': '/web/images/Pocono.jpg',
    'pocono-raceway-long-pond-pennsylvania': '/web/images/Pocono.jpg',
    'kazan-ring': '/web/images/kazan-ring.jpg',
    'kazan-ring-tatarstan': '/web/images/kazan-ring.jpg',
    'circuit-de-la-sarthe': '/web/images/Circuit-de-la-Sarthe.jpg',
    'circuit-de-la-sarthe-le-mans': '/web/images/Circuit-de-la-Sarthe.jpg',
    'le-mans': '/web/images/Circuit-de-la-Sarthe.jpg',
    'suzuka-circuit': '/web/images/suzuka-bg.png',
    'suzuka-international-racing-course': '/web/images/suzuka-bg.png',
    'road-america': '/web/images/Road-America.jpg',
    'road-america-elkhart-lake-wisconsin': '/web/images/Road-America.jpg',
    'white-mountain-motorsports-park': '/web/images/White-Mountain-Motorsports-Park.jpg',
    'white-mountain-motorsports-park-north-woodstock-new-hampshire': '/web/images/White-Mountain-Motorsports-Park.jpg',
    'berlin-raceway': '/web/images/Berlin-Raceway.jpg',
    'berlin-raceway-marne-michigan': '/web/images/Berlin-Raceway.jpg',
    'lausitzring': '/web/images/Lausitzring.jpg',
    'hidden-valley-raceway': '/web/images/hidden-valley-raceway.jpg',
    'sepang-international-circuit': '/web/images/sepang.jpg',
    'sepang': '/web/images/sepang.jpg',
    'coronado-street-course': '/web/images/Coronado-street.jpg',
    'coronado-street-course-san-diego-california': '/web/images/Coronado-street.jpg'
  };

  function renderTrackDetail(slug) {
    renderEntityPage('track', slug, t('coming_soon.track'));
    try {
      var dec = decodeURIComponent(String(slug || ''));
      var key = slugify(dec);
      var photoUrl = trackPagePhotoBySlug[key] || trackPagePhotoBySlug[dec.toLowerCase().replace(/^-+|-+$/g, '')];
      if (photoUrl) {
        var trackContent = document.getElementById('track-content');
        if (trackContent) {
          trackContent.innerHTML =
            '<figure class="track-page-photo-wrap"><img class="track-page-photo" src="' + esc(photoUrl) + '" alt=""></figure>' +
            '<p class="empty-msg">' + t('coming_soon.track') + '</p>';
        }
      }
    } catch (err) { /* ignore bad slug */ }
  }
  function driverDetailIsCurrent(reqToken) {
    return reqToken === window.__tgaDriverReqToken;
  }

  function driverDetailPhotoPlaceholderSrc() {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="14" fill="rgba(125,125,125,0.18)"/></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function resetDriverDetailShell(nameFromSlug) {
    var viewEl = document.getElementById('view-driver');
    if (viewEl) viewEl.classList.add('driver-loading');
    document.getElementById('driver-title').textContent = nameFromSlug;
    document.getElementById('driver-meta').textContent = '';
    document.getElementById('driver-breadcrumb').innerHTML =
      '<a href="/">' + t('breadcrumb.all') + '</a>' +
      '<span class="breadcrumb-sep">/</span>' +
      '<span>' + esc(nameFromSlug) + '</span>';
    document.getElementById('driver-content').innerHTML = '<p class="empty-msg">' + t('coming_soon.driver') + '</p>';
    var photoEl = document.getElementById('driver-photo');
    if (photoEl) {
      photoEl.removeAttribute('src');
      photoEl.src = driverDetailPhotoPlaceholderSrc();
      photoEl.alt = '';
    }
  }

  function revealDriverDetail(reqToken) {
    if (!driverDetailIsCurrent(reqToken)) return;
    var viewEl = document.getElementById('view-driver');
    if (viewEl) viewEl.classList.remove('driver-loading');
    translateStaticUI();
  }

  function wireCitizenshipFlagImages(root) {
    if (!root) return;
    var imgs = root.querySelectorAll('.citizenship-flag img');
    for (var i = 0; i < imgs.length; i++) {
      (function (img) {
        img.loading = 'eager';
        if (img.getAttribute('data-flag-wired') === '1') return;
        img.setAttribute('data-flag-wired', '1');
        img.addEventListener('error', function onFlagImgError() {
          var src = String(img.getAttribute('src') || '');
          if (src.indexOf('retry=') >= 0) return;
          img.removeEventListener('error', onFlagImgError);
          img.src = src + (src.indexOf('?') >= 0 ? '&' : '?') + 'retry=' + Date.now();
        });
      })(imgs[i]);
    }
  }

  function renderDriverDetail(slug) {
    // Guard against out-of-order responses on fast driver navigation.
    var reqToken = (window.__tgaDriverReqToken = (window.__tgaDriverReqToken || 0) + 1);
    function titleCaseWords(str) {
      if (!str) return '';
      return String(str)
        .split(/\s+/)
        .filter(Boolean)
        .map(function (w) {
          if (!w) return w;
          return w.charAt(0).toUpperCase() + w.slice(1);
        })
        .join(' ');
    }

    var nameFromSlug = decodeURIComponent(slug).replace(/-+/g, ' ');
    nameFromSlug = titleCaseWords(nameFromSlug);
    resetDriverDetailShell(nameFromSlug);
    showView('view-driver');

    // cache-busting: photo_url from driver_profiles.json may update,
    // but browser may cache old JSON response.
    API.getDriver(slug)
      .then(function (data) {
        if (!driverDetailIsCurrent(reqToken)) return;
        if (!data || typeof data !== 'object') return;
        var canonicalSlug = String(data.canonical_slug || '').trim();
        if (canonicalSlug && canonicalSlug !== slug) {
          var canonPath = '/driver/' + encodeURIComponent(canonicalSlug);
          if (window.location.pathname !== canonPath) {
            history.replaceState(null, '', canonPath);
            renderDriverDetail(canonicalSlug);
            return;
          }
        }
        var displayName = (data.name && String(data.name).trim()) ? String(data.name).trim() : '';
        var legalFullName = (data.legal_full_name && String(data.legal_full_name).trim()) ? String(data.legal_full_name).trim() : '';
        var metaPartsHtml = [];
        var flagPrefetchIsos = {};
        var flagPrefetchPromises = [];
        function prefetchFlagIso(iso) {
          if (!iso) return;
          var key = String(iso).toLowerCase();
          if (flagPrefetchIsos[key]) return;
          flagPrefetchIsos[key] = true;
          flagPrefetchPromises.push(
            fetch('/api/flag/' + key + '.png', { credentials: 'same-origin' }).catch(function () {})
          );
        }
        if (legalFullName) {
          metaPartsHtml.push('Full name: ' + esc(legalFullName));
        }
        var titleEl = document.getElementById('driver-title');
        if (titleEl && displayName) {
          titleEl.textContent = displayName;
        } else if (titleEl && legalFullName) {
          titleEl.textContent = legalFullName.split(/\s+/).slice(0, 1).concat(legalFullName.split(/\s+/).slice(-1)).join(' ');
        }
        if (data.citizenship && data.citizenship.trim()) {
          function isoFromCountry(country) {
            if (!country) return '';
            var c = String(country).trim();
            if (!c) return '';
            if (/^[A-Za-z]{2}$/.test(c)) return c.toUpperCase();
            var lower = c.toLowerCase();
            var aliases = {
              'great britain': 'GB', 'britain': 'GB', 'uk': 'GB', 'united kingdom': 'GB', 'england': 'GB',
              'italy': 'IT', 'italian': 'IT', 'italian republic': 'IT', 'monaco': 'MC', 'monegasque': 'MC',
              'spain': 'ES', 'españa': 'ES', 'kingdom of spain': 'ES',
              'belgium': 'BE', 'kingdom of belgium': 'BE',
              'france': 'FR', 'french republic': 'FR',
              'germany': 'DE', 'deutschland': 'DE', 'federal republic of germany': 'DE', 'german': 'DE',
              'new zealand': 'NZ', 'aotearoa': 'NZ',
              'australia': 'AU', 'commonwealth of australia': 'AU',
              'canada': 'CA', 'canadian': 'CA',
              'mexico': 'MX', 'mexican': 'MX',
              'argentina': 'AR', 'argentine republic': 'AR', 'republic of argentina': 'AR',
              'brazil': 'BR', 'brasil': 'BR', 'federative republic of brazil': 'BR', 'republic of brazil': 'BR',
              'netherlands': 'NL', 'holland': 'NL', 'kingdom of the netherlands': 'NL',
              'thailand': 'TH', 'thai': 'TH', 'kingdom of thailand': 'TH',
              'finland': 'FI', 'republic of finland': 'FI',
              'denmark': 'DK', 'kingdom of denmark': 'DK', 'danish': 'DK',
              'norway': 'NO', 'kingdom of norway': 'NO', 'norwegian': 'NO',
              'russia': 'RU', 'russian federation': 'RU',
              'usa': 'US', 'united states': 'US', 'united states of america': 'US',
              'sweden': 'SE', 'switzerland': 'CH', 'austria': 'AT', 'poland': 'PL',
              'czech republic': 'CZ', 'czechia': 'CZ', 'hungary': 'HU', 'portugal': 'PT',
              'ireland': 'IE', 'iceland': 'IS', 'luxembourg': 'LU', 'andorra': 'AD',
              'san marino': 'SM', 'china': 'CN', 'japan': 'JP', 'korea': 'KR', 'south korea': 'KR',
              'india': 'IN', 'indonesia': 'ID', 'malaysia': 'MY', 'singapore': 'SG',
              'philippines': 'PH', 'taiwan': 'TW', 'hong kong': 'HK',
              'south africa': 'ZA', 'morocco': 'MA', 'algeria': 'DZ', 'egypt': 'EG',
              'chile': 'CL', 'colombia': 'CO', 'ecuador': 'EC', 'peru': 'PE', 'uruguay': 'UY',
              'paraguay': 'PY', 'bolivia': 'BO', 'venezuela': 'VE',
              'cayman islands': 'KY', 'caymanian': 'KY', 'barbados': 'BB', 'barbadian': 'BB',
              'lithuania': 'LT', 'latvia': 'LV', 'estonia': 'EE',
              'romania': 'RO', 'bulgaria': 'BG', 'slovakia': 'SK', 'slovenia': 'SI',
              'croatia': 'HR', 'serbia': 'RS', 'greece': 'GR', 'turkey': 'TR',
              'israel': 'IL', 'uae': 'AE', 'united arab emirates': 'AE', 'qatar': 'QA',
              'saudi arabia': 'SA', 'kuwait': 'KW', 'bahrain': 'BH'
            };
            return aliases[lower] || '';
          }

          function flagHtmlFromIso(iso) {
            if (!iso) return '';
            iso = String(iso).toUpperCase();
            if (!/^[A-Z]{2}$/.test(iso)) return '';
            var png = '/api/flag/' + iso.toLowerCase() + '.png';
            return '<span class="citizenship-flag">' +
              '<img src="' + esc(png) + '" width="18" height="12" alt="" loading="eager" decoding="async">' +
              '</span>';
          }

          function splitCitizenships(citizenshipStr) {
            var s = String(citizenshipStr || '').trim();
            if (!s) return [];
            // Normalize common separators to commas.
            s = s
              .replace(/\s*;\s*/g, ',')
              .replace(/\s*,\s*/g, ',')
              .replace(/\s*\+\s*/g, ',')
              .replace(/\s*\/\s*/g, ',')
              .replace(/\s*&\s*/g, ',')
              .replace(/\s+and\s+/gi, ',')
              .replace(/\s+or\s+/gi, ',');
            return s
              .split(',')
              .map(function (x) {
                var v = String(x).trim();
                var lower = v.toLowerCase();
                if (lower === 'britain' || lower === 'uk' || lower === 'united kingdom') return 'Great Britain';
                return v;
              })
              .filter(function (x) { return x; });
          }

          var citizenshipCountries = splitCitizenships(data.citizenship);
          if (citizenshipCountries.length > 0) {
            // "Primary" racing citizenship is the last element in the string.
            // Examples from driver_profiles.json:
            // - Albon: "Britain, Thailand" => primary Thailand
            // - Verstappen: "Belgium, Netherlands" => primary Netherlands
            var mainCountry = citizenshipCountries[citizenshipCountries.length - 1];

            // Order: primary on top, others below in original order.
            var orderedCountries = [mainCountry];
            for (var i = 0; i < citizenshipCountries.length - 1; i++) {
              orderedCountries.push(citizenshipCountries[i]);
            }

            var citizenshipPartsHtml = orderedCountries.map(function (country) {
              var iso = isoFromCountry(country);
              prefetchFlagIso(iso);
              var flagHtml = flagHtmlFromIso(iso);
              return (flagHtml ? flagHtml + ' ' : '') + esc(country);
            });

            if (citizenshipCountries.length > 1) {
              metaPartsHtml.push(esc(t('driver.citizenship')) + ':<br>' + citizenshipPartsHtml.join('<br>'));
            } else {
              metaPartsHtml.push(esc(t('driver.citizenship')) + ': ' + citizenshipPartsHtml[0]);
            }
          }
        } else if (data.nationality && data.nationality.trim()) {
          // fallback when citizenship not yet filled
          metaPartsHtml.push(esc(data.nationality.trim()));
        }
        function formatBirthDate(dateStr) {
          // API usually returns YYYY-MM-DD. Driver page needs DD-MM-YYYY.
          var s = String(dateStr || '').trim();
          var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
          if (!m) return s;
          return m[3] + '-' + m[2] + '-' + m[1];
        }
        function calcAgeAt(birthDateStr, refDateStr) {
          var birthM = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(birthDateStr || '').trim());
          var refM = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(refDateStr || '').trim());
          if (!birthM || !refM) return null;
          var by = parseInt(birthM[1], 10);
          var bmo = parseInt(birthM[2], 10);
          var bd = parseInt(birthM[3], 10);
          var ry = parseInt(refM[1], 10);
          var rmo = parseInt(refM[2], 10);
          var rd = parseInt(refM[3], 10);
          if (!by || !bmo || !bd || !ry || !rmo || !rd) return null;
          var age = ry - by;
          if (rmo < bmo || (rmo === bmo && rd < bd)) age--;
          return age;
        }
        function calcBirthAge(dateStr) {
          var ref = (data.death_date && String(data.death_date).trim()) ? String(data.death_date).trim() : null;
          if (ref) return calcAgeAt(dateStr, ref);
          var s = String(dateStr || '').trim();
          var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
          if (!m) return null;
          var y = parseInt(m[1], 10);
          var mo = parseInt(m[2], 10);
          var d = parseInt(m[3], 10);
          if (!y || !mo || !d) return null;
          var now = new Date();
          var age = now.getFullYear() - y;
          var monthDiff = now.getMonth() - (mo - 1);
          if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < d)) age--;
          return age;
        }
        if (data.birth_date && data.birth_date.trim()) {
          var birthDateStr = data.birth_date.trim();
          var formattedBirth = formatBirthDate(birthDateStr);
          var birthAge = calcBirthAge(birthDateStr);
          metaPartsHtml.push(
            'Born: ' +
            esc(formattedBirth) +
            (birthAge !== null && birthAge !== undefined && !data.death_date ? ' (' + esc(String(birthAge)) + ')' : '')
          );
        }
        if (data.birth_place && data.birth_place.trim()) {
          metaPartsHtml.push('Home town: ' + esc(data.birth_place.trim()));
        }
        if (data.death_date && data.death_date.trim()) {
          var deathDateStr = data.death_date.trim();
          var formattedDeath = formatBirthDate(deathDateStr);
          var deathAge = calcAgeAt(data.birth_date, deathDateStr);
          metaPartsHtml.push(
            'Died: ' +
            esc(formattedDeath) +
            (deathAge !== null && deathAge !== undefined ? ' (aged ' + esc(String(deathAge)) + ')' : '')
          );
        }
        // Vertical list of rows.
        function commitDriverMetaHtml() {
          if (!driverDetailIsCurrent(reqToken)) return;
          var metaEl = document.getElementById('driver-meta');
          metaEl.innerHTML = metaPartsHtml.join('<br>');
          wireCitizenshipFlagImages(metaEl);
          revealDriverDetail(reqToken);
        }
        if (flagPrefetchPromises.length > 0) {
          Promise.all(flagPrefetchPromises).finally(function () {
            commitDriverMetaHtml();
          });
        } else {
          commitDriverMetaHtml();
        }
        if (!driverDetailIsCurrent(reqToken)) return;
        document.title = (data.name || nameFromSlug) + ' — The Grid Archive (TGA)';

        // Driver photo (placeholder when not provided)
        var photoEl = document.getElementById('driver-photo');
        if (photoEl) {
          var photoUrl = (data.photo_url && data.photo_url.trim()) ? data.photo_url.trim() : '';
          if (!photoUrl) {
            photoEl.src = driverDetailPhotoPlaceholderSrc();
          } else {
            // Cache-buster ensures new request on each SPA navigation.
            // Do not reset src to '' to avoid extra request to current page
            // and avoid "batching" two assignments in a row.
            var sep = photoUrl.indexOf('?') >= 0 ? '&' : '?';
            var newSrc = photoUrl + sep + '_=' + Date.now();
            // Full reset without side-effect request.
            photoEl.removeAttribute('src');
            // Just in case: prevent browser from deferring load.
            photoEl.loading = 'eager';
            photoEl.src = newSrc;
          }
          photoEl.alt = data.name ? (data.name + ' photo') : 'Driver photo';
        }

        if (!driverDetailIsCurrent(reqToken)) return;
        var contentEl = document.getElementById('driver-content');
        var results = data.season_results;
        var season = data.season || '';
        if (Array.isArray(results) && results.length > 0) {
          var hasRaceName = results.some(function (r) {
            return r && r.race_name && String(r.race_name).trim() !== '';
          });
          // For F1: if sprint exists within same event_id, Feature must
          // be the second row. Otherwise do not show "Feature".
          var hasSprintByEvent = {};
          results.forEach(function (r) {
            if (!r) return;
            var seriesIdUpper = String(r.series_id || '').toUpperCase();
            if (seriesIdUpper !== 'F1') return;
            var raw = (r.race_name || '').toString();
            if (/sprint/i.test(raw)) {
              hasSprintByEvent[r.event_id] = true;
            }
          });
          var tableRows = results.map(function (row) {
            var eventName = (row.event_name && row.event_name.trim()) ? esc(row.event_name) : (row.event_id || '—');
            var eventHref = (row.event_id) ? '/event/' + encodeURIComponent((row.event_id + '').toLowerCase().replace(/_/g, '-')) : '#';
            var eventCell = eventHref !== '#' ? '<a href="' + eventHref + '" class="event-link">' + eventName + '</a>' : eventName;
            var raceCell = '';
            if (hasRaceName) {
              var raceLabel = '';
              var rawRaceName = (row.race_name || '').trim();
              if (rawRaceName) {
                var seriesIdUpper = String(row.series_id || '').toUpperCase();
                if (seriesIdUpper === 'F1') {
                  // For F1 want short label: "Sprint" instead of "Sprint Results",
                  // main race may stay unlabeled.
                  if (/sprint/i.test(rawRaceName)) {
                    raceLabel = 'Sprint';
                  } else {
                    // Show Feature only if sprint exists in same event_id.
                    raceLabel = hasSprintByEvent[row.event_id] ? 'Feature' : '';
                  }
                } else {
                  raceLabel = rawRaceName;
                }
              }
              raceCell = '<td>' + esc(raceLabel) + '</td>';
            }
            return '<tr data-series-id="' + esc(row.series_id || '') + '" data-event-id="' + esc(row.event_id || '') + '">' +
              '<td>' + esc(row.series_name || row.series_id || '—') + '</td>' +
              '<td>' + eventCell + '</td>' +
              raceCell +
              '<td class="col-num">' + (row.position != null ? row.position : '—') + '</td>' +
              '<td class="col-num">' + (row.points != null ? row.points : '—') + '</td>' +
              (row.car_number ? '<td class="col-num">' + esc(row.car_number) + '</td>' : '') +
              '<td>' + (row.laps != null ? row.laps : '') + '</td>' +
              (row.status ? '<td>' + esc(row.status) + '</td>' : '') +
              '</tr>';
          });
          var carHeader = results.some(function (r) { return r.car_number; }) ? '<th class="col-num">' + t('th.no') + '</th>' : '';
          var statusHeader = results.some(function (r) { return r.status; }) ? '<th>' + t('th.status') + '</th>' : '';
          contentEl.innerHTML =
            '<h4 class="table-section-title">' + esc(t('driver.season_results')) + (season ? ' ' + esc(season) : '') + '</h4>' +
            '<div class="table-wrap"><table class="data-table">' +
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

          // Merge repeated cells in Series/Event columns
          // for consecutive rows with same event_id.
          var tableEl = contentEl.querySelector('table.data-table');
          if (tableEl && tableEl.tBodies && tableEl.tBodies.length) {
            var tbody = tableEl.tBodies[0];
            var rows = Array.prototype.slice.call(tbody.rows || []);
            if (rows.length > 1) {
              // Columns: 0 = Series, 1 = Event
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
                    // hide duplicate cells on lower rows
                    for (var k = start + 1; k < end; k++) {
                      if (rows[k].cells[colIndex]) rows[k].cells[colIndex].style.display = 'none';
                    }
                  }
                  i = end;
                }
              }

              mergeByKey(0, function (tr) {
                // Series must merge only within one event
                return (tr.getAttribute('data-series-id') || '') + '|' + (tr.getAttribute('data-event-id') || '');
              });
              mergeByKey(1, function (tr) {
                return tr.getAttribute('data-event-id') || '';
              });
            }
          }
        } else {
          contentEl.innerHTML = '<p class="empty-msg">' + t('driver.no_season_results') + '</p>';
        }
      })
      .catch(function () {
        if (!driverDetailIsCurrent(reqToken)) return;
        var contentEl = document.getElementById('driver-content');
        if (contentEl) contentEl.innerHTML = '<p class="empty-msg">' + (t('error.load_failed') || 'Failed to load. Please try again.') + '</p>';
        revealDriverDetail(reqToken);
      });
    state.loadedSeriesId = null;
  }
  function renderTeamDetail(slug) {
    renderEntityPage('team', slug, t('coming_soon.team'));
  }
  function renderCrewChiefDetail(slug) {
    renderEntityPage('crew-chief', slug, t('coming_soon.crew_chief'));
  }

  // Page handlers for lib/router.js (registered before initRouter)
  window.TGA.showView = showView;
  window.TGA.renderSearchPage = renderSearchPage;
  window.TGA.renderTrackDetail = renderTrackDetail;
  window.TGA.renderDriverDetail = renderDriverDetail;
  window.TGA.renderTeamDetail = renderTeamDetail;
  window.TGA.renderCrewChiefDetail = renderCrewChiefDetail;

  // Initialize static translations
  if (window.TGA.updateLangUI) window.TGA.updateLangUI();
  else translateStaticUI();
  var footerEl = document.getElementById('footer-text');
  if (footerEl) footerEl.textContent = t('footer');

  initHeaderSearch();
  if (window.TGA.initRouter) window.TGA.initRouter();


})();
