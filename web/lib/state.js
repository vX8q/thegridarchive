// web/lib/state.js — shared UI state (window.TGA._state)
// Load after fetch-json.js, before tga-i18n.js / tga-utils.js / app.js
(function () {
  'use strict';
  window.TGA = window.TGA || {};
  var s = window.TGA._state;
  if (!s || typeof s !== 'object') {
    s = window.TGA._state = {};
  }
  if (s.loadedSeriesId === undefined) s.loadedSeriesId = null;
  if (!s.eventCache) s.eventCache = {};
  if (s.eventPageLoadGeneration === undefined) s.eventPageLoadGeneration = 0;
  if (s.searchIndexReady === undefined) s.searchIndexReady = false;
  if (s.searchIndexLoading === undefined) s.searchIndexLoading = false;
  if (s.searchInitDone === undefined) s.searchInitDone = false;
  if (!s.searchIndexItems) s.searchIndexItems = [];
  if (!s.driverPhotoQualityCache) s.driverPhotoQualityCache = {};
})();
