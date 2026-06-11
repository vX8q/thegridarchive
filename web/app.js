(function () {
  var fetchJSON = (window.TGA && window.TGA.fetchJSON) || function (url, opts) {
    return fetch(url, opts || {}).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  };

  // Centralized logger. Respects an existing window.TGA.logger,
  // or creates its own if missing. All UI logging goes through it,
  // so Sentry can be wired in later / output suppressed in production
  // (via window.TGA.onError and window.TGA.debug = false).
  var logger = (function () {
    window.TGA = window.TGA || {};
    if (window.TGA.logger && typeof window.TGA.logger.error === 'function') {
      return window.TGA.logger;
    }
    var hasConsole = typeof window !== 'undefined' && !!window.console;
    var debugEnabled = false;
    try { debugEnabled = !!window.TGA.debug || localStorage.getItem('tga-debug') === '1'; } catch (e) {}
    var report = (typeof window.TGA.onError === 'function') ? window.TGA.onError : function () {};
    function call(level, args) {
      if (!hasConsole) return;
      var fn = console[level] || console.log;
      if (typeof fn !== 'function' || typeof fn.apply !== 'function') return;
      try { fn.apply(console, ['[TGA]'].concat(Array.prototype.slice.call(args))); } catch (e) { /* ignore */ }
    }
    var impl = {
      error: function (msg, err) { call('error', arguments); try { report(msg, err); } catch (e) {} },
      warn:  function (msg, err) { call('warn', arguments);  try { report(msg, err); } catch (e) {} },
      info:  function () { if (debugEnabled) call('info', arguments); },
      debug: function () { if (debugEnabled) call('log', arguments); }
    };
    window.TGA.logger = impl;
    return impl;
  })();
  var loadedSeriesId = null;
  var eventCache = {};
  /** Incremented on each renderEventPage call; stale fetch responses are discarded on fast tab switches.  */
  var eventPageLoadGeneration = 0;

  // Display driver name (data may contain alias or "Name (N races)")
  var driverDisplayNames = { 'Cleetus Mitchell': 'Garrett Mitchell' };
  function driverNameKey(name) {
    if (name == null) return '';
    return String(name)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function driverDisplayName(name) {
    if (name == null || typeof name !== 'string') return name;
    var trimmed = name.trim();
    if (trimmed.indexOf('/') >= 0) {
      var parts = trimmed.split(/\s*\/\s*/);
      var seen = {};
      var out = [];
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i].trim();
        if (!p) continue;
        var k = driverNameKey(p);
        if (seen[k]) continue;
        seen[k] = true;
        out.push(p);
      }
      trimmed = out.join(' / ');
    }
    // "(i)" / "(R)" / "(G)" — race or entry-list markers; strip for profile/search links.
    trimmed = trimmed.replace(/\s*\((?:i|r|g)\)\s*$/i, '').trim();
    // Strip race count in parentheses: "Spencer Boyd (22 races)" → "Spencer Boyd"
    var withoutRaces = trimmed.replace(/\s*\(\d+\s+races?\)\s*$/i, '').trim();
    var normalized = driverDisplayNames[withoutRaces] || driverDisplayNames[trimmed] || withoutRaces || trimmed;
    if (normalized === 'AJ Allmendinger') return 'A. J. Allmendinger';
    return normalized;
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
    var isGuest = isGuestEntryRow(row) || !!(guestCars && car && guestCars[car]);
    var link = '<a href="/driver/' + encodeURIComponent(slugify(display)) + '" class="track-link">' + esc(display) + '</a>';
    return isGuest ? link + ' (G)' : link;
  }

  function entryListDriverLabel(row, guestCars) {
    var display = driverDisplayName(row && row.driver);
    if (!display || dash(display) === '—') return '—';
    var car = row && row.number != null ? String(row.number).trim() : '';
    var isGuest = isGuestEntryRow(row) || !!(guestCars && car && guestCars[car]);
    return isGuest ? display + ' (G)' : display;
  }

  // Empty cell value → dash
  function dash(val) {
    if (val == null || val === '') return '—';
    if (typeof val === 'string' && val.trim() === '') return '—';
    return val;
  }

  // ─── i18n (English-only) ──────────────────────────────────────────────────
  var lang = 'en';
  var theme = (function () {
    try {
      var stored = localStorage.getItem('tga-theme');
      if (stored === 'light' || stored === 'dark') return stored;
    } catch (e) {}
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
    return 'dark';
  })();
  document.documentElement.setAttribute('data-theme', theme);

  var translations = (window.TGA_TRANSLATIONS || {});

  function t(key) {
    var tr = translations[lang];
    return (tr && tr[key] != null) ? tr[key] : (translations.en[key] || key);
  }

  function updateLangUI() {
    document.querySelectorAll('.lang-opt').forEach(function (opt) {
      opt.classList.toggle('active', opt.dataset.lang === lang);
    });
    var footer = document.getElementById('footer-text');
    if (footer) footer.textContent = t('footer');
    translateStaticUI();
  }
  function updateThemeUI() {
    var btn = document.getElementById('themeToggle');
    if (!btn) return;
    var opts = btn.querySelectorAll('.theme-opt');
    [].forEach.call(opts, function (opt) {
      opt.classList.toggle('active', opt.dataset.theme === theme);
    });
  }

  // Translate race stat keys (lowercase → Russian)
  var raceStatKeysRu = (window.TGA_RU && window.TGA_RU.raceStatKeysRu) || {};

  function localizeStatKey(key) {
    if (lang === 'en' || !key) return key;
    return raceStatKeysRu[key.toLowerCase().trim()] || key;
  }

  // Russian plural forms: 1 → form1, 2-4 → form2, 5+ → form5
  function pluralRu(n, form1, form2, form5) {
    var abs = Math.abs(n) % 100;
    var n1  = abs % 10;
    if (abs > 10 && abs < 20) return form5;
    if (n1 === 1) return form1;
    if (n1 >= 2 && n1 <= 4) return form2;
    return form5;
  }

  function localizeStatValue(value) {
    if (!value) return value;
    var v = trimTrailingZeros(String(value));
    if (lang === 'en') return v;

    // "7 for 36 laps" → "7 for 36 laps" (RU)
    v = v.replace(/(\d+)\s+for\s+(\d+)\s+laps?/gi, function (_, x, y) {
      return x + '\u00a0за\u00a0' + y + '\u00a0' + pluralRu(+y, 'круг', 'круга', 'кругов');
    });

    // "2 hours, 34 minutes and 21 seconds"
    v = v.replace(/(\d+)\s+hours?,\s*(\d+)\s+minutes?\s+and\s+(\d+)\s+seconds?/gi,
      function (_, h, m, s) {
        return h + '\u00a0' + pluralRu(+h, 'час', 'часа', 'часов') +
               ', ' + m + '\u00a0' + pluralRu(+m, 'минута', 'минуты', 'минут') +
               ' и ' + s + '\u00a0' + pluralRu(+s, 'секунда', 'секунды', 'секунд');
      });

    // "116.618 miles per hour (187.678 km/h)"
    v = v.replace(/([\d.,]+)\s+miles?\s+per\s+hour\s*\(([\d.,]+)\s*km\/h\)/gi,
      function (_, mph, kmh) { return mph + '\u00a0миль/ч\u00a0(' + kmh + '\u00a0км/ч)'; });

    // standalone "X miles per hour"
    v = v.replace(/([\d.,]+)\s+miles?\s+per\s+hour/gi,
      function (_, mph) { return mph + '\u00a0миль/ч'; });

    // "X.XXX miles" distance
    v = v.replace(/([\d.,]+)\s+miles?\b/gi,
      function (_, n) { return n + '\u00a0миль'; });

    // "X laps" remaining
    v = v.replace(/\b(\d+)\s+laps?/gi, function (_, n) {
      return n + '\u00a0' + pluralRu(+n, 'круг', 'круга', 'кругов');
    });

    return v;
  }

  // Keys to hide (utility rows from Excel)
  var specKeySkip = { 'series': true, 'season': true };

  // ─── F1 static history (1950–2025) for /series/f1/history ─────────────────
  var F1_DRIVER_CHAMPIONS = {
    '1950': 'Giuseppe Farina', '1951': 'Juan Manuel Fangio', '1952': 'Alberto Ascari', '1953': 'Alberto Ascari',
    '1954': 'Juan Manuel Fangio', '1955': 'Juan Manuel Fangio', '1956': 'Juan Manuel Fangio', '1957': 'Juan Manuel Fangio',
    '1958': 'Mike Hawthorn', '1959': 'Jack Brabham', '1960': 'Jack Brabham', '1961': 'Phil Hill', '1962': 'Graham Hill',
    '1963': 'Jim Clark', '1964': 'John Surtees', '1965': 'Jim Clark', '1966': 'Jack Brabham', '1967': 'Denny Hulme',
    '1968': 'Graham Hill', '1969': 'Jackie Stewart', '1970': 'Jochen Rindt', '1971': 'Jackie Stewart', '1972': 'Emerson Fittipaldi',
    '1973': 'Jackie Stewart', '1974': 'Emerson Fittipaldi', '1975': 'Niki Lauda', '1976': 'James Hunt', '1977': 'Niki Lauda',
    '1978': 'Mario Andretti', '1979': 'Jody Scheckter', '1980': 'Alan Jones', '1981': 'Nelson Piquet', '1982': 'Keke Rosberg',
    '1983': 'Nelson Piquet', '1984': 'Niki Lauda', '1985': 'Alain Prost', '1986': 'Alain Prost', '1987': 'Nelson Piquet',
    '1988': 'Ayrton Senna', '1989': 'Alain Prost', '1990': 'Ayrton Senna', '1991': 'Ayrton Senna', '1992': 'Nigel Mansell',
    '1993': 'Alain Prost', '1994': 'Michael Schumacher', '1995': 'Michael Schumacher', '1996': 'Damon Hill',
    '1997': 'Jacques Villeneuve', '1998': 'Mika Häkkinen', '1999': 'Mika Häkkinen', '2000': 'Michael Schumacher',
    '2001': 'Michael Schumacher', '2002': 'Michael Schumacher', '2003': 'Michael Schumacher', '2004': 'Michael Schumacher',
    '2005': 'Fernando Alonso', '2006': 'Fernando Alonso', '2007': 'Kimi Räikkönen', '2008': 'Lewis Hamilton',
    '2009': 'Jenson Button', '2010': 'Sebastian Vettel', '2011': 'Sebastian Vettel', '2012': 'Sebastian Vettel',
    '2013': 'Sebastian Vettel', '2014': 'Lewis Hamilton', '2015': 'Lewis Hamilton', '2016': 'Nico Rosberg',
    '2017': 'Lewis Hamilton', '2018': 'Lewis Hamilton', '2019': 'Lewis Hamilton', '2020': 'Lewis Hamilton',
    '2021': 'Max Verstappen', '2022': 'Max Verstappen', '2023': 'Max Verstappen', '2024': 'Max Verstappen', '2025': 'Lando Norris'
  };
  var F1_DRIVER_POINTS = {
    '1950': 30, '1951': 31, '1952': 36, '1953': 34, '1954': 42, '1955': 40, '1956': 30, '1957': 40, '1958': 42, '1959': 31,
    '1960': 43, '1961': 34, '1962': 42, '1963': 54, '1964': 40, '1965': 54, '1966': 42, '1967': 51, '1968': 48, '1969': 63,
    '1970': 45, '1971': 62, '1972': 61, '1973': 71, '1974': 55, '1975': 64, '1976': 69, '1977': 72, '1978': 64, '1979': 51,
    '1980': 67, '1981': 50, '1982': 44, '1983': 59, '1984': 72, '1985': 73, '1986': 72, '1987': 73, '1988': 94, '1989': 76,
    '1990': 78, '1991': 96, '1992': 108, '1993': 99, '1994': 92, '1995': 102, '1996': 97, '1997': 81, '1998': 100, '1999': 76,
    '2000': 108, '2001': 123, '2002': 144, '2003': 93, '2004': 148, '2005': 133, '2006': 134, '2007': 110, '2008': 98, '2009': 95,
    '2010': 256, '2011': 392, '2012': 281, '2013': 397, '2014': 384, '2015': 381, '2016': 385, '2017': 363, '2018': 408, '2019': 413,
    '2020': 347, '2021': 395, '2022': 454, '2023': 575, '2024': 437, '2025': 423
  };
  var F1_RACES_PER_SEASON = {
    '1950': 7, '1951': 8, '1952': 8, '1953': 9, '1954': 9, '1955': 7, '1956': 8, '1957': 8, '1958': 11, '1959': 9,
    '1960': 10, '1961': 8, '1962': 9, '1963': 10, '1964': 10, '1965': 10, '1966': 9, '1967': 11, '1968': 12, '1969': 11,
    '1970': 13, '1971': 11, '1972': 12, '1973': 15, '1974': 15, '1975': 14, '1976': 16, '1977': 17, '1978': 16, '1979': 15,
    '1980': 14, '1981': 15, '1982': 16, '1983': 15, '1984': 16, '1985': 16, '1986': 16, '1987': 16, '1988': 16, '1989': 16,
    '1990': 16, '1991': 16, '1992': 16, '1993': 16, '1994': 16, '1995': 17, '1996': 16, '1997': 17, '1998': 16, '1999': 16,
    '2000': 17, '2001': 17, '2002': 17, '2003': 16, '2004': 18, '2005': 19, '2006': 18, '2007': 17, '2008': 18, '2009': 17,
    '2010': 19, '2011': 19, '2012': 20, '2013': 19, '2014': 19, '2015': 19, '2016': 21, '2017': 20, '2018': 21, '2019': 21,
    '2020': 17, '2021': 22, '2022': 22, '2023': 22, '2024': 24, '2025': 24, '2026': 22
  };
  var F1_CONSTRUCTOR_CHAMPIONS = {
    '1958': 'Vanwall', '1959': 'Cooper', '1960': 'Cooper', '1961': 'Ferrari', '1962': 'BRM', '1963': 'Lotus', '1964': 'Ferrari',
    '1965': 'Lotus', '1966': 'Brabham', '1967': 'Brabham', '1968': 'Lotus', '1969': 'Matra', '1970': 'Lotus', '1971': 'Tyrrell',
    '1972': 'Lotus', '1973': 'Lotus', '1974': 'McLaren', '1975': 'Ferrari', '1976': 'Ferrari', '1977': 'Ferrari', '1978': 'Lotus',
    '1979': 'Ferrari', '1980': 'Williams', '1981': 'Williams', '1982': 'Ferrari', '1983': 'Ferrari', '1984': 'McLaren', '1985': 'McLaren',
    '1986': 'Williams', '1987': 'Williams', '1988': 'McLaren', '1989': 'McLaren', '1990': 'McLaren', '1991': 'McLaren', '1992': 'Williams',
    '1993': 'Williams', '1994': 'Williams', '1995': 'Benetton', '1996': 'Williams', '1997': 'Williams', '1998': 'McLaren', '1999': 'Ferrari',
    '2000': 'Ferrari', '2001': 'Ferrari', '2002': 'Ferrari', '2003': 'Ferrari', '2004': 'Ferrari', '2005': 'Renault', '2006': 'Renault',
    '2007': 'Ferrari', '2008': 'Ferrari', '2009': 'Brawn GP', '2010': 'Red Bull', '2011': 'Red Bull', '2012': 'Red Bull', '2013': 'Red Bull',
    '2014': 'Mercedes', '2015': 'Mercedes', '2016': 'Mercedes', '2017': 'Mercedes', '2018': 'Mercedes', '2019': 'Mercedes', '2020': 'Mercedes',
    '2021': 'Mercedes', '2022': 'Red Bull', '2023': 'Red Bull', '2024': 'McLaren', '2025': 'McLaren'
  };
  var F1_CONSTRUCTOR_POINTS = {
    '1958': 48, '1959': 40, '1960': 48, '1961': 45, '1962': 42, '1963': 54, '1964': 45, '1965': 54, '1966': 42, '1967': 63,
    '1968': 62, '1969': 66, '1970': 59, '1971': 73, '1972': 61, '1973': 92, '1974': 73, '1975': 72, '1976': 83, '1977': 95,
    '1978': 86, '1979': 113, '1980': 120, '1981': 95, '1982': 74, '1983': 89, '1984': 143, '1985': 90, '1986': 141, '1987': 137,
    '1988': 199, '1989': 141, '1990': 121, '1991': 139, '1992': 164, '1993': 168, '1994': 118, '1995': 137, '1996': 175, '1997': 123,
    '1998': 156, '1999': 128, '2000': 170, '2001': 179, '2002': 221, '2003': 158, '2004': 262, '2005': 191, '2006': 206, '2007': 204,
    '2008': 172, '2009': 172, '2010': 498, '2011': 650, '2012': 460, '2013': 596, '2014': 701, '2015': 703, '2016': 765, '2017': 668,
    '2018': 655, '2019': 739, '2020': 573, '2021': 613, '2022': 759, '2023': 860, '2024': 666, '2025': 833
  };
  var F1_CHASSIS_ENGINE = {
    '1950': { team: 'Alfa Romeo', chassis: 'Alfa Romeo 158', engine: 'Alfa Romeo 158 1.5 L8 s' },
    '1951': { team: 'Alfa Romeo', chassis: 'Alfa Romeo 159', engine: 'Alfa Romeo 158 1.5 L8 s' },
    '1952': { team: 'Ferrari', chassis: '500', engine: 'Ferrari 500 2.0 L4' },
    '1953': { team: 'Ferrari', chassis: '500', engine: 'Ferrari 500 2.0 L4' },
    '1954': { team: 'Mercedes', chassis: 'W196', engine: 'Mercedes M196 2.5 L8' },
    '1955': { team: 'Mercedes', chassis: 'W196', engine: 'Mercedes M196 2.5 L8' },
    '1956': { team: 'Ferrari', chassis: 'D50', engine: 'Ferrari DS50 2.5 V8' },
    '1957': { team: 'Maserati', chassis: '250F', engine: 'Maserati 250F1 2.5 L6' },
    '1958': { team: 'Ferrari', chassis: '246', engine: 'Ferrari 143 2.4 V6' },
    '1959': { team: 'Cooper', chassis: 'T51', engine: 'Climax FPF 2.5 L4' },
    '1960': { team: 'Cooper', chassis: 'T53', engine: 'Climax FPF 2.5 L4' },
    '1961': { team: 'Ferrari', chassis: '156', engine: 'Ferrari 178 1.5 V6' },
    '1962': { team: 'BRM', chassis: 'P57', engine: 'BRM P56 1.5 V8' },
    '1963': { team: 'Lotus', chassis: '25', engine: 'Climax FWMV 1.5 V8' },
    '1964': { team: 'Ferrari', chassis: '158', engine: 'Ferrari 205B 1.5 V8' },
    '1965': { team: 'Lotus', chassis: '33', engine: 'Climax FWMV 1.5 V8' },
    '1966': { team: 'Brabham', chassis: 'BT20', engine: 'Repco 620 3.0 V8' },
    '1967': { team: 'Brabham', chassis: 'BT24', engine: 'Repco 740 3.0 V8' },
    '1968': { team: 'Lotus', chassis: '49B', engine: 'Ford Cosworth DFV 3.0 V8' },
    '1969': { team: 'Matra', chassis: 'MS80', engine: 'Ford Cosworth DFV 3.0 V8' },
    '1970': { team: 'Lotus', chassis: '72C', engine: 'Ford Cosworth DFV 3.0 V8' },
    '1971': { team: 'Tyrrell', chassis: '003', engine: 'Ford Cosworth DFV 3.0 V8' },
    '1972': { team: 'Lotus', chassis: '72D', engine: 'Ford Cosworth DFV 3.0 V8' },
    '1973': { team: 'Tyrrell', chassis: '006', engine: 'Ford Cosworth DFV 3.0 V8' },
    '1974': { team: 'McLaren', chassis: 'M23B', engine: 'Ford Cosworth DFV 3.0 V8' },
    '1975': { team: 'Ferrari', chassis: '312T', engine: 'Ferrari 015 3.0 F12' },
    '1976': { team: 'McLaren', chassis: 'M23D', engine: 'Ford Cosworth DFV 3.0 V8' },
    '1977': { team: 'Ferrari', chassis: '312T2B', engine: 'Ferrari 015 3.0 F12' },
    '1978': { team: 'Lotus', chassis: '79', engine: 'Ford Cosworth DFV 3.0 V8' },
    '1979': { team: 'Ferrari', chassis: '312T4B', engine: 'Ferrari 015 3.0 F12' },
    '1980': { team: 'Williams', chassis: 'FW07B', engine: 'Ford Cosworth DFV 3.0 V8' },
    '1981': { team: 'Brabham', chassis: 'BT49C', engine: 'Ford Cosworth DFV 3.0 V8' },
    '1982': { team: 'Williams', chassis: 'FW08', engine: 'Ford Cosworth DFV 3.0 V8' },
    '1983': { team: 'Brabham', chassis: 'BT52B', engine: 'BMW M12/13 1.5 L4 t' },
    '1984': { team: 'McLaren', chassis: 'MP4/2', engine: 'TAG-Porsche TTE PO1 1.5 V6 t' },
    '1985': { team: 'McLaren', chassis: 'MP4/2B', engine: 'TAG-Porsche TTE PO1 1.5 V6 t' },
    '1986': { team: 'McLaren', chassis: 'MP4/2C', engine: 'TAG-Porsche TTE PO1 1.5 V6 t' },
    '1987': { team: 'Williams', chassis: 'FW11B', engine: 'Honda RA167E 1.5 V6 t' },
    '1988': { team: 'McLaren', chassis: 'MP4/4', engine: 'Honda RA168E 1.5 V6 t' },
    '1989': { team: 'McLaren', chassis: 'MP4/5', engine: 'Honda RA109E V10' },
    '1990': { team: 'McLaren', chassis: 'MP4/5B', engine: 'Honda RA100E 3.5 V10' },
    '1991': { team: 'McLaren', chassis: 'MP4/6', engine: 'Honda RA121E 3.5 V12' },
    '1992': { team: 'Williams', chassis: 'FW14B', engine: 'Renault RS4 3.5 V10' },
    '1993': { team: 'Williams', chassis: 'FW15C', engine: 'Renault RS5 3.5 V10' },
    '1994': { team: 'Benetton', chassis: 'B194', engine: 'Ford EC Zetec-R 3.5 V8' },
    '1995': { team: 'Benetton', chassis: 'B195', engine: 'Renault RS7 3.0 V10' },
    '1996': { team: 'Williams', chassis: 'FW18', engine: 'Renault RS8 3.0 V10' },
    '1997': { team: 'Williams', chassis: 'FW19', engine: 'Renault RS9B 3.0 V10' },
    '1998': { team: 'McLaren', chassis: 'MP4/13', engine: 'Mercedes FO110G' },
    '1999': { team: 'McLaren', chassis: 'MP4/14', engine: 'Mercedes FO110H' },
    '2000': { team: 'Ferrari', chassis: 'F1-2000', engine: 'Ferrari Tipo 049' },
    '2001': { team: 'Ferrari', chassis: 'F2001', engine: 'Ferrari Tipo 050' },
    '2002': { team: 'Ferrari', chassis: 'F2002', engine: 'Ferrari Tipo 051' },
    '2003': { team: 'Ferrari', chassis: 'F2003-GA', engine: 'Ferrari Tipo 052' },
    '2004': { team: 'Ferrari', chassis: 'F2004', engine: 'Ferrari Tipo 053' },
    '2005': { team: 'Renault', chassis: 'R25', engine: 'Renault RS25' },
    '2006': { team: 'Renault', chassis: 'R26', engine: 'Renault RS26 2.4 V8' },
    '2007': { team: 'Ferrari', chassis: 'F2007', engine: 'Ferrari 056' },
    '2008': { team: 'McLaren', chassis: 'MP4-23', engine: 'Mercedes FO108V' },
    '2009': { team: 'Brawn GP', chassis: 'BGP 001', engine: 'Mercedes FO 108W' },
    '2010': { team: 'Red Bull', chassis: 'RB6', engine: 'Renault RS27-2010' },
    '2011': { team: 'Red Bull', chassis: 'RB7', engine: 'Renault RS27-2011' },
    '2012': { team: 'Red Bull', chassis: 'RB8', engine: 'Renault RS27-2012' },
    '2013': { team: 'Red Bull', chassis: 'RB9', engine: 'Renault RS27-2013' },
    '2014': { team: 'Mercedes', chassis: 'F1 W05 Hybrid', engine: 'Mercedes PU106A Hybrid' },
    '2015': { team: 'Mercedes', chassis: 'F1 W06 Hybrid', engine: 'Mercedes PU106B Hybrid' },
    '2016': { team: 'Mercedes', chassis: 'F1 W07 Hybrid', engine: 'Mercedes PU106C Hybrid' },
    '2017': { team: 'Mercedes', chassis: 'F1 W08 EQ Power+', engine: 'Mercedes M08 EQ Power+' },
    '2018': { team: 'Mercedes', chassis: 'F1 W09 EQ Power+', engine: 'Mercedes M09 EQ Power+' },
    '2019': { team: 'Mercedes', chassis: 'F1 W10 EQ Power+', engine: 'Mercedes M10 EQ Power+' },
    '2020': { team: 'Mercedes', chassis: 'F1 W11', engine: 'Mercedes-AMG F1 M11' },
    '2021': { team: 'Red Bull', chassis: 'RB16B', engine: 'Honda RA621H' },
    '2022': { team: 'Red Bull', chassis: 'RB18', engine: 'Red Bull RBPTH001' },
    '2023': { team: 'Red Bull', chassis: 'RB19', engine: 'Honda RBPTH001' },
    '2024': { team: 'Red Bull', chassis: 'RB20', engine: 'Honda RBPTH002' },
    '2025': { team: 'McLaren', chassis: 'MCL39', engine: 'Mercedes-AMG F1 M16' }
  };

  // "Generation / Chassis" → "Chassis" (drop "Generation")
  function normalizeSpecKey(key) {
    if (!key) return key;
    return key.replace(/^generation\s*\/\s*chassis\b/i, 'Chassis')
              .replace(/^generation\s*\/\s*шасси\b/i,   'Шасси');
  }

  // Translate tech spec keys (lowercase → Russian)
  var specKeyRu = (window.TGA_RU && window.TGA_RU.specKeyRu) || {};

  function localizeSpecKey(key) {
    if (!key) return key;
    var norm = normalizeSpecKey(key);
    if (lang === 'en') return norm;
    return specKeyRu[norm.toLowerCase().trim()] || norm;
  }

  // Translate tech spec values (pattern replacements)
  function localizeSpecValue(val) {
    if (lang === 'en' || !val) return val;
    var v = String(val);

    // ── Units: compound first, then single ─────────────────────────
    v = v.replace(/\bcu\s+ft\/min\b/gi,           'куб.\u00a0футов/мин');
    v = v.replace(/\bft[\-]lb\b/gi,               'фунт-фут');
    v = v.replace(/\bN[\u00b7·]m\b/g,             'Н\u00b7м');
    v = v.replace(/\b(~?\d[\d.,\-]*)\s*Nm\b/g,    function (_, n) { return n + '\u00a0Н\u00b7м'; });
    v = v.replace(/\b(~?\d[\d.,\-]*)\s*kW\b/g,    function (_, n) { return n + '\u00a0кВт'; });
    v = v.replace(/\b(~?\d[\d.,\-]*)\s*hp\b/gi,   function (_, n) { return n + '\u00a0л.с.'; });
    v = v.replace(/\bUS\s+gal\b/gi,               'американских галлонов');
    v = v.replace(/\b(~?\d[\d.,\-]*)\s*gal\b/gi,  function (_, n) { return n + '\u00a0галл.'; });
    v = v.replace(/\bcu\s*in\b/gi,                'куб.\u00a0дюймов');
    v = v.replace(/\b(~?\d[\d.,\-]*)\s*mm\b/gi,   function (_, n) { return n + '\u00a0мм'; });
    v = v.replace(/\b(~?\d[\d.,\-]*)\s*in\b/gi,   function (_, n) { return n + '\u00a0дюймов'; });
    v = v.replace(/\b(~?\d[\d.,\-]*)\s*lbs?\b/gi, function (_, n) { return n + '\u00a0фунтов'; });
    v = v.replace(/\b(~?\d[\d.,\-]*)\s*kg\b/gi,   function (_, n) { return n + '\u00a0кг'; });
    v = v.replace(/\b(~?\d[\d.,\-]*)\s*L\b/g,     function (_, n) { return n + '\u00a0л'; });

    // ── Engine ─────────────────────────────────────────────────────────────
    v = v.replace(/\bnaturally\s+aspirated\b/gi,  'атмосферный');
    v = v.replace(/\bturbocharged\b/gi,           'турбированный');
    v = v.replace(/\bsupercharged\b/gi,           'компрессорный');
    v = v.replace(/\bpushrod\s+V8\b/gi,           'V8 с толкателями');
    v = v.replace(/\bpushrod\b/gi,                'с толкателями');
    v = v.replace(/\bcarbureted\b/gi,             'карбюраторный');
    v = v.replace(/\bcarburetor\b/gi,             'карбюратор');
    v = v.replace(/\bthrottle\s+body\b/gi,        'дроссельная заслонка');
    v = v.replace(/\bno\s+EFI\b/gi,              'без системы впрыска');
    v = v.replace(/\bEFI\s+not\s+permitted\b/gi, 'EFI не разрешён');
    v = v.replace(/\bwith\s+driver\b/gi,          'с водителем');
    v = v.replace(/\bunrestricted\b/gi,           'без ограничений');
    v = v.replace(/\brestricted\b/gi,             'с ограничением мощности');
    v = v.replace(/\brestricted\s+packages?\b/gi, 'пакеты с ограничением мощности');
    v = v.replace(/\b85%\s+unleaded\s+blend\s*\+\s*15%\s+ethanol\b/gi,
                  '85% неэтилированная смесь + 15% этанол');
    v = v.replace(/\bapprox\.?\b/gi,             '≈');

    // ── Drivetrain ────────────────────────────────────────────────────────────────
    v = v.replace(/\brear[\-\s]wheel\s+drive\b/gi,        'задний');
    v = v.replace(/\bstandard\s+NASCAR\s+layout\b/gi,     'стандартная компоновка NASCAR');
    v = v.replace(/\bfront[\-\s]wheel\s+drive\b/gi,       'передний');
    v = v.replace(/\ball[\-\s]wheel\s+drive\b/gi,         'полный');
    v = v.replace(/\bfour[\-\s]wheel\s+drive\b/gi,        'полный');

    // ── Transmission ───────────────────────────────────────────────────────────
    v = v.replace(/\bsequential\s+manual\b/gi,             'секвентальная механическая');
    v = v.replace(/\bno\s+sequential\s+gearbox\b/gi,      'отсутствие секвентальной КПП');
    v = v.replace(/\bsequential\b/gi,                     'секвентальная');
    v = v.replace(/\bH[\-]pattern\s+manual\s+gearbox\b/gi,'механическая КПП с H-образной схемой');
    v = v.replace(/\bH[\-]pattern\b/gi,                   'H-образная схема');
    v = v.replace(/\bmanual\s+gearbox\b/gi,               'механическая коробка передач');
    v = v.replace(/\bmanual\b/gi,                         'механическая');
    v = v.replace(/\bautomatic\b/gi,                      'автоматическая');
    v = v.replace(/\b(\d+)[\-\s]speed\b/gi,              '$1-ступенчатая');
    v = v.replace(/\bgearbox\b/gi,                        'коробка передач');
    v = v.replace(/\bseries\s+spec\b/gi,                  'спецификации серии');
    v = v.replace(/\bseries[\-\u2011]specific\b/gi,       'специализированная для серии');

    // ── Suspension ──────────────────────────────────────────────────────────────
    v = v.replace(/\bindependent\s+double\s+wishbone\b/gi,  'независимая на двойных поперечных рычагах');
    v = v.replace(/\bdouble\s+wishbone\b/gi,                'двойные поперечные рычаги');
    v = v.replace(/\bshort[\-]long\s+arm\b/gi,             'рычажная подвеска неравной длины');
    v = v.replace(/\bsolid\s+rear\s+axle\b/gi,             'неразрезной мост');
    v = v.replace(/\blive\s+axle\b/gi,                     'неразрезной мост');
    v = v.replace(/\bindependent\s+front\s+and\s+rear\b/gi,'независимая передняя и задняя');
    v = v.replace(/\bindependent\b/gi,                     'независимая');
    v = v.replace(/\bcoil\/short\b/gi,                     'пружинная / производная от');
    v = v.replace(/\bseries[\-]approved\s+suspension\b/gi, 'одобренная серией подвеска');
    v = v.replace(/\bopen[,]?\s+modified[\-]specific\s+geometry\b/gi,
                  'специальная геометрия для модифицированных автомобилей');
    v = v.replace(/\bopen,\s+modified-specific\b/gi,       'открытая, специализированная');

    // ── Brakes ───────────────────────────────────────────────────────────────
    v = v.replace(/\bsteel\s+disc\s+brakes?\b/gi,          'стальные дисковые тормоза');
    v = v.replace(/\bdisc\s+brakes?\b/gi,                  'дисковые тормоза');
    v = v.replace(/\bmultiple[\-]piston\s+calipers?\b/gi,  'многопоршневые суппорты');
    v = v.replace(/\b(\d+)[\-]piston\s+calipers?\b/gi,    function (_, n) { return n + '-поршневые суппорты'; });
    v = v.replace(/\bcalipers?\b/gi,                       'суппорты');

    // ── Body and chassis ─────────────────────────────────────────────────────────
    v = v.replace(/\bcomposite\/approved\s+truck\s+body\s+panels\b/gi,
                  'композитные/одобренные кузовные панели грузовика');
    v = v.replace(/\bstyled\s+to\s+production\s+pickup\b/gi,
                  'стилизованные под серийный пикап');
    v = v.replace(/\bstyled\s+to\s+manufacturer\s+brand\b/gi,
                  'стилизованные под бренд производителя');
    v = v.replace(/\bcomposite\s*\/\s*steel\s+arca[\-‑]approved\s+stock\s+car\s+body\b/gi,
                  'композитные / стальные одобренные ARCA кузовные панели сток-кара');
    v = v.replace(/\bcomposite\s+body\b/gi,                'композитный кузов');
    v = v.replace(/\bcomposite\b/gi,                       'композитные');
    v = v.replace(/\bsymmetrical\s+body\b/gi,              'симметричный кузов');
    v = v.replace(/\basymmetrical\b/gi,                    'асимметричный');
    v = v.replace(/\bsymmetrical\b/gi,                     'симметричный');
    v = v.replace(/\boffset\b/gi,                          'со смещением');
    v = v.replace(/\bsteel\s+tube\s+frame\b/gi,            'стальная трубчатая рама');
    v = v.replace(/\bsteel\s+tubular\s+chassis\b/gi,       'стальная трубчатая рама');
    v = v.replace(/\btubular\s+steel\s+frame\b/gi,         'стальная трубчатая рама');
    v = v.replace(/\bstandardized\s+tubular\s+steel\s+frame\b/gi,
                  'унифицированная стальная трубчатая рама');
    v = v.replace(/\bfabricator[\-']built\s+tubular\s+steel\s+chassis\b/gi,
                  'стальное трубчатое шасси, построенное производителем');
    v = v.replace(/\bsafety\s+roll\s+cage\b/gi,            'каркас безопасности');
    v = v.replace(/\broll\s+cage\b/gi,                     'каркас безопасности');
    v = v.replace(/\bintegrated\s+safety\s+roll\s+cage\b/gi, 'интегрированный каркас безопасности');
    v = v.replace(/\barca[\-‑]spec\s+chassis\b/gi,         'шасси спецификации ARCA');
    v = v.replace(/\bseries[\-]specific\s+truck\s+chassis\b/gi,
                  'специализированное шасси для грузовиков');
    v = v.replace(/\bopen[\-]wheel\b/gi,                   'открытые колёса');
    v = v.replace(/\bhand[\-]crafted\b/gi,                 'ручной работы');
    v = v.replace(/\bsheet\s+metal\b/gi,                   'листовой металл');
    v = v.replace(/\bonly\s+decal\s+branding\b/gi,         'только наклейки с брендами');
    v = v.replace(/\bno\s+manufacturer\s+chassis\/body\b/gi,
                  'нет шасси/кузова от автопроизводителя');
    v = v.replace(/\bsteel\b/gi,                           'стальные');

    // ── Wheels / Tires ─────────────────────────────────────────────────────────
    v = v.replace(/\bforged\s+aluminum\b/gi,               'кованые алюминиевые');
    v = v.replace(/\bsingle[\-\s]center[\-\s]lock[\-\s]nut\b/gi, 'крепление одной центральной гайкой');
    v = v.replace(/\bsingle[\-]lug\s+wheels?\b/gi,         'диски с одной гайкой');
    v = v.replace(/\bbias[\-]ply\b/gi,                     'диагональные');
    v = v.replace(/\bslicks?;?\s+rain\s+tires?\s+if\s+applicable\b/gi,
                  'слики; дождевые шины при необходимости');
    v = v.replace(/\bslick\b/gi,                           'слик');
    v = v.replace(/\bracing\s+tires?\b/gi,                 'гоночные шины');
    v = v.replace(/\b(\d+)[\-]lug\b/gi,                   function (_, n) { return n + '-шпилечные'; });
    v = v.replace(/\b(\d+)\s+lug\b/gi,                    function (_, n) { return n + '\u00a0шпилек'; });
    v = v.replace(/\bsteel\s+or\s+aluminum\b/gi,           'стальные или алюминиевые');
    v = v.replace(/\bseries[\-]approved\s+racing\s+wheels?\b/gi,
                  'одобренные серией гоночные диски');
    v = v.replace(/\bmodified[\-]spec\b/gi,                'спецификации Modified');

    // ── Aerodynamics / Underbody ──────────────────────────────────────────────────
    v = v.replace(/\bfront\s+splitter\s*[,+]\s*rear\s+diffuser\b/gi,
                  'передний сплиттер + задний диффузор');
    v = v.replace(/\bfront\s+splitter\s*[,+]\s*rear\s+spoiler\b/gi,
                  'передний сплиттер, заднее антикрыло');
    v = v.replace(/\bapproved\s+front\s+air\s+dam\b/gi,   'одобренный передний воздушный дефлектор');
    v = v.replace(/\btruck\s+body\s+aero\s+package\b/gi,  'аэродинамический пакет кузова грузовика');
    v = v.replace(/\bseries\s+rules\b/gi,                 'правила серии');
    v = v.replace(/\bfront\s+splitter\b/gi,               'передний сплиттер');
    v = v.replace(/\brear\s+diffuser\b/gi,                'задний диффузор');
    v = v.replace(/\brear\s+spoiler\b/gi,                 'заднее антикрыло');
    v = v.replace(/\bno\s+splitter[,]?\s+no\s+diffuser\b/gi, 'нет сплиттера, нет диффузора');
    v = v.replace(/\bno\s+diffuser\b/gi,                  'без диффузора');
    v = v.replace(/\bflat\s+(bottom|floor)\b/gi,          'плоское дно');
    v = v.replace(/\bflat\s+floor\b/gi,                   'плоский пол');
    v = v.replace(/\bnasca?r[\-]mandated\b/gi,            'предписанные NASCAR');
    v = v.replace(/\bno\s+ground[\-]effect\s+devices\b/gi,'без устройств для создания эффекта земли');
    v = v.replace(/\bminimal\s+body\s+aero\b/gi,          'минимальный аэродинамический обвес кузова');

    // ── Safety ──────────────────────────────────────────────────────────
    v = v.replace(/\bHANS\s+device\b/gi,                  'устройство HANS');
    v = v.replace(/\b(\d+)[\-]point\s+harness\b/gi,       function (_, n) { return n + '-точечные ремни'; });
    v = v.replace(/\bonboard\s+fire\s+suppression\b/gi,   'бортовая система пожаротушения');
    v = v.replace(/\bstandard\s+NASCAR\b/gi,              'стандарт NASCAR');
    v = v.replace(/\bfire\s+suppression\b/gi,             'система пожаротушения');

    // ── Key features ──────────────────────────────────────────────────
    v = v.replace(/\bcarburetor\s+or\s+series\s+spec\s+injection\s+engine\b/gi,
                  'карбюраторный или с впрыском спецификации серии двигатель');
    v = v.replace(/\bcarburetor\s+engine\b/gi,            'карбюраторный двигатель');
    v = v.replace(/\blive\s+rear\s+axle\b/gi,             'жёсткий задний мост');
    v = v.replace(/\bno\s+sequential\b/gi,                'без секвентальной');
    v = v.replace(/\bindependent\s+rear\s+suspension\b/gi,'независимая задняя подвеска');
    v = v.replace(/\brace\s+pickup\s+body\b/gi,           'кузов гоночного пикапа');
    v = v.replace(/\bstock\s+car\s+aero\b/gi,             'аэродинамика сток-кара');
    v = v.replace(/\blow[\-\s]downforce\b/gi,             'с низкой прижимной силой');

    return v;
  }

  // Translate table column headers from data (lowercase → Russian)
  var tableHeaderRu = (window.TGA_RU && window.TGA_RU.tableHeaderRu) || {};

  var carNumHeaders = { '#': true, 'no': true, 'no.': true, 'num': true, 'number': true };

  function localizeTableHeader(h) {
    if (!h) return h;
    var key = h.toLowerCase().trim();
    // Car number columns always shown as "#"
    if (carNumHeaders[key]) return '#';
    if (lang === 'en') return h;
    return tableHeaderRu[key] || h;
  }

  // Translate cell values in Notes / Status / Disqualification columns
  var cellNotesRu = (window.TGA_RU && window.TGA_RU.cellNotesRu) || {};

  function localizeCellNote(value) {
    if (lang === 'en' || !value) return value;
    return cellNotesRu[value.toLowerCase().trim()] || value;
  }

  // Translate values in Reason / Free Pass column, etc.
  var raceReasonParts = (window.TGA_RU && window.TGA_RU.raceReasonParts) || [];

  function localizeRaceReason(value) {
    if (lang === 'en' || !value) return value;
    var exact = cellNotesRu[value.toLowerCase().trim()];
    if (exact) return exact;
    var v = value;
    for (var pi = 0; pi < raceReasonParts.length; pi++) {
      v = v.replace(raceReasonParts[pi][0], raceReasonParts[pi][1]);
    }
    return v;
  }

  // Column names whose cell values we translate
  var translateValueHeaders  = ['notes', 'note', 'status', 'disqualification', 'дисквалификация'];
  var translateReasonHeaders = ['reason', 'причина'];

  function localizeDate(str) {
    if (!str) return str;
    var s = String(str).trim();
    if (!s) return s;

    // ISO date YYYY-MM-DD or YYYY-MM-DDTHH:MM → "13 April 2025" / "13 April 2025" (RU)
    var iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/);
    if (iso) {
      var year = parseInt(iso[1], 10);
      var monthIdx = parseInt(iso[2], 10) - 1;
      var day = parseInt(iso[3], 10);
      var monthsEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      var monthsRu = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
      if (monthIdx >= 0 && monthIdx < 12) {
        if (lang === 'ru') {
          return day + ' ' + monthsRu[monthIdx] + ' ' + year;
        }
        return day + ' ' + monthsEn[monthIdx] + ' ' + year;
      }
    }

    // For already human-readable dates keep current behavior for ru; for en leave as-is.
    if (lang === 'en') return s;
    try {
      var d = new Date(s);
      if (isNaN(d.getTime())) return s;
      return d.toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) { return s; }
  }

  // Strip trailing zeros: "2.500" → "2.5", "300.000" → "300", "4.0" → "4"
  function trimTrailingZeros(str) {
    if (!str) return str;
    return String(str)
      .replace(/\b(\d+)\.(\d*[1-9])0+\b/g, '$1.$2')
      .replace(/\b(\d+)\.0+\b/g, '$1');
  }

  function degRu(n) {
    var v = parseInt(n, 10), t = v % 100, d = v % 10;
    if (t >= 11 && t <= 14) return v + '\u00a0градусов';
    if (d === 1) return v + '\u00a0градус';
    if (d >= 2 && d <= 4) return v + '\u00a0градуса';
    return v + '\u00a0градусов';
  }

  function localizeEventPreview(text) {
    if (!text || lang !== 'ru') return text;
    var s = text;

    var numTurns = {
      'one': 'одним', 'two': 'двумя', 'three': 'тремя', 'four': 'четырьмя',
      'five': 'пятью', 'six': 'шестью', 'seven': 'семью', 'eight': 'восемью'
    };
    var numCount = {
      'one': 'один', 'two': 'два', 'three': 'три', 'four': 'четыре',
      'five': 'пять', 'six': 'шесть', 'seven': 'семь', 'eight': 'восемь'
    };
    var typeRuMap = {
      'superspeedway': 'суперспидвей', 'speedway': 'спидвей',
      'oval': 'овал', 'track': 'трасса', 'oval track': 'овальный трек',
      'short track': 'короткий трек', 'road course': 'шоссейная трасса',
      'street course': 'уличная трасса'
    };

    function dotToCommaRu(v) { return String(v).replace('.', ','); }

    // ── Sentence-level patterns ──────────────────────────────────────────────

    // "The standard track at X is a N-turn TYPE that is D miles (K km) long."
    s = s.replace(
      /The standard track at (.+?) is a (one|two|three|four|five|six|seven|eight|\d+)-turn (\w+(?:\s+\w+)?) that is ([\d.]+) miles \(([\d.]+) km\) long\./gi,
      function(m, venue, n, type, dist, km) {
        var nRu = numTurns[n.toLowerCase()] || n;
        var typeRu = typeRuMap[type.toLowerCase()] || type;
        return 'Стандартная трасса в\u00a0' + venue + ' представляет собой ' + typeRu +
          ' с\u00a0' + nRu + ' поворотами протяжённостью\u00a0' +
          dotToCommaRu(dist) + '\u00a0мили (' + dotToCommaRu(km) + '\u00a0км).';
      }
    );

    // "The track's turns are banked at N degrees, while the front stretch, the location of the finish line, is banked at M degrees."
    s = s.replace(
      /The track's turns are banked at (\d+) degrees, while the front stretch, the location of the finish line, is banked at (\d+) degrees\./gi,
      function(m, n1, n2) {
        return 'Повороты трассы имеют уклон в\u00a0' + degRu(n1) +
          ', в\u00a0то время как передняя прямая, на\u00a0которой расположена финишная черта, имеет уклон в\u00a0' + degRu(n2) + '.';
      }
    );

    // "X Speedway is a high-banked[,] half-mile oval [race]track located near Y[, Z]."
    s = s.replace(
      /(.+?)\s+is a high-banked,?\s+half-mile oval (?:race)?track located near (.+?)\./gi,
      '$1\u00a0— это овальный трек с\u00a0высокими виражами длиной в\u00a0полмили, расположенный недалеко от\u00a0$2.'
    );

    // "Its asphalt surface is D miles (K km) long with N turns banked at M degrees, making it one of the fastest short tracks in the United States."
    s = s.replace(
      /Its asphalt surface is ([\d.]+) miles \(([\d.]+) km\) long with (one|two|three|four|five|six|seven|eight|\d+) turns banked at (\d+) degrees, making it one of the faster(?:st)? short tracks in the United States\./gi,
      function(m, dist, km, n, deg) {
        var nRu = numCount[n.toLowerCase()] || n;
        return 'Его асфальтовое покрытие длиной\u00a0' + dotToCommaRu(dist) + '\u00a0мили (' +
          dotToCommaRu(km) + '\u00a0км) имеет\u00a0' + nRu + '\u00a0поворота с\u00a0уклоном\u00a0' + degRu(deg) +
          ', что делает его одним из\u00a0самых быстрых коротких треков в\u00a0Соединённых Штатах.';
      }
    );

    // "The D-mile (K km) asphalt surface features N turns with M-degree banking, making it one of the faster[st] short tracks in the United States."
    s = s.replace(
      /The ([\d.]+)-mile \(([\d.]+) km\) asphalt surface features (one|two|three|four|five|six|seven|eight|\d+) turns with (\d+)-degree banking, making it one of the faster(?:st)? short tracks in the United States\./gi,
      function(m, dist, km, n, deg) {
        var nRu = numCount[n.toLowerCase()] || n;
        return 'Его асфальтовое покрытие длиной\u00a0' + dotToCommaRu(dist) + '\u00a0мили (' +
          dotToCommaRu(km) + '\u00a0км) имеет\u00a0' + nRu + '\u00a0поворота с\u00a0уклоном\u00a0' + degRu(deg) +
          ', что делает его одним из\u00a0самых быстрых коротких треков в\u00a0Соединённых Штатах.';
      }
    );

    // "The straightaways are relatively flat compared to the turns/corners, while the [turns'/steep] banking ... promotes close, [side-by-side/competitive] racing."
    s = s.replace(
      /The straightaways are relatively flat compared to the (?:turns|corners), while the turns' steep banking helps maintain speed through(?:out)? each lap and promotes close, competitive racing\./gi,
      'Прямые участки относительно плоские по\u00a0сравнению с\u00a0виражами, в\u00a0то время как крутые уклоны поворотов помогают поддерживать скорость на\u00a0каждом круге и\u00a0способствуют плотной, бескомпромиссной борьбе.'
    );
    s = s.replace(
      /The straightaways are relatively flat compared to the (?:turns|corners), while the steep banking in the turns helps maintain speed through(?:out)? each lap and promotes close, side-by-side racing\./gi,
      'Прямые участки относительно плоские по\u00a0сравнению с\u00a0виражами, в\u00a0то время как крутые уклоны поворотов помогают поддерживать скорость на\u00a0каждом круге и\u00a0способствуют плотной, бескомпромиссной борьбе.'
    );

    // ── General phrase fallbacks ─────────────────────────────────────────────
    s = s.replace(/\bsuperspeedway\b/gi, 'суперспидвей');
    s = s.replace(/\boval track\b/gi, 'овальный трек');
    s = s.replace(/\bshort track\b/gi, 'короткий трек');
    s = s.replace(/\broad course\b/gi, 'шоссейная трасса');
    s = s.replace(/\bstreet course\b/gi, 'уличная трасса');
    s = s.replace(/\bspeedway\b/gi, 'спидвей');
    s = s.replace(/\bhigh-banked\b/gi, 'с\u00a0высокими виражами');
    s = s.replace(/\bhalf-mile\b/gi, 'полумильный');
    s = s.replace(/\bthe finish line\b/gi, 'финишная черта');
    s = s.replace(/\bthe front stretch\b/gi, 'передняя прямая');
    s = s.replace(/\bthe back stretch\b/gi, 'задняя прямая');
    s = s.replace(/\bbanked at (\d+) degrees\b/gi, function(m, n) { return 'с\u00a0уклоном\u00a0' + degRu(n); });
    s = s.replace(/\bis banked at (\d+) degrees\b/gi, function(m, n) { return 'имеет уклон в\u00a0' + degRu(n); });
    s = s.replace(/\b(\d+(?:[\.,]\d+)?) miles \(([\d.,]+) km\)/gi, function(m, mi, km) {
      return dotToCommaRu(mi) + '\u00a0мили\u00a0(' + dotToCommaRu(km) + '\u00a0км)';
    });
    s = s.replace(/\bdegrees\b/gi, 'градусов');
    s = s.replace(/\bbanking\b/gi, 'уклон');
    s = s.replace(/\bstraightaway(s)?\b/gi, function(m, pl) { return pl ? 'прямые участки' : 'прямой участок'; });
    s = s.replace(/\bturns?\b/gi, function(m) { return m === 'turn' ? 'поворот' : 'повороты'; });
    s = s.replace(/\b, while\b/gi, ', в\u00a0то время как');
    s = s.replace(/\bwhile\b/gi, 'в\u00a0то время как');
    s = s.replace(/in the United States\b/gi, 'в\u00a0Соединённых Штатах');
    s = s.replace(/located near\b/gi, 'расположенный недалеко от');
    s = s.replace(/located in\b/gi, 'расположенный в');
    s = s.replace(/\basphalt\b/gi, 'асфальтовое');
    s = s.replace(/\bconcrete\b/gi, 'бетонное');
    s = s.replace(/\bflat\b/gi, 'плоский');
    s = s.replace(/\bsteep\b/gi, 'крутой');

    return s;
  }

  function localizeDistance(str) {
    if (!str) return str;
    var s = trimTrailingZeros(str);
    if (lang === 'en') return s;
    return s
      .replace(/\b([\d,.]+)\s*miles?\b/gi,  function (_, n) { return n + '\u00a0миль'; })
      .replace(/\bpaved\s+track\b/gi,        'асфальтированная трасса')
      .replace(/\bsuperspeedway\b/gi,        'суперспидвей')
      .replace(/\bshort\s+track\b/gi,        'короткая трасса')
      .replace(/\broad\s+course\b/gi,        'шоссейная трасса')
      .replace(/\bstreet\s+course\b/gi,      'уличная трасса')
      .replace(/\boval\b/gi,                 'овал')
      .replace(/\bkm\b/gi,                   'км');
  }

  function translateStaticUI() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      var val = t(key);
      if (val && val !== key) el.textContent = val;
    });
  }

  function setLang(newLang) {
    if (lang === newLang) return;
    lang = newLang;
    localStorage.setItem('tga-lang', lang);
    // Clear caches so everything re-renders with the new language
    eventCache = {};
    loadedSeriesId = null;
    var sl = document.getElementById('series-list');
    if (sl) sl._listLoaded = false;
    updateLangUI();
    route();
  }
  // ──────────────────────────────────────────────────────────────────────────

  function setTheme(newTheme) {
    if (newTheme !== 'light' && newTheme !== 'dark') newTheme = 'dark';
    if (theme === newTheme) return;
    theme = newTheme;
    try { localStorage.setItem('tga-theme', theme); } catch (e) {}
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeUI();
  }

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

  window.addEventListener('resize', function () {
    adjustEventPanelPadding();
    adjustDetailPanelPadding();
  });

  function esc(s) {
    if (s == null) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // Static Car Specs render for Supercars (fallback when API is unavailable)
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
    makeTableSortable(modelsWrap.querySelector('.data-table'), carModels.map(function (c) { return [c.manufacturer, c.model]; }), esc);

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
    makeTableSortable(techWrap.querySelector('.data-table'), techSpec.map(function (s) { return [s.key, s.value]; }), esc);

    // Engines
    if (enginesWrap && enginesTitle) {
      enginesWrap.classList.remove('hidden');
      enginesTitle.classList.remove('hidden');
      enginesWrap.innerHTML =
        '<div class="table-wrap"><table class="data-table"><thead><tr><th>Car model</th><th>Engine specification</th></tr></thead><tbody>' +
        engines.map(function (e) {
          return '<tr><td>' + esc(dash(e.model)) + '</td><td>' + esc(dash(e.spec)) + '</td></tr>';
        }).join('') +
        '</tbody></table></div>';
      makeTableSortable(enginesWrap.querySelector('.data-table'), engines.map(function (e) { return [e.model, e.spec]; }), esc);
    }

    // Homologation
    if (homologWrap && homologTitle) {
      homologWrap.classList.remove('hidden');
      homologTitle.classList.remove('hidden');
      homologWrap.innerHTML =
        '<div class="table-wrap"><table class="data-table"><thead><tr><th>Manufacturer</th><th>Homologating team</th></tr></thead><tbody>' +
        homologation.map(function (h) {
          return '<tr><td>' + esc(dash(h.manufacturer)) + '</td><td>' + esc(dash(h.team)) + '</td></tr>';
        }).join('') +
        '</tbody></table></div>';
      makeTableSortable(homologWrap.querySelector('.data-table'), homologation.map(function (h) { return [h.manufacturer, h.team]; }), esc);
    }
  }

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

  function typeLabel(t) {
    var labels = {
      openwheel: 'Open wheel',
      gt_endurance: 'GT Endurance',
      gt_sprint: 'GT Sprint',
      touring: 'Touring',
      stock_car_racing: 'Stock car',
      single_make: 'Single make'
    };
    return labels[t] || t || '—';
  }

  function countryDisplay(country) {
    if (!country) return { icon: '', label: '—' };
    var c = String(country).toUpperCase();
    if (c === 'USA') return { icon: '\uD83C\uDDFA\uD83C\uDDF8', label: 'USA' };
    if (c === 'ITALY') return { icon: '\uD83C\uDDEE\uD83C\uDDF9', label: 'Italy' };
    if (c === 'FIA') return { icon: '\uD83C\uDF10', label: 'World' };
    if (c === 'EUROPE') return { icon: '', label: 'Europe' };
    return { icon: '', label: country };
  }

  function countryHtml(country) {
    var d = countryDisplay(country);
    return esc(d.label);
  }

  function syncStandingsScrollBars() { /* top bar removed */ }

  var categories = [
    { key: 'openwheel', ids: ['F1', 'INDYCAR', 'SUPER_FORMULA', 'F2', 'F3', 'FREC', 'F4_IT', 'SMP_F4_RU'] },
    { key: 'stockcar',  ids: ['NASCAR_CUP', 'NOAPS', 'NASCAR_TRUCK', 'ARCA', 'NASCAR_MODIFIED'] },
    { key: 'endurance', ids: ['WEC', 'ELMS', 'IMSA'] },
    // In Touring, show Supercars first
    { key: 'touring',   ids: ['SUPERCARS', 'GTWCE_END', 'GTWCE_SPRINT', 'PSC', 'DTM', 'SUPER_GT'] }
  ];

  // ── Category by series ID ─────────────────────────────────────────────────
  var categoryBySeriesId = {};
  categories.forEach(function (cat) {
    cat.ids.forEach(function (id) {
      categoryBySeriesId[id] = cat.key;
      categoryBySeriesId[id.toLowerCase()] = cat.key;
    });
  });

  var categoryColors = (window.TGA_CATEGORY_COLORS || {});

  // Unique color per series (if unset — use category color)
  var seriesColors = (window.TGA_SERIES_COLORS || {});

  var seriesShort = (window.TGA_SERIES_SHORT || {});

  // hex → r,g,b for rgba()
  function hexRgb(hex) {
    var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return r+','+g+','+b;
  }

  function seriesBadge(seriesId) {
    var sid = (seriesId || '').toLowerCase();
    var cat = categoryBySeriesId[sid] || categoryBySeriesId[seriesId] || 'openwheel';
    var color = seriesColors[(seriesId || '').toUpperCase()] || categoryColors[cat] || '#888888';
    var rgb = hexRgb(color);
    var label = seriesShort[seriesId] || seriesShort[(seriesId || '').toUpperCase()] || seriesId;
    return '<span class="series-badge" style="color:' + color + ';background:rgba(' + rgb + ',0.1);border:1px solid rgba(' + rgb + ',0.22)">' + esc(label) + '</span>';
  }

  function formatShortDate(dateStr) {
    if (!dateStr) return '—';
    var d = new Date(dateStr + 'T12:00:00');
    if (isNaN(d.getTime())) return dateStr;
    var months_en = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var months_ru = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
    var day = d.getDate();
    var mon = lang === 'ru' ? months_ru[d.getMonth()] : months_en[d.getMonth()];
    return lang === 'ru' ? day + ' ' + mon : mon + ' ' + day;
  }

  function formatDateRange(startDs, endDs) {
    if (!startDs) return '—';
    var months_en = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var months_ru = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
    var d1 = new Date(startDs + 'T12:00:00');
    if (!endDs || startDs === endDs) {
      var day = d1.getDate();
      var mon = lang === 'ru' ? months_ru[d1.getMonth()] : months_en[d1.getMonth()];
      return lang === 'ru' ? day + ' ' + mon : mon + ' ' + day;
    }
    var d2 = new Date(endDs + 'T12:00:00');
    var d1day = d1.getDate(), d2day = d2.getDate();
    var m1 = lang === 'ru' ? months_ru[d1.getMonth()] : months_en[d1.getMonth()];
    var m2 = lang === 'ru' ? months_ru[d2.getMonth()] : months_en[d2.getMonth()];
    if (d1.getMonth() === d2.getMonth()) {
      return lang === 'ru' ? d1day + '\u2013' + d2day + '\u00a0' + m1 : m1 + '\u00a0' + d1day + '\u2013' + d2day;
    }
    return lang === 'ru'
      ? d1day + '\u00a0' + m1 + '\u2013' + d2day + '\u00a0' + m2
      : m1 + '\u00a0' + d1day + '\u2013' + m2 + '\u00a0' + d2day;
  }

  /** Date range with full month name for event page: "March 5–8, 2026"  */
  function formatDateRangeLong(startDs, endDs) {
    if (!startDs) return '';
    var monthsEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var monthsRu = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    var d1 = new Date((startDs + '').slice(0, 10) + 'T12:00:00');
    var endIso = (endDs || '').slice(0, 10);
    var year = (startDs + '').slice(0, 4);
    if (!endIso || endIso === (startDs + '').slice(0, 10)) {
      var day = d1.getDate();
      var mon = lang === 'ru' ? monthsRu[d1.getMonth()] : monthsEn[d1.getMonth()];
      return lang === 'ru' ? day + ' ' + mon + ' ' + year : mon + ' ' + day + ', ' + year;
    }
    var d2 = new Date(endIso + 'T12:00:00');
    var d1day = d1.getDate(), d2day = d2.getDate();
    var m1 = lang === 'ru' ? monthsRu[d1.getMonth()] : monthsEn[d1.getMonth()];
    var m2 = lang === 'ru' ? monthsRu[d2.getMonth()] : monthsEn[d2.getMonth()];
    if (d1.getMonth() === d2.getMonth()) {
      return lang === 'ru' ? d1day + '\u2013' + d2day + ' ' + m1 + ' ' + year : m1 + ' ' + d1day + '\u2013' + d2day + ', ' + year;
    }
    return lang === 'ru'
      ? d1day + ' ' + m1 + '\u2013' + d2day + ' ' + m2 + ' ' + year
      : m1 + ' ' + d1day + '\u2013' + m2 + ' ' + d2day + ', ' + year;
  }

  /** Parse date from meta.Date like "Thu 05 Mar 2026" to ISO YYYY-MM-DD.  */
  function parseMetaDateToISO(str) {
    if (!str || typeof str !== 'string') return null;
    var m = str.match(/(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/);
    if (!m) return null;
    var day = ('0' + parseInt(m[1], 10)).slice(-2);
    var monMap = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
    var monKey = String(m[2] || '').slice(0, 3).toLowerCase();
    var mm = monMap[monKey];
    if (!mm) return null;
    return m[3] + '-' + mm + '-' + day;
  }

  /** Collect min/max dates: d.start_date / d.end_date and sessions in d.tables (meta.Date).  */
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
    return { minIso: minIso || maxIso, maxIso: maxIso || minIso };
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

  /** Stage table: prefer stage_n, else legacy stageN.  */
  function tgaStageTable(tables, n) {
    if (!tables) return null;
    var u = 'stage_' + n;
    var leg = 'stage' + n;
    var a = tables[u];
    var b = tables[leg];
    if (a && a.headers && a.headers.length) return a;
    if (b && b.headers && b.headers.length) return b;
    return null;
  }

  var renderNextRaceCards = (window.TGA && window.TGA.renderNextRaceCards) || function () {};
  var stopNextRaceTimers = (window.TGA && window.TGA.stopNextRaceTimers) || function () {};

  // ── Global schedule helpers ───────────────────────────────────────────────
  var globalEventsCache = null; // cache of all events

  /** Events hidden from list and Full Schedule (reserved for future; currently hide nothing).  */
  function filterVisibleEvents(events) {
    if (!Array.isArray(events)) return events;
    return events;
  }

  var buildScheduleGroups = (window.TGA && window.TGA.buildScheduleGroups) || function () { return []; };
  var buildScheduleHTML = (window.TGA && window.TGA.buildScheduleHTML) || function () {};

  var scheduleHidePast = true;

  function applySchedulePastVisibility() {
    var root = document.getElementById('view-schedule');
    if (!root) return;
    var pastRows = root.querySelectorAll('.weekend-hdr.sched-past, .sched-row.sched-past');
    [].forEach.call(pastRows, function (tr) {
      tr.style.display = scheduleHidePast ? 'none' : '';
    });
  }

  // Expose deps for components (next-race-cards, schedule, list)
  (function () {
    window.TGA = window.TGA || {};
    window.TGA.t = t;
    window.TGA.esc = esc;
    window.TGA.driverDisplayName = driverDisplayName;
    window.TGA.isGuestEntryRow = isGuestEntryRow;
    window.TGA.guestCarNumberSet = guestCarNumberSet;
    window.TGA.entryListDriverCell = entryListDriverCell;
    window.TGA.entryListDriverLabel = entryListDriverLabel;
    window.TGA.seriesBadge = seriesBadge;
    window.TGA.formatShortDate = formatShortDate;
    window.TGA.formatDateRange = formatDateRange;
    window.TGA.formatDateRangeLong = formatDateRangeLong;
    window.TGA.parseMetaDateToISO = parseMetaDateToISO;
    window.TGA.getEventSessionDateRange = getEventSessionDateRange;
    window.TGA.parseEventDate = parseEventDate;
    window.TGA.applySchedulePastVisibility = applySchedulePastVisibility;
    window.TGA.makeSimpleTableSortable = typeof makeSimpleTableSortable !== 'undefined' ? makeSimpleTableSortable : function () {};
  })();

  // month name + day (e.g. "March 1") → ISO date "2026-03-01"
  function monthDayToISO(md) {
    if (!md) return '';
    md = String(md).trim();
    var m = md.match(/^([A-Za-z]+)\s+(\d+)/);       // "March 8"
    var mRev = !m && md.match(/^(\d+)\s+([A-Za-z]+)/); // "8 March"
    if (!m && !mRev) return '';
    var monthName = (m ? m[1] : mRev[2]).toLowerCase();
    var dayNum = m ? m[2] : mRev[1];
    var day = ('0' + parseInt(dayNum, 10)).slice(-2);
    var months = {
      january: '01', february: '02', march: '03', april: '04',
      may: '05', june: '06', july: '07', august: '08',
      september: '09', october: '10', november: '11', december: '12'
    };
    var mm = months[monthName];
    if (!mm) return '';
    return '2026-' + mm + '-' + day;
  }
  window.TGA.monthDayToISO = monthDayToISO;

  function fetchAllEvents(seriesData) {
    var allIds = [];
    categories.forEach(function (c) { c.ids.forEach(function (id) { allIds.push(id); }); });
    var byId = {};
    seriesData.forEach(function (s) { byId[s.id] = s; });
    var relevant = allIds.map(function (id) { return byId[id]; }).filter(Boolean);

    return Promise.all(relevant.map(function (s) {
      var se = String((s.season != null && s.season !== '') ? s.season : '2026').trim();
      return fetchJSON('/api/series/' + encodeURIComponent((s.id || '').toLowerCase()) + '/events?season=' + encodeURIComponent(se) + '&_=' + Date.now())
        .then(function (events) {
          return (Array.isArray(events) ? events : []).map(function (e) {
            var ev = Object.assign({}, e, { _seriesId: s.id, _seriesName: s.name });
            ev.time_est = ev.time_est || ev.timeEst || ev.time_et || '';
            ev.time_msk = ev.time_msk || ev.timeMsk || '';
            return ev;
          });
        })
        .catch(function () { return []; });
    })).then(function (arrays) {
      var all = [].concat.apply([], arrays);

      // Add static schedules for F1 / INDYCAR / F2 when series has no own events
      var haveIndycar = all.some(function (e) { return (e._seriesId || '').toUpperCase() === 'INDYCAR'; });
      var haveF1      = all.some(function (e) { return (e._seriesId || '').toUpperCase() === 'F1'; });
      var haveF2      = all.some(function (e) { return (e._seriesId || '').toUpperCase() === 'F2'; });
      var haveF3      = all.some(function (e) { return (e._seriesId || '').toUpperCase() === 'F3'; });

      if (!haveIndycar && byId['INDYCAR']) {
        var indyStat = (window.TGA_STATIC_SCHEDULES && window.TGA_STATIC_SCHEDULES.indycarEvents) || [];
        indyStat.forEach(function (e) {
          var iso = monthDayToISO(e.date);
          all.push({
            _seriesId: 'INDYCAR',
            _seriesName: byId['INDYCAR'].name,
            id: '',
            name: e.name,
            start_date: iso,
            date: iso,
            circuit_name: e.track,
            location: e.location,
            time_est: e.est,
            time_msk: e.msk,
            has_detail: false
          });
        });
      }

      // Pre-Season Testing: fallback when not yet in API (schedule already in f1.json).
      if (byId['F1']) {
        [
          { start: 'February 11', end: 'February 13', name: 'Pre-Season Testing 1', circuit: 'Bahrain International Circuit', time_est: '10:00–19:00', id: 'F1_2026_PRE_SEASON_TEST_1', has_detail: true },
          { start: 'February 18', end: 'February 20', name: 'Pre-Season Testing 2', circuit: 'Bahrain International Circuit', time_est: '10:00–19:00', id: 'F1_2026_PRE_SEASON_TEST_2', has_detail: true }
        ].forEach(function (e) {
          var exists = all.some(function (x) {
            return (String(x._seriesId || '').toUpperCase() === 'F1' && String(x.id || '') === String(e.id || ''));
          });
          if (exists) return;
          var isoStart = monthDayToISO(e.start);
          var isoEnd = monthDayToISO(e.end);
          all.push({
            _seriesId: 'F1',
            _seriesName: byId['F1'].name,
            id: e.id || '',
            name: e.name,
            start_date: isoStart,
            end_date: isoEnd,
            date: isoStart,
            circuit_name: e.circuit,
            location: '',
            time_est: e.time_est || '',
            time_msk: '',
            has_detail: e.has_detail !== undefined ? e.has_detail : false
          });
        });
      }

      if (!haveF1 && byId['F1']) {
        var f1Stat = [
          { date: 'March 8',  name: 'Australian Grand Prix',          circuit: 'Australia — Albert Park Circuit, Melbourne' },
          { date: 'March 15', name: 'Chinese Grand Prix',             circuit: 'China — Shanghai International Circuit, Shanghai' },
          { date: 'March 29', name: 'Japanese Grand Prix',            circuit: 'Japan — Suzuka Circuit, Suzuka' },
          { date: 'April 12', name: 'Bahrain Grand Prix',             circuit: 'Bahrain — Bahrain International Circuit, Sakhir' },
          { date: 'April 19', name: 'Saudi Arabian Grand Prix',       circuit: 'Saudi Arabia — Jeddah Corniche Circuit, Jeddah' },
          { date: 'May 3',    name: 'Miami Grand Prix',    circuit: 'United States — Miami International Autodrome, Miami Gardens, Florida' },
          { date: 'May 24',   name: 'Canadian Grand Prix',            circuit: 'Canada — Circuit Gilles Villeneuve, Montreal' },
          { date: 'June 7',   name: 'Monaco Grand Prix',              circuit: 'Monaco — Circuit de Monaco, Monaco' },
          { date: 'June 14',  name: 'Barcelona-Catalunya Grand Prix', circuit: 'Spain — Circuit de Barcelona-Catalunya, Montmeló' },
          { date: 'June 28',  name: 'Austrian Grand Prix',            circuit: 'Austria — Red Bull Ring, Spielberg' },
          { date: 'July 5',   name: 'British Grand Prix',             circuit: 'United Kingdom — Silverstone Circuit, Silverstone' },
          { date: 'July 19',  name: 'Belgian Grand Prix',             circuit: 'Belgium — Circuit de Spa-Francorchamps, Stavelot' },
          { date: 'July 26',  name: 'Hungarian Grand Prix',           circuit: 'Hungary — Hungaroring, Mogyoród' },
          { date: 'August 23',name: 'Dutch Grand Prix',               circuit: 'Netherlands — Circuit Zandvoort, Zandvoort' },
          { date: 'September 6', name: 'Italian Grand Prix',          circuit: 'Italy — Monza Circuit, Monza' },
          { date: 'September 13', name: 'Spanish Grand Prix',         circuit: 'Spain — Madring, Madrid' },
          { date: 'September 26', name: 'Azerbaijan Grand Prix',      circuit: 'Azerbaijan — Baku City Circuit, Baku' },
          { date: 'October 11', name: 'Singapore Grand Prix',         circuit: 'Singapore — Marina Bay Street Circuit, Singapore' },
          { date: 'October 25', name: 'United States Grand Prix',    circuit: 'United States — Circuit of the Americas, Austin, Texas' },
          { date: 'November 1', name: 'Mexico City Grand Prix',      circuit: 'Mexico — Autódromo Hermanos Rodríguez, Mexico City' },
          { date: 'November 8', name: 'São Paulo Grand Prix',        circuit: 'Brazil — Interlagos Circuit, São Paulo' },
          { date: 'November 21', name: 'Las Vegas Grand Prix',       circuit: 'United States — Las Vegas Strip Circuit, Paradise, Nevada' },
          { date: 'November 29', name: 'Qatar Grand Prix',           circuit: 'Qatar — Lusail International Circuit, Lusail' },
          { date: 'December 6', name: 'Abu Dhabi Grand Prix',        circuit: 'United Arab Emirates — Yas Marina Circuit, Abu Dhabi' }
        ];
        f1Stat.forEach(function (e) {
          var iso = monthDayToISO(e.date);
          // By default: only know Australia local time (Round 1).
          var timeLocal = '';
          var timeMsk = '';
          if (e.name === 'Australian Grand Prix') {
            // Local 15:00 → MSK 07:00 (UTC+3, −8 hours)
            timeLocal = '15:00';
            timeMsk = '07:00';
          }
          all.push({
            _seriesId: 'F1',
            _seriesName: byId['F1'].name,
            id: '',
            name: e.name,
            start_date: iso,
            date: iso,
            circuit_name: e.circuit,
            location: '',
            time_est: timeLocal,
            time_msk: timeMsk,
            has_detail: false
          });
        });
      }

      if (!haveF2 && byId['F2']) {
        var f2Stat = [
          { round: 1,  sprint: '7 March',      feature: '8 March',      circuit: 'Australia — Albert Park Circuit, Melbourne' },
          { round: 2,  sprint: '2 May',        feature: '3 May',        circuit: 'United States — Miami International Autodrome, Miami Gardens, Florida' },
          { round: 3,  sprint: '23 May',       feature: '24 May',       circuit: 'Canada — Circuit Gilles Villeneuve, Montreal' },
          { round: 4,  sprint: '6 June',       feature: '7 June',       circuit: 'Monaco — Circuit de Monaco, Monaco' },
          { round: 5,  sprint: '13 June',      feature: '14 June',      circuit: 'Spain — Circuit de Barcelona-Catalunya, Montmeló' },
          { round: 6,  sprint: '27 June',      feature: '28 June',      circuit: 'Austria — Red Bull Ring, Spielberg' },
          { round: 7,  sprint: '4 July',       feature: '5 July',       circuit: 'United Kingdom — Silverstone Circuit, Silverstone' },
          { round: 8,  sprint: '18 July',      feature: '19 July',      circuit: 'Belgium — Circuit de Spa-Francorchamps, Stavelot' },
          { round: 9,  sprint: '25 July',      feature: '26 July',      circuit: 'Hungary — Hungaroring, Mogyoród' },
          { round: 10, sprint: '5 September',  feature: '6 September',  circuit: 'Italy — Monza Circuit, Monza' },
          { round: 11, sprint: '12 September', feature: '13 September', circuit: 'Spain — Madring, Madrid' },
          { round: 12, sprint: '26 September', feature: '27 September', circuit: 'Azerbaijan — Baku City Circuit, Baku' },
          { round: 13, sprint: '28 November',  feature: '29 November',  circuit: 'Qatar — Lusail International Circuit, Lusail' },
          { round: 14, sprint: '5 December',   feature: '6 December',   circuit: 'United Arab Emirates — Yas Marina Circuit, Abu Dhabi' }
        ];
        f2Stat.forEach(function (e) {
          var isoSprint = monthDayToISO(e.sprint);
          var isoFeature = monthDayToISO(e.feature);

          // Separate row for Sprint Race
          all.push({
            _seriesId: 'F2',
            _seriesName: byId['F2'].name,
            id: '',
            name: 'F2 Round ' + e.round + ' — Sprint Race',
            start_date: isoSprint,
            date: isoSprint,
            circuit_name: e.circuit,
            location: '',
            time_est: e.round === 1 ? '14:10' : '',
            time_msk: e.round === 1 ? '06:10' : '',
            has_detail: false
          });

          // Separate row for Feature Race
          all.push({
            _seriesId: 'F2',
            _seriesName: byId['F2'].name,
            id: '',
            name: 'F2 Round ' + e.round + ' — Feature Race',
            start_date: isoFeature,
            date: isoFeature,
            circuit_name: e.circuit,
            location: '',
            time_est: e.round === 1 ? '11:25' : '',
            time_msk: e.round === 1 ? '03:25' : '',
            has_detail: false
          });
        });
      }

      if (!haveF3 && byId['F3']) {
        var f3Stat = [
          { round: 1,  sprint: '7 March',      feature: '8 March',      circuit: 'Australia — Albert Park Circuit, Melbourne' },
          { round: 2,  sprint: '6 June',       feature: '7 June',       circuit: 'Monaco — Circuit de Monaco, Monaco' },
          { round: 3,  sprint: '13 June',      feature: '14 June',      circuit: 'Spain — Circuit de Barcelona-Catalunya, Montmeló' },
          { round: 4,  sprint: '27 June',      feature: '28 June',      circuit: 'Austria — Red Bull Ring, Spielberg' },
          { round: 5,  sprint: '4 July',       feature: '5 July',       circuit: 'United Kingdom — Silverstone Circuit, Silverstone' },
          { round: 6,  sprint: '18 July',      feature: '19 July',      circuit: 'Belgium — Circuit de Spa-Francorchamps, Stavelot' },
          { round: 7,  sprint: '25 July',      feature: '26 July',      circuit: 'Hungary — Hungaroring, Mogyoród' },
          { round: 8,  sprint: '5 September',  feature: '6 September',  circuit: 'Italy — Monza Circuit, Monza' },
          { round: 9,  sprint: '12 September', feature: '13 September', circuit: 'Spain — Madring, Madrid' }
        ];
        f3Stat.forEach(function (e) {
          var isoSprint = monthDayToISO(e.sprint);
          var isoFeature = monthDayToISO(e.feature);

          // Separate row for Sprint Race
          all.push({
            _seriesId: 'F3',
            _seriesName: byId['F3'].name,
            id: '',
            name: 'F3 Round ' + e.round + ' — Sprint Race',
            start_date: isoSprint,
            date: isoSprint,
            circuit_name: e.circuit,
            location: '',
            time_est: e.round === 1 ? '11:15' : '',
            time_msk: e.round === 1 ? '03:15' : '',
            has_detail: false
          });

          // Separate row for Feature Race
          all.push({
            _seriesId: 'F3',
            _seriesName: byId['F3'].name,
            id: '',
            name: 'F3 Round ' + e.round + ' — Feature Race',
            start_date: isoFeature,
            date: isoFeature,
            circuit_name: e.circuit,
            location: '',
            time_est: e.round === 1 ? '08:50' : '',
            time_msk: e.round === 1 ? '00:50' : '',
            has_detail: false
          });
        });
      }

      // F2/F3 from API: per-race rows from TGA_MULTI_RACE_SESSIONS
      var multiMap = window.TGA_MULTI_RACE_SESSIONS || {};
      var expanded = [];
      all.forEach(function (e) {
        var sid = (e._seriesId || '').toUpperCase();
        if (sid !== 'F2' && sid !== 'F3') {
          expanded.push(e);
          return;
        }
        var idU = String(e.id || '').toUpperCase();
        var races = multiMap[idU];
        if (!Array.isArray(races) || races.length === 0) {
          expanded.push(e);
          return;
        }
        races.forEach(function (r) {
          var label = r.label || 'Race';
          var ds = String(r.date || '').slice(0, 10);
          var rowEv = {
            _seriesId: e._seriesId,
            _seriesName: e._seriesName,
            id: e.id,
            name: (e.name || '') + ' (' + label + ')',
            start_date: ds,
            end_date: ds,
            date: ds,
            circuit_name: e.circuit_name,
            location: e.location || '',
            time_est: r.time_est || r.time_local || '',
            time_msk: r.time_msk || '',
            has_detail: e.has_detail
          };
          delete rowEv._raceUtcMs;
          delete rowEv._scheduleDate;
          expanded.push(rowEv);
        });
      });
      all = expanded;

      if (window.TGA && window.TGA.normalizeScheduleEvent) {
        all = all.map(function (e) { return window.TGA.normalizeScheduleEvent(Object.assign({}, e)); });
      }
      all.sort(function (a, b) {
        var da = a._scheduleDate || a.start_date || a.date || '';
        var db = b._scheduleDate || b.start_date || b.date || '';
        if (da !== db) return da < db ? -1 : 1;
        var ta = (window.TGA && window.TGA.getEventRaceUtcMs) ? window.TGA.getEventRaceUtcMs(a) : 0;
        var tb = (window.TGA && window.TGA.getEventRaceUtcMs) ? window.TGA.getEventRaceUtcMs(b) : 0;
        return ta - tb;
      });
      return all;
    });
  }

  function loadGlobalSchedule(seriesData) {
    var nrRow = document.getElementById('next-races-row');
    if (nrRow) nrRow.classList.add('hidden');

    fetchAllEvents(seriesData).then(function (all) {
      var visible = filterVisibleEvents(all);
      globalEventsCache = visible;
      if (window.TGA && typeof window.TGA.setGlobalEventsCache === 'function') {
        window.TGA.setGlobalEventsCache(visible);
      }
      renderNextRaceCards(visible);
      if (window.TGA && typeof window.TGA.renderLastResultsCards === 'function') {
        window.TGA.renderLastResultsCards(all);
      }
    });
  }

  window.TGA.categories = categories;
  window.TGA.countryHtml = countryHtml;
  window.TGA.loadGlobalSchedule = loadGlobalSchedule;

  // ── Schedule page ─────────────────────────────────────────────────────────
  function renderSchedulePage() {
    showView('view-schedule');
    window.scrollTo(0, 0);
    document.title = t('home.full_schedule') + ' — TGA';

    var titleEl = document.getElementById('sched-page-title');
    var breadEl = document.getElementById('sched-page-breadcrumb');
    var body    = document.getElementById('sched-page-body');

    if (titleEl) titleEl.textContent = t('home.full_schedule');
    if (breadEl) {
      breadEl.textContent = '';
      var homeLink = document.createElement('a');
      homeLink.href = '/';
      homeLink.textContent = t('breadcrumb.all');
      breadEl.appendChild(homeLink);
    }

    // Update headers (single Time column)
    var ths = document.querySelectorAll('#view-schedule thead th[data-col]');
    [].forEach.call(ths, function (th) {
      var map = {
        series: t('home.series_col'),
        race: t('th.race_col'),
        date: 'Date',
        location: t('th.location'),
        time: t('th.time')
      };
      var v = map[th.getAttribute('data-col')];
      if (v) th.textContent = v;
    });

    // Initialize "Hide past races" toggle
    var hidePastToggle = document.getElementById('sched-hide-past-toggle');
    if (hidePastToggle && !hidePastToggle._bound) {
      hidePastToggle._bound = true;
      hidePastToggle.addEventListener('change', function () {
        scheduleHidePast = !!hidePastToggle.checked;
        applySchedulePastVisibility();
      });
    }
    if (hidePastToggle) {
      hidePastToggle.checked = true;
      scheduleHidePast = true;
    }

    if (body) body.innerHTML = '<tr><td colspan="5" class="loading">' + t('loading') + '</td></tr>';

    fetchJSON('/api/series')
      .then(function (data) { return fetchAllEvents(data); })
      .then(function (all) {
        var visible = filterVisibleEvents(all);
        globalEventsCache = visible;
        if (window.TGA && typeof window.TGA.setGlobalEventsCache === 'function') {
          window.TGA.setGlobalEventsCache(visible);
        }
        buildScheduleHTML(visible, 'sched-page-body');
      })
      .catch(function () {
        if (body) body.innerHTML = '<tr><td colspan="5">' + t('error.no_data') + '</td></tr>';
      });
  }

  var renderList = (window.TGA && window.TGA.renderList) || function () {};

  function renderDetail(seriesId, subPath) {
    subPath = subPath || '';
    // IMSA: URL may be /specs; in app the tab is named "classes"
    if ((seriesId || '').toLowerCase() === 'imsa' && subPath === 'specs') subPath = 'classes';
    var detailTitle = document.getElementById('detail-title');
    var detailMeta = document.getElementById('detail-meta');
    var detailBreadcrumb = document.getElementById('detail-breadcrumb');
    var seriesNav = document.getElementById('series-nav');
    var schedulePanel = document.getElementById('schedule-panel');
    var standingsPanel = document.getElementById('standings-panel');
    var teamsPanel = document.getElementById('teams-panel');
    var specsPanel = document.getElementById('specs-panel');
    var statsPanel = document.getElementById('stats-panel');
    var historyPanel = document.getElementById('history-panel');
    var teamsBody = document.querySelector('#teams-table tbody');
    var teamsFulltimeBody = document.querySelector('#teams-fulltime-table tbody');
    var teamsParttimeBody = document.querySelector('#teams-parttime-table tbody');
    var teamsNoncharteredBody = document.querySelector('#teams-nonchartered-table tbody');
    var teamsEnduranceBody = document.querySelector('#teams-endurance-table tbody');
    var teamsWildcardBody = document.querySelector('#teams-wildcard-table tbody');
    var standingsBody = document.querySelector('#standings-table tbody');
    var scheduleBody = document.querySelector('#schedule-table tbody');
    var scheduleEmpty = document.getElementById('schedule-empty');
    var teamsEmpty = document.getElementById('teams-empty');
    var standingsEmpty = document.getElementById('standings-empty');
    var specsEmpty = document.getElementById('specs-empty');
    var statsEmpty = document.getElementById('stats-empty');

    showView('view-detail');
    adjustDetailPanelPadding();

    // Update category class on <body> for contextual styles (incl. stock-car tables)
    var bodyEl = document.body;
    var seriesIdUpper = (seriesId || '').toUpperCase();
    var seriesIdLower = (seriesId || '').toLowerCase();
    var isF1SeasonSlug = seriesIdLower.indexOf('f1-') === 0;
    var isF1 = seriesIdLower === 'f1' || isF1SeasonSlug;
    var catKey = categoryBySeriesId[seriesIdUpper] || (isF1SeasonSlug ? 'openwheel' : null);
    if (bodyEl) {
      bodyEl.classList.remove('cat-openwheel', 'cat-stockcar', 'cat-endurance', 'cat-touring');
      if (catKey) bodyEl.classList.add('cat-' + catKey);
      Array.from(bodyEl.classList).forEach(function (cls) {
        if (cls.indexOf('series-') === 0) bodyEl.classList.remove(cls);
      });
      if (seriesIdLower) bodyEl.classList.add('series-' + (isF1 ? 'f1' : seriesIdLower));
    }
    var isStockCarSeries = catKey === 'stockcar';
    var isIndyCarSeries = seriesIdUpper === 'INDYCAR';
    var isSupercarsSeries = seriesIdUpper === 'SUPERCARS';
    var hasStats = isStockCarSeries || isIndyCarSeries || isSupercarsSeries || isF1;

    function teamLink(name) {
      return name ? '<a href="/team/' + encodeURIComponent(slugify(name)) + '" class="track-link">' + esc(name) + '</a>' : '—';
    }
    function driverLink(name) {
      if (window.TGA && window.TGA.driversCellHtml) return window.TGA.driversCellHtml(name);
      var display = driverDisplayName(name);
      return display ? '<a href="/driver/' + encodeURIComponent(slugify(display)) + '" class="track-link">' + esc(display) + '</a>' : '—';
    }

    // Special labels for some series
    var teamsHeaderEl = document.querySelector('.teams-section h3');
    if (teamsHeaderEl) {
      var sidLower = (seriesId || '').toLowerCase();
      if (sidLower === 'supercars') {
        teamsHeaderEl.textContent = 'Championship entries';
      } else if (sidLower === 'imsa') {
        teamsHeaderEl.textContent = t('nav.classes');
      } else {
        teamsHeaderEl.textContent = t('section.h3.teams');
      }
    }

    // Same series — switch tabs only. No early return if Schedule tab is open and table is empty (then full reload).
    var sameSeries = (loadedSeriesId === seriesId);
    var scheduleEmptyNeedReload = (subPath === '' && scheduleBody && !scheduleBody.querySelector('tr'));
    if (sameSeries && !scheduleEmptyNeedReload && subPath !== 'stats') {
      var isImsaSeriesSame = (seriesId || '').toLowerCase() === 'imsa';
      var specsPathSame = isImsaSeriesSame ? 'classes' : 'specs';
      var navIdx = 0;
      if (subPath === 'standings') navIdx = 1;
      else if (subPath === 'teams') navIdx = 2;
      else if (subPath === specsPathSame) navIdx = 3;
      else if (subPath === 'stats') navIdx = hasStats ? 4 : 0;
      else if (subPath === 'history') navIdx = isF1 ? (hasStats ? 5 : 4) : 0;
      seriesNav.querySelectorAll('.nav-link').forEach(function (link, i) {
        link.classList.toggle('active', i === navIdx);
      });
      schedulePanel.classList.toggle('hidden', subPath !== '');
      standingsPanel.classList.toggle('hidden', subPath !== 'standings');
      teamsPanel.classList.toggle('hidden', subPath !== 'teams');
      specsPanel.classList.toggle('hidden', subPath !== specsPathSame);
      if (statsPanel) statsPanel.classList.toggle('hidden', subPath !== 'stats');
      if (historyPanel) historyPanel.classList.toggle('hidden', subPath !== 'history');
      // IMSA: when switching tabs without full reload also need to
      // show / hide Classes block vs regular Car Specs in time.
      if (isImsaSeriesSame) {
        var imsaClassesSame = document.getElementById('imsa-classes-static');
        var carSpecSame = document.getElementById('car-spec-wrap');
        if (subPath === 'classes') {
          if (carSpecSame) carSpecSame.classList.add('hidden');
          if (imsaClassesSame) imsaClassesSame.classList.remove('hidden');
        } else {
          if (imsaClassesSame) imsaClassesSame.classList.add('hidden');
          if (carSpecSame) carSpecSame.classList.remove('hidden');
        }
      }
      // For F1: when switching to Specs tab without full reload
      // apply static regulations (otherwise table stays empty).
      if (!isImsaSeriesSame && subPath === 'specs' && typeof renderF1StaticSpecsIfNeeded === 'function') {
        renderF1StaticSpecsIfNeeded();
      }
      return;
    }

    detailTitle.textContent = '—';
    detailMeta.textContent = '';
    detailBreadcrumb.textContent = '';
    var detailHomeLink = document.createElement('a');
    detailHomeLink.href = '/';
    detailHomeLink.textContent = t('breadcrumb.all');
    detailBreadcrumb.appendChild(detailHomeLink);
    var seriesSlugForUrl = (seriesId || '').toLowerCase().replace(/_/g, '-');
    var base = isF1SeasonSlug ? ('/season/' + encodeURIComponent(seriesIdLower)) : ('/series/' + encodeURIComponent(seriesSlugForUrl));
    var scheduleHref = base;
    if (isF1 && !isF1SeasonSlug) {
      scheduleHref = '/season/f1-2026';
    }
    if (isF1SeasonSlug) {
      var seasonYear = seriesIdLower.replace(/^f1[-_]/, '') || seriesIdLower.slice(4);
      var seasonTitle = 'Formula 1 ' + seasonYear;
      detailTitle.textContent = seasonTitle;
      detailMeta.textContent = 'World';
      document.title = seasonTitle + ' — The Grid Archive (TGA)';
      detailBreadcrumb.innerHTML =
        '<a href="/">' + esc(t('breadcrumb.all')) + '</a>' +
        '<span class="breadcrumb-sep">/</span>' +
        '<a href="/series/f1/history">Formula 1</a>' +
        '<span class="breadcrumb-sep">/</span>' +
        '<span>' + esc('F1 ' + seasonYear) + '</span>';
    }
    var isImsaSeries = (seriesId || '').toLowerCase() === 'imsa';
    var navPages = [
      { path: '',          labelKey: 'nav.schedule'  },
      { path: 'standings', labelKey: 'nav.standings' },
      { path: 'teams',     labelKey: 'nav.teams'     },
      { path: isImsaSeries ? 'classes' : 'specs', labelKey: isImsaSeries ? 'nav.classes' : 'nav.carspecs'  }
    ];
    if (hasStats) {
      navPages.push({ path: 'stats', labelKey: 'nav.stats' });
    }
    if (isF1 && !isF1SeasonSlug) {
      navPages.push({ path: 'history', labelKey: 'nav.history' });
    }
    seriesNav.innerHTML = navPages.map(function (p) {
      var href = p.path ? base + '/' + p.path : scheduleHref;
      var active = (subPath === p.path) ? ' nav-link active' : ' nav-link';
      return '<a href="' + href + '" class="' + active.trim() + '">' + esc(t(p.labelKey)) + '</a>';
    }).join('');
    // For IMSA: Classes tab uses static block with classes,
    // hide heading inside panel.
    if (isImsaSeries) {
      var specsTitleElInit = document.querySelector('#specs-panel h3[data-i18n="section.h3.specs"]');
      if (specsTitleElInit) specsTitleElInit.classList.add('hidden');
      var imsaClassesBlock = document.getElementById('imsa-classes-static');
      var carSpecBlock = document.getElementById('car-spec-wrap');
      if (subPath === 'classes') {
        if (carSpecBlock) carSpecBlock.classList.add('hidden');
        if (imsaClassesBlock) imsaClassesBlock.classList.remove('hidden');
      } else {
        if (imsaClassesBlock) imsaClassesBlock.classList.add('hidden');
      }
    }
    if (schedulePanel) schedulePanel.classList.toggle('hidden', subPath !== '');
    if (standingsPanel) standingsPanel.classList.toggle('hidden', subPath !== 'standings');
    if (teamsPanel) teamsPanel.classList.toggle('hidden', subPath !== 'teams');
    if (specsPanel) specsPanel.classList.toggle('hidden', subPath !== (isImsaSeries ? 'classes' : 'specs'));
    if (statsPanel) statsPanel.classList.toggle('hidden', subPath !== 'stats');
    if (historyPanel) historyPanel.classList.toggle('hidden', subPath !== 'history');
    // After panel switch try to apply static F1 regulations (for /series/f1/specs and /season/f1-{year}/specs).
    if (typeof renderF1StaticSpecsIfNeeded === 'function') {
      renderF1StaticSpecsIfNeeded();
    }
    if (teamsBody) teamsBody.innerHTML = '';
    if (teamsFulltimeBody) teamsFulltimeBody.innerHTML = '';
    if (teamsParttimeBody) teamsParttimeBody.innerHTML = '';
    if (teamsNoncharteredBody) teamsNoncharteredBody.innerHTML = '';
    if (teamsEnduranceBody) teamsEnduranceBody.innerHTML = '';
    if (teamsWildcardBody) teamsWildcardBody.innerHTML = '';
    if (standingsBody) standingsBody.innerHTML = '';
    var standingsIneligibleWrap = document.getElementById('standings-ineligible-wrap');
    var standingsIneligibleBody = document.querySelector('#standings-ineligible-table tbody');
    var ineligibleScrollContainerInit = document.getElementById('standings-ineligible-scroll-container');
    if (ineligibleScrollContainerInit) ineligibleScrollContainerInit.classList.add('hidden');
    if (document.getElementById('standings-ineligible-title')) document.getElementById('standings-ineligible-title').classList.add('hidden');
    if (standingsIneligibleBody) standingsIneligibleBody.innerHTML = '';
    if (scheduleBody) scheduleBody.innerHTML = '';
    if (scheduleEmpty) scheduleEmpty.classList.add('hidden');
    if (teamsEmpty) teamsEmpty.classList.add('hidden');
    if (standingsEmpty) standingsEmpty.classList.add('hidden');
    if (specsEmpty) specsEmpty.classList.add('hidden');
    if (statsEmpty) statsEmpty.classList.add('hidden');
    var statsBody = document.querySelector('#stats-table tbody');
    if (statsBody) statsBody.innerHTML = '';

    fetchJSON('/api/series/' + encodeURIComponent((seriesId || '').toLowerCase()))
      .then(function (s) {
        loadedSeriesId = seriesId;
        if (!isF1SeasonSlug) {
          detailTitle.textContent = s.name;
          document.title = s.name + ' — The Grid Archive (TGA)';
          var metaText = esc(s.season) + ' · ' + countryHtml((seriesId || '').toLowerCase() === 'psc' ? 'Europe' : s.country);
          detailMeta.textContent = metaText;
          detailBreadcrumb.textContent = '';
          var homeLink = document.createElement('a');
          homeLink.href = '/';
          homeLink.textContent = t('breadcrumb.all');
          detailBreadcrumb.appendChild(homeLink);
        }

        adjustDetailPanelPadding();
      })
      .catch(function () {
        if (!isF1SeasonSlug) detailTitle.textContent = 'Series not found';
        adjustDetailPanelPadding();
      });

    // Update series live banner from /api/live-events data.
    (function updateSeriesLiveBanner() {
      var liveBanner = document.getElementById('series-live-banner');
      if (!liveBanner) return;
      var fetchJSONLocal = window.TGA && window.TGA.fetchJSON ? window.TGA.fetchJSON : fetchJSON;
      fetchJSONLocal('/api/live-events')
        .then(function (ids) {
          var list = Array.isArray(ids) ? ids : [];
          var targetPrefix = String(seriesId || '').toUpperCase() + '_';
          var hasLive = list.some(function (id) {
            return typeof id === 'string' && id.toUpperCase().indexOf(targetPrefix) === 0;
          });
          liveBanner.classList.toggle('hidden', !hasLive);
          liveBanner.setAttribute('aria-hidden', hasLive ? 'false' : 'true');
        })
        .catch(function () {
          // On network error simply hide banner.
          liveBanner.classList.add('hidden');
          liveBanner.setAttribute('aria-hidden', 'true');
        });
    })();

    fetchJSON('/api/series/' + encodeURIComponent((seriesId || '').toLowerCase()) + '/teams')
      .catch(function (err) {
        // Fallback for Supercars when backend does not yet serve Car Specs
        if ((seriesId || '').toLowerCase() === 'supercars') {
          var sc = window.tgaSeries && window.tgaSeries.supercars;
          return { teams: [], car_models: sc && sc.carModels ? sc.carModels.slice() : [], technical_spec: sc && sc.technicalSpec ? sc.technicalSpec.slice() : [] };
        }
        return {};
      })
      .then(function (data) {
        var seriesKeyTeams = (seriesId || '').toLowerCase();
        // Legacy format for some series: backend may return plain team array.
        if (Array.isArray(data)) {
          data = { teams: data };
        }
        var teams = data && data.teams ? data.teams : [];
        var hasSpec = data && ((data.car_models && data.car_models.length > 0) || (data.technical_spec && data.technical_spec.length > 0));

        // After IMSA, teams-table-wrap keeps GTP/LMP2 markup — #teams-table disappears.
        // For non-IMSA restore default structure so Supercars/IndyCar etc. can render.
        if (seriesKeyTeams !== 'imsa') {
          var wrapReset = document.getElementById('teams-table-wrap');
          var tableReset = document.getElementById('teams-table');
          if (wrapReset && !(tableReset && wrapReset.contains(tableReset))) {
            wrapReset.classList.add('table-wrap');
            wrapReset.innerHTML = '<table class="data-table" id="teams-table"><thead><tr><th>#</th><th data-i18n="th.manufacturer">Manufacturer</th><th data-i18n="th.team">Team</th><th data-i18n="th.no">No.</th><th data-i18n="th.driver">Driver</th><th data-i18n="th.crew_chief">Crew Chief</th></tr></thead><tbody></tbody></table>';
          }
        }

        // For Supercars always hard-set Car Specs regardless of backend data.
        if (seriesKeyTeams === 'supercars') {
          var sc = window.tgaSeries && window.tgaSeries.supercars;
          data.car_models = sc && sc.carModels ? sc.carModels.slice() : [];
          data.technical_spec = sc && sc.technicalSpec ? sc.technicalSpec.slice() : [];
          hasSpec = !!((data.car_models && data.car_models.length) || (data.technical_spec && data.technical_spec.length));
        }
        if (seriesKeyTeams === 'f1-2025' && window.F1_2025_TECH_SPEC) {
          data.technical_spec = window.F1_2025_TECH_SPEC;
          hasSpec = true;
        }
        if (seriesKeyTeams === 'f1-2026' && window.F1_2026_TECH_SPEC) {
          data.technical_spec = window.F1_2026_TECH_SPEC;
          hasSpec = true;
        }
        if (seriesKeyTeams === 'f1' && window.F1_2026_TECH_SPEC) {
          data.technical_spec = window.F1_2026_TECH_SPEC;
          hasSpec = true;
        }
        // Car Specs for F3: vehicle technical specs only (no points rules).
        if (seriesKeyTeams === 'f3') {
          data.car_models = [];
          data.technical_spec = [
            { key: 'Chassis', value: 'Carbon fibre kevlar monocoque with honeycomb structure' },
            { key: 'Suspension', value: 'Double steel wishbones, pushrod operated, twin dampers, helicoidally spring suspension' },
            { key: 'Length', value: '4,965 mm (195 in)' },
            { key: 'Width', value: '1,885 mm (74 in)' },
            { key: 'Height', value: '1,043 mm (41 in)' },
            { key: 'Engine', value: 'Mecachrome V634 3,396 cubic centimetres (207 cubic inches) V6 95° naturally aspirated, rear-mounted, rear-wheel-drive' },
            { key: 'Transmission', value: '3Mo 6-speed sequential paddle-shift' },
            { key: 'Power', value: '380 horsepower (283 kilowatts) @8,000 rpm\n420 newton-metres (310 pound force-feet)' },
            { key: 'Weight', value: '673 kg (1,484 lb) (including driver)' },
            { key: 'Fuel', value: 'Aramco Advanced 100% sustainable fuel' },
            { key: 'Lubricants', value: 'Aramco Orizon' },
            { key: 'Tyres', value: 'Pirelli P Zero (dry) and Pirelli Cinturato (wet) tyres' }
          ];
          hasSpec = true;
        }
        // Car Specs for F2: chassis/engine technical specs only (no sporting points rules).
        if (seriesKeyTeams === 'f2') {
          data.car_models = [];
          data.technical_spec = [
            { key: 'Chassis', value: 'Sandwich Carbon fibre/Aluminium monocoque with honeycomb structure' },
            { key: 'Suspension (front)', value: 'Pushrod operated double steel wishbones with twin dampers and torsion bars suspension' },
            { key: 'Suspension (rear)', value: 'Pushrod operated double steel wishbones with twin dampers and spring suspension' },
            { key: 'Length', value: '5,284 mm (208 in)' },
            { key: 'Width', value: '1,900 mm (75 in)' },
            { key: 'Height', value: '1,097 mm (43 in)' },
            { key: 'Wheelbase', value: '3,135 mm (123 in)' },
            { key: 'Engine', value: 'Mecachrome V634T 3.4 L (207 cu in) V6 single-turbo charged longitudinally mounted in a rear-engined, rear-wheel drive format' },
            { key: 'Transmission', value: 'Hewland 6-speed + 1 reverse sequential semi-automatic paddle-shift limited-slip differential' },
            { key: 'Power', value: '620 hp (462 kW) @ 8,750 rpm, 583 N⋅m (430 ft⋅lbf) torque' },
            { key: 'Weight', value: '795 kg (1,753 lb) including driver and fuel' },
            { key: 'Fuel', value: 'Aramco Advanced 55% sustainable fuel' },
            { key: 'Lubricants', value: 'Aramco Orizon' },
            { key: 'Brakes', value: 'Carbone Industrie carbon brake discs and pads' },
            { key: 'Tyres', value: 'Pirelli P Zero (dry) and Pirelli Cinturato (wet) tyres' }
          ];
          hasSpec = true;
        }

        // Always reset Car Specs section before applying new data,
        // so another series' specs do not stick.
        var carWrapReset = document.getElementById('car-spec-wrap');
        var carModelsWrapReset = document.getElementById('car-models-table-wrap');
        var techSpecWrapReset = document.getElementById('technical-spec-table-wrap');
        var enginesTitleReset = document.getElementById('engines-spec-title');
        var enginesWrapReset = document.getElementById('engines-spec-table-wrap');
        var homologationTitleReset = document.getElementById('homologation-spec-title');
        var homologationWrapReset = document.getElementById('homologation-spec-table-wrap');

        if (carWrapReset) carWrapReset.classList.add('hidden');
        if (carModelsWrapReset) carModelsWrapReset.innerHTML = '';
        if (techSpecWrapReset) techSpecWrapReset.innerHTML = '';
        if (enginesWrapReset) {
          enginesWrapReset.innerHTML = '';
          enginesWrapReset.classList.add('hidden');
        }
        if (enginesTitleReset) enginesTitleReset.classList.add('hidden');
        if (homologationWrapReset) {
          homologationWrapReset.innerHTML = '';
          homologationWrapReset.classList.add('hidden');
        }
        if (homologationTitleReset) homologationTitleReset.classList.add('hidden');
        if (specsEmpty) specsEmpty.classList.add('hidden');

        if (teams.length === 0) {
          teamsEmpty.classList.remove('hidden');
        } else {
          teamsEmpty.classList.add('hidden');
        }

        // For series without Car Specs (except Supercars and IMSA with static data) show
        // a clear message; keep panel content hidden.
        if (!hasSpec && seriesKeyTeams !== 'supercars' && seriesKeyTeams !== 'imsa') {
          if (specsEmpty) specsEmpty.classList.remove('hidden');
        }

        // Static Car Specs for IndyCar: ignore backend data presence
        if (seriesKeyTeams === 'indycar') {
          var carWrapIndy = document.getElementById('car-spec-wrap');
          var techSpecWrapIndy = document.getElementById('technical-spec-table-wrap');
          var carModelsTitleIndy = carWrapIndy && carWrapIndy.querySelector('h4[data-i18n="specs.car_models"]');
          var carModelsWrapIndy = document.getElementById('car-models-table-wrap');
          if (carModelsTitleIndy) carModelsTitleIndy.classList.add('hidden');
          if (carModelsWrapIndy) carModelsWrapIndy.innerHTML = '';
          if (carWrapIndy && techSpecWrapIndy) {
            carWrapIndy.classList.remove('hidden');
            var indySpec = [
              { key: 'Chassis', value: 'Dallara DW12 Safety Cell (IR-18 / UAK-18 specification)' },
              { key: 'Aero Kit Introduction', value: '2018 season' },
              { key: 'Aerodynamic Concept', value: 'Increased ground-effect downforce, reduced wing dependency' },
              { key: 'Design Inspiration', value: '1980s–1990s Indy car styling' },
              { key: 'Removed Components (2018 redesign)', value: 'Airbox, rear-wheel guards, auxiliary winglets' },
              { key: 'Track Compatibility', value: 'One base chassis for road, street, short oval, and superspeedways' },
              { key: 'Steering Wheel', value: 'Cosworth CCW Mk2' },
              { key: 'Display System', value: 'Configurable Display Unit 4.3' },
              { key: 'Cockpit Modifications', value: 'Enlarged cockpit dimensions, improved seat ergonomics' },
              { key: 'Cockpit Protection (2019)', value: 'Advanced Frontal Protection (AFP)' },
              { key: 'Aeroscreen (2020–present)', value: 'Developed by Red Bull Advanced Technologies' },
              { key: 'Engine (2018–2023)', value: '2.2L V6 twin-turbocharged (Chevrolet / Honda)' },
              { key: 'Hybrid Powertrain (2024–present)', value: '2.4L V6 with 100 bhp ERS hybrid unit (Mahle)' },
              { key: 'Current Chassis Status', value: 'Successor confirmed from 2028 season onward' },
              { key: 'Tire Supplier', value: 'Firestone (exclusive supplier)' },
              { key: 'Tire Types – Road/Street', value: 'Primary (black), Alternate (red, softer compound)' },
              { key: 'Tire Types – Ovals', value: 'Single primary compound' },
              { key: 'Rain Tires', value: 'Available for road and street circuits' },
              { key: 'Tire Construction', value: 'Firestone Firehawk racing slicks' }
            ];
            techSpecWrapIndy.innerHTML =
              '<table class="data-table"><thead><tr><th>' + t('th.field') + '</th><th>' + t('th.value') + '</th></tr></thead><tbody>' +
              indySpec.map(function (s) {
                return '<tr><td class="col-field">' + esc(dash(s.key)) + '</td><td>' + esc(dash(s.value)) + '</td></tr>';
              }).join('') +
              '</tbody></table>';
          }
        }
        function crewChiefLink(name) {
          return name ? '<a href="/crew-chief/' + encodeURIComponent(slugify(name)) + '" class="track-link">' + esc(name) + '</a>' : '—';
        }
        function chassisLink(name) {
          if (!name) return '—';
          var trimmed = String(name).trim();
          if (!trimmed || trimmed === '—') return '—';
          var isImsaBase = (seriesId || '').toLowerCase() === 'imsa';
          var hrefBase = isImsaBase ? (base.replace(/\/specs$/i, '') || base) : base;
          var href = hrefBase + (isImsaBase ? '/classes#' : '/specs#') + encodeURIComponent(slugify(trimmed));
          return '<a href="' + href + '" class="track-link">' + esc(trimmed) + '</a>';
        }
        function teamRow(tm, i) {
          return '<tr><td class="col-num">' + (i + 1) + '</td><td>' + esc(dash(tm.manufacturer)) + '</td><td>' + teamLink(tm.team) + '</td><td>' + esc(dash(tm.number)) + '</td><td>' + driverLink(tm.driver) + '</td><td>' + crewChiefLink(tm.crew_chief) + '</td></tr>';
        }
        // F1 / open-wheel: merge cells by manufacturer and team (rowspan)
        function buildOpenWheelTeamsBody(teamsArr) {
          if (!teamsArr || teamsArr.length === 0) return '';
          var rows = [];
          var ord = 0;
          var i = 0;
          while (i < teamsArr.length) {
            var tm = teamsArr[i];
            var man = String(tm.manufacturer || '').trim();
            var teamName = String(tm.team || '').trim();
            var span = 1;
            for (var j = i + 1; j < teamsArr.length; j++) {
              if (String(teamsArr[j].manufacturer || '').trim() !== man || String(teamsArr[j].team || '').trim() !== teamName) break;
              span++;
            }
            for (var k = 0; k < span; k++) {
              var t = teamsArr[i + k];
              ord++;
              var cells = '<td class="col-num">' + ord + '</td>';
              if (k === 0) {
                cells += '<td rowspan="' + span + '" class="manufacturer-cell">' + esc(dash(man)) + '</td>' +
                  '<td rowspan="' + span + '" class="team-cell">' + teamLink(teamName) + '</td>';
              }
              cells += '<td class="col-num">' + esc(dash(t.number)) + '</td><td>' + driverLink(t.driver) + '</td><td>' + crewChiefLink(t.crew_chief) + '</td>';
              rows.push('<tr>' + cells + '</tr>');
            }
            i += span;
          }
          return rows.join('');
        }
        /** F1: Team | Constructor | Chassis | Engine | No. | Driver */
        function buildF1TeamsBody(teamsArr) {
          if (!teamsArr || teamsArr.length === 0) return '';
          var rows = [];
          var ord = 0;
          var i = 0;
          while (i < teamsArr.length) {
            var tm = teamsArr[i];
            var teamName = String(tm.team || '').trim();
            var man = String(tm.manufacturer || '').trim();
            var chassis = String(tm.chassis || '').trim();
            var powerUnit = String(tm.power_unit || '').trim();
            var span = 1;
            for (var j = i + 1; j < teamsArr.length; j++) {
              if (String(teamsArr[j].team || '').trim() !== teamName) break;
              span++;
            }
            for (var k = 0; k < span; k++) {
              var t = teamsArr[i + k];
              ord++;
              var cells = '<td class="col-num">' + ord + '</td>';
              if (k === 0) {
                var engineVal = (t.power_unit || t.engine || '').trim();
                cells += '<td rowspan="' + span + '" class="team-cell">' + teamLink(teamName) + '</td>' +
                  '<td rowspan="' + span + '" class="manufacturer-cell">' + esc(dash(man)) + '</td>' +
                  '<td rowspan="' + span + '">' + esc(dash(t.chassis)) + '</td>' +
                  '<td rowspan="' + span + '">' + esc(dash(engineVal)) + '</td>';
              }
              cells += '<td class="col-num">' + esc(dash(t.number)) + '</td><td>' + driverLink(t.driver) + '</td><td>' + esc(dash(t.rounds)) + '</td>';
              rows.push('<tr>' + cells + '</tr>');
            }
            i += span;
          }
          return rows.join('');
        }
        /** Historical F1 seasons: Entrant/Team | Constructor | Chassis | Power unit | No. | Driver | Rounds. */
        function buildF1SeasonTeamsTableHTML(teamsArr, seriesKeyTeams) {
          if (!teamsArr || teamsArr.length === 0) return '';
          var rows = [];
          var ord = 0;
          var i = 0;
          while (i < teamsArr.length) {
            var base = teamsArr[i];
            var teamName = String(base.team || '').trim();
            var span = 1;
            for (var j = i + 1; j < teamsArr.length; j++) {
              if (String(teamsArr[j].team || '').trim() !== teamName) break;
              span++;
            }
            for (var k = 0; k < span; k++) {
              var tm = teamsArr[i + k];
              ord++;
              var cells = '';
              var constructorVal = (tm.manufacturer || '').trim();
              var chassisVal = (tm.chassis || '').trim();
              var powerUnitVal = (tm.power_unit || tm.engine || '').trim();
              if (k === 0) {
                cells += '<td class="col-num">' + ord + '</td>' +
                  '<td rowspan="' + span + '">' + teamLink(teamName) + '</td>' +
                  '<td rowspan="' + span + '">' + esc(dash(constructorVal)) + '</td>' +
                  '<td rowspan="' + span + '">' + esc(dash(chassisVal)) + '</td>' +
                  '<td rowspan="' + span + '">' + esc(dash(powerUnitVal)) + '</td>';
              } else {
                cells += '<td class="col-num">' + ord + '</td>';
              }
              var roundsRaw = String(tm.rounds || '').trim();
              var roundsDisplay = roundsRaw;
              if (seriesKeyTeams && seriesKeyTeams.toLowerCase().indexOf('f1-') === 0 && roundsRaw.toLowerCase() === 'all') {
                roundsDisplay = '1–24';
              }
              cells += '<td class="col-num">' + esc(dash(tm.number)) + '</td>' +
                '<td>' + driverLink(tm.driver) + '</td>' +
                '<td>' + esc(dash(roundsDisplay)) + '</td>';
              rows.push('<tr>' + cells + '</tr>');
            }
            i += span;
          }
          var header =
            '<thead><tr>' +
              '<th>#</th>' +
              '<th>' + esc(t('th.team')) + '</th>' +
              '<th>Constructor</th>' +
              '<th>Chassis</th>' +
              '<th>Power unit</th>' +
              '<th>' + esc(t('th.no')) + '</th>' +
              '<th>' + esc(t('th.driver')) + '</th>' +
              '<th>' + esc(t('th.rounds')) + '</th>' +
            '</tr></thead>';
          return '<table class="data-table f1-teams-table">' + header + '<tbody>' + rows.join('') + '</tbody></table>';
        }
        /** Entry-list (F2, F3): Entrant/Team | No. | Driver name | Rounds, grouped by team (no country). */
        function buildEntryListTeamsTableHTML(teamsArr, seriesKeyTeams) {
          if (!teamsArr || teamsArr.length === 0) return '';
          var isF3 = (seriesKeyTeams || '').toLowerCase() === 'f3';
          var col1Header = isF3 ? t('th.entrant') : t('th.team');
          var col3Header = isF3 ? t('th.driver_name') : t('th.driver');
          var rows = [];
          var i = 0;
          while (i < teamsArr.length) {
            var base = teamsArr[i];
            var teamName = String(base.team || '').trim();
            var teamCellText = teamLink(teamName);
            var span = 1;
            for (var j = i + 1; j < teamsArr.length; j++) {
              if (String(teamsArr[j].team || '').trim() !== teamName) break;
              span++;
            }
            for (var k = 0; k < span; k++) {
              var tm = teamsArr[i + k];
              var cells = k === 0 ? '<td rowspan="' + span + '">' + teamCellText + '</td>' : '';
              var roundsRaw = String(tm.rounds || '').trim();
              var roundsDisplay = roundsRaw;
              // For historical F1 seasons show 1–24 instead of All
              if (seriesKeyTeams && seriesKeyTeams.toLowerCase().indexOf('f1-') === 0 && roundsRaw.toLowerCase() === 'all') {
                roundsDisplay = '1–24';
              }
              cells += '<td class="col-num">' + esc(dash(tm.number)) + '</td><td>' + driverLink(tm.driver) + '</td><td>' + esc(dash(roundsDisplay)) + '</td>';
              rows.push('<tr>' + cells + '</tr>');
            }
            i += span;
          }
          var header = '<thead><tr><th>' + esc(col1Header) + '</th><th>' + esc(t('th.no')) + '</th><th>' + esc(col3Header) + '</th><th>' + esc(t('th.rounds')) + '</th></tr></thead>';
          return '<table class="data-table">' + header + '<tbody>' + rows.join('') + '</tbody></table>';
        }
        function partTimeRow(tm, i) {
          return '<tr><td class="col-num">' + (i + 1) + '</td><td>' + esc(dash(tm.manufacturer)) + '</td><td>' + teamLink(tm.team) + '</td><td>' + esc(dash(tm.number)) + '</td><td>' + driverLink(tm.driver) + '</td><td>' + crewChiefLink(tm.crew_chief) + '</td></tr>';
        }
        function teamNonCharteredRow(tm, i) {
          return '<tr><td class="col-num">' + (i + 1) + '</td><td>' + esc(dash(tm.manufacturer)) + '</td><td>' + teamLink(tm.team) + '</td><td>' + esc(dash(tm.number)) + '</td><td>' + driverLink(tm.driver) + '</td><td>' + crewChiefLink(tm.crew_chief) + '</td></tr>';
        }
        // Stock cars: merge cells by team/number/Crew Chief + group by team in <tbody> for striping
        function buildStockCarTeamsBody(teamsArr) {
          if (!teamsArr || teamsArr.length === 0) return '';
          var teamRowSpan = [];
          var numberRowSpan = [];
          for (var i = 0; i < teamsArr.length; i++) {
            teamRowSpan[i] = 0;
            numberRowSpan[i] = 0;
          }
          for (var i = 0; i < teamsArr.length; i++) {
            if (teamRowSpan[i] === -1) continue;
            var teamVal = String(teamsArr[i].team || '').trim();
            var spanTeam = 1;
            for (var j = i + 1; j < teamsArr.length; j++) {
              if (String(teamsArr[j].team || '').trim() !== teamVal) break;
              spanTeam++;
              teamRowSpan[j] = -1;
            }
            teamRowSpan[i] = spanTeam;
          }
          for (var i = 0; i < teamsArr.length; i++) {
            if (numberRowSpan[i] === -1) continue;
            var teamVal = String(teamsArr[i].team || '').trim();
            var numVal = String(teamsArr[i].number || '').trim();
            var spanNum = 1;
            for (var j = i + 1; j < teamsArr.length; j++) {
              if (String(teamsArr[j].team || '').trim() !== teamVal || String(teamsArr[j].number || '').trim() !== numVal) break;
              spanNum++;
              numberRowSpan[j] = -1;
            }
            numberRowSpan[i] = spanNum;
          }
          var rows = [];
          for (var i = 0; i < teamsArr.length; i++) {
            var tm = teamsArr[i];
            var teamCell = teamRowSpan[i] === -1 ? '' : (teamRowSpan[i] > 0 ? '<td rowspan="' + teamRowSpan[i] + '" class="stockcar-team-cell">' + teamLink(tm.team) + '</td>' : '');
            var numberCell = numberRowSpan[i] === -1 ? '' : (numberRowSpan[i] > 0 ? '<td rowspan="' + numberRowSpan[i] + '" class="stockcar-number-cell">' + esc(dash(tm.number)) + '</td>' : '');
            var crewChiefCell = numberRowSpan[i] === -1 ? '' : (numberRowSpan[i] > 0 ? '<td rowspan="' + numberRowSpan[i] + '" class="stockcar-crewchief-cell">' + crewChiefLink(tm.crew_chief) + '</td>' : '');
            var roundsCell = '<td class="stockcar-rounds-cell">' + esc(dash(tm.rounds)) + '</td>';
            rows.push('<tr><td class="col-num">' + (i + 1) + '</td><td>' + esc(dash(tm.manufacturer)) + '</td>' + teamCell + numberCell + '<td>' + driverLink(tm.driver) + '</td>' + roundsCell + crewChiefCell + '</tr>');
          }
          // Group by team into separate <tbody> for alternating group background
          var groupStart = 0;
          var groupIndex = 0;
          var tbodyParts = [];
          while (groupStart < teamsArr.length) {
            var teamVal = String(teamsArr[groupStart].team || '').trim();
            var groupEnd = groupStart + 1;
            while (groupEnd < teamsArr.length && String(teamsArr[groupEnd].team || '').trim() === teamVal) groupEnd++;
            var groupClass = groupIndex % 2 === 0 ? 'group-odd' : 'group-even';
            tbodyParts.push('<tbody class="' + groupClass + '">' + rows.slice(groupStart, groupEnd).join('') + '</tbody>');
            groupStart = groupEnd;
            groupIndex++;
          }
          return tbodyParts.join('');
        }
        var seriesKeyTeams = (seriesId || '').toLowerCase();
        var isStockCarSeriesTeams = ['nascar_cup', 'noaps', 'nascar_xfinity', 'nascar_truck', 'arca', 'nascar_modified'].indexOf(seriesKeyTeams) >= 0;
        // Stock-car Teams thead with Rounds column (between Driver and Crew Chief). Used in all
        // stock-car render branches since body now has rounds cell (7 columns).
        var stockCarTheadHtml = '<thead><tr><th>#</th><th>' + t('th.manufacturer') + '</th><th>' + t('th.team') + '</th><th>' + t('th.no') + '</th><th>' + t('th.driver') + '</th><th>' + t('th.rounds') + '</th><th>' + t('th.crew_chief') + '</th></tr></thead>';
        var stockCarSortCols = [null, 'manufacturer', 'team', 'number', 'driver', 'rounds', 'crew_chief'];

        // Special IMSA renderer: separate tables per class (GTP / LMP2 / GTD Pro / GTD)
        if (seriesKeyTeams === 'imsa') {
          ['teams-fulltime-wrap', 'teams-fulltime-title', 'teams-parttime-wrap', 'teams-parttime-title', 'teams-nonchartered-wrap',
           'teams-endurance-wrap', 'teams-wildcard-wrap'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.classList.add('hidden');
          });

          var tableWrapImsa = document.getElementById('teams-table-wrap');
          if (!tableWrapImsa) return;
          // For IMSA outer wrap must not have single shared card background/border
          tableWrapImsa.classList.remove('table-wrap');

          var imsaTeams = teams.slice().map(function (t, idx) {
            // IMSA data arrives as arbitrary fields (class, chassis, drivers, rounds)
            return {
              idx: idx,
              className: String(t.class || '').trim(),
              team: String(t.team || '').trim(),
              chassis: String(t.chassis || '').trim(),
              number: String(t.number || '').trim(),
              drivers: Array.isArray(t.drivers) ? t.drivers.slice() : (t.driver ? [String(t.driver)] : []),
              rounds: String(t.rounds || t.races || '').trim()
            };
          });

          imsaTeams.sort(function (a, b) {
            var ca = a.className, cb = b.className;
            if (ca !== cb) return ca < cb ? -1 : 1;
            var ta = a.team, tb = b.team;
            if (ta !== tb) return ta < tb ? -1 : 1;
            var na = a.number, nb = b.number;
            return na < nb ? -1 : na > nb ? 1 : 0;
          });

          // Group by class
          var groupsByClass = {};
          imsaTeams.forEach(function (tm) {
            var cls = tm.className || '—';
            if (!groupsByClass[cls]) groupsByClass[cls] = [];
            groupsByClass[cls].push(tm);
          });

          function buildImsaTeamsBody(arr) {
            var bodyParts = [];
            var rowIdx = 0;
            var useAltBand = false;
            for (var gi = 0; gi < arr.length;) {
              var start = gi;
              var base = arr[start];
              var size = 1;
              while (start + size < arr.length) {
                var next = arr[start + size];
                if (!next || next.team !== base.team || next.chassis !== base.chassis) break;
                size++;
              }

              useAltBand = !useAltBand;
              var bandClass = useAltBand ? ' imsa-band-alt' : '';

              for (var j = 0; j < size; j++) {
                var tm = arr[start + j];
                rowIdx++;

                var driversLabel = '—';
                if (tm.drivers && tm.drivers.length) {
                  driversLabel = tm.drivers.map(function (d) {
                    return driverLink(d);
                  }).join('<br>');
                }

                // Rounds: one "row cell" per driver but inside one cell,
                // so crew is counted once (as before).
                var rawRounds = tm.rounds ? String(tm.rounds).trim() : '';
                var lowerRounds = rawRounds.toLowerCase();
                var driverRounds = [];
                var driverCount = (tm.drivers && tm.drivers.length) ? tm.drivers.length : 0;
                if (!rawRounds || driverCount === 0) {
                  driverRounds = ['—'];
                } else if (lowerRounds === 'rolex 24' || rawRounds === '1') {
                  for (var dr1 = 0; dr1 < driverCount; dr1++) driverRounds.push('1');
                } else if (lowerRounds === 'tbc') {
                  if (tm.team === 'Tower Motorsports' && tm.number === '8' && driverCount > 1) {
                    for (var dr2 = 0; dr2 < driverCount - 1; dr2++) driverRounds.push('1');
                    driverRounds.push('TBC');
                  } else {
                    for (var dr3 = 0; dr3 < driverCount; dr3++) driverRounds.push('TBC');
                  }
                } else {
                  for (var dr4 = 0; dr4 < driverCount; dr4++) driverRounds.push(rawRounds);
                }
                var roundsLabelHtml = driverRounds.map(function (v) { return esc(v); }).join('<br>');

                var rowHtml = '<tr class="imsa-teams-row' + bandClass + '">' +
                  '<td class="col-num">' + rowIdx + '</td>';
                if (j === 0) {
                  rowHtml +=
                    '<td rowspan="' + size + '">' + teamLink(tm.team) + '</td>' +
                    '<td rowspan="' + size + '">' + chassisLink(tm.chassis) + '</td>';
                }
                rowHtml +=
                  '<td>' + esc(dash(tm.number)) + '</td>' +
                  '<td>' + driversLabel + '</td>' +
                  '<td>' + roundsLabelHtml + '</td>' +
                  '</tr>';
                bodyParts.push(rowHtml);
              }
              gi = start + size;
            }
            return bodyParts.join('');
          }

          function attachImsaTeamsSort(tableEl, baseRows) {
            var tbody = tableEl.querySelector('tbody');
            var headerRow = tableEl.querySelector('thead tr');
            if (!tbody || !headerRow) return;
            var ths = headerRow.querySelectorAll('th');
            var rowsForSort = baseRows.slice();
            var dirByCol = {};

            function render() {
              tbody.innerHTML = buildImsaTeamsBody(rowsForSort);
            }

            function getSortValue(tm, colIndex) {
              switch (colIndex) {
                case 0: return typeof tm.idx === 'number' ? tm.idx : 0;
                case 1: return tm.team || '';
                case 2: return tm.chassis || '';
                case 3: return tm.number || '';
                case 4: return (tm.drivers && tm.drivers.length ? tm.drivers[0] : '');
                case 5: return tm.rounds || '';
                default: return '';
              }
            }

            [].forEach.call(ths, function (th, colIndex) {
              th.classList.add('sortable');
              th.addEventListener('click', function () {
                var dir = dirByCol[colIndex] || 1; // first sort — ascending
                dirByCol[colIndex] = -dir;
                [].forEach.call(ths, function (th2) { th2.classList.remove('sort-asc', 'sort-desc'); });
                th.classList.add(dir === 1 ? 'sort-asc' : 'sort-desc');

                var numeric = (colIndex === 0 || colIndex === 3 || colIndex === 5);
                rowsForSort = rowsForSort.slice().sort(function (a, b) {
                  var va = getSortValue(a, colIndex);
                  var vb = getSortValue(b, colIndex);
                  if (numeric) {
                    var na = parseFloat(va) || 0;
                    var nb = parseFloat(vb) || 0;
                    return dir * (na - nb);
                  }
                  return dir * String(va).localeCompare(String(vb), undefined, { numeric: true });
                });

                render();
              });
            });
          }

          var classOrder = ['GTP', 'LMP2', 'GTD Pro', 'GTD'];
          var imsaSortMeta = [];
          var sectionsHtml = classOrder.map(function (cls) {
            var arr = groupsByClass[cls];
            if (!arr || !arr.length) return '';
            imsaSortMeta.push({ className: cls, rows: arr.slice() });
            var body = buildImsaTeamsBody(arr);
            return ''
              + '<h4 class="table-section-title">' + esc(cls) + '</h4>'
              + '<div class="table-wrap">'
              +   '<table class="data-table imsa-teams-table">'
              +     '<thead><tr>'
              +       '<th class="col-num">#</th>'
              +       '<th>' + esc(t('th.team')) + '</th>'
              +       '<th>Chassis</th>'
              +       '<th>' + esc(t('th.no')) + '</th>'
              +       '<th>' + esc(t('th.driver')) + '</th>'
              +       '<th>Rounds</th>'
              +     '</tr></thead>'
              +     '<tbody>' + body + '</tbody>'
              +   '</table>'
              + '</div>';
          }).join('');

          tableWrapImsa.innerHTML = sectionsHtml || '<p class="empty-msg">No IMSA teams data.</p>';
          if (sectionsHtml) {
            var tablesImsa = tableWrapImsa.querySelectorAll('.imsa-teams-table');
            [].forEach.call(tablesImsa, function (tbl, idx) {
              var meta = imsaSortMeta[idx];
              if (meta && meta.rows && meta.rows.length) {
                attachImsaTeamsSort(tbl, meta.rows);
              }
            });
          }
          return;
        }

        // IndyCar: Team | Engine | No. | Driver(s) | Round(s) table, teams merged (rowspan)
        if (seriesKeyTeams === 'indycar' && teams.length > 0) {
          ['teams-fulltime-wrap', 'teams-fulltime-title', 'teams-parttime-wrap', 'teams-parttime-title',
           'teams-nonchartered-wrap', 'teams-nonchartered-title',
           'teams-endurance-wrap', 'teams-wildcard-wrap'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.classList.add('hidden');
          });
          var tableWrap = document.getElementById('teams-table-wrap');
          if (!tableWrap) return;
          tableWrap.classList.remove('hidden');
          function indyCarDriverCell(tm) {
            var nameHtml = driverLink(tm.driver || '');
            if (tm.rookie) {
              // Format: Name-R where R is rookie white marker.
              return nameHtml + '-<span class="rookie-tag" title="Rookie">R</span>';
            }
            return nameHtml;
          }
          // Groups of consecutive rows with same team and engine
          var groups = [];
          for (var g = 0; g < teams.length;) {
            var teamName = teams[g].team || '';
            var engine = teams[g].manufacturer || '';
            var count = 0;
            while (g + count < teams.length &&
                   (teams[g + count].team || '') === teamName &&
                   (teams[g + count].manufacturer || '') === engine) {
              count++;
            }
            groups.push({ team: teamName, engine: engine, rows: teams.slice(g, g + count) });
            g += count;
          }
          var indyRows = [];
          groups.forEach(function (gr) {
            var teamCell = '<td rowspan="' + gr.rows.length + '" class="team-cell">' + teamLink(gr.team) + '</td>';
            var engineCell = '<td rowspan="' + gr.rows.length + '">' + esc(gr.engine) + '</td>';
            gr.rows.forEach(function (tm, i) {
              var cells = (i === 0 ? teamCell + engineCell : '') +
                '<td class="col-num">' + esc(tm.number || '') + '</td>' +
                '<td>' + indyCarDriverCell(tm) + '</td>' +
                '<td>' + esc(tm.rounds || '') + '</td>';
              indyRows.push('<tr>' + cells + '</tr>');
            });
          });
          tableWrap.innerHTML =
            '<table class="data-table indycar-teams-table">' +
            '<thead><tr>' +
            '<th>Team</th><th>Engine</th><th>' + t('th.no') + '</th><th>' + t('th.driver') + '</th><th>' + t('th.rounds') + '</th>' +
            '</tr></thead><tbody>' + indyRows.join('') + '</tbody></table>';
          return;
        }

        // Super Formula: single table without Part-time, columns: # | Engine | Team | Driver
        if (seriesKeyTeams === 'super_formula' && teams.length > 0) {
          ['teams-fulltime-wrap', 'teams-fulltime-title', 'teams-parttime-wrap', 'teams-parttime-title',
           'teams-nonchartered-wrap', 'teams-nonchartered-title',
           'teams-endurance-wrap', 'teams-wildcard-wrap'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.classList.add('hidden');
          });
          var tableWrapSf = document.getElementById('teams-table-wrap');
          if (!tableWrapSf) return;
          tableWrapSf.classList.remove('hidden');

          var sfTeams = teams.slice().sort(function (a, b) {
            var ea = String(a.manufacturer || '').toLowerCase();
            var eb = String(b.manufacturer || '').toLowerCase();
            if (ea !== eb) return ea < eb ? -1 : 1;
            var ta = String(a.team || '').toLowerCase();
            var tb = String(b.team || '').toLowerCase();
            if (ta !== tb) return ta < tb ? -1 : 1;
            return String(a.number || '').localeCompare(String(b.number || ''), undefined, { numeric: true });
          });

          var sfRows = [];
          for (var sfi = 0; sfi < sfTeams.length;) {
            var sfTeam = String(sfTeams[sfi].team || '');
            var sfEngine = String(sfTeams[sfi].manufacturer || '');
            var sfSpan = 1;
            while (sfi + sfSpan < sfTeams.length &&
                   String(sfTeams[sfi + sfSpan].team || '') === sfTeam &&
                   String(sfTeams[sfi + sfSpan].manufacturer || '') === sfEngine) {
              sfSpan++;
            }
            for (var sfj = 0; sfj < sfSpan; sfj++) {
              var sft = sfTeams[sfi + sfj];
              var row = '<tr>' +
                '<td class="col-num">' + esc(dash(sft.number)) + '</td>';
              if (sfj === 0) {
                row += '<td rowspan="' + sfSpan + '">' + esc(dash(sfEngine)) + '</td>' +
                  '<td rowspan="' + sfSpan + '" class="team-cell">' + teamLink(sfTeam) + '</td>';
              }
              row += '<td>' + driverLink(sft.driver) + '</td>' +
                '<td>' + esc(dash(sft.rounds)) + '</td></tr>';
              sfRows.push(row);
            }
            sfi += sfSpan;
          }

          tableWrapSf.innerHTML =
            '<table class="data-table super-formula-teams-table" id="teams-table">' +
            '<thead><tr><th>#</th><th>' + t('th.engine') + '</th><th>' + t('th.team') + '</th><th>' + t('th.driver') + '</th><th>' + t('th.rounds') + '</th></tr></thead>' +
            '<tbody>' + sfRows.join('') + '</tbody></table>';
          return;
        }

        // FREC: Team | No. | Driver | Status | Rounds, with rowspan by team.
        if (seriesKeyTeams === 'frec' && teams.length > 0) {
          ['teams-fulltime-wrap', 'teams-fulltime-title', 'teams-parttime-wrap', 'teams-parttime-title',
           'teams-nonchartered-wrap', 'teams-nonchartered-title',
           'teams-endurance-wrap', 'teams-wildcard-wrap'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.classList.add('hidden');
          });

          var tableWrapFrec = document.getElementById('teams-table-wrap');
          if (!tableWrapFrec) return;
          tableWrapFrec.classList.remove('hidden');

          function buildFrecTeamsBody(teamsArr) {
            var rows = [];
            for (var i = 0; i < teamsArr.length;) {
              var teamName = String((teamsArr[i] && teamsArr[i].team) || '');
              var span = 1;
              while (i + span < teamsArr.length && String((teamsArr[i + span] && teamsArr[i + span].team) || '') === teamName) {
                span++;
              }
              for (var j = 0; j < span; j++) {
                var tm = teamsArr[i + j] || {};
                var row = '<tr>';
                if (j === 0) row += '<td rowspan="' + span + '">' + teamLink(teamName) + '</td>';
                row += '<td class="col-num">' + esc(dash(tm.number)) + '</td>';
                row += '<td>' + driverLink(tm.driver) + '</td>';
                row += '<td>' + esc(dash(tm.rounds)) + '</td>';
                row += '</tr>';
                rows.push(row);
              }
              i += span;
            }
            return rows.join('');
          }

          function frecTeamRow(tm) {
            return '<tr>' +
              '<td>' + teamLink(tm.team) + '</td>' +
              '<td class="col-num">' + esc(dash(tm.number)) + '</td>' +
              '<td>' + driverLink(tm.driver) + '</td>' +
              '<td>' + esc(dash(tm.rounds)) + '</td>' +
              '</tr>';
          }

          var frecTable = '<table class="data-table frec-teams-table" id="teams-table">' +
            '<thead><tr><th>Team</th><th>No.</th><th>Driver</th><th>' + t('th.rounds') + '</th></tr></thead>' +
            '<tbody>' + buildFrecTeamsBody(teams) + '</tbody></table>';
          tableWrapFrec.innerHTML = frecTable;

          addObjectTableSort(
            tableWrapFrec.querySelector('.data-table'),
            teams,
            frecTeamRow,
            ['team', 'number', 'driver', 'rounds']
          );

          // FREC specs: this branch returns early, so render technical spec here.
          var carWrapFrec = document.getElementById('car-spec-wrap');
          var carModelsWrapFrec = document.getElementById('car-models-table-wrap');
          var carModelsTitleFrec = carWrapFrec && carWrapFrec.querySelector('h4[data-i18n="specs.car_models"]');
          var techSpecWrapFrec = document.getElementById('technical-spec-table-wrap');
          if (carWrapFrec && techSpecWrapFrec && data && data.technical_spec && data.technical_spec.length > 0) {
            carWrapFrec.classList.remove('hidden');
            if (carModelsTitleFrec) carModelsTitleFrec.classList.add('hidden');
            if (carModelsWrapFrec) carModelsWrapFrec.innerHTML = '';
            if (specsEmpty) specsEmpty.classList.add('hidden');

            var frecSpecRows = data.technical_spec.filter(function (s) {
              return s && s.key != null && s.value != null && String(s.key).trim() !== '';
            });
            techSpecWrapFrec.innerHTML =
              '<table class="data-table table-field-value"><thead><tr><th>' + t('th.field') + '</th><th>' + t('th.value') + '</th></tr></thead><tbody>' +
              frecSpecRows.map(function (s) {
                return '<tr><td class="col-field">' + esc(dash(localizeSpecKey(s.key))) + '</td><td>' + esc(dash(localizeSpecValue(s.value))) + '</td></tr>';
              }).join('') +
              '</tbody></table>';
          }
          return;
        }

        // PSC: Team | No. | Driver | Rounds (entry-list style, no NASCAR columns).
        if (seriesKeyTeams === 'psc' && teams.length > 0) {
          ['teams-fulltime-wrap', 'teams-fulltime-title', 'teams-parttime-wrap', 'teams-parttime-title',
           'teams-nonchartered-wrap', 'teams-nonchartered-title',
           'teams-endurance-wrap', 'teams-wildcard-wrap'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.classList.add('hidden');
          });

          var tableWrapPsc = document.getElementById('teams-table-wrap');
          if (!tableWrapPsc) return;
          tableWrapPsc.classList.remove('hidden');

          function pscTeamDriverCell(tm) {
            var html = driverLink(tm.driver || '');
            if (isGuestEntryRow(tm)) return html + ' (G)';
            return html;
          }

          function buildPscTeamsBody(teamsArr) {
            var rows = [];
            for (var i = 0; i < teamsArr.length;) {
              var teamName = String((teamsArr[i] && teamsArr[i].team) || '');
              var span = 1;
              while (i + span < teamsArr.length && String((teamsArr[i + span] && teamsArr[i + span].team) || '') === teamName) {
                span++;
              }
              for (var j = 0; j < span; j++) {
                var tm = teamsArr[i + j] || {};
                var row = '<tr>';
                if (j === 0) row += '<td rowspan="' + span + '">' + teamLink(teamName) + '</td>';
                row += '<td class="col-num">' + esc(dash(tm.number)) + '</td>';
                row += '<td>' + pscTeamDriverCell(tm) + '</td>';
                row += '<td>' + esc(dash(tm.rounds)) + '</td>';
                row += '</tr>';
                rows.push(row);
              }
              i += span;
            }
            return rows.join('');
          }

          function pscTeamRow(tm) {
            return '<tr>' +
              '<td>' + teamLink(tm.team) + '</td>' +
              '<td class="col-num">' + esc(dash(tm.number)) + '</td>' +
              '<td>' + pscTeamDriverCell(tm) + '</td>' +
              '<td>' + esc(dash(tm.rounds)) + '</td>' +
              '</tr>';
          }

          var pscTable = '<table class="data-table psc-teams-table" id="teams-table">' +
            '<thead><tr><th>' + esc(t('th.team')) + '</th><th>' + esc(t('th.no')) + '</th><th>' + esc(t('th.driver')) + '</th><th>' + esc(t('th.rounds')) + '</th></tr></thead>' +
            '<tbody>' + buildPscTeamsBody(teams) + '</tbody></table>';
          tableWrapPsc.innerHTML = pscTable;

          addObjectTableSort(
            tableWrapPsc.querySelector('.data-table'),
            teams,
            pscTeamRow,
            ['team', 'number', 'driver', 'rounds']
          );
          return;
        }

        // DTM: Manufacturer | Car | Engine | Team | No. | Driver | Status | Rounds | Ref.
        if (seriesKeyTeams === 'dtm' && teams.length > 0) {
          ['teams-fulltime-wrap', 'teams-fulltime-title', 'teams-parttime-wrap', 'teams-parttime-title',
           'teams-nonchartered-wrap', 'teams-nonchartered-title',
           'teams-endurance-wrap', 'teams-wildcard-wrap'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.classList.add('hidden');
          });

          var tableWrapDtm = document.getElementById('teams-table-wrap');
          if (!tableWrapDtm) return;
          tableWrapDtm.classList.remove('hidden');

          var dtmCarByManufacturer = {
            'Aston Martin': 'Aston Martin Vantage AMR GT3 Evo',
            'BMW': 'BMW M4 GT3 Evo',
            'Ferrari': 'Ferrari 296 GT3 Evo',
            'Ford': 'Ford Mustang GT3 Evo',
            'Lamborghini': 'Lamborghini Temerario GT3',
            'Mercedes-AMG': 'Mercedes-AMG GT3 Evo',
            'McLaren': 'McLaren 720S GT3 Evo',
            'Porsche': 'Porsche 911 GT3 R (992.2)'
          };

          function dtmCarValue(tm) {
            var raw = tm && tm.car != null ? String(tm.car).trim() : '';
            if (raw) return raw;
            var man = tm && tm.manufacturer != null ? String(tm.manufacturer).trim() : '';
            return dtmCarByManufacturer[man] || '';
          }

          function buildDtmTeamsBody(teamsArr) {
            var rows = [];
            for (var i = 0; i < teamsArr.length;) {
              var base = teamsArr[i] || {};
              var teamName = String(base.team || '');
              var carName = dtmCarValue(base);
              var span = 1;
              while (i + span < teamsArr.length) {
                var next = teamsArr[i + span] || {};
                if (String(next.team || '') !== teamName || dtmCarValue(next) !== carName) break;
                span++;
              }

              for (var j = 0; j < span; j++) {
                var tm = teamsArr[i + j] || {};
                var row = '<tr>';
                if (j === 0) {
                  row += '<td rowspan="' + span + '">' + teamLink(teamName) + '</td>';
                  row += '<td rowspan="' + span + '">' + esc(dash(carName)) + '</td>';
                  row += '<td rowspan="' + span + '">' + esc(dash(tm.power_unit)) + '</td>';
                }
                row += '<td class="col-num">' + esc(dash(tm.number)) + '</td>';
                row += '<td>' + driverLink(tm.driver) + '</td>';
                row += '<td>' + esc(dash(tm.rounds)) + '</td>';
                row += '</tr>';
                rows.push(row);
              }
              i += span;
            }
            return rows.join('');
          }

          function dtmTeamRow(tm) {
            return '<tr>' +
              '<td>' + teamLink(tm.team) + '</td>' +
              '<td>' + esc(dash(dtmCarValue(tm))) + '</td>' +
              '<td>' + esc(dash(tm.power_unit)) + '</td>' +
              '<td class="col-num">' + esc(dash(tm.number)) + '</td>' +
              '<td>' + driverLink(tm.driver) + '</td>' +
              '<td>' + esc(dash(tm.rounds)) + '</td>' +
              '</tr>';
          }

          var dtmTable = '<table class="data-table dtm-teams-table" id="teams-table">' +
            '<thead><tr>' +
            '<th>Team</th><th>Car</th><th>Engine</th><th>No.</th><th>Driver</th><th>' + t('th.rounds') + '</th>' +
            '</tr></thead>' +
            '<tbody>' + buildDtmTeamsBody(teams) + '</tbody></table>';
          tableWrapDtm.innerHTML = dtmTable;

          addObjectTableSort(
            tableWrapDtm.querySelector('.data-table'),
            teams,
            dtmTeamRow,
            ['team', 'car', 'power_unit', 'number', 'driver', 'rounds']
          );
          return;
        }

        // Special Supercars renderer: one table with Championship / Endurance / Wildcard
        if (seriesKeyTeams === 'supercars') {
          // Hide all auxiliary wrappers for other series
          ['teams-fulltime-wrap', 'teams-fulltime-title', 'teams-parttime-wrap', 'teams-parttime-title',
           'teams-nonchartered-wrap', 'teams-nonchartered-title',
           'teams-endurance-wrap', 'teams-wildcard-wrap'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.classList.add('hidden');
          });

          var tableWrap = document.getElementById('teams-table-wrap');
          var baseTable = document.getElementById('teams-table');
          if (!tableWrap || !baseTable) return;

          // Map: manufacturer → model from Car Specs
          var modelByMan = {};
          if (data && data.car_models && data.car_models.length) {
            data.car_models.forEach(function (cm) {
              if (cm && cm.manufacturer) modelByMan[cm.manufacturer] = cm.model || '';
            });
          }

          var champTeams = teams.filter(function (t) { return t.full_time === true; });
          var wildcardTeams = teams.filter(function (t) { return t.full_time !== true; });

          // Sort championship entries
          champTeams.sort(function (a, b) {
            var ma = (a.manufacturer || ''), mb = (b.manufacturer || '');
            if (ma !== mb) return ma < mb ? -1 : 1;
            var ta = (a.team || ''), tb = (b.team || '');
            if (ta !== tb) return ta < tb ? -1 : 1;
            var na = (a.number || ''), nb = (b.number || '');
            return na < nb ? -1 : na > nb ? 1 : 0;
          });

          // Group by manufacturer and team, compute rowspan
          var manGroups = []; // [{ man, model, teams:[{name, rows:[] }], totalRows }]
          champTeams.forEach(function (driver) {
            var man = driver.manufacturer || '';
            var model = modelByMan[man] || driver.model || '';
            var teamName = driver.team || '';

            var lastGroup = manGroups.length ? manGroups[manGroups.length - 1] : null;
            var mg = lastGroup && lastGroup.man === man ? lastGroup : null;
            if (!mg) {
              mg = { man: man, model: model, teams: [], totalRows: 0 };
              manGroups.push(mg);
            }

            var teamsArr = mg.teams;
            var lastTeam = teamsArr.length ? teamsArr[teamsArr.length - 1] : null;
            var tg = lastTeam && lastTeam.name === teamName ? lastTeam : null;
            if (!tg) {
              tg = { name: teamName, rows: [] };
              teamsArr.push(tg);
            }

            tg.rows.push(driver);
            mg.totalRows++;
          });

          // Table header: columns only (no Championship/Endurance entries label)
          var theadHtml =
            '<tr>' +
              '<th>' + t('th.manufacturer') + '</th>' +
              '<th>' + t('th.model') + '</th>' +
              '<th>' + t('th.team') + '</th>' +
              '<th>' + t('th.no') + '</th>' +
              '<th>' + t('th.driver') + '</th>' +
              '<th>' + t('th.rounds') + '</th>' +
              '<th class="supercars-col-divider"></th>' +
              '<th>Co-driver</th>' +
              '<th>' + t('th.rounds') + '</th>' +
            '</tr>';

          var bodyRows = [];

          manGroups.forEach(function (mg) {
            var manFirstRow = true;
            mg.teams.forEach(function (tg) {
              var teamFirstRow = true;
              tg.rows.forEach(function (driverRow) {
                var cells = '';

                // Manufacturer + Model — rowspan across manufacturer group
                if (manFirstRow) {
                  cells += '<td rowspan="' + mg.totalRows + '" class="manufacturer-cell">' +
                    esc(dash(mg.man || '')) + '</td>' +
                    '<td rowspan="' + mg.totalRows + '">' + esc(dash(mg.model || '')) + '</td>';
                  manFirstRow = false;
                }

                // Team — rowspan across team group
                if (teamFirstRow) {
                  cells += '<td rowspan="' + tg.rows.length + '">' + teamLink(tg.name || '') + '</td>';
                  teamFirstRow = false;
                }

                cells +=
                  '<td class="col-num">' + esc(dash(driverRow.number)) + '</td>' +
                  '<td>' + driverLink(driverRow.driver) + '</td>' +
                  '<td>' + esc(dash(driverRow.rounds || '1')) + '</td>' +
                  '<td class="supercars-col-divider"></td>' +
                  '<td>' + (driverRow.co_driver ? driverLink(driverRow.co_driver) : '—') + '</td>' +
                  '<td>' + esc(dash(driverRow.co_rounds || '—')) + '</td>';

                bodyRows.push('<tr>' + cells + '</tr>');
              });
            });
          });

          // Wildcard entries section
          if (wildcardTeams.length > 0) {
            bodyRows.push(
              '<tr class="table-separator-row">' +
                '<td colspan="9">Wildcard entries</td>' +
              '</tr>'
            );
            wildcardTeams.forEach(function (w) {
              var man = w.manufacturer || '';
              var model = modelByMan[man] || w.model || '';
              bodyRows.push(
                '<tr>' +
                  '<td class="manufacturer-cell">' + esc(dash(man)) + '</td>' +
                  '<td>' + esc(dash(model)) + '</td>' +
                  '<td>' + teamLink(w.team || '') + '</td>' +
                  '<td class="col-num">' + esc(dash(w.number)) + '</td>' +
                  '<td>' + driverLink(w.driver || '') + '</td>' +
                  '<td>' + esc(dash(w.rounds || 'TBD')) + '</td>' +
                  '<td class="supercars-col-divider"></td>' +
                  '<td>' + (w.co_driver ? driverLink(w.co_driver) : '—') + '</td>' +
                  '<td>' + esc(dash(w.co_rounds || '—')) + '</td>' +
                '</tr>'
              );
            });
          }

          baseTable.classList.add('supercars-table');
          var theadEl = baseTable.querySelector('thead');
          var tbodyEl = baseTable.querySelector('tbody');
          if (theadEl) theadEl.innerHTML = theadHtml;
          if (tbodyEl) tbodyEl.innerHTML = bodyRows.join('');
          tableWrap.classList.remove('hidden');
          // Also always show static Car Specs block for Supercars
          renderSupercarsStaticSpecs();
          return;
        }

        // F1: own table (Team | Constructor | Chassis | Engine | No. | Driver), not stock-car/shared logic
        // F1 current season: detailed tech table; historical F1 seasons: entry list with Rounds.
        if (seriesKeyTeams === 'f1' && teams.length > 0) {
          ['teams-fulltime-wrap', 'teams-fulltime-title', 'teams-parttime-wrap', 'teams-parttime-title',
           'teams-nonchartered-wrap', 'teams-nonchartered-title',
           'teams-endurance-wrap', 'teams-wildcard-wrap'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.classList.add('hidden');
          });
          var wrapF1 = document.getElementById('teams-table-wrap');
          if (wrapF1) {
            wrapF1.classList.remove('hidden');
            wrapF1.innerHTML = '<table class="data-table f1-teams-table" id="teams-table">' +
              '<thead><tr><th>#</th><th>Team</th><th>Constructor</th><th>Chassis</th><th>Engine</th><th data-i18n="th.no">No.</th><th data-i18n="th.driver">Driver</th><th data-i18n="th.rounds">Rounds</th></tr></thead>' +
              '<tbody>' + buildF1TeamsBody(teams) + '</tbody></table>';
            addObjectTableSort(
              wrapF1.querySelector('.data-table'),
              teams,
              null,
              [null, 'team', 'manufacturer', 'chassis', 'power_unit', 'number', 'driver', 'rounds'],
              function (dataCopy) { return buildF1TeamsBody(dataCopy); }
            );
          }
          if (subPath === 'specs' && typeof renderF1StaticSpecsIfNeeded === 'function') {
            renderF1StaticSpecsIfNeeded();
          }
          return;
        }
        if (seriesKeyTeams.indexOf('f1-') === 0 && teams.length > 0) {
          // Historical F1 seasons (e.g. f1-2025): Entrant/Team | Constructor | Chassis | Power unit | No. | Driver | Rounds.
          ['teams-fulltime-wrap', 'teams-fulltime-title', 'teams-parttime-wrap', 'teams-parttime-title',
           'teams-nonchartered-wrap', 'teams-nonchartered-title',
           'teams-endurance-wrap', 'teams-wildcard-wrap'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.classList.add('hidden');
          });
          var wrapF1Season = document.getElementById('teams-table-wrap');
          if (wrapF1Season) {
            wrapF1Season.classList.remove('hidden');
            wrapF1Season.innerHTML = buildF1SeasonTeamsTableHTML(teams, seriesKeyTeams);
          }
          if (subPath === 'specs' && typeof renderF1StaticSpecsIfNeeded === 'function') {
            renderF1StaticSpecsIfNeeded();
          }
          return;
        }

        // GT / endurance series (ELMS, GTWCE Endurance/Sprint, Super GT, WEC): team table
        // built by backend from entry_list — one row per car with class, model, list of
        // drivers (sprint = 2, endurance = 3) and Rounds column. Group by class.
        var gtEnduranceTeamsSeries = ['elms', 'gtwce_end', 'gtwce_sprint', 'super_gt', 'wec'];
        if (gtEnduranceTeamsSeries.indexOf(seriesKeyTeams) >= 0 && teams.length > 0) {
          ['teams-fulltime-wrap', 'teams-fulltime-title', 'teams-parttime-wrap', 'teams-parttime-title',
           'teams-nonchartered-wrap', 'teams-nonchartered-title',
           'teams-endurance-wrap', 'teams-wildcard-wrap'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.classList.add('hidden');
          });
          var wrapGt = document.getElementById('teams-table-wrap');
          if (!wrapGt) return;
          wrapGt.classList.remove('hidden');

          function gtDriversCell(tm) {
            var list = Array.isArray(tm.drivers) && tm.drivers.length > 0
              ? tm.drivers
              : (tm.driver ? [tm.driver] : []);
            if (list.length === 0) return dash('');
            return list.map(function (d) { return driverLink(d); }).join('<br>');
          }

          // Write rounds NEXT TO each driver (driver_rounds parallel to drivers),
          // so it is visible which crew members missed races. If per-crew data
          // is missing — show car-wide rounds (tm.rounds).
          function gtRoundsCell(tm) {
            var list = Array.isArray(tm.drivers) && tm.drivers.length > 0
              ? tm.drivers
              : (tm.driver ? [tm.driver] : []);
            var dr = tm.driver_rounds;
            if (Array.isArray(dr) && dr.length === list.length && list.length > 0) {
              return list.map(function (_, i) { return esc(dash(dr[i])); }).join('<br>');
            }
            return esc(dash(tm.rounds));
          }

          var gtRows = [];
          for (var gi = 0; gi < teams.length;) {
            var cls = String(teams[gi].class || '');
            var span = 1;
            while (gi + span < teams.length && String(teams[gi + span].class || '') === cls) span++;
            for (var gj = 0; gj < span; gj++) {
              var tm = teams[gi + gj];
              var row = '<tr>';
              if (gj === 0) row += '<td rowspan="' + span + '" class="gt-class-cell">' + esc(dash(cls)) + '</td>';
              row += '<td class="col-num">' + esc(dash(tm.number)) + '</td>' +
                '<td>' + teamLink(tm.team) + '</td>' +
                '<td>' + esc(dash(tm.car)) + '</td>' +
                '<td>' + gtDriversCell(tm) + '</td>' +
                '<td>' + gtRoundsCell(tm) + '</td></tr>';
              gtRows.push(row);
            }
            gi += span;
          }

          wrapGt.innerHTML = '<table class="data-table gt-endurance-teams-table" id="teams-table">' +
            '<thead><tr><th>' + t('th.class') + '</th><th>' + t('th.no') + '</th><th>' + t('th.team') + '</th>' +
            '<th>' + t('th.car') + '</th><th>' + t('th.drivers') + '</th><th>' + t('th.rounds') + '</th></tr></thead>' +
            '<tbody>' + gtRows.join('') + '</tbody></table>';
          return;
        }

        var hasFullTimeFlag = teams.some(function (t) { return t.hasOwnProperty('full_time'); });
        // These series do not use full-time / part-time split (table built from entry_list,
        // where each row has service full_time:false). Force split off.
        if (['f2', 'f3', 'f1', 'f4_it', 'smp_f4_ru', 'psc'].indexOf(seriesKeyTeams) >= 0) hasFullTimeFlag = false;
        var fulltimeWrap = document.getElementById('teams-fulltime-wrap');
        var parttimeWrap = document.getElementById('teams-parttime-wrap');
        var noncharteredWrap = document.getElementById('teams-nonchartered-wrap');
        var noncharteredTitle = document.getElementById('teams-nonchartered-title');
        var isCupWithNonChartered = (seriesId || '').toLowerCase() === 'nascar_cup' && data.teams_non_chartered && data.teams_non_chartered.length > 0;
        if (noncharteredWrap) noncharteredWrap.classList.add('hidden');
        if (noncharteredTitle) noncharteredTitle.classList.add('hidden');
        if (isCupWithNonChartered) {
          fulltimeWrap.classList.remove('hidden');
          if (document.getElementById('teams-fulltime-title')) {
            document.getElementById('teams-fulltime-title').classList.remove('hidden');
            document.getElementById('teams-fulltime-title').textContent = t('teams.chartered');
          }
          parttimeWrap.classList.add('hidden');
          var parttimeTitleCup = document.getElementById('teams-parttime-title');
          if (parttimeTitleCup) parttimeTitleCup.classList.add('hidden');
          document.getElementById('teams-table-wrap').classList.add('hidden');
          if (teamsFulltimeBody && teams.length > 0) {
            if (isStockCarSeriesTeams) {
              var tableFt = fulltimeWrap.querySelector('.data-table');
              var theadHtmlFt = stockCarTheadHtml;
              tableFt.innerHTML = theadHtmlFt + buildStockCarTeamsBody(teams);
              tableFt.classList.add('stockcar-teams-table');
              addObjectTableSort(tableFt, teams, null, stockCarSortCols, function (dataCopy) { return theadHtmlFt + buildStockCarTeamsBody(dataCopy); });
            } else {
              teamsFulltimeBody.innerHTML = teams.map(teamRow).join('');
              addObjectTableSort(fulltimeWrap.querySelector('.data-table'), teams, teamRow, [null, 'manufacturer', 'team', 'number', 'driver', 'crew_chief']);
            }
          }
          noncharteredTitle.classList.remove('hidden');
          noncharteredWrap.classList.remove('hidden');
          if (teamsNoncharteredBody) {
            if (isStockCarSeriesTeams) {
              var tableNc = noncharteredWrap.querySelector('.data-table');
              var theadHtmlNc = stockCarTheadHtml;
              tableNc.innerHTML = theadHtmlNc + buildStockCarTeamsBody(data.teams_non_chartered);
              tableNc.classList.add('stockcar-teams-table');
              addObjectTableSort(tableNc, data.teams_non_chartered, null, stockCarSortCols, function (dataCopy) { return theadHtmlNc + buildStockCarTeamsBody(dataCopy); });
            } else {
              teamsNoncharteredBody.innerHTML = data.teams_non_chartered.map(teamNonCharteredRow).join('');
              addObjectTableSort(noncharteredWrap.querySelector('.data-table'), data.teams_non_chartered, teamNonCharteredRow, [null, 'manufacturer', 'team', 'number', 'driver', 'crew_chief']);
            }
          }
        } else if (hasFullTimeFlag && fulltimeWrap && parttimeWrap) {
          var fullTime = teams.filter(function (t) { return t.full_time === true; });
          var partTime = teams.filter(function (t) { return t.full_time !== true; });
          var fulltimeTitle = document.getElementById('teams-fulltime-title');
          var parttimeTitle = document.getElementById('teams-parttime-title');
          fulltimeWrap.classList.toggle('hidden', fullTime.length === 0);
          if (fulltimeTitle) {
            fulltimeTitle.classList.toggle('hidden', fullTime.length === 0);
            fulltimeTitle.textContent = (seriesId || '').toLowerCase() === 'arca' ? t('teams.fullschedule') : t('teams.fulltime');
          }
          parttimeWrap.classList.toggle('hidden', partTime.length === 0);
          if (parttimeTitle) {
            parttimeTitle.classList.toggle('hidden', partTime.length === 0);
            parttimeTitle.textContent = t('teams.parttime');
          }
          document.getElementById('teams-table-wrap').classList.add('hidden');
          if (teamsFulltimeBody && fullTime.length > 0) {
            if (isStockCarSeriesTeams) {
              var tableFt2 = fulltimeWrap.querySelector('.data-table');
              var theadHtmlFt2 = stockCarTheadHtml;
              tableFt2.innerHTML = theadHtmlFt2 + buildStockCarTeamsBody(fullTime);
              tableFt2.classList.add('stockcar-teams-table');
              addObjectTableSort(tableFt2, fullTime, null, stockCarSortCols, function (dataCopy) { return theadHtmlFt2 + buildStockCarTeamsBody(dataCopy); });
            } else {
              if (seriesKeyTeams === 'f1') {
                teamsFulltimeBody.innerHTML = buildOpenWheelTeamsBody(fullTime);
              } else {
                teamsFulltimeBody.innerHTML = fullTime.map(teamRow).join('');
              }
              addObjectTableSort(fulltimeWrap.querySelector('.data-table'), fullTime, seriesKeyTeams === 'f1' ? null : teamRow, [null, 'manufacturer', 'team', 'number', 'driver', 'crew_chief'], seriesKeyTeams === 'f1' ? function (dataCopy) { return buildOpenWheelTeamsBody(dataCopy); } : null);
            }
          }
          if (teamsParttimeBody && partTime.length > 0) {
            if (isStockCarSeriesTeams) {
              var tablePt = parttimeWrap.querySelector('.data-table');
              var theadHtmlPt = stockCarTheadHtml;
              tablePt.innerHTML = theadHtmlPt + buildStockCarTeamsBody(partTime);
              tablePt.classList.add('stockcar-teams-table');
              addObjectTableSort(tablePt, partTime, null, stockCarSortCols, function (dataCopy) { return theadHtmlPt + buildStockCarTeamsBody(dataCopy); });
            } else {
              if (seriesKeyTeams === 'f1') {
                teamsParttimeBody.innerHTML = buildOpenWheelTeamsBody(partTime);
              } else {
                teamsParttimeBody.innerHTML = partTime.map(partTimeRow).join('');
              }
              addObjectTableSort(parttimeWrap.querySelector('.data-table'), partTime, seriesKeyTeams === 'f1' ? null : partTimeRow, [null, 'manufacturer', 'team', 'number', 'driver', 'crew_chief'], seriesKeyTeams === 'f1' ? function (dataCopy) { return buildOpenWheelTeamsBody(dataCopy); } : null);
            }
          }
        } else {
          if (fulltimeWrap) fulltimeWrap.classList.add('hidden');
          if (parttimeWrap) parttimeWrap.classList.add('hidden');
          var parttimeTitleElse = document.getElementById('teams-parttime-title');
          if (parttimeTitleElse) parttimeTitleElse.classList.add('hidden');
          var fulltimeTitleElse = document.getElementById('teams-fulltime-title');
          if (fulltimeTitleElse) fulltimeTitleElse.classList.add('hidden');
          document.getElementById('teams-table-wrap').classList.toggle('hidden', teams.length === 0);
          if (teams.length > 0) {
            var teamsTableBody = document.querySelector('#teams-table tbody');
            if (isStockCarSeriesTeams) {
              var tableSingle = document.getElementById('teams-table-wrap').querySelector('.data-table');
              var theadHtmlSingle = stockCarTheadHtml;
              tableSingle.innerHTML = theadHtmlSingle + buildStockCarTeamsBody(teams);
              tableSingle.classList.add('stockcar-teams-table');
              addObjectTableSort(tableSingle, teams, null, stockCarSortCols, function (dataCopy) { return theadHtmlSingle + buildStockCarTeamsBody(dataCopy); });
            } else if (['f2', 'f3', 'f4_it', 'smp_f4_ru'].indexOf(seriesKeyTeams) >= 0) {
              var wrapEl = document.getElementById('teams-table-wrap');
              if (wrapEl) {
                wrapEl.innerHTML = buildEntryListTeamsTableHTML(teams, seriesKeyTeams);
                if (typeof makeSimpleTableSortable === 'function') makeSimpleTableSortable(wrapEl.querySelector('.data-table'));
              }
            } else if (seriesKeyTeams === 'f1') {
              var wrapF1 = document.getElementById('teams-table-wrap');
              if (wrapF1) {
                wrapF1.innerHTML = '<table class="data-table f1-teams-table" id="teams-table">' +
                  '<thead><tr><th>#</th><th>Team</th><th>Constructor</th><th>Chassis</th><th>Engine</th><th data-i18n="th.no">No.</th><th data-i18n="th.driver">Driver</th></tr></thead>' +
                  '<tbody>' + buildF1TeamsBody(teams) + '</tbody></table>';
                addObjectTableSort(wrapF1.querySelector('.data-table'), teams, null, [null, 'team', 'manufacturer', 'chassis', 'power_unit', 'number', 'driver'], function (dataCopy) { return buildF1TeamsBody(dataCopy); });
              }
            } else {
              if (teamsTableBody) teamsTableBody.innerHTML = teams.map(teamRow).join('');
              addObjectTableSort(document.getElementById('teams-table-wrap').querySelector('.data-table'), teams, teamRow, [null, 'manufacturer', 'team', 'number', 'driver', 'crew_chief']);
            }
          }
        }
        var carWrap = document.getElementById('car-spec-wrap');
        var carModelsWrap = document.getElementById('car-models-table-wrap');
        var carModelsTitle = carWrap && carWrap.querySelector('h4[data-i18n="specs.car_models"]');
        var techSpecWrap = document.getElementById('technical-spec-table-wrap');
        var enginesTitle = document.getElementById('engines-spec-title');
        var enginesWrap = document.getElementById('engines-spec-table-wrap');
        var homologationTitle = document.getElementById('homologation-spec-title');
        var homologationWrap = document.getElementById('homologation-spec-table-wrap');

        // F1: static Car Specs table independent of /teams response
        var seriesIdLowerForSpecs = (seriesId || '').toLowerCase();
        var isF1CurrentSeasonSpecs = seriesIdLowerForSpecs === 'f1' || seriesIdLowerForSpecs === 'f1-2026';
        if (isF1CurrentSeasonSpecs && carWrap && techSpecWrap && window.F1_2026_TECH_SPEC) {
          carWrap.classList.remove('hidden');
          if (carModelsTitle) carModelsTitle.classList.add('hidden');
          if (carModelsWrap) carModelsWrap.innerHTML = '';

          var specsPanelStatic = document.getElementById('specs-panel');
          if (specsPanelStatic) {
            var specsTitleStatic = specsPanelStatic.querySelector('h3[data-i18n="section.h3.specs"]');
            if (specsTitleStatic) specsTitleStatic.textContent = 'Technical regulations 2026';
          }
          var techSpecTitleStatic = carWrap.querySelector('h4[data-i18n="specs.tech_spec"]');
          if (techSpecTitleStatic) techSpecTitleStatic.classList.add('hidden');

          var f1SpecRows = window.F1_2026_TECH_SPEC.slice();
          var f1Sections = [];
          var currentTitleF1 = '';
          var currentRowsF1 = [];
          f1SpecRows.forEach(function (s) {
            if ((s.key || '') === '__SECTION__') {
              if (currentRowsF1.length > 0) f1Sections.push({ title: currentTitleF1, rows: currentRowsF1 });
              currentTitleF1 = s.value || '';
              currentRowsF1 = [];
            } else {
              currentRowsF1.push(s);
            }
          });
          if (currentRowsF1.length > 0) f1Sections.push({ title: currentTitleF1, rows: currentRowsF1 });

          techSpecWrap.className = 'table-wrap tech-spec-by-section';
          techSpecWrap.innerHTML = f1Sections.map(function (sec) {
            var body = sec.rows.map(function (s) {
              var key = localizeSpecKey(s.key);
              var val = localizeSpecValue(s.value);
              var cellVal = (val || '').indexOf('\n') >= 0
                ? (val || '').split('\n').map(function (p) { return esc(p); }).join('<br>')
                : esc(dash(val));
              return '<tr><td class="col-field">' + esc(dash(key)) + '</td><td class="col-spec-value">' + cellVal + '</td></tr>';
            }).join('');
            return '<h4 class="table-section-title">' + esc(sec.title) + '</h4>' +
                   '<div class="table-wrap tech-spec-section-table">' +
                     '<table class="data-table table-field-value"><tbody>' + body + '</tbody></table>' +
                   '</div>';
          }).join('');

          // Engines / Homologation section not used for F1
          if (enginesWrap) {
            enginesWrap.innerHTML = '';
            enginesWrap.classList.add('hidden');
          }
          if (enginesTitle) enginesTitle.classList.add('hidden');
          if (homologationWrap) {
            homologationWrap.innerHTML = '';
            homologationWrap.classList.add('hidden');
          }
          if (homologationTitle) homologationTitle.classList.add('hidden');

          return;
        }
        if (carWrap && data.car_models && data.car_models.length > 0) {
          carWrap.classList.remove('hidden');
          if (carModelsTitle) carModelsTitle.classList.remove('hidden');
          if (carModelsWrap) carModelsWrap.classList.add('table-wrap');
          var hasTruckBrand = data.car_models[0] && data.car_models[0].truck_brand;
          var carTable = hasTruckBrand
            ? '<table class="data-table"><thead><tr><th>' + t('th.manufacturer') + '</th><th>' + esc(t((seriesId || '').toLowerCase() === 'arca' ? 'th.car_brand' : 'th.truck_brand')) + '</th><th>' + t('th.model') + '</th></tr></thead><tbody>' + data.car_models.map(function (c) { return '<tr><td>' + esc(dash(c.manufacturer)) + '</td><td>' + esc(dash(c.truck_brand)) + '</td><td>' + esc(dash(c.model)) + '</td></tr>'; }).join('') + '</tbody></table>'
            : '<table class="data-table"><thead><tr><th>' + t('th.manufacturer') + '</th><th>' + t('th.model') + '</th></tr></thead><tbody>' + data.car_models.map(function (c) { return '<tr><td>' + esc(dash(c.manufacturer)) + '</td><td>' + esc(dash(c.model)) + '</td></tr>'; }).join('') + '</tbody></table>';
          if (carModelsWrap) {
            carModelsWrap.innerHTML = carTable;
            var carRows = hasTruckBrand
              ? data.car_models.map(function (c) { return [c.manufacturer, c.truck_brand || '', c.model]; })
              : data.car_models.map(function (c) { return [c.manufacturer, c.model]; });
            var carTbl = carModelsWrap.querySelector('.data-table');
            if (carTbl) makeTableSortable(carTbl, carRows, esc);
          }
        } else {
          if (carModelsWrap) carModelsWrap.innerHTML = '';
          if (carModelsTitle) carModelsTitle.classList.add('hidden');
        }
        if ((seriesKeyTeams === 'f3' || seriesKeyTeams === 'f2') && carWrap && carModelsWrap) {
          if (carModelsTitle) carModelsTitle.classList.add('hidden');
          carModelsWrap.classList.remove('table-wrap');
          carModelsWrap.innerHTML = seriesKeyTeams === 'f3'
            ? '<p class="specs-chassis-line">Chassis Dallara F3 2025</p>'
            : '<p class="specs-chassis-line">Chassis Dallara F2 2024</p>';
          carWrap.classList.remove('hidden');
        }
        if (carWrap && data.technical_spec && data.technical_spec.length > 0) {
          carWrap.classList.remove('hidden');
          var specHeaderFirst = ((seriesId || '').toLowerCase() === 'arca' || (seriesId || '').toLowerCase() === 'nascar_modified') ? t('th.characteristic') : t('th.field');
          var specRows = data.technical_spec.filter(function (s) {
            var keyLc = (s.key || '').toLowerCase().trim();
            if ((seriesId || '').toLowerCase() === 'supercars' &&
                (keyLc === 'engines (2026 homologation)' || keyLc === 'homologation teams (2026)')) {
              return false;
            }
            return !specKeySkip[keyLc];
          });
          var hasSpecSections = specRows.some(function (s) { return (s.key || '') === '__SECTION__'; });
          if (techSpecWrap) {
            function specCellVal(s, val) {
              if (s.key && s.key.toLowerCase().trim() === 'power output') {
                return esc(dash(val)) + '<br>' + esc('750 hp at tracks under 1.5 miles and road courses.');
              }
              return (val || '').indexOf('\n') >= 0
                ? (val || '').split('\n').map(function (p) { return esc(p); }).join('<br>')
                : esc(dash(val));
            }
            if (hasSpecSections) {
              var sections = [];
              var currentTitle = '';
              var currentRows = [];
              specRows.forEach(function (s) {
                if ((s.key || '') === '__SECTION__') {
                  if (currentRows.length > 0) sections.push({ title: currentTitle, rows: currentRows });
                  currentTitle = s.value || '';
                  currentRows = [];
                } else {
                  currentRows.push(s);
                }
              });
              if (currentRows.length > 0) sections.push({ title: currentTitle, rows: currentRows });
              techSpecWrap.className = 'table-wrap tech-spec-by-section';
              techSpecWrap.innerHTML = sections.map(function (sec) {
                var body = sec.rows.map(function (s) {
                  var key = localizeSpecKey(s.key);
                  var val = localizeSpecValue(s.value);
                  var cellVal = specCellVal(s, val);
                  return '<tr><td class="col-field">' + esc(dash(key)) + '</td><td class="col-spec-value">' + cellVal + '</td></tr>';
                }).join('');
                return '<h4 class="table-section-title">' + esc(sec.title) + '</h4><div class="table-wrap tech-spec-section-table"><table class="data-table"><thead><tr><th>' + specHeaderFirst + '</th><th>' + t('th.value') + '</th></tr></thead><tbody>' + body + '</tbody></table></div>';
              }).join('');
            } else {
              techSpecWrap.className = 'table-wrap';
              techSpecWrap.innerHTML = '<table class="data-table"><thead><tr><th>' + specHeaderFirst + '</th><th>' + t('th.value') + '</th></tr></thead><tbody>' + specRows.map(function (s) {
                var key = localizeSpecKey(s.key);
                var val = localizeSpecValue(s.value);
                var cellVal = specCellVal(s, val);
                return '<tr><td class="col-field">' + esc(dash(key)) + '</td><td>' + cellVal + '</td></tr>';
              }).join('') + '</tbody></table>';
            }
          }
          var specTbl = techSpecWrap && techSpecWrap.querySelector('.data-table');
          var specRowsForSort = hasSpecSections ? specRows.filter(function (s) { return (s.key || '') !== '__SECTION__'; }) : specRows;
          if (specTbl && specRowsForSort.length > 0 && !hasSpecSections) makeTableSortable(specTbl, specRowsForSort.map(function (s) {
            var val = localizeSpecValue(s.value);
            if (s.key && s.key.toLowerCase().trim() === 'power output') val += '\n750 hp at tracks under 1.5 miles and road courses.';
            return [localizeSpecKey(s.key), val];
          }), esc);
          if (hasSpecSections && techSpecWrap) {
            var sectionTables = techSpecWrap.querySelectorAll('.tech-spec-section-table .data-table');
            sectionTables.forEach(function (tbl, idx) {
              var start = 0;
              for (var i = 0; i < idx; i++) start += sections[i].rows.length;
              var rowsSlice = specRowsForSort.slice(start, start + (sections[idx] ? sections[idx].rows.length : 0));
              if (tbl && rowsSlice.length > 0) makeTableSortable(tbl, rowsSlice.map(function (s) {
                var val = localizeSpecValue(s.value);
                if (s.key && s.key.toLowerCase().trim() === 'power output') val += '\n750 hp at tracks under 1.5 miles and road courses.';
                return [localizeSpecKey(s.key), val];
              }), esc);
            });
          }

          // Extra Engines and Homologation tables for Supercars only
          if ((seriesId || '').toLowerCase() === 'supercars') {
            // Engines table
            if (enginesWrap) {
              enginesWrap.innerHTML = '';
              enginesWrap.classList.add('hidden');
            }
            if (enginesTitle) enginesTitle.classList.add('hidden');
            var scSpec = window.tgaSeries && window.tgaSeries.supercars;
            var scEngines = scSpec && scSpec.engines ? scSpec.engines : [];
            if (scEngines.length > 0 && enginesWrap) {
              var enginesTableHtml = '<div class="table-wrap"><table class="data-table"><thead><tr><th>Car model</th><th>Engine specification</th></tr></thead><tbody>' +
                scEngines.map(function (e) {
                  return '<tr><td>' + esc(dash(e.model)) + '</td><td>' + esc(dash(e.spec)) + '</td></tr>';
                }).join('') +
                '</tbody></table></div>';
              enginesWrap.innerHTML = enginesTableHtml;
              enginesWrap.classList.remove('hidden');
              if (enginesTitle) enginesTitle.classList.remove('hidden');
            }

            // Homologation table
            if (homologationWrap) {
              homologationWrap.innerHTML = '';
              homologationWrap.classList.add('hidden');
            }
            if (homologationTitle) homologationTitle.classList.add('hidden');
            var scHomolog = scSpec && scSpec.homologation ? scSpec.homologation : [];
            if (scHomolog.length > 0 && homologationWrap) {
              var homologTableHtml = '<div class="table-wrap"><table class="data-table"><thead><tr><th>Manufacturer</th><th>Homologating team</th></tr></thead><tbody>' +
                scHomolog.map(function (h) {
                  return '<tr><td>' + esc(dash(h.manufacturer)) + '</td><td>' + esc(dash(h.team)) + '</td></tr>';
                }).join('') +
                '</tbody></table></div>';
              homologationWrap.innerHTML = homologTableHtml;
              homologationWrap.classList.remove('hidden');
              if (homologationTitle) homologationTitle.classList.remove('hidden');
            }
          } else {
            // For other series clear extra sections if present
            if (enginesWrap) {
              enginesWrap.innerHTML = '';
              enginesWrap.classList.add('hidden');
            }
            if (enginesTitle) enginesTitle.classList.add('hidden');
            if (homologationWrap) {
              homologationWrap.innerHTML = '';
              homologationWrap.classList.add('hidden');
            }
            if (homologationTitle) homologationTitle.classList.add('hidden');
          }
        } else {
          if (techSpecWrap) techSpecWrap.innerHTML = '';
          if (carWrap && !(data.car_models && data.car_models.length > 0)) {
            carWrap.classList.add('hidden');
          }
          if (enginesWrap) {
            enginesWrap.innerHTML = '';
            enginesWrap.classList.add('hidden');
          }
          if (enginesTitle) enginesTitle.classList.add('hidden');
          if (homologationWrap) {
            homologationWrap.innerHTML = '';
            homologationWrap.classList.add('hidden');
          }
          if (homologationTitle) homologationTitle.classList.add('hidden');
        }

        // IMSA: "Classes" tab with fixed class list
        var currentSeriesSlug = (window.location.pathname.split('/')[2] || '').toLowerCase();
        if (currentSeriesSlug === 'imsa') {
          var specsPanelEl = document.getElementById('specs-panel');
          var specsTitleEl = specsPanelEl && specsPanelEl.querySelector('h3[data-i18n="section.h3.specs"]');
          if (specsTitleEl) specsTitleEl.textContent = 'Classes';

          var specsSectionEl = specsPanelEl && specsPanelEl.querySelector('.specs-section');
          // If section missing yet (e.g. IMSA without car specs) — create it
          if (specsPanelEl && !specsSectionEl) {
            specsSectionEl = document.createElement('div');
            specsSectionEl.className = 'specs-section';
            specsPanelEl.appendChild(specsSectionEl);
          }

          if (specsSectionEl) {
            var imsaWrap = document.getElementById('imsa-classes-wrap');
            var imsaClasses = [
              'Grand Touring Prototype (GTP) (LMDh and LMH)',
              'Le Mans Prototype 2 (LMP2)',
              'GT Daytona Pro (GTD Pro)',
              'GT Daytona (GTD)'
            ];
            var imsaHtml =
              '<h4 class="table-section-title">Classes</h4>' +
              '<div class="table-wrap">' +
                '<table class="data-table">' +
                  '<thead><tr><th>Class</th></tr></thead>' +
                  '<tbody>' +
                    imsaClasses.map(function (name) {
                      return '<tr><td>' + esc(name) + '</td></tr>';
                    }).join('') +
                  '</tbody>' +
                '</table>' +
              '</div>';
            if (!imsaWrap) {
              imsaWrap = document.createElement('div');
              imsaWrap.id = 'imsa-classes-wrap';
              imsaWrap.className = 'car-spec';
              specsSectionEl.appendChild(imsaWrap);
            }
            imsaWrap.innerHTML = imsaHtml;
          }
        }
      })
      .catch(function (err) {
        logger.error('Teams fetch failed', err);
        teamsEmpty.classList.remove('hidden');
      });

    fetchJSON('/api/series/' + encodeURIComponent((seriesId || '').toLowerCase()) + '/standings?_=' + Date.now())
      .then(function (data) {
        function renderStandings(dataObj) {
          var currentSeriesId = seriesId;
          var sk = (currentSeriesId || '').toLowerCase().replace(/-/g, '_');
          if (sk === 'nascar_xfinity') sk = 'noaps';
          function standingsSecondaryTitle(seriesKey) {
            return seriesKey === 'psc' ? (t('standings.guests') || 'Guest drivers') : t('standings.ineligible');
          }
          var rows = dataObj && dataObj.rows ? dataObj.rows : (Array.isArray(dataObj) ? dataObj : []);
          var classes = dataObj && dataObj.classes && Array.isArray(dataObj.classes) ? dataObj.classes : [];

          // ——— IMSA / GTWCE / ELMS / WEC / Super GT: per-class tables ———
          var isMultiClassStandings = classes.length > 0 && (
            (sk === 'imsa' && rows.length === 0) || sk === 'gtwce_end' || sk === 'gtwce_sprint' ||
            sk === 'elms' || sk === 'super_gt' || sk === 'wec'
          );
          if (isMultiClassStandings && window.TGA && window.TGA.buildImsaGtwceClassStandingsHtml) {
            var standingsWrapEl = document.getElementById('standings-wrap');
            var standingsImsaWrap = document.getElementById('standings-imsa-wrap');
            if (!standingsWrapEl || !standingsImsaWrap) {
              standingsEmpty.classList.remove('hidden');
              standingsEmpty.textContent = t('standings.empty') || 'No standings data.';
              return;
            }
            function paintMultiClassStandings(mode) {
              var modeVal = mode || (window.TGA.getStandingsMode ? window.TGA.getStandingsMode(sk) : 'driver');
              var multiClassHtml = window.TGA.buildImsaGtwceClassStandingsHtml(dataObj, sk, modeVal);
              if (!multiClassHtml) {
                standingsEmpty.classList.remove('hidden');
                standingsEmpty.textContent = t('standings.empty') || 'No standings data.';
                return;
              }
              standingsImsaWrap.innerHTML = multiClassHtml;
              standingsImsaWrap.classList.remove('hidden');
              standingsWrapEl.classList.add('hidden');
              standingsEmpty.classList.add('hidden');
              if (window.TGA.renderStandingsModeNav) {
                window.TGA.renderStandingsModeNav(sk, modeVal, paintMultiClassStandings);
              }
              syncStandingsScrollBars();
            }
            paintMultiClassStandings();
            return;
          }
          if (window.TGA && window.TGA.hideStandingsModeNav) {
            window.TGA.hideStandingsModeNav();
          }
          var standingsImsaWrapReset = document.getElementById('standings-imsa-wrap');
          if (standingsImsaWrapReset) {
            standingsImsaWrapReset.innerHTML = '';
            standingsImsaWrapReset.classList.add('hidden');
          }
          document.getElementById('standings-wrap').classList.remove('hidden');
          if (rows.length === 0) {
            standingsEmpty.classList.remove('hidden');
            standingsEmpty.textContent = t('standings.empty') || 'No standings data.';
            return;
          }
          var raceOrder = (dataObj && dataObj.race_order) ? dataObj.race_order.slice() : [];
          var completedRacesArr = (dataObj && dataObj.completed_races) ? dataObj.completed_races.slice() : [];

          // ——— NASCAR Cup: this series only — Clash filter ———
          if (sk === 'nascar_cup') {
            raceOrder = raceOrder.filter(function (code) { return String(code || '').toLowerCase() !== 'clash'; });
            completedRacesArr = completedRacesArr.filter(function (code) { return String(code || '').toLowerCase() !== 'clash'; });
          }
          var completedRacesSet = {};
          for (var cr = 0; cr < completedRacesArr.length; cr++) { completedRacesSet[completedRacesArr[cr]] = true; }

          // ——— F1 / F2 / F3 / FREC / F4: event names on top, race columns, Pts last ———
          if (sk === 'f1' || sk === 'f2' || sk === 'f3' || sk === 'frec' || sk === 'f4_it' || sk === 'smp_f4_ru' || String(currentSeriesId || '').toLowerCase().indexOf('f1-') === 0) {
            var eventNames = (dataObj && dataObj.event_names && Array.isArray(dataObj.event_names)) ? dataObj.event_names : [];
            var theadElF1 = document.getElementById('standings-thead') && document.getElementById('standings-thead').parentNode;
            var hasRaceCols = raceOrder && raceOrder.length > 0;
            var isF1SeasonView = String(currentSeriesId || '').toLowerCase().indexOf('f1-') === 0;
            if (hasRaceCols && eventNames.length >= raceOrder.length && theadElF1) {
              // For historical F1 season pages (e.g. /season/f1-2025/standings)
              // use single-row header: Pos | # | Driver | [events] | Pts.
              if (isF1SeasonView) {
                var headerRow = '<tr id="standings-thead">';
                headerRow += '<th class="col-num">' + t('th.pos') + '</th>';
                headerRow += '<th class="col-car">#</th>';
                headerRow += '<th>' + t('th.driver') + '</th>';
                for (var i = 0; i < raceOrder.length; i++) {
                  var en = eventNames[i] || '';
                  var compact = en.replace(/Grand Prix/gi, '').trim();
                  if (compact.length >= 3) {
                    en = compact.slice(0, 3).toUpperCase();
                  } else {
                    en = en.slice(0, 3).toUpperCase();
                  }
                  var rc = raceOrder[i] || '';
                  var suffix = rc.slice(-1) === 'S' ? '\u00b7S' : (rc.slice(-1) === 'F' ? '\u00b7F' : '');
                  headerRow += '<th class="col-race">' + esc(en + suffix) + '</th>';
                }
                headerRow += '<th class="col-pts">' + t('th.pts') + '</th></tr>';
                theadElF1.innerHTML = headerRow;
              } else if (sk === 'f1') {
                // Current F1 season: single-row header with three-letter event codes,
                // for sprint weekends add *S / *F suffixes from raceOrder code (RnS / RnF).
                var headerRowCurrentF1 = '<tr id="standings-thead">';
                headerRowCurrentF1 += '<th class="col-num">' + t('th.pos') + '</th>';
                headerRowCurrentF1 += '<th class="col-car">#</th>';
                headerRowCurrentF1 += '<th>' + t('th.driver') + '</th>';
                for (var ci = 0; ci < raceOrder.length; ci++) {
                  var enCur = eventNames[ci] || '';
                  var compactCur = enCur.replace(/Grand Prix/gi, '').trim();
                  if (compactCur.length >= 3) {
                    enCur = compactCur.slice(0, 3).toUpperCase();
                  } else {
                    enCur = enCur.slice(0, 3).toUpperCase();
                  }
                  var rcCode = String(raceOrder[ci] || '');
                  var spSuffix = rcCode.slice(-1) === 'S'
                    ? '*S'
                    : (rcCode.slice(-1) === 'F' ? '*F' : '');
                  headerRowCurrentF1 += '<th class="col-race">' + esc(enCur + spSuffix) + '</th>';
                }
                headerRowCurrentF1 += '<th class="col-pts">' + t('th.pts') + '</th></tr>';
                theadElF1.innerHTML = headerRowCurrentF1;
              } else {
                // Formula F2/F3/FREC — two-row header with event grouping.
                var eventRow = '';
                var prevName = null;
                var colSpan = 0;
                for (var i = 0; i < raceOrder.length; i++) {
                  var en = eventNames[i] || '';
                  if (sk === 'frec') {
                    en = String(en).replace(/^FREC\s*[—-]\s*/i, '').trim();
                  } else if (sk === 'f4_it') {
                    en = String(en).replace(/^Italian F4\s*[—-]\s*/i, '').trim();
                  } else if (sk === 'smp_f4_ru') {
                    en = String(en).replace(/^SMP F4[^—-]*[—-]\s*/i, '').trim();
                  }
                  if (en === prevName) {
                    colSpan++;
                  } else {
                    if (prevName != null) eventRow += '<th class="col-race-group" colspan="' + colSpan + '">' + esc(prevName) + '</th>';
                    prevName = en;
                    colSpan = 1;
                  }
                }
                if (prevName != null) eventRow += '<th class="col-race-group" colspan="' + colSpan + '">' + esc(prevName) + '</th>';
                var topRowF1 = '<tr class="standings-header-row-top">' +
                  '<th class="col-num" rowspan="2">' + t('th.pos') + '</th>' +
                  '<th class="col-car" rowspan="2">#</th>' +
                  '<th rowspan="2">' + t('th.driver') + '</th>' +
                  eventRow +
                  '<th class="col-pts" rowspan="2">' + t('th.pts') + '</th></tr>';
                var bottomRowF1 = '<tr id="standings-thead">';
                var useSprintFeature = (sk === 'f2' || sk === 'f3');
                var useFrecRaceLabels = (sk === 'frec' || sk === 'f4_it' || sk === 'smp_f4_ru');
                for (var j = 0; j < raceOrder.length; j++) {
                  var sub = (raceOrder[j] != null && raceOrder[j] !== undefined) ? String(raceOrder[j]).replace(/<nil>|^null$/gi, '').trim() : '';
                  var subLabel;
                  if (useSprintFeature) {
                    subLabel = (j % 2 === 0 ? (t('standings.sprint') || 'Sprint') : (t('standings.feature') || 'Feature'));
                  } else if (useFrecRaceLabels) {
                    if (sk === 'smp_f4_ru') {
                      var mSmpQ = sub.match(/-Q(\d+)$/i);
                      var mSmpR = sub.match(/-R(\d+)$/i);
                      if (mSmpQ) subLabel = 'Q' + mSmpQ[1];
                      else if (mSmpR) subLabel = 'R' + mSmpR[1];
                      else subLabel = sub || 'Race';
                    } else {
                      var mFrec = sub.match(/-(\d+)$/);
                      subLabel = mFrec && mFrec[1] ? ('R' + mFrec[1]) : (sub || 'Race');
                    }
                  } else {
                    subLabel = (sub || 'Race');
                  }
                  bottomRowF1 += '<th class="col-race">' + esc(subLabel) + '</th>';
                }
                bottomRowF1 += '</tr>';
                theadElF1.innerHTML = topRowF1 + bottomRowF1;
              }
              var racePosOnly = (window.TGA && window.TGA.standingsRacePosOnly) || function (v) { return v; };
              var stripRacePos = (sk === 'f4_it') ? racePosOnly : function (v) { return v; };
              standingsBody.innerHTML = rows.map(function (row) {
                var posDisplay = (row.pos === 0 || row.pos === null || row.pos === undefined) ? '—' : row.pos;
                var td = '<td class="col-num">' + posDisplay + '</td><td class="col-car">' + esc(dash(row.car || '—')) + '</td><td>' + driverLink(row.driver) + '</td>';
                for (var k = 0; k < raceOrder.length; k++) {
                  var raceCode = raceOrder[k];
                  var rv = (row.races && row.races[raceCode] != null) ? stripRacePos(row.races[raceCode]) : '';
                  var emptyRace = !rv || rv === '—' || rv === '-';
                  var raceCell;
                  if ((sk === 'f4_it' || sk === 'smp_f4_ru') && emptyRace) {
                    raceCell = completedRacesSet[raceCode] ? '—' : '';
                  } else {
                    raceCell = esc(dash(rv || (completedRacesSet[raceCode] ? '—' : '')));
                  }
                  td += '<td class="col-race">' + raceCell + '</td>';
                }
                td += '<td class="col-pts">' + esc(dash(row.points)) + '</td>';
                return '<tr>' + td + '</tr>';
              }).join('');
            } else {
              var thSimple = '<th class="col-num">' + t('th.pos') + '</th><th class="col-car">#</th><th>' + t('th.driver') + '</th><th class="col-pts">' + t('th.pts') + '</th>';
              if (document.getElementById('standings-thead')) document.getElementById('standings-thead').innerHTML = thSimple;
              standingsBody.innerHTML = rows.map(function (row) {
                var posDisplay = (row.pos === 0 || row.pos === null || row.pos === undefined) ? '—' : row.pos;
                return '<tr><td class="col-num">' + posDisplay + '</td><td class="col-car">' + esc(dash(row.car || '—')) + '</td><td>' + driverLink(row.driver) + '</td><td class="col-pts">' + esc(dash(row.points)) + '</td></tr>';
              }).join('');
            }
            syncStandingsScrollBars();
            var inel = dataObj && dataObj.ineligible && Array.isArray(dataObj.ineligible) ? dataObj.ineligible : [];
            if (inel.length > 0 && document.getElementById('standings-ineligible-title') && (standingsIneligibleWrap || document.getElementById('standings-ineligible-scroll-container'))) {
              document.getElementById('standings-ineligible-title').classList.remove('hidden');
              document.getElementById('standings-ineligible-title').textContent = standingsSecondaryTitle(sk);
              var inelTh = document.getElementById('standings-ineligible-thead');
              if (inelTh) {
                if (hasRaceCols && eventNames.length >= raceOrder.length) {
                  var inelH = '<th class="col-num">' + t('th.pos') + '</th><th class="col-car">#</th><th>' + t('th.driver') + '</th>';
                  for (var qi = 0; qi < raceOrder.length; qi++) {
                    var rq = (raceOrder[qi] != null && raceOrder[qi] !== undefined) ? String(raceOrder[qi]).replace(/<nil>|^null$/gi, '').trim() : '';
                    // For F1 season pages hide text in race column headers and ineligible table.
                    var rqLabel = isF1SeasonView ? '' : (rq || 'Race');
                    if (!isF1SeasonView && (sk === 'frec' || sk === 'f4_it' || sk === 'smp_f4_ru')) {
                      if (sk === 'smp_f4_ru') {
                        var mSq = rq.match(/-Q(\d+)$/i);
                        var mSr = rq.match(/-R(\d+)$/i);
                        if (mSq) rqLabel = 'Q' + mSq[1];
                        else if (mSr) rqLabel = 'R' + mSr[1];
                        else rqLabel = rq;
                      } else {
                        var mRq = rq.match(/-(\d+)$/);
                        rqLabel = mRq && mRq[1] ? ('R' + mRq[1]) : rqLabel;
                      }
                    }
                    inelH += '<th class="col-race">' + esc(rqLabel) + '</th>';
                  }
                  inelH += '<th class="col-pts">' + t('th.pts') + '</th>';
                  inelTh.innerHTML = inelH;
                } else {
                  inelTh.innerHTML = '<th class="col-num">' + t('th.pos') + '</th><th class="col-car">#</th><th>' + t('th.driver') + '</th><th class="col-pts">' + t('th.pts') + '</th>';
                }
              }
              if (standingsIneligibleBody) {
                standingsIneligibleBody.innerHTML = inel.map(function (row) {
                  var posDisplay = (row.pos === 0 || row.pos === null || row.pos === undefined) ? '—' : row.pos;
                  var td = '<td class="col-num">' + posDisplay + '</td><td class="col-car">' + esc(dash(row.car || '—')) + '</td><td>' + driverLink(row.driver) + '</td>';
                  if (hasRaceCols && row.races) {
                    for (var k = 0; k < raceOrder.length; k++) {
                      var inelCode = raceOrder[k];
                      var inelRv = stripRacePos(row.races[inelCode] || '');
                      var inelEmpty = !inelRv || inelRv === '—' || inelRv === '-';
                      var inelCell = inelEmpty
                        ? (completedRacesSet[inelCode] ? '—' : '')
                        : esc(dash(inelRv));
                      td += '<td class="col-race">' + inelCell + '</td>';
                    }
                  }
                  td += '<td class="col-pts">' + esc(dash(row.points)) + '</td>';
                  return '<tr>' + td + '</tr>';
                }).join('');
              }
            }
            return;
          }

          // ——— NASCAR Cup, NOAPS, Truck, ARCA, Modified, IndyCar, Supercars — full table (Pos, #, Driver, Team, Manufacturer, races, Pts, Stage, etc.) ———
          var theadRow = document.getElementById('standings-thead');
          var theadEl  = theadRow && theadRow.parentNode ? theadRow.parentNode : null;
          var eventNamesForStandings = (dataObj && Array.isArray(dataObj.event_names)) ? dataObj.event_names : [];
          function pscVenueAbbrev(eventName) {
            var s = String(eventName || '').toLowerCase();
            var m = s.match(/[—\-]\s*(.+)$/);
            var venue = m ? m[1].trim() : s;
            if (venue.indexOf('monaco') >= 0) return 'mon';
            if (venue.indexOf('barcelona') >= 0 || venue.indexOf('catalunya') >= 0) return 'bar';
            if (venue.indexOf('red bull') >= 0 || venue.indexOf('spielberg') >= 0) return 'rbr';
            if (venue.indexOf('spa') >= 0) return 'spa';
            if (venue.indexOf('hungar') >= 0) return 'hun';
            if (venue.indexOf('zandvoort') >= 0) return 'zan';
            if (venue.indexOf('monza') >= 0) return 'mnz';
            var word = venue.replace(/[^a-z0-9]+/gi, ' ').trim().split(/\s+/)[0] || 'r';
            return word.slice(0, 3).toLowerCase();
          }
          function raceHeaderLabel(code, idx) {
            if (!code || typeof code !== 'string') return code;
            if (sk === 'psc') {
              return pscVenueAbbrev(eventNamesForStandings[idx] || '');
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
            if (sk === 'supercars') {
              return String(code || '');
            }
            if (sk === 'dtm') {
              return String(code || '');
            }
            // Multi-race rounds (e.g. DTM: R1-1, R1-2): keep full code.
            if (String(code).indexOf('-') >= 0) {
              return String(code);
            }
            var label = code.replace(/\d+$/, '') || code;
            if (lang === 'ru') label = label.replace(/^R(\d*)$/i, 'Р$1');
            return label;
          }
          var manufacturerLabel = sk === 'nascar_modified'
            ? t('th.chassis')
            : (sk === 'indycar' ? t('th.engine') : t('th.manufacturer'));
          var includeManufacturer = (sk !== 'super_formula' && sk !== 'psc');
          var hasCar    = rows.some(function (r) { return r.car; });
          var hasWth    = rows.some(function (r) { return r.wth; });
          var hasStatus = rows.some(function (r) { return r.status; });
          var supportsStages = (sk === 'nascar_cup' || sk === 'noaps' || sk === 'nascar_truck');
          var hasStages = supportsStages && rows.some(function (r) {
            if (r.stages == null) return false;
            var s = String(r.stages).trim();
            return s !== '' && s !== '0' && s !== '—';
          });
          // carOff = column index offset due to Car column
          var carOff = hasCar ? 1 : 0;
          var th = '<th class="col-num">' + t('th.pos') + '</th>';
          if (hasCar) th += '<th class="col-car">' + t('th.no') + '</th>';
          th += '<th>' + t('th.driver') + '</th><th>' + t('th.team') + '</th>';
          if (includeManufacturer) th += '<th>' + esc(manufacturerLabel) + '</th>';
          for (var i = 0; i < raceOrder.length; i++) {
            th += '<th class="col-race">' + esc(raceHeaderLabel(raceOrder[i], i)) + '</th>';
          }
          if (hasStages) th += '<th>' + t('th.stage_col') + '</th>';
          if (hasWth)    th += '<th>' + t('th.wth') + '</th>';
          if (hasStatus) th += '<th>' + t('th.status') + '</th>';
          th += '<th class="col-pts">' + t('th.pts') + '</th>';

          // Supercars: two-row header with Sydney events (1–3) and Melbourne (4–7)
          if (theadEl && sk === 'supercars' &&
              raceOrder.length > 0 &&
              raceOrder.every(function (code) { return /^(SMP|MLB)\d+$/i.test(String(code || '')); })) {
            var supercarsEventHref = '/event/supercars-2026-1/race';
            var sydneyCount = 3;
            var melbourneCount = raceOrder.length - sydneyCount;
            if (melbourneCount < 1) melbourneCount = 0;
            sydneyCount = Math.min(sydneyCount, raceOrder.length);

            var topRow = '<tr class="standings-header-row-top">';
            topRow += '<th class="col-num" rowspan="2">' + t('th.pos') + '</th>';
            if (hasCar) topRow += '<th class="col-car" rowspan="2">' + t('th.no') + '</th>';
            topRow += '<th rowspan="2">' + t('th.driver') + '</th>';
            topRow += '<th rowspan="2">' + t('th.team') + '</th>';
            topRow += '<th rowspan="2">' + esc(manufacturerLabel) + '</th>';
            if (sydneyCount > 0) topRow += '<th class="col-race-group" colspan="' + sydneyCount + '">Sydney</th>';
            if (melbourneCount > 0) topRow += '<th class="col-race-group supercars-stage-divider" colspan="' + melbourneCount + '">Melbourne</th>';
            if (hasStages) topRow += '<th rowspan="2">' + t('th.stage_col') + '</th>';
            if (hasWth)    topRow += '<th rowspan="2">' + t('th.wth') + '</th>';
            if (hasStatus) topRow += '<th rowspan="2">' + t('th.status') + '</th>';
            topRow += '<th class="col-pts" rowspan="2">' + t('th.pts') + '</th></tr>';

            var bottomRow = '<tr id="standings-thead">';
            for (var j = 0; j < raceOrder.length; j++) {
              var code = String(raceOrder[j] || '');
              var num = code.replace(/^(SMP|MLB)/i, '') || (j + 1);
              var divClass = (j === sydneyCount && melbourneCount > 0) ? ' col-race supercars-stage-divider' : ' col-race';
              bottomRow += '<th class="' + divClass.trim() + '"><a href="' + supercarsEventHref + '" class="standings-race-link">' + esc(num) + '</a></th>';
            }
            bottomRow += '</tr>';

            theadEl.innerHTML = topRow + bottomRow;
            theadRow = document.getElementById('standings-thead');
          } else if (theadEl) {
            // For all other series always reset thead to single row,
            // so Supercars group headers (Sydney/Melbourne) do not remain.
            theadEl.innerHTML = '<tr id="standings-thead"></tr>';
            theadRow = document.getElementById('standings-thead');
            theadRow.innerHTML = th;
          }
        function renderStandingsRows(list) {
          standingsBody.innerHTML = list.map(function (row) {
            var posDisplay = (row.pos === 0 || row.pos === null || row.pos === undefined) ? '—' : row.pos;
              var td = '<td class="col-num">' + posDisplay + '</td>';
              if (hasCar) td += '<td class="col-car">' + esc(dash(row.car)) + '</td>';
              td += '<td>' + driverLink(row.driver) + '</td><td>' + esc(dash(row.team)) + '</td>';
              if (includeManufacturer) td += '<td>' + esc(dash(row.manufacturer)) + '</td>';
            for (var j = 0; j < raceOrder.length; j++) {
                var rval = row.races && row.races[raceOrder[j]] ? String(row.races[raceOrder[j]]).trim() : '';
                var emptyStage = !rval || rval === '—' || rval === '-';
                var raceCode = raceOrder[j];
                var isCompleted = completedRacesSet[raceCode];
                var raceCell = !emptyStage ? (rval.indexOf('*') >= 0
                  ? esc(rval.slice(0, rval.indexOf('*'))) + '<sup class="stage-pts">' + esc(rval.slice(rval.indexOf('*'))) + '</sup>'
                  : esc(rval)) : (isCompleted ? '—' : '');
                td += '<td class="col-race">' + raceCell + '</td>';
              }
              if (hasStages) td += '<td>' + esc(dash(row.stages)) + '</td>';
              if (hasWth)    td += '<td>' + esc(dash(row.wth)) + '</td>';
              if (hasStatus) td += '<td>' + esc(dash(row.status)) + '</td>';
              td += '<td class="col-pts">' + esc(dash(row.points)) + '</td>';
            return '<tr>' + td + '</tr>';
          }).join('');
        }
        renderStandingsRows(rows);
        var rowsCopy = rows.slice();
        var stThs = theadRow ? theadRow.querySelectorAll('th') : [];

          // Column order: pos, [car], driver, team, [manufacturer], races..., stage?, wth?, status?, pts (last)
          var stageOff = hasStages ? 1 : 0;
          var wthOff = hasWth ? 1 : 0;
          var statusOff = hasStatus ? 1 : 0;
          var manuOff = includeManufacturer ? 1 : 0;
          var baseAfterRaces = 3 + carOff + manuOff + raceOrder.length;
          var ptsColIndex = baseAfterRaces + stageOff + wthOff + statusOff;
          function getStandingVal(row, colIndex) {
            var raceIdx = colIndex - (3 + carOff + manuOff);
            if (colIndex === 0)                               return row.pos || 0;
            if (hasCar && colIndex === 1)                     return row.car || '';
            if (colIndex === 1 + carOff)                      return row.driver || '';
            if (colIndex === 2 + carOff)                      return row.team || '';
            if (includeManufacturer && colIndex === 3 + carOff) return row.manufacturer || '';
            if (raceIdx >= 0 && raceIdx < raceOrder.length)  return (row.races && row.races[raceOrder[raceIdx]]) || '';
            if (hasStages && colIndex === baseAfterRaces)     return row.stages || '';
            if (hasWth && colIndex === baseAfterRaces + stageOff) return row.wth || '';
            if (hasStatus && colIndex === baseAfterRaces + stageOff + wthOff) return row.status || '';
            if (colIndex === ptsColIndex)                     return row.points || '';
            return '';
          }

          function isEmpty(v) { return v === '' || v === '—' || v == null || v === 0; }

          // Numeric value for position/points columns (strip *N annotation)
          function numVal(v) {
            if (v == null || v === '' || v === '—') return null;
            var s = String(v).replace(/\*.*$/, '').trim();
            var n = parseFloat(s);
            return isNaN(n) ? null : n;
          }

          // Numeric columns: pos, race results, points (last column)
          function isNumericCol(colIndex) {
            if (colIndex === 0) return true;
            var raceIdx = colIndex - (3 + carOff + manuOff);
            if (raceIdx >= 0 && raceIdx < raceOrder.length) return true;
            if (colIndex === ptsColIndex) return true;
            return false;
          }

        for (var c = 0; c < stThs.length; c++) {
          (function (colIndex) {
            var dir = 1;
            stThs[colIndex].classList.add('sortable');
            stThs[colIndex].addEventListener('click', function () {
                var numeric = isNumericCol(colIndex);
              rowsCopy.sort(function (a, b) {
                  var va = getStandingVal(a, colIndex);
                  var vb = getStandingVal(b, colIndex);
                  // Empty/dash — always at end (regardless of direction)
                  var ae = isEmpty(va), be = isEmpty(vb);
                  if (ae && be) return 0;
                  if (ae) return 1;
                  if (be) return -1;
                  if (numeric) {
                    var na = numVal(va), nb = numVal(vb);
                    if (na !== null && nb !== null) return dir * (na - nb);
                  }
                return dir * String(va).localeCompare(String(vb), undefined, { numeric: true });
              });
                [].forEach.call(stThs, function (th) { th.classList.remove('sort-asc', 'sort-desc'); });
                stThs[colIndex].classList.add(dir === 1 ? 'sort-asc' : 'sort-desc');
              dir = -dir;
              renderStandingsRows(rowsCopy);
            });
          })(c);
        }
        syncStandingsScrollBars();
          var ineligible = dataObj && dataObj.ineligible && Array.isArray(dataObj.ineligible) ? dataObj.ineligible : [];
          var ineligibleFullFormat = ineligible.length > 0 && ineligible[0] && ineligible[0].driver !== undefined && ineligible[0].races !== undefined;
          var ineligibleScrollContainer = document.getElementById('standings-ineligible-scroll-container');
          if ((standingsIneligibleWrap || ineligibleScrollContainer) && document.getElementById('standings-ineligible-title')) {
            if (ineligible.length > 0) {
              document.getElementById('standings-ineligible-title').classList.remove('hidden');
              document.getElementById('standings-ineligible-title').textContent = standingsSecondaryTitle(sk);
              if (ineligibleScrollContainer) ineligibleScrollContainer.classList.remove('hidden');
              if (ineligibleFullFormat) {
                var ineligibleThead = document.getElementById('standings-ineligible-thead');
                if (ineligibleThead) ineligibleThead.innerHTML = th;
                if (standingsIneligibleBody) {
                  standingsIneligibleBody.innerHTML = ineligible.map(function (row) {
                    var posDisplay = (row.pos === 0 || row.pos === null || row.pos === undefined) ? '—' : row.pos;
                    var td = '<td class="col-num">' + posDisplay + '</td>';
                    if (hasCar) td += '<td class="col-car">' + esc(dash(row.car)) + '</td>';
                    td += '<td>' + driverLink(row.driver) + '</td><td>' + esc(dash(row.team)) + '</td>';
                    if (includeManufacturer) td += '<td>' + esc(dash(row.manufacturer)) + '</td>';
                    for (var j = 0; j < raceOrder.length; j++) {
                      var rval = row.races && row.races[raceOrder[j]] ? String(row.races[raceOrder[j]]).trim() : '';
                      var emptyStage = !rval || rval === '—' || rval === '-';
                      var raceCode = raceOrder[j];
                      var isCompleted = completedRacesSet[raceCode];
                      var raceCell = !emptyStage ? (rval.indexOf('*') >= 0 ? esc(rval.slice(0, rval.indexOf('*'))) + '<sup class="stage-pts">' + esc(rval.slice(rval.indexOf('*'))) + '</sup>' : esc(rval)) : (isCompleted ? '—' : '');
                      td += '<td class="col-race">' + raceCell + '</td>';
                    }
                    td += '<td class="col-pts">' + esc(dash(row.points)) + '</td>';
                    if (hasStages) td += '<td>' + esc(dash(row.stages)) + '</td>';
                    if (hasWth) td += '<td>' + esc(dash(row.wth)) + '</td>';
                    if (hasStatus) td += '<td>' + esc(dash(row.status)) + '</td>';
                    return '<tr>' + td + '</tr>';
                  }).join('');
                }
              } else if (standingsIneligibleBody) {
                standingsIneligibleBody.innerHTML = ineligible.map(function (row) {
                  return '<tr><td>' + esc(dash(row.team)) + '</td><td>' + esc(dash(row.manufacturer)) + '</td><td>' + esc(dash(row.status)) + '</td></tr>';
                }).join('');
                var ineligibleThead = document.getElementById('standings-ineligible-thead');
                if (ineligibleThead) ineligibleThead.innerHTML = '<th data-i18n="th.team">Team</th><th data-i18n="th.manufacturer">Manufacturer</th><th data-i18n="th.status">Status</th>';
              }
            } else {
              document.getElementById('standings-ineligible-title').classList.add('hidden');
              if (ineligibleScrollContainer) ineligibleScrollContainer.classList.add('hidden');
              if (standingsIneligibleBody) standingsIneligibleBody.innerHTML = '';
            }
          }
        }

        var seriesKey = (seriesId || '').toLowerCase();

        // For NASCAR Cup — DAY column must exclude Clash.
        if (seriesKey === 'nascar_cup') {
          return rebuildNascarCupDayFromDaytona(data).then(function (customData) {
            renderStandings(customData || { rows: [] });
          }).catch(function () {
            renderStandings(data);
          });
        }

        // Supercars: enrich team and manufacturer from /series/supercars/teams
        if (seriesKey === 'supercars') {
          fetchJSON('/api/series/supercars/teams').then(function (teamsResp) {
            var teams = (teamsResp && teamsResp.teams) ? teamsResp.teams : [];
            var byCar = {};
            teams.forEach(function (t) {
              if (t.number != null) byCar[String(t.number)] = { team: t.team, manufacturer: t.manufacturer };
            });
            (data.rows || []).forEach(function (row) {
              var m = byCar[String(row.car)];
              if (m) {
                if (m.team) row.team = m.team;
                if (m.manufacturer) row.manufacturer = m.manufacturer;
              }
            });
            renderStandings(data);
          }).catch(function () {
            renderStandings(data);
          });
          return;
        }

        // Super GT: split standings into GT500 / GT300 tables by car class
        // from the latest event entry list.
        if (seriesKey === 'super_gt' || seriesKey === 'super-gt') {
          fetchJSON('/api/series/super_gt/events')
            .then(function (eventsList) {
              var events = Array.isArray(eventsList) ? eventsList : [];
              if (!events.length) return null;
              events.sort(function (a, b) {
                var da = String(a.end_date || a.start_date || a.date || '');
                var db = String(b.end_date || b.start_date || b.date || '');
                return da < db ? 1 : da > db ? -1 : 0;
              });
              // Pick first event that actually has detail JSON available.
              function tryFetchEventDetail(idx) {
                if (idx >= events.length) return Promise.resolve(null);
                var ev = events[idx] || {};
                if (ev.has_detail === false) return tryFetchEventDetail(idx + 1);
                var eventApiId = String(ev.id || '').toLowerCase();
                if (!eventApiId) return tryFetchEventDetail(idx + 1);
                return fetchJSON('/api/events/' + encodeURIComponent(eventApiId) + '?_=' + Date.now())
                  .then(function (detail) { return detail; })
                  .catch(function () { return tryFetchEventDetail(idx + 1); });
              }
              return tryFetchEventDetail(0);
            })
            .then(function (detailResp) {
              if (!detailResp || typeof detailResp !== 'object') return null;
              var detail = detailResp;
              if (detail.data && typeof detail.data === 'object') detail = detail.data;
              if (detail.event && typeof detail.event === 'object') detail = detail.event;
              var entryList = Array.isArray(detail.entry_list) ? detail.entry_list : [];
              if (!entryList.length) return null;
              var classByCar = {};
              entryList.forEach(function (e) {
                var no = String((e && e.number) || '').trim();
                var cls = String((e && e.class) || '').trim().toUpperCase();
                if (!no || !cls) return;
                classByCar[no] = cls;
              });
              return classByCar;
            })
            .then(function (classByCar) {
              var rowsSrc = (data && data.rows && Array.isArray(data.rows)) ? data.rows : [];
              if (!classByCar || !rowsSrc.length) {
                renderStandings(data);
                return;
              }
              var gt500Rows = [];
              var gt300Rows = [];
              rowsSrc.forEach(function (row) {
                var no = String((row && row.car) || '').trim();
                var cls = classByCar[no];
                if (cls === 'GT500') gt500Rows.push(row);
                else if (cls === 'GT300') gt300Rows.push(row);
              });
              if (!gt500Rows.length && !gt300Rows.length) {
                renderStandings(data);
                return;
              }
              var dataForClasses = Object.assign({}, data, {
                classes: [
                  { id: 'GT500', name: 'GT500', rows: gt500Rows },
                  { id: 'GT300', name: 'GT300', rows: gt300Rows }
                ]
              });
              renderStandings(dataForClasses);
            })
            .catch(function () {
              renderStandings(data);
            });
          return;
        }

        renderStandings(data);
      })
      .catch(function () { standingsEmpty.classList.remove('hidden'); standingsEmpty.textContent = t('standings.empty') || 'No standings data.'; });

    if (statsPanel && hasStats && subPath === 'stats') {
      var statsUrl = '/api/series/' + encodeURIComponent((seriesId || '').toLowerCase()) + '/stats';
      var teamStatsWrap = document.getElementById('team-stats-wrap');

      // ─── Simplified F1 render (bypasses complex legacy render) ────────────────
      var sidLowerForStats = (seriesId || '').toLowerCase();
      var isF1LikeStats = sidLowerForStats === 'f1' || sidLowerForStats.indexOf('f1-') === 0;
      if (isF1LikeStats) {
        if (teamStatsWrap) teamStatsWrap.classList.add('hidden');
        function fmtNumF1(v, digits) {
          if (v == null || v === '') return '—';
          var num = typeof v === 'number' ? v : parseFloat(String(v));
          if (!isFinite(num)) return String(v);
          return typeof digits === 'number' ? num.toFixed(digits) : String(num);
        }

        function escHtmlF1(s) {
          return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        }

        fetchJSON(statsUrl)
          .then(function (data) {
            var rows = data && data.rows ? data.rows : (Array.isArray(data) ? data : []);
            var table = document.getElementById('stats-table');
            if (!table) return;
            var thead = table.querySelector('thead tr');
            var tbody = table.querySelector('tbody');
            if (!thead || !tbody) return;

            if (!rows || rows.length === 0) {
              tbody.innerHTML = '';
              if (statsEmpty) statsEmpty.classList.remove('hidden');
              return;
            }

            // For F1 2025 season page use correct 2025 chassis:
            // driver name → chassis mapping from F1_2025_CHASSIS_BY_DRIVER.
            var isF12025SeasonStats =
              sidLowerForStats === 'f1-2025' ||
              (sidLowerForStats === 'f1' && window.location && window.location.pathname.indexOf('/season/f1-2025') >= 0);
            if (isF12025SeasonStats &&
                window.TGA &&
                typeof window.TGA.F1_2025_CHASSIS_BY_DRIVER === 'object' &&
                window.TGA.F1_2025_CHASSIS_BY_DRIVER) {
              var chassisByDriver = window.TGA.F1_2025_CHASSIS_BY_DRIVER;
              rows.forEach(function (row) {
                var drv = String(row.driver || '').trim();
                if (!drv) return;
                var ch = chassisByDriver[drv];
                if (ch) {
                  row.chassis = ch;
                }
                // Normalize team name Alpine → Alpine-Renault for F1 2025.
                if (String(row.team || '').trim() === 'Alpine') {
                  row.team = 'Alpine-Renault';
                }
              });
            }

            if (statsEmpty) statsEmpty.classList.add('hidden');

            thead.innerHTML =
              '<th>Pos</th>' +
              '<th>#</th>' +
              '<th>Driver</th>' +
              '<th>Team</th>' +
              '<th>Starts</th>' +
              '<th>Wins</th>' +
              '<th>Top-2</th>' +
              '<th>Top-3</th>' +
              '<th>Podiums</th>' +
              '<th>Top-5</th>' +
              '<th>Top-10</th>' +
              '<th>Avg. Start</th>' +
              '<th>Avg. Qualifying</th>' +
              '<th>Poles</th>' +
              '<th>Avg. Finish</th>' +
              '<th>Q2</th>' +
              '<th>Q3</th>' +
              '<th>Laps Led</th>' +
              '<th>Laps Completed</th>';

            var html = rows.map(function (row, idx) {
              var pos = idx + 1;
              var car = row.car || '';
              var driver = row.driver || '';
              var team = row.team || '';
              var races = row.races || 0;
              var wins = row.wins || 0;
              var podiums = row.podiums || 0;
              var top5 = row.top5 || 0;
              var top10 = row.top10 || 0;
              // Avg. Start / Avg. Finish: dash if no data (null/empty/0).
              var hasStart = row.avg_start != null && row.avg_start !== '' && row.avg_start !== 0;
              var avgStart = hasStart ? fmtNumF1(row.avg_start, 2) : '—';
              var hasFinish = row.avg_finish != null && row.avg_finish !== '' && row.avg_finish !== 0;
              var avgFinish = hasFinish ? fmtNumF1(row.avg_finish, 2) : '—';
              // Avg. Qualifying: show number for everyone with qualifying;
              // dash only if driver did not participate at all (null/empty).
              var hasQual = row.avg_qualifying != null && row.avg_qualifying !== '';
              var avgQual = hasQual ? fmtNumF1(row.avg_qualifying, 2) : '—';
              var poles = row.poles != null ? row.poles : 0;
              var q2 = row.q2_passes || 0;
              var q3 = row.q3_passes || 0;
              var lapsLed = row.laps_led || 0;
              var lapsCompleted = row.laps_completed != null ? row.laps_completed : '—';
              var top2 = row.top2 || 0;
              var top3 = row.top3 || 0;

              return '' +
                '<tr>' +
                  '<td class="col-num">' + pos + '</td>' +
                  '<td class="col-car">' + escHtmlF1(car) + '</td>' +
                  '<td>' + driverLink(driver) + '</td>' +
                  '<td>' + teamLink(team) + '</td>' +
                  '<td>' + races + '</td>' +
                  '<td>' + wins + '</td>' +
                  '<td>' + top2 + '</td>' +
                  '<td>' + top3 + '</td>' +
                  '<td>' + podiums + '</td>' +
                  '<td>' + top5 + '</td>' +
                  '<td>' + top10 + '</td>' +
                  '<td>' + avgStart + '</td>' +
                  '<td>' + avgQual + '</td>' +
                  '<td>' + poles + '</td>' +
                  '<td>' + avgFinish + '</td>' +
                  '<td>' + q2 + '</td>' +
                  '<td>' + q3 + '</td>' +
                  '<td>' + lapsLed + '</td>' +
                  '<td>' + lapsCompleted + '</td>' +
                '</tr>';
            }).join('');

            tbody.innerHTML = html;
            // Enable simple column sorting for F1 driver stats.
            if (typeof makeSimpleTableSortable === 'function') {
              makeSimpleTableSortable(table);
            }

            // Manufacturer Stats for F1: fill from data.manufacturers.
            var manRows = data && data.manufacturers ? data.manufacturers : [];
            var manTable = document.getElementById('manufacturer-stats-table');
            var manEmpty = document.getElementById('manufacturer-stats-empty');
            var manWrap = document.getElementById('manufacturer-stats-wrap');
            if (manWrap) manWrap.classList.remove('hidden');
            if (manTable && manRows.length > 0) {
              var manTbody = manTable.querySelector('tbody');
              if (manTbody) {
                if (manEmpty) manEmpty.classList.add('hidden');
                manTbody.innerHTML = manRows.map(function (row, idx) {
                  var avgStart = (row.avg_start == null || row.avg_start === 0) ? '—' : fmtNumF1(row.avg_start, 2);
                  var avgQual = (row.avg_qualifying == null || row.avg_qualifying === 0 || row.avg_qualifying === '') ? '—' : fmtNumF1(row.avg_qualifying, 2);
                  var avgFinish = (row.avg_finish == null || row.avg_finish === 0) ? '—' : fmtNumF1(row.avg_finish, 2);
                  return '<tr>' +
                    '<td class="col-num">' + (idx + 1) + '</td>' +
                    '<td>' + escHtmlF1(row.manufacturer || '') + '</td>' +
                    '<td>' + (row.races || 0) + '</td>' +
                    '<td>' + (row.wins || 0) + '</td>' +
                    '<td>' + (row.top2 || 0) + '</td>' +
                    '<td>' + (row.top3 || 0) + '</td>' +
                    '<td>' + (row.podiums != null ? row.podiums : (row.wins || 0) + (row.top2 || 0) + (row.top3 || 0)) + '</td>' +
                    '<td>' + (row.top5 || 0) + '</td>' +
                    '<td>' + (row.top10 || 0) + '</td>' +
                    '<td>' + avgStart + '</td>' +
                    '<td>' + avgQual + '</td>' +
                    '<td>' + avgFinish + '</td>' +
                    '<td>' + (row.q2_passes != null ? row.q2_passes : 0) + '</td>' +
                    '<td>' + (row.q3_passes != null ? row.q3_passes : 0) + '</td>' +
                    '<td>' + (row.laps_led || 0) + '</td>' +
                    '<td>' + (row.laps_completed != null ? row.laps_completed : '—') + '</td>' +
                    '</tr>';
                }).join('');
                // Enable simple column sorting for F1 manufacturer stats.
                if (typeof makeSimpleTableSortable === 'function') {
                  makeSimpleTableSortable(manTable);
                }
              }
            } else {
              if (manEmpty) manEmpty.classList.remove('hidden');
              if (manTable) {
                var mt = manTable.querySelector('tbody');
                if (mt) mt.innerHTML = '';
              }
            }
          })
          .catch(function (err) {
            logger.error('F1 stats render failed', err);
            if (statsEmpty) statsEmpty.classList.remove('hidden');
          });

        // Exit early for F1 to avoid legacy complex render below.
        return;
      }

      // More patient retry: up to ~10 seconds wait (for other series).
      var maxStatsAttempts = 10;
      var statsRetryDelayMs = 1000;

      function loadStats(attempt) {
        if (teamStatsWrap) teamStatsWrap.classList.remove('hidden');
        fetchJSON(statsUrl)
        .then(function (data) {
          var rows = data && data.rows ? data.rows : (Array.isArray(data) ? data : []);
          var tbody = document.querySelector('#stats-table tbody');
          if (!rows || rows.length === 0) {
            if (tbody) tbody.innerHTML = '';
            // If stats not ready yet (import/aggregation lag) —
            // retry a few times with short delay before showing "no data".
            if (attempt + 1 < maxStatsAttempts) {
              setTimeout(function () { loadStats(attempt + 1); }, statsRetryDelayMs);
            } else if (statsEmpty) {
              statsEmpty.classList.remove('hidden');
            }
            return;
          }
          if (!statsPanel) return;
          if (!tbody) return;
          if (statsEmpty) statsEmpty.classList.add('hidden');

          var seriesKeyStats = (seriesId || '').toLowerCase();

          // Supercars: substitute teams and manufacturer from /series/supercars/teams
          if (seriesKeyStats === 'supercars') {
            fetchJSON('/api/series/supercars/teams').then(function (teamsResp) {
              var teams = (teamsResp && teamsResp.teams) ? teamsResp.teams : [];
              var byCar = {};
              teams.forEach(function (t) {
                if (t.number != null) byCar[String(t.number)] = { team: t.team, manufacturer: t.manufacturer };
              });
              rows.forEach(function (row) {
                var m = byCar[String(row.car)];
                if (m) {
                  if (m.team) row.team = m.team;
                  if (m.manufacturer) row.manufacturer = m.manufacturer;
                }
              });
              renderStatsInner();
            }).catch(function () { renderStatsInner(); });
            return;
          }
          renderStatsInner();

          function renderStatsInner() {
          function setupMinStartsSelect(selectEl, kind) {
            if (!selectEl) return;

            var config = null;
            if (seriesKeyStats === 'nascar_cup' || seriesKeyStats === 'noaps') {
              config = [5, 10, 20, 30];
            } else if (seriesKeyStats === 'nascar_truck') {
              config = [5, 10, 20];
            } else if (seriesKeyStats === 'arca' || seriesKeyStats === 'nascar_modified') {
              config = [5, 10];
            }

            if (!config) {
              // For other series temporarily hide minimum starts filter.
              var labelEl = selectEl.parentNode;
              if (selectEl.closest) {
                var closestLabel = selectEl.closest('label');
                if (closestLabel) labelEl = closestLabel;
              }
              if (labelEl && labelEl.style) {
                labelEl.style.display = 'none';
              }
              return;
            }

            var allLabel = 'All starts';

            var optionsHtml = '<option value="0">' + allLabel + '</option>' +
              config.map(function (v) {
                return '<option value="' + v + '">' + v + '+ starts</option>';
              }).join('');
            selectEl.innerHTML = optionsHtml;
          }

          function fmtNum(v, digits) {
            if (v == null) return '—';
            var num = typeof v === 'number' ? v : parseFloat(String(v));
            if (!isFinite(num)) return String(v);
            if (typeof digits === 'number') return num.toFixed(digits);
            return String(num);
          }

          // Prepare object array for sorting and render.
          // For F1 use single template for current and historical seasons (f1-YYYY).
          var isF1Stats = (seriesKeyStats === 'f1' || seriesKeyStats.indexOf('f1-') === 0);
          // Force-enable F1 template for f1-2025 season page.
          if (!isF1Stats && window.location && window.location.pathname.indexOf('/season/f1-2025/') === 0) {
            isF1Stats = true;
          }
          var statsRows = rows.map(function (row, idx) {
            var r = {
              pos: idx + 1,
              car: row.car || '',
              driver: row.driver || '',
              team: row.team || '',
              manufacturer: row.manufacturer || '',
              chassis: row.chassis || '',
              races: row.races || 0,
              wins: row.wins || 0,
              top2: row.top2 || 0,
              top3: row.top3 || 0,
              podiums: row.podiums != null ? row.podiums : (row.wins || 0) + (row.top2 || 0) + (row.top3 || 0),
              poles: row.poles || 0,
              top5: row.top5 || 0,
              top10: row.top10 || 0,
              top15: row.top15 || 0,
              top20: row.top20 || 0,
              fastest_laps: row.fastest_laps || 0,
              avg_start: row.avg_start,
              avg_qualifying: row.avg_qualifying,
              avg_finish: row.avg_finish,
              q2_passes: row.q2_passes != null ? row.q2_passes : 0,
              q3_passes: row.q3_passes != null ? row.q3_passes : 0,
              stage_wins: row.stage_wins || 0,
              stage_points: row.stage_points || 0,
              avg_stage_points: row.avg_stage_points,
              laps_led: row.laps_led || 0,
              laps_completed: row.laps_completed != null ? row.laps_completed : 0,
              laps_completed_pct: row.laps_completed_pct,
              pos_diff: row.pos_diff
            };
            return r;
          });

          var statsFilterInput = document.getElementById('stats-filter');
          var statsMinStartsSelect = document.getElementById('stats-min-starts');
          setupMinStartsSelect(statsMinStartsSelect, 'driver');

          function passesStatsFilter(row) {
            var minStarts = 0;
            if (statsMinStartsSelect && statsMinStartsSelect.value) {
              var parsed = parseInt(statsMinStartsSelect.value, 10);
              if (!isNaN(parsed) && parsed > 0) minStarts = parsed;
            }
            if (minStarts && (row.races || 0) < minStarts) return false;
            var q = statsFilterInput && statsFilterInput.value
              ? statsFilterInput.value.trim().toLowerCase()
              : '';
            if (!q) return true;
            var haystack = [
              row.driver || '',
              row.team || '',
              row.manufacturer || ''
            ].join(' ').toLowerCase();
            return haystack.indexOf(q) !== -1;
          }

          function renderStatsTable(dataArray) {
            var filtered = dataArray.filter(passesStatsFilter);
            var avgStartFmt = function (row) {
              return (row.avg_start == null || row.avg_start === 0 || row.avg_start === '0') ? '—' : fmtNum(row.avg_start, 2);
            };
            var avgFinishFmt = function (row) { return fmtNum(row.avg_finish, 2); };
            var lapsPct = function (row) { return row.laps_completed_pct != null ? fmtNum(row.laps_completed_pct, 1) + '%' : '—'; };
            var posDiff = function (row) { return row.pos_diff != null ? fmtNum(row.pos_diff, 1) : '—'; };
            var avgStagePts = function (row) { return (row.avg_stage_points == null || row.avg_stage_points === 0 || row.avg_stage_points === '0') ? '—' : fmtNum(row.avg_stage_points, 2); };
            tbody.innerHTML = filtered.map(function (row) {
              var td = '';
              td += '<td class="col-num">' + row.pos + '</td>';
              td += '<td class="col-car">' + esc(dash(row.car)) + '</td>';
              td += '<td>' + driverLink(row.driver) + '</td>';
              td += '<td>' + teamLink(row.team) + '</td>';
              td += '<td>' + esc(dash(row.manufacturer || '')) + '</td>';
              td += '<td>' + row.races + '</td>';
              td += '<td>' + row.wins + '</td>';
              td += '<td>' + row.poles + '</td>';
              td += '<td>' + row.top5 + '</td>';
              td += '<td>' + row.top10 + '</td>';
              td += '<td>' + row.top15 + '</td>';
              td += '<td>' + row.top20 + '</td>';
              td += '<td>' + avgStartFmt(row) + '</td>';
              td += '<td>' + avgFinishFmt(row) + '</td>';
              td += '<td>' + row.stage_wins + '</td>';
              td += '<td>' + row.stage_points + '</td>';
              td += '<td>' + avgStagePts(row) + '</td>';
              td += '<td>' + row.laps_led + '</td>';
              td += '<td>' + lapsPct(row) + '</td>';
              td += '<td>' + posDiff(row) + '</td>';
              return '<tr>' + td + '</tr>';
            }).join('');
          }

          // Initialize sort on table header click.
          var statsTable = document.getElementById('stats-table');
          if (statsTable) {
            var headRow = statsTable.querySelector('thead tr');
            if (headRow) {
              var ths = headRow.querySelectorAll('th');
              var sidLowerStats = (seriesId || '').toLowerCase();
                var manWrap = document.getElementById('manufacturer-stats-wrap');
                if (manWrap) manWrap.classList.remove('hidden');
              if (sidLowerStats === 'indycar' && ths.length > 4 && !isF1Stats) {
                ths[4].textContent = t('th.engine');
              }
              if (sidLowerStats === 'supercars' && ths.length > 10) {
                ths[10].textContent = 'Avg. Qualifying';
              }
              var keys = ['pos', 'car', 'driver', 'team', 'manufacturer', 'races', 'wins', 'poles', 'top5', 'top10', 'top15', 'top20', 'avg_start', 'avg_finish', 'stage_wins', 'stage_points', 'avg_stage_points', 'laps_led', 'laps_completed_pct', 'pos_diff'];
              function isNumericKey(k) {
                return ['pos', 'car', 'races', 'wins', 'poles', 'top5', 'top10', 'top15', 'top20', 'avg_start', 'avg_finish', 'stage_wins', 'stage_points', 'avg_stage_points', 'laps_led', 'laps_completed_pct', 'pos_diff'].indexOf(k) >= 0;
              }
              for (var c = 0; c < ths.length; c++) {
                (function (colIndex) {
                  var key = keys[colIndex];
                  if (!key) return;
                  ths[colIndex].classList.add('sortable');
                  ths[colIndex].addEventListener('click', function () {
                    var dir = ths[colIndex].dataset.sortDir === 'asc' ? -1 : 1;
                    statsRows.sort(function (a, b) {
                      var va = a[key];
                      var vb = b[key];
                      var ae = (va === null || va === undefined || va === '');
                      var be = (vb === null || vb === undefined || vb === '');
                      if (ae && be) return 0;
                      if (ae) return 1;
                      if (be) return -1;
                      if (isNumericKey(key)) {
                        var na = parseFloat(va);
                        var nb = parseFloat(vb);
                        if (!isNaN(na) && !isNaN(nb)) return dir * (na - nb);
                      }
                      return dir * String(va).localeCompare(String(vb), undefined, { numeric: true });
                    });
                    [].forEach.call(ths, function (th) { th.classList.remove('sort-asc', 'sort-desc'); th.removeAttribute('data-sort-dir'); });
                    ths[colIndex].classList.add(dir === 1 ? 'sort-asc' : 'sort-desc');
                    ths[colIndex].dataset.sortDir = (dir === 1 ? 'asc' : 'desc');
                    renderStatsTable(statsRows);
                  });
                })(c);
              }
            }
          }

          if (statsFilterInput) {
            statsFilterInput.addEventListener('input', function () {
              renderStatsTable(statsRows);
            });
          }
          if (statsMinStartsSelect) {
            statsMinStartsSelect.addEventListener('change', function () {
              renderStatsTable(statsRows);
            });
          }

          renderStatsTable(statsRows);

          // Team stats (from backend data: data.teams).
          var teamRowsRaw = data && data.teams ? data.teams : [];
          var teamTable = document.getElementById('team-stats-table');
          var teamEmpty = document.getElementById('team-stats-empty');
          var teamStatsFilterInput = document.getElementById('team-stats-filter');
          var teamStatsMinStartsSelect = document.getElementById('team-stats-min-starts');
          setupMinStartsSelect(teamStatsMinStartsSelect, 'team');
          if (teamTable) {
            var teamTbody = teamTable.querySelector('tbody');
            if (teamRowsRaw && teamRowsRaw.length > 0 && teamTbody) {
              if (teamEmpty) teamEmpty.classList.add('hidden');
              var teamData = teamRowsRaw.map(function (row, idx) {
                return {
                  pos: idx + 1,
                  team: row.team || '',
                  races: row.races || 0,
                  wins: row.wins || 0,
                poles: row.poles || 0,
                  top5: row.top5 || 0,
                  top10: row.top10 || 0,
                  top15: row.top15 || 0,
                  top20: row.top20 || 0,
                  avg_start: row.avg_start,
                  avg_finish: row.avg_finish,
                  stage_wins: row.stage_wins || 0,
                  stage_points: row.stage_points || 0,
                  avg_stage_points: row.avg_stage_points,
                  laps_led: row.laps_led || 0,
                  laps_completed_pct: row.laps_completed_pct,
                  pos_diff: row.pos_diff
                };
              });
              function teamPassesFilter(row) {
                var minStarts = 0;
                if (teamStatsMinStartsSelect && teamStatsMinStartsSelect.value) {
                  var parsed = parseInt(teamStatsMinStartsSelect.value, 10);
                  if (!isNaN(parsed) && parsed > 0) minStarts = parsed;
                }
                if (minStarts && (row.races || 0) < minStarts) return false;
                var q = teamStatsFilterInput && teamStatsFilterInput.value
                  ? teamStatsFilterInput.value.trim().toLowerCase()
                  : '';
                if (!q) return true;
                var haystack = (row.team || '').toLowerCase();
                return haystack.indexOf(q) !== -1;
              }

              function renderTeamTable(list) {
                var filtered = list.filter(teamPassesFilter);
                teamTbody.innerHTML = filtered.map(function (row) {
                  var lapsPct = row.laps_completed_pct != null ? fmtNum(row.laps_completed_pct, 1) + '%' : '—';
                  var posDiff = row.pos_diff != null ? fmtNum(row.pos_diff, 1) : '—';
                  var avgStart = (row.avg_start == null || row.avg_start === 0 || row.avg_start === '0') ? '—' : fmtNum(row.avg_start, 2);
                  var avgFinish = fmtNum(row.avg_finish, 2);
                  var avgStagePts = (row.avg_stage_points == null || row.avg_stage_points === 0 || row.avg_stage_points === '0') ? '—' : fmtNum(row.avg_stage_points, 2);
                  var td = '';
                  td += '<td class="col-num">' + row.pos + '</td>';
                  td += '<td>' + (row.team === '—' ? '—' : teamLink(row.team)) + '</td>';
                  td += '<td>' + row.races + '</td>';
                  td += '<td>' + row.wins + '</td>';
                  td += '<td>' + row.poles + '</td>';
                  td += '<td>' + row.top5 + '</td>';
                  td += '<td>' + row.top10 + '</td>';
                  td += '<td>' + row.top15 + '</td>';
                  td += '<td>' + row.top20 + '</td>';
                  td += '<td>' + avgStart + '</td>';
                  td += '<td>' + avgFinish + '</td>';
                  td += '<td>' + row.stage_wins + '</td>';
                  td += '<td>' + row.stage_points + '</td>';
                  td += '<td>' + avgStagePts + '</td>';
                  td += '<td>' + row.laps_led + '</td>';
                  td += '<td>' + lapsPct + '</td>';
                  td += '<td>' + posDiff + '</td>';
                  return '<tr>' + td + '</tr>';
                }).join('');
              }

              var teamHeadRow = teamTable.querySelector('thead tr');
              if (teamHeadRow) {
                var teamThs = teamHeadRow.querySelectorAll('th');
                var teamKeys = [
                  'pos', 'team', 'races', 'wins', 'poles', 'top5', 'top10', 'top15', 'top20',
                  'avg_start', 'avg_finish', 'stage_wins', 'stage_points', 'avg_stage_points', 'laps_led', 'laps_completed_pct', 'pos_diff'
                ];
                // For Supercars Avg. Start column is actually Avg. Qualifying.
                var sidLowerTeam = (seriesId || '').toLowerCase();
                if (sidLowerTeam === 'supercars' && teamThs.length > 7) {
                  teamThs[7].textContent = 'Avg. Qualifying';
                }
                function isTeamNumeric(k) {
                  return ['pos', 'races', 'wins', 'poles', 'top5', 'top10', 'top15', 'top20', 'avg_start', 'avg_finish', 'stage_wins', 'stage_points', 'avg_stage_points', 'laps_led', 'laps_completed_pct', 'pos_diff'].indexOf(k) >= 0;
                }
                for (var tc = 0; tc < teamThs.length; tc++) {
                  (function (colIndex) {
                    var key = teamKeys[colIndex];
                    if (!key) return;
                    teamThs[colIndex].classList.add('sortable');
                    teamThs[colIndex].addEventListener('click', function () {
                      var dir = teamThs[colIndex].dataset.sortDir === 'asc' ? -1 : 1;
                      teamData.sort(function (a, b) {
                        var va = a[key];
                        var vb = b[key];
                        var ae = (va === null || va === undefined || va === '');
                        var be = (vb === null || vb === undefined || vb === '');
                        if (ae && be) return 0;
                        if (ae) return 1;
                        if (be) return -1;
                        if (isTeamNumeric(key)) {
                          var na = parseFloat(va);
                          var nb = parseFloat(vb);
                          if (!isNaN(na) && !isNaN(nb)) return dir * (na - nb);
                        }
                        return dir * String(va).localeCompare(String(vb), undefined, { numeric: true });
                      });
                      [].forEach.call(teamThs, function (th) { th.classList.remove('sort-asc', 'sort-desc'); th.removeAttribute('data-sort-dir'); });
                      teamThs[colIndex].classList.add(dir === 1 ? 'sort-asc' : 'sort-desc');
                      teamThs[colIndex].dataset.sortDir = (dir === 1 ? 'asc' : 'desc');
                      renderTeamTable(teamData);
                    });
                  })(tc);
                }
              }

              renderTeamTable(teamData);
              if (teamStatsFilterInput) {
                teamStatsFilterInput.addEventListener('input', function () {
                  renderTeamTable(teamData);
                });
              }
              if (teamStatsMinStartsSelect) {
                teamStatsMinStartsSelect.addEventListener('change', function () {
                  renderTeamTable(teamData);
                });
              }
            } else if (teamEmpty) {
              teamEmpty.classList.remove('hidden');
            }
          }

          // Manufacturer stats (from backend data: data.manufacturers).
          var manRowsRaw = data && data.manufacturers ? data.manufacturers : [];
          var manTable = document.getElementById('manufacturer-stats-table');
          var manEmpty = document.getElementById('manufacturer-stats-empty');
          var manStatsFilterInput = document.getElementById('manufacturer-stats-filter');
          var manStatsMinStartsSelect = document.getElementById('manufacturer-stats-min-starts');
          setupMinStartsSelect(manStatsMinStartsSelect, 'manufacturer');
          if (manTable) {
            var manTbody = manTable.querySelector('tbody');
            if (manRowsRaw && manRowsRaw.length > 0 && manTbody) {
              if (manEmpty) manEmpty.classList.add('hidden');
              var manData = manRowsRaw.map(function (row, idx) {
                return {
                  pos: idx + 1,
                  manufacturer: row.manufacturer || '',
                  races: row.races || 0,
                  wins: row.wins || 0,
                  top2: row.top2 || 0,
                  top3: row.top3 || 0,
                  podiums: row.podiums != null ? row.podiums : (row.wins || 0) + (row.top2 || 0) + (row.top3 || 0),
                  top5: row.top5 || 0,
                  top10: row.top10 || 0,
                  avg_start: row.avg_start,
                  avg_qualifying: row.avg_qualifying,
                  avg_finish: row.avg_finish,
                  q2_passes: row.q2_passes != null ? row.q2_passes : 0,
                  q3_passes: row.q3_passes != null ? row.q3_passes : 0,
                  laps_led: row.laps_led || 0,
                  laps_completed: row.laps_completed != null ? row.laps_completed : 0
                };
              });
              function manPassesFilter(row) {
                var minStarts = 0;
                if (manStatsMinStartsSelect && manStatsMinStartsSelect.value) {
                  var parsed = parseInt(manStatsMinStartsSelect.value, 10);
                  if (!isNaN(parsed) && parsed > 0) minStarts = parsed;
                }
                if (minStarts && (row.races || 0) < minStarts) return false;
                var q = manStatsFilterInput && manStatsFilterInput.value
                  ? manStatsFilterInput.value.trim().toLowerCase()
                  : '';
                if (!q) return true;
                var haystack = (row.manufacturer || '').toLowerCase();
                return haystack.indexOf(q) !== -1;
              }

              function renderManTable(list) {
                var filtered = list.filter(manPassesFilter);
                manTbody.innerHTML = filtered.map(function (row) {
                  var avgStart = (row.avg_start == null || row.avg_start === 0 || row.avg_start === '0') ? '—' : fmtNum(row.avg_start, 2);
                  var avgQual = (row.avg_qualifying == null || row.avg_qualifying === 0 || row.avg_qualifying === '') ? '—' : fmtNum(row.avg_qualifying, 2);
                  var avgFinish = fmtNum(row.avg_finish, 2);
                  var td = '';
                  td += '<td class="col-num">' + row.pos + '</td>';
                  td += '<td>' + esc(dash(row.manufacturer || '')) + '</td>';
                  td += '<td>' + row.races + '</td>';
                  td += '<td>' + row.wins + '</td>';
                  td += '<td>' + row.top2 + '</td>';
                  td += '<td>' + row.top3 + '</td>';
                  td += '<td>' + row.podiums + '</td>';
                  td += '<td>' + row.top5 + '</td>';
                  td += '<td>' + row.top10 + '</td>';
                  td += '<td>' + avgStart + '</td>';
                  td += '<td>' + avgQual + '</td>';
                  td += '<td>' + avgFinish + '</td>';
                  td += '<td>' + (row.q2_passes != null ? row.q2_passes : 0) + '</td>';
                  td += '<td>' + (row.q3_passes != null ? row.q3_passes : 0) + '</td>';
                  td += '<td>' + row.laps_led + '</td>';
                  td += '<td>' + (row.laps_completed != null ? row.laps_completed : '—') + '</td>';
                  return '<tr>' + td + '</tr>';
                }).join('');
              }

              var manHeadRow = manTable.querySelector('thead tr');
              if (manHeadRow) {
                var manThs = manHeadRow.querySelectorAll('th');
                var manKeys = [
                  'pos', 'manufacturer', 'races', 'wins', 'top2', 'top3', 'podiums', 'top5', 'top10',
                  'avg_start', 'avg_qualifying', 'avg_finish', 'q2_passes', 'q3_passes',
                  'laps_led', 'laps_completed'
                ];
                function isManNumeric(k) {
                  return ['pos', 'races', 'wins', 'top2', 'top3', 'podiums', 'top5', 'top10',
                    'avg_start', 'avg_qualifying', 'avg_finish', 'q2_passes', 'q3_passes',
                    'laps_led', 'laps_completed'].indexOf(k) >= 0;
                }
                for (var mc = 0; mc < manThs.length; mc++) {
                  (function (colIndex) {
                    var key = manKeys[colIndex];
                    if (!key) return;
                    manThs[colIndex].classList.add('sortable');
                    manThs[colIndex].addEventListener('click', function () {
                      var dir = manThs[colIndex].dataset.sortDir === 'asc' ? -1 : 1;
                      manData.sort(function (a, b) {
                        var va = a[key];
                        var vb = b[key];
                        var ae = (va === null || va === undefined || va === '');
                        var be = (vb === null || vb === undefined || vb === '');
                        if (ae && be) return 0;
                        if (ae) return 1;
                        if (be) return -1;
                        if (isManNumeric(key)) {
                          var na = parseFloat(va);
                          var nb = parseFloat(vb);
                          if (!isNaN(na) && !isNaN(nb)) return dir * (na - nb);
                        }
                        return dir * String(va).localeCompare(String(vb), undefined, { numeric: true });
                      });
                      [].forEach.call(manThs, function (th) { th.classList.remove('sort-asc', 'sort-desc'); th.removeAttribute('data-sort-dir'); });
                      manThs[colIndex].classList.add(dir === 1 ? 'sort-asc' : 'sort-desc');
                      manThs[colIndex].dataset.sortDir = (dir === 1 ? 'asc' : 'desc');
                      renderManTable(manData);
                    });
                  })(mc);
                }
              }

              renderManTable(manData);
              if (manStatsFilterInput) {
                manStatsFilterInput.addEventListener('input', function () {
                  renderManTable(manData);
                });
              }
              if (manStatsMinStartsSelect) {
                manStatsMinStartsSelect.addEventListener('change', function () {
                  renderManTable(manData);
                });
              }
            } else if (manEmpty) {
              manEmpty.classList.remove('hidden');
            }
          }
          }

        })
        .catch(function () {
          if (attempt + 1 < maxStatsAttempts) {
            setTimeout(function () { loadStats(attempt + 1); }, statsRetryDelayMs);
          } else if (statsEmpty) {
            statsEmpty.classList.remove('hidden');
          }
        });
      }

      if (statsEmpty) statsEmpty.classList.add('hidden');
      loadStats(0);
    }

    fetchJSON('/api/series/' + encodeURIComponent((seriesId || '').toLowerCase()) + '/events')
      .catch(function () { return []; })
      .then(function (events) {
        // Helper for time sort: AM always before PM.
        function parseTimeToMinutes(t) {
          if (!t) return 24 * 60 + 1;
          var m = String(t).trim().match(/(\d{1,2}):(\d{2})\s*([ap]\.?m\.?|AM|PM)/i);
          if (!m) return 24 * 60 + 1;
          var h = parseInt(m[1], 10);
          var mins = parseInt(m[2], 10);
          if (isNaN(h) || isNaN(mins)) return 24 * 60 + 1;
          var ampm = m[3].replace(/\./g, '').toUpperCase();
          h = h % 12;
          if (ampm === 'PM') h += 12;
          return h * 60 + mins;
        }

        var getScheduleTimeLabel = (window.TGA && window.TGA.getScheduleTimeLabel) || function (e) { return e.time_est || e.time_msk || '—'; };

        function renderScheduleRows(list, opts) {
          opts = opts || {};
          window.TGA._lastScheduleEvents = list;
          window.TGA._lastScheduleStaticType = opts.staticType || null;
          window.TGA._lastScheduleSeriesId = seriesId;
          window.TGA.refreshScheduleDetail = function () {
            var ev = window.TGA._lastScheduleEvents;
            var st = window.TGA._lastScheduleStaticType;
            renderScheduleRows(ev || [], st ? { staticType: st } : {});
          };
          var schedTable = document.getElementById('schedule-table');
          var schedWrap = schedTable && schedTable.closest('.table-wrap');
          var schedBody = document.querySelector('#schedule-table tbody');
          var regularBanner = '<tr class="schedule-section-banner"><td colspan="5">' + esc(t('schedule.regular_season')) + '</td></tr>';
          var inSeasonBanner = '<tr class="schedule-section-banner"><td colspan="5">' + esc(t('schedule.in_season_challenge')) + '</td></tr>';
          var playoffsBanner = '<tr class="schedule-section-banner"><td colspan="5">' + esc(t('schedule.playoffs')) + '</td></tr>';
          var cupChaseBanner = '<tr class="schedule-section-banner"><td colspan="5">' + esc(t('schedule.cup_series_chase')) + '</td></tr>';
          var theChaseBanner = '<tr class="schedule-section-banner"><td colspan="5">' + esc(t('schedule.the_chase')) + '</td></tr>';
          var supercarsSprintBanner = '<tr class="schedule-section-banner"><td colspan="7">Sprint Cup</td></tr>';
          var supercarsEnduroBanner  = '<tr class="schedule-section-banner"><td colspan="7">Enduro Cup</td></tr>';
          var supercarsFinalsBanner  = '<tr class="schedule-section-banner"><td colspan="7">Finals Series</td></tr>';
          var seriesKeySched = (seriesId || '').toLowerCase();
          var pathSeriesSlug = (window.location.pathname.split('/')[2] || '').toLowerCase();
          var isCup = (seriesKeySched === 'nascar_cup');
          var isSupercars = (seriesKeySched === 'supercars');
          var isIndycar = (seriesKeySched === 'indycar' || pathSeriesSlug === 'indycar');
          var isSuperFormula = (seriesKeySched === 'super_formula' || pathSeriesSlug === 'super_formula');
          // Current F1 season slug: /season/f1-2026. This URL should show
          // current F1 season schedule in the same layout as /series/f1 used to
          // (5 columns with Time), not the "historical" 4-column template.
          var F1_CURRENT_SEASON_SLUG = 'f1-2026';
          var isF1CurrentSeasonSlug = (seriesKeySched === F1_CURRENT_SEASON_SLUG || pathSeriesSlug === F1_CURRENT_SEASON_SLUG);
          var isF1 = (seriesKeySched === 'f1' || pathSeriesSlug === 'f1' || isF1CurrentSeasonSlug);
          // Historical F1 seasons: /season/f1-2025, etc. (but NOT the current season).
          var isF1Season = !isF1CurrentSeasonSlug && (seriesKeySched.indexOf('f1-') === 0 || pathSeriesSlug.indexOf('f1-') === 0);
          var isF2 = (seriesKeySched === 'f2' || pathSeriesSlug === 'f2');
          var isF3 = (seriesKeySched === 'f3' || pathSeriesSlug === 'f3');
          var isMultiRaceSchedule = (window.TGA && window.TGA.isMultiRaceSeriesSchedule)
            ? (window.TGA.isMultiRaceSeriesSchedule(seriesKeySched) || window.TGA.isMultiRaceSeriesSchedule(pathSeriesSlug))
            : false;
          var isGroupedRaceSchedule = isSupercars || isMultiRaceSchedule;
          var isStockCarSeries = ['nascar_cup', 'noaps', 'nascar_truck', 'arca', 'nascar_modified'].indexOf(seriesKeySched) >= 0;
          var schedColspan = isStockCarSeries ? 6 : 5;
          var regularBannerStock = '<tr class="schedule-section-banner"><td colspan="' + schedColspan + '">' + esc(t('schedule.regular_season')) + '</td></tr>';
          var inSeasonBannerStock = '<tr class="schedule-section-banner"><td colspan="' + schedColspan + '">' + esc(t('schedule.in_season_challenge')) + '</td></tr>';
          var playoffsBannerStock = '<tr class="schedule-section-banner"><td colspan="' + schedColspan + '">' + esc(t('schedule.playoffs')) + '</td></tr>';
          var cupChaseBannerStock = '<tr class="schedule-section-banner"><td colspan="' + schedColspan + '">' + esc(t('schedule.cup_series_chase')) + '</td></tr>';
          var theChaseBannerStock = '<tr class="schedule-section-banner"><td colspan="' + schedColspan + '">' + esc(t('schedule.the_chase')) + '</td></tr>';
          if (schedWrap) {
            schedWrap.classList.toggle('schedule-wrap--stockcar', isStockCarSeries && !isSupercars);
          }
          if (schedTable) {
            schedTable.classList.toggle('schedule-table--supercars', isGroupedRaceSchedule);
            schedTable.classList.toggle('schedule-table--stockcar', isStockCarSeries);
            schedTable.classList.toggle('schedule-table--super-formula', isSuperFormula);
          }
          var unnumberedIds = {
            'NASCAR_CUP_2026_0': true,
            'NASCAR_CUP_2026_ALLSTAR_OPEN': true,
            'NASCAR_CUP_2026_ALLSTAR_RACE': true,
            'IMSA_2026_PRE_SEASON_TEST': true
          };
          function scheduleExcludedFromChampionship(evId) {
            var id = String(evId || '');
            if (!id) return false;
            if (unnumberedIds[id]) return true;
            if (id.indexOf('PRE_SEASON_TEST') >= 0) return true;
            if (/_\d{4}_PROLOGUE$/i.test(id)) return true;
            return false;
          }
          var continuationId = 'NASCAR_CUP_2026_ALLSTAR_RACE';
          // Configure table header for the specific series
          var schedHeadRow = document.querySelector('#schedule-table thead tr');
          if (schedHeadRow) {
            var seriesKey = seriesKeySched;
            if (isGroupedRaceSchedule) {
              schedHeadRow.innerHTML =
                '<th>' + esc(t('th.round')) + '</th>' +
                '<th>' + esc(t('th.race_num')) + '</th>' +
                '<th>' + esc(t('th.event')) + '</th>' +
                '<th>' + esc(t('th.circuit')) + '</th>' +
                '<th>' + esc(t('th.location')) + '</th>' +
                '<th>date</th>' +
                '<th>' + esc(t('th.time')) + '</th>';
            } else if (seriesKey === 'imsa') {
              // IMSA: Rnd. | Race | Length | Classes | Circuit | Location | Date
              schedHeadRow.innerHTML =
                '<th>' + esc(t('th.round')) + '</th>' +
                '<th>' + esc(t('th.race_col')) + '</th>' +
                '<th>Length</th>' +
                '<th>Classes</th>' +
                '<th>' + esc(t('th.circuit')) + '</th>' +
                '<th>' + esc(t('th.location')) + '</th>' +
                '<th>date</th>';
            } else if (isIndycar) {
              schedHeadRow.innerHTML =
                '<th>Rd.</th>' +
                '<th>Date</th>' +
                '<th>Race name</th>' +
                '<th>Track</th>' +
                '<th>' + esc(t('th.location')) + '</th>' +
                '<th>' + esc(t('th.time')) + '</th>';
            } else if (isSuperFormula) {
              schedHeadRow.innerHTML =
                '<th>Rd.</th>' +
                '<th>Date</th>' +
                '<th>Venue</th>' +
                '<th>' + esc(t('th.time')) + '</th>';
            } else if (isF1 && !isMultiRaceSchedule) {
              // F1 (current season): Round | Grand Prix | Circuit | Date | Time
              schedHeadRow.innerHTML =
                '<th>' + esc(t('th.round')) + '</th>' +
                '<th>Grand Prix</th>' +
                '<th>' + esc(t('th.circuit')) + '</th>' +
                '<th>date</th>' +
                '<th>' + esc(t('th.time')) + '</th>';
            } else if (isF1Season) {
              // Historical F1 seasons: Round | Grand Prix | Circuit | Race date (no Time column)
              schedHeadRow.innerHTML =
                '<th>' + esc(t('th.round')) + '</th>' +
                '<th>Grand Prix</th>' +
                '<th>' + esc(t('th.circuit')) + '</th>' +
                '<th>Race date</th>';
            } else if (isStockCarSeries) {
              schedHeadRow.innerHTML =
                '<th>#</th>' +
                '<th>' + esc(t('th.race_col')) + '</th>' +
                '<th>' + esc(t('th.track')) + '</th>' +
                '<th>' + esc(t('th.location')) + '</th>' +
                '<th>date</th>' +
                '<th>' + esc(t('th.time')) + '</th>';
            } else {
              schedHeadRow.innerHTML =
                '<th>#</th>' +
                '<th>date</th>' +
                '<th>' + esc(t('th.race_col')) + '</th>' +
                '<th class="col-location">' + esc(t('th.location')) + '</th>' +
                '<th>' + esc(t('th.time')) + '</th>';
            }
          }

          list = Array.isArray(list) ? list.slice() : [];
          if ((isF2 || isF3) && list.length === 0 && window.TGA_STATIC_SCHEDULES) {
            var staticF2F3 = isF2 ? window.TGA_STATIC_SCHEDULES.f2 : window.TGA_STATIC_SCHEDULES.f3;
            if (staticF2F3 && staticF2F3.length) {
              list = staticF2F3.map(function (r) {
                var prefix = isF2 ? 'F2' : 'F3';
                return {
                  id: (r.event_id || (prefix + '_2026_' + r.rd)).toUpperCase(),
                  name: r.circuit,
                  circuit_name: r.circuit,
                  location: '',
                  has_detail: true,
                  start_date: '',
                  end_date: ''
                };
              });
            }
          }
          if (isMultiRaceSchedule && window.TGA.expandSeriesScheduleEvents) {
            list = window.TGA.expandSeriesScheduleEvents(seriesKeySched, list);
          }

          // If no data and no special table — show empty message
          if (!isIndycar && !isSuperFormula && !isF1 && !isF2 && !isF3 && (!list || !list.length)) {
          scheduleEmpty.classList.remove('hidden');
          scheduleEmpty.textContent = t('schedule.empty') || 'No schedule data yet.';
          return;
        }

          // Special static schedule for IndyCar (only if API returned no events)
          if (isIndycar && (!list || !list.length)) {
            if (schedBody) {
              var indySched = (window.TGA_STATIC_SCHEDULES && window.TGA_STATIC_SCHEDULES.indycarTable) || [];
              window.TGA._lastScheduleEvents = indySched;
              window.TGA._lastScheduleStaticType = 'indycar';
              schedBody.innerHTML = indySched.map(function (r) {
                var synthetic = { date: r.date, time_est: r.time_et, time_msk: r.time_msk };
                var timeLabel = getScheduleTimeLabel(synthetic, 'indycar');
                var raceCell = r.event_id
                  ? '<a href="/event/' + encodeURIComponent((r.event_id + '').toLowerCase().replace(/_/g, '-')) + '" class="event-link">' + esc(r.race) + '</a>'
                  : esc(r.race);
                return '<tr>' +
                  '<td>' + r.rd + '</td>' +
                  '<td>' + esc(r.date) + '</td>' +
                  '<td>' + raceCell + '</td>' +
                  '<td>' + esc(r.track) + '</td>' +
                  '<td>' + esc(r.location) + '</td>' +
                  '<td class="col-time">' + esc(timeLabel) + '</td>' +
                  '</tr>';
              }).join('');
              if (schedTable) makeSimpleTableSortable(schedTable);
            }
          return;
        }

          // Special static schedule for Formula 1 (only if API returned no events)
          if (isF1 && (!list || !list.length)) {
            if (schedBody) {
              var f1Sched = (window.TGA_STATIC_SCHEDULES && window.TGA_STATIC_SCHEDULES.f1) || [];
              schedBody.innerHTML = f1Sched.map(function (r) {
                return '<tr>' +
                  '<td class="col-num">' + r.rd + '</td>' +
                  '<td>' + esc(r.grand_prix) + '</td>' +
                  '<td>' + esc(r.circuit) + '</td>' +
                  '<td>' + esc(r.date) + '</td>' +
                  '</tr>';
              }).join('');
              if (schedTable) makeSimpleTableSortable(schedTable);
            }
            return;
          }

          if (isF1Season && (!list || !list.length)) {
            if (schedBody) {
              var f1SeasonSched = (window.TGA_STATIC_SCHEDULES && window.TGA_STATIC_SCHEDULES.f1_2025) || [];
              schedBody.innerHTML = f1SeasonSched.map(function (r) {
                return '<tr>' +
                  '<td class="col-num">' + r.rd + '</td>' +
                  '<td>' + esc(r.grand_prix) + '</td>' +
                  '<td>' + esc(r.circuit) + '</td>' +
                  '<td>' + esc(r.date) + '</td>' +
                  '</tr>';
              }).join('');
              if (schedTable) makeSimpleTableSortable(schedTable);
            }
            return;
          }

          function eventRow(e, num, opts) {
            opts = opts || {};
            var showNum = (opts.unnumbered || scheduleExcludedFromChampionship(e.id)) ? '—' : String(num);
            var formatDateRangeLong = window.TGA && window.TGA.formatDateRangeLong;
            var formatShortDate = window.TGA && window.TGA.formatShortDate;
            var startIso = (e.start_date || e.date || '').slice(0, 10);
            var endIso = (e.end_date || '').slice(0, 10);
            var date = (startIso && endIso && startIso !== endIso && formatDateRangeLong)
              ? formatDateRangeLong(e.start_date, e.end_date)
              : (formatShortDate ? formatShortDate(startIso) : startIso);
            var eventName = e.name || '—';
            if (isGroupedRaceSchedule) {
              eventName = (window.TGA && window.TGA.normalizeSeriesScheduleBaseName)
                ? window.TGA.normalizeSeriesScheduleBaseName(eventName)
                : eventName.replace(/\s+Race\s+\d+$/i, '').trim();
            }
            var link = e.has_detail
              ? '<a href="/event/' + encodeURIComponent((e.id || '').toLowerCase().replace(/_/g, '-')) + '" class="event-link">' + esc(eventName) + '</a>'
              : '<span class="event-no-data">' + esc(eventName) + '</span>';
            var dateCell;
            if (isGroupedRaceSchedule) {
              if (opts.dateContinuation) {
                dateCell = '';
              } else if (opts.dateFirst && opts.dateRowSpan && opts.dateRowSpan > 1) {
                dateCell = '<td rowspan="' + opts.dateRowSpan + '" class="col-date-span">' + esc(date || '—') + '</td>';
              } else {
                dateCell = '<td>' + esc(date || '—') + '</td>';
              }
            } else {
              if (opts.continuation || opts.groupContinuation) {
                dateCell = '';
              } else if (opts.groupFirst) {
                var span = opts.groupRowSpan || 2;
                dateCell = '<td rowspan="' + span + '" class="col-date-span">' + esc(date) + '</td>';
              } else {
                dateCell = '<td>' + esc(date) + '</td>';
              }
            }
            var trackName = e.circuit_name || e.location || '—';
            if (isStockCarSeries && trackName !== '—' && trackName.indexOf(', ') >= 0) {
              trackName = trackName.split(', ')[0];
            }
            var trackSlug = slugify(e.circuit_name || e.location || trackName);
            var trackCell;
            var seriesKeyRow = (seriesId || '').toLowerCase();
            if (seriesKeyRow === 'wec') {
              // For WEC merge track cell only (no date) for Prologue and first round.
              if (opts.circuitContinuation) {
                trackCell = '';
              } else if (opts.circuitFirst && opts.circuitRowSpan && opts.circuitRowSpan > 1 && trackName !== '—') {
                trackCell = '<td rowspan="' + opts.circuitRowSpan + '" class="col-circuit-span"><a href="/track/' + encodeURIComponent(trackSlug) + '" class="track-link" data-track-name="' + esc(trackName) + '">' + esc(trackName) + '</a></td>';
              } else if (opts.circuitFirst && opts.circuitRowSpan && opts.circuitRowSpan > 1 && trackName === '—') {
                trackCell = '<td rowspan="' + opts.circuitRowSpan + '" class="col-circuit-span">' + esc(trackName) + '</td>';
              } else if (trackName === '—') {
                trackCell = '<td>' + esc(trackName) + '</td>';
              } else {
                trackCell = '<td><a href="/track/' + encodeURIComponent(trackSlug) + '" class="track-link" data-track-name="' + esc(trackName) + '">' + esc(trackName) + '</a></td>';
              }
            } else {
              if (opts.continuation || opts.groupContinuation) {
                trackCell = '';
              } else if (opts.groupFirst && opts.groupRowSpan > 1 && trackName !== '—') {
                trackCell = '<td rowspan="' + opts.groupRowSpan + '" class="col-circuit-span"><a href="/track/' + encodeURIComponent(trackSlug) + '" class="track-link" data-track-name="' + esc(trackName) + '">' + esc(trackName) + '</a></td>';
              } else if (opts.groupFirst && opts.groupRowSpan > 1 && trackName === '—') {
                trackCell = '<td rowspan="' + opts.groupRowSpan + '" class="col-circuit-span">' + esc(trackName) + '</td>';
              } else if (trackName === '—') {
                trackCell = '<td>' + esc(trackName) + '</td>';
              } else {
                trackCell = '<td><a href="/track/' + encodeURIComponent(trackSlug) + '" class="track-link" data-track-name="' + esc(trackName) + '">' + esc(trackName) + '</a></td>';
              }
            }
            var numCell;
            if (isGroupedRaceSchedule) {
              if (opts.roundContinuation) {
                numCell = '';
              } else if (opts.roundFirst && opts.roundRowSpan && opts.roundRowSpan > 1) {
                numCell = '<td class="col-num" rowspan="' + opts.roundRowSpan + '">' + esc(String(opts.round)) + '</td>';
              } else {
                numCell = '<td class="col-num">' + esc(String(opts.round || showNum)) + '</td>';
              }
            } else if ((seriesKeyRow === 'f1' || seriesKeyRow === 'wec') && opts.roundDisplay != null) {
              numCell = '<td class="col-num">' + esc(opts.roundDisplay) + '</td>';
            } else {
              numCell = '<td class="col-num">' + esc(showNum) + '</td>';
            }
            if (seriesKeyRow === 'super_formula' && e._sfRdLabel) {
              if (e.has_detail && e.id) {
                var sfEventSlug = String(e.id || '').toLowerCase().replace(/_/g, '-');
                numCell = '<td class="col-num"><a href="/event/' + encodeURIComponent(sfEventSlug) + '" class="event-link">' + esc(String(e._sfRdLabel)) + '</a></td>';
              } else {
                numCell = '<td class="col-num">' + esc(String(e._sfRdLabel)) + '</td>';
              }
            }
            var eventCell;
            if (opts.continuation || opts.groupContinuation) {
              eventCell = '';
            } else if (opts.groupFirst && opts.groupRowSpan && opts.groupRowSpan > 1) {
              eventCell = '<td rowspan="' + opts.groupRowSpan + '" class="col-event-span">' + link + '</td>';
            } else {
              eventCell = '<td>' + link + '</td>';
            }

            if (isGroupedRaceSchedule) {
              var raceColText = (window.TGA && window.TGA.resolveRaceSessionLabel)
                ? window.TGA.resolveRaceSessionLabel(e, seriesKeyRow)
                : (e._sessionLabel || '');
              if (!raceColText && isSupercars && opts.globalRaceNum != null) {
                raceColText = String(opts.globalRaceNum);
              } else if (!raceColText) {
                raceColText = String(opts.raceInRound || '');
              }
              var raceCell = '<td>' + esc(raceColText) + '</td>';
              var locText = e.location || '—';
              var locationCell;
              if (opts.groupContinuation) {
                locationCell = '';
              } else if (opts.groupFirst && opts.groupRowSpan && opts.groupRowSpan > 1) {
                locationCell = '<td rowspan="' + opts.groupRowSpan + '" class="col-location-span">' + esc(locText) + '</td>';
              } else {
                locationCell = '<td>' + esc(locText) + '</td>';
              }
              var timeCell = '<td class="col-time">' + esc(getScheduleTimeLabel(e, seriesKeyRow) || '—') + '</td>';
            return (
              '<tr>' +
                  numCell +
                  raceCell +
                  eventCell +
                  trackCell +
                  locationCell +
                  dateCell +
                  timeCell +
                '</tr>'
              );
            }

            if (seriesKeyRow === 'imsa') {
              // IMSA: Rnd. | Race | Length | Classes | Circuit | Location | Date
              // Extra race length and class data set on the client.
              var imsaMeta = {
                'IMSA_2026_PRE_SEASON_TEST': { classes: 'All' },
                'IMSA_2026_1': { length: '24 hours', classes: 'All' },
                'IMSA_2026_2': { length: '12 hours', classes: 'All' },
                'IMSA_2026_3': { length: '100 minutes', classes: 'GTP, GTD' },
                'IMSA_2026_4': { length: '160 minutes', classes: 'GTP, GTD Pro, GTD' },
                'IMSA_2026_5': { length: '100 minutes', classes: 'GTP, GTD Pro' },
                'IMSA_2026_6': { length: '6 hours', classes: 'All' },
                'IMSA_2026_7': { length: '160 minutes', classes: 'LMP2, GTD Pro, GTD' },
                'IMSA_2026_8': { length: '6 hours', classes: 'All' },
                'IMSA_2026_9': { length: '160 minutes', classes: 'GTD Pro, GTD' },
                'IMSA_2026_10': { length: '160 minutes', classes: 'All' },
                'IMSA_2026_11': { length: '10 hours', classes: 'All' }
              };
              var meta = imsaMeta[e.id] || {};
              var lengthCell = '<td>' + esc(meta.length || '—') + '</td>';
              var classesCell = '<td>' + esc(meta.classes || '—') + '</td>';
              var locTextImsa = e.location || '—';
              var locationCellImsa = '<td>' + esc(locTextImsa) + '</td>';
              var dateLabelImsa = (startIso && endIso && startIso !== endIso && formatDateRangeLong)
                ? formatDateRangeLong(e.start_date, e.end_date)
                : (formatShortDate ? formatShortDate(startIso) : startIso);
              var dateCellImsa = '<td>' + esc(dateLabelImsa || '—') + '</td>';
              return (
                '<tr>' +
                  numCell +
                '<td>' + link + '</td>' +
                  lengthCell +
                  classesCell +
                  trackCell +
                  locationCellImsa +
                  dateCellImsa +
                '</tr>'
              );
            }

            if ((seriesKeyRow === 'f1' || seriesKeyRow === F1_CURRENT_SEASON_SLUG) && !isGroupedRaceSchedule) {
              // F1 (current season) from API: # | Grand Prix | Circuit | Date | Time
              var timeLabelF1 = getScheduleTimeLabel(e, seriesKeyRow);
              return (
                '<tr>' +
                  numCell +
                  eventCell +
                  trackCell +
                  dateCell +
                  '<td class="col-time">' + esc(timeLabelF1 || '—') + '</td>' +
                '</tr>'
              );
            }

            if (seriesKeyRow.indexOf('f1-') === 0) {
              // Historical F1 seasons: # | Grand Prix | Circuit | Date (no Time)
              return (
                '<tr>' +
                  numCell +
                  eventCell +
                  trackCell +
                  dateCell +
                '</tr>'
              );
            }

            if (seriesKeyRow === 'indycar') {
              var locCellIndy = '<td>' + esc(e.location || '—') + '</td>';
              var timeLabelIndy = getScheduleTimeLabel(e, seriesKeyRow);
              return (
                '<tr>' +
                  numCell +
                  dateCell +
                  eventCell +
                  trackCell +
                  locCellIndy +
                  '<td class="col-time">' + esc(timeLabelIndy || '—') + '</td>' +
                '</tr>'
              );
            }

            if (seriesKeyRow === 'super_formula') {
              var venueSf = (window.TGA && window.TGA.superFormulaVenueLine)
                ? window.TGA.superFormulaVenueLine(e)
                : ((e.circuit_name || '') + (e.location ? ' — ' + e.location : '') || '—');
              var trackSlugSf = slugify(e.circuit_name || e.location || venueSf);
              var venueCellSf = trackSlugSf && trackSlugSf !== '—'
                ? '<td><a href="/track/' + encodeURIComponent(trackSlugSf) + '" class="track-link" data-track-name="' + esc(e.circuit_name || venueSf) + '">' + esc(venueSf) + '</a></td>'
                : '<td>' + esc(venueSf) + '</td>';
              var timeLabelSf = getScheduleTimeLabel(e, seriesKeyRow);
              return (
                '<tr>' +
                  numCell +
                  dateCell +
                  venueCellSf +
                  '<td class="col-time">' + esc(timeLabelSf || '—') + '</td>' +
                '</tr>'
              );
            }

            if (isStockCarSeries) {
              // NASCAR: # | Race | Track | Location | Date | Local (date + time) | MSK (date + time)
              // Track — track name only; Location — city/state only, no duplication
              var raceCellStock = '<td>' + link + '</td>';
              var locTextStock = (e.circuit_name && e.circuit_name.indexOf(', ') >= 0)
                ? e.circuit_name.slice(e.circuit_name.indexOf(', ') + 2).trim()
                : (e.location || '—');
              var locationCellStock;
              if (opts.continuation || opts.groupContinuation) {
                locationCellStock = '';
              } else if (opts.groupFirst && opts.groupRowSpan && opts.groupRowSpan > 1) {
                locationCellStock = '<td rowspan="' + opts.groupRowSpan + '" class="col-location-span">' + esc(locTextStock) + '</td>';
              } else {
                locationCellStock = '<td>' + esc(locTextStock) + '</td>';
              }
              var timeLabelStock = getScheduleTimeLabel(e, seriesKeyRow);
              return (
                '<tr>' +
                  numCell +
                  raceCellStock +
                  trackCell +
                  locationCellStock +
                  dateCell +
                  '<td class="col-time">' + esc(timeLabelStock || '—') + '</td>' +
                '</tr>'
              );
            }

            var timeLabelDefault = getScheduleTimeLabel(e, seriesKeyRow);
            return (
              '<tr' + (opts.continuation ? ' class="schedule-row-continuation"' : '') + '>' +
                numCell +
                dateCell +
                eventCell +
                trackCell +
                '<td class="col-time">' + esc(timeLabelDefault || '—') + '</td>' +
              '</tr>'
            );
          }

          // WEC: prologue (*_YYYY_PROLOGUE) has no number; championship 1, 2, … Independent of prologue position in list.
          if (seriesKeySched === 'wec') {
            var rowsWec = [];
            if (Array.isArray(list) && list.length > 0) {
              function isWecPrologueScheduleRow(ev) {
                return /_\d{4}_PROLOGUE$/i.test(String((ev && ev.id) || ''));
              }
              var wecChampIdx = 0;
              for (var wi = 0; wi < list.length; wi++) {
                var evW = list[wi];
                if (!evW) continue;
                var optsW = {};
                var wecPrologue = isWecPrologueScheduleRow(evW);
                if (wecPrologue) {
                  optsW.roundDisplay = '—';
                  var wecNext = list[wi + 1];
                  if (wecNext && (wecNext.circuit_name || wecNext.location) === (evW.circuit_name || evW.location)) {
                    optsW.circuitFirst = true;
                    optsW.circuitRowSpan = 2;
                  }
                } else {
                  wecChampIdx += 1;
                  optsW.roundDisplay = String(wecChampIdx);
                  var wecPrev = wi > 0 ? list[wi - 1] : null;
                  if (wecPrev && isWecPrologueScheduleRow(wecPrev) &&
                      (wecPrev.circuit_name || wecPrev.location) === (evW.circuit_name || evW.location)) {
                    optsW.circuitContinuation = true;
                  }
                }
                rowsWec.push(eventRow(evW, wi + 1, optsW));
              }
            }
            if (schedBody) {
              schedBody.innerHTML = rowsWec.join('');
              if (schedTable) makeSimpleTableSortable(schedTable);
            }
            return;
          }

            function scheduleGroupKey(ev) {
              if (!ev) return '';
              if (ev._scheduleGroupId) return String(ev._scheduleGroupId);
              var normalizeBase = (window.TGA && window.TGA.normalizeSeriesScheduleBaseName) || function (n) {
                return String(n || '').replace(/\s+Race\s+\d+$/i, '').trim();
              };
              return normalizeBase(ev.name || '');
            }

            var rows = [];
          if (isCup) rows.push(isStockCarSeries ? regularBannerStock : regularBanner);
          if (isGroupedRaceSchedule) {
            var round = 0;
            var f1GroupedRound = 0;
            var maxLoops = Array.isArray(list) ? list.length : 0;
            var loopCount = 0;
            for (var idx = 0; idx < list.length;) {
              if (++loopCount > maxLoops) {
                logger.error('Grouped race schedule: loop guard hit, breaking');
                break;
              }
              var e0 = list[idx];
              if (!e0) {
                idx++;
                continue;
              }
              var baseKey = scheduleGroupKey(e0);
              round++;
              var roundNum = round;
              if (isF1 && isMultiRaceSchedule) {
                if (String(e0.id || '').indexOf('PRE_SEASON_TEST') >= 0) {
                  roundNum = '—';
                } else {
                  f1GroupedRound += 1;
                  roundNum = f1GroupedRound;
                }
              }
              if (isSupercars) {
                if (round === 1) {
                  rows.push(supercarsSprintBanner);
                } else if (round === 10) {
                  rows.push(supercarsEnduroBanner);
                } else if (round === 12) {
                  rows.push(supercarsFinalsBanner);
                }
              }
              var start = idx;
              var size = 1;
              while (start + size < list.length) {
                var eNext = list[start + size];
                if (scheduleGroupKey(eNext) !== baseKey) break;
                size++;
              }
              if (size < 1) size = 1;
              try {
                for (var j = 0; j < size; j++) {
                  var ev = list[start + j];
                  if (!ev) continue;
                  var globalRaceNum = start + j + 1;
                  var evDate = (ev.start_date || ev.date || '').slice(0, 10);
                  var dateRowSpan = 1;
                  for (var k = j + 1; k < size; k++) {
                    var nextDate = (list[start + k].start_date || list[start + k].date || '').slice(0, 10);
                    if (nextDate !== evDate) break;
                    dateRowSpan++;
                  }
                  var prevDate = j > 0 ? (list[start + j - 1].start_date || list[start + j - 1].date || '').slice(0, 10) : '';
                  var dateFirst = (j === 0 || prevDate !== evDate);
                  var dateContinuation = (j > 0 && prevDate === evDate);
                  rows.push(eventRow(ev, globalRaceNum, {
                    round: roundNum,
                    roundFirst: j === 0,
                    roundRowSpan: size,
                    roundContinuation: j > 0,
                    groupFirst: j === 0,
                    groupRowSpan: size,
                    groupContinuation: j > 0,
                    raceInRound: j + 1,
                    globalRaceNum: globalRaceNum,
                    dateFirst: dateFirst,
                    dateRowSpan: dateRowSpan,
                    dateContinuation: dateContinuation
                  }));
                }
              } catch (rowErr) {
                logger.error('Grouped race schedule row error', rowErr);
              }
              idx = start + size;
            }
          } else if (isF1 && !isF1Season && !isMultiRaceSchedule) {
            // F1 (incl. /season/f1-2026): pre-season tests — dash in Round; numbering from first race.
            var f1RoundCounter = 0;
            for (var i = 0; i < list.length; i++) {
              var e = list[i];
              var isF1PreSeason = String(e.id || '').indexOf('PRE_SEASON_TEST') >= 0;
              var roundDisplay = isF1PreSeason ? '—' : String(++f1RoundCounter);
              rows.push(eventRow(e, roundDisplay, { roundDisplay: roundDisplay }));
            }
          } else {
            // All series except Supercars and F1: standard event numbering.
            // For NASCAR series, events marked unnumbered (Cook Out Clash, All-Star),
            // do not increment counter — next full event gets number 1, 2, 3...
            var raceCounter = 0;
            for (var i = 0; i < list.length; i++) {
              var e = list[i];
              var isUnnumbered = scheduleExcludedFromChampionship(e.id);
              var currentNum = raceCounter;
              if (!isUnnumbered) currentNum = ++raceCounter;
              if (isCup && currentNum === 18) rows.push(isStockCarSeries ? inSeasonBannerStock : inSeasonBanner);
              if (isCup && currentNum === 23) rows.push(isStockCarSeries ? regularBannerStock : regularBanner);
              if (isCup && currentNum === 27) rows.push(isStockCarSeries ? theChaseBannerStock : theChaseBanner);
              if ((seriesId || '').toLowerCase() === 'noaps' && i === 24) rows.push(isStockCarSeries ? theChaseBannerStock : theChaseBanner);
              if ((seriesId || '').toLowerCase() === 'nascar_truck' && i === 18) rows.push(isStockCarSeries ? theChaseBannerStock : theChaseBanner);
              if (e.id === continuationId || e.id === 'NASCAR_CUP_2026_ALLSTAR_OPEN') {
                rows.push(eventRow(e, currentNum, { unnumbered: true }));
              } else {
                rows.push(eventRow(e, currentNum, {}));
              }
            }
          }
          if (schedBody) schedBody.innerHTML = rows.join('');
          if (schedTable) makeSimpleTableSortable(schedTable);

          // IMSA note: All Classes → Michelin Endurance Cup events
          if ((seriesId || '').toLowerCase() === 'imsa') {
            var schedSection = document.querySelector('.schedule-section');
            if (schedSection) {
              var note = document.getElementById('imsa-endurance-note');
              if (!note) {
                note = document.createElement('p');
                note.id = 'imsa-endurance-note';
                note.className = 'schedule-note';
                schedSection.appendChild(note);
              }
              note.textContent = 'All classes: races that are part of the Michelin Endurance Cup.';
            }
          }
        }
        var seriesKeyEvents = (seriesId || '').toLowerCase();
        if (!Array.isArray(events) || events.length === 0) {
          // For IndyCar, F1, F2, F3 use static schedules
          if (seriesKeyEvents === 'indycar' || seriesKeyEvents === 'f1' || seriesKeyEvents === 'f2' || seriesKeyEvents === 'f3') {
            renderScheduleRows([]);
            return;
          }
          // For WEC 2026 — static calendar (Prologue + 8 events) if API returned no events.
          if (seriesKeyEvents === 'wec') {
            var wecStatic = [
              { id: 'WEC_2026_PROLOGUE', name: 'WEC Prologue',         circuit_name: 'Imola Circuit',                location: 'Imola',            start_date: '2026-04-14', end_date: '2026-04-14' },
              { id: 'WEC_2026_1',        name: '6 Hours of Imola',     circuit_name: 'Imola Circuit',                location: 'Imola',            start_date: '2026-04-19', end_date: '2026-04-19' },
              { id: 'WEC_2026_2',        name: '6 Hours of Spa-Francorchamps', circuit_name: 'Circuit de Spa-Francorchamps', location: 'Stavelot',        start_date: '2026-05-09', end_date: '2026-05-09' },
              { id: 'WEC_2026_3',        name: '24 Hours of Le Mans',  circuit_name: 'Circuit de la Sarthe',         location: 'Le Mans',          start_date: '2026-06-13', end_date: '2026-06-14' },
              { id: 'WEC_2026_4',        name: '6 Hours of São Paulo', circuit_name: 'Interlagos Circuit',           location: 'São Paulo',        start_date: '2026-07-12', end_date: '2026-07-12' },
              { id: 'WEC_2026_5',        name: 'Lone Star Le Mans',    circuit_name: 'Circuit of the Americas',      location: 'Austin, Texas',    start_date: '2026-09-06', end_date: '2026-09-06' },
              { id: 'WEC_2026_6',        name: '6 Hours of Fuji',      circuit_name: 'Fuji Speedway',                location: 'Oyama, Shizuoka',  start_date: '2026-09-27', end_date: '2026-09-27' },
              { id: 'WEC_2026_7',        name: 'Qatar 1812 km',        circuit_name: 'Losail International Circuit', location: 'Qatar Lusail',     start_date: '2026-10-24', end_date: '2026-10-24' },
              { id: 'WEC_2026_8',        name: '8 Hours of Bahrain',   circuit_name: 'Bahrain International Circuit', location: 'Bahrain Sakhir',  start_date: '2026-11-07', end_date: '2026-11-07' }
            ];
            renderScheduleRows(wecStatic);
            return;
          }
          scheduleEmpty.classList.remove('hidden');
          scheduleEmpty.textContent = t('schedule.empty') || 'No schedule data yet.';
          return;
        }
        // Default order: sort by date, then time (AM before PM).
        events.sort(function (a, b) {
          var da = (a.start_date || a.date || '');
          var db = (b.start_date || b.date || '');
          if (da < db) return -1;
          if (da > db) return 1;
          var ta = parseTimeToMinutes(a.time_est || a.time_msk || '');
          var tb = parseTimeToMinutes(b.time_est || b.time_msk || '');
          return ta - tb;
        });

        // Prevent series mixing: keep only events of the target series.
        var expectedKey = (seriesId || '').toLowerCase();
        // For season slugs like f1-2026 events still arrive with series_id
        // of base series ("f1"), so when comparing also normalize —
        // strip `-YYYY` suffix.
        var expectedKeyNorm = expectedKey.replace(/-\d{4}$/, '');
        if (Array.isArray(events)) {
          events = events.filter(function (e) {
            var sid = (e && (e._seriesId || e.series_id || '')).toLowerCase();
            // For legacy data where _seriesId may be empty, allow all.
            return !sid || sid === expectedKey || sid === expectedKeyNorm;
          });
          events = filterVisibleEvents(events);
        }

        if (expectedKey === 'super_formula' && window.TGA && typeof window.TGA.collapseSuperFormulaScheduleEvents === 'function') {
          events = window.TGA.collapseSuperFormulaScheduleEvents(events);
        }

        renderScheduleRows(events);
        var scheduleTable = document.getElementById('schedule-table');
        if (scheduleTable) {
          var schThs = scheduleTable.querySelectorAll('thead th');
          var eventsCopy = events.slice();
          var numCols = schThs.length;
          [].forEach.call(schThs, function (th, col) {
            th.classList.add('sortable');
            var dir = 1;
            th.addEventListener('click', function () {
              eventsCopy.sort(function (a, b) {
                var va, vb;
                if (expectedKey === 'super_formula' && numCols === 4) {
                  function sfRdSortKey(ev) {
                    var lab = ev && ev._sfRdLabel;
                    if (lab) {
                      var m = String(lab).match(/^(\d+)/);
                      if (m) return parseInt(m[1], 10);
                    }
                    var idm = String((ev && ev.id) || '').match(/_(\d+)$/);
                    return idm ? parseInt(idm[1], 10) : 0;
                  }
                  if (col === 0) {
                    return dir * (sfRdSortKey(a) - sfRdSortKey(b));
                  }
                  if (col === 1) {
                    va = (a.start_date || a.date || '');
                    vb = (b.start_date || b.date || '');
                    return dir * (va < vb ? -1 : va > vb ? 1 : 0);
                  }
                  if (col === 3) {
                    var taa2 = parseTimeToMinutes(a.time_est || a.time_msk || '');
                    var tbb2 = parseTimeToMinutes(b.time_est || b.time_msk || '');
                    return dir * (taa2 - tbb2);
                  }
                  if (col === 2) {
                    var fa = (window.TGA && window.TGA.superFormulaVenueLine) ? window.TGA.superFormulaVenueLine(a) : ((a.circuit_name || '') + (a.location || ''));
                    var fb = (window.TGA && window.TGA.superFormulaVenueLine) ? window.TGA.superFormulaVenueLine(b) : ((b.circuit_name || '') + (b.location || ''));
                    return dir * (fa < fb ? -1 : fa > fb ? 1 : 0);
                  }
                  return 0;
                }
                var dateCol = numCols === 7 ? 5 : (numCols === 6 ? 4 : 1);
                var timeCol = numCols - 1;
                if (col === dateCol) {
                  va = (a.start_date || a.date || '');
                  vb = (b.start_date || b.date || '');
                  return dir * (va < vb ? -1 : va > vb ? 1 : 0);
                }
                if (col === timeCol) {
                  var ta = parseTimeToMinutes(a.time_est || a.time_msk || '');
                  var tb = parseTimeToMinutes(b.time_est || b.time_msk || '');
                  return dir * (ta - tb);
                }
                var nameCol = numCols === 7 ? 1 : (numCols === 6 ? 2 : 2);
                var circuitCol = numCols === 7 ? 2 : (numCols === 6 ? 3 : 3);
                var locationCol = numCols === 7 ? 3 : (numCols === 6 ? 3 : 2);
                va = col === 0 ? 0
                  : col === nameCol ? (a.name || '')
                  : col === circuitCol ? (a.circuit_name || a.location || '')
                  : col === locationCol ? (a.location || '')
                  : '';
                vb = col === 0 ? 0
                  : col === nameCol ? (b.name || '')
                  : col === circuitCol ? (b.circuit_name || b.location || '')
                  : col === locationCol ? (b.location || '')
                  : '';
                return dir * (va < vb ? -1 : va > vb ? 1 : 0);
              });
              [].forEach.call(schThs, function (t) { t.classList.remove('sort-asc', 'sort-desc'); });
              th.classList.add(dir === 1 ? 'sort-asc' : 'sort-desc');
              dir = -dir;
              renderScheduleRows(eventsCopy);
            });
          });
        }
      })
      .catch(function () {
        scheduleEmpty.classList.remove('hidden');
        scheduleEmpty.textContent = t('schedule.empty') || 'No schedule data yet.';
      });

    if (isF1) {
      renderF1HistoryFromStatic();
    }
  }

  function renderF1HistoryFromStatic() {
    var historyTable = document.getElementById('history-table');
    var historyBody = document.querySelector('#history-table tbody');
    if (!historyTable || !historyBody) return;
    var earliestSeason = 1950;
    // Include all seasons with a defined race count (F1_RACES_PER_SEASON),
    // even if not finished yet (2026 season — empty champion cells).
    var lastSeason = 1950;
    for (var yk in F1_RACES_PER_SEASON) {
      if (Object.prototype.hasOwnProperty.call(F1_RACES_PER_SEASON, yk)) {
        var yn = parseInt(yk, 10);
        if (!isNaN(yn) && yn > lastSeason) lastSeason = yn;
      }
    }
    if (lastSeason < earliestSeason) return;
    var thead = historyTable.querySelector('thead tr');
    if (thead) {
      thead.innerHTML = '<th>Season</th><th>Races</th><th>Driver champion</th><th>Pts</th><th>Team</th><th>Chassis</th><th>Engine</th><th>Constructors champion</th><th>Pts</th>';
    }
    var rowsHtml = '';
    for (var season = lastSeason; season >= earliestSeason; season--) {
      var key = String(season);
      var racesVal = F1_RACES_PER_SEASON[key];
      var races = racesVal != null ? String(racesVal) : '—';
      var driver = F1_DRIVER_CHAMPIONS[key] || '—';
      var driverPts = F1_DRIVER_POINTS[key];
      var driverPtsCell = (driverPts != null ? String(driverPts) : '—');
      var constructor = F1_CONSTRUCTOR_CHAMPIONS[key] || '—';
      var ce = F1_CHASSIS_ENGINE[key] || null;
      var team = ce && ce.team ? ce.team : '—';
      var chassis = ce && ce.chassis ? ce.chassis : '—';
      var engine = ce && ce.engine ? ce.engine : '—';
      var constructorPts = F1_CONSTRUCTOR_POINTS[key];
      var constructorPtsCell = (constructorPts != null ? String(constructorPts) : '—');
      var seasonSlug = 'f1-' + season;
      var seasonLink = '<a href="/season/' + seasonSlug + '" class="season-link">' + season + '</a>';
      rowsHtml += '<tr>' +
        '<td>' + seasonLink + '</td>' +
        '<td>' + races + '</td>' +
        '<td>' + esc(driver) + '</td>' +
        '<td>' + driverPtsCell + '</td>' +
        '<td>' + esc(team) + '</td>' +
        '<td>' + esc(chassis) + '</td>' +
        '<td>' + esc(engine) + '</td>' +
        '<td>' + esc(constructor) + '</td>' +
        '<td>' + constructorPtsCell + '</td>' +
        '</tr>';
    }
    historyBody.innerHTML = rowsHtml;
    if (typeof makeSimpleTableSortable === 'function') makeSimpleTableSortable(historyTable);
  }


  function eventSeriesId(eventId) {
    if (!eventId) return '';
    var u = String(eventId).toUpperCase();
    // Universally extract series_id from event_id:
    // SUPER_FORMULA_2026_1 -> SUPER_FORMULA, NASCAR_TRUCK_2026_5 -> NASCAR_TRUCK, F1_2026_3 -> F1
    return u.replace(/_\d+.*$/, '');
  }

  function isF4SeriesId(seriesId) {
    var s = String(seriesId || '').toLowerCase();
    return s === 'f4_it' || s === 'smp_f4_ru';
  }

  /** Double-header weekends (e.g. Super Formula R1–2): no laps/distance table on overview; nav blocks in a row. */
  function eventIsMultiRoundWeekend(d) {
    if (!d || typeof d !== 'object') return false;
    var tables = (d.tables && typeof d.tables === 'object') ? d.tables
      : (d.Tables && typeof d.Tables === 'object') ? d.Tables
      : null;
    if (!tables) return false;
    var race = tables.race;
    if (race && Array.isArray(race.sessions) && race.sessions.length > 1) return true;
    var qual = tables.qualifying;
    if (qual && Array.isArray(qual.sessions) && qual.sessions.length > 1) return true;
    return false;
  }

  // ── Event page (blocks navigation) ──────────────────────────────────────
  var eventBlockDefs = [
    {
      id: 'bop', icon: '⚖',
      check: function (d) {
        var ev = ((d.event_id || '') + '').toLowerCase().replace(/\s+/g, '_');
        return ev === 'imsa_2026_1' || ev === 'imsa_2026_2' || ev === 'imsa_2026_3' || ev === 'imsa_2026_4';
      },
      meta: function (d) { return ''; }
    },
    {
      id: 'pre_season_tests', icon: '🔧',
      check: function (d) { return !!(d.tables && d.tables.pre_season_tests); },
      meta: function (d) { return d.tables && d.tables.pre_season_tests ? '' : ''; }
    },
    {
      id: 'entry-list', icon: '📋',
      check: function (d) {
        var sid = d.event_id && (eventSeriesId(d.event_id) || '').toLowerCase();
        return !!(d.entry_list) || sid === 'supercars' || sid === 'arca';
      },
      meta:  function (d) {
        var n = (d.entry_list && d.entry_list.length) ? d.entry_list.length : 0;
        return n + ' ' + (n === 1 ? t('meta.drivers.one') : t('meta.drivers.many'));
      }
    },
    {
      id: 'test', icon: '🧪',
      check: function (d) {
        var testTbl = d.tables && d.tables.test;
        if (testTbl && Array.isArray(testTbl.sessions) && testTbl.sessions.some(function (s) {
          return s && Array.isArray(s.rows) && s.rows.length > 0;
        })) return true;
        return !!(testTbl && testTbl.headers && Array.isArray(testTbl.rows) && testTbl.rows.length > 0);
      },
      meta: function (d) {
        var testTbl = d.tables && d.tables.test;
        if (!testTbl || !Array.isArray(testTbl.sessions)) return '';
        return testTbl.sessions.map(function (s) {
          return (s && s.title) ? String(s.title).trim() : '';
        }).filter(Boolean).join(' · ');
      }
    },
    {
      id: 'practice', icon: '⏱',
      check: function (d) {
        var tables = d.tables || {};
        var prac = tables.practice;
        if (prac && Array.isArray(prac.sessions) && prac.sessions.length > 0) return true;
        if (prac && prac.headers && Array.isArray(prac.rows) && prac.rows.length > 0) return true;
        return !!(tables.practice2 || tables.practice3 || tables.final_practice || tables.practice5) ||
          (d.event_id && (eventSeriesId(d.event_id) || '').toLowerCase() === 'supercars');
      },
      meta:  function (d) {
        var s = [];
        var tables = d.tables || {};
        var evKey = ((d.event_id || '') + '').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
        if (tables.practice && Array.isArray(tables.practice.sessions) && tables.practice.sessions.length) {
          tables.practice.sessions.forEach(function (sess, idx) {
            var tlabel = (sess && sess.title && String(sess.title).trim()) ? String(sess.title).trim() : (t('meta.practice1') + (idx > 0 ? ' ' + String(idx + 1) : ''));
            s.push(tlabel);
          });
        } else if (tables.practice) {
          s.push(t('meta.practice1'));
        }
        if (tables.practice2)      s.push(t('meta.practice2'));
        if (tables.practice3)      s.push(t('meta.practice3'));
        if (tables.final_practice) s.push(evKey === 'ELMS_2026_PROLOGUE' ? 'Practice 4' : t('meta.final_practice'));
        if (tables.practice5)      s.push('Practice 5');
        return s.join(' · ');
      }
    },
    {
      id: 'qualifying', icon: '⚡',
      check: function (d) {
        var tables = d.tables || {};
        if (tables.qualifying && Array.isArray(tables.qualifying.sessions) && tables.qualifying.sessions.length > 0) return true;
        return !!(tables.qualifying || tables.duel1 || tables.duel2 || tables.last_chance || tables.did_not_qualify) ||
          (d.event_id && (eventSeriesId(d.event_id) || '').toLowerCase() === 'supercars');
      },
      meta:  function (d) {
        var s = [];
        var tables = d.tables || {};
        if (tables.duel1)           s.push(t('meta.duel1'));
        if (tables.duel2)           s.push(t('meta.duel2'));
        if (tables.last_chance)     s.push(t('meta.last_chance'));
        if (tables.qualifying && Array.isArray(tables.qualifying.sessions) && tables.qualifying.sessions.length) {
          tables.qualifying.sessions.forEach(function (sess) {
            if (sess && sess.title) s.push(String(sess.title).trim());
          });
        } else if (tables.qualifying) {
          s.push(t('meta.qualifying'));
        }
        if (tables.did_not_qualify) s.push(t('meta.dnq'));
        return s.join(' · ');
      }
    },
    {
      id: 'race', icon: '🏁',
      check: function (d) {
        var series = (d.event_id && eventSeriesId(d.event_id)) ? (eventSeriesId(d.event_id) || '').toLowerCase() : '';
        var isStockCar = ['nascar_cup', 'noaps', 'nascar_truck', 'arca', 'nascar_modified'].indexOf(series) >= 0;
        if (series === 'supercars') return true;
        if (d.tables && (d.tables.starting_lineup || tgaStageTable(d.tables, 1) || tgaStageTable(d.tables, 2) || tgaStageTable(d.tables, 3) || tgaStageTable(d.tables, 4) || d.tables.race_results || d.tables.caution_breakdown || d.tables.race)) return true;
        if (d.race_statistics && Object.keys(d.race_statistics).length > 0) return true;
        if (isStockCar && d.tables && (d.tables.practice || d.tables.qualifying)) return true;
        return false;
      },
      meta: function (d) {
        var s = [];
        var seriesMeta = (d.event_id && eventSeriesId(d.event_id)) ? (eventSeriesId(d.event_id) || '').toLowerCase() : '';
        var isStockCarMeta = ['nascar_cup', 'noaps', 'nascar_truck', 'arca', 'nascar_modified'].indexOf(seriesMeta) >= 0;
        var raceResultsFirstMeta = isStockCarMeta && d.tables && d.tables.race_results && (
          (Array.isArray(d.tables.race_results.rows) && d.tables.race_results.rows.length > 0) ||
          (d.tables.race_results.format === 'allstar_stages' && Array.isArray(d.tables.race_results.stages) && d.tables.race_results.stages.length > 0)
        );
        var seriesMetaLc = (d.event_id && eventSeriesId(d.event_id)) ? (eventSeriesId(d.event_id) || '').toLowerCase() : '';
        if (d.tables && d.tables.starting_lineup && seriesMetaLc !== 'smp_f4_ru' && seriesMetaLc !== 'f4_it') s.push(t('meta.starting_grid'));
        if (raceResultsFirstMeta && d.tables.race_results) s.push(t('meta.race_results'));
        if (d.tables && tgaStageTable(d.tables, 1)) s.push(t('meta.stage1'));
        if (d.tables && tgaStageTable(d.tables, 2)) s.push(t('meta.stage2'));
        if (d.tables && tgaStageTable(d.tables, 3)) s.push(t('meta.stage3'));
        if (d.tables && tgaStageTable(d.tables, 4)) s.push(t('meta.stage4'));
        if (!raceResultsFirstMeta && d.tables && d.tables.race_results) s.push(t('meta.race_results'));
        return s.join(' · ');
      }
    }
  ];

  // Shared Race Statistics logic: parse "Field: value" and collect from race_statistics / race_results
  function parseStatRow(row) {
    var first = row[0] != null ? String(row[0]).trim() : '';
    var second = row[1] != null ? String(row[1]).trim() : '';
    if (!first) return null;
    var colonIdx = first.indexOf(':');
    if (colonIdx >= 0) {
      return { key: first.slice(0, colonIdx).trim(), val: (first.slice(colonIdx + 1).trim() || second) };
    }
    return { key: first, val: second };
  }
  function getEventRaceStats(d) {
    var stats = d.race_statistics && Object.keys(d.race_statistics).length > 0 ? d.race_statistics : null;
    if (!stats && d.tables && d.tables.race_statistics && d.tables.race_statistics.rows) {
      stats = {};
      d.tables.race_statistics.rows.forEach(function (row) {
        var p = parseStatRow(row);
        if (p && p.key) stats[p.key] = p.val;
      });
    }
    if ((!stats || Object.keys(stats).length === 0) && d.tables && d.tables.race_results && d.tables.race_results.rows) {
      var statKeys = ['Lead changes', 'Cautions / Laps', 'Red flags', 'Time of race', 'Average speed'];
      stats = {};
      d.tables.race_results.rows.forEach(function (row) {
        var p = parseStatRow(row);
        if (!p || !p.key) return;
        var nk = p.key.replace(/\s*\/\s*/g, ' / ').trim();
        if (statKeys.indexOf(nk) >= 0) stats[nk] = p.val;
      });
    }
    return stats && Object.keys(stats).length > 0 ? stats : null;
  }
  /** Matches stock-car event JSON (e.g. NOAPS): consistent row order regardless of object key order. */
  var RACE_STAT_DISPLAY_ORDER = ['Average speed', 'Cautions / Laps', 'Lead changes', 'Red flags', 'Time of race'];
  function orderedRaceStatKeys(stats) {
    var keys = Object.keys(stats);
    var ordered = [];
    RACE_STAT_DISPLAY_ORDER.forEach(function (k) {
      if (keys.indexOf(k) >= 0) ordered.push(k);
    });
    keys.forEach(function (k) {
      if (RACE_STAT_DISPLAY_ORDER.indexOf(k) < 0) ordered.push(k);
    });
    return ordered;
  }
  function renderRaceStatsTable(stats) {
    return '<h4 class="table-section-title">' + t('section.race_statistics') + '</h4>' +
      '<div class="table-wrap"><table class="data-table table-field-value"><thead><tr><th>' + t('th.field') + '</th><th>' + t('th.value') + '</th></tr></thead><tbody>' +
      orderedRaceStatKeys(stats).map(function (k) { return '<tr><td class="col-field">' + esc(dash(localizeStatKey(k))) + '</td><td>' + esc(dash(localizeStatValue(stats[k]))) + '</td></tr>'; }).join('') +
      '</tbody></table></div>';
  }

  function buildTableSection(title, tableData, extraClass, getRowClass, colWidths, subtitle, titleClass, mergeTeamCells) {
    if (!tableData || typeof tableData !== 'object') return null;
    var rows = Array.isArray(tableData.rows) ? tableData.rows : [];
    var headers = Array.isArray(tableData.headers) ? tableData.headers : [];
    if (headers.length === 0 && rows.length > 0 && rows[0] && rows[0].length > 0) {
      for (var hi = 0; hi < rows[0].length; hi++) headers.push('');
    }
    var cls = 'data-table' + (extraClass ? ' ' + extraClass : '');
    var noteColIndices   = {};
    var reasonColIndices = {};
    var noColIndices     = {};
    var driverColIndices = {};
    var driversColIndices = {};
    var teamColIndices   = {};
    headers.forEach(function (h, idx) {
      var lh = (h || '').toLowerCase().trim();
      if (translateValueHeaders.indexOf(lh)  >= 0) noteColIndices[idx]   = true;
      if (translateReasonHeaders.indexOf(lh) >= 0) reasonColIndices[idx] = true;
      if (lh === 'no' || lh === 'no.') noColIndices[idx] = true;
      if (lh === 'driver' || lh === 'driver name' || (lh.indexOf('driver') === 0 && lh.length <= 12)) driverColIndices[idx] = true;
      if (lh === 'drivers') driversColIndices[idx] = true;
      if (lh === 'team') teamColIndices[idx] = true;
    });
    var teamColIdx = -1;
    for (var ti = 0; ti < headers.length; ti++) { if (teamColIndices[ti]) { teamColIdx = ti; break; } }
    function isSeparatorRow(row) {
      if (!row || row.length === 0) return false;
      var first = (row[0] != null && String(row[0]).trim() !== '');
      if (!first) return false;
      for (var i = 1; i < row.length; i++) { if (row[i] != null && String(row[i]).trim() !== '') return false; }
      return true;
    }
    var teamRowSpan = [];
    if (mergeTeamCells && teamColIdx >= 0 && rows.length > 0) {
      for (var i = 0; i < rows.length; i++) teamRowSpan[i] = 0;
      for (var i = 0; i < rows.length; i++) {
        if (teamRowSpan[i] === -1) continue;
        if (isSeparatorRow(rows[i])) continue;
        var teamVal = (rows[i][teamColIdx] != null ? String(rows[i][teamColIdx]).trim() : '');
        var span = 1;
        for (var j = i + 1; j < rows.length; j++) {
          if (isSeparatorRow(rows[j])) break;
          var nextVal = (rows[j][teamColIdx] != null ? String(rows[j][teamColIdx]).trim() : '');
          if (nextVal === teamVal) { span++; teamRowSpan[j] = -1; } else break;
        }
        teamRowSpan[i] = span;
      }
    }
    function stripNumberPrefix(s) {
      if (s == null) return s;
      return String(s).replace(/^[\*\+]+/, '').trim();
    }
    var colgroup = '';
    if (colWidths && Array.isArray(colWidths) && colWidths.length === headers.length) {
      colgroup = '<colgroup>' + colWidths.map(function (w) { return '<col style="width:' + (w || '') + '">'; }).join('') + '</colgroup>';
    }
    var isPreSeasonTable = extraClass && extraClass.indexOf('pre-season-results-table') >= 0;
    var theadStyle = isPreSeasonTable ? ' style="display:table-header-group !important;visibility:visible !important"' : '';
    var theadTrStyle = isPreSeasonTable ? ' style="display:table-row !important;visibility:visible !important"' : '';
    var thStyle = isPreSeasonTable ? ' style="display:table-cell !important;visibility:visible !important"' : '';
    var thead = '<thead' + theadStyle + '><tr' + theadTrStyle + '>' + headers.map(function (h) { return '<th' + thStyle + '>' + esc(localizeTableHeader(h || '')) + '</th>'; }).join('') + '</tr></thead>';
    var tbodyRows = rows.length
      ? rows.map(function (row, rowIndex) {
          if (isSeparatorRow(row)) {
            var text = (row[0] != null ? String(row[0]).trim() : '');
            return '<tr class="table-separator-row"><td colspan="' + Math.max(1, headers.length) + '">' + esc(text) + '</td></tr>';
          }
          var rc = getRowClass ? getRowClass(row) : '';
          var emptyCell = (extraClass && extraClass.indexOf('caution-breakdown') >= 0) ? '' : '—';
          return '<tr' + (rc ? ' class="' + rc + '"' : '') + '>' + row.map(function (cell, ci) {
            if (mergeTeamCells && ci === teamColIdx && teamColIdx >= 0) {
              if (teamRowSpan[rowIndex] === -1) return '';
              if (teamRowSpan[rowIndex] > 0) {
                var teamVal = (cell != null && String(cell).trim() !== '') ? '<a href="/team/' + encodeURIComponent(slugify(String(cell).trim())) + '" class="track-link">' + esc(String(cell).trim()) + '</a>' : emptyCell;
                return '<td rowspan="' + teamRowSpan[rowIndex] + '" class="stockcar-team-cell">' + teamVal + '</td>';
              }
            }
            var val;
            if (teamColIndices[ci]) {
              val = (cell != null && String(cell).trim() !== '') ? '<a href="/team/' + encodeURIComponent(slugify(String(cell).trim())) + '" class="track-link">' + esc(String(cell).trim()) + '</a>' : emptyCell;
            } else if (driverColIndices[ci]) {
              var rawDriver = (cell != null ? String(cell) : '').trim();
              var crewNames = (window.TGA && window.TGA.splitDriverNames)
                ? window.TGA.splitDriverNames(rawDriver)
                : [rawDriver];
              if (rawDriver && crewNames.length > 1 && window.TGA && window.TGA.driversCellHtml) {
                val = window.TGA.driversCellHtml(rawDriver);
              } else {
                var d = rawDriver ? driverDisplayName(rawDriver) : '';
                if (d && /^[^,]+\s*,\s*[^,]+$/.test(d)) {
                  var parts = d.split(/\s*,\s*/);
                  d = (parts[1] + ' ' + parts[0]).trim();
                }
                val = d ? '<a href="/driver/' + encodeURIComponent(slugify(d)) + '" class="track-link">' + esc(d) + '</a>' : emptyCell;
              }
            } else if (driversColIndices[ci]) {
              var rawDrivers = (cell != null ? String(cell) : '').trim();
              if (rawDrivers && window.TGA && window.TGA.driversCellHtml) {
                val = window.TGA.driversCellHtml(rawDrivers, '<br>');
              } else {
                val = rawDrivers ? String(rawDrivers).split(/\s*;\s*/).map(function (p) {
                  var t = p.trim();
                  if (!t) return '';
                  var d = driverDisplayName(t);
                  return '<a href="/driver/' + encodeURIComponent(slugify(d)) + '" class="track-link">' + esc(d) + '</a>';
                }).filter(Boolean).join('<br>') : emptyCell;
              }
            } else {
              val = noteColIndices[ci]   ? localizeCellNote(cell)
                  : reasonColIndices[ci] ? localizeRaceReason(cell)
                  : noColIndices[ci]     ? stripNumberPrefix(String(cell != null ? cell : ''))
                  : cell;
            }
            var displayVal = (val == null || val === '' || (typeof val === 'string' && val.trim() === '')) ? emptyCell : val;
            var isHtml = typeof displayVal === 'string' && (displayVal.indexOf('<span') >= 0 || displayVal.indexOf('<a') >= 0);
            return '<td>' + (isHtml ? displayVal : esc(displayVal)) + '</td>';
          }).join('') + '</tr>';
        }).join('')
      : '<tr><td class="empty-row" colspan="' + Math.max(1, headers.length) + '">' + esc(t('error.no_section_data')) + '</td></tr>';
    var tbody = '<tbody>' + tbodyRows + '</tbody>';
    var titleCls = 'table-section-title' + (titleClass ? ' ' + titleClass : '');
    var titleBlock = (title ? '<h4 class="' + titleCls + '">' + esc(title) + '</h4>' : '');
    var subtitleBlock = (subtitle ? '<p class="table-section-subtitle">' + esc(subtitle) + '</p>' : '');
    var html = titleBlock + subtitleBlock +
      '<div class="table-wrap"><table class="' + cls + '">' + colgroup + thead + tbody + '</table></div>';
    return { html: html, rows: rows.slice(), getRowClass: getRowClass };
  }

  // Try to fill event header from schedule data (when full event JSON is missing).
  // Works in two steps:
  // 1) Try to find event in already loaded global cache (Next Events / Schedule).
  // 2) If missing — lazily fetch series events from /api/series/{series}/events and search there.
  function applyScheduleHeaderFallback(apiEventId, titleEl, metaEl) {
    try {
      if (!apiEventId) return;
      var upperId = String(apiEventId).toUpperCase();
      var seriesIdFromEvent = typeof eventSeriesId === 'function' ? eventSeriesId(upperId) : (upperId.split('_')[0] || '');

      function fillFromEventLike(match) {
        if (!match) return;
        var name = match.name || match.race || match.id || apiEventId || '';
        if (titleEl && name && (!titleEl.textContent || titleEl.textContent === '—')) {
          titleEl.textContent = name;
        }
        if (!metaEl) return;
        if (metaEl.textContent && metaEl.textContent.trim()) return;

        var formatDateRangeLongFn = (window.TGA && window.TGA.formatDateRangeLong) || (typeof formatDateRangeLong === 'function' ? formatDateRangeLong : null);
        var localizeDateFn = (typeof localizeDate === 'function' ? localizeDate : (window.TGA && window.TGA.localizeDate)) || null;
        var startIso = (match.start_date || '').slice(0, 10) || (match.date || '').slice(0, 10);
        var endIso = (match.end_date || '').slice(0, 10);
        var datePart = '';
        if (startIso && endIso && startIso !== endIso && typeof formatDateRangeLongFn === 'function') {
          datePart = formatDateRangeLongFn(startIso, endIso);
        } else if (startIso) {
          datePart = typeof localizeDateFn === 'function' ? localizeDateFn(startIso) : startIso;
        } else if (match.date) {
          datePart = typeof localizeDateFn === 'function' ? localizeDateFn(match.date) : match.date;
        }
        var circuit = match.circuit_name || match.track || '';
        var location = match.location || '';
        if (circuit) {
          datePart += (datePart ? ' · ' : '') + circuit;
        }
        if (location) {
          var locTrim = String(location).trim();
          var circTrim = String(circuit).trim();
          // Do not duplicate if location matches circuit_name/track or fully contains it.
          if (!circTrim ||
              (locTrim !== circTrim &&
               locTrim.indexOf(circTrim) === -1 &&
               circTrim.indexOf(locTrim) === -1)) {
            datePart += (datePart ? ', ' : '') + location;
          }
        }
        if (datePart) metaEl.textContent = datePart;
      }

      var getGlobalEventsCache = window.TGA && window.TGA.getGlobalEventsCache;
      var cache = getGlobalEventsCache ? getGlobalEventsCache() : null;
      if (Array.isArray(cache) && cache.length > 0) {
        var target = upperId;
        for (var i = 0; i < cache.length; i++) {
          var ev = cache[i];
          if ((ev && String(ev.id || '').toUpperCase()) === target) {
            fillFromEventLike(ev);
            return;
          }
        }
      }

      // If global cache is empty (direct URL visit), try loading
      // that series' events and take header from there.
      var fetchJSON = window.TGA && window.TGA.fetchJSON;
      if (!fetchJSON || !seriesIdFromEvent) return;
      var seriesSlug = seriesIdFromEvent.toLowerCase();
      fetchJSON('/api/series/' + encodeURIComponent(seriesSlug) + '/events')
        .then(function (events) {
          if (!Array.isArray(events)) return;
          var i;
          for (i = 0; i < events.length; i++) {
            var e = events[i];
            if ((e && String(e.id || '').toUpperCase()) === upperId) {
              fillFromEventLike(e);
              break;
            }
          }
        })
        .catch(function () {});
    } catch (e) {
      // Fallback must be safe; on error do nothing.
    }
  }

  function renderEventPage(eventId, section) {
    var loadGen = ++eventPageLoadGeneration;
    showView('view-event');
    loadedSeriesId = null;
    window.scrollTo(0, 0);
    var apiEventId = (eventId || '').toLowerCase().replace(/-/g, '_');
    var titleEl      = document.getElementById('event-title');
    var metaEl       = document.getElementById('event-meta');
    var crumbEl      = document.getElementById('event-breadcrumb');
    var sectionNavEl = document.getElementById('event-section-nav');
    var contentEl    = document.getElementById('event-content');
    titleEl.textContent = '—';
    metaEl.textContent  = '';
    if (crumbEl) {
      var sid0 = eventSeriesId(apiEventId);
      var seriesSlug0 = (sid0 || '').toLowerCase().replace(/_/g, '-');
      var seriesLabel0 = (sid0 || '').replace(/_/g, ' ');
      var evSlug0 = (eventId || '').toLowerCase();
      crumbEl.innerHTML =
        '<a href="/">' + t('breadcrumb.all') + '</a><span class="breadcrumb-sep">/</span>' +
        (sid0 ? '<a href="/series/' + encodeURIComponent(seriesSlug0) + '">' + esc(seriesLabel0) + '</a>' : '<span>' + esc(seriesLabel0 || '—') + '</span>') +
        '<span class="breadcrumb-sep">/</span>' +
        '<span>' + esc(evSlug0 || '—') + '</span>';
    }
    if (sectionNavEl) sectionNavEl.innerHTML = '';
    contentEl.innerHTML = '<p class="loading">' + t('loading') + '</p>';
    adjustEventPanelPadding();

    // If full event data not yet available, try at least to pull
    // name and date from global schedule (Next Events / Schedule).
    applyScheduleHeaderFallback(apiEventId.toUpperCase(), titleEl, metaEl);

    function renderWithData(d) {
      var rawEventIdUpper = String(d.event_id || apiEventId || '').toUpperCase();
      var isElmsPrologue = rawEventIdUpper === 'ELMS_2026_PROLOGUE';
      var isWecPrologue = rawEventIdUpper === 'WEC_2026_PROLOGUE';
      var elmsClassBlockDefs = [
        { id: 'lmp2', label: 'LMP2' },
        { id: 'lmp2-pro-am', label: 'LMP2 Pro/Am' },
        { id: 'lmp3', label: 'LMP3' },
        { id: 'lmgt3', label: 'LMGT3' }
      ];
      var elmsClassLabelsById = {
        'lmp2': 'LMP2',
        'lmp2-pro-am': 'LMP2 Pro/Am',
        'lmp3': 'LMP3',
        'lmgt3': 'LMGT3'
      };
      var wecSessionBlockDefs = [
        { id: 'hypercar', label: 'Hypercar' },
        { id: 'lmgt3', label: 'LMGT3' }
      ];
      var wecSessionLabelsById = {
        'hypercar': 'Hypercar',
        'lmgt3': 'LMGT3'
      };
      var activeSection = section;
      if (isElmsPrologue && (activeSection === 'entry-list' || activeSection === 'practice')) {
        activeSection = 'lmp2';
      }
      if (isWecPrologue && (activeSection === 'entry-list' || activeSection === 'practice')) {
        activeSection = 'hypercar';
      }
      var rawName = (d.name && String(d.name).trim()) || d.race || d.event_id || 'Event';
      var seriesIdForName = eventSeriesId(d.event_id || apiEventId);
      // For F1: strip "F1 — " / "F1 - " prefix from event name.
      if (seriesIdForName && seriesIdForName.toUpperCase() === 'F1' && typeof rawName === 'string') {
        rawName = rawName.replace(/^F1\s*[—-]\s*/i, '');
      }
      var eventName   = rawName;
      var seriesId    = eventSeriesId(d.event_id || apiEventId);
      var seriesLabel = seriesId.replace(/_/g, ' ');

      // Update category class on <body> for contextual styles (incl. stock-car tables on event page)
      var bodyEl = document.body;
      if (bodyEl) {
        var seriesIdUpper = (seriesId || '').toUpperCase();
        var seriesIdLower = (seriesId || '').toLowerCase();
        bodyEl.classList.remove('cat-openwheel', 'cat-stockcar', 'cat-endurance', 'cat-touring');
        var catKey = categoryBySeriesId[seriesIdUpper];
        if (catKey) bodyEl.classList.add('cat-' + catKey);
        Array.from(bodyEl.classList).forEach(function (cls) {
          if (cls.indexOf('series-') === 0) bodyEl.classList.remove(cls);
        });
        if (seriesIdLower) bodyEl.classList.add('series-' + seriesIdLower);
        Array.from(bodyEl.classList).forEach(function (cls) {
          if (/^ev-/.test(cls)) bodyEl.classList.remove(cls);
        });
        if (apiEventId) {
          bodyEl.classList.add('ev-' + String(apiEventId).toLowerCase().replace(/_/g, '-'));
        }
      }
      var blockDef    = null;
      for (var bi = 0; bi < eventBlockDefs.length; bi++) {
        if (eventBlockDefs[bi].id === activeSection) { blockDef = eventBlockDefs[bi]; break; }
      }
      var sectionLabel = '';
      if (isWecPrologue && activeSection && wecSessionLabelsById[activeSection]) {
        sectionLabel = wecSessionLabelsById[activeSection];
      } else if (isElmsPrologue && activeSection && elmsClassLabelsById[activeSection]) {
        sectionLabel = elmsClassLabelsById[activeSection];
      } else {
        sectionLabel = blockDef ? t('block.' + blockDef.id) : '';
      }
      titleEl.textContent = activeSection ? sectionLabel : eventName;
      var datePart = '';
      var sessionRange = typeof getEventSessionDateRange === 'function' ? getEventSessionDateRange(d) : null;
      var startIso, endIso;
      if (sessionRange && sessionRange.minIso) {
        startIso = sessionRange.minIso;
        endIso = sessionRange.maxIso || startIso;
      } else {
        startIso = (d.start_date || '').slice(0, 10);
        endIso = (d.end_date || '').slice(0, 10);
      }
      if (startIso && endIso && startIso !== endIso && typeof formatDateRangeLong === 'function') {
        datePart = formatDateRangeLong(startIso, endIso);
      } else if (startIso) {
        datePart = typeof localizeDate === 'function' ? localizeDate(startIso) : startIso;
      } else {
        datePart = typeof localizeDate === 'function' ? localizeDate(d.date || '') : String(d.date || '').trim();
      }
      if (d.track) datePart += (datePart ? ' · ' : '') + d.track;
      if (d.location) {
        var locTrimMeta = String(d.location).trim();
        var trackTrimMeta = String(d.track || '').trim();
        if (!trackTrimMeta ||
            (locTrimMeta !== trackTrimMeta &&
             locTrimMeta.indexOf(trackTrimMeta) === -1 &&
             trackTrimMeta.indexOf(locTrimMeta) === -1)) {
          datePart += (datePart ? ', ' : '') + d.location;
        }
      }
      metaEl.textContent = datePart;
      document.title = (activeSection ? sectionLabel + ' — ' : '') + eventName + ' — The Grid Archive (TGA)';
      var eventSlugForUrl = (d.event_id || eventId || '').toLowerCase().replace(/_/g, '-');

      // Breadcrumbs: All series / F1 / (optional F1 20XX) / Event / Section
      var crumb = '<a href="/">' + t('breadcrumb.all') + '</a><span class="breadcrumb-sep">/</span>' +
        '<a href="/series/' + encodeURIComponent((seriesId || '').toLowerCase().replace(/_/g, '-')) + '">' + esc(seriesLabel) + '</a>';

      // For F1 try to extract season year from event_id (F1_2025_1) or URL slug (f1-2025-1)
      var isF1Series = ((seriesId || '').toUpperCase() === 'F1');
      if (isF1Series) {
        var evIdRaw = String(d.event_id || eventId || '');
        var evIdUpper = evIdRaw.toUpperCase();
        var seasonYear = null;
        var mId = evIdUpper.match(/^F1_(\d{4})_/);
        if (mId && mId[1]) {
          seasonYear = mId[1];
        } else {
          var mSlug = evIdRaw.match(/f1-(\d{4})-/i);
          if (mSlug && mSlug[1]) seasonYear = mSlug[1];
        }
        if (seasonYear) {
          var seasonSlug = 'f1-' + seasonYear;
          crumb += '<span class="breadcrumb-sep">/</span>' +
            '<a href="/season/' + seasonSlug + '">F1 ' + seasonYear + '</a>';
        }
      }

      crumb += '<span class="breadcrumb-sep">/</span>';
      if (activeSection) {
        crumb += '<a href="/event/' + encodeURIComponent(eventSlugForUrl) + '">' + esc(eventName) + '</a>' +
          '<span class="breadcrumb-sep">/</span><span>' + esc(sectionLabel) + '</span>';
      } else {
        crumb += '<span>' + esc(eventName) + '</span>';
      }
      crumbEl.innerHTML = crumb;

      // Section nav — within subsection only
      if (sectionNavEl) {
        if (activeSection) {
          var visibleBlocks = [];
          if (isWecPrologue) {
            visibleBlocks = wecSessionBlockDefs.slice();
          } else if (isElmsPrologue) {
            visibleBlocks = elmsClassBlockDefs.slice();
          } else {
            for (var bj = 0; bj < eventBlockDefs.length; bj++) {
              if (eventBlockDefs[bj].check(d)) visibleBlocks.push(eventBlockDefs[bj]);
            }
          }
          var base = '/event/' + encodeURIComponent(eventSlugForUrl);
          sectionNavEl.innerHTML = visibleBlocks.map(function (b) {
            var active = activeSection === b.id ? ' active' : '';
            var label = ((isWecPrologue || isElmsPrologue) && b.label) ? b.label : t('block.' + b.id);
            return '<a href="' + base + '/' + b.id + '" class="nav-link' + active + '">' + esc(label) + '</a>';
        }).join('');
        } else {
          sectionNavEl.innerHTML = '';
        }
      }

      if (activeSection) {
        renderEventSectionContent(d, activeSection, contentEl, apiEventId);
      } else {
        if (contentEl) contentEl.removeAttribute('data-event-section');
        renderEventOverviewContent(d, apiEventId, contentEl);
      }
      adjustEventPanelPadding();
    }

    // If event is already cached, show it immediately,
    // but still fetch fresh data from server (cache must not hide JSON edits).
    if (eventCache[apiEventId]) {
      renderWithData(eventCache[apiEventId]);
    }

    function normalizeEventPayload(d) {
      if (!d || typeof d !== 'object') return d;
      if (d.data && typeof d.data === 'object') d = d.data;
      if (d.event && typeof d.event === 'object') d = d.event;
      if (Array.isArray(d) && d.length > 0) d = d[0];
      return d;
    }

    function hasDetailedEventPayload(d) {
      if (!d || typeof d !== 'object') return false;
      var tables = d.tables && typeof d.tables === 'object' ? d.tables : null;
      if (tables && Object.keys(tables).length > 0) return true;
      if (Array.isArray(d.entry_list) && d.entry_list.length > 0) return true;
      if (d.event_preview && String(d.event_preview).trim()) return true;
      if (d.event_preview_ru && String(d.event_preview_ru).trim()) return true;
      if (d.laps != null && String(d.laps).trim() !== '') return true;
      if (d.distance != null && String(d.distance).trim() !== '') return true;
      if (Array.isArray(d.youtube_highlights) && d.youtube_highlights.length > 0) return true;
      if (d.youtube_id && String(d.youtube_id).trim()) return true;
      if (d.highlights_url && String(d.highlights_url).trim()) return true;
      return false;
    }

    function fetchEventPayloadOnce() {
      return fetchJSON('/api/events/' + encodeURIComponent(apiEventId) + '?_=' + Date.now())
        .then(normalizeEventPayload);
    }

    fetchEventPayloadOnce()
      .then(function (d) {
        if (loadGen !== eventPageLoadGeneration) return null;
        if (!d || typeof d !== 'object') throw new Error('Invalid response');
        // Sometimes SPA navigation returns short payload without tables.
        // Make second request and prefer more detailed response.
        if (!hasDetailedEventPayload(d)) {
          return fetchEventPayloadOnce()
            .then(function (d2) {
              if (loadGen !== eventPageLoadGeneration) return null;
              if (d2 && hasDetailedEventPayload(d2)) return d2;
              return d;
            })
            .catch(function () {
              return d;
            });
        }
        return d;
      })
      .then(function (d) {
        if (loadGen !== eventPageLoadGeneration || !d) return;
        eventCache[apiEventId] = d;
        try {
          renderWithData(d);
        } catch (err) {
          logger.error('renderEventPage render error', err);
          contentEl.innerHTML = '<p class="empty-msg">' + (t('error.no_section_data') || 'Error displaying content') + '.</p>';
          adjustEventPanelPadding();
        }
      })
      .catch(function (err) {
        if (loadGen !== eventPageLoadGeneration) return;
        var msg = (err && err.message) ? String(err.message) : '';
        var isNotFound = msg === 'Not found' || msg.indexOf('404') >= 0;
        titleEl.textContent = isNotFound ? t('error.event_not_found') : '—';
        if (sectionNavEl) sectionNavEl.innerHTML = '';
        contentEl.innerHTML = '<p class="empty-msg">' + (isNotFound ? t('error.event_not_found') : (t('error.no_section_data') || 'Error loading event')) + '.</p>';
        adjustEventPanelPadding();
      });
  }

  function renderEventOverviewContent(d, eventId, contentEl) {
    if (!d || typeof d !== 'object') {
      contentEl.innerHTML = '<p class="empty-msg">' + t('error.no_section_data') + '</p>';
        return;
      }
    // Special case: for IMSA 2026 Pre Season Test show Pre-Season Tests immediately,
    // without tile block on overview.
    var evKeyOverview = ((d.event_id || eventId || '') + '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_');
    var eventName = (d.name && String(d.name).trim()) || d.race || d.event_id || eventId || 'Event';
    var datePart = d.date || d.start_date || d.startDate || '';
    if (evKeyOverview === 'IMSA_2026_PRE_SEASON_TEST' || evKeyOverview === 'F1_2026_PRE_SEASON_TEST_1' || evKeyOverview === 'F1_2026_PRE_SEASON_TEST_2') {
      renderEventSectionContent(d, 'pre_season_tests', contentEl, null);
      return;
    }
    var html = '';
    try {
    var tablesOverview = (d && d.tables && typeof d.tables === 'object') ? d.tables
      : (d && d.Tables && typeof d.Tables === 'object') ? d.Tables
      : {};
    // Laps/Distance — hide for Supercars, IMSA, WEC, Formula 2, Formula 3 and Formula 4
    var infoItems = [];
    var seriesLc = (eventSeriesId(eventId) || '').toLowerCase();
    var isFujiSuperGt2026 = evKeyOverview === 'SUPER_GT_2026_2';
    var isMultiRoundWeekend = eventIsMultiRoundWeekend(d);
    if (!isMultiRoundWeekend && seriesLc !== 'supercars' && seriesLc !== 'imsa' && seriesLc !== 'wec' && seriesLc !== 'f2' && seriesLc !== 'f3' && seriesLc !== 'dtm' && seriesLc !== 'frec' && seriesLc !== 'psc' && !isFujiSuperGt2026 && !isF4SeriesId(seriesLc)) {
      if (Object.prototype.hasOwnProperty.call(d, 'laps')) {
        var lapsTrim = d.laps != null ? String(d.laps).trim() : '';
        infoItems.push([t('section.laps'), lapsTrim !== '' ? trimTrailingZeros(String(d.laps)) : '']);
      }
      if (Object.prototype.hasOwnProperty.call(d, 'distance')) {
        var distTrim = d.distance != null ? String(d.distance).trim() : '';
        infoItems.push([t('section.distance'), distTrim !== '' ? localizeDistance(String(d.distance)) : '']);
      }
    }
    var visibleBlocks = [];
    if (evKeyOverview === 'ELMS_2026_PROLOGUE') {
      visibleBlocks = [
        { id: 'lmp2', label: 'LMP2' },
        { id: 'lmp2-pro-am', label: 'LMP2 Pro/Am' },
        { id: 'lmp3', label: 'LMP3' },
        { id: 'lmgt3', label: 'LMGT3' }
      ];
    } else if (evKeyOverview === 'WEC_2026_PROLOGUE') {
      visibleBlocks = [
        { id: 'hypercar', label: 'Hypercar' },
        { id: 'lmgt3', label: 'LMGT3' }
      ];
    } else {
      for (var bi = 0; bi < eventBlockDefs.length; bi++) {
        if (eventBlockDefs[bi].check(d)) visibleBlocks.push(eventBlockDefs[bi]);
      }
    }
    if (infoItems.length > 0 || visibleBlocks.length > 0) {
      html += '<div class="event-overview-laps-and-blocks">';
      if (infoItems.length > 0) {
        html += '<div class="table-wrap"><table class="data-table table-field-value"><thead><tr><th>' + t('th.field') + '</th><th>' + t('th.value') + '</th></tr></thead><tbody>' +
          infoItems.map(function (p) { return '<tr><td class="col-field">' + esc(dash(p[0])) + '</td><td>' + esc(dash(p[1])) + '</td></tr>'; }).join('') +
          '</tbody></table></div>';
      }
      if (visibleBlocks.length > 0) {
        var seriesForBlocks = (eventSeriesId(eventId) || '').toLowerCase();
        var isRowBlocksEvent = isMultiRoundWeekend || seriesForBlocks === 'supercars' || seriesForBlocks === 'elms' || seriesForBlocks === 'dtm' || seriesForBlocks === 'frec' || seriesForBlocks === 'f2' || seriesForBlocks === 'f4_it' || seriesForBlocks === 'smp_f4_ru' || seriesForBlocks === 'gtwce_end' || seriesForBlocks === 'gtwce_sprint' || seriesForBlocks === 'imsa' || seriesForBlocks === 'wec' || seriesForBlocks === 'psc' || evKeyOverview === 'ELMS_2026_PROLOGUE' || evKeyOverview === 'WEC_2026_PROLOGUE' || evKeyOverview === 'SUPER_GT_2026_2';
        var blocksClass = 'event-blocks ' + (isRowBlocksEvent ? 'event-blocks--row' : 'event-blocks--2x2');
        html += '<div class="' + blocksClass + '">' +
          visibleBlocks.map(function (b) {
            var blockLabel = b.label || t('block.' + b.id) || b.id;
            return '<a href="/event/' + encodeURIComponent((eventId || '').toLowerCase().replace(/_/g, '-')) + '/' + b.id + '" class="event-block">' +
              '<span class="event-block-label">' + esc(blockLabel) + '</span>' +
            '</a>';
          }).join('') + '</div>';
      }
      html += '</div>';
    }

    // Track info — pick Russian version when lang === 'ru' and it exists.
    // Empty event_preview / event_preview_ru: show heading and paragraph (draft for JSON edits).
    var hasPreviewKey = Object.prototype.hasOwnProperty.call(d, 'event_preview') ||
      Object.prototype.hasOwnProperty.call(d, 'event_preview_ru');
    var previewRu = (d.event_preview_ru != null && typeof d.event_preview_ru === 'string') ? d.event_preview_ru.trim() : '';
    var previewEn = (d.event_preview != null && typeof d.event_preview === 'string') ? d.event_preview : '';
    var previewTextCombined = (lang === 'ru' && previewRu) ? previewRu : previewEn;
    var previewTextBody = '';
    if (previewTextCombined && previewTextCombined.length > 0) {
      previewTextBody = previewTextCombined
        .replace(/\s*\[\d+\]\s*/g, ' ')
        .replace(/—/g, '-')
        .replace(/\s+/g, ' ')
        .trim();
      if (lang === 'ru' && !(d.event_preview_ru && d.event_preview_ru.trim())) {
        previewTextBody = localizeEventPreview(previewTextBody);
      }
    }
    var overviewPreviewBlock = previewTextBody.length > 0 || hasPreviewKey;
    if (overviewPreviewBlock) {
      html += '<h4 class="table-section-title">' + t('section.event_preview') + '</h4><p class="event-preview-text">' +
        (previewTextBody.length > 0 ? esc(previewTextBody) : '') + '</p>';
    }
    if (d.tyre_compounds && typeof d.tyre_compounds === 'string' && d.tyre_compounds.trim()) {
      html += '<p class="event-preview-text tyre-compounds-text">' + esc(d.tyre_compounds.trim()) + '</p>';
    }

    // Highlights — YouTube (preferred) or external link.
    var highlightsList = Array.isArray(d.youtube_highlights) && d.youtube_highlights.length > 0
      ? d.youtube_highlights
      : (d.youtube_id && typeof d.youtube_id === 'string' && d.youtube_id.trim().length > 0)
        ? [{ id: d.youtube_id.trim(), title: t('section.highlights') }]
        : (d.highlights_url && typeof d.highlights_url === 'string' && d.highlights_url.trim().length > 0)
          ? [{ url: d.highlights_url.trim(), title: t('section.highlights') }]
          : [];
    if (highlightsList.length > 0) {
      var hasSingleRaceSession = false;
      if (tablesOverview && tablesOverview.race && Array.isArray(tablesOverview.race.sessions)) {
        hasSingleRaceSession = tablesOverview.race.sessions.length === 1;
      } else if (tablesOverview && tablesOverview.race_results &&
                 !tgaStageTable(tablesOverview, 1) && !tgaStageTable(tablesOverview, 2) && !tgaStageTable(tablesOverview, 3)) {
        hasSingleRaceSession = true;
      }
      var videoWrapCls = 'video-embed-wrap' + ((highlightsList.length === 1 && hasSingleRaceSession) ? ' video-embed-wrap--single' : '');
      html += '<div class="' + videoWrapCls + '">';
      if (highlightsList.length === 1) {
        html += '<h4 class="table-section-title">' + esc(highlightsList[0].title || t('section.highlights')) + '</h4>';
      } else {
        html += '<h4 class="table-section-title">' + t('section.highlights') + '</h4>';
      }
      highlightsList.forEach(function (item, idx) {
        var rawId = (item.id || item.youtube_id || '').toString().trim();
        var hasYoutubeId = rawId.length > 0;
        if (hasYoutubeId) {
          var yid = rawId.replace(/[^a-zA-Z0-9_\-]/g, '');
          if (!yid) return;
          // Remove caption under preview if it is the only video (heading already above).
          var showLabel = (highlightsList.length > 1);
          var label = (showLabel && item.title)
            ? '<p class="video-facade-label">' + esc(item.title) + '</p>'
            : '';
          var thumbBase = 'https://img.youtube.com/vi/' + yid + '/';
          var thumbFallback = 'onerror="var s=this.src;if(s.indexOf(\'maxresdefault\')!==-1){this.src=s.replace(\'maxresdefault\',\'sddefault\');this.onerror=function(){this.src=s.replace(\'maxresdefault\',\'hqdefault\');this.onerror=null;};}else if(s.indexOf(\'sddefault\')!==-1){this.src=s.replace(\'sddefault\',\'hqdefault\');this.onerror=null;}"';
          var watchUrl = 'https://www.youtube.com/watch?v=' + encodeURIComponent(yid);
          html += '<div class="video-facade-wrap">' +
            '<a class="video-facade video-facade--youtube" href="' + esc(watchUrl) + '" target="_blank" rel="noopener noreferrer" ' +
              'aria-label="' + esc((item.title || t('section.highlights')) + ' — ' + t('section.watch_on_youtube')) + '">' +
              '<img src="' + thumbBase + 'maxresdefault.jpg" ' + thumbFallback + ' ' +
                'alt="' + esc(item.title || 'Highlights') + '" loading="lazy" decoding="async">' +
              '<span class="video-play-btn" aria-hidden="true"></span>' +
            '</a>' +
            label +
          '</div>';
        } else {
          // External source (e.g. official video on formula1.com).
          var url = (item && (item.url || item.href || item.link)) || (d && d.highlights_url);
          if (!url) return;
          var extLabel = item.title || t('section.highlights') || 'Highlights';
          var thumbAttr = '';
          if (item.thumb) {
            var thumbUrl = String(item.thumb || '').trim();
            if (thumbUrl) {
              thumbAttr = '<img class="video-external-thumb" src="' + esc(thumbUrl) + '" alt="' + esc(extLabel) + '" loading="lazy" decoding="async">';
            }
          }
          html += '<div class="video-facade-wrap">' +
            '<a class="video-external-link" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' +
              thumbAttr +
              '<span class="video-external-label">' + esc(extLabel) + '</span>' +
            '</a>' +
          '</div>';
        }
      });
      html += '</div>';
    }

    // Fallback: if highlights list is empty for some reason,
    // but event has highlights_url, show simple external link.
    if ((!highlightsList || highlightsList.length === 0) &&
        d.highlights_url && typeof d.highlights_url === 'string' &&
        d.highlights_url.trim().length > 0) {
      var hlUrl = d.highlights_url.trim();
      html += '<p class="event-preview-text"><a class="video-external-inline-link" href="' +
        esc(hlUrl) + '" target="_blank" rel="noopener noreferrer">' +
        esc(t('section.highlights') || 'Highlights') + '</a></p>';
    }

    // Race statistics — same table (FIELD / VALUE, colon parsing) for all series
    var stats = getEventRaceStats(d);
    if (stats && Object.keys(stats).length > 0) {
      html += renderRaceStatsTable(stats);
    }

    var hasHighlightsSection = (highlightsList && highlightsList.length > 0) ||
      (d.highlights_url && typeof d.highlights_url === 'string' && d.highlights_url.trim().length > 0);
    var hasTyreLine = !!(d.tyre_compounds && typeof d.tyre_compounds === 'string' && d.tyre_compounds.trim());
    if (infoItems.length === 0 && visibleBlocks.length === 0 && !overviewPreviewBlock && !hasTyreLine &&
        !hasHighlightsSection && !(stats && Object.keys(stats).length > 0)) {
      html += '<p class="empty-msg">' + t('error.no_data') + '</p>';
    }

    } catch (err) {
      logger.error('renderEventOverviewContent', err);
      contentEl.innerHTML = '<p class="empty-msg">' + t('error.no_section_data') + '</p>';
      return;
    }

    contentEl.innerHTML = html || ('<p class="empty-msg">' + t('error.no_section_data') + '</p>');
  }

  // Session meta: horizontal table — Date, Time, optional Race day, Length, Session, Start
  function buildSessionMetaTable(meta) {
    if (!meta || typeof meta !== 'object') return '';
    var order = ['Date', 'Time', 'Race day', 'Length', 'Session', 'Start'];
    var keys = order.filter(function (k) { return meta.hasOwnProperty(k) && meta[k] != null && String(meta[k]).trim() !== ''; });
    var extra = Object.keys(meta).filter(function (k) {
      if (k === 'Championship') return false;
      if (keys.indexOf(k) >= 0) return false;
      return meta[k] != null && String(meta[k]).trim() !== '';
    });
    extra.sort();
    keys = keys.concat(extra);
    if (!keys.length) return '';
    var head = keys.map(function (k) { return '<th>' + esc(k) + '</th>'; }).join('');
    var vals = keys.map(function (k) { return '<td>' + esc(String(meta[k]).trim()) + '</td>'; }).join('');
    return '<h4 class="table-section-title">Session info</h4>' +
      '<div class="table-wrap event-pre-season-meta-wrap">' +
      '<table class="data-table table-field-value session-meta-table session-meta-table--horizontal">' +
      '<thead><tr>' + head + '</tr></thead><tbody><tr>' + vals + '</tr></tbody></table></div>';
  }

  function renderRaceContent(d, contentEl) {
    var tables = (d && d.tables && typeof d.tables === 'object') ? d.tables
      : (d && d.Tables && typeof d.Tables === 'object') ? d.Tables
      : {};
    var html = '';
    var sortQueue = [];

    var seriesId = eventSeriesId(d.event_id || '');
    var seriesIdLower = (seriesId || '').toLowerCase();
    var isSupercars = seriesIdLower === 'supercars';
    var isStockCarSeriesRace = ['nascar_cup', 'noaps', 'nascar_truck', 'arca', 'nascar_modified'].indexOf(seriesIdLower) >= 0;
    var isNascarModified = seriesIdLower === 'nascar_modified';
    var isSmpF4Ru = seriesIdLower === 'smp_f4_ru';
    var evKeyEvent = ((d.event_id || '') + '').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
    var isImsaChampionshipRound = /^IMSA_\d{4}_\d+$/.test(evKeyEvent);
    function normalizeRaceEngineColumns(tableData) {
      if (!tableData || !Array.isArray(tableData.headers) || !Array.isArray(tableData.rows)) return tableData;
      if ((seriesId || '').toUpperCase() !== 'SUPER_FORMULA') return tableData;
      var engineIdx = -1;
      for (var hi = 0; hi < tableData.headers.length; hi++) {
        if (String(tableData.headers[hi] || '').trim().toLowerCase() === 'engine') {
          engineIdx = hi;
          break;
        }
      }
      if (engineIdx < 0) return tableData;
      var rows = tableData.rows.map(function (r) {
        var row = Array.isArray(r) ? r.slice() : [];
        if (engineIdx >= row.length) return row;
        var s = String(row[engineIdx] == null ? '' : row[engineIdx]).trim();
        var u = s.toUpperCase();
        if (u.indexOf('HONDA') >= 0 || u.indexOf('HR-417E') >= 0) row[engineIdx] = 'Honda HR-417E';
        else if (u.indexOf('TOYOTA') >= 0 || u.indexOf('TRD01F') >= 0 || u.indexOf('TRD-01F') >= 0) row[engineIdx] = 'Toyota TRD-01F';
        return row;
      });
      return { headers: tableData.headers.slice(), rows: rows };
    }
    var byNumber = (isStockCarSeriesRace && d.entry_list && d.entry_list.length)
      ? buildTeamNamesByNumberFromEntryList(d.entry_list)
      : (d.team_names_by_number && typeof d.team_names_by_number === 'object' ? d.team_names_by_number : null);
    function applyTeamNameByNumber(rows, numberColIdx, teamColIdx) {
      if (!byNumber) return rows;
      return rows.map(function (row) {
        var r = row.slice();
        if (r.length > Math.max(numberColIdx, teamColIdx) && r[numberColIdx] != null) {
          var num = String(r[numberColIdx]).trim();
          var teamFromTeams = byNumber[num] || byNumber[String(parseInt(num, 10))];
          if (teamFromTeams == null && num === '800') teamFromTeams = byNumber['8'];
          if (teamFromTeams != null) r[teamColIdx] = teamFromTeams;
        }
        return r;
      });
    }
    // Temporarily disable Grid/Pos special columns (arrows) in races
    var enableGridDelta = false;

    // Starting grid maps (Starting Grid) per Supercars race: raceIndex -> { carNo -> gridPos }
    var supercarsGridByRace = {};
    if (isSupercars && tables && tables.starting_lineup) {
      var sl = tables.starting_lineup;
      function buildGridFromStartingSession(sess, raceIndex) {
        if (!sess || !Array.isArray(sess.rows)) return;
        var grid = {};
        (sess.rows || []).forEach(function (row, idx) {
          var num = String(row[1] || '').trim();
          var pos = parseInt(row[0], 10);
          if (!num) return;
          if (isNaN(pos)) pos = idx + 1;
          grid[num] = pos;
        });
        if (Object.keys(grid).length > 0) supercarsGridByRace[raceIndex] = grid;
      }
      if (Array.isArray(sl.sessions) && sl.sessions.length > 0) {
        sl.sessions.forEach(function (sess, idx) { buildGridFromStartingSession(sess, idx + 1); });
      } else {
        buildGridFromStartingSession(sl, 1);
      }
    }

    function renderOneRaceSession(sess, eventData) {
      var out = '';
      function normalizeFinStTable(tbl) {
        if (!tbl || !Array.isArray(tbl.headers) || !Array.isArray(tbl.rows)) return tbl;
        var idx = -1;
        for (var i = 0; i < tbl.headers.length; i++) {
          var h = String(tbl.headers[i] || '').trim().toLowerCase();
          if (h === 'fin / st' || h === 'фин / st') { idx = i; break; }
        }
        if (idx < 0) return tbl;
        var headers = tbl.headers.slice();
        headers.splice(idx, 1, 'Fin', 'ST');
        var rows = tbl.rows.map(function (row) {
          var r = Array.isArray(row) ? row.slice() : [];
          var cell = (idx < r.length && r[idx] != null) ? String(r[idx]).trim() : '';
          var fin = cell;
          var st = '';
          if (cell.indexOf('/') >= 0) {
            var parts = cell.split('/');
            fin = String(parts[0] || '').trim();
            st = String(parts.slice(1).join('/') || '').trim();
          }
          if (st) {
            var m = st.match(/ST\s*\d+/i);
            st = m ? m[0].replace(/[^0-9]/g, '') : '';
          }
          r.splice(idx, 1, fin, st);
          return r;
        });
        return { headers: headers, rows: rows };
      }
      var titleText = sess && sess.title ? String(sess.title) : '';
      var hasRaceResultRows = sess && Array.isArray(sess.rows) && sess.rows.length > 0;
      // For all F1 events show human-readable session titles.
      // "Sprint" → "Sprint Results", "Race" / "Race classification" → "Race Results" (no separate "Results").
      if (evKeyEvent && evKeyEvent.indexOf('F1_') === 0) {
        var baseTitle = titleText.trim();
        if (/^sprint$/i.test(baseTitle)) {
          titleText = 'Sprint Results';
        } else if (/^race$/i.test(baseTitle) || /^race\s+classification$/i.test(baseTitle)) {
          titleText = 'Race Results';
        }
      }
      var skipVenueSubtitle = (seriesIdLower === 'f2' || seriesIdLower === 'f3');
      var isSuperGtRaceClassTitle = seriesIdLower === 'super_gt' && (titleText === 'GT500' || titleText === 'GT300');
      var isF1Event = evKeyEvent && evKeyEvent.indexOf('F1_') === 0;
      if (isSuperGtRaceClassTitle) {
        if (!isImsaChampionshipRound && !isSmpF4Ru && seriesIdLower !== 'f2' && !isF1Event) {
          out += buildSessionMetaTable(sess.meta);
        }
        if (titleText && hasRaceResultRows) out += '<h3 class="event-pre-season-title">' + esc(titleText) + '</h3>';
        if (!skipVenueSubtitle && sess.subtitle) out += '<p class="event-pre-season-subtitle">' + esc(sess.subtitle) + '</p>';
      } else {
        if (titleText && hasRaceResultRows) out += '<h3 class="event-pre-season-title">' + esc(titleText) + '</h3>';
        if (!skipVenueSubtitle && sess.subtitle) out += '<p class="event-pre-season-subtitle">' + esc(sess.subtitle) + '</p>';
        if (!isImsaChampionshipRound && !isSmpF4Ru && seriesIdLower !== 'f2' && !isF1Event) {
          out += buildSessionMetaTable(sess.meta);
        }
      }
      if (sess.headers && Array.isArray(sess.rows)) {
        var h = sess.headers;
        var raceRows;
        var raceHeaders;

        if (isSupercars && Array.isArray(h) && h.length >= 8) {
          // Supercars: drop Stops column, keep Pos, No., Driver, Team, Race time, Laps, Pts
          raceRows = applyTeamNameByNumber((sess.rows || []), 1, 3).map(function (r) {
            // [Pos, No, Driver, Team, Race time, Laps, Pts]
            return [
              r[0],
              r[1],
              r[2],
              r[3],
              r[5],
              r[6],
              r[7]
            ];
          });
          raceHeaders = [
            h[0],   // Pos
            h[1],   // No.
            h[2],   // Driver
            h[3],   // Team
            h[5],   // Race time
            h[6],   // Laps
            h[7]    // Pts
          ];
        } else {
          // Other series/races — team lookup by car number only
          var teamColIdxRace = (evKeyEvent && (evKeyEvent.indexOf('GTWCE_END_') === 0 || evKeyEvent.indexOf('GTWCE_SPRINT_') === 0)) ? 4 : 3;
          raceRows = applyTeamNameByNumber((sess.rows || []), 1, teamColIdxRace);
          raceHeaders = (sess.headers || []).slice();
          // IMSA: split TEAM/CAR/SPONSOR into TEAM and CAR, drop sponsor
          if (seriesIdLower === 'imsa' && raceHeaders.length > 0) {
            var teamCarColIdx = -1;
            for (var hi = 0; hi < raceHeaders.length; hi++) {
              var hText = (raceHeaders[hi] || '').toLowerCase().trim();
              if (hText === 'team/car/sponsor' || hText.indexOf('team/car') === 0) {
                teamCarColIdx = hi;
                break;
              }
            }
            if (teamCarColIdx >= 0) {
              raceHeaders = raceHeaders.slice(0, teamCarColIdx).concat(['TEAM', 'CAR'], raceHeaders.slice(teamCarColIdx + 1));
              raceRows = raceRows.map(function (r) {
                var cell = r[teamCarColIdx] != null ? String(r[teamCarColIdx]) : '';
                var parts = cell.split(/\s*\/\s*/);
                var team = (parts[0] || '').trim();
                var car = (parts.slice(1, 2).join(' / ') || '').trim();
                return r.slice(0, teamCarColIdx).concat([team, car], r.slice(teamCarColIdx + 1));
              });
            }
            // IMSA: remove FASTEST LAP column
            var fastestLapIdx = -1;
            for (var fl = 0; fl < raceHeaders.length; fl++) {
              if ((raceHeaders[fl] || '').toLowerCase().trim() === 'fastest lap') {
                fastestLapIdx = fl;
                break;
              }
            }
            if (fastestLapIdx >= 0) {
              raceHeaders = raceHeaders.slice(0, fastestLapIdx).concat(raceHeaders.slice(fastestLapIdx + 1));
              raceRows = raceRows.map(function (r) {
                return r.slice(0, fastestLapIdx).concat(r.slice(fastestLapIdx + 1));
              });
            }
            // IMSA: ST POS from qualifying (quali position = grid position)
            if (eventData && eventData.tables && eventData.tables.qualifying && Array.isArray(eventData.tables.qualifying.rows) && eventData.tables.qualifying.rows.length > 0) {
              var qualRows = eventData.tables.qualifying.rows;
              var qualPosByCar = {};
              qualRows.forEach(function (qRow) {
                var carNo = qRow[1] != null ? String(qRow[1]).trim() : '';
                var pos = qRow[0] != null ? String(qRow[0]).trim() : '';
                if (carNo) qualPosByCar[carNo] = pos;
              });
              var stPosColIdx = -1;
              for (var si = 0; si < raceHeaders.length; si++) {
                if ((raceHeaders[si] || '').toUpperCase().trim() === 'ST POS') { stPosColIdx = si; break; }
              }
              if (stPosColIdx >= 0) {
                raceRows = raceRows.map(function (r) {
                  var row = r.slice();
                  var carNo = row[1] != null ? String(row[1]).trim() : '';
                  var startPos = qualPosByCar[carNo];
                  if (startPos != null && row.length > stPosColIdx) row[stPosColIdx] = startPos;
                  return row;
                });
              }
            }
            // IMSA: for CAR NO show classic car number header
            for (var cn = 0; cn < raceHeaders.length; cn++) {
              if ((raceHeaders[cn] || '').toUpperCase().trim() === 'CAR NO') {
                raceHeaders = raceHeaders.slice();
                raceHeaders[cn] = '#';
                break;
              }
            }
            // IMSA: race points by class position (CLASS POS)
            // 1..30 => 350,320,300,280,260,250,240,230,220,210,200,190,180,170,160,150,140,130,120,110,100,90,80,70,60,50,40,30,20,10
            // 30+ => 10
            var classPosIdx = -1;
            var pointsIdx = -1;
            for (var ci = 0; ci < raceHeaders.length; ci++) {
              var ch = (raceHeaders[ci] || '').toUpperCase().trim();
              if (ch === 'CLASS POS') classPosIdx = ci;
              if (ch === 'POINTS') pointsIdx = ci;
            }
            if (classPosIdx >= 0) {
              if (pointsIdx < 0) {
                pointsIdx = raceHeaders.length;
                raceHeaders = raceHeaders.slice();
                raceHeaders.push('POINTS');
              }
              function racePointsByClassPos(classPos) {
                var n = parseInt(classPos, 10);
                if (isNaN(n) || n < 1) return 0;
                if (n === 1) return 350;
                if (n === 2) return 320;
                if (n === 3) return 300;
                if (n === 4) return 280;
                if (n === 5) return 260;
                if (n === 6) return 250;
                if (n === 7) return 240;
                if (n === 8) return 230;
                if (n === 9) return 220;
                if (n === 10) return 210;
                if (n === 11) return 200;
                if (n === 12) return 190;
                if (n === 13) return 180;
                if (n === 14) return 170;
                if (n === 15) return 160;
                if (n === 16) return 150;
                if (n === 17) return 140;
                if (n === 18) return 130;
                if (n === 19) return 120;
                if (n === 20) return 110;
                if (n === 21) return 100;
                if (n === 22) return 90;
                if (n === 23) return 80;
                if (n === 24) return 70;
                if (n === 25) return 60;
                if (n === 26) return 50;
                if (n === 27) return 40;
                if (n === 28) return 30;
                if (n === 29) return 20;
                return 10;
              }
              raceRows = raceRows.map(function (r) {
                var row = r.slice();
                while (row.length <= pointsIdx) row.push('');
                row[pointsIdx] = String(racePointsByClassPos(row[classPosIdx]));
                return row;
              });
            }
          }
        }

        // F1_2025_2 … F1_2025_11: add Laps Led and Best Lap columns directly in result tables.
        // Also normalize points and laps led: if driver scored no points or led no laps, show 0.
        if ((evKeyEvent === 'F1_2025_2' || evKeyEvent === 'F1_2025_3' || evKeyEvent === 'F1_2025_4' || evKeyEvent === 'F1_2025_5' || evKeyEvent === 'F1_2025_6' || evKeyEvent === 'F1_2025_7' || evKeyEvent === 'F1_2025_8' || evKeyEvent === 'F1_2025_9' || evKeyEvent === 'F1_2025_10' || evKeyEvent === 'F1_2025_11') && eventData && eventData.tables) {
          var isSprintSession = /^sprint/i.test(String(sess.title || ''));
          var lapsLedByDriver = {};
          var bestLapByNo = {};
          var ptsColIdx = -1;
          for (var pi = 0; pi < raceHeaders.length; pi++) {
            var ph = (raceHeaders[pi] || '').toLowerCase();
            if (ph.indexOf('pts') >= 0 || ph.indexOf('points') >= 0) {
              ptsColIdx = pi;
              break;
            }
          }

          // Laps led: sprint or race.
          if (isSprintSession && eventData.tables.laps_led_sprint && Array.isArray(eventData.tables.laps_led_sprint.rows)) {
            eventData.tables.laps_led_sprint.rows.forEach(function (row) {
              var drv = row[1] != null ? String(row[1]).trim() : '';
              var total = row[3] != null ? String(row[3]).trim() : '';
              if (drv && total) lapsLedByDriver[drv] = total;
            });
          } else if (!isSprintSession && eventData.tables.laps_led && Array.isArray(eventData.tables.laps_led.rows)) {
            eventData.tables.laps_led.rows.forEach(function (row) {
              var range = row[0] != null ? String(row[0]).trim() : '';
              var drv = row[1] != null ? String(row[1]).trim() : '';
              if (!drv || !range) return;
              var count = 0;
              var mRange = range.match(/^(\d+)\s*[\u2013\u2014\-]\s*(\d+)$/);
              if (mRange) {
                var a = parseInt(mRange[1], 10);
                var b = parseInt(mRange[2], 10);
                if (!isNaN(a) && !isNaN(b) && b >= a) count = (b - a + 1);
              } else if (/^\d+$/.test(range)) {
                count = 1;
              }
              if (count > 0) {
                lapsLedByDriver[drv] = (lapsLedByDriver[drv] || 0) + count;
              }
            });
          }

          // Special cases (laps led totals only, no ranges in data):
          // Monaco 2025 (F1_2025_8), Spain 2025 (F1_2025_9), Canada 2025 (F1_2025_10), Austria 2025 (F1_2025_11).
          if (!isSprintSession) {
            if (evKeyEvent === 'F1_2025_8') {
              lapsLedByDriver = {
                'Lando Norris': 42,
                'Charles Leclerc': 3,
                'Max Verstappen': 33
              };
            } else if (evKeyEvent === 'F1_2025_9') {
              lapsLedByDriver = {
                'Oscar Piastri': 60,
                'Max Verstappen': 6
              };
            } else if (evKeyEvent === 'F1_2025_10') {
              lapsLedByDriver = {
                'George Russell': 43,
                'Kimi Antonelli': 1,
                'Oscar Piastri': 5,
                'Lando Norris': 15,
                'Charles Leclerc': 6
              };
            } else if (evKeyEvent === 'F1_2025_11') {
              lapsLedByDriver = {
                'Lando Norris': 62,
                'Oscar Piastri': 7,
                'Lewis Hamilton': 1
              };
            }
          }

          // Fastest laps.
          if (isSprintSession && eventData.tables.best_laps_sprint && Array.isArray(eventData.tables.best_laps_sprint.rows)) {
            eventData.tables.best_laps_sprint.rows.forEach(function (row) {
              var no = row[1] != null ? String(row[1]).trim() : '';
              var time = row[6] != null ? String(row[6]).trim() : '';
              if (no && time) bestLapByNo[no] = time;
            });
          } else if (!isSprintSession && eventData.tables.best_laps && Array.isArray(eventData.tables.best_laps.rows)) {
            eventData.tables.best_laps.rows.forEach(function (row) {
              var no = row[1] != null ? String(row[1]).trim() : '';
              var time = row[6] != null ? String(row[6]).trim() : '';
              if (no && time) bestLapByNo[no] = time;
            });
          }

          // Extend headers and rows.
          if (ptsColIdx >= 0) {
            // For F1_2025_2 and F1_2025_3 insert Laps Led and Best Lap BEFORE Pts. column,
            // so order matches F1_2025_1 template: ... Grid, Laps Led, Best Lap, Pts.
            var newHeaders = [];
            for (var hi2 = 0; hi2 < raceHeaders.length; hi2++) {
              if (hi2 === ptsColIdx) {
                newHeaders.push('Laps Led', 'Best Lap', raceHeaders[hi2]);
              } else {
                newHeaders.push(raceHeaders[hi2]);
              }
            }
            raceHeaders = newHeaders;
            raceRows = raceRows.map(function (r) {
              var baseRow = r.slice();
              var drv = baseRow[2] != null ? String(baseRow[2]).trim() : '';
              var no = baseRow[1] != null ? String(baseRow[1]).trim() : '';
              var posRaw = baseRow[0] != null ? String(baseRow[0]).trim() : '';
              var lapsRaw = baseRow[4] != null ? String(baseRow[4]).trim() : '';
              var lapsVal = lapsLedByDriver[drv];
              var bestVal = bestLapByNo[no];
              // For DNS/0-lap do not show best lap,
              // even if present in fastest laps table.
              var isDns = /^dns/i.test(posRaw);
              var lapsNum = parseInt(lapsRaw, 10);
              if (isNaN(lapsNum)) lapsNum = null;
              if (isDns || lapsNum === 0) bestVal = '';
              var out = [];
              for (var ci2 = 0; ci2 < baseRow.length; ci2++) {
                if (ci2 === ptsColIdx) {
                  // Insert Laps Led and Best Lap before points.
                  var lapsCell = lapsVal != null ? String(lapsVal) : '0';
                  out.push(lapsCell);
                  out.push(bestVal || '');
                  // Normalize points — if empty, show 0.
                  var rawPts3 = baseRow[ci2];
                  if (rawPts3 == null || String(rawPts3).trim() === '') rawPts3 = '0';
                  out.push(rawPts3);
                } else {
                  out.push(baseRow[ci2]);
                }
              }
              return out;
            });
          } else {
            // If Pts. column not found — append Laps Led and Best Lap at end.
            raceHeaders = raceHeaders.slice();
            raceHeaders.push('Laps Led', 'Best Lap');
            raceRows = raceRows.map(function (r) {
              var row = r.slice();
              var drv = row[2] != null ? String(row[2]).trim() : '';
              var no = row[1] != null ? String(row[1]).trim() : '';
              var lapsVal = lapsLedByDriver[drv];
              var bestVal = bestLapByNo[no];
              // If no points or empty — show 0.
              if (ptsColIdx >= 0 && ptsColIdx < row.length) {
                var rawPts = row[ptsColIdx];
                if (rawPts == null || String(rawPts).trim() === '') row[ptsColIdx] = '0';
              }
              // If driver led no laps — show 0.
              var lapsCell2 = lapsVal != null ? String(lapsVal) : '0';
              row.push(lapsCell2);
              row.push(bestVal || '');
              return row;
            });
          }
        }

        // For all F1 events: empty points and laps led in race table shown as 0.
        if (evKeyEvent && evKeyEvent.indexOf('F1_') === 0 && Array.isArray(raceHeaders) && Array.isArray(raceRows)) {
          var ptsIdx = -1;
          var lapsLedIdx = -1;
          for (var ni = 0; ni < raceHeaders.length; ni++) {
            var nh = String(raceHeaders[ni] || '').toLowerCase();
            if (nh.indexOf('pts') >= 0 || nh.indexOf('points') >= 0) ptsIdx = ni;
            if (nh.indexOf('laps led') >= 0) lapsLedIdx = ni;
          }
          if (ptsIdx >= 0 || lapsLedIdx >= 0) {
            raceRows = raceRows.map(function (row) {
              var r = row.slice();
              if (ptsIdx >= 0 && ptsIdx < r.length && (r[ptsIdx] == null || String(r[ptsIdx]).trim() === '')) r[ptsIdx] = '0';
              if (lapsLedIdx >= 0 && lapsLedIdx < r.length && (r[lapsLedIdx] == null || String(r[lapsLedIdx]).trim() === '')) r[lapsLedIdx] = '0';
              return r;
            });
          }
        }

        if (raceRows.length > 0) {
          // For all F1 events do not show separate "Results" heading (already in session title).
          if (!evKeyEvent || evKeyEvent.indexOf('F1_') !== 0) {
            out += '<h4 class="table-section-title">Results</h4>';
          }
          var raceTbl = { headers: raceHeaders, rows: raceRows };
          raceTbl = normalizeFinStTable(raceTbl);
          raceTbl = normalizeRaceEngineColumns(raceTbl);
          if (((/^ELMS_\d{4}_\d+$/.test(evKeyEvent || '')) || seriesIdLower === 'super_gt') && Array.isArray(raceTbl.headers) && Array.isArray(raceTbl.rows)) {
            var dropTargets = (seriesIdLower === 'super_gt')
              ? { 'interval': true, 'avg. (km/h)': true, 'time of the day': true }
              : { 'best lap': true, 'time of the day': true };
            var dropIdx = [];
            for (var rhi = 0; rhi < raceTbl.headers.length; rhi++) {
              var rh = String(raceTbl.headers[rhi] || '').trim().toLowerCase();
              if (dropTargets[rh]) dropIdx.push(rhi);
            }
            if (dropIdx.length) {
              raceTbl = {
                headers: raceTbl.headers.filter(function (_h, idx) { return dropIdx.indexOf(idx) < 0; }),
                rows: raceTbl.rows.map(function (row) {
                  return Array.isArray(row) ? row.filter(function (_c, idx) { return dropIdx.indexOf(idx) < 0; }) : row;
                })
              };
            }
          }
          // SMP F4 Russia: on Race tab without ST, Laps and Gap.
          if (isSmpF4Ru && Array.isArray(raceTbl.headers) && Array.isArray(raceTbl.rows)) {
            var smpDrop = { 'st': true, 'laps': true, 'gap': true };
            var smpDropIdx = [];
            for (var sdi = 0; sdi < raceTbl.headers.length; sdi++) {
              var sdh = String(raceTbl.headers[sdi] || '').trim().toLowerCase();
              if (smpDrop[sdh]) smpDropIdx.push(sdi);
            }
            if (smpDropIdx.length) {
              raceTbl = {
                headers: raceTbl.headers.filter(function (_h, idx) { return smpDropIdx.indexOf(idx) < 0; }),
                rows: raceTbl.rows.map(function (row) {
                  return Array.isArray(row) ? row.filter(function (_c, idx) { return smpDropIdx.indexOf(idx) < 0; }) : row;
                })
              };
            }
          }
          // F1, 10 columns (like race_results on F1_2026_3): same look as "Race Results" —
          // .race-results-table + fixed colgroup, not .pre-season-results-table.
          // IMSA: reference race table layout — `/event/imsa-2026-1/race` (body.series-imsa … race-session-results-table in style.css).
          var raceSessTableClass = 'pre-season-results-table race-session-results-table';
          var raceSessColWidths = null;
          if (isF4SeriesId(seriesIdLower)) {
            raceSessTableClass = 'race-starting-lineup-table f4-race-results-table';
          } else if (evKeyEvent && evKeyEvent.indexOf('F1_') === 0 && raceHeaders.length === 10) {
            raceSessTableClass = 'race-results-table';
            raceSessColWidths = raceResultsWidths10;
          }
          if (evKeyEvent && (evKeyEvent.indexOf('GTWCE_END_') === 0 || evKeyEvent.indexOf('GTWCE_SPRINT_') === 0)) raceSessTableClass += ' gtwce-race-results-table';
          var raceResult = buildTableSection(null, raceTbl, raceSessTableClass, null, raceSessColWidths);
          if (raceResult) { out += raceResult.html; sortQueue.push({ rows: raceResult.rows, getRowClass: raceResult.getRowClass }); }
        }
      }
      if (sess && sess.vsc && Array.isArray(sess.vsc.rows) && sess.vsc.rows.length > 0) {
        var sessVscTitle = (sess.vsc.title && String(sess.vsc.title).trim())
          ? String(sess.vsc.title).trim()
          : ((typeof t === 'function' && t('table.vsc')) ? t('table.vsc') : 'Race neutralisation');
        var sessVscTable = {
          headers: Array.isArray(sess.vsc.headers) && sess.vsc.headers.length ? sess.vsc.headers : ['Type', 'Laps'],
          rows: sess.vsc.rows
        };
        var vscResult = buildTableSection(sessVscTitle, sessVscTable, 'vsc-table', null);
        if (vscResult) { out += vscResult.html; sortQueue.push({ rows: vscResult.rows, getRowClass: vscResult.getRowClass }); }
      }
      if (sess && Array.isArray(sess.note_lines) && sess.note_lines.length > 0) {
        var raceNoteHtml = sess.note_lines
          .map(function (line) { return String(line == null ? '' : line).trim(); })
          .filter(function (line) { return line !== ''; })
          .map(function (line) { return esc(line); })
          .join('<br>');
        if (raceNoteHtml) out += '<p class="race-note">' + raceNoteHtml + '</p>';
      } else if (sess && typeof sess.note === 'string' && sess.note.trim()) {
        out += '<p class="race-note">' + esc(sess.note.trim()) + '</p>';
      }
      return out;
    }

    var stagePointsWidths = ['4%', '4%', '22%', '34%', '16%', '10%'];
    var stageNotesWidths  = ['4%', '4%', '22%', '34%', '14%', '22%'];
    var raceResultsWidths8  = ['5%', '5%', '4%', '22%', '36%', '14%', '8%', '8%'];
    var raceResultsWidths10 = ['6%', '6%', '4%', '18%', '24%', '10%', '6%', '6%', '12%', '6%'];

    function add(title, data, cssClass, getRowClass, colWidths, subtitle, titleClass, mergeTeamCells) {
      var r = buildTableSection(title, data, cssClass, getRowClass, colWidths, subtitle, titleClass, mergeTeamCells);
      if (!r) return;
      html += r.html;
      sortQueue.push(r);
    }

    var rrAllstar = tables.race_results;
    var isAllstarStageRace = rrAllstar && rrAllstar.format === 'allstar_stages' && Array.isArray(rrAllstar.stages) && rrAllstar.stages.length > 0;

    function isAllstarStageSeparatorRow(row) {
      if (!row || row.length === 0) return false;
      if (row[0] == null || String(row[0]).trim() === '') return false;
      for (var i = 1; i < row.length; i++) { if (row[i] != null && String(row[i]).trim() !== '') return false; }
      return true;
    }
    function allstarTeamColIdx(headers) {
      for (var i = 0; i < headers.length; i++) {
        if (String(headers[i] || '').trim().toLowerCase() === 'team') return i;
      }
      return 3;
    }
    function allstarNumberColIdx(headers) {
      for (var i = 0; i < headers.length; i++) {
        var h = String(headers[i] || '').trim().toLowerCase();
        if (h === 'no' || h === 'no.') return i;
      }
      return 1;
    }
    function renderAllstarStageRace(stage) {
      var headers = stage.headers || [];
      var numCol = allstarNumberColIdx(headers);
      var teamCol = allstarTeamColIdx(headers);
      var rows = applyTeamNameByNumber((stage.rows || []).slice(), numCol, teamCol);
      var parts = [], sepTexts = [], cur = [];
      rows.forEach(function (row) {
        if (isAllstarStageSeparatorRow(row)) {
          if (cur.length) { parts.push(cur); cur = []; }
          sepTexts.push(String(row[0]).trim());
        } else { cur.push(row); }
      });
      if (cur.length) parts.push(cur);
      var stageTitle = String(stage.title || '').trim();
      if (stage.laps) stageTitle = stageTitle + ' Laps: ' + stage.laps;
      parts.forEach(function (part, pi) {
        if (pi > 0 && sepTexts[pi - 1]) {
          html += '<p class="race-starting-lineup-separator allstar-stage-separator">' + esc(sepTexts[pi - 1]) + '</p>';
        }
        if (pi === 0 && stageTitle) {
          html += '<h3 class="event-pre-season-title">' + esc(stageTitle) + '</h3>';
        }
        add('', { headers: headers, rows: part }, 'race-starting-lineup-table allstar-stage-table', null, null, null, null, false);
      });
    }
    if (isAllstarStageRace) {
      var allstarTitle = (rrAllstar.title && String(rrAllstar.title).trim()) ? String(rrAllstar.title).trim() : 'Stage results';
      html += '<h2 class="race-section-title">' + esc(allstarTitle) + '</h2>';
      rrAllstar.stages.forEach(function (stage) { renderAllstarStageRace(stage); });
    }

    var hideStartingLineupOnRace = isSmpF4Ru || seriesIdLower === 'f4_it';
    var slSessions = (!hideStartingLineupOnRace && tables.starting_lineup && Array.isArray(tables.starting_lineup.sessions)) ? tables.starting_lineup.sessions : [];
    var slFlat = !hideStartingLineupOnRace && tables.starting_lineup && tables.starting_lineup.headers && Array.isArray(tables.starting_lineup.rows) && tables.starting_lineup.rows.length > 0;

    var raceBlock = tables.race;
    // Whelen Modified: race result only in race_results (like NASCAR_MODIFIED_2026_1), no tables.race duplicate.
    if (isNascarModified && tables.race_results && Array.isArray(tables.race_results.rows) && tables.race_results.rows.length > 0) {
      raceBlock = null;
    }
    var penaltiesAndVscAddedAfterSprint = false;
    if (raceBlock && Array.isArray(raceBlock.sessions) && raceBlock.sessions.length > 0) {
      html += '<div class="event-pre-season-block">';
      raceBlock.sessions.forEach(function (sess, idx) {
        if (idx > 0) html += '<hr class="event-pre-season-divider">';
        // Starting Grid N before Race N
        var slSess = slSessions[idx];
        if (slSess && slSess.headers && Array.isArray(slSess.rows) && slSess.rows.length > 0) {
          var raceNo = slSess.meta && slSess.meta.race_no != null ? slSess.meta.race_no : idx + 1;
          var slTitle = (slSess.title && String(slSess.title).trim())
            ? String(slSess.title).trim()
            : (t('table.starting_lineup') + ' — Race ' + raceNo);
          var slRows = applyTeamNameByNumber(slSess.rows.slice(), 1, 3);
          add(slTitle, { headers: slSess.headers, rows: slRows }, 'race-starting-lineup-table', null, null, null, 'table-section-title--starting-grid-race', false);
        }
        html += renderOneRaceSession(sess, d);
        // Penalties and neutralization tables — directly under sprint result table.
        var sessTitleLc = (sess && sess.title && String(sess.title).toLowerCase().trim()) || '';
        if (sessTitleLc.indexOf('sprint') >= 0) {
          // For sprint try separate *_sprint tables first.
          var sprintPenaltiesTable       = tables.penalties_sprint || null;
          var sprintPenaltiesAfterTable  = tables.penalties_sprint_after || null;
          var sprintVscTable             = tables.vsc_sprint || null;
          var usedSprintSpecificTables   = sprintPenaltiesTable || sprintPenaltiesAfterTable || sprintVscTable;

          if (sprintPenaltiesTable && sprintPenaltiesTable.rows && sprintPenaltiesTable.rows.length > 0) {
            add((typeof t === 'function' && t('table.penalties')) ? t('table.penalties') : 'Penalties during the race', sprintPenaltiesTable, 'penalties-table', null, null, null, null, false);
          }
          if (sprintPenaltiesAfterTable && sprintPenaltiesAfterTable.rows && sprintPenaltiesAfterTable.rows.length > 0) {
            add('Penalties added after the chequered flag', sprintPenaltiesAfterTable, 'penalties-table penalties-table--after', null, null, null, null, false);
          }
          if (sprintVscTable && sprintVscTable.rows && sprintVscTable.rows.length > 0) {
            var vscSprintTitle = (sprintVscTable.title && String(sprintVscTable.title).trim())
              ? sprintVscTable.title
              : ((typeof t === 'function' && t('table.vsc')) ? t('table.vsc') : 'Race neutralisation');
            add(vscSprintTitle, { headers: sprintVscTable.headers || ['Type', 'Laps'], rows: sprintVscTable.rows }, 'vsc-table', null, null, null, null, false);
          }

          // If no sprint tables, still use shared penalties / penalties_after / vsc
          // and mark as rendered to avoid duplicating under Race Results.
          if (!usedSprintSpecificTables) {
            if (tables.penalties && tables.penalties.headers && tables.penalties.rows && tables.penalties.rows.length > 0) {
              add((typeof t === 'function' && t('table.penalties')) ? t('table.penalties') : 'Penalties during the race', tables.penalties, 'penalties-table', null, null, null, null, false);
            }
            if (tables.penalties_after && tables.penalties_after.rows && tables.penalties_after.rows.length > 0) {
              add('Penalties added after the chequered flag', tables.penalties_after, 'penalties-table penalties-table--after', null, null, null, null, false);
            }
            if (tables.vsc && tables.vsc.rows && tables.vsc.rows.length > 0) {
              var vscTitleSprint = (tables.vsc.title && String(tables.vsc.title).trim()) ? tables.vsc.title : ((typeof t === 'function' && t('table.vsc')) ? t('table.vsc') : 'Race neutralisation');
              add(vscTitleSprint, tables.vsc, 'vsc-table', null, null, null, null, false);
            }
            penaltiesAndVscAddedAfterSprint = true;
          }
        }
      });
      // Grids without race (e.g. Starting Grid 7 when Race 7 results not yet available)
      for (var j = raceBlock.sessions.length; j < slSessions.length; j++) {
        var slSess = slSessions[j];
        if (slSess && slSess.headers && Array.isArray(slSess.rows) && slSess.rows.length > 0) {
          html += '<hr class="event-pre-season-divider">';
          var raceNo = slSess.meta && slSess.meta.race_no != null ? slSess.meta.race_no : j + 1;
          var slTitle = (slSess.title && String(slSess.title).trim())
            ? String(slSess.title).trim()
            : (t('table.starting_lineup') + ' — Race ' + raceNo);
          var slRows = applyTeamNameByNumber(slSess.rows.slice(), 1, 3);
          add(slTitle, { headers: slSess.headers, rows: slRows }, 'race-starting-lineup-table', null, null, null, 'table-section-title--starting-grid-race', false);
        }
      }
      html += '</div>';
    } else if (raceBlock && raceBlock.headers && Array.isArray(raceBlock.rows)) {
      html += '<div class="event-pre-season-block">';
      if (slFlat && !isNascarModified) {
        var slRows = applyTeamNameByNumber(tables.starting_lineup.rows.slice(), 1, 3);
        function isStartingLineupSeparator(row) {
          if (!row || row.length === 0) return false;
          if (row[0] == null || String(row[0]).trim() === '') return false;
          for (var i = 1; i < row.length; i++) { if (row[i] != null && String(row[i]).trim() !== '') return false; }
          return true;
        }
        var segments = [], separatorTexts = [], cur = [];
        slRows.forEach(function (row) {
          if (isStartingLineupSeparator(row)) {
            if (cur.length) { segments.push(cur); cur = []; }
            separatorTexts.push(String(row[0]).trim());
          } else { cur.push(row); }
        });
        if (cur.length) segments.push(cur);
        var slHeaders = tables.starting_lineup.headers;
        var timeColIdx = -1;
        for (var hi = 0; hi < slHeaders.length; hi++) {
          if (String(slHeaders[hi] || '').trim().toLowerCase() === 'time') { timeColIdx = hi; break; }
        }
        var slHeadersUse = timeColIdx >= 0 ? slHeaders.slice(0, timeColIdx).concat(slHeaders.slice(timeColIdx + 1)) : slHeaders;
        function dropTimeCol(rows) {
          if (timeColIdx < 0) return rows;
          return rows.map(function (row) { return row.slice(0, timeColIdx).concat(row.slice(timeColIdx + 1)); });
        }
        segments.forEach(function (seg, i) {
          if (i > 0 && separatorTexts[i - 1]) html += '<p class="race-starting-lineup-separator">' + esc(separatorTexts[i - 1]) + '</p>';
          add(i === 0 ? t('table.starting_lineup') : '', { headers: slHeadersUse, rows: dropTimeCol(seg) }, 'race-starting-lineup-table', null, null, null, null, false);
        });
      }
      if (seriesIdLower === 'super_gt' && Array.isArray(raceBlock.headers) && Array.isArray(raceBlock.rows)) {
        var raceClassIdx = -1;
        for (var rci = 0; rci < raceBlock.headers.length; rci++) {
          if (String(raceBlock.headers[rci] || '').trim().toUpperCase() === 'CLASS') {
            raceClassIdx = rci;
            break;
          }
        }
        if (raceClassIdx >= 0) {
          var raceClassOrderSuperGt = ['GT500', 'GT300'];
          var renderedRaceClassTable = false;
          raceClassOrderSuperGt.forEach(function (raceClassName, classIdx) {
            var classRows = raceBlock.rows.filter(function (row) {
              return String((row && row[raceClassIdx]) || '').trim().toUpperCase() === raceClassName;
            });
            if (!classRows.length) return;
            var classSession = Object.assign({}, raceBlock, {
              title: raceClassName,
              headers: raceBlock.headers.filter(function (_h, idx) { return idx !== raceClassIdx; }),
              rows: classRows.map(function (row) {
                return Array.isArray(row) ? row.filter(function (_c, idx) { return idx !== raceClassIdx; }) : row;
              })
            });
            if (classIdx > 0) classSession.meta = null;
            html += renderOneRaceSession(classSession, d);
            renderedRaceClassTable = true;
          });
          if (!renderedRaceClassTable) html += renderOneRaceSession(raceBlock, d);
        } else {
          html += renderOneRaceSession(raceBlock, d);
        }
      } else {
        html += renderOneRaceSession(raceBlock, d);
      }
      html += '</div>';
    }

    // For stock-car series do not set fixed colWidths so width auto-fits.
    // Full race_results table shown before points stages (race result → stage breakdown).
    var raceResultsFirstStock = !isAllstarStageRace && isStockCarSeriesRace && tables.race_results && Array.isArray(tables.race_results.rows) && tables.race_results.rows.length > 0;
    var hasStage4 = d.stage4_laps || tgaStageTable(tables, 4);

    function appendRaceResultsBlock() {
      var rp = tables.race_points;
      if (rp && Array.isArray(rp.headers) && Array.isArray(rp.rows) && rp.rows.length > 0) {
        var rpTitle = (rp.title != null && String(rp.title).trim()) ? String(rp.title).trim() : 'Points system';
        add(rpTitle, { headers: rp.headers, rows: rp.rows }, 'wec-race-points-table', null, null, null, null, false);
      }
      var rr = tables.race_results;
      if (rr && typeof rr.intro === 'string' && rr.intro.trim() && rr.rows && rr.rows.length > 0) {
        html += '<p class="race-note">' + esc(rr.intro.trim()) + '</p>';
      }
      if (rr && rr.rows) {
        var statKeysForFilter = ['Statistic', 'Value', 'Lead changes', 'Cautions / Laps', 'Red flags', 'Time of race', 'Average speed'];
        rr = {
          headers: rr.headers,
          rows: rr.rows.filter(function (row) {
            var p = parseStatRow(row);
            if (!p || !p.key) return true;
            var nk = p.key.replace(/\s*\/\s*/g, ' / ').trim();
            return statKeysForFilter.indexOf(nk) < 0;
          })
        };
        // For all F1 events normalize empty points and laps led
        // in race_results table: show 0 instead of empty cell.
        var isF1SeriesForResults = (evKeyEvent && evKeyEvent.indexOf('F1_') === 0);
        if (isF1SeriesForResults && Array.isArray(rr.headers) && Array.isArray(rr.rows)) {
          var ptsColIdxRr = -1;
          var lapsLedColIdxRr = -1;
          var bestLapColIdxRr = -1;
          var noColIdxRr = -1;
          var lapsColIdxRr = -1;
          for (var hri = 0; hri < rr.headers.length; hri++) {
            var hh = String(rr.headers[hri] || '').toLowerCase();
            if (hh.indexOf('pts') >= 0 || hh.indexOf('points') >= 0) ptsColIdxRr = hri;
            if (hh.indexOf('laps led') >= 0) lapsLedColIdxRr = hri;
            if (hh === 'best lap') bestLapColIdxRr = hri;
            if (hh === 'no.' || hh === 'no') noColIdxRr = hri;
            if (hh === 'laps') lapsColIdxRr = hri;
          }
          if (ptsColIdxRr >= 0 || lapsLedColIdxRr >= 0) {
            rr = {
              headers: rr.headers,
              rows: rr.rows.map(function (row) {
                var r = row.slice();
                if (ptsColIdxRr >= 0 && ptsColIdxRr < r.length) {
                  var rawPts = r[ptsColIdxRr];
                  if (rawPts == null || String(rawPts).trim() === '') r[ptsColIdxRr] = '0';
                }
                if (lapsLedColIdxRr >= 0 && lapsLedColIdxRr < r.length) {
                  var rawLapsLed = r[lapsLedColIdxRr];
                  if (rawLapsLed == null || String(rawLapsLed).trim() === '') r[lapsLedColIdxRr] = '0';
                }
                return r;
              })
            };
          }
          if (bestLapColIdxRr >= 0 && noColIdxRr >= 0 && tables.best_laps && Array.isArray(tables.best_laps.rows)) {
            var bestLapByNoRr = {};
            tables.best_laps.rows.forEach(function (blRow) {
              var blNo = blRow[1] != null ? String(blRow[1]).trim() : '';
              var blTime = blRow[6] != null ? String(blRow[6]).trim() : '';
              if (blNo && blTime) bestLapByNoRr[blNo] = blTime;
            });
            rr = {
              headers: rr.headers,
              rows: rr.rows.map(function (row) {
                var r = row.slice();
                if (bestLapColIdxRr >= r.length) return r;
                if (r[bestLapColIdxRr] != null && String(r[bestLapColIdxRr]).trim() !== '') return r;
                var carNo = r[noColIdxRr] != null ? String(r[noColIdxRr]).trim() : '';
                var posRaw = r[0] != null ? String(r[0]).trim() : '';
                var lapsRaw = lapsColIdxRr >= 0 && lapsColIdxRr < r.length ? r[lapsColIdxRr] : '';
                var lapsNum = parseInt(String(lapsRaw).trim(), 10);
                if (/^dns/i.test(posRaw) || lapsNum === 0) return r;
                if (carNo && bestLapByNoRr[carNo]) r[bestLapColIdxRr] = bestLapByNoRr[carNo];
                return r;
              })
            };
          }
        }
      }
      // Do not set colWidths for race_results — cell width auto,
      // except Formula 1 events needing fixed column grid like template.
      var raceResultsSubtitle = (d.stage3_laps ? t('table.stage3') + ' (' + d.stage3_laps + ' ' + t('stage.laps') + ')' : null);
      if (isStockCarSeriesRace) raceResultsSubtitle = null;
      var raceResultsColWidths = null;
      // For all F1 events whose race result table has 10 columns
      // (Pos | No. | Driver | Team/Constructor | Laps | Time | Grid | Laps Led | Best Lap | Pts/Points),
      // use single fixed layout like Australian GP 2026 template.
      var isF1SeriesForResults2 = (evKeyEvent && evKeyEvent.indexOf('F1_') === 0);
      if (isF1SeriesForResults2 && rr && Array.isArray(rr.headers) && rr.headers.length === 10) {
        raceResultsColWidths = raceResultsWidths10;
      }
      // For most F1 events "Race Results" heading already above (in renderOneRaceSession),
      // so inside race section do not duplicate "Results" label on table.
      // Exception: historical F1 seasons (e.g. F1_2025_1) where we want explicit heading.
      var raceResultsTitle;
      if (isF1SeriesForResults2) {
        // For all F1 events explicitly show "Race Results" heading.
        raceResultsTitle = (typeof t === 'function' && t('table.race_results')) ? t('table.race_results') : 'Race Results';
      } else if (raceResultsFirstStock) {
        if (hasStage4) {
          raceResultsTitle = (typeof t === 'function' && t('table.stage4')) ? t('table.stage4') : 'Stage 4';
          if (d.stage4_laps) {
            raceResultsTitle += ' (' + d.stage4_laps + ' ' + t('stage.laps') + ')';
          }
        } else {
          raceResultsTitle = d.stage3_laps ? t('table.stage3') + ' (' + d.stage3_laps + ' ' + t('stage.laps') + ')' : '';
        }
        raceResultsSubtitle = null;
      } else {
        raceResultsTitle = (typeof t === 'function' && t('table.race_results')) ? t('table.race_results') : 'Race Results';
      }
      var raceResultsTitleClass = null;
      if (raceResultsSubtitle) {
        raceResultsTitleClass = 'table-section-title--main';
      }
      // F1: single large "Race Results" heading (like Sprint/Race in China 2026)
      // for all events where heading is shown explicitly.
      if (isF1SeriesForResults2 && raceResultsTitle) {
        raceResultsTitleClass = 'table-section-title--starting-grid';
      }
      if (rr && Array.isArray(rr.rows) && rr.rows.length > 0) {
        if (Array.isArray(rr.headers)) {
          var finStIdx = -1;
          for (var fsi = 0; fsi < rr.headers.length; fsi++) {
            var fh = String(rr.headers[fsi] || '').trim().toLowerCase();
            if (fh === 'fin / st' || fh === 'фин / st') { finStIdx = fsi; break; }
          }
          if (finStIdx >= 0) {
            rr = {
              headers: rr.headers.slice(0, finStIdx).concat(['Fin', 'ST'], rr.headers.slice(finStIdx + 1)),
              rows: rr.rows.map(function (row) {
                var r = row.slice();
                var cell = (finStIdx < r.length && r[finStIdx] != null) ? String(r[finStIdx]).trim() : '';
                var fin = cell;
                var st = '';
                if (cell.indexOf('/') >= 0) {
                  var parts = cell.split('/');
                  fin = String(parts[0] || '').trim();
                  st = String(parts.slice(1).join('/') || '').trim();
                }
                if (st) {
                  var sm = st.match(/ST\s*\d+/i);
                  st = sm ? sm[0].replace(/[^0-9]/g, '') : '';
                }
                r.splice(finStIdx, 1, fin, st);
                return r;
              })
            };
          }
        }
        add(raceResultsTitle, rr, 'race-results-table', null, raceResultsColWidths, raceResultsSubtitle, raceResultsTitleClass, false);
      }
      if (d.race_results_note) {
        html += esc(String(d.race_results_note || '').trim());
      }
    }

    if (!isAllstarStageRace) {
    if (raceResultsFirstStock) {
      var raceResultsHeading = (typeof t === 'function' && t('table.race_results')) ? t('table.race_results') : 'Race Results';
      html += '<h4 class="table-section-title table-section-title--main">' + esc(raceResultsHeading) + '</h4>';
    }

    var stageWidthsForUse = isStockCarSeriesRace ? null : stagePointsWidths;
    add((d.stage1_laps ? t('table.stage1') + ' (' + d.stage1_laps + ' ' + t('stage.laps') + ')' : t('table.stage1')), tgaStageTable(tables, 1), 'race-stage-table race-stage-table--points', null, stageWidthsForUse, null, null, false);
    add((d.stage2_laps ? t('table.stage2') + ' (' + d.stage2_laps + ' ' + t('stage.laps') + ')' : t('table.stage2')), tgaStageTable(tables, 2), 'race-stage-table race-stage-table--points', null, stageWidthsForUse, null, null, false);
    var stage3TitleDefault = (d.stage3_laps ? t('table.stage3') + ' (' + d.stage3_laps + ' ' + t('stage.laps') + ')' : t('table.stage3'));
    var stage3Title = stage3TitleDefault;
    if (isStockCarSeriesRace && tgaStageTable(tables, 3) && !tables.race_results) {
      stage3Title = (d.stage3_laps ? t('table.race_results') + ' (' + d.stage3_laps + ' ' + t('stage.laps') + ')' : t('table.race_results'));
    }
    add(stage3Title, tgaStageTable(tables, 3), 'race-stage-table race-stage-table--points', null, stageWidthsForUse, null, null, false);
    if (!tables.race_results) {
      add((d.stage4_laps ? t('table.stage4') + ' (' + d.stage4_laps + ' ' + t('stage.laps') + ')' : t('table.stage4')), tgaStageTable(tables, 4), 'race-stage-table race-stage-table--points', null, stageWidthsForUse, null, null, false);
    }

    appendRaceResultsBlock();
    }

      // Laps led / Best laps — separate tables only if not embedded in F1 results.
      function f1HidesSeparateLapsTables(evKey, tbls) {
        if (!evKey || evKey.indexOf('F1_') !== 0) return false;
        var legacyEmbedded = {
          F1_2025_1: true, F1_2025_2: true, F1_2025_3: true, F1_2025_4: true, F1_2025_5: true,
          F1_2025_6: true, F1_2025_7: true, F1_2025_8: true, F1_2025_9: true, F1_2025_10: true,
          F1_2025_11: true, F1_2025_12: true, F1_2025_14: true, F1_2025_16: true, F1_2025_18: true,
          F1_2025_19: true, F1_2025_20: true, F1_2026_1: true, F1_2026_2: true, F1_2026_3: true, F1_2026_4: true
        };
        if (legacyEmbedded[evKey]) return true;
        var rrTbl = tbls && tbls.race_results;
        if (rrTbl && Array.isArray(rrTbl.headers)) {
          for (var fhi = 0; fhi < rrTbl.headers.length; fhi++) {
            var fh = String(rrTbl.headers[fhi] || '').trim().toLowerCase();
            if (fh === 'best lap' || fh === 'laps led') return true;
          }
        }
        return false;
      }
      if (!f1HidesSeparateLapsTables(evKeyEvent, tables)) {
      if (tables.laps_led && tables.laps_led.rows && tables.laps_led.rows.length > 0) {
        add((typeof t === 'function' && t('table.laps_led')) ? t('table.laps_led') : 'Laps Led', tables.laps_led, 'laps-led-table', null, null, null, null, false);
      }
      // Fastest laps tables: sprint and/or race, if present.
      if (tables.best_laps_sprint && tables.best_laps_sprint.rows && tables.best_laps_sprint.rows.length > 0) {
        add('Sprint — ' + ((typeof t === 'function' && t('table.best_laps')) ? t('table.best_laps') : 'Best Laps'), tables.best_laps_sprint, 'best-laps-table', null, null, null, null, false);
      }
      if (tables.best_laps && tables.best_laps.rows && tables.best_laps.rows.length > 0) {
        add((typeof t === 'function' && t('table.best_laps')) ? t('table.best_laps') : 'Best Laps', tables.best_laps, 'best-laps-table', null, null, null, null, false);
      }
    }
    if (!penaltiesAndVscAddedAfterSprint) {
      if (tables.penalties) {
        var penaltiesTitle;
        if (evKeyEvent === 'F1_2025_2') {
          penaltiesTitle = 'Penalties added after the chequered flag';
        } else {
          penaltiesTitle = (typeof t === 'function' && t('table.penalties')) ? t('table.penalties') : 'Penalties during the race';
        }
        add(penaltiesTitle, tables.penalties, 'penalties-table', null, null, null, null, false);
      }
      if (tables.penalties_after && tables.penalties_after.rows && tables.penalties_after.rows.length > 0) {
        var penaltiesAfterTitle = 'Penalties added after the chequered flag';
        add(penaltiesAfterTitle, tables.penalties_after, 'penalties-table penalties-table--after', null, null, null, null, false);
      }
      if (tables.vsc) {
        var vscTitle = (tables.vsc.title && String(tables.vsc.title).trim()) ? tables.vsc.title : ((typeof t === 'function' && t('table.vsc')) ? t('table.vsc') : 'Race neutralisation');
        add(vscTitle, tables.vsc, 'vsc-table', null, null, null, null, false);
      }
    }
    if (tables.pit_stops) {
      var ps = tables.pit_stops;
      var psTitle = (ps.title && String(ps.title).trim())
        ? ps.title
        : ((typeof t === 'function' && t('table.pit_stops')) ? t('table.pit_stops') : 'PIT STOPS');
      var psRows = ps.rows || [];
      function parseStint(str) {
        if (!str || typeof str !== 'string') return null;
        str = str.trim();
        function mapCompound(code) {
          code = String(code || '').toUpperCase();
          if (code === 'C1' || code === 'C2') return 'H';
          if (code === 'C3' || code === 'C4') return 'M';
          if (code === 'C5' || code === 'C6') return 'S';
          return code.charAt(0);
        }
        // Ignore transient U/N markers and normalize parentheses.
        var clean = str.replace(/^((?:C[1-6])|[HMSIW])(?:[NU])?/i, function (match) {
          return match.replace(/[NU]$/i, '');
        }).replace(/\s*\(\s*(\d+)\s*\)\s*$/i, ' $1');
        var m = clean.match(/^((?:C[1-6])|[HMSIW])\s*\(?([0-9]+)\)?\s*[\u2013\u2014\-]\s*\(?([0-9]+)\)?$/i);
        if (m) return { compound: mapCompound(m[1]), from: parseInt(m[2], 10), to: parseInt(m[3], 10) };
        var single = clean.match(/^((?:C[1-6])|[HMSIW])\s*\(?([0-9]+)\)?$/i);
        if (single) {
          var n = parseInt(single[2], 10);
          return { compound: mapCompound(single[1]), from: n, to: n };
        }
        var plain = clean.match(/^((?:C[1-6])|[HMSIW])$/i);
        if (plain) return { compound: mapCompound(plain[1]), from: 0, to: 0 };
        if (/^((?:C[1-6])|[HMSIW])\s*0\s*\(DNS\)/i.test(clean)) return { compound: mapCompound(RegExp.$1), from: 0, to: 0 };
        return null;
      }
      // Max laps for bar width normalization.
      // If event has total laps — use it, else fallback 58.
      var maxLaps = 58;
      if (d && d.laps != null && String(d.laps).trim() !== '') {
        var lapsInt = parseInt(String(d.laps).trim(), 10);
        if (!isNaN(lapsInt) && lapsInt > 0) maxLaps = lapsInt;
      }
      html += '<div class="pit-stops-chart-wrap">';
      html += (psTitle ? '<h4 class="pit-stops-chart-title">' + esc(psTitle) + '</h4>' : '');
      html += '<div class="pit-stops-chart">';
      var totalPitStops = 0;
      var usedCompounds = {};
      psRows.forEach(function (row) {
        var driver = (row[0] != null ? String(row[0]) : '').trim();
        var totalLaps = parseInt(row[6], 10) || 0;
        var stints = [];
        for (var s = 1; s <= 5; s++) {
          var seg = parseStint(row[s]);
          if (seg) {
            stints.push(seg);
            usedCompounds[seg.compound] = true;
          }
        }
        if (stints.length === 0 && totalLaps === 0 && row[1]) {
          var first = String(row[1]).trim();
          if (first) {
            var comp = first.charAt(0).toUpperCase();
            stints.push({ compound: comp, from: 0, to: 0 });
            usedCompounds[comp] = true;
          }
        }
        // Empty segment to maxLaps — so bar right edge aligns for all.
        if (totalLaps > 0 && totalLaps < maxLaps) {
          stints.push({ compound: '_', from: totalLaps + 1, to: maxLaps });
        }
        // Pit stop count: stints minus one (ignoring DNS).
        var nonDnsStints = stints.filter(function (seg) {
          return !(totalLaps === 0 && seg.from === 0 && seg.to === 0);
        });
        if (nonDnsStints.length > 1) {
          totalPitStops += (nonDnsStints.length - 1);
        }

        // Single-width bar (100% wrap) when totalLaps > 0 for aligned right edge.
        var barStyle = totalLaps > 0
          ? 'width: 100%;'
          : 'width: 20px; min-width: 20px;';
        html += '<div class="pit-stops-chart-row">';
        html += '<span class="pit-stops-chart-driver">' + esc(driver.toUpperCase()) + '</span>';
        html += '<div class="pit-stops-chart-bar-wrap"><div class="pit-stops-chart-bar pit-stops-chart-bar--overlay" style="' + barStyle + '">';
        stints.forEach(function (seg, i) {
          var laps = seg.to - seg.from + 1;
          var isDns = totalLaps === 0 && seg.to === 0 && seg.from === 0;
          var isEmpty = seg.compound === '_';
          var cls = 'pit-stops-seg';
          if (isEmpty) cls += ' pit-stops-seg-empty';
          else if (seg.compound === 'H') cls += ' pit-stops-seg-hard';
          else if (seg.compound === 'M') cls += ' pit-stops-seg-medium';
          else if (seg.compound === 'S') cls += ' pit-stops-seg-soft';
          else if (seg.compound === 'I') cls += ' pit-stops-seg-intermediate';
          else if (seg.compound === 'W') cls += ' pit-stops-seg-wet';
          if (isDns) cls += ' pit-stops-seg-dns';
          var segStyle;
          if (isDns) {
            segStyle = 'width:20px;min-width:20px;max-width:20px;flex:0 0 auto';
          } else {
            // Share on 0..maxLaps scale so bar right edge aligns for all.
            var pct = maxLaps > 0 ? (laps / maxLaps) * 100 : 0;
            var minW = isEmpty ? '0' : '4px';
            segStyle = 'width:' + (Math.round(pct * 100) / 100) + '%;flex:0 0 auto;min-width:' + minW;
          }
          html += '<div class="' + cls + '" style="' + segStyle + '">';
          var nextSeg = stints[i + 1];
          var nextIsEmpty = nextSeg && nextSeg.compound === '_';
          if (i < stints.length - 1 && seg.to > 0 && !isDns && !isEmpty && !nextIsEmpty) {
            // Pit lap number: early stints (1–2) — pit on that lap; else first out lap (seg.to + 1).
            var pitLap = seg.to <= 2 ? seg.to : seg.to + 1;
            html += '<span class="pit-stops-divider pit-stops-divider--overlay" aria-hidden="true">' +
              '<svg class="pit-stops-divider-svg" width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="10" fill="#0d0d0d"/></svg>' +
              '<span class="pit-stops-divider-lap">' + esc(String(pitLap)) + '</span></span>';
          }
          html += '</div>';
        });
        html += '</div></div>';
        html += '<span class="pit-stops-chart-laps">' + esc(String(totalLaps)) + '</span>';
        html += '</div>';
      });
      html += '</div>';
      html += '<div class="pit-stops-chart-legend">';
      var legendParts = [];
      if (usedCompounds.H) legendParts.push('C3 — Hard (white)');
      if (usedCompounds.M) legendParts.push('C4 — Medium (yellow)');
      if (usedCompounds.S) legendParts.push('C5 — Soft (red)');
      if (usedCompounds.I) legendParts.push('I — Intermediate (green)');
      if (usedCompounds.W) legendParts.push('W — Wet (blue)');
      var legendText = legendParts.length ? legendParts.join(', ') + '.' : '';
      html += '<span class="pit-stops-legend-text">' + esc(legendText) + '</span>';
      html += '<span class="pit-stops-chart-total">Total pit stops: ' + esc(String(totalPitStops)) + '</span>';
      html += '</div></div>';
      sortQueue.push({ rows: psRows, getRowClass: null });
    }
    if (tables.caution_breakdown) {
      var cbData = tables.caution_breakdown;
      if (seriesIdLower === 'indycar' && cbData.headers && Array.isArray(cbData.rows)) {
        var h = cbData.headers;
        var lastIdx = h.length - 1;
        if (lastIdx >= 0 && (h[lastIdx] || '').toLowerCase().indexOf('free pass') >= 0) {
          cbData = {
            headers: h.slice(0, lastIdx),
            rows: cbData.rows.map(function (r) { return r.slice(0, lastIdx); })
          };
        }
      }
      var reasonColIdx = (cbData.headers && cbData.headers.length > 0) ? cbData.headers.length - 1 : 4;
      var cbRowClass = function (row) {
        return (row[reasonColIdx] != null && String(row[reasonColIdx]).trim() !== '') ? 'caution-row caution-row-caution' : 'caution-row caution-row-green';
      };
      add(t('table.caution_breakdown'), cbData, 'caution-breakdown-table', cbRowClass, null);
    }

    var emptyMsg = (t('error.race_no_data') || t('error.no_section_data') || 'Race results will appear here after the event.');
    contentEl.innerHTML = html || ('<p class="empty-msg">' + esc(emptyMsg) + '</p>');
    if (html) {
      var raceTables = contentEl.querySelectorAll('.data-table:not(.table-field-value)');
      [].forEach.call(raceTables, function (table, idx) {
        var q = sortQueue[idx];
        if (q && q.rows) makeTableSortable(table, q.rows, esc, q.getRowClass);
      });
    }
  }

  function renderBopContent(escapeFn, eventData) {
    var e = escapeFn || function (s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
    var evKey = ((eventData && eventData.event_id) || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
    var isImsa2026Round1 = evKey === 'IMSA_2026_1';
    var isImsa2026Round2 = evKey === 'IMSA_2026_2';
    var isImsa2026Round3 = evKey === 'IMSA_2026_3';
    var isImsa2026Round4 = evKey === 'IMSA_2026_4';
    function row(cells) {
      return '<tr>' + cells.map(function (c) {
        return '<td>' + e(c).replace(/\n/g, '<br>') + '</td>';
      }).join('') + '</tr>';
    }
    function theadRow(cells) { return '<tr>' + cells.map(function (c) { return '<th>' + e(c) + '</th>'; }).join('') + '</tr>'; }
    var gtpCars = isImsa2026Round3 ? [
      ['Acura', 'ARX-06', '1059', '9512', '96.2', '97.1', '190', '200', '901', '22.525', 'R80'],
      ['Aston Martin', 'Valkyrie', '1030', '8400', '100.0', '100.0', '190', '200', '913', '22.825', 'R80'],
      ['BMW', 'M Hybrid V8', '1059', '8000', '99.0', '96.9', '190', '200', '908', '22.700', 'R80'],
      ['Cadillac', 'V-Series.R', '1058', '8800', '98.3', '97.1', '190', '200', '906', '22.650', 'R80'],
      ['Porsche', '963 (2026 Homologation)', '1100', '8158', '92.3', '100.0', '190', '200', '913', '22.825', 'R80'],
      ['Porsche', '963 (2025 Homologation)', '1060', '8158', '96.0', '96.0', '190', '200', '906', '22.650', 'R80']
    ] : isImsa2026Round4 ? [
      ['Acura', 'ARX-06', '1056', '9512', '97.7', '97.3', '190', '200', '904', '22.600', 'R80'],
      ['Aston Martin', 'Valkyrie', '1030', '8400', '100.0', '100.0', '190', '200', '913', '22.825', 'R80'],
      ['BMW', 'M Hybrid V8', '1042', '8000', '98.5', '95.4', '190', '200', '902', '22.550', 'R80'],
      ['Cadillac', 'V-Series.R', '1043', '8800', '98.1', '96.0', '190', '200', '901', '22.525', 'R80'],
      ['Porsche', '963 (2026 Homologation)', '1084', '8158', '92.3', '100.0', '190', '200', '891', '22.275', 'R80'],
      ['Porsche', '963 (2025 Homologation)', '1052', '8158', '96.0', '97.3', '190', '200', '895', '22.375', 'R80']
    ] : [
      ['Acura', 'ARX-06', '1051', '9512', '98.1', '96.3', '230', '240', '898', '22.450', 'R80'],
      ['Aston Martin', 'Valkyrie', '1030', '8400', '100.0', '100.0', '230', '240', '912', '22.800', 'R80'],
      ['BMW', 'M Hybrid V8', '1048', '8000', '97.7', '97.1', '230', '240', '900', '22.500', 'R80'],
      ['Cadillac', 'V-Series.R', '1043', '8800', '98.1', '96.2', '230', '240', '895', '22.375', 'R80'],
      ['Porsche', '963', '1055', '8158', '97.7', '97.1', '230', '240', '902', '22.550', 'R80']
    ];
    var gtpReg = [
      ['PPULimit_BoP', '0', 'kW'],
      ['PPULimitRate_BoP', '1.0', 'kW'],
      ['PPUMaxIntegral_BoP', '10', 'kJ'],
      ['PPURate_BoP', '20', 'kW'],
      ['TDT_LimitRate_BoP', '10', 'Nm*s'],
      ['TDT_MaxIntegral_BoP', '150', 'Nm*s']
    ];
    var gtpRegForRender = isImsa2026Round4
      ? [['PPUEnergyStint_BoP', 'BoP Table', 'MJ'], ['ReplenTime_BoP', '40', 's']].concat(gtpReg)
      : gtpReg;
    var gtdCars = isImsa2026Round3 ? [
      ['Aston Martin', 'Vantage GT3 EVO', '1328', '7000', '91.8', '87.0', '190', '200', '5.0', '11.1', '867', '21.675'],
      ['BMW', 'M4 GT3 EVO', '1346', '7500', '89.6', '93.8', '190', '200', '-2.0', '5.0', '864', '21.600'],
      ['Corvette', 'Z06 GT3.R', '1356', '8000', '95.5', '97.0', '190', '200', '-1.8', '6.4', '876', '21.900'],
      ['Ferrari', '296 GT3 EVO', '1340', '7750', '83.3', '87.9', '190', '200', '-1.7', '4.1', '853', '21.325'],
      ['Ford', 'Mustang GT3', '1330', '8250', '97.2', '96.4', '190', '200', '-0.4', '7.1', '876', '21.900'],
      ['Lamborghini', 'Huracan GT3 EVO2', '1342', '8300', '83.2', '88.8', '190', '200', '2.0', '8.4', '868', '21.700'],
      ['Lamborghini', 'Temerario GT3', '1337', '8000', '86.4', '88.5', '190', '200', '1.0', '5.1', '877', '21.925'],
      ['Lexus', 'RC F GT3', '1356', '7200', '96.9', '96.8', '190', '200', '4.0', '11.0', '919', '22.975'],
      ['Mercedes-AMG', 'GT3', '1356', '7900', '89.7', '90.9', '190', '200', '0.0', '9.0', '897', '22.425'],
      ['Porsche', '911 GT3 R (992)', '1384', '8950', '89.6', '100.0', '190', '200', '7.3', '9.3', '855', '21.375']
    ] : isImsa2026Round4 ? [
      ['Aston Martin', 'Vantage GT3 EVO', '1287', '7000', '85.9', '83.4', '170', '180', '5.0', '11.1', '833', '20.825'],
      ['BMW', 'M4 GT3 EVO', '1334', '7500', '90.8', '94.9', '170', '180', '-2.0', '5.0', '864', '21.600'],
      ['Corvette', 'Z06 GT3.R', '1360', '8000', '97.5', '98.7', '170', '180', '-1.8', '6.4', '885', '22.125'],
      ['Ferrari', '296 GT3 EVO', '1350', '7750', '85.1', '90.7', '170', '180', '-1.7', '4.1', '862', '21.550'],
      ['Ford', 'Mustang GT3', '1315', '8250', '99.6', '94.5', '170', '180', '-0.4', '7.1', '880', '22.000'],
      ['Lamborghini', 'Huracan GT3 EVO2', '1342', '8300', '89.0', '89.2', '170', '180', '2.0', '8.4', '889', '22.225'],
      ['Lamborghini', 'Temerario GT3', '1337', '8000', '90.4', '89.7', '170', '180', '1.0', '5.1', '893', '22.325'],
      ['Lexus', 'RC F GT3', '1356', '7200', '96.1', '100.0', '170', '180', '4.0', '11.0', '920', '23.000'],
      ['McLaren', '720S GT3 EVO', '1327', '8100', '94.5', '90.7', '170', '180', '3.1', '11.3', '880', '22.000'],
      ['Mercedes-AMG', 'GT3', '1356', '7900', '91.6', '87.5', '170', '180', '0.0', '9.0', '898', '22.450'],
      ['Porsche', '911 GT3 R (992)', '1373', '8950', '97.2', '95.7', '170', '180', '7.3', '9.3', '867', '21.675']
    ] : [
      ['Aston Martin', 'Vantage GT3 EVO', '1323', '7000', '91.9', '88.2', '190', '200', '5.0', '8.1', '871', '21.775'],
      ['BMW', 'M4 GT3 EVO', '1344', '7500', '91.9', '90.5', '190', '200', '-2.0', '2.1', '867', '21.675'],
      ['Corvette', 'Z06 GT3.R', '1360', '8000', '97.3', '92.3', '190', '200', '-1.8', '2.4', '876', '21.900'],
      ['Ferrari', '296 GT3 EVO', '1335', '7750', '85.9', '85.1', '190', '200', '-1.7', '1.1', '856', '21.400'],
      ['Ford', 'Mustang GT3', '1362', '8250', '97.0', '94.6', '190', '200', '-0.4', '2.8', '877', '21.925'],
      ['Lamborghini', 'Huracan GT3 EVO2', '1370', '8300', '84.6', '84.7', '190', '200', '2.0', '4.4', '862', '21.550'],
      ['Lamborghini', 'Temerario GT3', '1351', '8000', '87.9', '86.6', '190', '200', '1.0', '4.1', '885', '22.125'],
      ['Lexus', 'RC F GT3', '1356', '7200', '95.3', '94.7', '190', '200', '4.0', '7.1', '920', '23.000'],
      ['McLaren', '720S GT3 EVO', '1330', '8100', '94.0', '90.0', '190', '200', '3.1', '7.7', '879', '21.975'],
      ['Mercedes', 'AMG GT3', '1356', '7900', '91.9', '91.8', '190', '200', '0.0', '6.9', '910', '22.750'],
      ['Porsche', '911 GT3 R (992)', '1362', '8950', '94.8', '100.0', '190', '200', '7.3', '9.3', '863', '21.575']
    ];
    var gtdReg = [
      ['PPULimit_BoP', '0', 'kW'],
      ['PPULimitRate_BoP', '1.0', 'kW'],
      ['PPUMaxIntegral_BoP', '10', 'kJ'],
      ['PPURate_BoP', '20', 'kW']
    ];
    var gtpHead = ['Manufacturer', 'Car Model', 'Weight (kg)', 'Nmax (rpm)', 'Power ≤V1 (%)', 'Power ≥V2 (%)', 'V1 (km/h)', 'V2 (km/h)', 'Max Stint Energy (MJ)', 'Replenishment Rate (MJ/s)', 'Fuel'];
    var gtpRegHead = ['Regulatory BoP Parameter', 'GTP', 'Unit'];
    var gtdHead = ['Manufacturer', 'Car Model', 'Weight (kg)', 'Nmax (rpm)', 'Power ≤V1 (%)', 'Power ≥V2 (%)', 'V1 (km/h)', 'V2 (km/h)', 'Wing Min (deg)', 'Wing Max (deg)', 'Max Stint Energy (MJ)', 'Replenishment Rate (MJ/s)'];
    var gtdRegHead = ['Parameter', 'Value', 'Unit'];
    var out = '';
    out += '<div class="bop-content">';
    var bopTitle = 'Balance of Performance — Daytona ROAR & Rolex 24';
    var bopSubtitle = 'Technical Bulletin | IMSA WeatherTech SportsCar Championship 2026 Round 1';
    if (isImsa2026Round2) {
      bopTitle = 'Balance of Performance — Mobil 1 Twelve Hours of Sebring';
      bopSubtitle = 'Technical Bulletin | IMSA WeatherTech SportsCar Championship 2026 Round 2';
    } else if (isImsa2026Round3) {
      bopTitle = 'Balance of Performance — Acura Grand Prix of Long Beach';
      bopSubtitle = 'Technical Bulletin | IMSA WeatherTech SportsCar Championship 2026 Round 3';
    } else if (isImsa2026Round4) {
      bopTitle = 'Balance of Performance — Monterey SportsCar Championship';
      bopSubtitle = 'Technical Bulletin | IMSA WeatherTech SportsCar Championship 2026 Round 4';
    } else if (isImsa2026Round1) {
      bopTitle = 'Balance of Performance — Daytona ROAR & Rolex 24';
      bopSubtitle = 'Technical Bulletin | IMSA WeatherTech SportsCar Championship 2026 Round 1';
    }
    out += '<h2 class="bop-main-title">' + e(bopTitle) + '</h2>';
    out += '<p class="bop-subtitle">' + e(bopSubtitle) + '</p>';
    out += '<hr class="bop-divider">';
    out += '<h3 class="bop-class-title">GTP CLASS</h3>';
    out += '<div class="table-wrap"><table class="data-table bop-table">';
    out += '<thead>' + theadRow(gtpHead) + '</thead><tbody>';
    gtpCars.forEach(function (r) { out += row(r); });
    out += '</tbody></table></div>';
    out += '<p class="bop-notes"><strong>Notes:</strong></p><ul class="bop-notes-list"><li>Linear interpolation used between V1 and V2</li><li>% of High power curve defined in LMDh TR 5.1.2 and LMH TR Appendix 4b</li><li>For N/Nmax &lt; 0.55, maximum power is equal to N/Nmax = 0.55</li></ul>';
    if (!isImsa2026Round3) {
      out += '<h4 class="table-section-title">GTP Regulatory BoP Parameters</h4>';
      out += '<div class="table-wrap"><table class="data-table bop-table">';
      out += '<thead>' + theadRow(gtpRegHead) + '</thead><tbody>';
      gtpRegForRender.forEach(function (r) { out += row(r); });
      out += '</tbody></table></div>';
    }
    out += '<hr class="bop-divider">';
    out += '<h3 class="bop-class-title">' + e(isImsa2026Round3 ? 'GTD CLASS' : 'GTD / GTD PRO CLASS') + '</h3>';
    out += '<div class="table-wrap"><table class="data-table bop-table bop-table--wide">';
    out += '<thead>' + theadRow(gtdHead) + '</thead><tbody>';
    gtdCars.forEach(function (r) { out += row(r); });
    out += '</tbody></table></div>';
    out += '<p class="bop-notes"><strong>Notes:</strong></p><ul class="bop-notes-list"><li>Linear interpolation used between V1 and V2</li><li>For N/Nmax &lt; 0.55, maximum power is equal to N/Nmax = 0.55</li><li>Linear interpolation used between each 0.025 step from 0.55 to 1.025 N/Nmax</li><li>For N/Nmax &gt;= 1.025, maximum power is 0.856 of maximum power at N/Nmax = 1.000</li><li>Declared power varies — comparisons between cars are invalid</li><li>Wing angle at Y=0 using measurement described in ITEF (stated angle includes tolerance)</li></ul>';
    if (!isImsa2026Round3) {
      out += '<h4 class="table-section-title">GTD / GTD PRO Regulatory BoP Parameters (all sessions)</h4>';
      out += '<div class="table-wrap"><table class="data-table bop-table">';
      out += '<thead>' + theadRow(gtdRegHead) + '</thead><tbody>';
      gtdReg.forEach(function (r) { out += row(r); });
      out += '</tbody></table></div>';
    }
    out += '</div>';
    return out;
  }

  function buildTeamNamesByNumberFromEntryList(entryList) {
    var map = {};
    if (!entryList || !entryList.length) return map;
    for (var i = 0; i < entryList.length; i++) {
      var e = entryList[i];
      var num = e.number != null ? String(e.number).trim() : '';
      if (num === '') continue;
      var team = (e.team != null && String(e.team).trim() !== '') ? String(e.team).trim() : '';
      map[num] = team;
      var parsed = parseInt(num, 10);
      if (!isNaN(parsed)) map[String(parsed)] = team;
    }
    return map;
  }

  function renderEventSectionContent(d, section, contentEl, eventIdFromRoute) {
    if (contentEl) contentEl.setAttribute('data-event-section', section || '');
    var seriesId  = eventSeriesId(d.event_id || eventIdFromRoute || '');
    var isStockCar = ['nascar_cup', 'noaps', 'nascar_truck', 'arca', 'nascar_modified'].indexOf((seriesId || '').toLowerCase()) >= 0;
    var html = '';
    var sortQueue = [];
    var byNumber = (isStockCar && d.entry_list && d.entry_list.length)
      ? buildTeamNamesByNumberFromEntryList(d.entry_list)
      : (d.team_names_by_number && typeof d.team_names_by_number === 'object' ? d.team_names_by_number : null);
    var evKeyEvent = ((d.event_id || '') + '').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
    if (contentEl) contentEl.setAttribute('data-event-id', evKeyEvent || '');

    function applyTeamNameByNumber(rows, numberColIdx, teamColIdx) {
      if (!byNumber) return rows;
      return rows.map(function (row) {
        var r = row.slice();
        if (r.length > Math.max(numberColIdx, teamColIdx) && r[numberColIdx] != null) {
          var num = String(r[numberColIdx]).trim();
          var teamFromTeams = byNumber[num] || byNumber[String(parseInt(num, 10))];
          if (teamFromTeams != null) r[teamColIdx] = teamFromTeams;
        }
        return r;
      });
    }

    function transformTableDataForF2F3(tableData) {
      if (!tableData || !/^F2_|^F3_/.test(evKeyEvent)) return tableData;
      var headers = Array.isArray(tableData.headers) ? tableData.headers.slice() : [];
      var rows = Array.isArray(tableData.rows) ? tableData.rows.map(function (r) { return r.slice(); }) : [];
      if (headers.length === 0) return tableData;
      var chassisIdx = -1;
      for (var i = 0; i < headers.length; i++) {
        var h = (headers[i] || '').toLowerCase().trim();
        if (h === 'chassis') chassisIdx = i;
        if (h === 'manufacturer') headers[i] = 'Team';
      }
      if (chassisIdx >= 0) {
        headers.splice(chassisIdx, 1);
        rows = rows.map(function (r) {
          if (r.length > chassisIdx) return r.slice(0, chassisIdx).concat(r.slice(chassisIdx + 1));
          return r;
        });
      }
      return { headers: headers, rows: rows };
    }

    function dropStartPosColumn(tableData) {
      if (!tableData || !Array.isArray(tableData.headers) || !Array.isArray(tableData.rows)) return tableData;
      var idx = -1;
      for (var i = 0; i < tableData.headers.length; i++) {
        var n = (tableData.headers[i] || '').toUpperCase().trim();
        if (n === 'ST POS' || n === 'START POS' || n === 'START POSITION') { idx = i; break; }
      }
      if (idx < 0) return tableData;
      return {
        headers: tableData.headers.slice(0, idx).concat(tableData.headers.slice(idx + 1)),
        rows: tableData.rows.map(function (r) { return r.slice(0, idx).concat(r.slice(idx + 1)); })
      };
    }

    function splitTeamCarDropSponsor(tableData) {
      if (!tableData || !Array.isArray(tableData.headers) || !Array.isArray(tableData.rows)) return tableData;
      var idx = -1;
      for (var i = 0; i < tableData.headers.length; i++) {
        var h = (tableData.headers[i] || '').toLowerCase().trim();
        if (h === 'team/car/sponsor' || h.indexOf('team/car') === 0) { idx = i; break; }
      }
      if (idx < 0) return tableData;
      return {
        headers: tableData.headers.slice(0, idx).concat(['TEAM', 'CAR'], tableData.headers.slice(idx + 1)),
        rows: tableData.rows.map(function (r) {
          var cell = r[idx] != null ? String(r[idx]) : '';
          var parts = cell.split(/\s*\/\s*/);
          var team = (parts[0] || '').trim();
          var car = (parts[1] != null ? String(parts[1]).trim() : '');
          return r.slice(0, idx).concat([team, car], r.slice(idx + 1));
        })
      };
    }

    function applyClassFromEntryList(tableData, entryList) {
      if (!tableData || !Array.isArray(tableData.headers) || !Array.isArray(tableData.rows)) return tableData;
      if (!entryList || !entryList.length) return tableData;
      var classByNumber = {};
      entryList.forEach(function (row) {
        var num = row.number != null ? String(row.number).trim() : '';
        if (num) {
          var cls = row.class != null ? String(row.class).trim() : '';
          classByNumber[num] = cls;
          var numNorm = String(parseInt(num, 10));
          if (numNorm !== num) classByNumber[numNorm] = cls;
        }
      });
      var classColIdx = -1;
      var carNoColIdx = -1;
      for (var i = 0; i < tableData.headers.length; i++) {
        var h = (tableData.headers[i] || '').toUpperCase().trim();
        if (h === 'CLASS') classColIdx = i;
        if ((h === 'CAR NO' || h === '#' || h === 'NO') && carNoColIdx < 0) carNoColIdx = i;
      }
      if (carNoColIdx < 0) carNoColIdx = 1;
      if (classColIdx < 0 || classColIdx >= tableData.headers.length) return tableData;
      var rows = tableData.rows.map(function (r) {
        var newRow = r.slice();
        var num = newRow[carNoColIdx] != null ? String(newRow[carNoColIdx]).trim() : '';
        var cls = classByNumber[num] || classByNumber[String(parseInt(num, 10))];
        if (cls !== undefined && newRow.length > classColIdx) newRow[classColIdx] = cls;
        return newRow;
      });
      return { headers: tableData.headers, rows: rows };
    }

    function recomputeClassPos(tableData) {
      if (!tableData || !Array.isArray(tableData.headers) || !Array.isArray(tableData.rows)) return tableData;
      var posColIdx = -1;
      var classColIdx = -1;
      var classPosColIdx = -1;
      for (var i = 0; i < tableData.headers.length; i++) {
        var h = (tableData.headers[i] || '').toUpperCase().trim();
        if (h === 'POS') posColIdx = i;
        if (h === 'CLASS') classColIdx = i;
        if (h === 'CLASS POS') classPosColIdx = i;
      }
      if (posColIdx < 0) posColIdx = 0;
      if (classColIdx < 0 || classPosColIdx < 0 || classPosColIdx >= tableData.headers.length) return tableData;
      var rows = tableData.rows;
      var isSeparator = function (row) {
        if (!row || row.length === 0) return false;
        var first = (row[0] != null && String(row[0]).trim() !== '');
        if (!first) return false;
        for (var j = 1; j < row.length; j++) { if (row[j] != null && String(row[j]).trim() !== '') return false; }
        return true;
      };
      var dataRows = rows.filter(function (r) { return !isSeparator(r); });
      var posNum = function (row) {
        var v = row[posColIdx];
        var n = parseInt(v, 10);
        return isNaN(n) ? 9999 : n;
      };
      var getClass = function (row) {
        return (row[classColIdx] != null ? String(row[classColIdx]).trim() : '') || '\0';
      };
      var rowsWithClassPos = rows.map(function (row) {
        if (isSeparator(row)) return row;
        var cls = getClass(row);
        var myPos = posNum(row);
        var classPos = 1;
        for (var k = 0; k < dataRows.length; k++) {
          if (getClass(dataRows[k]) === cls && posNum(dataRows[k]) < myPos) classPos++;
        }
        var newRow = row.slice();
        if (newRow.length > classPosColIdx) newRow[classPosColIdx] = classPos;
        return newRow;
      });
      return { headers: tableData.headers, rows: rowsWithClassPos };
    }

    function isSupercarsSydneyEvent(evKey) {
      return /^SUPERCARS_2026_[123]$/.test((evKey || '').toUpperCase().replace(/[^A-Z0-9_]/g, '_'));
    }
    function supercarsSydneyCarDisplay(tableData) {
      if (!tableData || !Array.isArray(tableData.headers) || !Array.isArray(tableData.rows)) return tableData;
      var noColIdx = -1;
      for (var i = 0; i < tableData.headers.length; i++) {
        var h = (tableData.headers[i] || '').toLowerCase().trim();
        if (h === 'no' || h === 'no.' || h === '#' || h === 'car') { noColIdx = i; break; }
      }
      if (noColIdx < 0) return tableData;
      return {
        headers: tableData.headers,
        rows: tableData.rows.map(function (row) {
          var r = row.slice();
          if (r.length > noColIdx && String(r[noColIdx] || '').trim() === '8') r[noColIdx] = '800';
          return r;
        })
      };
    }
    function formatSuperFormulaEngineLabel(raw) {
      var s = (raw == null ? '' : String(raw)).trim();
      if (!s) return s;
      var u = s.toUpperCase();
      if (u.indexOf('HONDA') >= 0 || u.indexOf('HR-417E') >= 0) return 'Honda HR-417E';
      if (u.indexOf('TOYOTA') >= 0 || u.indexOf('TRD01F') >= 0 || u.indexOf('TRD-01F') >= 0) return 'Toyota TRD-01F';
      return s;
    }
    function normalizeSuperFormulaEngineColumns(tableData) {
      if (!tableData || !Array.isArray(tableData.headers) || !Array.isArray(tableData.rows)) return tableData;
      var seriesUpper = (seriesId || '').toUpperCase();
      if (seriesUpper !== 'SUPER_FORMULA') return tableData;
      var engineIdx = [];
      for (var hi = 0; hi < tableData.headers.length; hi++) {
        if (String(tableData.headers[hi] || '').trim().toLowerCase() === 'engine') engineIdx.push(hi);
      }
      if (engineIdx.length === 0) return tableData;
      return {
        headers: tableData.headers.slice(),
        rows: tableData.rows.map(function (r) {
          var row = Array.isArray(r) ? r.slice() : [];
          engineIdx.forEach(function (idx) {
            if (idx >= 0 && idx < row.length) row[idx] = formatSuperFormulaEngineLabel(row[idx]);
          });
          return row;
        })
      };
    }
    function appendTable(title, tableData, extraClass, getRowClass, mergeTeamCells) {
      function dropTimeOfDayColumn(td) {
        if (!td || !Array.isArray(td.headers) || !Array.isArray(td.rows)) return td;
        var idx = -1;
        for (var i = 0; i < td.headers.length; i++) {
          var h = String(td.headers[i] || '').toLowerCase().trim();
          if (h === 'time of the day') {
            idx = i;
            break;
          }
        }
        if (idx < 0) return td;
        return {
          headers: td.headers.slice(0, idx).concat(td.headers.slice(idx + 1)),
          rows: td.rows.map(function (r) {
            return Array.isArray(r) ? r.slice(0, idx).concat(r.slice(idx + 1)) : r;
          }),
          meta: td.meta
        };
      }
      function buildStartSubtitle(meta) {
        if (!meta || typeof meta !== 'object') return '';
        var parts = [];
        Object.keys(meta).forEach(function (k) {
          if (!/^start/i.test(String(k || '').trim())) return;
          var v = meta[k];
          if (v == null || String(v).trim() === '') return;
          var key = String(k).trim();
          var label = 'Start';
          var m = key.match(/^start\s*\((.+)\)$/i);
          if (m && m[1] && String(m[1]).trim()) label = String(m[1]).trim();
          parts.push(label + ': ' + String(v).trim());
        });
        return parts.join(' · ');
      }
      tableData = transformTableDataForF2F3(tableData);
      tableData = normalizeSuperFormulaEngineColumns(tableData);
      tableData = dropTimeOfDayColumn(tableData);
      if ((seriesId || '').toLowerCase() === 'supercars' && isSupercarsSydneyEvent(evKeyEvent)) {
        tableData = supercarsSydneyCarDisplay(tableData);
      }
      var subtitle = (tableData && tableData.meta) ? buildStartSubtitle(tableData.meta) : '';
      var result = buildTableSection(title, tableData, extraClass, getRowClass, null, subtitle, null, mergeTeamCells);
      if (!result) return;
      html += result.html;
      sortQueue.push({ rows: result.rows, getRowClass: result.getRowClass });
    }

    var eventIdUpperForClass = String(d.event_id || eventIdFromRoute || '').toUpperCase();
    var elmsClassMap = {
      'lmp2': 'LMP2',
      'lmp2-pro-am': 'LMP2 Pro/Am',
      'lmp3': 'LMP3',
      'lmgt3': 'LMGT3'
    };
    function normalizeClassName(v) {
      return String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    }
    function filterTableRowsByClass(tableData, className) {
      if (!tableData || !Array.isArray(tableData.headers) || !Array.isArray(tableData.rows)) return tableData;
      var clsIdx = -1;
      for (var i = 0; i < tableData.headers.length; i++) {
        if (String(tableData.headers[i] || '').trim().toLowerCase() === 'class') {
          clsIdx = i;
          break;
        }
      }
      if (clsIdx < 0) return tableData;
      var wanted = normalizeClassName(className);
      var out = {
        headers: tableData.headers.slice(),
        rows: tableData.rows.filter(function (row) {
          return normalizeClassName(row && row[clsIdx]) === wanted;
        })
      };
      // Preserve session metadata (title/meta/note/etc.) so UI labels do not regress to defaults.
      Object.keys(tableData).forEach(function (k) {
        if (k === 'headers' || k === 'rows') return;
        out[k] = tableData[k];
      });
      return out;
    }
    if (eventIdUpperForClass === 'ELMS_2026_PROLOGUE' && elmsClassMap[section]) {
      var className = elmsClassMap[section];
      var scopedTables = Object.assign({}, d.tables || {});
      scopedTables.practice = filterTableRowsByClass(scopedTables.practice, className);
      scopedTables.practice2 = filterTableRowsByClass(scopedTables.practice2, className);
      scopedTables.practice3 = filterTableRowsByClass(scopedTables.practice3, className);
      scopedTables.final_practice = filterTableRowsByClass(scopedTables.final_practice, className);
      scopedTables.practice5 = filterTableRowsByClass(scopedTables.practice5, className);
      d = Object.assign({}, d, {
        tables: scopedTables,
        entry_list: Array.isArray(d.entry_list)
          ? d.entry_list.filter(function (e) { return normalizeClassName(e && e.class) === normalizeClassName(className); })
          : []
      });
      section = 'practice';
    }
    if (eventIdUpperForClass === 'WEC_2026_PROLOGUE' && (section === 'hypercar' || section === 'lmgt3')) {
      var prWec = d.tables && d.tables.practice;
      if (prWec && Array.isArray(prWec.sessions)) {
        var sessFiltered = prWec.sessions.filter(function (s) {
          var t = String((s && s.title) || '').trim();
          var isLmgt3Block = /^LMGT3\b/i.test(t);
          if (section === 'lmgt3') return isLmgt3Block;
          return !isLmgt3Block;
        });
        d = Object.assign({}, d, {
          tables: Object.assign({}, d.tables, {
            practice: Object.assign({}, prWec, { sessions: sessFiltered })
          })
        });
      }
      section = 'practice';
    }

    if (section === 'race') {
      renderRaceContent(d, contentEl);
      return;
    }

    if (section === 'bop') {
      contentEl.innerHTML = renderBopContent(esc, d);
      return;
    }

    if (section === 'pre_season_tests') {
      var evKeyPst = ((d.event_id || '') + '').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
      var pst = d.tables && d.tables.pre_season_tests;
      function renderOneSession(sess) {
        var out = '';
        if (sess.title) out += '<h3 class="event-pre-season-title">' + esc(sess.title) + '</h3>';
        if (sess.subtitle) out += '<p class="event-pre-season-subtitle">' + esc(sess.subtitle) + '</p>';
        if (sess.caption) out += '<p class="event-pre-season-caption">' + esc(sess.caption) + '</p>';
        if (!( /^IMSA_\d{4}_\d+$/.test(evKeyPst) || evKeyPst === 'IMSA_2026_PRE_SEASON_TEST') && evKeyPst !== 'F1_2026_PRE_SEASON_TEST_1' && evKeyPst !== 'F1_2026_PRE_SEASON_TEST_2') {
          out += buildSessionMetaTable(sess.meta);
        }
        if (sess.headers && Array.isArray(sess.rows)) {
          var rows = sess.rows;
          if (evKeyPst === 'IMSA_2026_PRE_SEASON_TEST' || evKeyPst === 'IMSA_2026_1') {
            var stIdx = sess.headers.indexOf('ST POS');
            if (stIdx >= 0) {
              sess.headers = sess.headers.slice(0, stIdx).concat(sess.headers.slice(stIdx + 1));
              rows = rows.map(function (r) { return r.slice(0, stIdx).concat(r.slice(stIdx + 1)); });
            }
          }
          var teamColIdx = -1;
          for (var hi = 0; hi < sess.headers.length; hi++) {
            var hText = (sess.headers[hi] || '').toLowerCase().trim();
            if (hText === 'team/car/sponsor' || hText.indexOf('team/car') === 0) {
              teamColIdx = hi;
              break;
            }
          }
          if (teamColIdx >= 0) {
            var newHeaders = [];
            for (var hi2 = 0; hi2 < sess.headers.length; hi2++) {
              if (hi2 === teamColIdx) {
                newHeaders.push('TEAM', 'CAR');
              } else {
                newHeaders.push(sess.headers[hi2]);
              }
            }
            sess.headers = newHeaders;
            var dropSponsorInCar = (evKeyPst === 'IMSA_2026_PRE_SEASON_TEST' || evKeyPst === 'IMSA_2026_1');
            rows = rows.map(function (r) {
              var cell = r[teamColIdx] != null ? String(r[teamColIdx]) : '';
              var parts = cell.split(/\s*\/\s*/);
              var team = (parts[0] || '').trim();
              var car = dropSponsorInCar ? (parts[1] != null ? String(parts[1]).trim() : '') : parts.slice(1).join(' / ');
              var before = r.slice(0, teamColIdx);
              var after = r.slice(teamColIdx + 1);
              return before.concat([team, car], after);
            });
          }
          /* Do not filter by NO LAPS for IMSA pre_season_tests — otherwise Session 1 may be empty  */
          var numberColIdx = sess.headers.indexOf('CAR NO');
          var teamColIdxAfterSplit = sess.headers.indexOf('TEAM');
          if (numberColIdx < 0) numberColIdx = 1;
          if (teamColIdxAfterSplit < 0) teamColIdxAfterSplit = 3;
          if (evKeyPst !== 'F1_2026_PRE_SEASON_TEST_1' && evKeyPst !== 'F1_2026_PRE_SEASON_TEST_2') {
            rows = applyTeamNameByNumber(rows, numberColIdx, teamColIdxAfterSplit);
          }
          var resultsTitle = (evKeyPst === 'F1_2026_PRE_SEASON_TEST_1' || evKeyPst === 'F1_2026_PRE_SEASON_TEST_2') ? '' : '<h4 class="table-section-title">Results</h4>';
          out += resultsTitle;
          var defaultHeaders = ['POS', 'CAR NO', 'DRIVERS', 'TEAM', 'CAR', 'CLASS', 'CLASS POS', 'ST POS', 'NO LAPS', 'FASTEST LAP', 'STATUS'];
          var headersForTable = sess.headers && sess.headers.length > 0 ? sess.headers : defaultHeaders;
          if (rows.length > 0 && headersForTable.length !== rows[0].length) {
            if (headersForTable.length < rows[0].length) {
              while (headersForTable.length < rows[0].length) headersForTable.push(defaultHeaders[headersForTable.length] || '');
            } else {
              headersForTable = headersForTable.slice(0, rows[0].length);
            }
          }
          if ((/^IMSA_\d{4}_\d+$/.test(evKeyPst) || evKeyPst === 'IMSA_2026_PRE_SEASON_TEST') && d.entry_list && d.entry_list.length) {
            var pstData = applyClassFromEntryList({ headers: headersForTable, rows: rows }, d.entry_list);
            pstData = recomputeClassPos(pstData);
            headersForTable = pstData.headers;
            rows = pstData.rows;
          }
          var tbl = { headers: headersForTable, rows: rows };
          var pstTableClass = 'pre-season-results-table pre-season-results-table--session';
          if (evKeyPst === 'F1_2026_PRE_SEASON_TEST_1' || evKeyPst === 'F1_2026_PRE_SEASON_TEST_2') pstTableClass += ' pre-season-results-table--fit';
          if ((seriesId || '').toLowerCase() === 'imsa') pstTableClass += ' race-session-results-table';
          var result = buildTableSection(null, tbl, pstTableClass);
          if (result) {
            var htmlFrag = result.html;
            out += htmlFrag;
            sortQueue.push({ rows: result.rows, getRowClass: result.getRowClass });
          }
        }
        return out;
      }
      if (pst && Array.isArray(pst.sessions) && pst.sessions.length > 0) {
        html += '<div class="event-pre-season-block">';
        pst.sessions.forEach(function (sess, idx) {
          if (idx > 0) html += '<hr class="event-pre-season-divider">';
          html += renderOneSession(sess);
        });
        html += '</div>';
      } else if (pst && (pst.title || pst.headers)) {
        html += '<div class="event-pre-season-block">';
        html += renderOneSession(pst);
        html += '</div>';
      } else if (pst && pst.headers && Array.isArray(pst.rows)) {
        appendTable(t('block.pre_season_tests'), pst);
      }
      if (!html) contentEl.innerHTML = '<p class="empty-msg">' + (t('error.no_section_data') || 'No data yet') + '</p>';
      else { contentEl.innerHTML = html; var tables = contentEl.querySelectorAll('.data-table'); [].forEach.call(tables, function (table, idx) { var q = sortQueue[idx]; if (q && q.rows) makeTableSortable(table, q.rows, esc, q.getRowClass); }); }
      return;
    }

    if (section === 'entry-list') {
      var entryTables = d && d.tables && d.tables.entry_list;
      if (entryTables && Array.isArray(entryTables.sessions) && entryTables.sessions.length > 0) {
        function idxByName(headers, names) {
          var set = {};
          names.forEach(function (n) { set[String(n).toLowerCase()] = true; });
          for (var i = 0; i < headers.length; i++) {
            var h = String(headers[i] || '').toLowerCase().trim();
            if (set[h]) return i;
          }
          return -1;
        }
        function renderMergedEntrySession(sess) {
          var rawHeaders = Array.isArray(sess.headers) ? sess.headers.slice() : [];
          var rawRows = Array.isArray(sess.rows) ? sess.rows.map(function (r) { return Array.isArray(r) ? r.slice() : []; }) : [];
          var roundsIdxRaw = idxByName(rawHeaders, ['rounds', 'round']);
          var headers = rawHeaders;
          var rows = rawRows;
          if (roundsIdxRaw >= 0) {
            headers = rawHeaders.slice(0, roundsIdxRaw).concat(rawHeaders.slice(roundsIdxRaw + 1));
            rows = rawRows.map(function (r) {
              return r.slice(0, roundsIdxRaw).concat(r.slice(roundsIdxRaw + 1));
            });
          }
          if (!headers.length) return '';

          var entrantIdx = idxByName(headers, ['entrant', 'team']);
          var numberIdx = idxByName(headers, ['no.', 'no', '#']);
          var carIdx = idxByName(headers, ['car']);
          var engineIdx = idxByName(headers, ['engine', 'power unit']);
          var hybridIdx = idxByName(headers, ['hybrid']);
          var tyreIdx = idxByName(headers, ['tyre', 'tire']);
          var driverIdx = idxByName(headers, ['drivers', 'driver']);

          // Build effective rows: empty Entrant/Car/Engine inherit from previous row.
          var effective = rows.map(function (r) { return r.slice(); });
          for (var ri = 0; ri < effective.length; ri++) {
            if (entrantIdx >= 0 && (effective[ri][entrantIdx] == null || String(effective[ri][entrantIdx]).trim() === '') && ri > 0) {
              effective[ri][entrantIdx] = effective[ri - 1][entrantIdx];
            }
            if (numberIdx >= 0 && (effective[ri][numberIdx] == null || String(effective[ri][numberIdx]).trim() === '') && ri > 0) {
              var prevTeamForNo = entrantIdx >= 0 ? String(effective[ri - 1][entrantIdx] || '').trim() : '';
              var curTeamForNo = entrantIdx >= 0 ? String(effective[ri][entrantIdx] || '').trim() : prevTeamForNo;
              if (!entrantIdx || prevTeamForNo === curTeamForNo) {
                effective[ri][numberIdx] = effective[ri - 1][numberIdx];
              }
            }
            if (carIdx >= 0 && (effective[ri][carIdx] == null || String(effective[ri][carIdx]).trim() === '') && ri > 0) {
              effective[ri][carIdx] = effective[ri - 1][carIdx];
            }
            if (engineIdx >= 0 && (effective[ri][engineIdx] == null || String(effective[ri][engineIdx]).trim() === '') && ri > 0) {
              effective[ri][engineIdx] = effective[ri - 1][engineIdx];
            }
            if (hybridIdx >= 0 && (effective[ri][hybridIdx] == null || String(effective[ri][hybridIdx]).trim() === '') && ri > 0) {
              effective[ri][hybridIdx] = effective[ri - 1][hybridIdx];
            }
            if (tyreIdx >= 0 && (effective[ri][tyreIdx] == null || String(effective[ri][tyreIdx]).trim() === '') && ri > 0) {
              effective[ri][tyreIdx] = effective[ri - 1][tyreIdx];
            }
          }

          var entrantSpan = new Array(effective.length).fill(0);
          var numberSpan = new Array(effective.length).fill(0);
          var carSpan = new Array(effective.length).fill(0);
          var engineSpan = new Array(effective.length).fill(0);
          var hybridSpan = new Array(effective.length).fill(0);
          var tyreSpan = new Array(effective.length).fill(0);

          if (entrantIdx >= 0) {
            for (var i = 0; i < effective.length; i++) {
              if (entrantSpan[i] === -1) continue;
              var teamVal = String(effective[i][entrantIdx] || '').trim();
              var s = 1;
              for (var j = i + 1; j < effective.length; j++) {
                var nextTeam = String(effective[j][entrantIdx] || '').trim();
                if (nextTeam === teamVal) { s++; entrantSpan[j] = -1; } else break;
              }
              entrantSpan[i] = s;
            }
          }

          if (numberIdx >= 0 && entrantIdx >= 0) {
            for (var inum = 0; inum < effective.length; inum++) {
              if (numberSpan[inum] === -1) continue;
              var teamNum = String(effective[inum][entrantIdx] || '').trim();
              var noVal = String(effective[inum][numberIdx] || '').trim();
              var sn = 1;
              for (var jnum = inum + 1; jnum < effective.length; jnum++) {
                var teamNumNext = String(effective[jnum][entrantIdx] || '').trim();
                var noNext = String(effective[jnum][numberIdx] || '').trim();
                if (teamNumNext === teamNum && noNext === noVal) { sn++; numberSpan[jnum] = -1; } else break;
              }
              numberSpan[inum] = sn;
            }
          }

          if (carIdx >= 0 && entrantIdx >= 0) {
            for (var i2 = 0; i2 < effective.length; i2++) {
              if (carSpan[i2] === -1) continue;
              var teamVal2 = String(effective[i2][entrantIdx] || '').trim();
              var carVal = String(effective[i2][carIdx] || '').trim();
              var s2 = 1;
              for (var j2 = i2 + 1; j2 < effective.length; j2++) {
                var nextTeam2 = String(effective[j2][entrantIdx] || '').trim();
                var nextCar = String(effective[j2][carIdx] || '').trim();
                if (nextTeam2 === teamVal2 && nextCar === carVal) { s2++; carSpan[j2] = -1; } else break;
              }
              carSpan[i2] = s2;
            }
          }

          if (engineIdx >= 0 && entrantIdx >= 0) {
            for (var i3 = 0; i3 < effective.length; i3++) {
              if (engineSpan[i3] === -1) continue;
              var teamVal3 = String(effective[i3][entrantIdx] || '').trim();
              var engVal = String(effective[i3][engineIdx] || '').trim();
              var s3 = 1;
              for (var j3 = i3 + 1; j3 < effective.length; j3++) {
                var nextTeam3 = String(effective[j3][entrantIdx] || '').trim();
                var nextEng = String(effective[j3][engineIdx] || '').trim();
                if (nextTeam3 === teamVal3 && nextEng === engVal) { s3++; engineSpan[j3] = -1; } else break;
              }
              engineSpan[i3] = s3;
            }
          }

          if (hybridIdx >= 0 && entrantIdx >= 0) {
            for (var i4 = 0; i4 < effective.length; i4++) {
              if (hybridSpan[i4] === -1) continue;
              var teamVal4 = String(effective[i4][entrantIdx] || '').trim();
              var hybridVal = String(effective[i4][hybridIdx] || '').trim();
              var s4 = 1;
              for (var j4 = i4 + 1; j4 < effective.length; j4++) {
                var nextTeam4 = String(effective[j4][entrantIdx] || '').trim();
                var nextHybrid = String(effective[j4][hybridIdx] || '').trim();
                if (nextTeam4 === teamVal4 && nextHybrid === hybridVal) { s4++; hybridSpan[j4] = -1; } else break;
              }
              hybridSpan[i4] = s4;
            }
          }

          if (tyreIdx >= 0 && entrantIdx >= 0) {
            for (var i5 = 0; i5 < effective.length; i5++) {
              if (tyreSpan[i5] === -1) continue;
              var teamVal5 = String(effective[i5][entrantIdx] || '').trim();
              var tyreVal = String(effective[i5][tyreIdx] || '').trim();
              var s5 = 1;
              for (var j5 = i5 + 1; j5 < effective.length; j5++) {
                var nextTeam5 = String(effective[j5][entrantIdx] || '').trim();
                var nextTyre = String(effective[j5][tyreIdx] || '').trim();
                if (nextTeam5 === teamVal5 && nextTyre === tyreVal) { s5++; tyreSpan[j5] = -1; } else break;
              }
              tyreSpan[i5] = s5;
            }
          }

          var thead = '<thead><tr>' + headers.map(function (h) {
            return '<th>' + esc(localizeTableHeader(h || '')) + '</th>';
          }).join('') + '</tr></thead>';

          var tbody = rows.map(function (row, rIdx) {
            var cells = '';
            for (var ci = 0; ci < headers.length; ci++) {
              if (ci === entrantIdx) {
                if (entrantSpan[rIdx] === -1) continue;
                var teamRaw = String(effective[rIdx][ci] || '').trim();
                var teamCell = teamRaw
                  ? '<a href="/team/' + encodeURIComponent(slugify(teamRaw)) + '" class="track-link">' + esc(teamRaw) + '</a>'
                  : '—';
                cells += '<td rowspan="' + Math.max(1, entrantSpan[rIdx]) + '" class="entry-list-team-cell">' + teamCell + '</td>';
                continue;
              }
              if (ci === numberIdx) {
                if (numberSpan[rIdx] === -1) continue;
                var noRaw = String(effective[rIdx][ci] || '').trim();
                cells += '<td rowspan="' + Math.max(1, numberSpan[rIdx]) + '">' + esc(noRaw || '—') + '</td>';
                continue;
              }
              if (ci === carIdx) {
                if (carSpan[rIdx] === -1) continue;
                var carRaw = String(effective[rIdx][ci] || '').trim();
                cells += '<td rowspan="' + Math.max(1, carSpan[rIdx]) + '">' + esc(carRaw || '—') + '</td>';
                continue;
              }
              if (ci === engineIdx) {
                if (engineSpan[rIdx] === -1) continue;
                var engRaw = String(effective[rIdx][ci] || '').trim();
                cells += '<td rowspan="' + Math.max(1, engineSpan[rIdx]) + '">' + esc(engRaw || '—') + '</td>';
                continue;
              }
              if (ci === hybridIdx) {
                if (hybridSpan[rIdx] === -1) continue;
                var hybridRaw = String(effective[rIdx][ci] || '').trim();
                cells += '<td rowspan="' + Math.max(1, hybridSpan[rIdx]) + '">' + esc(hybridRaw || '—') + '</td>';
                continue;
              }
              if (ci === tyreIdx) {
                if (tyreSpan[rIdx] === -1) continue;
                var tyreRaw = String(effective[rIdx][ci] || '').trim();
                cells += '<td rowspan="' + Math.max(1, tyreSpan[rIdx]) + '">' + esc(tyreRaw || '—') + '</td>';
                continue;
              }
              if (ci === driverIdx) {
                var drvRaw = (row[ci] != null ? String(row[ci]) : '').trim();
                if (drvRaw) {
                  var display = driverDisplayName(drvRaw);
                  cells += '<td><a href="/driver/' + encodeURIComponent(slugify(display)) + '" class="track-link">' + esc(display) + '</a></td>';
                } else {
                  cells += '<td>—</td>';
                }
                continue;
              }
              var val = (row[ci] == null || String(row[ci]).trim() === '') ? '—' : row[ci];
              cells += '<td>' + esc(val) + '</td>';
            }
            return '<tr>' + cells + '</tr>';
          }).join('');

          var title = sess.title || (t('section.entry_list') || 'Entry list');
          return '<h4 class="table-section-title">' + esc(title) + '</h4>' +
            '<div class="table-wrap"><table class="data-table entry-list-table">' +
            thead + '<tbody>' + tbody + '</tbody></table></div>';
        }

        entryTables.sessions.forEach(function (sess) {
          if (!sess || !Array.isArray(sess.headers) || !Array.isArray(sess.rows)) return;
          html += renderMergedEntrySession(sess);
        });
        if (!html) contentEl.innerHTML = '<p class="empty-msg">' + t('error.no_entry_list') + '</p>';
        else contentEl.innerHTML = html;
        return;
      }

      if (!d.entry_list || d.entry_list.length === 0) {
        contentEl.innerHTML = '<p class="empty-msg">' + t('error.no_entry_list') + '</p>';
        return;
      }
      var entryCopy = d.entry_list.slice();
      var evKeyEntry = ((d.event_id || '') + '').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
      var seriesSlugEntryList = (eventSeriesId(d.event_id || eventIdFromRoute || '') || '').toLowerCase();
      if (seriesSlugEntryList === 'imsa') {
        // Column order: #, Class, Team, Car, Drivers. For one team merge Team, Class and Car cells (rowspan).
        var headImsa = '<th>' + t('th.no') + '</th><th>Class</th><th>' + t('th.team') + '</th><th>Car</th><th>' + t('th.driver') + '</th>';
        function buildImsaEntryTbody(arr, byNum) {
          var teamVals = arr.map(function (row) {
            var tv = row.team;
            if (byNum && row.number != null) tv = byNum[String(row.number).trim()] || byNum[String(parseInt(row.number, 10))] || tv;
            return tv != null ? String(tv) : '';
          });
          var classVals = arr.map(function (row) {
            return row.class != null ? String(row.class) : '';
          });
          var teamRowspan = [];
          for (var i = 0; i < arr.length; i++) {
            if (i === 0 || teamVals[i] !== teamVals[i - 1] || classVals[i] !== classVals[i - 1]) {
              var ts = 1;
              while (i + ts < arr.length && teamVals[i + ts] === teamVals[i] && classVals[i + ts] === classVals[i]) ts++;
              teamRowspan.push(ts);
            } else {
              teamRowspan.push(0);
            }
          }
          return arr.map(function (row, idx) {
            var teamDisplay = teamVals[idx];
            var carDisplay = (row.car != null && String(row.car).trim()) ? String(row.car) : (row.manufacturer != null ? String(row.manufacturer) : '');
            var classDisplay = row.class != null ? String(row.class) : '';
            var driverRaw = row.driver != null ? String(row.driver) : '';
            var driverParts = driverRaw.split(/\s*\/\s*/).map(function (p) { return p.trim(); }).filter(function (p) { return p; });
            var driverCell = driverParts.length
              ? driverParts.map(function (name) {
                  var display = driverDisplayName(name);
                  return display ? '<a href="/driver/' + encodeURIComponent(slugify(display)) + '" class="track-link">' + esc(display) + '</a>' : esc(name);
                }).join(' / ')
              : '—';
            var span = teamRowspan[idx];
            var teamTd = span > 0
              ? '<td rowspan="' + span + '" class="entry-list-team-cell">' + (teamDisplay ? '<a href="/team/' + encodeURIComponent(slugify(teamDisplay)) + '" class="track-link">' + esc(teamDisplay) + '</a>' : '—') + '</td>'
              : '';
            var classTd = span > 0
              ? '<td rowspan="' + span + '" class="entry-list-class-cell">' + esc(dash(classDisplay)) + '</td>'
              : '';
            var carTd = span > 0
              ? '<td rowspan="' + span + '" class="entry-list-car-cell">' + esc(dash(carDisplay)) + '</td>'
              : '';
            return '<tr><td>' + esc(dash(row.number)) + '</td>' + classTd + teamTd + carTd + '<td>' + driverCell + '</td></tr>';
          }).join('');
        }
        contentEl.innerHTML = '<div class="table-wrap"><table class="data-table entry-list-table"><thead><tr>' + headImsa + '</tr></thead><tbody>' + buildImsaEntryTbody(entryCopy, byNumber) + '</tbody></table></div>';
        addObjectTableSort(contentEl.querySelector('.data-table'), entryCopy, null, ['number', 'class', 'team', 'car', 'driver'], function (dataCopy) {
          return buildImsaEntryTbody(dataCopy, byNumber);
        });
        return;
      }
      var eventIdLower = (d.event_id || eventIdFromRoute || '').toLowerCase();
      var seriesLowerEntry = (eventSeriesId(d.event_id || eventIdFromRoute || '') || '').toLowerCase();
      var isElmsEntry = seriesLowerEntry === 'elms'
        && entryCopy.some(function (e) { return e && e.class != null; })
        && entryCopy.some(function (e) { return e && (e.driver1 != null || e.driver2 != null || e.driver3 != null); });
      if (isElmsEntry) {
        var elmsClassOrder = ['LMP2', 'LMP2 Pro/Am', 'LMP3', 'LMGT3'];
        function normElmsClass(v) {
          return String(v || '')
            .replace(/\u00a0/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toUpperCase();
        }
        function sortByCarNumber(a, b) {
          var na = parseInt(String((a && a.number) || '').replace(/[^\d]/g, ''), 10);
          var nb = parseInt(String((b && b.number) || '').replace(/[^\d]/g, ''), 10);
          if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
          return String((a && a.number) || '').localeCompare(String((b && b.number) || ''), undefined, { numeric: true, sensitivity: 'base' });
        }
        function renderElmsDriverCell(name) {
          var raw = (name == null) ? '' : String(name).trim();
          if (!raw || raw === '-') return '—';
          var display = driverDisplayName(raw);
          return display
            ? '<a href="/driver/' + encodeURIComponent(slugify(display)) + '" class="track-link">' + esc(display) + '</a>'
            : esc(raw);
        }
        var htmlElms = '';
        for (var ci = 0; ci < elmsClassOrder.length; ci++) {
          var clsName = elmsClassOrder[ci];
          var clsRows = entryCopy
            .filter(function (r) { return normElmsClass(r && r.class) === normElmsClass(clsName); })
            .sort(sortByCarNumber);
          if (!clsRows.length) continue;
          var bodyElms = clsRows.map(function (row) {
            var teamName = (row && row.team != null) ? String(row.team).trim() : '';
            var teamCell = teamName
              ? '<a href="/team/' + encodeURIComponent(slugify(teamName)) + '" class="track-link">' + esc(teamName) + '</a>'
              : '—';
            var carVal = (row && row.car != null) ? String(row.car).trim() : '';
            return '<tr>' +
              '<td>' + esc(dash(row && row.number)) + '</td>' +
              '<td>' + teamCell + '</td>' +
              '<td>' + esc(dash(carVal)) + '</td>' +
              '<td>' + renderElmsDriverCell(row && row.driver1) + '</td>' +
              '<td>' + renderElmsDriverCell(row && row.driver2) + '</td>' +
              '<td>' + renderElmsDriverCell(row && row.driver3) + '</td>' +
              '</tr>';
          }).join('');
          htmlElms += '<h4 class="table-section-title">' + esc(clsName) + '</h4>' +
            '<div class="table-wrap"><table class="data-table entry-list-table">' +
            '<thead><tr><th>' + t('th.no') + '</th><th>' + t('th.team') + '</th><th>Car</th><th>Driver 1</th><th>Driver 2</th><th>Driver 3</th></tr></thead>' +
            '<tbody>' + bodyElms + '</tbody></table></div>';
        }
        contentEl.innerHTML = htmlElms || ('<p class="empty-msg">' + t('error.no_entry_list') + '</p>');
        return;
      }
      var isGtwceEndEntry = (seriesLowerEntry === 'gtwce_end' || seriesLowerEntry === 'gtwce_sprint')
        && entryCopy.some(function (e) { return e && e.class != null; })
        && entryCopy.some(function (e) { return e && (e.driver1 != null || e.driver2 != null || e.driver3 != null); });
      if (isGtwceEndEntry) {
        var gtwceSprintTwoDrivers = seriesLowerEntry === 'gtwce_sprint';
        var gtwceClassOrder = ['PRO', 'GOLD', 'SILVER', 'BRONZE'];
        var gtwceClassLabels = { PRO: 'Pro', GOLD: 'Gold', SILVER: 'Silver', BRONZE: 'Bronze' };
        function normGtwceClass(v) {
          return String(v || '')
            .replace(/\u00a0/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toUpperCase();
        }
        function sortByCarNumberGtwce(a, b) {
          var na = parseInt(String((a && a.number) || '').replace(/[^\d]/g, ''), 10);
          var nb = parseInt(String((b && b.number) || '').replace(/[^\d]/g, ''), 10);
          if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
          return String((a && a.number) || '').localeCompare(String((b && b.number) || ''), undefined, { numeric: true, sensitivity: 'base' });
        }
        function sortByTeamThenCarGtwce(a, b) {
          var ta = (a && a.team != null) ? String(a.team).trim() : '';
          var tb = (b && b.team != null) ? String(b.team).trim() : '';
          var cmp = ta.localeCompare(tb, undefined, { sensitivity: 'base' });
          if (cmp !== 0) return cmp;
          return sortByCarNumberGtwce(a, b);
        }
        function renderGtwceDriverCell(name) {
          var raw = (name == null) ? '' : String(name).trim();
          if (!raw || raw === '-') return '—';
          var display = driverDisplayName(raw);
          return display
            ? '<a href="/driver/' + encodeURIComponent(slugify(display)) + '" class="track-link">' + esc(display) + '</a>'
            : esc(raw);
        }
        var htmlGtwce = '';
        for (var gci = 0; gci < gtwceClassOrder.length; gci++) {
          var clsKey = gtwceClassOrder[gci];
          var clsRowsGtwce = entryCopy
            .filter(function (r) { return normGtwceClass(r && r.class) === clsKey; })
            .sort(sortByTeamThenCarGtwce);
          if (!clsRowsGtwce.length) continue;
          var teamValsGtwce = clsRowsGtwce.map(function (row) {
            return (row && row.team != null) ? String(row.team).trim() : '';
          });
          var teamRowspanGtwce = [];
          for (var tri = 0; tri < clsRowsGtwce.length; tri++) {
            if (tri === 0 || teamValsGtwce[tri] !== teamValsGtwce[tri - 1]) {
              var trs = 1;
              while (tri + trs < clsRowsGtwce.length && teamValsGtwce[tri + trs] === teamValsGtwce[tri]) trs++;
              teamRowspanGtwce.push(trs);
            } else {
              teamRowspanGtwce.push(0);
            }
          }
          var bodyGtwce = clsRowsGtwce.map(function (row, trix) {
            var teamNameG = (row && row.team != null) ? String(row.team).trim() : '';
            var teamCellG = teamNameG
              ? '<a href="/team/' + encodeURIComponent(slugify(teamNameG)) + '" class="track-link">' + esc(teamNameG) + '</a>'
              : '—';
            var carValG = (row && row.car != null) ? String(row.car).trim() : '';
            var spanG = teamRowspanGtwce[trix];
            var teamTdGtwce = spanG > 0
              ? '<td rowspan="' + spanG + '" class="entry-list-team-cell">' + teamCellG + '</td>'
              : '';
            var driverCellsGtwce = gtwceSprintTwoDrivers
              ? '<td>' + renderGtwceDriverCell(row && row.driver1) + '</td>' +
                '<td>' + renderGtwceDriverCell(row && row.driver2) + '</td>'
              : '<td>' + renderGtwceDriverCell(row && row.driver1) + '</td>' +
                '<td>' + renderGtwceDriverCell(row && row.driver2) + '</td>' +
                '<td>' + renderGtwceDriverCell(row && row.driver3) + '</td>';
            return '<tr>' +
              '<td>' + esc(dash(row && row.number)) + '</td>' +
              teamTdGtwce +
              '<td>' + esc(dash(carValG)) + '</td>' +
              driverCellsGtwce +
              '</tr>';
          }).join('');
          var sectionTitle = gtwceClassLabels[clsKey] || clsKey;
          var gtwceEntryListHead = '<thead><tr><th>' + t('th.no') + '</th><th>' + t('th.team') + '</th><th>Car</th><th>Driver 1</th><th>Driver 2</th>' +
            (gtwceSprintTwoDrivers ? '' : '<th>Driver 3</th>') + '</tr></thead>';
          htmlGtwce += '<h4 class="table-section-title">' + esc(sectionTitle) + '</h4>' +
            '<div class="table-wrap"><table class="data-table entry-list-table">' +
            gtwceEntryListHead +
            '<tbody>' + bodyGtwce + '</tbody></table></div>';
        }
        contentEl.innerHTML = htmlGtwce || ('<p class="empty-msg">' + t('error.no_entry_list') + '</p>');
        return;
      }
      var isSuperGtEntry = seriesLowerEntry === 'super_gt'
        && entryCopy.some(function (e) { return e && e.class != null; });
      if (isSuperGtEntry) {
        var superGtClassOrder = ['GT500', 'GT300'];
        function normSuperGtClass(v) {
          return String(v || '')
            .replace(/\u00a0/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toUpperCase();
        }
        function sortBySuperGtNo(a, b) {
          var na = parseInt(String((a && a.number) || '').replace(/[^\d]/g, ''), 10);
          var nb = parseInt(String((b && b.number) || '').replace(/[^\d]/g, ''), 10);
          if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
          return String((a && a.number) || '').localeCompare(String((b && b.number) || ''), undefined, { numeric: true, sensitivity: 'base' });
        }
        function sortBySuperGtTeamCarNo(a, b) {
          var ta = String((a && a.team) || '').trim().toLowerCase();
          var tb = String((b && b.team) || '').trim().toLowerCase();
          if (ta < tb) return -1;
          if (ta > tb) return 1;
          var ca = String((a && a.car) || '').trim().toLowerCase();
          var cb = String((b && b.car) || '').trim().toLowerCase();
          if (ca < cb) return -1;
          if (ca > cb) return 1;
          return sortBySuperGtNo(a, b);
        }
        function renderSuperGtDrivers(row) {
          var names = [];
          ['driver1', 'driver2', 'driver3'].forEach(function (k) {
            var raw = row && row[k] != null ? String(row[k]).trim() : '';
            if (!raw) return;
            if (/^tbc$/i.test(raw)) return;
            names.push(raw);
          });
          if (!names.length && row && row.driver != null) {
            String(row.driver).split(/\s*\/\s*/).forEach(function (p) {
              var v = String(p || '').trim();
              if (!v || /^tbc$/i.test(v)) return;
              names.push(v);
            });
          }
          if (!names.length) return '—';
          return names.map(function (name) {
            var display = driverDisplayName(name);
            return display ? '<a href="/driver/' + encodeURIComponent(slugify(display)) + '" class="track-link">' + esc(display) + '</a>' : esc(name);
          }).join(' / ');
        }
        var htmlSuperGt = '';
        for (var sci = 0; sci < superGtClassOrder.length; sci++) {
          var clsSuperGt = superGtClassOrder[sci];
          var rowsSuperGt = entryCopy
            .filter(function (r) { return normSuperGtClass(r && r.class) === normSuperGtClass(clsSuperGt); })
            .sort(sortBySuperGtTeamCarNo);
          if (!rowsSuperGt.length) continue;
          var teamValsSuperGt = rowsSuperGt.map(function (row) {
            return (row && row.team != null) ? String(row.team).trim() : '';
          });
          var carValsSuperGt = rowsSuperGt.map(function (row) {
            return (row && row.car != null) ? String(row.car).trim() : '';
          });
          var teamRowspanSuperGt = [];
          var carRowspanSuperGt = [];
          for (var sgi = 0; sgi < rowsSuperGt.length; sgi++) {
            if (sgi === 0 || teamValsSuperGt[sgi] !== teamValsSuperGt[sgi - 1]) {
              var ts = 1;
              while (sgi + ts < rowsSuperGt.length && teamValsSuperGt[sgi + ts] === teamValsSuperGt[sgi]) ts++;
              teamRowspanSuperGt.push(ts);
            } else {
              teamRowspanSuperGt.push(0);
            }
            if (sgi === 0 || teamValsSuperGt[sgi] !== teamValsSuperGt[sgi - 1] || carValsSuperGt[sgi] !== carValsSuperGt[sgi - 1]) {
              var cs = 1;
              while (
                sgi + cs < rowsSuperGt.length &&
                teamValsSuperGt[sgi + cs] === teamValsSuperGt[sgi] &&
                carValsSuperGt[sgi + cs] === carValsSuperGt[sgi]
              ) cs++;
              carRowspanSuperGt.push(cs);
            } else {
              carRowspanSuperGt.push(0);
            }
          }
          var bodySuperGt = rowsSuperGt.map(function (row, idx) {
            var teamName = (row && row.team != null) ? String(row.team).trim() : '';
            var teamCell = teamName
              ? '<a href="/team/' + encodeURIComponent(slugify(teamName)) + '" class="track-link">' + esc(teamName) + '</a>'
              : '—';
            var makeVal = (row && row.make != null) ? String(row.make).trim() : '';
            var carVal = (row && row.car != null) ? String(row.car).trim() : '';
            var tireVal = (row && row.tire != null) ? String(row.tire).trim() : '';
            var teamSpan = teamRowspanSuperGt[idx] || 0;
            var carSpan = carRowspanSuperGt[idx] || 0;
            var teamTd = teamSpan > 0
              ? '<td rowspan="' + teamSpan + '" class="entry-list-team-cell">' + teamCell + '</td>'
              : '';
            var carTd = carSpan > 0
              ? '<td rowspan="' + carSpan + '" class="entry-list-car-cell">' + esc(dash(carVal)) + '</td>'
              : '';
            return '<tr>' +
              '<td>' + esc(dash(row && row.number)) + '</td>' +
              teamTd +
              '<td>' + esc(dash(makeVal)) + '</td>' +
              carTd +
              '<td>' + renderSuperGtDrivers(row) + '</td>' +
              '<td>' + esc(dash(tireVal)) + '</td>' +
              '</tr>';
          }).join('');
          htmlSuperGt += '<h4 class="table-section-title">' + esc(clsSuperGt) + '</h4>' +
            '<div class="table-wrap"><table class="data-table entry-list-table">' +
            '<thead><tr><th>' + t('th.no') + '</th><th>' + t('th.team') + '</th><th>Make</th><th>Car</th><th>' + t('th.driver') + '</th><th>Tire</th></tr></thead>' +
            '<tbody>' + bodySuperGt + '</tbody></table></div>';
        }
        contentEl.innerHTML = htmlSuperGt || ('<p class="empty-msg">' + t('error.no_entry_list') + '</p>');
        return;
      }
      var isPscEntry = seriesLowerEntry === 'psc'
        || (String(d.series || '').toLowerCase().indexOf('porsche') >= 0 && String(d.series || '').toLowerCase().indexOf('supercup') >= 0)
        || /^psc[-_]/.test((d.event_id || eventIdFromRoute || '').toLowerCase());
      var isFrecEntry = seriesLowerEntry === 'frec'
        || isF4SeriesId(seriesLowerEntry)
        || (String(d.series || '').toLowerCase().indexOf('formula regional european') >= 0)
        || /^frec_/.test((d.event_id || '').toLowerCase())
        || isPscEntry;
      if (isFrecEntry) {
        entryCopy.sort(function (a, b) {
          var ta = String((a && a.team) || '').toLowerCase();
          var tb = String((b && b.team) || '').toLowerCase();
          if (ta < tb) return -1;
          if (ta > tb) return 1;
          var na = String((a && a.number) || '');
          var nb = String((b && b.number) || '');
          return na.localeCompare(nb, undefined, { numeric: true });
        });
        function buildFrecEntryBody(arr) {
          var guestCars = guestCarNumberSet(arr);
          var spans = [];
          for (var fi = 0; fi < arr.length; fi++) {
            var teamVal = String((arr[fi] && arr[fi].team) || '');
            var fs = 1;
            while (fi + fs < arr.length && String((arr[fi + fs] && arr[fi + fs].team) || '') === teamVal) fs++;
            spans.push(fs);
          }
          return arr.map(function (row, idx) {
            var teamDisplay = String((row && row.team) || '');
            var isFirstTeam = (idx === 0 || String((arr[idx - 1] && arr[idx - 1].team) || '') !== teamDisplay);
            var teamCell = (isFirstTeam && spans[idx] > 0)
              ? '<td rowspan="' + spans[idx] + '" class="entry-list-team-cell">' + (teamDisplay ? '<a href="/team/' + encodeURIComponent(slugify(teamDisplay)) + '" class="track-link">' + esc(teamDisplay) + '</a>' : '—') + '</td>'
              : '';
            var driverCell = entryListDriverCell(row, guestCars);
            return '<tr>' + teamCell + '<td>' + esc(dash(row && row.number)) + '</td><td>' + driverCell + '</td></tr>';
          }).join('');
        }
        var headFrec = '<th>' + t('th.team') + '</th><th>' + t('th.no') + '</th><th>' + t('th.driver') + '</th>';
        contentEl.innerHTML = '<div class="table-wrap"><table class="data-table entry-list-table"><thead><tr>' + headFrec + '</tr></thead><tbody>' + buildFrecEntryBody(entryCopy) + '</tbody></table></div>';
        addObjectTableSort(contentEl.querySelector('.data-table'), entryCopy, null, ['team', 'number', 'driver'], function (dataCopy) {
          return buildFrecEntryBody(dataCopy);
        });
        return;
      }
      var isF2OrF3Entry = /^f2_/.test(eventIdLower) || /^f3_/.test(eventIdLower) || (String(d.series || '').toLowerCase().indexOf('formula 2') >= 0) || (String(d.series || '').toLowerCase().indexOf('formula 3') >= 0);
      var hasOnlyNumberTeamDriver = !entryCopy.some(function (e) { return (e.manufacturer != null && String(e.manufacturer).trim() !== '') || (e.constructor != null && String(e.constructor).trim() !== ''); });
      if (isF2OrF3Entry) {
        entryCopy.sort(function (a, b) { var na = parseFloat(a.number); var nb = parseFloat(b.number); if (!isNaN(na) && !isNaN(nb)) return na - nb; return String(a.number || '').localeCompare(String(b.number || '')); });
        function safeTeamStr(r) {
          var v = r && r.team;
          if (v == null) return '';
          if (typeof v === 'string') return v;
          if (typeof v === 'function') return '';
          return String(v);
        }
        function buildF2F3EntryBody(arr) {
          var spans = [];
          for (var ei = 0; ei < arr.length; ei++) {
            var teamVal = safeTeamStr(arr[ei]);
            var ts = 1;
            while (ei + ts < arr.length && safeTeamStr(arr[ei + ts]) === teamVal) ts++;
            spans.push(ts);
          }
          return arr.map(function (row, idx) {
            var driverDisplay = driverDisplayName(row.driver);
            var driverCell = driverDisplay ? '<a href="/driver/' + encodeURIComponent(slugify(driverDisplay)) + '" class="track-link">' + esc(driverDisplay) + '</a>' : '—';
            var teamDisplay = safeTeamStr(row);
            var isFirstInTeam = (idx === 0 || safeTeamStr(arr[idx - 1]) !== teamDisplay);
            var teamCell = (isFirstInTeam && spans[idx] > 0)
              ? '<td rowspan="' + spans[idx] + '" class="entry-list-team-cell">' + (teamDisplay ? '<a href="/team/' + encodeURIComponent(slugify(teamDisplay)) + '" class="track-link">' + esc(teamDisplay) + '</a>' : '—') + '</td>'
              : '';
            return '<tr><td>' + esc(dash(row.number)) + '</td>' + teamCell + '<td>' + driverCell + '</td></tr>';
          }).join('');
        }
        var headF2F3 = '<th>' + t('th.no') + '</th><th>' + t('th.team') + '</th><th>' + t('th.driver') + '</th>';
        contentEl.innerHTML = '<div class="table-wrap"><table class="data-table entry-list-table"><thead><tr>' + headF2F3 + '</tr></thead><tbody>' + buildF2F3EntryBody(entryCopy) + '</tbody></table></div>';
        addObjectTableSort(contentEl.querySelector('.data-table'), entryCopy, null, ['number', 'team', 'driver'], function (dataCopy) {
          return buildF2F3EntryBody(dataCopy);
        });
        return;
      }
      var seriesLower = (seriesId || '').toLowerCase();
      var isIndyCar = seriesLower === 'indycar'
        || (String(d.series || '').toLowerCase().indexOf('indycar') >= 0)
        || /^indycar_/.test((d.event_id || '').toLowerCase());
      var isSuperFormulaEntry = seriesLower === 'super_formula'
        || (String(d.series || '').toLowerCase().indexOf('super formula') >= 0)
        || /^super_formula_/.test((d.event_id || '').toLowerCase());
      var isSupercarsEntry = seriesLower === 'supercars';
      var isDtmEntry = seriesLower === 'dtm';
      var isF1Entry = seriesLower === 'f1' || (String(d.series || '').toLowerCase().indexOf('formula 1') >= 0);
      // F1 2025, Australian GP: "constructor → chassis" mapping for entry list.
      var F1_2025_ENTRY_CHASSIS = {
        'Alpine-Renault': 'A525',
        'Aston Martin Aramco-Mercedes': 'AMR25',
        'Ferrari': 'SF-25',
        'Haas-Ferrari': 'VF-25',
        'Kick Sauber-Ferrari': 'C45',
        'McLaren-Mercedes': 'MCL39',
        'Mercedes': 'F1 W16',
        'Racing Bulls-Honda RBPT': 'VCARB02',
        'Red Bull Racing-Honda RBPT': 'RB21',
        'Williams-Mercedes': 'FW47'
      };
      // IndyCar: No., Driver, Team, Engine. DTM/Supercars: No., Driver, Team, Car/Manufacturer. Stock car: No., Driver, Team, Manufacturer, Crew chief. Others (F1, etc.): No., Driver, Manufacturer, Chassis.
      var head = (isIndyCar || isSuperFormulaEntry)
        ? '<th>' + t('th.no') + '</th><th>' + t('th.driver') + '</th><th>' + t('th.team') + '</th><th>' + t('th.engine') + '</th>' + (isStockCar ? '<th>' + t('th.crew_chief') + '</th>' : '')
        : isDtmEntry
          ? '<th>' + t('th.no') + '</th><th>' + t('th.driver') + '</th><th>' + t('th.team') + '</th><th>Car</th>'
        : isSupercarsEntry
          ? '<th>' + t('th.no') + '</th><th>' + t('th.driver') + '</th><th>' + t('th.team') + '</th><th>' + t('th.manufacturer') + '</th>' + (isStockCar ? '<th>' + t('th.crew_chief') + '</th>' : '')
          : isStockCar
            ? '<th>' + t('th.no') + '</th><th>' + t('th.driver') + '</th><th>' + t('th.team') + '</th><th>' + t('th.manufacturer') + '</th><th>' + t('th.crew_chief') + '</th>'
            : '<th>' + t('th.no') + '</th><th>' + t('th.driver') + '</th><th>' + t('th.manufacturer') + '</th><th>' + t('th.chassis') + '</th>';
      function safeTeamStr(v) {
        if (v == null) return '';
        if (typeof v === 'string') return v.trim();
        if (typeof v === 'object' && v !== null && typeof v.name === 'string') return v.name.trim();
        return '';
      }
      function getTeamDisplay(r) {
        var t = safeTeamStr(r.team);
        if (byNumber && r.number != null && typeof byNumber === 'object' && byNumber !== null) {
          var num = String(r.number).trim();
          var v = byNumber[num] || (num ? byNumber[String(parseInt(num, 10))] : undefined);
          if (typeof v === 'string' && v.trim()) t = v.trim();
        }
        return t;
      }
      function getManufacturerDisplay(r) {
        var c = r.constructor;
        if (typeof c === 'string' && c.trim() !== '') return c.trim();
        var m = r.manufacturer;
        if (m != null && typeof m === 'string') return m.trim();
        if (m != null) return String(m);
        return '';
      }
      function getChassisDisplay(r) {
        var manu = (r.manufacturer != null ? String(r.manufacturer).trim() : '');
        // F1 2025: for all season events substitute chassis code instead of repeating constructor.
        if (isF1Entry && evKeyEntry && evKeyEntry.indexOf('F1_2025_') === 0 && manu) {
          var code = F1_2025_ENTRY_CHASSIS[manu];
          if (code) return code;
        }
        return manu || (r.car != null ? String(r.car) : '');
      }
      function getEngineDisplay(r) {
        return (r.manufacturer != null ? String(r.manufacturer) : '') || (r.engine != null ? String(r.engine) : '');
      }
      function renderEntryDriversCell(row) {
        var names = [];
        function addName(v) {
          var raw = (v == null) ? '' : String(v).trim();
          if (!raw || raw === '-') return;
          if (/^tbc$/i.test(raw)) return;
          names.push(raw);
        }
        addName(row && row.driver);
        ['driver1', 'driver2', 'driver3', 'driver4'].forEach(function (k) {
          addName(row && row[k]);
        });
        if (row && Array.isArray(row.drivers)) {
          row.drivers.forEach(function (v) { addName(v); });
        }
        // De-duplicate while preserving order.
        var seen = {};
        names = names.filter(function (name) {
          var key = String(name).toLowerCase();
          if (seen[key]) return false;
          seen[key] = true;
          return true;
        });
        if (!names.length) return '—';
        return names.map(function (name) {
          var display = driverDisplayName(name);
          return display ? '<a href="/driver/' + encodeURIComponent(slugify(display)) + '" class="track-link">' + esc(display) + '</a>' : esc(name);
        }).join(' / ');
      }
      function getCarDisplay(r) {
        if (r && r.car != null && String(r.car).trim() !== '') return String(r.car).trim();
        return getManufacturerDisplay(r);
      }
      // F1, IndyCar, Super Formula, DTM: default sort by team, then number
      if (isF1Entry || isIndyCar || isSuperFormulaEntry || isDtmEntry) {
        entryCopy.sort(function (a, b) {
          var ta = getTeamDisplay(a).toLowerCase();
          var tb = getTeamDisplay(b).toLowerCase();
          if (ta < tb) return -1;
          if (ta > tb) return 1;
          var na = (a.number != null ? String(a.number) : '');
          var nb = (b.number != null ? String(b.number) : '');
          return na.localeCompare(nb, undefined, { numeric: true });
        });
      }

      var entryRowFn = function (row) {
        var driverCell = renderEntryDriversCell(row);
        var teamDisplay = getTeamDisplay(row);
        var teamCell = teamDisplay ? '<a href="/team/' + encodeURIComponent(slugify(teamDisplay)) + '" class="track-link">' + esc(teamDisplay) + '</a>' : '—';
        if (isIndyCar || isSuperFormulaEntry) {
          var engineDisplay = getEngineDisplay(row);
          var cells = '<td>' + esc(dash(row.number)) + '</td><td>' + driverCell + '</td><td>' + teamCell + '</td><td>' + esc(dash(engineDisplay)) + '</td>';
        } else if (isDtmEntry) {
          var carDisplay = getCarDisplay(row);
          var cells = '<td>' + esc(dash(row.number)) + '</td><td>' + driverCell + '</td><td>' + teamCell + '</td><td>' + esc(dash(carDisplay)) + '</td>';
        } else if (isSupercarsEntry) {
          var manufacturerDisplay = getManufacturerDisplay(row);
          var cells = '<td>' + esc(dash(row.number)) + '</td><td>' + driverCell + '</td><td>' + teamCell + '</td><td>' + esc(dash(manufacturerDisplay)) + '</td>';
        } else if (isStockCar) {
          var manufacturerDisplay = getManufacturerDisplay(row);
          var cells = '<td>' + esc(dash(row.number)) + '</td><td>' + driverCell + '</td><td>' + teamCell + '</td><td>' + esc(dash(manufacturerDisplay)) + '</td><td>' + (row.crew_chief ? '<a href="/crew-chief/' + encodeURIComponent(slugify(row.crew_chief)) + '" class="track-link">' + esc(row.crew_chief) + '</a>' : '—') + '</td>';
        } else {
          var manufacturerDisplay = getManufacturerDisplay(row);
          var chassisDisplay = getChassisDisplay(row);
          var cells = '<td>' + esc(dash(row.number)) + '</td><td>' + driverCell + '</td><td>' + esc(dash(manufacturerDisplay)) + '</td><td>' + esc(dash(chassisDisplay)) + '</td>';
        }
        return '<tr>' + cells + '</tr>';
      };
      var manufacturerSpans = [];
      var chassisSpans = [];
      var teamSpans = [];
      var engineSpans = [];
      var carSpans = [];
      if (!isStockCar) {
        for (var ei = 0; ei < entryCopy.length; ei++) {
          var r = entryCopy[ei];
          if (isIndyCar || isSuperFormulaEntry) {
            var teamDisp = getTeamDisplay(r);
            var engDisp = getEngineDisplay(r);
            var tSpan = 1;
            while (ei + tSpan < entryCopy.length && getTeamDisplay(entryCopy[ei + tSpan]) === teamDisp) tSpan++;
            teamSpans.push(tSpan);
            // Merge by engine only within same team
            var eSpan = 1;
            while (ei + eSpan < entryCopy.length && getTeamDisplay(entryCopy[ei + eSpan]) === teamDisp && getEngineDisplay(entryCopy[ei + eSpan]) === engDisp) eSpan++;
            engineSpans.push(eSpan);
          } else if (isDtmEntry) {
            var teamDisp = getTeamDisplay(r);
            var carDisp = getCarDisplay(r);
            var tSpan = 1;
            while (ei + tSpan < entryCopy.length && getTeamDisplay(entryCopy[ei + tSpan]) === teamDisp) tSpan++;
            teamSpans.push(tSpan);
            // Merge Car only within same team.
            var cSpan = 1;
            while (ei + cSpan < entryCopy.length && getTeamDisplay(entryCopy[ei + cSpan]) === teamDisp && getCarDisplay(entryCopy[ei + cSpan]) === carDisp) cSpan++;
            carSpans.push(cSpan);
          } else if (isSupercarsEntry) {
            var teamDisp = getTeamDisplay(r);
            var manuDisp = getManufacturerDisplay(r);
            var tSpan = 1;
            while (ei + tSpan < entryCopy.length && getTeamDisplay(entryCopy[ei + tSpan]) === teamDisp) tSpan++;
            teamSpans.push(tSpan);
            // merge by manufacturer only within same team
            var manuSpan = 1;
            while (ei + manuSpan < entryCopy.length && getTeamDisplay(entryCopy[ei + manuSpan]) === teamDisp && getManufacturerDisplay(entryCopy[ei + manuSpan]) === manuDisp) manuSpan++;
            manufacturerSpans.push(manuSpan);
          } else {
            var manuDisp = getManufacturerDisplay(r);
            var chDisp = getChassisDisplay(r);
            var manuSpan = 1;
            while (ei + manuSpan < entryCopy.length && getManufacturerDisplay(entryCopy[ei + manuSpan]) === manuDisp) manuSpan++;
            manufacturerSpans.push(manuSpan);
            var chSpan = 1;
            while (ei + chSpan < entryCopy.length && getChassisDisplay(entryCopy[ei + chSpan]) === chDisp) chSpan++;
            chassisSpans.push(chSpan);
          }
        }
      }
      var entryRowDisplayFn = function (row, idx, arr) {
        var driverCell = renderEntryDriversCell(row);
        if (isIndyCar || isSuperFormulaEntry) {
          var teamDisplay = getTeamDisplay(row);
          var engineDisplay = getEngineDisplay(row);
          var tSpan = teamSpans[idx] || 1;
          var eSpan = engineSpans[idx] || 1;
          var isFirstTeam = (idx === 0 || getTeamDisplay(arr[idx - 1]) !== teamDisplay);
          var isFirstEngine = (idx === 0 || getTeamDisplay(arr[idx - 1]) !== teamDisplay || getEngineDisplay(arr[idx - 1]) !== engineDisplay);
          var teamCell = isFirstTeam && tSpan > 0
            ? '<td rowspan="' + tSpan + '" class="entry-list-team-cell">' + (teamDisplay ? '<a href="/team/' + encodeURIComponent(slugify(teamDisplay)) + '" class="track-link">' + esc(teamDisplay) + '</a>' : '—') + '</td>'
            : '';
          var engineCell = isFirstEngine && eSpan > 0
            ? '<td rowspan="' + eSpan + '">' + esc(dash(engineDisplay)) + '</td>'
            : '';
          return '<tr><td>' + esc(dash(row.number)) + '</td><td>' + driverCell + '</td>' + teamCell + engineCell + '</tr>';
        }
        if (isDtmEntry) {
          var teamDisplay = getTeamDisplay(row);
          var carDisplay = getCarDisplay(row);
          var tSpan = teamSpans[idx] || 1;
          var cSpan = carSpans[idx] || 1;
          var isFirstTeam = (idx === 0 || getTeamDisplay(arr[idx - 1]) !== teamDisplay);
          var isFirstCar = (idx === 0 || getTeamDisplay(arr[idx - 1]) !== teamDisplay || getCarDisplay(arr[idx - 1]) !== carDisplay);
          var teamCell = isFirstTeam && tSpan > 0
            ? '<td rowspan="' + tSpan + '" class="entry-list-team-cell">' + (teamDisplay ? '<a href="/team/' + encodeURIComponent(slugify(teamDisplay)) + '" class="track-link">' + esc(teamDisplay) + '</a>' : '—') + '</td>'
            : '';
          var carCell = isFirstCar && cSpan > 0
            ? '<td rowspan="' + cSpan + '" class="entry-list-team-cell">' + esc(dash(carDisplay)) + '</td>'
            : '';
          return '<tr><td>' + esc(dash(row.number)) + '</td><td>' + driverCell + '</td>' + teamCell + carCell + '</tr>';
        }
        if (isSupercarsEntry) {
          var teamDisplay = getTeamDisplay(row);
          var manufacturerDisplay = getManufacturerDisplay(row);
          var tSpan = teamSpans[idx] || 1;
          var manuSpan = manufacturerSpans[idx] || 1;
          var isFirstTeam = (idx === 0 || getTeamDisplay(arr[idx - 1]) !== teamDisplay);
          var isFirstManu = (idx === 0 || getTeamDisplay(arr[idx - 1]) !== teamDisplay || getManufacturerDisplay(arr[idx - 1]) !== manufacturerDisplay);
          var teamCell = isFirstTeam && tSpan > 0
            ? '<td rowspan="' + tSpan + '" class="entry-list-team-cell">' + (teamDisplay ? '<a href="/team/' + encodeURIComponent(slugify(teamDisplay)) + '" class="track-link">' + esc(teamDisplay) + '</a>' : '—') + '</td>'
            : '';
          var manufacturerCell = isFirstManu && manuSpan > 0
            ? '<td rowspan="' + manuSpan + '" class="entry-list-team-cell">' + esc(dash(manufacturerDisplay)) + '</td>'
            : '';
          return '<tr><td>' + esc(dash(row.number)) + '</td><td>' + driverCell + '</td>' + teamCell + manufacturerCell + '</tr>';
        }
        var manufacturerDisplay = getManufacturerDisplay(row);
        var chassisDisplay = getChassisDisplay(row);
        var manuSpan = manufacturerSpans[idx] || 1;
        var chSpan = chassisSpans[idx] || 1;
        var isFirstManu = (idx === 0 || getManufacturerDisplay(arr[idx - 1]) !== manufacturerDisplay);
        var isFirstChassis = (idx === 0 || getChassisDisplay(arr[idx - 1]) !== chassisDisplay);
        var manufacturerCell = isFirstManu && manuSpan > 0
          ? '<td rowspan="' + manuSpan + '" class="entry-list-team-cell">' + esc(dash(manufacturerDisplay)) + '</td>'
          : '';
        var chassisCell = isFirstChassis && chSpan > 0
          ? '<td rowspan="' + chSpan + '">' + esc(dash(chassisDisplay)) + '</td>'
          : '';
        return '<tr><td>' + esc(dash(row.number)) + '</td><td>' + driverCell + '</td>' + manufacturerCell + chassisCell + '</tr>';
      };
      var bodyHtml = isStockCar
        ? entryCopy.map(entryRowFn).join('')
        : entryCopy.map(function (row, idx, arr) { return entryRowDisplayFn(row, idx, arr); }).join('');
      contentEl.innerHTML = '<div class="table-wrap"><table class="data-table entry-list-table"><thead><tr>' + head + '</tr></thead><tbody>' + bodyHtml + '</tbody></table></div>';
      var entryKeys = isStockCar ? ['number', 'driver', 'team', 'manufacturer', 'crew_chief'] : ((isIndyCar || isSuperFormulaEntry || isSupercarsEntry || isDtmEntry) ? ['number', 'driver', 'team', 'car', 'manufacturer'] : ['number', 'driver', 'constructor', 'manufacturer']);
      if (!isSuperFormulaEntry) {
        addObjectTableSort(contentEl.querySelector('.data-table'), entryCopy, entryRowFn, entryKeys);
      }
      return;
    }

    if (section === 'test') {
      var testTbl = d.tables && d.tables.test;
      if (testTbl && Array.isArray(testTbl.sessions) && testTbl.sessions.length > 0) {
        testTbl.sessions.forEach(function (sess) {
          if (!sess || !sess.headers || !Array.isArray(sess.rows) || !sess.rows.length) return;
          var title = (sess.title && String(sess.title).trim())
            ? sess.title
            : (t('block.test') || 'Test');
          appendTable(title, { headers: sess.headers, rows: sess.rows });
        });
        if (!html) {
          contentEl.innerHTML = '<p class="empty-msg">' + t('error.no_section_data') + '</p>';
        } else {
          contentEl.innerHTML = html;
          var tablesTest = contentEl.querySelectorAll('.data-table:not(.table-field-value)');
          [].forEach.call(tablesTest, function (table, idx) {
            var q = sortQueue[idx];
            if (q && q.rows) makeTableSortable(table, q.rows, esc, q.getRowClass);
          });
        }
        return;
      }
      if (testTbl && testTbl.headers && Array.isArray(testTbl.rows)) {
        appendTable((testTbl.title && String(testTbl.title).trim()) ? testTbl.title : (t('block.test') || 'Test'), testTbl);
      }
    }

    if (section === 'practice') {
      var prac = d.tables && d.tables.practice;
      if (prac && Array.isArray(prac.headers) && prac.headers.length === 1 && (prac.headers[0] || '').toLowerCase().trim() === 'note' && Array.isArray(prac.rows) && prac.rows.length === 1 && prac.rows[0] && prac.rows[0].length === 1) {
        contentEl.innerHTML = '<p class="race-note">' + esc(String(prac.rows[0][0] || '').trim()) + '</p>';
        return;
      }
      var isSupercarsPractice = (seriesId || '').toLowerCase() === 'supercars';
      function ensureClassColumn(tableData) {
        if (!tableData || !Array.isArray(tableData.headers) || !Array.isArray(tableData.rows)) return tableData;
        var headers = tableData.headers.slice();
        var classIdx = -1;
        var classPosIdx = -1;
        for (var i = 0; i < headers.length; i++) {
          var h = (headers[i] || '').toUpperCase().trim();
          if (h === 'CLASS') classIdx = i;
          if (h === 'CLASS POS') classPosIdx = i;
        }
        if (classIdx >= 0) return tableData;
        if (classPosIdx < 0) return tableData;
        var outHeaders = headers.slice(0, classPosIdx).concat(['CLASS'], headers.slice(classPosIdx));
        var outRows = tableData.rows.map(function (r) {
          return r.slice(0, classPosIdx).concat([''], r.slice(classPosIdx));
        });
        return { headers: outHeaders, rows: outRows };
      }
      function practiceTableData(t) {
        return dropStartPosColumn(splitTeamCarDropSponsor(t));
      }
      function practiceDataWithClass(t) {
        function dropColumnsByHeader(tableData, names) {
          if (!tableData || !Array.isArray(tableData.headers) || !Array.isArray(tableData.rows)) return tableData;
          var targets = (names || []).map(function (n) { return String(n || '').trim().toLowerCase(); });
          var dropIdx = [];
          for (var i = 0; i < tableData.headers.length; i++) {
            var h = String(tableData.headers[i] || '').trim().toLowerCase();
            if (targets.indexOf(h) >= 0) dropIdx.push(i);
          }
          if (!dropIdx.length) return tableData;
          return {
            headers: tableData.headers.filter(function (_h, idx) { return dropIdx.indexOf(idx) < 0; }),
            rows: tableData.rows.map(function (r) {
              return Array.isArray(r) ? r.filter(function (_c, idx) { return dropIdx.indexOf(idx) < 0; }) : r;
            })
          };
        }
        var data = ensureClassColumn(practiceTableData(t));
        data = ((seriesId || '').toLowerCase() === 'imsa' && d.entry_list && d.entry_list.length)
          ? applyClassFromEntryList(data, d.entry_list)
          : data;
        // ELMS Prologue: Driver column is intentionally hidden.
        if (evKeyEvent === 'ELMS_2026_PROLOGUE' && data && Array.isArray(data.headers) && Array.isArray(data.rows)) {
          var drvIdx = -1;
          for (var di = 0; di < data.headers.length; di++) {
            var dh = String(data.headers[di] || '').trim().toLowerCase();
            if (dh === 'driver' || dh === 'drivers') { drvIdx = di; break; }
          }
          if (drvIdx >= 0) {
            data = {
              headers: data.headers.slice(0, drvIdx).concat(data.headers.slice(drvIdx + 1)),
              rows: data.rows.map(function (r) {
                return Array.isArray(r) ? r.slice(0, drvIdx).concat(r.slice(drvIdx + 1)) : r;
              })
            };
          }
        }
        // ELMS championship rounds (not Prologue): hide Driver and Time of the day on practice page.
        if (/^ELMS_\d{4}_\d+$/.test(evKeyEvent || '')) {
          data = dropColumnsByHeader(data, ['Driver', 'Drivers', 'Time of the day']);
        }
        // GTWCE Endurance: empty Laps column removed — more room for Time. Sprint practice keeps Laps.
        if (evKeyEvent.indexOf('GTWCE_END_') === 0) {
          data = dropColumnsByHeader(data, ['Laps']);
        }
        if (/^IMSA_\d{4}_\d+$/.test(evKeyEvent)) {
          data = dropColumnsByHeader(data, ['Status']);
        }
        return data;
      }
      /** Supercars: No. column — strip leading zeros (04→4), 800→8 (like SupercarsCarToCanonical on server).  */
      function normalizeSupercarsTableNumberColumn(tableData, colIdx) {
        if (!tableData || !Array.isArray(tableData.rows)) return tableData;
        var rows = tableData.rows.map(function (row) {
          if (!Array.isArray(row) || row.length <= colIdx) return row;
          var r = row.slice();
          var v = r[colIdx];
          if (v == null || v === '') return r;
          var s = String(v).trim();
          if (!/^\d+$/.test(s)) return r;
          if (s === '800') {
            r[colIdx] = '8';
            return r;
          }
          var n = parseInt(s, 10);
          if (!isNaN(n)) r[colIdx] = String(n);
          return r;
        });
        return { headers: tableData.headers.slice(), rows: rows };
      }
      function practiceDataForSupercars(t) {
        if (!t || !t.headers || !Array.isArray(t.rows)) return t;
        var data = practiceDataWithClass({ headers: t.headers, rows: applyTeamNameByNumber(t.rows, 1, 3) });
        return normalizeSupercarsTableNumberColumn(data, 1);
      }
      // New format: tables.practice.sessions — multiple practice sessions (Practice 1, Practice 2, ...).
      if (prac && Array.isArray(prac.sessions) && prac.sessions.length > 0) {
        prac.sessions.forEach(function (sess, idx) {
          if (!sess || !sess.headers || !Array.isArray(sess.rows)) return;
          var base = isSupercarsPractice
            ? { headers: sess.headers, rows: applyTeamNameByNumber(sess.rows, 1, 3) }
            : { headers: sess.headers, rows: sess.rows };
          var data = isSupercarsPractice ? practiceDataForSupercars(base) : practiceDataWithClass(base);
          var title;
          if (sess.title && String(sess.title).trim() !== '') {
            title = sess.title;
          } else if (idx === 0) {
            title = t('table.practice');
          } else if (idx === 1) {
            title = t('table.practice2');
          } else if (idx === 2) {
            title = t('table.practice3');
          } else {
            title = (t('table.practice') || 'Practice') + ' ' + String(idx + 1);
          }
          appendTable(title, data);
        });
        if (!html) {
          contentEl.innerHTML = '<p class="empty-msg">' + t('error.no_section_data') + '</p>';
        } else {
          contentEl.innerHTML = html;
          var tablesPractice = contentEl.querySelectorAll('.data-table:not(.table-field-value)');
          [].forEach.call(tablesPractice, function (table, idx) {
            var q = sortQueue[idx];
            if (q && q.rows) makeTableSortable(table, q.rows, esc, q.getRowClass);
          });
        }
        return;
      }
      // Legacy format: separate practice / practice2 / practice3 / final_practice / practice5 tables.
      var prac1Data = prac && prac.headers && Array.isArray(prac.rows)
        ? (isSupercarsPractice ? practiceDataForSupercars(prac) : practiceDataWithClass(prac))
        : practiceDataWithClass(prac);
      appendTable((d.tables.practice && d.tables.practice.title) ? d.tables.practice.title : t('table.practice'), prac1Data);
      var prac2Data = isSupercarsPractice && d.tables && d.tables.practice2 ? practiceDataForSupercars(d.tables.practice2) : practiceDataWithClass(d.tables && d.tables.practice2);
      var prac3Data = isSupercarsPractice && d.tables && d.tables.practice3 ? practiceDataForSupercars(d.tables.practice3) : practiceDataWithClass(d.tables && d.tables.practice3);
      var finalPracData = isSupercarsPractice && d.tables && d.tables.final_practice ? practiceDataForSupercars(d.tables.final_practice) : practiceDataWithClass(d.tables && d.tables.final_practice);
      var prac5Data = isSupercarsPractice && d.tables && d.tables.practice5 ? practiceDataForSupercars(d.tables.practice5) : practiceDataWithClass(d.tables && d.tables.practice5);
      appendTable((d.tables.practice2 && d.tables.practice2.title) ? d.tables.practice2.title : t('table.practice2'), prac2Data);
      appendTable((d.tables.practice3 && d.tables.practice3.title) ? d.tables.practice3.title : t('table.practice3'), prac3Data);
      appendTable((d.tables.final_practice && d.tables.final_practice.title) ? d.tables.final_practice.title : t('table.final_practice'), finalPracData);
      appendTable((d.tables.practice5 && d.tables.practice5.title) ? d.tables.practice5.title : 'Practice 5', prac5Data);
    } else if (section === 'qualifying') {
      appendTable(t('table.duel1'),           d.tables && d.tables.duel1, null, null, false);
      appendTable(t('table.duel2'),           d.tables && d.tables.duel2, null, null, false);
      var q = d.tables && d.tables.qualifying;
      if (evKeyEvent === 'SUPER_GT_2026_1' && q && Array.isArray(q.sessions) && q.sessions.length > 0) {
        var qClassOrder = ['GT500', 'GT300'];
        var qExtraClassSuperGt = 'pre-season-results-table qualifying-results-table';
        qClassOrder.forEach(function (cls) {
          var classSessions = q.sessions.filter(function (sess) {
            return String((sess && sess.class) || '').trim().toUpperCase() === cls;
          });
          if (!classSessions.length) return;
          html += '<h3 class="event-pre-season-title">' + esc(cls) + '</h3>';
          classSessions.forEach(function (sess, idx) {
            if (!sess || !Array.isArray(sess.headers) || !Array.isArray(sess.rows)) return;
            var sessTitle = (sess.title && String(sess.title).trim())
              ? String(sess.title).trim()
              : ('Qualifying ' + String(idx + 1));
            appendTable(sessTitle, { headers: sess.headers, rows: sess.rows }, qExtraClassSuperGt, null, false);
          });
        });
      } else {
      function ensureQualClassColumn(tableData) {
        if (!tableData || !Array.isArray(tableData.headers) || !Array.isArray(tableData.rows)) return tableData;
        var headers = tableData.headers.slice();
        var classIdx = -1;
        var classPosIdx = -1;
        for (var i = 0; i < headers.length; i++) {
          var h = (headers[i] || '').toUpperCase().trim();
          if (h === 'CLASS') classIdx = i;
          if (h === 'CLASS POS') classPosIdx = i;
        }
        if (classIdx >= 0 || classPosIdx < 0) return tableData;
        return {
          headers: headers.slice(0, classPosIdx).concat(['CLASS'], headers.slice(classPosIdx)),
          rows: tableData.rows.map(function (r) { return r.slice(0, classPosIdx).concat([''], r.slice(classPosIdx)); })
        };
      }
      function normalizeImsaQualTable(tableData) {
        if (!/^IMSA_\d{4}_\d+$/.test(evKeyEvent)) return tableData;
        function dropQualColumnsByHeader(tableDataInner, names) {
          if (!tableDataInner || !Array.isArray(tableDataInner.headers) || !Array.isArray(tableDataInner.rows)) return tableDataInner;
          var targets = (names || []).map(function (n) { return String(n || '').trim().toLowerCase(); });
          var dropIdx = [];
          for (var di = 0; di < tableDataInner.headers.length; di++) {
            var hh = String(tableDataInner.headers[di] || '').trim().toLowerCase();
            if (targets.indexOf(hh) >= 0) dropIdx.push(di);
          }
          if (!dropIdx.length) return tableDataInner;
          return {
            headers: tableDataInner.headers.filter(function (_h, idx) { return dropIdx.indexOf(idx) < 0; }),
            rows: tableDataInner.rows.map(function (r) {
              return Array.isArray(r) ? r.filter(function (_c, idx) { return dropIdx.indexOf(idx) < 0; }) : r;
            })
          };
        }
        var data = dropStartPosColumn(splitTeamCarDropSponsor(tableData));
        data = dropQualColumnsByHeader(data, ['Status']);
        data = ensureQualClassColumn(data);
        if (d.entry_list && d.entry_list.length) data = applyClassFromEntryList(data, d.entry_list);
        data = recomputeClassPos(data);
        if (!data || !Array.isArray(data.headers) || !Array.isArray(data.rows)) return data;
        var headers = data.headers.slice();
        var classPosIdx = -1;
        var pointsIdx = -1;
        for (var i = 0; i < headers.length; i++) {
          var h = (headers[i] || '').toUpperCase().trim();
          if (h === 'CLASS POS') classPosIdx = i;
          if (h === 'POINTS') pointsIdx = i;
        }
        if (classPosIdx < 0) return data;
        if (pointsIdx < 0) {
          pointsIdx = headers.length;
          headers.push('POINTS');
        }
        function qualifyingPointsByClassPos(classPos) {
          var n = parseInt(classPos, 10);
          if (isNaN(n) || n < 1) return 0;
          if (n === 1) return 35;
          if (n === 2) return 32;
          if (n === 3) return 30;
          if (n === 4) return 28;
          if (n === 5) return 26;
          if (n === 6) return 25;
          if (n === 7) return 24;
          if (n === 8) return 23;
          if (n === 9) return 22;
          if (n === 10) return 21;
          if (n === 11) return 20;
          if (n === 12) return 19;
          if (n === 13) return 18;
          if (n === 14) return 17;
          if (n === 15) return 16;
          if (n === 16) return 15;
          if (n === 17) return 14;
          if (n === 18) return 13;
          if (n === 19) return 12;
          if (n === 20) return 11;
          if (n === 21) return 10;
          if (n === 22) return 9;
          if (n === 23) return 8;
          if (n === 24) return 7;
          if (n === 25) return 6;
          if (n === 26) return 5;
          if (n === 27) return 4;
          if (n === 28) return 3;
          if (n === 29) return 2;
          return 1;
        }
        var rows = data.rows.map(function (r) {
          var row = r.slice();
          while (row.length <= pointsIdx) row.push('');
          row[pointsIdx] = String(qualifyingPointsByClassPos(row[classPosIdx]));
          return row;
        });
        data = { headers: headers, rows: rows };
        return data;
      }
      function renderOneQualSession(sess) {
        var out = '';
        if (sess.title) out += '<h3 class="event-pre-season-title">' + esc(sess.title) + '</h3>';
        if (sess.subtitle) out += '<p class="event-pre-season-subtitle">' + esc(sess.subtitle) + '</p>';
        if (!/^IMSA_\d{4}_\d+$/.test(evKeyEvent) && (seriesId || '').toLowerCase() !== 'f2' && !/^F1_/.test(evKeyEvent)) {
          out += buildSessionMetaTable(sess.meta);
        }
        if (sess.headers && Array.isArray(sess.rows)) {
          var qualData = normalizeImsaQualTable({ headers: sess.headers, rows: sess.rows });
          qualData = normalizeSuperFormulaEngineColumns(qualData);
          // GTWCE Endurance & Sprint qualifying: drop Laps column for display (data in JSON may still include it).
          if ((evKeyEvent.indexOf('GTWCE_END_') === 0 || evKeyEvent.indexOf('GTWCE_SPRINT_') === 0) && qualData && Array.isArray(qualData.headers)) {
            var lapsQualIdx = -1;
            for (var lqi = 0; lqi < qualData.headers.length; lqi++) {
              if (String(qualData.headers[lqi] || '').trim().toLowerCase() === 'laps') {
                lapsQualIdx = lqi;
                break;
              }
            }
            if (lapsQualIdx >= 0) {
              qualData = {
                headers: qualData.headers.filter(function (_h, i) { return i !== lapsQualIdx; }),
                rows: qualData.rows.map(function (r) {
                  return Array.isArray(r) ? r.filter(function (_c, i) { return i !== lapsQualIdx; }) : r;
                })
              };
            }
          }
          var qualHeaders = qualData.headers.slice();
          var qualRows = qualData.rows.map(function (r) { return r.slice(); });
          qualRows = applyTeamNameByNumber(qualRows, 1, 3);
          // CLASS POS and POINTS already normalized in normalizeImsaQualTable().
          // For IndyCar and F1 do not insert extra "Results" heading before table,
          // to avoid duplicating session context (Sprint Qualifying / Qualifying, etc.).
          if (!/^INDYCAR_/.test(evKeyEvent) && !/^F1_/.test(evKeyEvent)) {
            out += '<h4 class="table-section-title">Results</h4>';
          }

          // Split rows into segments by separator
          var segments = [];
          var segRows = [];
          var segTitle = null;
          qualRows.forEach(function (row) {
            var isSep = row.length > 0 && String(row[0] || '').trim() !== '' &&
              row.slice(1).every(function (c) { return c == null || String(c).trim() === ''; });
            if (isSep) {
              segments.push({ title: segTitle, rows: segRows });
              segRows = [];
              segTitle = String(row[0]).trim();
            } else {
              segRows.push(row);
            }
          });
          segments.push({ title: segTitle, rows: segRows });

          if (segments.length === 2) {
            // Merged table: rows 1–10 by Shoot Out position, rows 11–24 by qualifying position
            var seg0 = segments[0];
            var seg1 = segments[1];
            var h = qualHeaders;

            var seg0ByNum = {};
            seg0.rows.forEach(function (r) {
              var num = String(r[1] || '').trim();
              if (num) seg0ByNum[num] = r;
            });
            var seg1ByNum = {};
            seg1.rows.forEach(function (r) {
              var num = String(r[1] || '').trim();
              if (num) seg1ByNum[num] = r;
            });
            var top10Nums = {};
            seg1.rows.forEach(function (r) {
              var num = String(r[1] || '').trim();
              if (num) top10Nums[num] = true;
            });

            var commonIdx = [0, 1, 2, 3];
            var dataIdx   = [4, 5, 6, 7];
            var soDataIdx = [4, 5]; // Shoot Out: only Fastest Lap, Gap (no Lap, Laps)

            var seg0Label = seg0.title || 'Qualifying';
            var seg1Label = seg1.title || 'Shoot Out';

            out += '<div class="table-wrap"><table class="data-table pre-season-results-table qualifying-results-table qual-merged-table">';
            out += '<thead>';
            out += '<tr class="qual-group-header-row">';
            out += '<th colspan="' + commonIdx.length + '"></th>';
            out += '<th colspan="' + dataIdx.length + '" class="col-group-header">' + esc(seg0Label) + '</th>';
            out += '<th colspan="' + (soDataIdx.length + 1) + '" class="col-group-header">' + esc(seg1Label) + '</th>';
            out += '</tr>';
            out += '<tr>';
            commonIdx.forEach(function (i) { out += '<th>' + esc(h[i] || '') + '</th>'; });
            dataIdx.forEach(function (i) { out += '<th>' + esc(h[i] || '') + '</th>'; });
            out += '<th>' + esc(h[0] || 'Pos') + '</th>';
            soDataIdx.forEach(function (i) { out += '<th>' + esc(h[i] || '') + '</th>'; });
            out += '</tr>';
            out += '</thead><tbody>';

            var mergedRows = [];
            var displayOrder = [];
            // Rows 1–10: by Shoot Out position (seg1.rows already ordered 1..10)
            seg1.rows.forEach(function (soRow, i) {
              var num = String(soRow[1] || '').trim();
              var qualRow = seg0ByNum[num] || null;
              if (!qualRow) return;
              var pos = i + 1;
              var rowCells = [pos, qualRow[1], qualRow[2], qualRow[3]];
              dataIdx.forEach(function (j) { rowCells.push(qualRow[j] != null ? qualRow[j] : ''); });
              rowCells.push(soRow[0]);
              soDataIdx.forEach(function (j) { rowCells.push(soRow[j] != null ? soRow[j] : '—'); });
              mergedRows.push(rowCells);
              displayOrder.push({ row: qualRow, so: soRow, cells: rowCells });
            });
            // Rows 11–24: by qualifying position (seg0 rows not in top 10)
            var restQual = seg0.rows.filter(function (row) {
              var num = String(row[1] || '').trim();
              return !top10Nums[num];
            });
            restQual.sort(function (a, b) {
              var pa = parseInt(a[0], 10) || 0;
              var pb = parseInt(b[0], 10) || 0;
              return pa - pb;
            });
            restQual.forEach(function (qualRow) {
              var rowCells = [];
              commonIdx.forEach(function (i) { rowCells.push(qualRow[i] != null ? qualRow[i] : ''); });
              dataIdx.forEach(function (i) { rowCells.push(qualRow[i] != null ? qualRow[i] : ''); });
              rowCells.push('—');
              soDataIdx.forEach(function () { rowCells.push('—'); });
              mergedRows.push(rowCells);
              displayOrder.push({ row: qualRow, so: null, cells: rowCells });
            });

            function driversToLinks(s) {
              if (s == null || String(s).trim() === '') return '—';
              if (window.TGA && window.TGA.driversCellHtml) return window.TGA.driversCellHtml(s);
              return String(s).split(/\s*;\s*/).map(function (p) {
                var t = p.trim();
                if (!t) return '';
                var d = driverDisplayName(t);
                return '<a href="/driver/' + encodeURIComponent(slugify(d)) + '" class="track-link">' + esc(d) + '</a>';
              }).filter(Boolean).join('; ');
            }
            function teamToLink(s) {
              if (s == null || String(s).trim() === '') return '—';
              var t = String(s).trim();
              return '<a href="/team/' + encodeURIComponent(slugify(t)) + '" class="track-link">' + esc(t) + '</a>';
            }
            displayOrder.forEach(function (item) {
              var row = item.row;
              var so = item.so;
              var rowCells = item.cells;
              out += '<tr' + (so ? ' class="qual-row-in-shootout"' : '') + '>';
              out += '<td>' + esc(String(rowCells[0] != null ? rowCells[0] : '')) + '</td>';
              out += '<td>' + esc(String(rowCells[1] != null ? rowCells[1] : '')) + '</td>';
              out += '<td>' + driversToLinks(rowCells[2]) + '</td>';
              out += '<td>' + teamToLink(rowCells[3]) + '</td>';
              dataIdx.forEach(function (_, j) { out += '<td>' + esc(String(rowCells[4 + j] != null ? rowCells[4 + j] : '')) + '</td>'; });
              out += '<td class="' + (so ? 'qual-so-pos' : 'qual-so-empty') + '">' + esc(String(rowCells[8] != null ? rowCells[8] : '—')) + '</td>';
              for (var k = 0; k < soDataIdx.length; k++) {
                var val = rowCells[9 + k];
                out += '<td class="' + (so ? '' : 'qual-so-empty') + '">' + esc(val != null ? String(val) : '—') + '</td>';
              }
              out += '</tr>';
            });

            out += '</tbody></table></div>';
            sortQueue.push({
              rows: mergedRows,
              getRowClass: function (row) {
                var soPos = row[8];
                return (soPos != null && String(soPos).trim() !== '' && String(soPos).trim() !== '—') ? 'qual-row-in-shootout' : '';
              }
          });
        } else {
            var qualTbl = transformTableDataForF2F3({ headers: qualHeaders, rows: qualRows });
            var imsaQualFitClass = /^IMSA_\d{4}_\d+$/.test(evKeyEvent) ? ' imsa-qual-fit' : '';
            var qualResult = buildTableSection(null, qualTbl, 'pre-season-results-table qualifying-results-table' + imsaQualFitClass);
            if (qualResult) {
              var qualHtml = qualResult.html;
              if (/^IMSA_\d{4}_\d+$/.test(evKeyEvent)) {
                qualHtml = qualHtml.replace('<div class="table-wrap">', '<div class="table-wrap table-wrap--no-scroll">');
              }
              out += qualHtml;
              sortQueue.push({ rows: qualResult.rows, getRowClass: qualResult.getRowClass });
            }
          }
        }
        return out;
      }
      if (q && Array.isArray(q.sessions) && q.sessions.length > 0) {
        html += '<div class="event-pre-season-block">';
        q.sessions.forEach(function (sess, idx) {
          if (idx > 0) html += '<hr class="event-pre-season-divider">';
          html += renderOneQualSession(sess);
        });
        html += '</div>';
        if (q.note && typeof q.note === 'string' && q.note.trim()) {
          html += '<p class="race-note">' + esc(q.note.trim()) + '</p>';
        }
      } else if (q && (q.title || q.meta) && q.headers && Array.isArray(q.rows) && q.format !== 'starting_lineup') {
        if (/^ELMS_\d{4}_\d+$/.test(evKeyEvent || '')) {
          function dropQualColumnsByHeader(tableData, names) {
            if (!tableData || !Array.isArray(tableData.headers) || !Array.isArray(tableData.rows)) return tableData;
            var targets = (names || []).map(function (n) { return String(n || '').trim().toLowerCase(); });
            var dropIdx = [];
            for (var i = 0; i < tableData.headers.length; i++) {
              var h = String(tableData.headers[i] || '').trim().toLowerCase();
              if (targets.indexOf(h) >= 0) dropIdx.push(i);
            }
            if (!dropIdx.length) return tableData;
            return {
              headers: tableData.headers.filter(function (_h, idx) { return dropIdx.indexOf(idx) < 0; }),
              rows: tableData.rows.map(function (r) {
                return Array.isArray(r) ? r.filter(function (_c, idx) { return dropIdx.indexOf(idx) < 0; }) : r;
              })
            };
          }
          var qElms = normalizeImsaQualTable(q);
          qElms = dropQualColumnsByHeader(qElms, ['Driver', 'Drivers', 'Time of the day']);
          var clsIdxElms = -1;
          for (var qei = 0; qei < qElms.headers.length; qei++) {
            if (String(qElms.headers[qei] || '').trim().toLowerCase() === 'class') { clsIdxElms = qei; break; }
          }
          var elmsOrder = ['LMGT3', 'LMP3', 'LMP2 Pro/Am', 'LMP2'];
          var qExtraElms = 'pre-season-results-table qualifying-results-table';
          if (clsIdxElms >= 0) {
            elmsOrder.forEach(function (cls) {
              var rowsCls = (qElms.rows || []).filter(function (row) { return String(row && row[clsIdxElms] || '').trim() === cls; });
              if (!rowsCls.length) return;
              var classStart = '';
              if (q && q.meta && typeof q.meta === 'object') {
                classStart = q.meta['Start (' + cls + ')'] || '';
                if (!classStart && cls === 'LMP2 Pro/Am') classStart = q.meta['Start (LMP2 Pro-Am)'] || '';
              }
              var metaForClass = classStart ? { 'Start': classStart } : null;
              var tbl = { headers: qElms.headers, rows: rowsCls, meta: metaForClass };
              appendTable(cls, tbl, qExtraElms, null, false);
            });
          } else {
            appendTable((q && q.title && String(q.title).trim()) ? String(q.title).trim() : t('table.qualifying'), { headers: qElms.headers, rows: qElms.rows, meta: q.meta }, qExtraElms, null, false);
          }
        } else {
          html += '<div class="event-pre-season-block">';
          html += renderOneQualSession(q);
          html += '</div>';
        }
      } else if (q && Array.isArray(q.headers) && q.headers.length === 1 && (q.headers[0] || '').toLowerCase().trim() === 'note' && Array.isArray(q.rows) && q.rows.length === 1 && q.rows[0] && q.rows[0].length === 1) {
        html += '<p class="race-note">' + esc(String(q.rows[0][0] || '').trim()) + '</p>';
      } else if (q) {
        // For some series (e.g. NOAPS_2026_3) qualifying table contains
        // separator rows ["Qualified by owner's points", "", ...] and ["Failed to qualify", "", ...].
        // Split into multiple tables: main qualifying, then blocks with those headings.
        var qBase = normalizeImsaQualTable(q);
        function dropColumnsByHeader(tableData, names) {
          if (!tableData || !Array.isArray(tableData.headers) || !Array.isArray(tableData.rows)) return tableData;
          var targets = (names || []).map(function (n) { return String(n || '').trim().toLowerCase(); });
          var dropIdx = [];
          for (var i = 0; i < tableData.headers.length; i++) {
            var h = String(tableData.headers[i] || '').trim().toLowerCase();
            if (targets.indexOf(h) >= 0) dropIdx.push(i);
          }
          if (!dropIdx.length) return tableData;
          return {
            headers: tableData.headers.filter(function (_h, idx) { return dropIdx.indexOf(idx) < 0; }),
            rows: tableData.rows.map(function (r) {
              return Array.isArray(r) ? r.filter(function (_c, idx) { return dropIdx.indexOf(idx) < 0; }) : r;
            })
          };
        }
        if (/^ELMS_\d{4}_\d+$/.test(evKeyEvent || '')) {
          qBase = dropColumnsByHeader(qBase, ['Driver', 'Drivers', 'Time of the day']);
          var elmsClassOrder = ['LMGT3', 'LMP3', 'LMP2 Pro/Am', 'LMP2'];
          var qExtraClassElms = 'pre-season-results-table qualifying-results-table';
          var clsIdx = -1;
          for (var qi = 0; qi < qBase.headers.length; qi++) {
            if (String(qBase.headers[qi] || '').trim().toLowerCase() === 'class') { clsIdx = qi; break; }
          }
          if (clsIdx >= 0) {
            elmsClassOrder.forEach(function (cls) {
              var rowsForClass = (qBase.rows || []).filter(function (row) { return String(row && row[clsIdx] || '').trim() === cls; });
              if (!rowsForClass.length) return;
              appendTable(cls, { headers: qBase.headers, rows: rowsForClass }, qExtraClassElms, null, false);
            });
          } else {
            appendTable(t('table.qualifying'), qBase, qExtraClassElms, null, false);
          }
        } else {
          var rowsQ = Array.isArray(qBase.rows) ? qBase.rows.slice() : [];
          var segmentsQ = [];
          var labelsQ = [];
          var currentSeg = [];
          function isQualSeparatorRow(row) {
            if (!row || row.length === 0) return false;
            var first = String(row[0] || '').trim();
            if (!first) return false;
            var nonEmptyRest = false;
            for (var i = 1; i < row.length; i++) {
              if (row[i] != null && String(row[i]).trim() !== '') { nonEmptyRest = true; break; }
            }
            if (nonEmptyRest) return false;
            var l = first.toLowerCase();
            return l === "qualified by owner's points" || l === 'failed to qualify';
          }
          rowsQ.forEach(function (row) {
            if (isQualSeparatorRow(row)) {
              if (currentSeg.length) {
                segmentsQ.push(currentSeg);
                currentSeg = [];
              }
              labelsQ.push(String(row[0] || '').trim());
            } else {
              currentSeg.push(row);
            }
          });
          if (currentSeg.length) segmentsQ.push(currentSeg);

          function qualRowsWithTeamNames(rows) {
            if (!rows || !rows.length) return rows;
            if (!(isStockCar && byNumber)) return rows;
            var hdrs = (qBase && Array.isArray(qBase.headers)) ? qBase.headers : [];
            var h3 = hdrs.length > 3 ? String(hdrs[3] || '').trim().toLowerCase() : '';
            // Substitute team names only if 4th column is actually Team.
            if (h3 !== 'team') return rows;
            return applyTeamNameByNumber(rows, 1, 3);
          }
          var qTitle = (q && q.title && String(q.title).trim()) ? String(q.title).trim() : t('table.qualifying');
          var qExtraClass = (q && q.format === 'starting_lineup')
            ? 'pre-season-results-table qualifying-results-table allstar-starting-lineup-table'
            : ('pre-season-results-table qualifying-results-table' + (/^IMSA_\d{4}_\d+$/.test(evKeyEvent) ? ' imsa-qual-fit' : ''));
          if (segmentsQ.length === 0) {
            appendTable(qTitle, { headers: qBase.headers, rows: qualRowsWithTeamNames(qBase.rows) }, qExtraClass, null, false);
          } else {
            // first table — main qualifying
            appendTable(qTitle, { headers: qBase.headers, rows: qualRowsWithTeamNames(segmentsQ[0]) }, qExtraClass, null, false);
            // others — by headings from separator rows
            for (var si = 1; si < segmentsQ.length; si++) {
              var lbl = labelsQ[si - 1] || t('table.qualifying');
              appendTable(lbl, { headers: qBase.headers, rows: qualRowsWithTeamNames(segmentsQ[si]) }, qExtraClass, null, false);
            }
          }
        }
      }
      if (q && q.note && typeof q.note === 'string' && q.note.trim() && !(q.sessions && Array.isArray(q.sessions) && q.sessions.length > 0)) {
        html += '<p class="race-note">' + esc(q.note.trim()) + '</p>';
      }
      appendTable(t('table.last_chance'),     d.tables && d.tables.last_chance, null, null, false);
      var dnqTable = d.tables && d.tables.did_not_qualify;
      if (dnqTable && Array.isArray(dnqTable.rows) && dnqTable.rows.length > 0) {
        appendTable(t('table.did_not_qualify'), dnqTable, null, null, false);
      }
      }
    }

    if (!html) { contentEl.innerHTML = '<p class="empty-msg">' + t('error.no_section_data') + '</p>'; return; }
    contentEl.innerHTML = html;

    // Special notes under qualifying for specific F1 events.
    if (section === 'qualifying') {
      var qualNoteText = null;
      if (evKeyEvent === 'F1_2025_3') {
        qualNoteText = 'Carlos Sainz Jr. received a three-place grid penalty for impeding Lewis Hamilton in Q2.';
      } else if (evKeyEvent === 'F1_2025_4') {
        qualNoteText = 'George Russell and Kimi Antonelli both received a one-place grid penalty for entering the fast lane in the pit lane before a re-start time was confirmed.';
      }
      if (qualNoteText) {
        var qualNote = document.createElement('p');
        qualNote.className = 'race-note';
        qualNote.textContent = qualNoteText;
        contentEl.appendChild(qualNote);
      }
    }
    // Data tables only (exclude Session info field-value) so order matches sortQueue
    var tables = contentEl.querySelectorAll('.data-table:not(.table-field-value)');
    [].forEach.call(tables, function (table, idx) {
      var q = sortQueue[idx];
      if (q && q.rows) makeTableSortable(table, q.rows, esc, q.getRowClass);
    });
  }

  function slugify(str) {
    return String(str).toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/ß/g, 'ss').replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/ł/g, 'l')
      .replace(/[^a-z0-9\u0400-\u04ff]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  var allViewIds = ['view-list', 'view-search', 'view-detail', 'view-event', 'view-track', 'view-driver', 'view-team', 'view-crew-chief', 'view-schedule'];
  function showView(activeId) {
    if (activeId !== 'view-list') stopNextRaceTimers();
    allViewIds.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList[id === activeId ? 'remove' : 'add']('hidden');
    });
    if (activeId !== 'view-event') {
      var bodyEl = document.body;
      if (bodyEl) {
        Array.from(bodyEl.classList).forEach(function (cls) {
          if (/^ev-/.test(cls)) bodyEl.classList.remove(cls);
        });
      }
    }
  }

  var searchIndexItems = [];
  var searchIndexReady = false;
  var searchIndexLoading = false;
  var searchInitDone = false;
  var driverPhotoQualityCache = {};
  var searchPriorityList = (function () {
    if (window.TGA_SEARCH_PRIORITY && Array.isArray(window.TGA_SEARCH_PRIORITY) && window.TGA_SEARCH_PRIORITY.length > 0) {
      return window.TGA_SEARCH_PRIORITY.slice();
    }
    return [
      'F1', 'INDYCAR', 'WEC', 'NASCAR_CUP', 'SUPER_FORMULA', 'IMSA',
      'DTM', 'SUPER_GT', 'F2', 'GTWCE_END', 'GTWCE_SPRINT', 'ELMS',
      'SUPERCARS', 'NOAPS', 'F3', 'NASCAR_TRUCK', 'PSC', 'ARCA',
      'FREC', 'F4_IT', 'NASCAR_MODIFIED', 'SMP_F4_RU'
    ];
  })();
  var seriesPopularity = {};
  searchPriorityList.forEach(function (sid, idx) {
    // Earlier in the list = higher score.
    seriesPopularity[String(sid || '').toUpperCase()] = (searchPriorityList.length - idx) + 100;
  });

  function seriesSearchAliases(seriesID) {
    var sid = String(seriesID || '').toUpperCase();
    var map = window.TGA_SEARCH_ALIASES;
    if (!map || typeof map !== 'object') return '';
    var aliases = map[sid];
    return aliases ? String(aliases).trim() : '';
  }

  function seriesSearchExtra(seriesID, baseExtra) {
    var parts = [String(baseExtra || '').trim(), seriesSearchAliases(seriesID)].filter(Boolean);
    return parts.join(' ');
  }

  var popularTeamHints = [
    'red bull', 'ferrari', 'mercedes', 'mclaren', 'aston martin',
    'williams', 'haas', 'alpine', 'sauber', 'penske', 'ganassi',
    'hendrick', 'joe gibbs', 'rfk', '23xi', 'trackhouse', 'toyota gazoo',
    'porsche', 'bmw', 'cadillac', 'ford', 'chevrolet'
  ];

  function normalizeSearchText(value) {
    if (value == null) return '';
    return String(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function seriesPopularityScore(seriesID) {
    var sid = String(seriesID || '').toUpperCase();
    return seriesPopularity[sid] || 0;
  }

  function teamPopularityBoost(teamName) {
    var team = normalizeSearchText(teamName);
    if (!team) return 0;
    for (var i = 0; i < popularTeamHints.length; i++) {
      if (team.indexOf(popularTeamHints[i]) >= 0) return 8;
    }
    return 0;
  }

  function normalizeDisplayTeamName(teamName) {
    var raw = String(teamName || '').trim();
    if (!raw) return '';
    var map = {
      'Oracle Red Bull Racing': 'Red Bull Racing',
      'Visa Cash App Racing Bulls F1 Team': 'Racing Bulls',
      'Mercedes-AMG Petronas F1 Team': 'Mercedes',
      'Scuderia Ferrari HP': 'Ferrari',
      'McLaren Formula 1 Team': 'McLaren',
      'Aston Martin Aramco F1 Team': 'Aston Martin',
      'BWT Alpine F1 Team': 'Alpine',
      'MoneyGram Haas F1 Team': 'Haas',
      'Stake F1 Team Kick Sauber': 'Kick Sauber',
      'Atlassian Williams Racing': 'Williams'
    };
    if (map[raw]) return map[raw];
    return raw
      .replace(/\b(oracle|visa|cash app|aramco|petronas|moneygram|atlassian|stake|bwt)\b/gi, '')
      .replace(/\b(formula 1|f1)\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim() || raw;
  }

  function teamAgeFromMeta(meta) {
    if (!meta || typeof meta !== 'object') return '';
    var yearRaw = meta.founded_year || meta.founded || meta.year_established || meta.established || '';
    if (yearRaw == null || String(yearRaw).trim() === '') return '';
    var year = parseInt(String(yearRaw).replace(/[^\d]/g, ''), 10);
    if (!year || isNaN(year)) return '';
    var nowYear = new Date().getFullYear();
    if (year > nowYear || year < 1900) return '';
    return String(nowYear - year);
  }

  function ageFromBirthDate(value) {
    var s = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
    var p = s.split('-');
    var by = parseInt(p[0], 10);
    var bm = parseInt(p[1], 10);
    var bd = parseInt(p[2], 10);
    if (!by || !bm || !bd) return '';
    var now = new Date();
    var age = now.getFullYear() - by;
    var md = now.getMonth() + 1 - bm;
    if (md < 0 || (md === 0 && now.getDate() < bd)) age--;
    return isNaN(age) ? '' : String(age);
  }

  function getBestDriverPhotoURL(rawURL) {
    var src = String(rawURL || '').trim();
    if (!src) return '';
    // Prefer one high-quality source and let browser downscale it.
    // Wikimedia thumb URL example:
    // https://.../thumb/.../320px-File.jpg
    // Convert to original file URL:
    // https://.../.../File.jpg
    var wm = src.match(/^(.*\/thumb\/.*\/)(\d+)px-([^/?#]+)(.*)$/i);
    if (wm) {
      return wm[1].replace('/thumb/', '/') + wm[3];
    }
    return src;
  }

  function isSearchPhotoHighQuality(url) {
    var src = String(url || '').trim();
    if (!src) return Promise.resolve(false);
    if (driverPhotoQualityCache[src] != null) {
      return Promise.resolve(!!driverPhotoQualityCache[src]);
    }
    return new Promise(function (resolve) {
      var img = new Image();
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        driverPhotoQualityCache[src] = false;
        resolve(false);
      }, 3500);
      img.onload = function () {
        if (done) return;
        clearTimeout(timer);
        done = true;
        var w = img.naturalWidth || 0;
        var h = img.naturalHeight || 0;
        var ok = w >= 180 && h >= 180;
        driverPhotoQualityCache[src] = ok;
        resolve(ok);
      };
      img.onerror = function () {
        if (done) return;
        clearTimeout(timer);
        done = true;
        driverPhotoQualityCache[src] = false;
        resolve(false);
      };
      img.src = src;
    });
  }

  function pushSearchItem(list, dedupe, title, kind, href, extra, subtext, seriesID, teamName, seriesName, meta) {
    var cleanTitle = String(title || '').trim();
    if (!cleanTitle || !href) return;
    var key = kind + '|' + href + '|' + cleanTitle.toLowerCase();
    if (dedupe[key]) return;
    dedupe[key] = true;
    var hay = normalizeSearchText(cleanTitle + ' ' + (extra || ''));
    var pop = seriesPopularityScore(seriesID) + teamPopularityBoost(teamName);
    list.push({
      title: cleanTitle,
      kind: kind,
      href: href,
      haystack: hay,
      subtext: subtext || '',
      popularity: pop,
      seriesID: seriesID || '',
      seriesName: seriesName || '',
      teamName: teamName || '',
      meta: (meta && typeof meta === 'object') ? meta : {}
    });
  }

  function rankSearchItems(queryNorm, a, b) {
    var aStarts = a.haystack.indexOf(queryNorm) === 0 ? 0 : 1;
    var bStarts = b.haystack.indexOf(queryNorm) === 0 ? 0 : 1;
    if (aStarts !== bStarts) return aStarts - bStarts;
    var aPop = a.popularity || 0;
    var bPop = b.popularity || 0;
    if (aPop !== bPop) return bPop - aPop;
    return a.title.localeCompare(b.title);
  }

  function pickPrimaryDriverContext(agg, primaryBySlug, slugKey) {
    if (primaryBySlug && slugKey && primaryBySlug[slugKey]) {
      var p = primaryBySlug[slugKey];
      if (p && (p.series_id || p.series_name)) {
        return {
          seriesID: p.series_id || '',
          seriesName: p.series_name || '',
          teamName: p.team_name || ''
        };
      }
    }
    var bestSeriesID = '';
    var bestSeriesCount = -1;
    var bestSeriesPop = -1;
    Object.keys(agg.seriesCounts).forEach(function (sid) {
      var cnt = agg.seriesCounts[sid] || 0;
      var pop = seriesPopularityScore(sid);
      if (
        cnt > bestSeriesCount ||
        (cnt === bestSeriesCount && pop > bestSeriesPop) ||
        (cnt === bestSeriesCount && pop === bestSeriesPop && String(sid) < String(bestSeriesID))
      ) {
        bestSeriesID = sid;
        bestSeriesCount = cnt;
        bestSeriesPop = pop;
      }
    });
    var teams = (agg.teamCountsBySeries && agg.teamCountsBySeries[bestSeriesID]) || {};
    var bestTeam = '';
    var bestTeamCount = -1;
    Object.keys(teams).forEach(function (tn) {
      var cnt = teams[tn] || 0;
      if (cnt > bestTeamCount || (cnt === bestTeamCount && tn < bestTeam)) {
        bestTeam = tn;
        bestTeamCount = cnt;
      }
    });
    return {
      seriesID: bestSeriesID,
      seriesName: agg.seriesNames[bestSeriesID] || bestSeriesID || '',
      teamName: bestTeam || ''
    };
  }

  function ensureSearchIndex() {
    if (searchIndexReady) return Promise.resolve(searchIndexItems);
    if (searchIndexLoading) return Promise.resolve(searchIndexItems);
    searchIndexLoading = true;
    var items = [];
    var dedupe = {};
    var driverAggBySlug = {};
    var legalNameBySlug = {};
    return fetchJSON('/api/drivers/primary-context')
      .catch(function () { return {}; })
      .then(function (primaryBySlug) {
        if (!primaryBySlug || typeof primaryBySlug !== 'object') primaryBySlug = {};
        return fetchJSON('/api/drivers')
          .catch(function () { return []; })
          .then(function (drivers) {
            if (Array.isArray(drivers)) {
              drivers.forEach(function (d) {
                if (!d || typeof d !== 'object') return;
                var slug = String(d.slug || '').trim();
                var extra = String(d.search_extra || '').trim();
                if (slug && extra) legalNameBySlug[slug] = extra;
              });
            }
            return primaryBySlug;
          });
      })
      .then(function (primaryBySlug) {
        if (!primaryBySlug || typeof primaryBySlug !== 'object') primaryBySlug = {};
        return fetchJSON('/api/series')
          .then(function (seriesList) {
            if (!Array.isArray(seriesList)) return primaryBySlug;
            var reqs = seriesList.map(function (series) {
              var id = String((series && series.id) || '').trim();
              if (!id) return Promise.resolve(null);
              var name = String((series && series.name) || id).trim();
              var slug = id.toLowerCase().replace(/_+/g, '-');
              pushSearchItem(items, dedupe, name, 'Championship', '/series/' + encodeURIComponent(slug), seriesSearchExtra(id, id), '', id, name, name, null);
              var season = (series && series.season) ? String(series.season) : '';
              if (season && name) {
                pushSearchItem(items, dedupe, name + ' ' + season, 'Season', '/series/' + encodeURIComponent(slug), seriesSearchExtra(id, id + ' ' + name), '', id, name, name, null);
              }
              return fetchJSON('/api/series/' + encodeURIComponent(id.toLowerCase()) + '/teams')
                .then(function (teamsResp) {
                  var teamList = (teamsResp && Array.isArray(teamsResp.teams)) ? teamsResp.teams : (Array.isArray(teamsResp) ? teamsResp : []);
                  teamList.forEach(function (row) {
                    if (!row || typeof row !== 'object') return;
                    var teamName = String(row.team || '').trim();
                    var manufacturer = String(row.manufacturer || '').trim();
                    if (teamName) {
                      var teamMeta = {
                        base: row.base || row.hq || row.headquarters || row.location || '',
                        licence: row.licence || row.license || row.nationality || '',
                        age: teamAgeFromMeta(row)
                      };
                      pushSearchItem(items, dedupe, normalizeDisplayTeamName(teamName), 'team', '/team/' + encodeURIComponent(slugify(teamName)), seriesSearchExtra(id, name + ' ' + manufacturer), name, id, teamName, name, teamMeta);
                    }
                    var drivers = [];
                    if (Array.isArray(row.drivers)) {
                      row.drivers.forEach(function (d) {
                        var s = String(d || '').trim();
                        if (s) drivers.push(s);
                      });
                    }
                    if (row.driver != null && String(row.driver).trim() !== '') {
                      var splitNames = (window.TGA && window.TGA.splitDriverNames)
                        ? window.TGA.splitDriverNames(String(row.driver))
                        : [String(row.driver).trim()];
                      splitNames.forEach(function (d) {
                        if (d) drivers.push(d);
                      });
                    }
                    drivers.forEach(function (driverNameRaw) {
                      var driverName = driverDisplayName(String(driverNameRaw || '').trim());
                      if (!driverName) return;
                      var dSlug = slugify(driverName);
                      if (!dSlug) return;
                      if (!driverAggBySlug[dSlug]) {
                        driverAggBySlug[dSlug] = {
                          title: driverName,
                          href: '/driver/' + encodeURIComponent(dSlug),
                          seriesCounts: {},
                          seriesNames: {},
                          teamCountsBySeries: {}
                        };
                      }
                      var agg = driverAggBySlug[dSlug];
                      if (!agg.seriesCounts[id]) agg.seriesCounts[id] = 0;
                      agg.seriesCounts[id] += 1;
                      agg.seriesNames[id] = name;
                      if (!agg.teamCountsBySeries[id]) agg.teamCountsBySeries[id] = {};
                      if (teamName) {
                        if (!agg.teamCountsBySeries[id][teamName]) agg.teamCountsBySeries[id][teamName] = 0;
                        agg.teamCountsBySeries[id][teamName] += 1;
                      }
                    });
                    var crewChiefName = String(row.crew_chief || row.crewChief || '').trim();
                    if (crewChiefName) {
                      var crewMeta = {
                        nationality: row.crew_chief_nationality || row.crewChiefNationality || row.crew_chief_citizenship || '',
                        age: row.crew_chief_age || row.crewChiefAge || ageFromBirthDate(row.crew_chief_birth_date || row.crewChiefBirthDate || '')
                      };
                      pushSearchItem(items, dedupe, crewChiefName, 'crew_chief', '/crew-chief/' + encodeURIComponent(slugify(crewChiefName)), name + ' ' + teamName, teamName || name, id, teamName, name, crewMeta);
                    }
                    var teamPrincipalName = String(row.team_principal || row.teamPrincipal || row.principal || '').trim();
                    if (teamPrincipalName) {
                      var principalHref = teamName ? '/team/' + encodeURIComponent(slugify(teamName)) : '/';
                      pushSearchItem(items, dedupe, teamPrincipalName, 'team_principal', principalHref, name + ' ' + teamName, teamName || name, id, teamName, name, null);
                    }
                  });
                })
                .catch(function () { return null; });
            });
            return Promise.all(reqs).then(function () { return primaryBySlug; });
          });
      })
      .then(function (primaryBySlug) {
        Object.keys(driverAggBySlug).forEach(function (slugKey) {
          var agg = driverAggBySlug[slugKey];
          var primary = pickPrimaryDriverContext(agg, primaryBySlug, slugKey);
          var legalExtra = legalNameBySlug[slugKey] || '';
          pushSearchItem(
            items,
            dedupe,
            agg.title,
            'driver',
            agg.href,
            [primary.seriesName, primary.teamName, legalExtra].filter(Boolean).join(' '),
            primary.teamName || primary.seriesName,
            primary.seriesID,
            primary.teamName,
            primary.seriesName,
            null
          );
        });
        return fetchJSON('/api/drivers')
          .then(function (drivers) {
            if (!Array.isArray(drivers)) return;
            drivers.forEach(function (d) {
              if (!d || typeof d !== 'object') return;
              var driverName = driverDisplayName(String(d.name || '').trim());
              var dSlug = String(d.slug || '').trim();
              if (!driverName) return;
              if (!dSlug) dSlug = slugify(driverName);
              if (!dSlug) return;
              if (driverAggBySlug[dSlug]) return;
              var searchExtra = String(d.search_extra || '').trim();
              pushSearchItem(
                items,
                dedupe,
                driverName,
                'driver',
                '/driver/' + encodeURIComponent(dSlug),
                searchExtra,
                '',
                '',
                '',
                '',
                null
              );
            });
          })
          .catch(function () { return null; });
      })
      .then(function () {
        searchIndexItems = items;
        searchIndexReady = true;
      })
      .catch(function () {
        searchIndexItems = [];
      })
      .finally(function () {
        searchIndexLoading = false;
      })
      .then(function () { return searchIndexItems; });
  }

  function initHeaderSearch() {
    if (searchInitDone) return;
    searchInitDone = true;
    var wrapper = document.getElementById('header-search');
    var toggle = document.getElementById('search-toggle');
    var popover = document.getElementById('search-popover');
    var input = document.getElementById('search-input');
    var results = document.getElementById('search-results');
    if (!wrapper || !toggle || !popover || !input || !results) return;

    function closeSearch() {
      popover.classList.add('hidden');
      toggle.setAttribute('aria-expanded', 'false');
    }

    function openSearch() {
      popover.classList.remove('hidden');
      toggle.setAttribute('aria-expanded', 'true');
      input.focus();
      ensureSearchIndex().then(function () {
        if (!input.value.trim()) results.innerHTML = '';
      });
    }

    function renderSearchResults(query) {
      results.innerHTML = '';
    }

    function navigateToSearch(query) {
      var q = String(query || '').trim();
      if (!q) return;
      closeSearch();
      input.value = '';
      window.scrollTo(0, 0);
      var href = '/search?q=' + encodeURIComponent(q);
      if (href !== window.location.pathname + window.location.search) {
        history.pushState(null, '', href);
      }
      route();
    }

    toggle.addEventListener('click', function () {
      if (popover.classList.contains('hidden')) openSearch();
      else closeSearch();
    });
    input.addEventListener('input', function () {
      renderSearchResults(input.value);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeSearch();
        toggle.focus();
        return;
      }
      if (e.key === 'Enter') {
        navigateToSearch(input.value);
      }
    });
    document.addEventListener('click', function (e) {
      if (!wrapper.contains(e.target)) closeSearch();
    });
    results.addEventListener('click', function (e) {
      var a = e.target && e.target.closest && e.target.closest('a.search-result-link');
      if (!a) return;
      closeSearch();
      input.value = '';
    });
  }

  function renderSearchPage(query) {
    showView('view-search');
    var q = String(query || '').trim();
    var titleEl = document.getElementById('search-title');
    var metaEl = document.getElementById('search-meta');
    var breadcrumbEl = document.getElementById('search-breadcrumb');
    var contentEl = document.getElementById('search-results-content');
    if (!contentEl) return;
    if (titleEl) titleEl.textContent = 'Search results';
    if (breadcrumbEl) {
      breadcrumbEl.innerHTML =
        '<a href="/">' + (t('breadcrumb.all') || 'All series') + '</a>' +
        '<span class="breadcrumb-sep">/</span><span>' + esc(q || 'Search') + '</span>';
    }
    if (!q) {
      if (metaEl) metaEl.textContent = 'Type query in search box';
      contentEl.innerHTML = '<p class="empty-msg">No query provided.</p>';
      document.title = 'Search — The Grid Archive (TGA)';
      loadedSeriesId = null;
      return;
    }

    var groupsMeta = [
      { key: 'driver', label: 'Drivers' },
      { key: 'team', label: 'Teams' },
      { key: 'team_principal', label: 'Team principals' },
      { key: 'crew_chief', label: 'Crew chiefs' },
      { key: 'Championship', label: 'Championships' },
      { key: 'Season', label: 'Seasons' }
    ];

    function renderFromMatches(matches, driverMetaBySlug, driverPhotoOkBySlug) {
      var total = matches.length;
      if (metaEl) metaEl.textContent = '';
      if (total === 0) {
        contentEl.innerHTML = '<p class="empty-msg">No matches found.</p>';
        return;
      }
      var byKind = {};
      matches.forEach(function (m) {
        if (!byKind[m.kind]) byKind[m.kind] = [];
        byKind[m.kind].push(m);
      });
      var html = '<div class="search-groups">';
      groupsMeta.forEach(function (g) {
        var list = byKind[g.key] || [];
        if (!list.length) return;
        html += '<section class="search-group">';
        html += '<div class="search-group-header"><span>' + esc(g.label) + '</span><span class="search-group-count">' + list.length + ' matches</span></div>';
        if (g.key === 'driver') {
          html += '<div class="table-wrap"><table class="data-table"><thead><tr>' +
            '<th>name</th><th>nation</th><th>series</th><th>team</th><th>age</th>' +
            '</tr></thead><tbody>';
          list.forEach(function (item) {
            var slug = decodeURIComponent((item.href || '').replace(/^\/driver\//, ''));
            var m = driverMetaBySlug[slug] || {};
            var inferredSeries = '';
            var inferredTeam = '';
            if (m.primary_series_name && String(m.primary_series_name).trim()) {
              inferredSeries = String(m.primary_series_name).trim();
            } else if (m.primary_series_id && String(m.primary_series_id).trim()) {
              inferredSeries = String(m.primary_series_id).trim();
            }
            if (m.primary_team_name && String(m.primary_team_name).trim()) {
              inferredTeam = String(m.primary_team_name).trim();
            } else if (Array.isArray(m.season_results) && m.season_results.length > 0) {
              var firstRes = m.season_results[0] || {};
              if (!inferredSeries) inferredSeries = String(firstRes.series_name || firstRes.series_id || '').trim();
              if (!inferredTeam) inferredTeam = String(firstRes.team_name || '').trim();
            }
            var nation = '—';
            if (m.citizenship && String(m.citizenship).trim()) {
              var parts = String(m.citizenship)
                .split(',')
                .map(function (x) { return String(x).trim(); })
                .filter(function (x) { return x; });
              if (parts.length > 1) {
                var mainNation = parts[parts.length - 1];
                var rest = parts.slice(0, parts.length - 1);
                nation = [mainNation].concat(rest).join(', ');
              } else if (parts.length === 1) {
                nation = parts[0];
              }
            } else if (m.nationality && String(m.nationality).trim()) {
              nation = String(m.nationality).trim();
            }
            var age = '—';
            if (m.birth_date && /^\d{4}-\d{2}-\d{2}$/.test(String(m.birth_date))) {
              var p = String(m.birth_date).split('-');
              var by = parseInt(p[0], 10);
              var bm = parseInt(p[1], 10);
              var bd = parseInt(p[2], 10);
              var now = new Date();
              var a = now.getFullYear() - by;
              var md = now.getMonth() + 1 - bm;
              if (md < 0 || (md === 0 && now.getDate() < bd)) a--;
              age = isNaN(a) ? '—' : String(a);
            }
            var photoUrl = (m.photo_url && String(m.photo_url).trim()) ? String(m.photo_url).trim() : '';
            var photoOk = !!(driverPhotoOkBySlug && driverPhotoOkBySlug[slug]);
            var photoSrc = '/api/driver-thumb/' + encodeURIComponent(slug) + '?_=search-thumb-v4';
            var photoHtml = (photoUrl && photoOk)
              ? '<img class="search-driver-photo" src="' + esc(photoSrc) + '"' +
                ' alt="" loading="lazy" decoding="async">'
              : '<span class="search-driver-photo search-driver-photo--empty" aria-hidden="true"></span>';
            html += '<tr>' +
              '<td><a class="search-page-link search-driver-link" href="' + item.href + '">' + photoHtml + '<span class="search-page-title">' + esc(item.title) + '</span></a></td>' +
              '<td>' + esc(String(nation)) + '</td>' +
              '<td>' + esc(item.seriesName || inferredSeries || '—') + '</td>' +
              '<td>' + esc(normalizeDisplayTeamName(item.teamName || inferredTeam) || '—') + '</td>' +
              '<td class="col-num">' + esc(age) + '</td>' +
              '</tr>';
          });
          html += '</tbody></table></div>';
        } else if (g.key === 'team') {
          html += '<div class="table-wrap"><table class="data-table"><thead><tr>' +
            '<th>name</th><th>series</th><th>base</th><th>licence</th><th>age</th>' +
            '</tr></thead><tbody>';
          list.forEach(function (item) {
            var meta = item.meta || {};
            var teamSlugFromHref = decodeURIComponent((item.href || '').replace(/^\/team\//, ''));
            var teamLogoURL = '/api/team-logo/' + encodeURIComponent(teamSlugFromHref) + '?_=team-logo-v1';
            html += '<tr>' +
              '<td><a class="search-page-link search-team-link" href="' + item.href + '"><img class="search-team-logo" src="' + esc(teamLogoURL) + '" alt="" loading="lazy" decoding="async"><span class="search-page-title">' + esc(item.title) + '</span></a></td>' +
              '<td>' + esc(item.seriesName || '—') + '</td>' +
              '<td>' + esc(meta.base || '—') + '</td>' +
              '<td>' + esc(meta.licence || '—') + '</td>' +
              '<td class="col-num">' + esc(meta.age || '—') + '</td>' +
              '</tr>';
          });
          html += '</tbody></table></div>';
        } else if (g.key === 'team_principal') {
          html += '<div class="table-wrap"><table class="data-table"><thead><tr>' +
            '<th>name</th><th>team</th><th>series</th>' +
            '</tr></thead><tbody>';
          list.forEach(function (item) {
            html += '<tr>' +
              '<td><a class="search-page-link" href="' + item.href + '"><span class="search-page-title">' + esc(item.title) + '</span></a></td>' +
              '<td>' + esc(normalizeDisplayTeamName(item.teamName) || '—') + '</td>' +
              '<td>' + esc(item.seriesName || '—') + '</td>' +
              '</tr>';
          });
          html += '</tbody></table></div>';
        } else if (g.key === 'crew_chief') {
          html += '<div class="table-wrap"><table class="data-table"><thead><tr>' +
            '<th>name</th><th>team</th><th>series</th><th>nationality</th><th>age</th>' +
            '</tr></thead><tbody>';
          list.forEach(function (item) {
            var metaCrew = item.meta || {};
            html += '<tr>' +
              '<td><a class="search-page-link" href="' + item.href + '"><span class="search-page-title">' + esc(item.title) + '</span></a></td>' +
              '<td>' + esc(normalizeDisplayTeamName(item.teamName) || '—') + '</td>' +
              '<td>' + esc(item.seriesName || '—') + '</td>' +
              '<td>' + esc(metaCrew.nationality || '—') + '</td>' +
              '<td class="col-num">' + esc(metaCrew.age || '—') + '</td>' +
              '</tr>';
          });
          html += '</tbody></table></div>';
        } else if (g.key === 'Championship' || g.key === 'Season') {
          html += '<div class="table-wrap"><table class="data-table"><thead><tr>' +
            '<th>name</th>' +
            '</tr></thead><tbody>';
          list.forEach(function (item) {
            html += '<tr>' +
              '<td><a class="search-page-link" href="' + item.href + '"><span class="search-page-title">' + esc(item.title) + '</span></a></td>' +
              '</tr>';
          });
          html += '</tbody></table></div>';
        } else {
          html += '<ul class="search-group-list">';
          list.forEach(function (item) {
            var sub = item.subtext ? '<div class="search-page-sub">' + esc(item.subtext) + '</div>' : '';
            html += '<li><a class="search-page-link" href="' + item.href + '"><span><span class="search-page-title">' + esc(item.title) + '</span>' + sub + '</span></a></li>';
          });
          html += '</ul>';
        }
        html += '</section>';
      });
      html += '</div>';
      contentEl.innerHTML = html;
    }

    ensureSearchIndex().then(function () {
      var qNorm = normalizeSearchText(q);
      var matches = searchIndexItems
        .filter(function (item) { return item.haystack.indexOf(qNorm) !== -1; })
        .sort(function (a, b) { return rankSearchItems(qNorm, a, b); });
      var drivers = matches.filter(function (m) { return m.kind === 'driver'; });
      var driverReqs = drivers.map(function (m) {
        var slug = decodeURIComponent((m.href || '').replace(/^\/driver\//, ''));
        return fetchJSON('/api/driver/' + encodeURIComponent(slug) + '?_=' + Date.now())
          .then(function (d) { return { slug: slug, data: d || {} }; })
          .catch(function () { return { slug: slug, data: {} }; });
      });
      Promise.all(driverReqs).then(function (arr) {
        var bySlug = {};
        arr.forEach(function (x) { bySlug[x.slug] = x.data || {}; });
        var photoChecks = drivers.map(function (m) {
          var slug = decodeURIComponent((m.href || '').replace(/^\/driver\//, ''));
          var d = bySlug[slug] || {};
          var photoUrl = (d.photo_url && String(d.photo_url).trim()) ? String(d.photo_url).trim() : '';
          photoUrl = getBestDriverPhotoURL(photoUrl);
          return isSearchPhotoHighQuality(photoUrl).then(function (ok) {
            return { slug: slug, ok: ok };
          }).catch(function () {
            return { slug: slug, ok: false };
          });
        });
        Promise.all(photoChecks).then(function (photoArr) {
          var photoBySlug = {};
          photoArr.forEach(function (p) { photoBySlug[p.slug] = !!p.ok; });
          renderFromMatches(matches, bySlug, photoBySlug);
        }).catch(function () {
          renderFromMatches(matches, bySlug, {});
        });
      }).catch(function () {
        renderFromMatches(matches, {}, {});
      });
    }).catch(function () {
      if (metaEl) metaEl.textContent = '"' + q + '"';
      contentEl.innerHTML = '<p class="empty-msg">Failed to load search index.</p>';
    });
    document.title = 'Search: ' + q + ' — The Grid Archive (TGA)';
    loadedSeriesId = null;
  }

  function renderEntityPage(type, slug, placeholder) {
    showView('view-' + type);
    var name = decodeURIComponent(slug).replace(/-+/g, ' ');
    document.getElementById(type + '-title').textContent = name;
    document.getElementById(type + '-meta').textContent = '';
    document.getElementById(type + '-breadcrumb').innerHTML =
      '<a href="/">' + t('breadcrumb.all') + '</a>' +
      '<span class="breadcrumb-sep">/</span>' +
      '<span>' + esc(name) + '</span>';
    document.getElementById(type + '-content').innerHTML = '<p class="empty-msg">' + placeholder + '</p>';
    document.title = name + ' — The Grid Archive (TGA)';
    loadedSeriesId = null;
  }

  /** Slug (as in /track/…) → hero image under /web/. */
  var trackPagePhotoBySlug = {
    'rockingham-speedway-rockingham-north-carolina': '/web/rockingham-speedway.jpg',
    'rockingham-speedway': '/web/rockingham-speedway.jpg',
    'brands-hatch': '/web/brands-hatch.jpg',
    'misano-world-circuit-marco-simoncelli': '/web/misano.jpg',
    'watkins-glen-international': '/web/watkins-glen-international.png',
    'watkins-glen-international-watkins-glen-new-york': '/web/watkins-glen-international.png',
    'indianapolis-motor-speedway-road-course': '/web/IndyRoadCourse.jpg',
    'circuit-de-spa-francorchamps': '/web/Circuit-de-Spa-Francorchamps19.jpg',
    'dover-motor-speedway': '/web/Dover-Motor-Speedway.jpg',
    'dover-motor-speedway-dover-delaware': '/web/Dover-Motor-Speedway.jpg',
    'seekonk-speedway': '/web/seekonk-speedway.jpg',
    'seekonk-speedway-seekonk-massachusetts': '/web/seekonk-speedway.jpg',
    'moscow-raceway': '/web/moscow-raceway.jpg',
    'toledo-speedway': '/web/Toledo-Speedway.jpg',
    'toledo-speedway-toledo-ohio': '/web/Toledo-Speedway.jpg',
    'circuit-gilles-villeneuve': '/web/circuit-gilles-villeneuve.jpg',
    'charlotte-motor-speedway': '/web/charlotte-motor-speedway.jpg',
    'charlotte-motor-speedway-concord-north-carolina': '/web/charlotte-motor-speedway.jpg',
    'circuit-zandvoort': '/web/zandvoort.jpg',
    'autodromo-di-vallelunga': '/web/Autodromo-Vallelunga.png',
    'symmons-plains-raceway': '/web/Symmons-Plains-Raceway.jpg',
    'indianapolis-motor-speedway': '/web/indianapolis-motor-speedway.jpg',
    'indianapolis-motor-speedway-speedway-indiana': '/web/indianapolis-motor-speedway.jpg',
    'monaco-circuit': '/web/Monaco-circuit.jpg',
    'circuit-de-monaco': '/web/Monaco-circuit.jpg',
    'circuit-de-monaco-monaco': '/web/Monaco-circuit.jpg',
    'monza-circuit': '/web/monza.png',
    'autodromo-nazionale-di-monza': '/web/monza.png',
    'autodromo-nazionale-di-monza-monza-italy': '/web/monza.png',
    'monza': '/web/monza.png',
    'michigan-international-speedway': '/web/michigan-speedway.jpg',
    'michigan-international-speedway-brooklyn-michigan': '/web/michigan-speedway.jpg',
    'michigan-speedway': '/web/michigan-speedway.jpg',
    'nashville-superspeedway': '/web/nashville-superspeedway.jpg',
    'nashville-superspeedway-lebanon-tennessee': '/web/nashville-superspeedway.jpg',
    'riverhead-raceway': '/web/riverhead-raceway.jpg',
    'riverhead-raceway-riverhead-new-york': '/web/riverhead-raceway.jpg',
    'streets-of-detroit': '/web/streets-of-detroit.jpg',
    'streets-of-detroit-detroit-michigan': '/web/streets-of-detroit.jpg',
    'world-wide-technology-raceway': '/web/world-wide-technology-raceway.png',
    'world-wide-technology-raceway-madison-illinois': '/web/world-wide-technology-raceway.png',
    'pocono-raceway': '/web/Pocono.jpg',
    'pocono-raceway-long-pond-pennsylvania': '/web/Pocono.jpg',
    'kazan-ring': '/web/kazan-ring.jpg',
    'kazan-ring-tatarstan': '/web/kazan-ring.jpg',
    'circuit-de-la-sarthe': '/web/Circuit-de-la-Sarthe.jpg',
    'circuit-de-la-sarthe-le-mans': '/web/Circuit-de-la-Sarthe.jpg',
    'le-mans': '/web/Circuit-de-la-Sarthe.jpg',
    'suzuka-circuit': '/web/suzuka-bg.png',
    'suzuka-international-racing-course': '/web/suzuka-bg.png'
  };

  function renderTrackDetail(slug) {
    renderEntityPage('track', slug, t('coming_soon.track'));
    try {
      var dec = decodeURIComponent(String(slug || ''));
      var key = slugify(dec);
      var photoUrl = trackPagePhotoBySlug[key] || trackPagePhotoBySlug[dec.toLowerCase().replace(/^-+|-+$/g, '')];
      if (photoUrl) {
        var trackContent = document.getElementById('track-content');
        if (trackContent) {
          trackContent.innerHTML =
            '<figure class="track-page-photo-wrap"><img class="track-page-photo" src="' + esc(photoUrl) + '" alt=""></figure>' +
            '<p class="empty-msg">' + t('coming_soon.track') + '</p>';
        }
      }
    } catch (err) { /* ignore bad slug */ }
  }
  function driverDetailIsCurrent(reqToken) {
    return reqToken === window.__tgaDriverReqToken;
  }

  function driverDetailPhotoPlaceholderSrc() {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="14" fill="rgba(125,125,125,0.18)"/></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function resetDriverDetailShell(nameFromSlug) {
    var viewEl = document.getElementById('view-driver');
    if (viewEl) viewEl.classList.add('driver-loading');
    document.getElementById('driver-title').textContent = nameFromSlug;
    document.getElementById('driver-meta').textContent = '';
    document.getElementById('driver-breadcrumb').innerHTML =
      '<a href="/">' + t('breadcrumb.all') + '</a>' +
      '<span class="breadcrumb-sep">/</span>' +
      '<span>' + esc(nameFromSlug) + '</span>';
    document.getElementById('driver-content').innerHTML = '<p class="empty-msg">' + t('coming_soon.driver') + '</p>';
    var photoEl = document.getElementById('driver-photo');
    if (photoEl) {
      photoEl.removeAttribute('src');
      photoEl.src = driverDetailPhotoPlaceholderSrc();
      photoEl.alt = '';
    }
  }

  function revealDriverDetail(reqToken) {
    if (!driverDetailIsCurrent(reqToken)) return;
    var viewEl = document.getElementById('view-driver');
    if (viewEl) viewEl.classList.remove('driver-loading');
  }

  function wireCitizenshipFlagImages(root) {
    if (!root) return;
    var imgs = root.querySelectorAll('.citizenship-flag img');
    for (var i = 0; i < imgs.length; i++) {
      (function (img) {
        img.loading = 'eager';
        if (img.getAttribute('data-flag-wired') === '1') return;
        img.setAttribute('data-flag-wired', '1');
        img.addEventListener('error', function onFlagImgError() {
          var src = String(img.getAttribute('src') || '');
          if (src.indexOf('retry=') >= 0) return;
          img.removeEventListener('error', onFlagImgError);
          img.src = src + (src.indexOf('?') >= 0 ? '&' : '?') + 'retry=' + Date.now();
        });
      })(imgs[i]);
    }
  }

  function renderDriverDetail(slug) {
    // Guard against out-of-order responses on fast driver navigation.
    var reqToken = (window.__tgaDriverReqToken = (window.__tgaDriverReqToken || 0) + 1);
    function titleCaseWords(str) {
      if (!str) return '';
      return String(str)
        .split(/\s+/)
        .filter(Boolean)
        .map(function (w) {
          if (!w) return w;
          return w.charAt(0).toUpperCase() + w.slice(1);
        })
        .join(' ');
    }

    var nameFromSlug = decodeURIComponent(slug).replace(/-+/g, ' ');
    nameFromSlug = titleCaseWords(nameFromSlug);
    resetDriverDetailShell(nameFromSlug);
    showView('view-driver');

    // cache-busting: photo_url from driver_profiles.json may update,
    // but browser may cache old JSON response.
    fetchJSON('/api/driver/' + encodeURIComponent(slug) + '?_=' + Date.now())
      .then(function (data) {
        if (!driverDetailIsCurrent(reqToken)) return;
        if (!data || typeof data !== 'object') return;
        var canonicalSlug = String(data.canonical_slug || '').trim();
        if (canonicalSlug && canonicalSlug !== slug) {
          var canonPath = '/driver/' + encodeURIComponent(canonicalSlug);
          if (window.location.pathname !== canonPath) {
            history.replaceState(null, '', canonPath);
            renderDriverDetail(canonicalSlug);
            return;
          }
        }
        var displayName = (data.name && String(data.name).trim()) ? String(data.name).trim() : '';
        var legalFullName = (data.legal_full_name && String(data.legal_full_name).trim()) ? String(data.legal_full_name).trim() : '';
        var metaPartsHtml = [];
        var flagPrefetchIsos = {};
        var flagPrefetchPromises = [];
        function prefetchFlagIso(iso) {
          if (!iso) return;
          var key = String(iso).toLowerCase();
          if (flagPrefetchIsos[key]) return;
          flagPrefetchIsos[key] = true;
          flagPrefetchPromises.push(
            fetch('/api/flag/' + key + '.png', { credentials: 'same-origin' }).catch(function () {})
          );
        }
        if (legalFullName) {
          metaPartsHtml.push('Full name: ' + esc(legalFullName));
        }
        var titleEl = document.getElementById('driver-title');
        if (titleEl && displayName) {
          titleEl.textContent = displayName;
        } else if (titleEl && legalFullName) {
          titleEl.textContent = legalFullName.split(/\s+/).slice(0, 1).concat(legalFullName.split(/\s+/).slice(-1)).join(' ');
        }
        if (data.citizenship && data.citizenship.trim()) {
          function isoFromCountry(country) {
            if (!country) return '';
            var c = String(country).trim();
            if (!c) return '';
            if (/^[A-Za-z]{2}$/.test(c)) return c.toUpperCase();
            var lower = c.toLowerCase();
            var aliases = {
              'great britain': 'GB', 'britain': 'GB', 'uk': 'GB', 'united kingdom': 'GB', 'england': 'GB',
              'italy': 'IT', 'italian': 'IT', 'italian republic': 'IT', 'monaco': 'MC', 'monegasque': 'MC',
              'spain': 'ES', 'españa': 'ES', 'kingdom of spain': 'ES',
              'belgium': 'BE', 'kingdom of belgium': 'BE',
              'france': 'FR', 'french republic': 'FR',
              'germany': 'DE', 'deutschland': 'DE', 'federal republic of germany': 'DE', 'german': 'DE',
              'new zealand': 'NZ', 'aotearoa': 'NZ',
              'australia': 'AU', 'commonwealth of australia': 'AU',
              'canada': 'CA', 'canadian': 'CA',
              'mexico': 'MX', 'mexican': 'MX',
              'argentina': 'AR', 'argentine republic': 'AR', 'republic of argentina': 'AR',
              'brazil': 'BR', 'brasil': 'BR', 'federative republic of brazil': 'BR', 'republic of brazil': 'BR',
              'netherlands': 'NL', 'holland': 'NL', 'kingdom of the netherlands': 'NL',
              'thailand': 'TH', 'thai': 'TH', 'kingdom of thailand': 'TH',
              'finland': 'FI', 'republic of finland': 'FI',
              'denmark': 'DK', 'kingdom of denmark': 'DK', 'danish': 'DK',
              'norway': 'NO', 'kingdom of norway': 'NO', 'norwegian': 'NO',
              'russia': 'RU', 'russian federation': 'RU',
              'usa': 'US', 'united states': 'US', 'united states of america': 'US',
              'sweden': 'SE', 'switzerland': 'CH', 'austria': 'AT', 'poland': 'PL',
              'czech republic': 'CZ', 'czechia': 'CZ', 'hungary': 'HU', 'portugal': 'PT',
              'ireland': 'IE', 'iceland': 'IS', 'luxembourg': 'LU', 'andorra': 'AD',
              'san marino': 'SM', 'china': 'CN', 'japan': 'JP', 'korea': 'KR', 'south korea': 'KR',
              'india': 'IN', 'indonesia': 'ID', 'malaysia': 'MY', 'singapore': 'SG',
              'philippines': 'PH', 'taiwan': 'TW', 'hong kong': 'HK',
              'south africa': 'ZA', 'morocco': 'MA', 'algeria': 'DZ', 'egypt': 'EG',
              'chile': 'CL', 'colombia': 'CO', 'ecuador': 'EC', 'peru': 'PE', 'uruguay': 'UY',
              'paraguay': 'PY', 'bolivia': 'BO', 'venezuela': 'VE',
              'cayman islands': 'KY', 'caymanian': 'KY', 'barbados': 'BB', 'barbadian': 'BB',
              'lithuania': 'LT', 'latvia': 'LV', 'estonia': 'EE',
              'romania': 'RO', 'bulgaria': 'BG', 'slovakia': 'SK', 'slovenia': 'SI',
              'croatia': 'HR', 'serbia': 'RS', 'greece': 'GR', 'turkey': 'TR',
              'israel': 'IL', 'uae': 'AE', 'united arab emirates': 'AE', 'qatar': 'QA',
              'saudi arabia': 'SA', 'kuwait': 'KW', 'bahrain': 'BH'
            };
            return aliases[lower] || '';
          }

          function flagHtmlFromIso(iso) {
            if (!iso) return '';
            iso = String(iso).toUpperCase();
            if (!/^[A-Z]{2}$/.test(iso)) return '';
            var png = '/api/flag/' + iso.toLowerCase() + '.png';
            return '<span class="citizenship-flag">' +
              '<img src="' + esc(png) + '" width="18" height="12" alt="" loading="eager" decoding="async">' +
              '</span>';
          }

          function splitCitizenships(citizenshipStr) {
            var s = String(citizenshipStr || '').trim();
            if (!s) return [];
            // Normalize common separators to commas.
            s = s
              .replace(/\s*;\s*/g, ',')
              .replace(/\s*,\s*/g, ',')
              .replace(/\s*\+\s*/g, ',')
              .replace(/\s*\/\s*/g, ',')
              .replace(/\s*&\s*/g, ',')
              .replace(/\s+and\s+/gi, ',')
              .replace(/\s+or\s+/gi, ',');
            return s
              .split(',')
              .map(function (x) {
                var v = String(x).trim();
                var lower = v.toLowerCase();
                if (lower === 'britain' || lower === 'uk' || lower === 'united kingdom') return 'Great Britain';
                return v;
              })
              .filter(function (x) { return x; });
          }

          var citizenshipCountries = splitCitizenships(data.citizenship);
          if (citizenshipCountries.length > 0) {
            // "Primary" racing citizenship is the last element in the string.
            // Examples from driver_profiles.json:
            // - Albon: "Britain, Thailand" => primary Thailand
            // - Verstappen: "Belgium, Netherlands" => primary Netherlands
            var mainCountry = citizenshipCountries[citizenshipCountries.length - 1];

            // Order: primary on top, others below in original order.
            var orderedCountries = [mainCountry];
            for (var i = 0; i < citizenshipCountries.length - 1; i++) {
              orderedCountries.push(citizenshipCountries[i]);
            }

            var citizenshipPartsHtml = orderedCountries.map(function (country) {
              var iso = isoFromCountry(country);
              prefetchFlagIso(iso);
              var flagHtml = flagHtmlFromIso(iso);
              return (flagHtml ? flagHtml + ' ' : '') + esc(country);
            });

            if (citizenshipCountries.length > 1) {
              metaPartsHtml.push(esc(t('driver.citizenship')) + ':<br>' + citizenshipPartsHtml.join('<br>'));
            } else {
              metaPartsHtml.push(esc(t('driver.citizenship')) + ': ' + citizenshipPartsHtml[0]);
            }
          }
        } else if (data.nationality && data.nationality.trim()) {
          // fallback when citizenship not yet filled
          metaPartsHtml.push(esc(data.nationality.trim()));
        }
        function formatBirthDate(dateStr) {
          // API usually returns YYYY-MM-DD. Driver page needs DD-MM-YYYY.
          var s = String(dateStr || '').trim();
          var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
          if (!m) return s;
          return m[3] + '-' + m[2] + '-' + m[1];
        }
        function calcAgeAt(birthDateStr, refDateStr) {
          var birthM = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(birthDateStr || '').trim());
          var refM = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(refDateStr || '').trim());
          if (!birthM || !refM) return null;
          var by = parseInt(birthM[1], 10);
          var bmo = parseInt(birthM[2], 10);
          var bd = parseInt(birthM[3], 10);
          var ry = parseInt(refM[1], 10);
          var rmo = parseInt(refM[2], 10);
          var rd = parseInt(refM[3], 10);
          if (!by || !bmo || !bd || !ry || !rmo || !rd) return null;
          var age = ry - by;
          if (rmo < bmo || (rmo === bmo && rd < bd)) age--;
          return age;
        }
        function calcBirthAge(dateStr) {
          var ref = (data.death_date && String(data.death_date).trim()) ? String(data.death_date).trim() : null;
          if (ref) return calcAgeAt(dateStr, ref);
          var s = String(dateStr || '').trim();
          var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
          if (!m) return null;
          var y = parseInt(m[1], 10);
          var mo = parseInt(m[2], 10);
          var d = parseInt(m[3], 10);
          if (!y || !mo || !d) return null;
          var now = new Date();
          var age = now.getFullYear() - y;
          var monthDiff = now.getMonth() - (mo - 1);
          if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < d)) age--;
          return age;
        }
        if (data.birth_date && data.birth_date.trim()) {
          var birthDateStr = data.birth_date.trim();
          var formattedBirth = formatBirthDate(birthDateStr);
          var birthAge = calcBirthAge(birthDateStr);
          metaPartsHtml.push(
            'Born: ' +
            esc(formattedBirth) +
            (birthAge !== null && birthAge !== undefined && !data.death_date ? ' (' + esc(String(birthAge)) + ')' : '')
          );
        }
        if (data.birth_place && data.birth_place.trim()) {
          metaPartsHtml.push('Home town: ' + esc(data.birth_place.trim()));
        }
        if (data.death_date && data.death_date.trim()) {
          var deathDateStr = data.death_date.trim();
          var formattedDeath = formatBirthDate(deathDateStr);
          var deathAge = calcAgeAt(data.birth_date, deathDateStr);
          metaPartsHtml.push(
            'Died: ' +
            esc(formattedDeath) +
            (deathAge !== null && deathAge !== undefined ? ' (aged ' + esc(String(deathAge)) + ')' : '')
          );
        }
        // Vertical list of rows.
        function commitDriverMetaHtml() {
          if (!driverDetailIsCurrent(reqToken)) return;
          var metaEl = document.getElementById('driver-meta');
          metaEl.innerHTML = metaPartsHtml.join('<br>');
          wireCitizenshipFlagImages(metaEl);
          revealDriverDetail(reqToken);
        }
        if (flagPrefetchPromises.length > 0) {
          Promise.all(flagPrefetchPromises).finally(function () {
            commitDriverMetaHtml();
          });
        } else {
          commitDriverMetaHtml();
        }
        if (!driverDetailIsCurrent(reqToken)) return;
        document.title = (data.name || nameFromSlug) + ' — The Grid Archive (TGA)';

        // Driver photo (placeholder when not provided)
        var photoEl = document.getElementById('driver-photo');
        if (photoEl) {
          var photoUrl = (data.photo_url && data.photo_url.trim()) ? data.photo_url.trim() : '';
          if (!photoUrl) {
            photoEl.src = driverDetailPhotoPlaceholderSrc();
          } else {
            // Cache-buster ensures new request on each SPA navigation.
            // Do not reset src to '' to avoid extra request to current page
            // and avoid "batching" two assignments in a row.
            var sep = photoUrl.indexOf('?') >= 0 ? '&' : '?';
            var newSrc = photoUrl + sep + '_=' + Date.now();
            // Full reset without side-effect request.
            photoEl.removeAttribute('src');
            // Just in case: prevent browser from deferring load.
            photoEl.loading = 'eager';
            photoEl.src = newSrc;
          }
          photoEl.alt = data.name ? (data.name + ' photo') : 'Driver photo';
        }

        if (!driverDetailIsCurrent(reqToken)) return;
        var contentEl = document.getElementById('driver-content');
        var results = data.season_results;
        var season = data.season || '';
        if (Array.isArray(results) && results.length > 0) {
          var hasRaceName = results.some(function (r) {
            return r && r.race_name && String(r.race_name).trim() !== '';
          });
          // For F1: if sprint exists within same event_id, Feature must
          // be the second row. Otherwise do not show "Feature".
          var hasSprintByEvent = {};
          results.forEach(function (r) {
            if (!r) return;
            var seriesIdUpper = String(r.series_id || '').toUpperCase();
            if (seriesIdUpper !== 'F1') return;
            var raw = (r.race_name || '').toString();
            if (/sprint/i.test(raw)) {
              hasSprintByEvent[r.event_id] = true;
            }
          });
          var tableRows = results.map(function (row) {
            var eventName = (row.event_name && row.event_name.trim()) ? esc(row.event_name) : (row.event_id || '—');
            var eventHref = (row.event_id) ? '/event/' + encodeURIComponent((row.event_id + '').toLowerCase().replace(/_/g, '-')) : '#';
            var eventCell = eventHref !== '#' ? '<a href="' + eventHref + '" class="event-link">' + eventName + '</a>' : eventName;
            var raceCell = '';
            if (hasRaceName) {
              var raceLabel = '';
              var rawRaceName = (row.race_name || '').trim();
              if (rawRaceName) {
                var seriesIdUpper = String(row.series_id || '').toUpperCase();
                if (seriesIdUpper === 'F1') {
                  // For F1 want short label: "Sprint" instead of "Sprint Results",
                  // main race may stay unlabeled.
                  if (/sprint/i.test(rawRaceName)) {
                    raceLabel = 'Sprint';
                  } else {
                    // Show Feature only if sprint exists in same event_id.
                    raceLabel = hasSprintByEvent[row.event_id] ? 'Feature' : '';
                  }
                } else {
                  raceLabel = rawRaceName;
                }
              }
              raceCell = '<td>' + esc(raceLabel) + '</td>';
            }
            return '<tr data-series-id="' + esc(row.series_id || '') + '" data-event-id="' + esc(row.event_id || '') + '">' +
              '<td>' + esc(row.series_name || row.series_id || '—') + '</td>' +
              '<td>' + eventCell + '</td>' +
              raceCell +
              '<td class="col-num">' + (row.position != null ? row.position : '—') + '</td>' +
              '<td class="col-num">' + (row.points != null ? row.points : '—') + '</td>' +
              (row.car_number ? '<td class="col-num">' + esc(row.car_number) + '</td>' : '') +
              '<td>' + (row.laps != null ? row.laps : '') + '</td>' +
              (row.status ? '<td>' + esc(row.status) + '</td>' : '') +
              '</tr>';
          });
          var carHeader = results.some(function (r) { return r.car_number; }) ? '<th class="col-num">' + t('th.no') + '</th>' : '';
          var statusHeader = results.some(function (r) { return r.status; }) ? '<th>' + t('th.status') + '</th>' : '';
          contentEl.innerHTML =
            '<h4 class="table-section-title">' + esc(t('driver.season_results')) + (season ? ' ' + esc(season) : '') + '</h4>' +
            '<div class="table-wrap"><table class="data-table">' +
            '<thead><tr>' +
            '<th>' + (t('home.series_col') || 'Series') + '</th>' +
            '<th>' + t('th.event') + '</th>' +
            (hasRaceName ? '<th>' + t('th.race_col') + '</th>' : '') +
            '<th class="col-num">' + t('th.pos') + '</th>' +
            '<th class="col-num">' + t('th.pts') + '</th>' +
            carHeader +
            '<th>' + t('section.laps') + '</th>' +
            statusHeader +
            '</tr></thead><tbody>' + tableRows.join('') + '</tbody></table></div>';

          // Merge repeated cells in Series/Event columns
          // for consecutive rows with same event_id.
          var tableEl = contentEl.querySelector('table.data-table');
          if (tableEl && tableEl.tBodies && tableEl.tBodies.length) {
            var tbody = tableEl.tBodies[0];
            var rows = Array.prototype.slice.call(tbody.rows || []);
            if (rows.length > 1) {
              // Columns: 0 = Series, 1 = Event
              function mergeByKey(colIndex, keyFn) {
                var i = 0;
                while (i < rows.length) {
                  var key = keyFn(rows[i]);
                  var start = i;
                  var end = i + 1;
                  while (end < rows.length && keyFn(rows[end]) === key) {
                    end++;
                  }
                  var span = end - start;
                  if (span > 1 && rows[start].cells[colIndex]) {
                    rows[start].cells[colIndex].rowSpan = span;
                    // hide duplicate cells on lower rows
                    for (var k = start + 1; k < end; k++) {
                      if (rows[k].cells[colIndex]) rows[k].cells[colIndex].style.display = 'none';
                    }
                  }
                  i = end;
                }
              }

              mergeByKey(0, function (tr) {
                // Series must merge only within one event
                return (tr.getAttribute('data-series-id') || '') + '|' + (tr.getAttribute('data-event-id') || '');
              });
              mergeByKey(1, function (tr) {
                return tr.getAttribute('data-event-id') || '';
              });
            }
          }
        } else {
          contentEl.innerHTML = '<p class="empty-msg">' + t('driver.no_season_results') + '</p>';
        }
      })
      .catch(function () {
        if (!driverDetailIsCurrent(reqToken)) return;
        var contentEl = document.getElementById('driver-content');
        if (contentEl) contentEl.innerHTML = '<p class="empty-msg">' + (t('error.load_failed') || 'Failed to load. Please try again.') + '</p>';
        revealDriverDetail(reqToken);
      });
    loadedSeriesId = null;
  }
  function renderTeamDetail(slug) {
    renderEntityPage('team', slug, t('coming_soon.team'));
  }
  function renderCrewChiefDetail(slug) {
    renderEntityPage('crew-chief', slug, t('coming_soon.crew_chief'));
  }

  function route() {
    var path = window.location.pathname;
    var search = window.location.search || '';
    if (path !== path.toLowerCase() && (path.indexOf('/series/') === 0 || path.indexOf('/event/') === 0)) {
      history.replaceState(null, '', path.toLowerCase());
      path = path.toLowerCase();
    }
    var seriesList = document.getElementById('series-list');

    if (path === '/' || path === '') {
      // Separate mode: "Full Schedule" button goes to /?full_schedule=1
      if (search.indexOf('full_schedule=1') !== -1) {
        loadedSeriesId = null;
        renderSchedulePage();
        return;
      }
      loadedSeriesId = null;
      document.title = 'The Grid Archive (TGA) — 2026';
      showView('view-list');
      renderList(seriesList);
      return;
    }
    if (path === '/schedule') {
      loadedSeriesId = null;
      renderSchedulePage();
        return;
      }
    if (path === '/search') {
      var params = new URLSearchParams(search || '');
      var q = params.get('q') || '';
      renderSearchPage(q);
      return;
    }
    if (path.indexOf('/event/') === 0) {
      var evRest    = path.slice('/event/'.length);
      var evSlash   = evRest.indexOf('/');
      var evId      = decodeURIComponent(evSlash >= 0 ? evRest.slice(0, evSlash) : evRest);
      var evSection = evSlash >= 0 ? evRest.slice(evSlash + 1).replace(/\/.*$/, '') : '';
      if (evId) { renderEventPage(evId, evSection); return; }
    }
    if (path.indexOf('/track/') === 0) {
      var trackSlug = path.slice('/track/'.length).replace(/\/.*$/, '');
      if (trackSlug) { renderTrackDetail(trackSlug); return; }
    }
    if (path.indexOf('/driver/') === 0) {
      var driverSlug = path.slice('/driver/'.length).replace(/\/.*$/, '');
      // Canonical slug for Hülkenberg:
      // - stored profile uses "nico-h-lkenberg" (ü -> dash)
      // - user-facing URL should use "nico-hulkenberg" (ü -> u)
      // - tables may generate "nicolas-hulkenberg" depending on whether they show "Nico" or "Nicolas"
      var hulkenbergCanonical = null;
      if (driverSlug === 'nico-h-lkenberg' || driverSlug === 'nicolas-hulkenberg' || driverSlug === 'nicolas-h-lkenberg') {
        hulkenbergCanonical = '/driver/nico-hulkenberg';
      }
      if (hulkenbergCanonical && path + search !== hulkenbergCanonical) {
        history.replaceState(null, '', hulkenbergCanonical);
        driverSlug = 'nico-hulkenberg';
      }

      // Canonical slug for Sergio Pérez.
      // DB profile uses "sergio-p-rez" because "é" may turn into '-' during slugification,
      // but user-facing URL should stay "sergio-perez".
      if (driverSlug === 'sergio-p-rez') {
        var perezCanonical = '/driver/sergio-perez';
        if (path + search !== perezCanonical) {
          history.replaceState(null, '', perezCanonical);
          driverSlug = 'sergio-perez';
        }
      }
      if (driverSlug) { renderDriverDetail(driverSlug); return; }
    }
    if (path.indexOf('/team/') === 0) {
      var teamSlug = path.slice('/team/'.length).replace(/\/.*$/, '');
      if (teamSlug) { renderTeamDetail(teamSlug); return; }
    }
    if (path.indexOf('/crew-chief/') === 0) {
      var crewChiefSlug = path.slice('/crew-chief/'.length).replace(/\/.*$/, '');
      if (crewChiefSlug) { renderCrewChiefDetail(crewChiefSlug); return; }
    }
    // F1 season pages: /season/f1-2025, /season/f1-2025/standings, etc. (1950–2025)
    if (path.indexOf('/season/') === 0) {
      var seasonRest = path.slice('/season/'.length);
      var seasonSlash = seasonRest.indexOf('/');
      var seasonSlug = (seasonSlash >= 0 ? seasonRest.slice(0, seasonSlash) : seasonRest).replace(/^\/+|\/+$/g, '');
      var seasonSubPath = seasonSlash >= 0 ? seasonRest.slice(seasonSlash + 1).replace(/\/.*$/, '') : '';
      try { seasonSlug = decodeURIComponent(seasonSlug); } catch (e) {}
      if (seasonSlug && seasonSlug.indexOf('f1-') === 0) {
        renderDetail(seasonSlug, seasonSubPath);
        return;
      }
    }
    if (path.indexOf('/series/') === 0) {
      var rest = path.slice('/series/'.length);
      var slash = rest.indexOf('/');
      var id = (slash >= 0 ? rest.slice(0, slash) : rest).replace(/^\/+|\/+$/g, '');
      try { id = decodeURIComponent(id); } catch (e) {}
      // URL uses hyphens (nascar-cup); code uses underscores (nascar_cup)
      id = id.replace(/-/g, '_');
      if (id === 'nascar_xfinity') id = 'noaps';
      var subPath = slash >= 0 ? rest.slice(slash + 1).replace(/\/.*$/, '') : '';
      // /series/f1 (no subpath) — current season schedule at /season/f1-2026.
      if (id === 'f1' && subPath === '') {
        history.replaceState(null, '', '/season/f1-2026');
        renderDetail('f1-2026', '');
        return;
      }
      // IMSA: /specs maps to same panel as /classes — rewrite URL to /classes
      if (id === 'imsa' && subPath === 'specs') {
        history.replaceState(null, '', '/series/imsa/classes');
        subPath = 'classes';
      }
      if (id) {
        renderDetail(id, subPath);
        return;
      }
    }
    loadedSeriesId = null;
    showView('view-list');
    renderList(seriesList);
  }

  // Initialize static translations (no language switcher)
  translateStaticUI();
  var footerEl = document.getElementById('footer-text');
  if (footerEl) footerEl.textContent = t('footer');

  window.addEventListener('popstate', route);
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) route();
  });
  initHeaderSearch();
  document.addEventListener('click', function (e) {
    var link = e.target && e.target.closest && e.target.closest('a[href]');
    if (!link) return;

    // Respect default browser behavior: new tabs, modifiers, external links.
    if (e.defaultPrevented) return;
    if (e.button && e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (link.target && link.target.toLowerCase() === '_blank') return;
    if (link.hasAttribute('download')) return;

    var href = link.getAttribute('href');
    if (!href || href.charAt(0) !== '/' || href.indexOf('/web/') === 0 || href.indexOf('/api/') === 0) return;

    // Series-nav tabs get the panel fade transition
    if (link.closest('#series-nav') && href.indexOf('/series/') === 0) {
      e.preventDefault();
      var wrap = document.getElementById('detail-panels-wrap');
      if (wrap) {
        wrap.style.height = wrap.offsetHeight + 'px';
        wrap.classList.add('detail-panels-fade-out');
      }
      window.scrollTo(0, 0);
      setTimeout(function () {
        history.pushState(null, '', href);
        route();
        requestAnimationFrame(function () {
          if (wrap) {
            wrap.classList.remove('detail-panels-fade-out');
            requestAnimationFrame(function () { if (wrap) wrap.style.height = ''; });
          }
        });
      }, 180);
      return;
    }

    // All other internal links — plain SPA navigation
    e.preventDefault();
    window.scrollTo(0, 0);
    if (href !== window.location.pathname + window.location.search) {
      history.pushState(null, '', href);
    }
    route();
  });
  route();

  // For NASCAR Cup: DAY column must be based on Daytona 500 only,
  // excluding exhibition Cook Out Clash (NASCAR_CUP_2026_0).
  function rebuildNascarCupDayFromDaytona(baseData) {
    if (!baseData || typeof baseData !== 'object') return Promise.resolve(baseData);
    var raceOrder = Array.isArray(baseData.race_order) ? baseData.race_order.slice() : [];
    if (raceOrder.indexOf('DAY') < 0) return Promise.resolve(baseData);

    var eventId = 'NASCAR_CUP_2026_1'; // Daytona 500
    return fetchJSON('/api/events/' + encodeURIComponent(eventId.toLowerCase()))
      .then(function (d) {
        if (!d || typeof d !== 'object') return baseData;
        if (d.data && typeof d.data === 'object') d = d.data;
        if (d.event && typeof d.event === 'object') d = d.event;
        if (Array.isArray(d) && d.length > 0) d = d[0];

        var rr = d.tables && d.tables.race_results;
        if (!rr || !Array.isArray(rr.headers) || !Array.isArray(rr.rows)) return baseData;

        var headers = rr.headers;
        var posCol = headers.indexOf('Pos');
        var drvCol = headers.indexOf('Driver');
        if (posCol < 0 || drvCol < 0) return baseData;

        var posByDriver = {};
        rr.rows.forEach(function (row) {
          if (!row || posCol >= row.length || drvCol >= row.length) return;
          var drv = String(row[drvCol] || '').trim();
          var pos = String(row[posCol] || '').trim();
          if (!drv) return;
          if (!pos) pos = 'DNQ';
          posByDriver[drv] = pos;
        });

        var rows = Array.isArray(baseData.rows) ? baseData.rows.slice() : [];
        var newRows = rows.map(function (r) {
          if (!r) return r;
          var drvName = driverDisplayName(String(r.driver || '').trim());
          var val = posByDriver[drvName];
          if (!r.races || typeof r.races !== 'object') r.races = {};
          // If driver not in Daytona 500 results — leave existing value
          // (may be DNQ/— from standings DB).
          if (val) {
            r.races.DAY = val;
          }
          return r;
        });

        var out = {};
        for (var k in baseData) if (Object.prototype.hasOwnProperty.call(baseData, k)) out[k] = baseData[k];
        out.rows = newRows;
        return out;
      })
      .catch(function () { return baseData; });
  }

  // ─── F1 static specs fallback (/series/f1/specs + /season/f1-{year}/specs) ─
  function renderF1StaticSpecsIfNeeded() {
    var path = (window.location && window.location.pathname) || '';
    var isSeriesF1Specs = path.indexOf('/series/f1/specs') === 0;
    var seasonSpecsMatch = path.match(/^\/season\/(f1-\d{4})\/specs/);
    if (!isSeriesF1Specs && !seasonSpecsMatch) return;

    var carWrap = document.getElementById('car-spec-wrap');
    var techSpecWrap = document.getElementById('technical-spec-table-wrap');
    if (!carWrap || !techSpecWrap) return;

    carWrap.classList.remove('hidden');
    var carModelsTitle = carWrap.querySelector('h4[data-i18n="specs.car_models"]');
    var techSpecTitle = carWrap.querySelector('h4[data-i18n="specs.tech_spec"]');
    if (carModelsTitle) carModelsTitle.classList.add('hidden');
    if (techSpecTitle) techSpecTitle.classList.add('hidden');

    var seasonYear = seasonSpecsMatch ? seasonSpecsMatch[1].slice(3) : null;
    var specsPanel = document.getElementById('specs-panel');
    if (specsPanel) {
      var specsTitle = specsPanel.querySelector('h3[data-i18n="section.h3.specs"]');
      if (specsTitle) {
        specsTitle.textContent = seasonYear === '2025'
          ? 'Technical regulations 2025'
          : 'Technical regulations 2026';
      }
    }

    var rowsSource = null;
    if (seasonYear === '2025') {
      rowsSource = (window.F1_2025_TECH_SPEC || (window.TGA && window.TGA.F1_2025_TECH_SPEC)) || [];
    } else {
      rowsSource = window.F1_2026_TECH_SPEC || [];
    }
    if (!rowsSource || !rowsSource.length) return;

    var sections = [];
    var curTitle = '';
    var curRows = [];
    rowsSource.forEach(function (s) {
      if ((s.key || '') === '__SECTION__') {
        if (curRows.length > 0) sections.push({ title: curTitle, rows: curRows });
        curTitle = s.value || '';
        curRows = [];
      } else {
        curRows.push(s);
      }
    });
    if (curRows.length > 0) sections.push({ title: curTitle, rows: curRows });

    techSpecWrap.className = 'table-wrap tech-spec-by-section';
    techSpecWrap.innerHTML = sections.map(function (sec) {
      var body = sec.rows.map(function (s) {
        var key = (typeof localizeSpecKey === 'function') ? localizeSpecKey(s.key) : s.key;
        var val = (typeof localizeSpecValue === 'function') ? localizeSpecValue(s.value) : s.value;
        var cellVal = (val || '').indexOf('\n') >= 0
          ? (val || '').split('\n').map(function (p) { return esc(p); }).join('<br>')
          : esc(val || '—');
        return '<tr><td class="col-field">' + esc(key || '—') + '</td>' +
               '<td class="col-spec-value">' + cellVal + '</td></tr>';
      }).join('');
      return '<h4 class="table-section-title">' + esc(sec.title) + '</h4>' +
             '<div class="table-wrap tech-spec-section-table">' +
               '<table class="data-table table-field-value"><tbody>' + body + '</tbody></table>' +
             '</div>';
    }).join('');
  }

  window.addEventListener('load', renderF1StaticSpecsIfNeeded);

})();
