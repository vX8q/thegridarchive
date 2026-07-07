// Pure date parsing helpers (no i18n / timezone).
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  window.TGA = window.TGA || {};

  /** ISO YYYY-MM-DD from start_date or parseable date string (not slice(0,10) on prose). */
  function parseIsoDatePrefix(s) {
    if (s == null) return '';
    var str = String(s).trim();
    if (!str) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
    var d = new Date(str);
    if (!isNaN(d.getTime())) {
      var y = d.getFullYear();
      var m = ('0' + (d.getMonth() + 1)).slice(-2);
      var da = ('0' + d.getDate()).slice(-2);
      return y + '-' + m + '-' + da;
    }
    return '';
  }

  function isoAddDays(iso, delta) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
    var t = new Date(iso + 'T12:00:00').getTime() + delta * 86400000;
    var d = new Date(t);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /** Parse date from meta.Date like "Thu 05 Mar 2026" to ISO YYYY-MM-DD. */
  function parseMetaDateToISO(str) {
    if (!str || typeof str !== 'string') return null;
    var m = str.match(/(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/);
    if (!m) return null;
    var day = ('0' + parseInt(m[1], 10)).slice(-2);
    var monMap = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };
    var monKey = String(m[2] || '').slice(0, 3).toLowerCase();
    var mm = monMap[monKey];
    if (!mm) return null;
    return m[3] + '-' + mm + '-' + day;
  }

  /**
   * Race duration in hours when encoded in the event name
   * (e.g. "24 Hours of Le Mans", "Mobil 1 Twelve Hours of Sebring", "Rolex 24 at Daytona").
   * Returns null when duration cannot be inferred from the title.
   */
  function parseNamedRaceDurationHours(name) {
    var nm = String(name || '').toLowerCase().trim();
    if (!nm) return null;

    var numeric = nm.match(/\b(\d{1,2})\s*hours?\s+of\b/);
    if (numeric) return parseInt(numeric[1], 10);

    var wordHours = {
      twelve: 12, eleven: 11, ten: 10, nine: 9, eight: 8, seven: 7,
      six: 6, five: 5, four: 4, three: 3, two: 2, one: 1
    };
    var wordMatch = nm.match(/\b(twelve|eleven|ten|nine|eight|seven|six|five|four|three|two|one)\s+hours?\s+of\b/);
    if (wordMatch) return wordHours[wordMatch[1]];

    if (/\brolex\s*24\b/.test(nm) || /\b24\s+at\s+daytona\b/.test(nm)) return 24;

    return null;
  }

  window.TGA.parseIsoDatePrefix = parseIsoDatePrefix;
  window.TGA.isoAddDays = isoAddDays;
  window.TGA.parseMetaDateToISO = parseMetaDateToISO;
  window.TGA.parseNamedRaceDurationHours = parseNamedRaceDurationHours;
})();
