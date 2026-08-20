// ─── tga-utils.js ─────────────────────────────────────────────────────────────
// Shared utilities: esc, dash, date formats, series, countries, padding, sorting.
// Dependencies: tga-i18n.js
// Load order: tga-i18n.js → tga-utils.js → app.js
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  window.TGA = window.TGA || {};
  var t      = function (k) { return window.TGA.t(k); };
  var getLang = function () { return window.TGA.getLang(); };
  var localizeSpecKey = function (k) { return window.TGA.localizeSpecKey(k); };
  var localizeSpecValue = function (v) { return window.TGA.localizeSpecValue(v); };

  // ─── HTML escaping ──────────────────────────────────────────────────
  function esc(s) {
    if (s == null) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // Allow only http(s) and same-site relative paths in href/src attributes.
  function safeHref(url) {
    if (url == null) return '';
    var s = String(url).trim();
    if (!s) return '';
    var lower = s.toLowerCase();
    if (lower.indexOf('javascript:') === 0 || lower.indexOf('data:') === 0 || lower.indexOf('vbscript:') === 0) {
      return '';
    }
    if (/^https?:\/\//i.test(s)) return esc(s);
    if (s.charAt(0) === '/' && s.charAt(1) !== '/') return esc(s);
    return '';
  }

  // ─── Empty value → dash ──────────────────────────────────────────
  function dash(val) {
    if (val == null || val === '') return '—';
    if (typeof val === 'string' && val.trim() === '') return '—';
    if (typeof val === 'string' && isTeamsPlaceholder(val)) return '—';
    return val;
  }

  /** TBD/TBA/TBC and similar — not valid driver or rounds values in teams tables. */
  function isTeamsPlaceholder(val) {
    if (val == null) return true;
    var s = String(val).trim();
    if (!s) return true;
    if (/^(tbd|tba|tbc)$/i.test(s)) return true;
    if (/^tba\b/i.test(s)) return true;
    return false;
  }

  // F4 standings: race position only (drop legacy "1*30").
  function standingsRacePosOnly(val) {
    var s = (val != null && val !== undefined) ? String(val).trim() : '';
    var star = s.indexOf('*');
    if (star >= 0) s = s.slice(0, star).trim();
    return s;
  }

  // ─── Driver names ───────────────────────────────────────────────────────
  var driverDisplayNames = {
    'Woohyun Shin': 'Michael Shin',
    'W. Shin': 'M. Shin'
  };

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
    return foldDiacritics(name)
      .toLowerCase()
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim();
  }

  var driverArtifactAliases = {
    'romanDe Angelis': 'Roman De Angelis',
    'antonioFelixda Costa': 'Antonio Felix da Costa',
    'paulDi Resta': 'Paul di Resta',
    'davidHeinemeier Hansson': 'David Heinemeier Hansson',
    'manuelEspirito Santo': 'Manuel Espirito Santo',
    'jobVan Uitert': 'Job Van Uitert',
    'connorDe Phillippi': 'Connor De Phillippi',
    'valentinHasse Clot': 'Valentin Hasse Clot',
    'roryvander Steur': 'Rory van der Steur',
    'lilouWadoux Ducellier': 'Lilou Wadoux Ducellier',
    'daveMusial Jr.': 'Dave Musial Jr.',
    'daveMusial Jr': 'Dave Musial Jr.',
    'alessandroPier Guidi': 'Alessandro Pier Guidi'
  };

  function normalizeDriverFragment(name) {
    var s = String(name == null ? '' : name).trim();
    if (!s) return s;
    // NASCAR provisional / substitute markers (* prefix or suffix).
    s = s.replace(/^\*+\s*/, '').replace(/\s*\*+$/, '').trim();
    var aliasKey;
    for (aliasKey in driverArtifactAliases) {
      if (Object.prototype.hasOwnProperty.call(driverArtifactAliases, aliasKey) && s.indexOf(aliasKey) >= 0) {
        s = s.split(aliasKey).join(driverArtifactAliases[aliasKey]);
      }
    }
    return foldDiacritics(s).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim();
  }

  function looksAbbreviatedDriverName(name) {
    var s = String(name == null ? '' : name).trim();
    if (!s) return false;
    return /^[A-Z]\.(?:\s*[A-Z]\.)?\s+\S+/.test(s);
  }

  function titleFromDriverSlug(slug) {
    slug = String(slug == null ? '' : slug).trim().toLowerCase();
    if (!slug) return '';
    return slug.split('-').map(function (part) {
      if (!part) return '';
      if (part === 'jr') return 'Jr.';
      if (part === 'sr') return 'Sr.';
      if (part === 'ii' || part === 'iii' || part === 'iv') return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1);
    }).join(' ').trim();
  }

  function expandedDriverNameFromSlug(name) {
    var raw = String(name == null ? '' : name).trim();
    if (!raw || !looksAbbreviatedDriverName(raw)) return '';
    var currentEntryList = (typeof window !== 'undefined' && window.TGA && window.TGA.currentEventEntryList) || null;
    var canonicalSlug = resolveDriverSlug(slugify(raw));
    if (!canonicalSlug) return '';
    if (currentEntryList && currentEntryList.length) {
      for (var i = 0; i < currentEntryList.length; i++) {
        var entry = currentEntryList[i];
        if (!entry || typeof entry !== 'object') continue;
        var fields = ['driver', 'driver1', 'driver2', 'driver3', 'driver4'];
        for (var f = 0; f < fields.length; f++) {
          var entryRaw = entry[fields[f]];
          if (entryRaw == null || String(entryRaw).trim() === '') continue;
          var entryNames = splitDriverNames(entryRaw);
          for (var n = 0; n < entryNames.length; n++) {
            var full = String(entryNames[n] || '').trim();
            if (!full) continue;
            if (resolveDriverSlug(slugify(full)) === canonicalSlug) return full;
          }
        }
      }
    }
    var displayMap = (typeof window !== 'undefined' && window.TGA && window.TGA.driverDisplayNamesBySlug) || null;
    var mapped = displayMap && displayMap[canonicalSlug] ? String(displayMap[canonicalSlug]).trim() : '';
    if (mapped && !looksAbbreviatedDriverName(mapped)) return mapped;
    var titled = titleFromDriverSlug(canonicalSlug);
    var firstToken = canonicalSlug.split('-')[0] || '';
    if (titled && firstToken.length > 1) return titled;
    return '';
  }

  function driverDisplayName(name) {
    if (name == null || typeof name !== 'string') return name;
    var trimmed = normalizeDriverFragment(name);
    if (isTeamsPlaceholder(trimmed)) return '';
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
    trimmed = trimmed.replace(/\s*\((?:i|r|g|R)\)\s*$/i, '').trim();
    trimmed = trimmed.replace(/\s*\((?:tba|tbc|tbd)\)\s*$/i, '').trim();
    var withoutRaces = trimmed.replace(/\s*\(\d+\s+races?\)\s*$/i, '').trim();
    var normalized = driverDisplayNames[withoutRaces] || driverDisplayNames[trimmed] || withoutRaces || trimmed;
    normalized = foldDiacritics(normalized);
    var expanded = expandedDriverNameFromSlug(normalized);
    if (expanded) normalized = expanded;
    if (normalized === 'AJ Allmendinger') return 'A. J. Allmendinger';
    return normalized;
  }

  function driverLabel(name) {
    var display = driverDisplayName(name);
    if (!display) return display;
    if (typeof window !== 'undefined' && window.TGA && window.TGA.getLang && window.TGA.getLang() === 'ru' && typeof window.TGA.localizeDriverName === 'function') {
      return window.TGA.localizeDriverName(display);
    }
    return display;
  }

  var TEAM_ACRONYMS = {
    af: true, tf: true, ao: true, am: true, jr: true, rfk: true,
    dgm: true, wrt: true, rss: true, mbm: true, ecr: true, rll: true,
    apr: true, ck: true, clx: true, ccm: true, bre: true, dams: true,
    asp: true, akm: true, acr: true, bmw: true, wtr: true, jota: true,
    gt: true, mugen: true, vds: true, hrc: true, idec: true, mks: true,
    csa: true, dkr: true, tds: true, pr1: true, jim: true, sf: true,
    sf23: true, xi: true, '23xi': true, aix: true, as: true
  };

  var TEAM_SMALL_WORDS = {
    by: true, of: true, with: true, du: true, de: true, la: true,
    le: true, et: true, au: true, en: true, and: true, the: true,
    for: true, in: true, x: true, y: true, vs: true
  };

  var TEAM_SPECIAL_WORDS = {
    mclaren: 'McLaren'
  };

  function looksAllCapsTeamName(s) {
    var hasLetter = false;
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      if (/[a-zA-Z]/.test(c)) {
        hasLetter = true;
        if (c >= 'a' && c <= 'z') return false;
      }
    }
    return hasLetter;
  }

  function splitWordPunct(word) {
    var start = 0;
    var end = word.length;
    while (start < end && !/[a-zA-Z0-9]/.test(word.charAt(start))) start++;
    while (end > start && !/[a-zA-Z0-9]/.test(word.charAt(end - 1))) end--;
    if (start >= end) return { prefix: '', core: '', suffix: word };
    return {
      prefix: word.slice(0, start),
      core: word.slice(start, end),
      suffix: word.slice(end)
    };
  }

  function formatTeamWord(word, isFirstWord) {
    if (!word) return word;
    var parts = splitWordPunct(word);
    if (!parts.core) return word;
    var lower = parts.core.toLowerCase();
    if (TEAM_SPECIAL_WORDS[lower]) {
      return parts.prefix + TEAM_SPECIAL_WORDS[lower] + parts.suffix;
    }
    if (TEAM_ACRONYMS[lower]) {
      return parts.prefix + parts.core.toUpperCase() + parts.suffix;
    }
    if (!isFirstWord && TEAM_SMALL_WORDS[lower]) {
      return parts.prefix + lower + parts.suffix;
    }
    if (/^\d/.test(parts.core)) {
      return parts.prefix + parts.core.replace(/[a-z]+/g, function (m) { return m.toUpperCase(); }) + parts.suffix;
    }
    return parts.prefix + lower.charAt(0).toUpperCase() + lower.slice(1) + parts.suffix;
  }

  function formatTeamToken(token, isFirstWord) {
    if (!token) return token;
    return token.split('-').map(function (part, idx) {
      return formatTeamWord(part, isFirstWord && idx === 0);
    }).join('-');
  }

  function formatTeamDisplayName(name) {
    var raw = String(name == null ? '' : name).trim();
    if (!raw || !looksAllCapsTeamName(raw)) return raw;
    return raw.split(/\s+/).map(function (word, idx) {
      return formatTeamToken(word, idx === 0);
    }).join(' ');
  }

  function teamLabel(name) {
    if (name == null) return '';
    var raw = String(name).trim();
    if (!raw) return '';
    raw = formatTeamDisplayName(raw);
    if (typeof window !== 'undefined' && window.TGA && window.TGA.getLang &&
        window.TGA.getLang() === 'ru' && typeof window.TGA.localizeTeamName === 'function') {
      return window.TGA.localizeTeamName(raw);
    }
    return raw;
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
    if (!map && typeof window !== 'undefined' && window.TGA && window.TGA.driverProfileRedirects) {
      map = window.TGA.driverProfileRedirects;
    }
    while (slug) {
      var next = map ? map[slug] : '';
      if (!next) {
        if (slug === 'woohyun-shin' || slug === 'w-shin' || slug === 'm-shin') next = 'michael-shin';
        else if (slug === 'nico-h-lkenberg' || slug === 'nicolas-hulkenberg' || slug === 'nicolas-h-lkenberg') next = 'nico-hulkenberg';
        else if (slug === 'sergio-p-rez') next = 'sergio-perez';
        else if (slug === 'david-sapienza') next = 'dave-sapienza';
        else if (slug === 'matt-payne') next = 'matthew-payne';
        else if (slug === 'cam-waters') next = 'cameron-waters';
        else if (slug === 'giovanni-ruggiero') next = 'gio-ruggiero';
        else if (slug === 'nicolas-varrone') next = 'nico-varrone';
        else if (slug === 'jonathan-mckennedy') next = 'jon-mckennedy';
        else if (slug === 'alexander-dunne') next = 'alex-dunne';
        else if (slug === 'dani-juncadella') next = 'daniel-juncadella';
        else if (slug === 'max-lynn') next = 'maxwell-lynn';
        else if (slug === 'dan-harper') next = 'daniel-harper';
        else if (slug === 'kaku-ohta') next = 'kakunoshin-ohta';
        else if (slug === 'joshua-rattican') next = 'josh-rattican';
        else if (slug === 'ben-hanley') next = 'benjamin-hanley';
        else if (slug === 'john-h-nemechek') next = 'john-hunter-nemechek';
        else if (slug === 'bobby-earnhardt') next = 'bobby-dale-earnhardt';
        else if (slug === 'tobi-lutke') next = 'tobias-lutke';
        else if (slug === 'mike-christopher-jr') next = 'michael-christopher-jr';
        else if (slug === 'chris-werth') next = 'christopher-werth';
        else if (slug === 'garrett-mitchell' || slug === 'cleetus-mitchell') next = 'cleetus-mcfarland';
        else if (slug === 'jj-yeley' || slug === 'j-jj-yeley') next = 'j-j-yeley';
        else if (/-(i|r|g)$/.test(slug)) next = slug.replace(/-(i|r|g)$/, '');
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
      p = normalizeDriverFragment(p);
      var k = driverNameKey(p);
      if (seen[k]) return;
      seen[k] = true;
      out.push(p);
    });
    return out;
  }

  /** Pit-stop tables often store surname only — match entry list for full driver name. */
  function resolveDriverFromEntryList(name, entryList) {
    var trimmed = name == null ? '' : String(name).trim();
    if (!trimmed || trimmed.indexOf(' ') >= 0) return trimmed;
    if (!entryList || !entryList.length) return trimmed;
    var want = driverNameKey(trimmed);
    for (var i = 0; i < entryList.length; i++) {
      var entry = entryList[i];
      if (!entry || typeof entry !== 'object') continue;
      var fields = ['driver', 'driver1', 'driver2', 'driver3'];
      for (var f = 0; f < fields.length; f++) {
        var raw = entry[fields[f]];
        if (raw == null || String(raw).trim() === '') continue;
        var names = splitDriverNames(raw);
        for (var n = 0; n < names.length; n++) {
          var full = String(names[n] || '').trim();
          if (!full) continue;
          var parts = full.split(/\s+/);
          var surname = parts[parts.length - 1] || '';
          if (driverNameKey(surname) === want) return full;
        }
      }
    }
    return trimmed;
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
    var label = driverLabel(row && row.driver);
    var link = '<a href="/driver/' + encodeURIComponent(slugify(display)) + '" class="track-link">' + esc(label) + '</a>';
    return isGuest ? link + ' (G)' : link;
  }

  function entryListDriverLabel(row, guestCars) {
    var display = driverDisplayName(row && row.driver);
    if (!display || dash(display) === '—') return '—';
    var car = row && row.number != null ? String(row.number).trim() : '';
    var guests = guestCars || guestCarNumberSet([row]);
    var isGuest = isGuestEntryRow(row) || !!(car && guests[car]);
    var label = driverLabel(row && row.driver);
    return isGuest ? label + ' (G)' : label;
  }

  function driverLinkHtml(name) {
    var raw = String(name == null ? '' : name).trim();
    if (!raw || dash(raw) === '—') return '—';
    if (/^(?:tba|tbc|tbd)$/i.test(raw)) return '—';
    if (raw.indexOf('/') >= 0 || raw.indexOf(';') >= 0 || isCommaSeparatedCrew(raw)) return driversCellHtml(raw);
    var display = driverDisplayName(raw);
    if (!display || dash(display) === '—') return '—';
    if (/^[^,]+\s*,\s*[^,]+$/.test(display)) {
      var parts = display.split(/\s*,\s*/);
      display = (parts[1] + ' ' + parts[0]).trim();
    }
    var label = driverLabel(raw);
    return '<a href="/driver/' + encodeURIComponent(slugify(display)) + '" class="track-link">' + esc(label) + '</a>';
  }

  function driverTableCell(raw, joiner) {
    var s = raw != null ? String(raw).trim() : '';
    if (!s || dash(s) === '—') return null;
    if (joiner || s.indexOf('/') >= 0 || s.indexOf(';') >= 0 || isCommaSeparatedCrew(s) || splitDriverNames(s).length > 1) {
      return driversCellHtml(s, joiner);
    }
    return driverLinkHtml(s);
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
    var c = String(country).trim();
    var u = c.toUpperCase();
    if (u === 'USA')       return { icon: '\uD83C\uDDFA\uD83C\uDDF8', label: 'USA' };
    if (u === 'ITALY')     return { icon: '\uD83C\uDDEE\uD83C\uDDF9', label: 'Italy' };
    if (u === 'FIA' || u === 'WORLD') return { icon: '\uD83C\uDF10', label: 'World' };
    if (u === 'EUROPE')    return { icon: '\uD83C\uDDEA\uD83C\uDDFA', label: 'Europe' };
    if (u === 'JAPAN')     return { icon: '\uD83C\uDDEF\uD83C\uDDF5', label: 'Japan' };
    if (u === 'AUSTRALIA') return { icon: '\uD83C\uDDE6\uD83C\uDDFA', label: 'Australia' };
    if (u === 'GERMANY')   return { icon: '\uD83C\uDDE9\uD83C\uDDEA', label: 'Germany' };
    return { icon: '', label: c };
  }

  function localizeCountryLabel(label) {
    if (!label || label === '—' || getLang() !== 'ru') return label;
    var lc = String(label).trim().toLowerCase();
    if (lc === 'world' || lc === 'fia') {
      var worldRu = t('series.world');
      return (worldRu && worldRu !== 'series.world') ? worldRu : label;
    }
    var localizeFn = window.TGA && window.TGA.localizeCountryName;
    if (typeof localizeFn === 'function') {
      var ru = localizeFn(label);
      if (ru && ru !== label) return ru;
    }
    return label;
  }

  function countryHtml(country) {
    var d = countryDisplay(country);
    return esc(localizeCountryLabel(d.label));
  }

  function syncStandingsScrollBars() { /* top bar removed */ }

  // ─── Series categories ─────────────────────────────────────────────────────
  var categories = [
    { key: 'openwheel', ids: ['F1', 'INDYCAR', 'SUPER_FORMULA', 'F2', 'F3', 'FREC', 'F4_IT'] },
    { key: 'stockcar',  ids: ['NASCAR_CUP', 'NOAPS', 'NASCAR_TRUCK', 'ARCA', 'NASCAR_MODIFIED'] },
    { key: 'endurance', ids: ['WEC', 'ELMS', 'IMSA', 'GTWCE_END'] },
    // In Touring, show Supercars first
    { key: 'touring',   ids: ['SUPERCARS', 'GTWCE_SPRINT', 'PSC', 'DTM', 'SUPER_GT'] }
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

  // ─── Date formats (display: web/lib/tga-dates-format.js) ─────────────────
  /** Calendar date of race start; range start–end for multi-race weekends and 24-hour races. */
  function formatEventRaceStartDate(e) {
    if (!e) return '—';
    var formatShortDate = window.TGA && window.TGA.formatShortDate;
    var formatDateRange = window.TGA && window.TGA.formatDateRange;
    var parseNamedRaceDurationHours = window.TGA && window.TGA.parseNamedRaceDurationHours;
    if (!formatShortDate || !formatDateRange) return '—';
    var enduranceOnly = window.TGA && window.TGA.enduranceWeekendRaceDayOnly;
    if (enduranceOnly && enduranceOnly(e)) {
      var singleDay = window.TGA && window.TGA.singleRaceCardDateIso;
      var raceDay = singleDay ? singleDay(e) : '';
      if (raceDay) return formatShortDate(raceDay) || raceDay;
    }
    var getRange = window.TGA && window.TGA.getEventRaceDateRangeIso;
    if (getRange) {
      var schedRange = getRange(e);
      if (schedRange.start && schedRange.end && schedRange.end > schedRange.start) {
        return formatDateRange(schedRange.start, schedRange.end);
      }
      // Single race calendar day in viewer TZ (night races may differ from track-local date).
      if (schedRange.start && (!schedRange.end || schedRange.end === schedRange.start)) {
        return formatShortDate(schedRange.start) || schedRange.start;
      }
    }
    var showsWeekendRange = window.TGA && window.TGA.eventShowsWeekendDateRange;
    var parseIso = window.TGA && window.TGA.parseIsoDatePrefix;
    if (showsWeekendRange && showsWeekendRange(e) && parseIso) {
      var spanStart = parseIso(e.start_date || e.startDate || e.date);
      var spanEnd = parseIso(e.end_date || e.endDate);
      if (spanStart && spanEnd && spanEnd > spanStart) {
        return formatDateRange(spanStart, spanEnd);
      }
    }
    var getIso = window.TGA && window.TGA.getEventRaceStartDateIso;
    var raceStartIso = getIso ? getIso(e) : '';
    if (!raceStartIso && parseIso) raceStartIso = parseIso(e.start_date || e.date);
    if (!raceStartIso) return '—';

    var nameForDuration = String(e.name || e.race || '').trim();
    if (parseNamedRaceDurationHours && parseNamedRaceDurationHours(nameForDuration) === 24) {
      var d = new Date(raceStartIso + 'T12:00:00');
      d.setDate(d.getDate() + 1);
      var raceEndIso = d.getFullYear() + '-' +
        ('0' + (d.getMonth() + 1)).slice(-2) + '-' +
        ('0' + d.getDate()).slice(-2);
      if (raceEndIso !== raceStartIso) {
        return formatDateRange(raceStartIso, raceEndIso);
      }
    }
    return formatShortDate(raceStartIso) || raceStartIso;
  }

  /** Full Schedule table: one calendar day per expanded session row. */
  function formatFullScheduleRowDate(e) {
    if (!e) return '—';
    var formatShortDate = window.TGA && window.TGA.formatShortDate;
    if (!formatShortDate) return '—';
    var isSessionRow = window.TGA && window.TGA.isExpandedScheduleSessionRow;
    if (isSessionRow && isSessionRow(e)) {
      var getIsoSession = window.TGA && window.TGA.getEventRaceStartDateIso;
      var sessionIso = getIsoSession ? getIsoSession(e) : '';
      if (!sessionIso) {
        var parseIsoSession = window.TGA && window.TGA.parseIsoDatePrefix;
        sessionIso = parseIsoSession ? parseIsoSession(e.start_date || e.date) : '';
      }
      if (sessionIso) return formatShortDate(sessionIso) || sessionIso;
      return '—';
    }
    return formatEventRaceStartDate(e);
  }

  /** LIVE badge end: estimated chequered flag (+30 min) or named endurance duration (+2 h). */
  function liveEndTsForEvent(ev, startTs, fallbackEndTs) {
    var parseNamed = window.TGA && window.TGA.parseNamedRaceDurationHours;
    var hours = parseNamed ? parseNamed(ev && ev.name) : null;
    if (hours != null && startTs) {
      return startTs + (hours + 2) * 3600000;
    }
    var finMs = estimateLiveFinishedUtcMs(ev);
    if (finMs != null) {
      return finMs + 30 * 60000;
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
    if (sid === 'FREC') return 2;
    // Super Formula races run ~1h (single sprint-length race per session) — the group's
    // multi-race entries (e.g. a Fuji triple-header) rely on THIS per-session duration when
    // computing the finish of each individual race (see getEventLastRaceFinishUtcMs), so a
    // Supercars/DTM-style 3.5h estimate here made every already-finished race look ongoing
    // for hours after the chequered flag.
    if (sid === 'SUPER_FORMULA') return 1.5;
    if (sid === 'SUPERCARS' || sid === 'SUPER_GT' || sid === 'DTM') return 3.5;
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
    var parseNamed = window.TGA && window.TGA.parseNamedRaceDurationHours;
    var named = parseNamed ? parseNamed(ev && ev.name) : null;
    if (named != null) return named;
    return defaultRaceDurationHours(ev);
  }

  /** Shorter finish estimate for LIVE badge (real GP ~2 h, not schedule block). */
  function liveRaceDurationHours(ev) {
    var sid = String((ev && (ev._seriesId || ev.series_id)) || '').toUpperCase();
    var hours = raceDurationHours(ev);
    if (sid === 'F1') return Math.min(hours, 2.5);
    if (sid === 'F2' || sid === 'F3') return Math.min(hours, 2.25);
    if (sid === 'INDYCAR') return Math.min(hours, 2.75);
    // Stock-car default (4.5h) is for card retention; LIVE badge uses a tighter window so
    // short races (e.g. Truck 250 at Richmond ~2h) do not stay LIVE for hours after the flag.
    if (sid === 'NASCAR_TRUCK' || sid === 'ARCA' || sid === 'NASCAR_MODIFIED') return Math.min(hours, 2.5);
    if (sid === 'NOAPS') return Math.min(hours, 3);
    if (sid === 'NASCAR_CUP') return Math.min(hours, 3.5);
    return hours;
  }

  function estimateLiveFinishedUtcMs(ev) {
    if (!ev) return null;
    var getRaceUtc = window.TGA.getEventRaceUtcMs;
    var startUtc = getRaceUtc ? getRaceUtc(ev) : 0;
    if (!startUtc) return null;
    return startUtc + liveRaceDurationHours(ev) * 3600000;
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

  /** UTC start of the first race session (Sprint / Race 1 / single race). */
  function sessionRaceStartUtcMs(sess, ev) {
    if (!sess || !ev) return 0;
    var dateIso = String(sess.start_date || sess.date || '').slice(0, 10);
    if (!isIsoYmdDate(dateIso)) return 0;

    var parseMsk = window.TGA && window.TGA.parseMskDateTime;
    var estToUtc = window.TGA && window.TGA.estToUtcMs;
    var parseParts = window.TGA && window.TGA.parseTimeStringToParts;

    var timeMsk = String(sess.time_msk || '').trim();
    if (timeMsk && parseMsk) {
      var mp = parseMsk(timeMsk, dateIso);
      if (mp && mp.utcMs) return mp.utcMs;
    }

    var timeEst = String(sess.time_est || '').trim();
    if (timeEst && estToUtc && parseParts) {
      var ep = parseParts(timeEst);
      if (ep) {
        return estToUtc(
          parseInt(dateIso.slice(0, 4), 10),
          parseInt(dateIso.slice(5, 7), 10),
          parseInt(dateIso.slice(8, 10), 10),
          ep.hour,
          ep.minute
        );
      }
    }

    return 0;
  }

  function getEventRaceSessionList(ev) {
    if (!ev) return [];
    var getSessions = window.TGA && window.TGA.getEventRaceSessions;
    if (!getSessions) return [];
    var list = getSessions(ev);
    return Array.isArray(list) ? list : [];
  }

  function getEventFirstRaceStartUtcMs(ev) {
    if (!ev) return 0;
    // Already an exploded per-session card (Sprint/Feature/Round N …) — use its OWN start time.
    // buildSessionsForEvent() looks sessions up by ev.id, and exploded rows keep the parent's id,
    // so re-deriving sessions here would return the whole weekend's session list again and collapse
    // every card in the group onto the same (earliest) timestamp.
    var isExpandedRow = window.TGA && window.TGA.isExpandedScheduleSessionRow;
    if (isExpandedRow && isExpandedRow(ev)) {
      var getRaceUtcOwn = window.TGA && window.TGA.getEventRaceUtcMs;
      return getRaceUtcOwn ? (getRaceUtcOwn(ev) || 0) : 0;
    }
    var sessions = getEventRaceSessionList(ev);
    if (sessions.length > 0) {
      var starts = [];
      for (var i = 0; i < sessions.length; i++) {
        var ms = sessionRaceStartUtcMs(sessions[i], ev);
        if (ms) starts.push(ms);
      }
      if (starts.length > 0) return Math.min.apply(null, starts);
    }
    var getRaceUtc = window.TGA && window.TGA.getEventRaceUtcMs;
    return getRaceUtc ? (getRaceUtc(ev) || 0) : 0;
  }

  /** Lower weight = earlier in card row when first-race UTC ties (feeder formulas before F1). */
  function seriesScheduleSortWeight(ev) {
    var sid = String((ev && (ev._seriesId || ev.series_id)) || '').toUpperCase();
    if (sid === 'F3') return 10;
    if (sid === 'F2') return 20;
    if (sid === 'FREC') return 25;
    if (sid === 'F4_IT' || sid === 'ITALIAN_F4') return 28;
    if (sid === 'F1') return 40;
    return 50;
  }

  function compareEventsByFirstRaceStart(a, b) {
    var ka = getEventFirstRaceStartUtcMs(a) || 0;
    var kb = getEventFirstRaceStartUtcMs(b) || 0;
    if (ka !== kb) return ka - kb;
    return seriesScheduleSortWeight(a) - seriesScheduleSortWeight(b);
  }

  function getEventLastRaceFinishUtcMs(ev) {
    if (!ev) return null;
    // Already an exploded per-session card — use its OWN finish estimate, not the whole
    // group's last session (buildSessionsForEvent()/multi-race map look up by ev.id, and
    // exploded rows keep the parent's id, so this would return e.g. Round 7's finish time
    // for a Round 6 card, making an already-finished race look like it's still upcoming).
    var isExpandedRow = window.TGA && window.TGA.isExpandedScheduleSessionRow;
    if (isExpandedRow && isExpandedRow(ev)) {
      return estimateRaceFinishedUtcMs(ev);
    }
    var sessions = getEventRaceSessionList(ev);
    if (sessions.length > 0) {
      var lastSess = sessions[sessions.length - 1];
      var startUtc = sessionRaceStartUtcMs(lastSess, ev);
      if (startUtc) return startUtc + raceDurationHours(ev) * 3600000;
    }
    return estimateRaceFinishedUtcMs(ev);
  }

  /** Series with server-side livesync — UI follows live.json, not schedule heuristics. */
  var LIVE_SYNC_EVENT_PREFIXES = [
    'NASCAR_CUP_', 'NOAPS_', 'NASCAR_TRUCK_', 'F1_', 'WEC_', 'SUPER_FORMULA_'
  ];

  function eventUsesLiveSync(eventId) {
    var u = String(eventId || '').toUpperCase();
    if (!u) return false;
    for (var i = 0; i < LIVE_SYNC_EVENT_PREFIXES.length; i++) {
      if (u.indexOf(LIVE_SYNC_EVENT_PREFIXES[i]) === 0) return true;
    }
    return false;
  }

  /** Whether the event should appear in Last Results (first race started). */
  function isPastForLastResultsEvent(ev) {
    if (!ev) return false;

    var firstStart = getEventFirstRaceStartUtcMs(ev);
    var now = Date.now();
    if (firstStart) {
      if (now < firstStart) return false;
      var finishMs = getEventLastRaceFinishUtcMs(ev);
      if (finishMs && now < finishMs) return false;
      if (eventUsesLiveSync(ev.id)) {
        var liveSet = window.TGA && window.TGA.liveEventIds;
        if (liveSet && liveSet[String(ev.id || '').toUpperCase()]) {
          return false;
        }
      }
      return true;
    }

    var today = new Date();
    var todayISO = today.getFullYear() + '-' +
      ('0' + (today.getMonth() + 1)).slice(-2) + '-' +
      ('0' + today.getDate()).slice(-2);
    var startStr = (ev.start_date || ev.date || '').slice(0, 10);
    var endStr = (ev.end_date || startStr || '').slice(0, 10);
    var getRange = window.TGA && window.TGA.getEventRaceDateRangeIso;
    if (getRange) {
      var range = getRange(ev);
      if (range.start) startStr = range.start;
      if (range.end) endStr = range.end;
    }
    if (!isIsoYmdDate(endStr)) return false;
    if (isIsoYmdDate(startStr) && startStr > todayISO) return false;
    if (isIsoYmdDate(endStr) && endStr > todayISO) return false;
    if (endStr < todayISO) return true;
    var finMs = estimateRaceFinishedUtcMs(ev);
    if (finMs == null) return endStr <= todayISO;
    return now >= finMs;
  }

  /** Last Results card visible until this many ms after the last race finishes. */
  function lastResultsWindowEndUtcMs(ev) {
    if (!ev) return null;
    var finishMs = getEventLastRaceFinishUtcMs(ev);
    if (finishMs != null) return finishMs + 7 * 86400000;
    var endStr = (ev.end_date || ev.start_date || ev.date || '').slice(0, 10);
    var getRange = window.TGA && window.TGA.getEventRaceDateRangeIso;
    if (getRange) {
      var range = getRange(ev);
      if (range.end) endStr = range.end;
    }
    if (!isIsoYmdDate(endStr)) return null;
    var parts = endStr.split('-');
    var y = parseInt(parts[0], 10);
    var mo = parseInt(parts[1], 10) - 1;
    var da = parseInt(parts[2], 10);
    return new Date(y, mo, da + 7, 23, 59, 59, 999).getTime();
  }

  function isWithinLastResultsWindow(ev) {
    if (!ev) return false;
    var limitMs = lastResultsWindowEndUtcMs(ev);
    if (limitMs == null) return false;
    return Date.now() <= limitMs;
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

  function isConstructorStandingsSeries(seriesKey) {
    var sk = String(seriesKey || '').toLowerCase().replace(/-/g, '_');
    return sk === 'f1' || sk.indexOf('f1_') === 0;
  }

  function getStandingsMode(seriesKey) {
    var sk = String(seriesKey || '').toLowerCase().replace(/-/g, '_');
    try {
      var stored = sessionStorage.getItem('standings-mode:' + sk);
      if (isConstructorStandingsSeries(sk)) {
        if (stored === 'constructors' || stored === 'driver') return stored;
        return 'driver';
      }
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

  /** Crews → driver standings: per car, points only for rounds where a driver was in the crew roster. */
  function buildDriverClassesFromCrew(classes, raceOrder) {
    raceOrder = raceOrder || [];
    return (classes || []).map(function (cls) {
      var lineMap = {};
      var lineOrder = [];

      function pushLine(lineKey, row, driverLabel, pointsNum, races, quals) {
        if (lineMap[lineKey]) return;
        lineMap[lineKey] = {
          driver: driverLabel,
          team: row.team || '',
          manufacturer: row.manufacturer || '',
          car: row.car || '',
          races: races || {},
          quals: quals || {},
          pointsNum: pointsNum
        };
        lineOrder.push(lineKey);
      }

      (cls.rows || []).forEach(function (row) {
        var roundDrivers = row.round_drivers;
        var hasRoundData = roundDrivers && typeof roundDrivers === 'object' &&
          Object.keys(roundDrivers).some(function (code) {
            return roundDrivers[code] != null && String(roundDrivers[code]).trim() !== '';
          });

        if (!hasRoundData) {
          var names = splitDriverNames(row.driver);
          if (names.length === 0) return;
          var rowPts = parseStandingsPoints(row.points);
          names.forEach(function (rawName) {
            var key = String(row.car || '') + '\0' + driverNameKey(rawName);
            if (lineMap[key]) return;
            var races = {};
            var quals = {};
            raceOrder.forEach(function (code) {
              if (row.races && row.races[code] != null && String(row.races[code]).trim() !== '') {
                races[code] = row.races[code];
              }
              if (row.quals && row.quals[code] != null && String(row.quals[code]).trim() !== '') {
                quals[code] = row.quals[code];
              }
            });
            pushLine(key, row, driverDisplayName(rawName), rowPts, races, quals);
          });
          return;
        }

        var perDriver = {};
        raceOrder.forEach(function (code) {
          var drvRaw = roundDrivers[code];
          if (drvRaw == null || String(drvRaw).trim() === '') return;
          var names = splitDriverNames(drvRaw);
          if (names.length === 0) return;
          var rPts = parseStandingsPoints(row.round_points && row.round_points[code]);
          var qPts = parseStandingsPoints(row.round_qual_points && row.round_qual_points[code]);
          var totalRound = rPts + qPts;
          var raceCell = row.races && row.races[code] != null ? String(row.races[code]).trim() : '';
          var qualCell = row.quals && row.quals[code] != null ? String(row.quals[code]).trim() : '';

          names.forEach(function (rawName) {
            var dkey = driverNameKey(rawName);
            if (!perDriver[dkey]) {
              perDriver[dkey] = {
                driver: rawName,
                fingerprint: [],
                pointsNum: 0,
                races: {},
                quals: {}
              };
            }
            var d = perDriver[dkey];
            d.pointsNum += totalRound;
            if (raceCell !== '') d.races[code] = row.races[code];
            if (qualCell !== '') d.quals[code] = row.quals[code];
            d.fingerprint.push(code + ':' + raceCell + ':' + qualCell + ':' + String(totalRound));
          });
        });

        var fpGroups = {};
        Object.keys(perDriver).forEach(function (dkey) {
          var d = perDriver[dkey];
          d.fingerprint.sort();
          var fp = d.fingerprint.join('|');
          if (!fpGroups[fp]) fpGroups[fp] = [];
          fpGroups[fp].push(d);
        });

        Object.keys(fpGroups).forEach(function (fp) {
          var group = fpGroups[fp];
          group.sort(function (a, b) {
            return String(a.driver || '').localeCompare(String(b.driver || ''), undefined, { sensitivity: 'base' });
          });
          var lineKey = String(row.car || '') + '\0' + fp;
          var combinedDriver = group.map(function (g) { return driverDisplayName(g.driver); }).join(' / ');
          pushLine(lineKey, row, combinedDriver, group[0].pointsNum, group[0].races, group[0].quals);
        });
      });

      var rows = lineOrder.map(function (key) {
        var d = lineMap[key];
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
      rows = rows.filter(function (r) {
        if (r._pointsNum > 0) return true;
        return raceOrder.some(function (code) {
          return r.races && r.races[code] != null && String(r.races[code]).trim() !== '';
        });
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
    var active = mode === 'crew' ? 'crew' : (mode === 'constructors' ? 'constructors' : 'driver');
    nav.querySelectorAll('[data-mode]').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-mode') === active);
    });
  }

  function ensureStandingsModeNav(seriesKey, onChange) {
    var nav = document.getElementById('standings-mode-nav');
    if (!nav) return false;
    var isCrew = isCrewStandingsSeries(seriesKey);
    var isCtor = isConstructorStandingsSeries(seriesKey);
    if (!isCrew && !isCtor) {
      hideStandingsModeNav();
      return false;
    }
    standingsModeNavCallback = onChange;
    standingsModeNavSeriesKey = seriesKey;
    nav.classList.remove('hidden');
    var expectedSecond = isCtor ? 'constructors' : 'crew';
    if (nav.getAttribute('data-series-key') === seriesKey && nav.querySelector('[data-mode="' + expectedSecond + '"]')) {
      return true;
    }
    var tFn = function (k) { return window.TGA.t(k); };
    nav.setAttribute('data-series-key', seriesKey);
    var secondLabel = isCtor
      ? (tFn('standings.team_points') || 'Constructors')
      : (tFn('nav.standings.crew') || 'Crew');
    var firstLabel = isCtor
      ? (tFn('standings.driver_points') || 'Drivers')
      : (tFn('nav.standings.driver') || 'Driver');
    nav.innerHTML =
      '<button type="button" class="nav-link" data-mode="driver">' +
        esc(firstLabel) +
      '</button>' +
      '<button type="button" class="nav-link" data-mode="' + expectedSecond + '">' +
        esc(secondLabel) +
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
    if (!seriesKey || (!isCrewStandingsSeries(seriesKey) && !isConstructorStandingsSeries(seriesKey))) {
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
  function gtwceEnduranceEventAbbrev(evName) {
    var lc = String(evName || '').toLowerCase();
    if (lc.indexOf('paul ricard') >= 0 || lc.indexOf('castellet') >= 0) return 'LEC';
    if (lc.indexOf('monza') >= 0) return 'MNZ';
    if (lc.indexOf('spa') >= 0) return 'SPA';
    if (lc.indexOf('nürburgring') >= 0 || lc.indexOf('nurburgring') >= 0) return 'NÜR';
    if (lc.indexOf('portim') >= 0 || lc.indexOf('algarve') >= 0) return 'ALG';
    return 'R';
  }

  function gtwceSpaCheckpointSubLabel(code, lang) {
    if (!code || typeof code !== 'string') return null;
    var m = code.match(/^R\d+-(6h|12h|24h)$/);
    if (!m) return null;
    if (lang === 'ru') {
      if (m[1] === '6h') return '6ч';
      if (m[1] === '12h') return '12ч';
      if (m[1] === '24h') return '24ч';
    }
    return m[1];
  }

  function buildGtwceEnduranceHeaderGroups(raceOrder, eventNames, lang) {
    var groups = [];
    var i = 0;
    while (i < raceOrder.length) {
      var sub0 = gtwceSpaCheckpointSubLabel(raceOrder[i], lang);
      if (sub0 && i + 2 < raceOrder.length &&
          gtwceSpaCheckpointSubLabel(raceOrder[i + 1], lang) &&
          gtwceSpaCheckpointSubLabel(raceOrder[i + 2], lang)) {
        groups.push({
          colspan: 3,
          top: gtwceEnduranceEventAbbrev(eventNames[i] || ''),
          subs: [
            gtwceSpaCheckpointSubLabel(raceOrder[i], lang),
            gtwceSpaCheckpointSubLabel(raceOrder[i + 1], lang),
            gtwceSpaCheckpointSubLabel(raceOrder[i + 2], lang)
          ]
        });
        i += 3;
        continue;
      }
      groups.push({
        colspan: 1,
        top: gtwceEnduranceEventAbbrev(eventNames[i] || ''),
        subs: null
      });
      i += 1;
    }
    return groups;
  }

  // Standings race headers double as links to the event they score.
  function standingsEventHref(eventId) {
    var id = String(eventId == null ? '' : eventId).trim();
    if (!id) return '';
    return '/event/' + encodeURIComponent(id.toLowerCase().replace(/_/g, '-')) + '/race';
  }

  // labelHtml is already escaped; rounds without an event file stay plain text.
  function standingsRaceHeaderHtml(labelHtml, eventId) {
    var href = standingsEventHref(eventId);
    if (!href) return labelHtml;
    return '<a href="' + href + '" class="standings-race-link">' + labelHtml + '</a>';
  }

  function standingsEventIds(dataObj) {
    return (dataObj && Array.isArray(dataObj.event_ids)) ? dataObj.event_ids : [];
  }

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
    var eventIdsForStandings = standingsEventIds(dataObj);
    function raceHeaderCell(idx, labelHtml, attrs) {
      return '<th class="col-race"' + (attrs || '') + '>'
        + standingsRaceHeaderHtml(labelHtml, eventIdsForStandings[idx]) + '</th>';
    }
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
        if (sk === 'gtwce_end') {
          return gtwceEnduranceEventAbbrev(eventNamesForStandings[idx] || '');
        }
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
    var isGtwceEnd = sk === 'gtwce_end';
    var gtwceHeaderGroups = isGtwceEnd ? buildGtwceEnduranceHeaderGroups(raceOrder, eventNamesForStandings, lang) : null;
    var useGtwceSpaSplit = gtwceHeaderGroups && gtwceHeaderGroups.some(function (g) { return g.subs && g.subs.length; });
    var html = '<div class="imsa-standings-by-class' + (isGtwce ? ' gtwce-standings-by-class' : '') + '">';
    classes.forEach(function (cls) {
      var classRows = cls.rows || [];
      if (!isGtwce && classRows.length === 0) return;
      var th;
      var body;
      var tableExtraClass = '';
      var tableExtraClassGtwce = '';
      var theadSplit = '';
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
        var tableExtraClassGtwce = '';
        if (useGtwceSpaSplit) {
          tableExtraClassGtwce = ' gtwce-standings-split';
          var tr1g = '<th class="col-num" rowspan="2">' + esc(tFn('th.pos') || 'Pos') + '</th>';
          if (!isCrewMode) tr1g += '<th rowspan="2">' + esc(tFn('th.driver') || 'Driver') + '</th>';
          tr1g += '<th class="col-car" rowspan="2">' + esc(tFn('th.no') || '#') + '</th>' +
            '<th rowspan="2">' + esc(tFn('th.team') || 'Team') + '</th>' +
            '<th rowspan="2">' + esc(carLabel) + '</th>';
          var tr2g = '';
          var gtwceCol = 0;
          for (var gg = 0; gg < gtwceHeaderGroups.length; gg++) {
            var grp = gtwceHeaderGroups[gg];
            if (grp.subs) {
              tr1g += raceHeaderCell(gtwceCol, esc(grp.top), ' colspan="' + grp.colspan + '"');
              for (var gs = 0; gs < grp.subs.length; gs++) {
                tr2g += '<th class="col-race col-gtwce-spa">'
                  + standingsRaceHeaderHtml(esc(grp.subs[gs]), eventIdsForStandings[gtwceCol + gs]) + '</th>';
              }
            } else {
              tr1g += raceHeaderCell(gtwceCol, esc(grp.top), ' rowspan="2"');
            }
            gtwceCol += grp.colspan;
          }
          tr1g += '<th class="col-pts" rowspan="2">' + esc(tFn('th.pts') || 'Pts') + '</th>';
          theadSplit = '<thead><tr>' + tr1g + '</tr><tr>' + tr2g + '</tr></thead>';
        } else {
          th = '<th class="col-num">' + esc(tFn('th.pos') || 'Pos') + '</th>';
          if (!isCrewMode) th += '<th>' + esc(tFn('th.driver') || 'Driver') + '</th>';
          th += '<th class="col-car">' + esc(tFn('th.no') || '#') + '</th>' +
            '<th>' + esc(tFn('th.team') || 'Team') + '</th>' +
            '<th>' + esc(carLabel) + '</th>';
          for (var gi = 0; gi < raceOrder.length; gi++) {
            th += raceHeaderCell(gi, esc(raceHeaderLabel(raceOrder[gi], gi)));
          }
          th += '<th class="col-pts">' + esc(tFn('th.pts') || 'Pts') + '</th>';
        }
        body = classRows.map(function (row) {
          var posDisplay = (row.pos === 0 || row.pos === null || row.pos === undefined) ? '—' : row.pos;
          var td = '<td class="col-num">' + posDisplay + '</td>';
          if (!isCrewMode) td += '<td>' + driversCellHtml(row.driver) + '</td>';
          td += '<td class="col-car">' + esc(row.car || '—') + '</td>' +
            '<td>' + esc(dash(teamLabel(row.team))) + '</td>' +
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
            tr1 += raceHeaderCell(im, esc(raceHeaderLabel(raceOrder[im], im)), ' colspan="2"');
          }
          tr1 += '<th class="col-pts" rowspan="2">' + tFn('th.pts') + '</th>';
          var tr2 = '';
          for (var im2 = 0; im2 < raceOrder.length; im2++) {
            tr2 += '<th class="col-race col-imsa-qr">' + standingsRaceHeaderHtml(esc(labelQ), eventIdsForStandings[im2]) + '</th>' +
              '<th class="col-race col-imsa-qr">' + standingsRaceHeaderHtml(esc(labelR), eventIdsForStandings[im2]) + '</th>';
          }
          theadHtml = '<thead><tr>' + tr1 + '</tr><tr>' + tr2 + '</tr></thead>';
          body = classRows.map(function (row) {
            var posDisplay = (row.pos === 0 || row.pos === null || row.pos === undefined) ? '—' : row.pos;
            var td = '<td class="col-num">' + posDisplay + '</td>';
            if (hasCarNum) td += '<td class="col-car">' + esc(row.car || '—') + '</td>';
            if (!isCrewMode) td += '<td>' + driversCellHtml(row.driver) + '</td>';
            td += '<td>' + esc(dash(teamLabel(row.team))) + '</td>';
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
            th += raceHeaderCell(i, esc(raceHeaderLabel(raceOrder[i], i)));
          }
          th += '<th class="col-pts">' + tFn('th.pts') + '</th>';
          theadHtml = '<thead><tr>' + th + '</tr></thead>';
          body = classRows.map(function (row) {
            var posDisplay = (row.pos === 0 || row.pos === null || row.pos === undefined) ? '—' : row.pos;
            var td = '<td class="col-num">' + posDisplay + '</td>';
            if (hasCarNum) td += '<td class="col-car">' + esc(row.car || '—') + '</td>';
            if (!isCrewMode) td += '<td>' + driversCellHtml(row.driver) + '</td>';
            td += '<td>' + esc(dash(teamLabel(row.team))) + '</td>';
            if (showModelCol) td += '<td>' + carCell(row) + '</td>';
            td += raceCells(row);
            td += '<td class="col-pts">' + esc(dash(row.points)) + '</td>';
            return '<tr>' + td + '</tr>';
          }).join('');
        }
      }
      html += '<h4 class="table-section-title">' + esc(cls.name || cls.id || '') + '</h4>';
      html += '<div class="table-wrap"><table class="data-table standings-class-table' + (isGtwce ? tableExtraClassGtwce || '' : tableExtraClass) + '">';
      if (isGtwce) {
        if (useGtwceSpaSplit) {
          html += theadSplit + '<tbody>' + body + '</tbody></table></div>';
        } else {
          html += '<thead><tr>' + th + '</tr></thead><tbody>' + body + '</tbody></table></div>';
        }
      } else {
        html += theadHtml + '<tbody>' + body + '</tbody></table></div>';
      }
    });
    html += '</div>';
    return html;
  }

  /** Supercars site URLs use championship weekend number (file suffix), not schedule race number. */
  function supercarsWeekendEventSlug(e, weekendRound) {
    if (weekendRound == null || weekendRound === '') return '';
    var id = String((e && e.id) || '');
    var m = id.match(/_(\d{4})_/i);
    var season = (m && m[1]) ? m[1] : '2026';
    return 'supercars-' + season + '-' + String(weekendRound);
  }

  // ─── Export ─────────────────────────────────────────────────────────────
  window.TGA.esc                      = esc;
  window.TGA.safeHref                 = safeHref;
  window.TGA.dash                     = dash;
  window.TGA.standingsRacePosOnly     = standingsRacePosOnly;
  window.TGA.driverDisplayName        = driverDisplayName;
  window.TGA.driverLabel              = driverLabel;
  window.TGA.teamLabel                = teamLabel;
  window.TGA.formatTeamDisplayName  = formatTeamDisplayName;
  window.TGA.foldDiacritics           = foldDiacritics;
  window.TGA.isGuestEntryRow          = isGuestEntryRow;
  window.TGA.guestCarNumberSet        = guestCarNumberSet;
  window.TGA.entryListDriverCell      = entryListDriverCell;
  window.TGA.entryListDriverLabel     = entryListDriverLabel;
  window.TGA.slugify                  = slugify;
  window.TGA.resolveDriverSlug        = resolveDriverSlug;
  window.TGA.driverLinkHtml           = driverLinkHtml;
  window.TGA.driverTableCell          = driverTableCell;
  window.TGA.driversCellHtml          = driversCellHtml;
  window.TGA.splitDriverNames         = splitDriverNames;
  window.TGA.resolveDriverFromEntryList = resolveDriverFromEntryList;
  window.TGA.isSeriesId               = isSeriesId;
  window.TGA.adjustEventPanelPadding  = adjustEventPanelPadding;
  window.TGA.adjustDetailPanelPadding = adjustDetailPanelPadding;
  window.TGA.adjustSeasonPanelPadding = adjustSeasonPanelPadding;
  window.TGA.supercarsWeekendEventSlug = supercarsWeekendEventSlug;
  window.TGA.addObjectTableSort       = addObjectTableSort;
  window.TGA.typeLabel                = typeLabel;
  window.TGA.countryDisplay           = countryDisplay;
  window.TGA.countryHtml              = countryHtml;
  window.TGA.syncStandingsScrollBars  = syncStandingsScrollBars;
  window.TGA.standingsEventHref       = standingsEventHref;
  window.TGA.standingsRaceHeaderHtml  = standingsRaceHeaderHtml;
  window.TGA.standingsEventIds        = standingsEventIds;
  window.TGA.buildImsaGtwceClassStandingsHtml = buildImsaGtwceClassStandingsHtml;
  window.TGA.buildDriverClassesFromCrew = buildDriverClassesFromCrew;
  window.TGA.isCrewStandingsSeries = isCrewStandingsSeries;
  window.TGA.isConstructorStandingsSeries = isConstructorStandingsSeries;
  window.TGA.getStandingsMode = getStandingsMode;
  window.TGA.setStandingsMode = setStandingsMode;
  window.TGA.renderStandingsModeNav = renderStandingsModeNav;
  window.TGA.updateStandingsModeNavActive = updateStandingsModeNavActive;
  window.TGA.hideStandingsModeNav = hideStandingsModeNav;
  window.TGA.categories               = categories;
  window.TGA.categoryBySeriesId       = categoryBySeriesId;
  window.TGA.hexRgb                   = hexRgb;
  window.TGA.seriesBadge              = seriesBadge;
  window.TGA.formatEventRaceStartDate = formatEventRaceStartDate;
  window.TGA.formatFullScheduleRowDate = formatFullScheduleRowDate;
  window.TGA.parseEventDate           = parseEventDate;
  window.TGA.liveEndTsForEvent        = liveEndTsForEvent;
  window.TGA.raceDurationHours          = raceDurationHours;
  window.TGA.estimateRaceFinishedUtcMs  = estimateRaceFinishedUtcMs;
  window.TGA.getEventFirstRaceStartUtcMs = getEventFirstRaceStartUtcMs;
  window.TGA.compareEventsByFirstRaceStart = compareEventsByFirstRaceStart;
  window.TGA.getEventLastRaceFinishUtcMs = getEventLastRaceFinishUtcMs;
  window.TGA.isWithinLastResultsWindow   = isWithinLastResultsWindow;
  window.TGA.isPastForLastResultsEvent  = isPastForLastResultsEvent;
  window.TGA.eventUsesLiveSync          = eventUsesLiveSync;
  window.TGA.liveEventIds               = window.TGA.liveEventIds || {};
  window.TGA.nextRaceEndTs              = nextRaceEndTs;
})();