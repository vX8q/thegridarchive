// tga-series.js — F1 tech-spec aliases for series pages.
// History tables and teams HTML live in web/pages/series.js.
// Depends: lib/state.js. Load before app.js.

(function () {
  'use strict';
  window.TGA = window.TGA || {};

  window.TGA.F1_2024_TECH_SPEC = (typeof window !== 'undefined' && window.F1_2024_TECH_SPEC) || [];
  window.TGA.F1_2025_TECH_SPEC = (typeof window !== 'undefined' && window.F1_2025_TECH_SPEC) || [];
})();
