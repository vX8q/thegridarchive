// Schedule / event venue fields: circuit_name|track vs location.
// Conventions (see SERIES_TEMPLATES checklist):
//   circuit_name / track — venue name; layout suffix when needed ("Charlotte Motor Speedway Roval").
//   location — geography only (City, State / City, Region); no separate country field in JSON today.
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  window.TGA = window.TGA || {};

  /** @type {readonly string[]} */
  var STOCK_CAR_SERIES_IDS = ['nascar_cup', 'noaps', 'nascar_truck', 'arca', 'nascar_modified'];

  /**
   * Legacy stockcar schedules stored "Track, City, State" in circuit_name (often duplicated in location).
   * Migrated rows: circuit_name has no comma; location is "City, State" only.
   * Do not split when fields are already separated — avoids cutting migrated data or layout suffixes.
   */
  function isStockCarLegacyCombinedCircuit(circuit, location) {
    circuit = String(circuit || '').trim();
    location = String(location || '').trim();
    if (!circuit || circuit.indexOf(', ') < 0) return false;
    if (!location) return true;
    if (circuit === location) return true;
    var tail = circuit.slice(circuit.indexOf(', ') + 2).trim();
    return location === tail;
  }

  function stockCarDisplayTrack(circuit, location) {
    circuit = String(circuit || '').trim();
    location = String(location || '').trim();
    if (!circuit) return '';
    if (isStockCarLegacyCombinedCircuit(circuit, location)) {
      return circuit.slice(0, circuit.indexOf(', ')).trim();
    }
    return circuit;
  }

  function stockCarDisplayLocation(circuit, location) {
    circuit = String(circuit || '').trim();
    location = String(location || '').trim();
    if (isStockCarLegacyCombinedCircuit(circuit, location)) {
      return circuit.slice(circuit.indexOf(', ') + 2).trim();
    }
    return location;
  }

  /** Catches venue names left in location after migration (not city names like "Speedway, Indiana"). */
  var LOCATION_VENUE_KEYWORDS_RE = /\b(speedway|raceway|circuit|motorsport|motor speedway|international|autodrome|superspeedway)\b/i;
  var TRACK_LIKE_MULTI_WORD_RE = /\b(Speedway|Raceway|Circuit|Motorsports? Park|International|Superspeedway|Autodrome)\b/;

  function locationLooksLikeVenueName(location) {
    var loc = String(location || '').trim();
    if (!loc || loc.indexOf(', ') < 0) return false;
    var parts = loc.split(', ').map(function (p) { return p.trim(); }).filter(Boolean);
    if (parts.length < 2) return false;
    if (parts.length >= 3) return LOCATION_VENUE_KEYWORDS_RE.test(parts[0]);
    // Two segments: flag only multi-word track-like first segment (not city "Speedway").
    return parts[0].indexOf(' ') >= 0 && TRACK_LIKE_MULTI_WORD_RE.test(parts[0]);
  }

  function isStockCarSeriesId(seriesId) {
    return STOCK_CAR_SERIES_IDS.indexOf(String(seriesId || '').toLowerCase()) >= 0;
  }

  window.TGA.isStockCarLegacyCombinedCircuit = isStockCarLegacyCombinedCircuit;
  window.TGA.stockCarDisplayTrack = stockCarDisplayTrack;
  window.TGA.stockCarDisplayLocation = stockCarDisplayLocation;
  window.TGA.locationLooksLikeVenueName = locationLooksLikeVenueName;
  window.TGA.STOCK_CAR_SERIES_IDS = STOCK_CAR_SERIES_IDS;
})();
