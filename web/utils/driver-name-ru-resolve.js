// Etalon-based driver RU lookup: full names, abbreviations (M. Verstappen), legal extensions.
(function () {
  if (typeof window === 'undefined') return;
  window.TGA_RU = window.TGA_RU || {};

  var nameParticles = /^(van|von|de|del|der|della|la|le|st|di|bin|al|mc|da|dos|das|el|den|ter)$/i;

  function foldKey(name) {
    return String(name || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s*\((?:i|r|g)\)\s*$/i, function (m) { return m.toLowerCase(); })
      .replace(/\b([a-z])\.\s+(?=[a-z]\.)/g, '$1.')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function stripMarkers(name) {
    var api = window.TGA_RU.stripDriverMarkers;
    if (typeof api === 'function') return api(name);
    return String(name || '').trim().replace(/\s*\((?:i|r|g)\)\s*$/i, '').trim();
  }

  function driverSurnameLatin(base) {
    var words = String(base || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return '';
    if (words.length === 1) return words[0];
    var start = words.length - 1;
    while (start > 0 && nameParticles.test(words[start - 1])) start--;
    return words.slice(start).join(' ');
  }

  function surnameWordCount(latin) {
    return driverSurnameLatin(latin).split(/\s+/).filter(Boolean).length;
  }

  function translitMiddle(word) {
    var fn = window.TGA_RU.translitDriverNameToRu;
    if (typeof fn !== 'function') return String(word || '');
    return fn(String(word || '').trim());
  }

  function findShortEntry(latinName, map) {
    var stripped = stripMarkers(latinName);
    var key = foldKey(stripped);
    if (map[key]) return { key: key, ru: map[key] };

    var parts = stripped.split(/\s+/).filter(Boolean);
    if (parts.length < 2) return null;

    var sur = driverSurnameLatin(stripped);
    var tryKey = foldKey(parts[0] + ' ' + sur);
    if (map[tryKey]) return { key: tryKey, ru: map[tryKey] };

    var first = parts[0].toLowerCase();
    for (var k in map) {
      if (!Object.prototype.hasOwnProperty.call(map, k)) continue;
      var kp = k.split(/\s+/);
      if (kp[0] !== first) continue;
      if (driverSurnameLatin(k).toLowerCase() !== sur.toLowerCase()) continue;
      return { key: k, ru: map[k] };
    }
    return null;
  }

  function buildFullLegalRu(latinFull, shortRu) {
    var stripped = stripMarkers(latinFull);
    var parts = stripped.split(/\s+/).filter(Boolean);
    if (parts.length < 3) return shortRu;

    var surWords = surnameWordCount(stripped);
    var middleLatin = parts.slice(1, parts.length - surWords);
    if (!middleLatin.length) return shortRu;

    var ruParts = String(shortRu || '').trim().split(/\s+/).filter(Boolean);
    if (ruParts.length < 2) return shortRu;

    var ruSur = ruParts.slice(-surWords);
    var ruFirst = ruParts[0];
    var middleRu = middleLatin.map(function (w) { return translitMiddle(w); });
    return [ruFirst].concat(middleRu).concat(ruSur).join(' ');
  }

  function ruAbbrevFromEtalon(latinAbbrev, shortKey, shortRu) {
    var t = stripMarkers(latinAbbrev);
    var m = t.match(/^((?:[A-Z]\.\s*)+)\s*(.+)$/i);
    if (!m) return null;

    var initCount = m[1].trim().split(/\s+/).filter(Boolean).length;
    var surWords = surnameWordCount(shortKey);
    var ruParts = String(shortRu || '').trim().split(/\s+/).filter(Boolean);
    if (ruParts.length < initCount + 1) return null;

    var ruGiven = ruParts.slice(0, ruParts.length - surWords);
    var ruSur = ruParts.slice(-surWords).join(' ');
    var ruAbbrevs = ruGiven.slice(0, initCount).map(function (p) {
      if (/\./.test(p)) return p;
      return p.charAt(0) + '.';
    });
    return ruAbbrevs.join(' ') + ' ' + ruSur;
  }

  function resolveAbbreviated(latin, map) {
    var key = foldKey(stripMarkers(latin));
    if (map[key]) return map[key];

    var t = stripMarkers(latin);
    var m = t.match(/^((?:[A-Z]\.\s*)+)\s*(.+)$/i);
    if (!m) return null;

    var inits = m[1].trim().split(/\s+/).map(function (s) {
      return s.replace(/\./g, '').charAt(0).toUpperCase();
    });
    var surLatin = m[2].trim();

    for (var k in map) {
      if (!Object.prototype.hasOwnProperty.call(map, k)) continue;
      if (driverSurnameLatin(k).toLowerCase() !== driverSurnameLatin(surLatin).toLowerCase()) continue;
      var kp = k.split(/\s+/);
      var ok = true;
      for (var i = 0; i < inits.length; i++) {
        if (!kp[i] || kp[i].charAt(0).toUpperCase() !== inits[i]) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      return ruAbbrevFromEtalon(latin, k, map[k]);
    }
    return null;
  }

  function resolveDriverNameRu(name, map) {
    if (name == null) return '';
    var val = String(name).trim();
    if (!val) return val;
    if (/[\u0400-\u04FF]/.test(val)) return val;
    if (!map || typeof map !== 'object') return '';

    var key = foldKey(val);
    if (map[key]) return map[key];

    var parseSuffix = window.TGA_RU.parseDriverSuffix;
    var suffixToRu = window.TGA_RU.driverSuffixToRu;
    if (typeof parseSuffix === 'function' && typeof suffixToRu === 'function') {
      var parsed = parseSuffix(val);
      if (parsed.suffix) {
        var baseKey = foldKey(parsed.base);
        if (map[baseKey]) {
          var sufRu = suffixToRu(parsed.suffix);
          return sufRu ? map[baseKey] + ' ' + sufRu : map[baseKey];
        }
        var baseResolved = resolveDriverNameRu(parsed.base, map);
        if (baseResolved && baseResolved !== parsed.base) {
          var sufRu2 = suffixToRu(parsed.suffix);
          return sufRu2 ? baseResolved + ' ' + sufRu2 : baseResolved;
        }
      }
    }

    var isAbbrev = window.TGA_RU.isAbbreviatedDriverName;
    if (typeof isAbbrev === 'function' && isAbbrev(val)) {
      var abbrevRu = resolveAbbreviated(val, map);
      if (abbrevRu) return abbrevRu;
    }

    var stripped = stripMarkers(val);
    var wordCount = stripped.split(/\s+/).filter(Boolean).length;
    if (wordCount >= 3) {
      var short = findShortEntry(stripped, map);
      if (short) return buildFullLegalRu(stripped, short.ru);
    }

    if (wordCount === 2 || wordCount === 1) {
      var entry = findShortEntry(stripped, map);
      if (entry) return entry.ru;
    }

    if (wordCount === 1) {
      var want = stripped.toLowerCase();
      var hits = [];
      for (var k2 in map) {
        if (!Object.prototype.hasOwnProperty.call(map, k2)) continue;
        if (driverSurnameLatin(k2).toLowerCase() === want) hits.push(map[k2]);
      }
      if (hits.length === 1) return hits[0];
    }

    return '';
  }

  window.TGA_RU.resolveDriverNameRu = resolveDriverNameRu;
  window.TGA_RU.buildFullLegalDriverRu = buildFullLegalRu;
  window.TGA_RU.ruAbbrevDriverFromEtalon = ruAbbrevFromEtalon;
})();
