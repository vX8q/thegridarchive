// ─── tga-utils.js ─────────────────────────────────────────────────────────────
// Shared utilities: esc, dash, date formats, series, countries, padding, sorting.
// Dependencies: tga-i18n.js
// Load order: tga-i18n.js → tga-utils.js → app.js
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  window.TGA = window.TGA || {};
  var t      = function (k) { return window.TGA.t(k); };
  var getLang = function () { return window.TGA.getLang(); };

  // ─── HTML escaping ──────────────────────────────────────────────────
  function esc(s) {
    if (s == null) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // ─── Empty value → dash ──────────────────────────────────────────
  function dash(val) {
    if (val == null || val === '') return '—';
    if (typeof val === 'string' && val.trim() === '') return '—';
    return val;
  }

  // F4 standings: race position only (drop legacy "1*30").
  function standingsRacePosOnly(val) {
    var s = (val != null && val !== undefined) ? String(val).trim() : '';
    var star = s.indexOf('*');
    if (star >= 0) s = s.slice(0, star).trim();
    return s;
  }

  // ─── Driver names ───────────────────────────────────────────────────────
  var driverDisplayNames = { 'Cleetus Mitchell': 'Garrett Mitchell', 'Woohyun Shin': 'Michael Shin' };

  /** Latin diacritics → ASCII (mirrors internal/driverutil/slug.go). */
  function foldDiacritics(value) {
    if (value == null) return '';
    var out = String(value);
    var pairs = [
      ['ü', 'u'], ['Ü', 'u'], ['é', 'e'], ['É', 'e'], ['á', 'a'], ['Á', 'a'],
      ['í', 'i'], ['Í', 'i'], ['ó', 'o'], ['Ó', 'o'], ['ú', 'u'], ['Ú', 'u'],
      ['ñ', 'n'], ['Ñ', 'n'], ['ä', 'a'], ['Ä', 'a'], ['ö', 'o'], ['Ö', 'o'],
      ['ß', 'ss'], ['ø', 'o'], ['Ø', 'o'], ['å', 'a'], ['Å', 'a'],
      ['æ', 'ae'], ['Æ', 'ae'], ['ç', 'c'], ['Ç', 'c'],
      ['è', 'e'], ['È', 'e'], ['ê', 'e'], ['Ê', 'e'], ['ë', 'e'], ['Ë', 'e'],
      ['ì', 'i'], ['Ì', 'i'], ['î', 'i'], ['Î', 'i'], ['ï', 'i'], ['Ï', 'i'],
      ['ò', 'o'], ['Ò', 'o'], ['ô', 'o'], ['Ô', 'o'], ['ù', 'u'], ['Ù', 'u'],
      ['û', 'u'], ['Û', 'u'], ['ý', 'y'], ['Ý', 'y'], ['ÿ', 'y'],
      ['ž', 'z'], ['Ž', 'z'], ['š', 's'], ['Š', 's'], ['č', 'c'], ['Č', 'c'],
      ['ř', 'r'], ['Ř', 'r'], ['ď', 'd'], ['Ď', 'd'], ['ť', 't'], ['Ť', 't'],
      ['ň', 'n'], ['Ň', 'n'], ['ł', 'l'], ['Ł', 'l'], ['ą', 'a'], ['Ą', 'a'],
      ['ę', 'e'], ['Ę', 'e'], ['ś', 's'], ['Ś', 's'], ['ź', 'z'], ['Ź', 'z'],
      ['ż', 'z'], ['Ż', 'z'], ['ć', 'c'], ['Ć', 'c'], ['ő', 'o'], ['Ő', 'o'],
      ['ű', 'u'], ['Ű', 'u'], ['à', 'a'], ['À', 'a'], ['â', 'a'], ['Â', 'a'],
      ['ã', 'a'], ['Ã', 'a'], ['õ', 'o'], ['Õ', 'o'], ['ð', 'd'], ['Ð', 'd'],
      ['þ', 'th'], ['Þ', 'th'], ['đ', 'd'], ['Đ', 'd'], ['ħ', 'h'], ['Ħ', 'h'],
      ['ı', 'i'], ['İ', 'i']
    ];
    for (var i = 0; i < pairs.length; i++) {
      if (out.indexOf(pairs[i][0]) >= 0) out = out.split(pairs[i][0]).join(pairs[i][1]);
    }
    return out.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function driverNameKey(name) {
    if (name == null) return '';
    return foldDiacritics(name).toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function driverDisplayName(name) {
    if (name == null || typeof name !== 'string') return name;
    var trimmed = name.trim();
    if (trimmed.indexOf('/') >= 0) {
      var parts = trimmed.split(/\s*\/\s*/);
      var seen = {};
      var out = [];
      for (var i = 0; i < parts.length; i++) {
        var p = foldDiacritics(parts[i].trim());
        if (!p) continue;
        var k = driverNameKey(p);
        if (seen[k]) continue;
        seen[k] = true;
        out.push(p);
      }
      trimmed = out.join(' / ');
    }
    trimmed = foldDiacritics(trimmed);
    trimmed = trimmed.replace(/\s*\((?:i|r|g)\)\s*$/i, '').trim();
    trimmed = trimmed.replace(/\s*\((?:tba|tbc|tbd)\)\s*$/i, '').trim();
    var withoutRaces = trimmed.replace(/\s*\(\d+\s+races?\)\s*$/i, '').trim();
    var normalized = driverDisplayNames[withoutRaces] || driverDisplayNames[trimmed] || withoutRaces || trimmed;
    normalized = foldDiacritics(normalized);
    if (normalized === 'AJ Allmendinger') return 'A. J. Allmendinger';
    return normalized;
  }

  function slugify(str) {
    return resolveDriverSlug(foldDiacritics(String(str)).toLowerCase()
      .replace(/[^a-z0-9\u0400-\u04ff]+/g, '-')
      .replace(/^-+|-+$/g, ''));
  }

  /** Follow driver_profile_redirects.json (optional map from search bootstrap). */
  function resolveDriverSlug(slug, redirects) {
    slug = String(slug || '').trim().toLowerCase();
    if (!slug) return '';
    var seen = {};
    var map = redirects && typeof redirects === 'object' ? redirects : null;
    while (slug) {
      var next = map ? map[slug] : '';
      if (!next) {
        if (slug === 'woohyun-shin' || slug === 'w-shin' || slug === 'm-shin') next = 'michael-shin';
        else if (slug === 'nico-h-lkenberg' || slug === 'nicolas-hulkenberg' || slug === 'nicolas-h-lkenberg') next = 'nico-hulkenberg';
        else if (slug === 'sergio-p-rez') next = 'sergio-perez';
        else break;
      }
      next = String(next).trim().toLowerCase();
      if (!next || seen[slug]) break;
      seen[slug] = true;
      slug = next;
    }
    return slug;
  }

  // GTWCE: "A, B". Stock-car "Surname, First" — one word in each part, not a crew.
  function isCommaSeparatedCrew(raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (s.indexOf(',') < 0) return false;
    var parts = s.split(/\s*,\s*/).map(function (p) { return p.trim(); }).filter(Boolean);
    if (parts.length < 2) return false;
    if (parts.length === 2 && parts[0].indexOf(' ') < 0 && parts[1].indexOf(' ') < 0) return false;
    return true;
  }

  // Endurance / Super GT / GTWCE: "A / B / C", "A; B", "A, B".
  function splitDriverNames(raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (!s) return [];
    var parts = [s];
    [/\s*;\s*/, /\s*\/\s*/].forEach(function (re) {
      var next = [];
      parts.forEach(function (p) {
        String(p).split(re).forEach(function (x) {
          x = x.trim();
          if (x) next.push(x);
        });
      });
      if (next.length) parts = next;
    });
    if (parts.length === 1 && isCommaSeparatedCrew(parts[0])) {
      parts = parts[0].split(/\s*,\s*/).map(function (p) { return p.trim(); }).filter(Boolean);
    }
    var seen = {};
    var out = [];
    parts.forEach(function (p) {
      p = foldDiacritics(p);
      var k = driverNameKey(p);
      if (seen[k]) return;
      seen[k] = true;
      out.push(p);
    });
    return out;
  }

  function isGuestEntryRow(row) {
    if (!row || typeof row !== 'object') return false;
    if (row.guest === true || row.guest === 1) return true;
    if (typeof row.guest === 'string' && row.guest.toLowerCase() === 'true') return true;
    return false;
  }

  function guestCarNumberSet(entryList) {
    var set = {};
    (entryList || []).forEach(function (e) {
      if (!isGuestEntryRow(e)) return;
      var n = e && e.number != null ? String(e.number).trim() : '';
      if (n) set[n] = true;
    });
    return set;
  }

  function entryListDriverCell(row, guestCars) {
    var display = driverDisplayName(row && row.driver);
    if (!display || dash(display) === '—') return '—';
    var car = row && row.number != null ? String(row.number).trim() : '';
    var guests = guestCars || guestCarNumberSet([row]);
    var isGuest = isGuestEntryRow(row) || !!(car && guests[car]);
    var link = '<a href="/driver/' + encodeURIComponent(slugify(display)) + '" class="track-link">' + esc(display) + '</a>';
    return isGuest ? link + ' (G)' : link;
  }

  function entryListDriverLabel(row, guestCars) {
    var display = driverDisplayName(row && row.driver);
    if (!display || dash(display) === '—') return '—';
    var car = row && row.number != null ? String(row.number).trim() : '';
    var guests = guestCars || guestCarNumberSet([row]);
    var isGuest = isGuestEntryRow(row) || !!(car && guests[car]);
    return isGuest ? display + ' (G)' : display;
  }

  function driverLinkHtml(name) {
    var raw = String(name == null ? '' : name).trim();
    if (!raw || dash(raw) === '—') return '—';
    if (/^(?:tba|tbc|tbd)$/i.test(raw)) return '—';
    if (raw.indexOf('/') >= 0 || raw.indexOf(';') >= 0 || isCommaSeparatedCrew(raw)) return driversCellHtml(raw);
    var display = driverDisplayName(raw);
    if (!display || dash(display) === '—') return '—';
    return '<a href="/driver/' + encodeURIComponent(slugify(display)) + '" class="track-link">' + esc(display) + '</a>';
  }

  function driversCellHtml(raw, joinerOverride) {
    var names = splitDriverNames(raw);
    if (names.length === 0) return '—';
    if (names.length === 1) return driverLinkHtml(names[0]);
    var joiner = joinerOverride || ' / ';
    if (!joinerOverride) {
      if (String(raw).indexOf(';') >= 0) joiner = '; ';
      else if (isCommaSeparatedCrew(raw)) joiner = ', ';
    }
    return names.map(function (n) { return driverLinkHtml(n); }).filter(Boolean).join(joiner);
  }

  // ─── Series helper ────────────────────────────────────────────────────────
  function isSeriesId(id, name) {
    return (id || '').toLowerCase() === name.toLowerCase();
  }

  // ─── Panel padding ─────────────────────────────────────────────────────
  function adjustEventPanelPadding() {
    requestAnimationFrame(function () {
      var h = document.querySelector('#view-event .event-sticky-header');
      var w = document.getElementById('event-panels-wrap');
      if (h && w) w.style.paddingTop = (h.offsetHeight + 8) + 'px';
    });
  }

  function adjustDetailPanelPadding() {
    requestAnimationFrame(function () {
      var h = document.querySelector('#view-detail .detail-sticky-header');
      var w = document.getElementById('detail-panels-wrap');
      if (h && w) w.style.paddingTop = (h.offsetHeight + 8) + 'px';
    });
  }

  function adjustSeasonPanelPadding() {
    requestAnimationFrame(function () {
      var h = document.querySelector('#view-season .detail-sticky-header');
      var w = document.getElementById('season-content');
      if (h && w) w.style.paddingTop = (h.offsetHeight + 8) + 'px';
    });
  }

  window.addEventListener('resize', function () {
    adjustEventPanelPadding();
    adjustDetailPanelPadding();
    adjustSeasonPanelPadding();
  });

  // ─── Static Car Specs render for Supercars ──────────────────────────
  // (fallback when API is unavailable)
  function renderSupercarsStaticSpecs() {
    var carWrap = document.getElementById('car-spec-wrap');
    var modelsWrap = document.getElementById('car-models-table-wrap');
    var techWrap = document.getElementById('technical-spec-table-wrap');
    var enginesTitle = document.getElementById('engines-spec-title');
    var enginesWrap = document.getElementById('engines-spec-table-wrap');
    var homologTitle = document.getElementById('homologation-spec-title');
    var homologWrap = document.getElementById('homologation-spec-table-wrap');
    if (!carWrap || !modelsWrap || !techWrap) return;

    var sc = window.tgaSeries && window.tgaSeries.supercars;
    if (!sc) return;

    var carModels = sc.carModels || [];
    var techSpec = sc.technicalSpec || [];
    var engines = sc.engines || [];
    var homologation = sc.homologation || [];

    carWrap.classList.remove('hidden');

    // Car models
    modelsWrap.innerHTML =
      '<table class="data-table"><thead><tr>' +
        '<th>' + t('th.manufacturer') + '</th>' +
        '<th>' + t('th.model') + '</th>' +
      '</tr></thead><tbody>' +
      carModels.map(function (c) {
        return '<tr><td>' + esc(dash(c.manufacturer)) + '</td><td>' + esc(dash(c.model)) + '</td></tr>';
      }).join('') +
      '</tbody></table>';
    if (typeof makeTableSortable === 'function') {
      makeTableSortable(modelsWrap.querySelector('.data-table'), carModels.map(function (c) { return [c.manufacturer, c.model]; }), esc);
    }

    // Technical spec
    techWrap.innerHTML =
      '<table class="data-table"><thead><tr>' +
      '<th>' + t('th.field') + '</th>' +
      '<th>' + t('th.value') + '</th>' +
      '</tr></thead><tbody>' +
      techSpec.map(function (s) {
        var rawVal = dash(s.value);
        var cellVal;
        if (String(s.key || '').toLowerCase().trim() === 'estimated season cost') {
          var idx = rawVal.indexOf(' (');
          if (idx > 0) {
            cellVal = esc(rawVal.slice(0, idx)) + '<br>' + esc(rawVal.slice(idx + 1));
          } else {
            cellVal = esc(rawVal);
          }
        } else {
          cellVal = esc(rawVal);
        }
        return '<tr><td class="col-field">' + esc(dash(s.key)) + '</td><td>' + cellVal + '</td></tr>';
      }).join('') +
      '</tbody></table>';
    if (typeof makeTableSortable === 'function') {
      makeTableSortable(techWrap.querySelector('.data-table'), techSpec.map(function (s) { return [s.key, s.value]; }), esc);
    }

    // Engines
    if (enginesWrap && enginesTitle) {
      enginesWrap.classList.remove('hidden');
      enginesTitle.classList.remove('hidden');
      enginesWrap.innerHTML =
        '<table class="data-table"><thead><tr><th>Car model</th><th>Engine specification</th></tr></thead><tbody>' +
        engines.map(function (e) {
          return '<tr><td>' + esc(dash(e.model)) + '</td><td>' + esc(dash(e.spec)) + '</td></tr>';
        }).join('') +
        '</tbody></table>';
      if (typeof makeTableSortable === 'function') {
        makeTableSortable(enginesWrap.querySelector('.data-table'), engines.map(function (e) { return [e.model, e.spec]; }), esc);
      }
    }

    // Homologation
    if (homologWrap && homologTitle) {
      homologWrap.classList.remove('hidden');
      homologTitle.classList.remove('hidden');
      homologWrap.innerHTML =
        '<table class="data-table"><thead><tr><th>Manufacturer</th><th>Homologating team</th></tr></thead><tbody>' +
        homologation.map(function (h) {
          return '<tr><td>' + esc(dash(h.manufacturer)) + '</td><td>' + esc(dash(h.team)) + '</td></tr>';
        }).join('') +
        '</tbody></table>';
      if (typeof makeTableSortable === 'function') {
        makeTableSortable(homologWrap.querySelector('.data-table'), homologation.map(function (h) { return [h.manufacturer, h.team]; }), esc);
      }
    }
  }

  // ─── Object table sorting ─────────────────────────────────────────
  function addObjectTableSort(tableEl, dataArray, rowRenderer, keys, fullBodyRenderer) {
    if (!tableEl || !dataArray || dataArray.length === 0) return;
    if (!rowRenderer && !fullBodyRenderer) return;
    var thead = tableEl.querySelector('thead tr');
    var tbody = tableEl.querySelector('tbody');
    if (!thead || !tbody) return;
    var dataCopy = dataArray.slice();
    function render() {
      if (fullBodyRenderer) {
        var result = fullBodyRenderer(dataCopy);
        if (typeof result === 'string' && result.indexOf('<tbody') !== -1) {
          tableEl.innerHTML = result;
          attachSortHandlers();
        } else {
          var tb = tableEl.querySelector('tbody');
          if (tb) tb.innerHTML = result;
        }
      } else {
        var tb = tableEl.querySelector('tbody');
        if (tb) tb.innerHTML = dataCopy.map(rowRenderer).join('');
      }
    }
    function attachSortHandlers() {
      var tr = tableEl.querySelector('thead tr');
      var ths = tr ? tr.querySelectorAll('th') : [];
      for (var c = 0; c < ths.length; c++) {
        (function (colIndex) {
          var key = keys[colIndex];
          if (key == null) return;
          ths[colIndex].classList.add('sortable');
          ths[colIndex].addEventListener('click', function () {
            var dir = ths[colIndex].dataset.sortDir === 'asc' ? -1 : 1;
            ths[colIndex].dataset.sortDir = dir === 1 ? 'asc' : 'desc';
            dataCopy.sort(function (a, b) {
              var va = a[key] != null ? String(a[key]) : '';
              var vb = b[key] != null ? String(b[key]) : '';
              var na = parseFloat(va);
              var nb = parseFloat(vb);
              if (!isNaN(na) && !isNaN(nb)) {
                if (na < nb) return dir * -1;
                if (na > nb) return dir * 1;
                return 0;
              }
              return dir * va.localeCompare(vb, undefined, { numeric: true });
            });
            [].forEach.call(ths, function (th) { th.classList.remove('sort-asc', 'sort-desc'); });
            ths[colIndex].classList.add(dir === 1 ? 'sort-asc' : 'sort-desc');
            render();
          });
        })(c);
      }
    }
    attachSortHandlers();
  }

  // ─── Series types ──────────────────────────────────────────────────────────
  // Note: parameter is intentionally named typeKey to avoid shadowing outer t()
  function typeLabel(typeKey) {
    var labels = {
      openwheel: 'Open wheel',
      gt_endurance: 'GT Endurance',
      gt_sprint: 'GT Sprint',
      touring: 'Touring',
      stock_car_racing: 'Stock car',
      single_make: 'Single make'
    };
    return labels[typeKey] || typeKey || '—';
  }

  // ─── Countries ──────────────────────────────────────────────────────────────
  function countryDisplay(country) {
    if (!country) return { icon: '', label: '—' };
    var c = String(country).toUpperCase();
    if (c === 'USA')    return { icon: '\uD83C\uDDFA\uD83C\uDDF8', label: 'USA' };
    if (c === 'ITALY')  return { icon: '\uD83C\uDDEE\uD83C\uDDF9', label: 'Italy' };
    if (c === 'FIA')    return { icon: '\uD83C\uDF10', label: 'World' };
    if (c === 'EUROPE') return { icon: '', label: 'Europe' };
    return { icon: '', label: country };
  }

  function countryHtml(country) {
    var d = countryDisplay(country);
    return esc(d.label);
  }

  function syncStandingsScrollBars() { /* top bar removed */ }

  // ─── Series categories ─────────────────────────────────────────────────────
  var categories = [
    { key: 'openwheel', ids: ['F1', 'INDYCAR', 'SUPER_FORMULA', 'F2', 'F3', 'FREC', 'F4_IT'] },
    { key: 'stockcar',  ids: ['NASCAR_CUP', 'NOAPS', 'NASCAR_TRUCK', 'ARCA', 'NASCAR_MODIFIED'] },
    { key: 'endurance', ids: ['WEC', 'ELMS', 'IMSA'] },
    // In Touring, show Supercars first
    { key: 'touring',   ids: ['SUPERCARS', 'GTWCE_END', 'GTWCE_SPRINT', 'PSC', 'DTM', 'SUPER_GT'] }
  ];

  var categoryBySeriesId = {};
  categories.forEach(function (cat) {
    cat.ids.forEach(function (id) {
      categoryBySeriesId[id] = cat.key;
      categoryBySeriesId[id.toLowerCase()] = cat.key;
    });
  });

  var categoryColors = (window.TGA_CATEGORY_COLORS || {});
  var seriesColors   = (window.TGA_SERIES_COLORS || {});
  var seriesShort    = (window.TGA_SERIES_SHORT || {});

  // ─── Series colors and badges ────────────────────────────────────────────────
  function hexRgb(hex) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return r + ',' + g + ',' + b;
  }

  function seriesBadge(seriesId) {
    var sid = (seriesId || '').toLowerCase();
    var cat = categoryBySeriesId[sid] || categoryBySeriesId[seriesId] || 'openwheel';
    var color = seriesColors[(seriesId || '').toUpperCase()] || categoryColors[cat] || '#888888';
    var rgb = hexRgb(color);
    var label = seriesShort[seriesId] || seriesShort[(seriesId || '').toUpperCase()] || seriesId;
    return '<span class="series-badge" style="color:' + color + ';background:rgba(' + rgb + ',0.1);border:1px solid rgba(' + rgb + ',0.22)">' + esc(label) + '</span>';
  }

  // ─── Date formats ─────────────────────────────────────────────────────────
  function formatShortDate(dateStr) {
    if (!dateStr) return '—';
    var d = new Date(dateStr + 'T12:00:00');
    if (isNaN(d.getTime())) return dateStr;
    var months_en = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var months_ru = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    var day = d.getDate();
    var mon = getLang() === 'ru' ? months_ru[d.getMonth()] : months_en[d.getMonth()];
    return getLang() === 'ru' ? day + ' ' + mon : mon + ' ' + day;
  }

  function formatDateRange(startDs, endDs) {
    if (!startDs) return '—';
    var months_en = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var months_ru = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    var d1 = new Date(startDs + 'T12:00:00');
    if (!endDs || startDs === endDs) {
      var day = d1.getDate();
      var mon = getLang() === 'ru' ? months_ru[d1.getMonth()] : months_en[d1.getMonth()];
      return getLang() === 'ru' ? day + ' ' + mon : mon + ' ' + day;
    }
    var d2 = new Date(endDs + 'T12:00:00');
    var d1day = d1.getDate(), d2day = d2.getDate();
    var m1 = getLang() === 'ru' ? months_ru[d1.getMonth()] : months_en[d1.getMonth()];
    var m2 = getLang() === 'ru' ? months_ru[d2.getMonth()] : months_en[d2.getMonth()];
    if (d1.getMonth() === d2.getMonth()) {
      return getLang() === 'ru' ? d1day + '\u2013' + d2day + '\u00a0' + m1 : m1 + '\u00a0' + d1day + '\u2013' + d2day;
    }
    return getLang() === 'ru'
      ? d1day + '\u00a0' + m1 + '\u2013' + d2day + '\u00a0' + m2
      : m1 + '\u00a0' + d1day + '\u2013' + m2 + '\u00a0' + d2day;
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

  /** LIVE badge end: named race duration (+2 h buffer) or fallbackEndTs when unknown. */
  function liveEndTsForEvent(ev, startTs, fallbackEndTs) {
    var hours = parseNamedRaceDurationHours(ev && ev.name);
    if (hours != null && startTs) {
      return startTs + (hours + 2) * 3600000;
    }
    return fallbackEndTs != null ? fallbackEndTs : (startTs ? startTs + 3 * 3600000 : null);
  }

  function isIsoYmdDate(s) {
    return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  }

  /** Typical race length in hours when not encoded in the event title. */
  function defaultRaceDurationHours(ev) {
    var sid = String((ev && (ev._seriesId || ev.series_id)) || '').toUpperCase();
    if (sid === 'NASCAR_CUP' || sid === 'NOAPS' || sid === 'NASCAR_TRUCK' || sid === 'ARCA' || sid === 'NASCAR_MODIFIED') return 4.5;
    if (sid === 'INDYCAR') return 3.5;
    if (sid === 'F1') return 3.5;
    if (sid === 'F2' || sid === 'F3') return 2.5;
    if (sid === 'SUPERCARS' || sid === 'SUPER_FORMULA' || sid === 'SUPER_GT' || sid === 'DTM') return 3.5;
    if (sid === 'WEC' || sid === 'ELMS') return 6;
    if (sid === 'IMSA') {
      var nm = String((ev && ev.name) || '').toLowerCase();
      if (nm.indexOf('rolex') >= 0 || /\b24\b/.test(nm)) return 26;
      if (nm.indexOf('12 hour') >= 0 || nm.indexOf('twelve') >= 0) return 13;
      if (nm.indexOf('10 hour') >= 0 || nm.indexOf('ten') >= 0 || nm.indexOf('petit le mans') >= 0) return 11;
      if (nm.indexOf('six hours') >= 0 || nm.indexOf('6 hour') >= 0) return 7;
      if (nm.indexOf('long beach') >= 0) return 2.25;
      if (nm.indexOf('detroit') >= 0) return 2.25;
      if (nm.indexOf('monterey') >= 0 || nm.indexOf('laguna seca') >= 0) return 2.5;
      return 3.5;
    }
    return 4;
  }

  function raceDurationHours(ev) {
    var named = parseNamedRaceDurationHours(ev && ev.name);
    if (named != null) return named;
    return defaultRaceDurationHours(ev);
  }

  /**
   * Estimated UTC moment when the race is over (uses getEventRaceUtcMs + duration from title).
   * Shared by Last Results and Next Race cards.
   */
  function estimateRaceFinishedUtcMs(ev) {
    if (!ev) return null;
    var getRaceUtc = window.TGA.getEventRaceUtcMs;
    var startUtc = getRaceUtc ? getRaceUtc(ev) : 0;
    if (!startUtc) return null;
    return startUtc + raceDurationHours(ev) * 3600000;
  }

  /** Whether the event should appear in Last Results (race window ended). */
  function isPastForLastResultsEvent(ev) {
    if (!ev) return false;
    var today = new Date();
    var todayISO = today.getFullYear() + '-' +
      ('0' + (today.getMonth() + 1)).slice(-2) + '-' +
      ('0' + today.getDate()).slice(-2);
    var startStr = (ev.start_date || ev.date || '').slice(0, 10);
    var endStr = (ev.end_date || startStr || '').slice(0, 10);
    if (!isIsoYmdDate(endStr)) return false;
    if (isIsoYmdDate(startStr) && startStr > todayISO) return false;
    if (endStr < todayISO) return true;
    var finMs = estimateRaceFinishedUtcMs(ev);
    if (finMs == null) return endStr <= todayISO;
    return Date.now() >= finMs;
  }

  /** When to drop an event from Next Race cards (after estimated finish + small buffer). */
  function nextRaceEndTs(ev, startTs, fallbackEndTs) {
    var finMs = estimateRaceFinishedUtcMs(ev);
    if (finMs != null) {
      return finMs + 3600000;
    }
    return fallbackEndTs != null ? fallbackEndTs : (startTs ? startTs + 3 * 3600000 : null);
  }

  /** Parse event start datetime. timeStr in HH:MM or 12h AM/PM/a.m./p.m. tzOffset: '+03:00' (MSK) or '-05:00' (EST). */
  function parseEventDate(dateStr, timeStr, tzOffset) {
    if (!dateStr) return null;
    var isoTime = '12:00:00';
    if (timeStr) {
      var m12 = timeStr.match(/(\d+):(\d+)\s*([ap]\.?m\.?|AM|PM)/i);
      var m24 = timeStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
      if (m12) {
        var h = parseInt(m12[1], 10);
        var min = m12[2];
        var ampm = m12[3].replace(/\./g, '').toUpperCase();
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        isoTime = (h < 10 ? '0' : '') + h + ':' + min + ':00';
      } else if (m24) {
        var hour = parseInt(m24[1], 10);
        var min24 = m24[2];
        isoTime = (hour < 10 ? '0' : '') + hour + ':' + min24 + ':00';
      }
    }
    var offset = (tzOffset && /^[+-]\d{2}:\d{2}$/.test(tzOffset)) ? tzOffset : '-05:00';
    return new Date(dateStr + 'T' + isoTime + offset);
  }

  var CREW_STANDINGS_SERIES = ['elms', 'wec', 'imsa', 'gtwce_end', 'gtwce_sprint', 'super_gt'];

  function isCrewStandingsSeries(seriesKey) {
    var sk = String(seriesKey || '').toLowerCase().replace(/-/g, '_');
    return CREW_STANDINGS_SERIES.indexOf(sk) >= 0;
  }

  function getStandingsMode(seriesKey) {
    var sk = String(seriesKey || '').toLowerCase().replace(/-/g, '_');
    try {
      var stored = sessionStorage.getItem('standings-mode:' + sk);
      if (stored === 'crew' || stored === 'driver') return stored;
    } catch (e) { /* ignore */ }
    return 'driver';
  }

  function setStandingsMode(seriesKey, mode) {
    var sk = String(seriesKey || '').toLowerCase().replace(/-/g, '_');
    try { sessionStorage.setItem('standings-mode:' + sk, mode); } catch (e) { /* ignore */ }
  }

  function parseStandingsPoints(v) {
    if (v == null || v === '') return 0;
    var n = parseFloat(String(v).replace(',', '.').trim());
    return isNaN(n) ? 0 : n;
  }

  function formatStandingsPointsNum(n) {
    if (Math.abs(n - Math.round(n)) < 0.05) return String(Math.round(n));
    return n.toFixed(1);
  }

  /** Crews → individual standings: each driver gets points and positions from every crew they raced for.  */
  function buildDriverClassesFromCrew(classes, raceOrder) {
    raceOrder = raceOrder || [];
    return (classes || []).map(function (cls) {
      var driverMap = {};
      var driverOrder = [];
      (cls.rows || []).forEach(function (row) {
        var names = splitDriverNames(row.driver);
        if (names.length === 0) return;
        var rowPts = parseStandingsPoints(row.points);
        names.forEach(function (rawName) {
          var key = driverNameKey(rawName);
          if (!driverMap[key]) {
            driverMap[key] = {
              driver: driverDisplayName(rawName),
              team: '',
              manufacturer: '',
              car: '',
              races: {},
              quals: {},
              pointsNum: 0
            };
            driverOrder.push(key);
          }
          var d = driverMap[key];
          d.pointsNum += rowPts;
          raceOrder.forEach(function (code) {
            if (row.races && row.races[code] != null && String(row.races[code]).trim() !== '') {
              d.races[code] = row.races[code];
              d.team = row.team || d.team;
              d.manufacturer = row.manufacturer || d.manufacturer;
              d.car = row.car || d.car;
            }
            if (row.quals && row.quals[code] != null && String(row.quals[code]).trim() !== '') {
              d.quals[code] = row.quals[code];
            }
          });
        });
      });
      var rows = driverOrder.map(function (key) {
        var d = driverMap[key];
        return {
          driver: d.driver,
          team: d.team,
          manufacturer: d.manufacturer,
          car: d.car,
          races: d.races,
          quals: d.quals,
          points: formatStandingsPointsNum(d.pointsNum),
          _pointsNum: d.pointsNum
        };
      });
      rows.sort(function (a, b) {
        if (b._pointsNum !== a._pointsNum) return b._pointsNum - a._pointsNum;
        return String(a.driver || '').localeCompare(String(b.driver || ''), undefined, { sensitivity: 'base' });
      });
      rows.forEach(function (r, i) {
        r.pos = i + 1;
        delete r._pointsNum;
      });
      return { id: cls.id, name: cls.name, rows: rows };
    });
  }

  var standingsModeNavCallback = null;
  var standingsModeNavSeriesKey = '';

  function hideStandingsModeNav() {
    var nav = document.getElementById('standings-mode-nav');
    if (!nav) return;
    nav.classList.add('hidden');
    nav.innerHTML = '';
    nav.removeAttribute('data-series-key');
    standingsModeNavCallback = null;
    standingsModeNavSeriesKey = '';
  }

  function updateStandingsModeNavActive(mode) {
    var nav = document.getElementById('standings-mode-nav');
    if (!nav) return;
    var active = mode === 'crew' ? 'crew' : 'driver';
    nav.querySelectorAll('[data-mode]').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-mode') === active);
    });
  }

  function ensureStandingsModeNav(seriesKey, onChange) {
    var nav = document.getElementById('standings-mode-nav');
    if (!nav) return false;
    if (!isCrewStandingsSeries(seriesKey)) {
      hideStandingsModeNav();
      return false;
    }
    standingsModeNavCallback = onChange;
    standingsModeNavSeriesKey = seriesKey;
    nav.classList.remove('hidden');
    if (nav.getAttribute('data-series-key') === seriesKey && nav.querySelector('[data-mode="driver"]')) {
      return true;
    }
    var tFn = function (k) { return window.TGA.t(k); };
    nav.setAttribute('data-series-key', seriesKey);
    nav.innerHTML =
      '<button type="button" class="nav-link" data-mode="driver">' +
        esc(tFn('nav.standings.driver') || 'Driver') +
      '</button>' +
      '<button type="button" class="nav-link" data-mode="crew">' +
        esc(tFn('nav.standings.crew') || 'Crew') +
      '</button>';
    nav.querySelectorAll('[data-mode]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.classList.contains('active')) return;
        var next = btn.getAttribute('data-mode');
        if (!next) return;
        setStandingsMode(standingsModeNavSeriesKey, next);
        updateStandingsModeNavActive(next);
        if (typeof standingsModeNavCallback === 'function') {
          standingsModeNavCallback(next);
        }
      });
    });
    return true;
  }

  function renderStandingsModeNav(seriesKey, activeMode, onChange) {
    if (!seriesKey || !isCrewStandingsSeries(seriesKey)) {
      hideStandingsModeNav();
      return;
    }
    if (ensureStandingsModeNav(seriesKey, onChange)) {
      updateStandingsModeNavActive(activeMode);
    }
  }

  function wecStandingsRoundLabel(eventNames, idx) {
    var raw = String((eventNames && eventNames[idx]) || '').trim();
    if (!raw) return 'R' + String((idx || 0) + 1);
    var lc = raw.toLowerCase();
    if (lc.indexOf('imola') >= 0) return 'IMO';
    if (lc.indexOf('spa') >= 0) return 'SPA';
    if (lc.indexOf('lone star') >= 0) return 'COT';
    if (lc.indexOf('le mans') >= 0) return 'LEM';
    if (lc.indexOf('são paulo') >= 0 || lc.indexOf('sao paulo') >= 0) return 'SAO';
    if (lc.indexOf('fuji') >= 0) return 'FUJ';
    if (lc.indexOf('qatar') >= 0) return 'QAT';
    if (lc.indexOf('bahrain') >= 0) return 'BAH';
    var compact = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return compact.slice(0, 3) || ('R' + String((idx || 0) + 1));
  }

  /** IMSA / GTWCE / ELMS / WEC / Super GT: per-class tables in #standings-imsa-wrap  */
  function buildImsaGtwceClassStandingsHtml(dataObj, seriesKey, mode) {
    var tFn = function (k) { return window.TGA.t(k); };
    mode = mode || getStandingsMode(seriesKey);
    var isCrewMode = mode === 'crew';
    var classes = dataObj && dataObj.classes && Array.isArray(dataObj.classes) ? dataObj.classes : [];
    if (classes.length === 0) return '';
    if (!isCrewMode) {
      classes = buildDriverClassesFromCrew(classes, dataObj.race_order || []);
    }
    var raceOrder = (dataObj && dataObj.race_order) ? dataObj.race_order.slice() : [];
    var completedRacesArr = (dataObj && dataObj.completed_races) ? dataObj.completed_races.slice() : [];
    var completedRacesSet = {};
    for (var cr = 0; cr < completedRacesArr.length; cr++) { completedRacesSet[completedRacesArr[cr]] = true; }
    var eventNamesForStandings = (dataObj && Array.isArray(dataObj.event_names)) ? dataObj.event_names : [];
    var sk = seriesKey;
    var lang = getLang();
    var carLabel = tFn('th.car') || 'Car';
    var showModelCol = sk !== 'wec';
    function raceHeaderLabel(code, idx) {
      if (!code || typeof code !== 'string') return code;
      if (sk === 'wec') {
        return wecStandingsRoundLabel(eventNamesForStandings, idx);
      }
      if (sk === 'gtwce_end' || sk === 'gtwce_sprint') {
        return code;
      }
      if (sk === 'super_formula') {
        var evName = String((eventNamesForStandings[idx] || '')).toLowerCase();
        var base = 'R';
        if (evName.indexOf('motegi') >= 0) base = 'MOT';
        else if (evName.indexOf('autopolis') >= 0) base = 'AUT';
        else if (evName.indexOf('suzuka') >= 0) base = 'SUZ';
        else if (evName.indexOf('fuji') >= 0) base = 'FUJ';
        else if (evName.indexOf('sugo') >= 0) base = 'SUG';
        var n = 0;
        for (var ri = 0; ri <= idx; ri++) {
          var evNamePrev = String((eventNamesForStandings[ri] || '')).toLowerCase();
          var prevBase = 'R';
          if (evNamePrev.indexOf('motegi') >= 0) prevBase = 'MOT';
          else if (evNamePrev.indexOf('autopolis') >= 0) prevBase = 'AUT';
          else if (evNamePrev.indexOf('suzuka') >= 0) prevBase = 'SUZ';
          else if (evNamePrev.indexOf('fuji') >= 0) prevBase = 'FUJ';
          else if (evNamePrev.indexOf('sugo') >= 0) prevBase = 'SUG';
          if (prevBase === base) n++;
        }
        return base + String(n || 1);
      }
      var label = code.replace(/\d+$/, '') || code;
      if (lang === 'ru') label = label.replace(/^R(\d*)$/i, 'Р$1');
      return label;
    }
    var isGtwce = sk === 'gtwce_end' || sk === 'gtwce_sprint';
    var html = '<div class="imsa-standings-by-class' + (isGtwce ? ' gtwce-standings-by-class' : '') + '">';
    classes.forEach(function (cls) {
      var classRows = cls.rows || [];
      if (!isGtwce && classRows.length === 0) return;
      var th;
      var body;
      var tableExtraClass = '';
      function carCell(row) {
        return esc(dash(row.manufacturer || row.car || ''));
      }
      function raceCells(row) {
        var td = '';
        for (var ri = 0; ri < raceOrder.length; ri++) {
          var rval = row.races && row.races[raceOrder[ri]] != null ? String(row.races[raceOrder[ri]]).trim() : '';
          var raceCode = raceOrder[ri];
          var isCompleted = completedRacesSet[raceCode];
          var raceCell = rval ? esc(rval) : (isCompleted ? '—' : '');
          td += '<td class="col-race">' + raceCell + '</td>';
        }
        return td;
      }
      if (isGtwce) {
        th = '<th class="col-num">' + esc(tFn('th.pos') || 'Pos') + '</th>';
        if (!isCrewMode) th += '<th>' + esc(tFn('th.driver') || 'Driver') + '</th>';
        th += '<th class="col-car">' + esc(tFn('th.no') || '#') + '</th>' +
          '<th>' + esc(tFn('th.team') || 'Team') + '</th>' +
          '<th>' + esc(carLabel) + '</th>';
        for (var gi = 0; gi < raceOrder.length; gi++) {
          th += '<th class="col-race">' + esc(raceHeaderLabel(raceOrder[gi], gi)) + '</th>';
        }
        th += '<th class="col-pts">' + esc(tFn('th.pts') || 'Pts') + '</th>';
        body = classRows.map(function (row) {
          var posDisplay = (row.pos === 0 || row.pos === null || row.pos === undefined) ? '—' : row.pos;
          var td = '<td class="col-num">' + posDisplay + '</td>';
          if (!isCrewMode) td += '<td>' + driversCellHtml(row.driver) + '</td>';
          td += '<td class="col-car">' + esc(row.car || '—') + '</td>' +
            '<td>' + esc(dash(row.team)) + '</td>' +
            '<td>' + carCell(row) + '</td>';
          td += raceCells(row);
          td += '<td class="col-pts">' + esc(dash(row.points)) + '</td>';
          return '<tr>' + td + '</tr>';
        }).join('');
        if (!body) body = '';
      } else {
        var hasCarNum = classRows.some(function (r) { return r.car; });
        var useImsaQualRaceCols = sk === 'imsa' && raceOrder.length > 0 && classRows.some(function (r) {
          return r.quals && typeof r.quals === 'object' && Object.keys(r.quals).length > 0;
        });
        var theadHtml;
        var labelQ = lang === 'ru' ? 'Кв.' : 'Q';
        var labelR = lang === 'ru' ? 'Гон.' : 'R';
        if (useImsaQualRaceCols) {
          tableExtraClass = ' imsa-standings-split';
          var tr1 = '<th class="col-num" rowspan="2">' + tFn('th.pos') + '</th>';
          if (hasCarNum) tr1 += '<th class="col-car" rowspan="2">' + tFn('th.no') + '</th>';
          if (!isCrewMode) tr1 += '<th rowspan="2">' + tFn('th.driver') + '</th>';
          tr1 += '<th rowspan="2">' + tFn('th.team') + '</th>';
          if (showModelCol) tr1 += '<th rowspan="2">' + esc(carLabel) + '</th>';
          for (var im = 0; im < raceOrder.length; im++) {
            tr1 += '<th class="col-race" colspan="2">' + esc(raceHeaderLabel(raceOrder[im], im)) + '</th>';
          }
          tr1 += '<th class="col-pts" rowspan="2">' + tFn('th.pts') + '</th>';
          var tr2 = '';
          for (var im2 = 0; im2 < raceOrder.length; im2++) {
            tr2 += '<th class="col-race col-imsa-qr">' + esc(labelQ) + '</th>' +
              '<th class="col-race col-imsa-qr">' + esc(labelR) + '</th>';
          }
          theadHtml = '<thead><tr>' + tr1 + '</tr><tr>' + tr2 + '</tr></thead>';
          body = classRows.map(function (row) {
            var posDisplay = (row.pos === 0 || row.pos === null || row.pos === undefined) ? '—' : row.pos;
            var td = '<td class="col-num">' + posDisplay + '</td>';
            if (hasCarNum) td += '<td class="col-car">' + esc(row.car || '—') + '</td>';
            if (!isCrewMode) td += '<td>' + driversCellHtml(row.driver) + '</td>';
            td += '<td>' + esc(dash(row.team)) + '</td>';
            if (showModelCol) td += '<td>' + carCell(row) + '</td>';
            for (var jm = 0; jm < raceOrder.length; jm++) {
              var rcode = raceOrder[jm];
              var isCmp = completedRacesSet[rcode];
              var qv = row.quals && row.quals[rcode] != null ? String(row.quals[rcode]).trim() : '';
              var rv = row.races && row.races[rcode] != null ? String(row.races[rcode]).trim() : '';
              var qCell = qv ? esc(qv) : (isCmp ? '—' : '');
              var rCell = rv ? esc(rv) : (isCmp ? '—' : '');
              td += '<td class="col-race">' + qCell + '</td><td class="col-race">' + rCell + '</td>';
            }
            td += '<td class="col-pts">' + esc(dash(row.points)) + '</td>';
            return '<tr>' + td + '</tr>';
          }).join('');
        } else {
          th = '<th class="col-num">' + tFn('th.pos') + '</th>';
          if (hasCarNum) th += '<th class="col-car">' + tFn('th.no') + '</th>';
          if (!isCrewMode) th += '<th>' + tFn('th.driver') + '</th>';
          th += '<th>' + tFn('th.team') + '</th>';
          if (showModelCol) th += '<th>' + esc(carLabel) + '</th>';
          for (var i = 0; i < raceOrder.length; i++) {
            th += '<th class="col-race">' + esc(raceHeaderLabel(raceOrder[i], i)) + '</th>';
          }
          th += '<th class="col-pts">' + tFn('th.pts') + '</th>';
          theadHtml = '<thead><tr>' + th + '</tr></thead>';
          body = classRows.map(function (row) {
            var posDisplay = (row.pos === 0 || row.pos === null || row.pos === undefined) ? '—' : row.pos;
            var td = '<td class="col-num">' + posDisplay + '</td>';
            if (hasCarNum) td += '<td class="col-car">' + esc(row.car || '—') + '</td>';
            if (!isCrewMode) td += '<td>' + driversCellHtml(row.driver) + '</td>';
            td += '<td>' + esc(dash(row.team)) + '</td>';
            if (showModelCol) td += '<td>' + carCell(row) + '</td>';
            td += raceCells(row);
            td += '<td class="col-pts">' + esc(dash(row.points)) + '</td>';
            return '<tr>' + td + '</tr>';
          }).join('');
        }
      }
      html += '<h4 class="table-section-title">' + esc(cls.name || cls.id || '') + '</h4>';
      html += '<div class="table-wrap"><table class="data-table standings-class-table' + (isGtwce ? '' : tableExtraClass) + '">';
      if (isGtwce) {
        html += '<thead><tr>' + th + '</tr></thead><tbody>' + body + '</tbody></table></div>';
      } else {
        html += theadHtml + '<tbody>' + body + '</tbody></table></div>';
      }
    });
    html += '</div>';
    return html;
  }

  // ─── Export ─────────────────────────────────────────────────────────────
  window.TGA.esc                      = esc;
  window.TGA.dash                     = dash;
  window.TGA.standingsRacePosOnly     = standingsRacePosOnly;
  window.TGA.driverDisplayName        = driverDisplayName;
  window.TGA.foldDiacritics           = foldDiacritics;
  window.TGA.isGuestEntryRow          = isGuestEntryRow;
  window.TGA.guestCarNumberSet        = guestCarNumberSet;
  window.TGA.entryListDriverCell      = entryListDriverCell;
  window.TGA.entryListDriverLabel     = entryListDriverLabel;
  window.TGA.slugify                  = slugify;
  window.TGA.resolveDriverSlug        = resolveDriverSlug;
  window.TGA.driverLinkHtml           = driverLinkHtml;
  window.TGA.driversCellHtml          = driversCellHtml;
  window.TGA.splitDriverNames         = splitDriverNames;
  window.TGA.isSeriesId               = isSeriesId;
  window.TGA.adjustEventPanelPadding  = adjustEventPanelPadding;
  window.TGA.adjustDetailPanelPadding = adjustDetailPanelPadding;
  window.TGA.adjustSeasonPanelPadding = adjustSeasonPanelPadding;
  window.TGA.renderSupercarsStaticSpecs = renderSupercarsStaticSpecs;
  window.TGA.addObjectTableSort       = addObjectTableSort;
  window.TGA.typeLabel                = typeLabel;
  window.TGA.countryDisplay           = countryDisplay;
  window.TGA.countryHtml              = countryHtml;
  window.TGA.syncStandingsScrollBars  = syncStandingsScrollBars;
  window.TGA.buildImsaGtwceClassStandingsHtml = buildImsaGtwceClassStandingsHtml;
  window.TGA.buildDriverClassesFromCrew = buildDriverClassesFromCrew;
  window.TGA.isCrewStandingsSeries = isCrewStandingsSeries;
  window.TGA.getStandingsMode = getStandingsMode;
  window.TGA.setStandingsMode = setStandingsMode;
  window.TGA.renderStandingsModeNav = renderStandingsModeNav;
  window.TGA.updateStandingsModeNavActive = updateStandingsModeNavActive;
  window.TGA.hideStandingsModeNav = hideStandingsModeNav;
  window.TGA.categories               = categories;
  window.TGA.categoryBySeriesId       = categoryBySeriesId;
  window.TGA.hexRgb                   = hexRgb;
  window.TGA.seriesBadge              = seriesBadge;
  window.TGA.formatShortDate          = formatShortDate;
  window.TGA.formatDateRange          = formatDateRange;
  window.TGA.parseEventDate           = parseEventDate;
  window.TGA.parseNamedRaceDurationHours = parseNamedRaceDurationHours;
  window.TGA.liveEndTsForEvent        = liveEndTsForEvent;
  window.TGA.raceDurationHours          = raceDurationHours;
  window.TGA.estimateRaceFinishedUtcMs  = estimateRaceFinishedUtcMs;
  window.TGA.isPastForLastResultsEvent  = isPastForLastResultsEvent;
  window.TGA.nextRaceEndTs              = nextRaceEndTs;
})();
