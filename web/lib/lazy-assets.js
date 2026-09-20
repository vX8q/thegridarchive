// web/lib/lazy-assets.js — on-demand script loading for RU dictionaries, series data, and page modules.
// Load before tga-i18n.js / pages that need these assets.
(function () {
  'use strict';
  window.TGA = window.TGA || {};

  var loading = {};
  var loaded = {};

  function loadScript(src) {
    if (loaded[src]) return Promise.resolve();
    if (loading[src]) return loading[src];
    loading[src] = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      // Ordered: download in parallel, execute in insertion order.
      s.async = false;
      s.onload = function () {
        loaded[src] = true;
        delete loading[src];
        resolve();
      };
      s.onerror = function () {
        delete loading[src];
        reject(new Error('Failed to load ' + src));
      };
      document.head.appendChild(s);
    });
    return loading[src];
  }

  function loadAll(srcs) {
    return Promise.all(srcs.map(function (src) { return loadScript(src); }));
  }

  function memoizeLoad(loadFn) {
    var p = null;
    return function () {
      if (!p) {
        p = loadFn().catch(function (err) {
          p = null;
          throw err;
        });
      }
      return p;
    };
  }

  var RU_SCRIPTS = [
    '/web/utils/localize-ru-data.js',
    '/web/utils/driver-season-ru.js',
    '/web/utils/spec-value-ru.js',
    '/web/utils/spec-key-ru-extended.js',
    '/web/utils/spec-key-ru-f1-2025.js',
    '/web/utils/spec-value-f2-f3.js',
    '/web/utils/spec-value-indycar-nascar.js',
    '/web/utils/spec-value-stockcar-extended.js',
    '/web/utils/name-translit-ru.js',
    '/web/utils/place-names-ru.js',
    '/web/utils/driver-names-ru.js',
    '/web/utils/driver-name-ru-resolve.js',
    '/web/utils/team-names-ru.js',
    '/web/utils/event-names-ru.js'
  ];

  var SERIES_DATA_SCRIPTS = [
    '/web/data/f1-tech-spec-2024.js',
    '/web/data/f1-tech-spec-2025.js',
    '/web/data/f1-tech-spec-2026.js',
    '/web/data/imsa-classes-spec.js',
    '/web/data/series-classes-spec.js'
  ];

  var SERIES_PAGE_SCRIPTS = [
    '/web/tga-series.js',
    '/web/lib/series-stockcar.js',
    '/web/pages/series.js'
  ];

  var EVENT_PAGE_SCRIPTS = [
    '/web/lib/event-tables.js',
    '/web/lib/event-page-helpers.js',
    '/web/lib/endurance-race.js',
    '/web/lib/stockcar-race.js',
    '/web/lib/openwheel-race.js',
    '/web/lib/f1-event-normalize.js',
    '/web/lib/touring-race.js',
    '/web/lib/event-pit-stops.js',
    '/web/lib/event-bop.js',
    '/web/lib/event-race-content.js',
    '/web/lib/event-entry-list.js?v=co-driver1',
    '/web/pages/event.js'
  ];

  var DRIVER_PAGE_SCRIPTS = [
    '/web/pages/driver.js?v=staff-season1'
  ];

  var TEAM_PAGE_SCRIPTS = [
    '/web/lib/series-stockcar.js',
    '/web/pages/team.js?v=staff-season1'
  ];

  window.TGA.ensureRuAssets = memoizeLoad(function () {
    return loadAll(RU_SCRIPTS).catch(function (err) {
      if (window.TGA.logger && typeof window.TGA.logger.error === 'function') {
        window.TGA.logger.error('RU assets load failed', err);
      }
      throw err;
    });
  });

  window.TGA.ensureSeriesDataAssets = memoizeLoad(function () {
    return loadAll(SERIES_DATA_SCRIPTS);
  });

  window.TGA.ensureSeriesPageAssets = memoizeLoad(function () {
    return loadAll(SERIES_PAGE_SCRIPTS);
  });

  window.TGA.ensureEventPageAssets = memoizeLoad(function () {
    return loadAll(EVENT_PAGE_SCRIPTS);
  });

  window.TGA.ensureDriverPageAssets = memoizeLoad(function () {
    return loadAll(DRIVER_PAGE_SCRIPTS);
  });

  window.TGA.ensureTeamPageAssets = memoizeLoad(function () {
    return loadAll(TEAM_PAGE_SCRIPTS);
  });

  window.TGA.ensureRoutePageAssets = function (path) {
    var p = String(path || '');
    var tasks = [];
    if (p.indexOf('/series/') === 0 || p.indexOf('/season/') === 0) {
      if (typeof window.TGA.ensureSeriesPageAssets === 'function') tasks.push(window.TGA.ensureSeriesPageAssets());
    } else if (p.indexOf('/event/') === 0) {
      if (typeof window.TGA.ensureEventPageAssets === 'function') tasks.push(window.TGA.ensureEventPageAssets());
    } else if (p.indexOf('/driver/') === 0) {
      if (typeof window.TGA.ensureDriverPageAssets === 'function') tasks.push(window.TGA.ensureDriverPageAssets());
    } else if (p.indexOf('/team/') === 0) {
      if (typeof window.TGA.ensureTeamPageAssets === 'function') tasks.push(window.TGA.ensureTeamPageAssets());
    }
    return tasks.length ? Promise.all(tasks) : Promise.resolve();
  };
})();
