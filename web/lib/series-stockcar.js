// Stock-car helpers shared by series standings/schedule UI.
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  window.TGA = window.TGA || {};

  var PLAYOFF_CUTLINE = {
    nascar_cup: 16,
    noaps: 12,
    nascar_truck: 10
  };

  window.TGA.stockcarPlayoffCutline = function (seriesKey) {
    var sk = String(seriesKey || '').toLowerCase();
    return PLAYOFF_CUTLINE[sk] || 0;
  };

  window.TGA.stockcarPlayoffRowClass = function (seriesKey, posNum) {
    var cut = window.TGA.stockcarPlayoffCutline(seriesKey);
    var pos = Number(posNum);
    if (!cut || !pos) return '';
    return pos === cut + 1 ? ' standings-playoff-cutline' : '';
  };
})();
