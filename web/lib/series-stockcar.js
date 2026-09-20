// Stock-car helpers shared by series standings/schedule UI.
// Also owns FT/PT series allowlist (shared with team profile roster).
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  window.TGA = window.TGA || {};

  var PLAYOFF_CUTLINE = {
    nascar_cup: 16,
    noaps: 12,
    nascar_truck: 10
  };

  // Matches internal/schedulefile.seriesUsesFullTimeFlag — stock-car + Supercars only.
  var FT_PT_SERIES = {
    nascar_cup: 1,
    noaps: 1,
    nascar_xfinity: 1,
    nascar_truck: 1,
    arca: 1,
    nascar_modified: 1,
    supercars: 1
  };

  window.TGA.seriesUsesFullTimeFlag = function (seriesId) {
    var sid = String(seriesId || '').toLowerCase().replace(/-/g, '_');
    if (sid.indexOf('f1_') === 0) sid = 'f1';
    if (sid === 'nascar_xfinity') sid = 'noaps';
    return !!FT_PT_SERIES[sid];
  };

  window.TGA.stockcarPlayoffCutline = function (seriesKey, standings) {
    if (standings && standings.chase && Number(standings.chase.cutline) > 0) {
      return Number(standings.chase.cutline);
    }
    var sk = String(seriesKey || '').toLowerCase();
    return PLAYOFF_CUTLINE[sk] || 0;
  };

  window.TGA.stockcarPlayoffRowClass = function (seriesKey, posNum, row, standings) {
    var cut = window.TGA.stockcarPlayoffCutline(seriesKey, standings);
    var pos = Number(posNum);
    var cls = '';
    if (cut && pos === cut + 1) cls += ' standings-playoff-cutline';
    var status = row && row.chase_status ? String(row.chase_status) : '';
    if (status === 'eliminated') cls += ' standings-chase-eliminated';
    if (status === 'locked') cls += ' standings-chase-locked';
    return cls;
  };

  window.TGA.stockcarChaseRoundLabelKey = function (round) {
    var r = String(round || '').toLowerCase();
    if (!r) return '';
    return 'standings.chase_round.' + r;
  };
})();
