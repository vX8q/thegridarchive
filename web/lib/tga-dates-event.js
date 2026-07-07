// Event-level date ranges from JSON (tables meta + weekend bounds).
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  window.TGA = window.TGA || {};

  function parseMetaDateToISO(str) {
    var fn = window.TGA && window.TGA.parseMetaDateToISO;
    return fn ? fn(str) : null;
  }

  /** Collect min/max dates: d.start_date / d.end_date and sessions in d.tables (meta.Date). */
  function getEventSessionDateRange(d) {
    if (!d || typeof d !== 'object') return null;
    var sd = String(d.start_date == null ? '' : d.start_date).trim().slice(0, 10);
    var ed = String(d.end_date == null ? '' : d.end_date).trim().slice(0, 10);
    // Weekend bounds from JSON/schedule take priority over session dates in tables (F1/F2, etc.),
    // so the line under the title matches the official weekend (e.g. Sat–Sun only).
    if (/^\d{4}-\d{2}-\d{2}$/.test(sd) && /^\d{4}-\d{2}-\d{2}$/.test(ed)) {
      return { minIso: sd, maxIso: ed };
    }
    var minIso = null;
    var maxIso = null;
    function addIso(iso) {
      if (!iso) return;
      if (!minIso || iso < minIso) minIso = iso;
      if (!maxIso || iso > maxIso) maxIso = iso;
    }
    function addIsoFromTopLevel(field) {
      if (field == null || field === '') return;
      var s = String(field).trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) addIso(s.slice(0, 10));
    }
    addIsoFromTopLevel(d.start_date);
    addIsoFromTopLevel(d.end_date);
    function collectFromMeta(meta) {
      if (meta && typeof meta.Date === 'string') {
        var iso = parseMetaDateToISO(meta.Date);
        if (iso) addIso(iso);
      }
    }
    if (d.tables && typeof d.tables === 'object') {
      Object.keys(d.tables).forEach(function (key) {
        var tbl = d.tables[key];
        if (!tbl) return;
        collectFromMeta(tbl.meta);
        if (Array.isArray(tbl.sessions)) {
          tbl.sessions.forEach(function (sess) {
            collectFromMeta(sess && sess.meta);
          });
        }
      });
    }
    if (!minIso && !maxIso) return null;
    return { minIso: minIso, maxIso: maxIso || minIso };
  }

  window.TGA.getEventSessionDateRange = getEventSessionDateRange;
})();
