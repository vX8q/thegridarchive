(function () {
  // Extra haystack terms for series that do not literally contain common queries.
  window.TGA_SEARCH_ALIASES = {
    F4_IT: 'formula 4 italian italy f4 italia',
    FREC: 'formula 4 regional europe frec'
  };

  // Series priority for search ranking (highest -> lowest).
  window.TGA_SEARCH_PRIORITY = [
    'F1',
    'INDYCAR',
    'WEC',
    'NASCAR_CUP',
    'SUPER_FORMULA',
    'IMSA',
    'DTM',
    'SUPER_GT',
    'F2',
    'GTWCE_END',
    'GTWCE_SPRINT',
    'ELMS',
    'SUPERCARS',
    'NOAPS',
    'F3',
    'NASCAR_TRUCK',
    'PSC',
    'ARCA',
    'FREC',
    'F4_IT',
    'NASCAR_MODIFIED'
  ];
})();
