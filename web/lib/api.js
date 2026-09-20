// web/lib/api.js — HTTP API client (wraps window.TGA.fetchJSON)
// Load after utils/fetch-json.js, before app.js and page modules.
(function () {
  'use strict';
  window.TGA = window.TGA || {};

  function fetchJSON(url, options) {
    var fn = window.TGA.fetchJSON;
    if (typeof fn !== 'function') {
      return fetch(url, options || {}).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status + (r.statusText ? ' ' + r.statusText : ''));
        return r.json();
      });
    }
    return fn(url, options);
  }

  var BASE = '/api';

  function normalizeSeriesApiId(seriesId) {
    var s = String(seriesId || '').toLowerCase().trim().replace(/-/g, '_');
    if (s === 'nascar_xfinity') s = 'noaps';
    if (!/^f1_\d{4}$/.test(s)) {
      s = s.replace(/_(\d{4})$/, function (_m, y) {
        return (y >= '2000' && y <= '2099') ? '' : '_' + y;
      });
    }
    return s.replace(/_+$/, '');
  }

  function seriesPath(seriesId) {
    return encodeURIComponent(normalizeSeriesApiId(seriesId));
  }

  function eventPath(eventId) {
    return encodeURIComponent(String(eventId || '').toLowerCase());
  }

  function driverPath(slug) {
    return encodeURIComponent(String(slug || '').trim());
  }

  function buildQuery(params) {
    if (!params) return '';
    var parts = [];
    for (var key in params) {
      if (!Object.prototype.hasOwnProperty.call(params, key)) continue;
      var val = params[key];
      if (val == null || val === '') continue;
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(val)));
    }
    return parts.length ? '?' + parts.join('&') : '';
  }

  function get(url, options) {
    return fetchJSON(url, options);
  }

  /**
   * @param {object} [options]
   * @param {boolean} [options.cacheBust=false] — append _=timestamp (opt-in; APIs already send max-age)
   */
  function seriesEventsQuery(season, options) {
    options = options || {};
    var params = {};
    if (season != null && season !== '') params.season = season;
    if (options.cacheBust === true) params._ = Date.now();
    return buildQuery(params);
  }

  function eventQuery(options) {
    options = options || {};
    if (options.cacheBust === true) return buildQuery({ _: Date.now() });
    return '';
  }

  function driverQuery(options) {
    return eventQuery(options);
  }

  var API = {
    getSeries: function () {
      return get(BASE + '/series');
    },

    getSeriesMeta: function (seriesId) {
      return get(BASE + '/series/' + seriesPath(seriesId));
    },

    getSeriesTeams: function (seriesId) {
      return get(BASE + '/series/' + seriesPath(seriesId) + '/teams');
    },

    /** All series teams for the season, keyed by lowercase data series id. */
    getAllSeriesTeams: function (season, options) {
      var params = {};
      if (season != null && season !== '') params.season = season;
      if (options && options.cacheBust === true) params._ = Date.now();
      return get(BASE + '/teams' + buildQuery(params));
    },

    getSeriesStandings: function (seriesId, options) {
      var q = options && options.cacheBust === true ? buildQuery({ _: Date.now() }) : '';
      return get(BASE + '/series/' + seriesPath(seriesId) + '/standings' + q);
    },

    getSeriesStats: function (seriesId, options) {
      var params = {};
      if (options && options.season != null && options.season !== '') params.season = options.season;
      if (options && options.cacheBust === true) params._ = Date.now();
      return get(BASE + '/series/' + seriesPath(seriesId) + '/stats' + buildQuery(params));
    },

    getSeriesEvents: function (seriesId, season, options) {
      return get(BASE + '/series/' + seriesPath(seriesId) + '/events' + seriesEventsQuery(season, options));
    },

    getSchedule: function (season, options) {
      var params = {};
      if (season != null && season !== '') params.season = season;
      if (options && options.cacheBust === true) params._ = Date.now();
      return get(BASE + '/schedule' + buildQuery(params));
    },

    getSeriesHistory: function (seriesId) {
      return get(BASE + '/series/' + seriesPath(seriesId) + '/history');
    },

    getEvent: function (eventId, options) {
      return get(BASE + '/events/' + eventPath(eventId) + eventQuery(options));
    },

    /** Slim Last Results payloads: { [EVENT_ID]: { id, winners, range_start, range_end, ... } } */
    getEventSummaries: function (eventIds, options) {
      var ids = (Array.isArray(eventIds) ? eventIds : [])
        .map(function (id) { return String(id || '').trim(); })
        .filter(Boolean);
      if (ids.length === 0) {
        return Promise.resolve({});
      }
      var params = { ids: ids.join(',') };
      if (options && options.cacheBust === true) params._ = Date.now();
      return get(BASE + '/events/summaries' + buildQuery(params));
    },

    getEventSummary: function (eventId, options) {
      return get(BASE + '/events/' + eventPath(eventId) + '/summary' + eventQuery(options));
    },

    getDriver: function (slug, options) {
      return get(BASE + '/driver/' + driverPath(slug) + driverQuery(options));
    },

    getDrivers: function () {
      return get(BASE + '/drivers');
    },

    getDriversPrimaryContext: function () {
      return get(BASE + '/drivers/primary-context');
    },

    getDriverProfileRedirects: function () {
      return get(BASE + '/driver-profile-redirects');
    },

    getTeam: function (slug, options) {
      var q = '';
      if (options && typeof options === 'object') {
        var parts = [];
        if (options.season) parts.push('season=' + encodeURIComponent(options.season));
        if (options.series) parts.push('series=' + encodeURIComponent(options.series));
        if (parts.length) q = '?' + parts.join('&');
      }
      return get(BASE + '/team/' + encodeURIComponent(String(slug || '').trim()) + q);
    },

    getTeamProfileRedirects: function () {
      return get(BASE + '/team-profile-redirects');
    },

    getLiveEvents: function () {
      return get(BASE + '/live-events');
    },


    getLiveBoards: function () {
      return get(BASE + '/live-boards?_=' + Date.now());
    },
    getNASCARLive: function () {
      return get(BASE + '/live-boards?_=' + Date.now());
    },

    /** @deprecated Prefer specific methods; escape hatch for one-off URLs. */
    fetchJSON: fetchJSON
  };

  API.safe = function (fn) {
    return Promise.resolve().then(fn).catch(function (err) {
      if (window.TGA.logger && typeof window.TGA.logger.error === 'function') {
        window.TGA.logger.error('API error', err);
      }
      throw err;
    });
  };

  window.TGA.API = API;
})();
