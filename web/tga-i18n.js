(function () {
  'use strict';
  window.TGA = window.TGA || {};
  var state = window.TGA._state;
  var logger = window.TGA.logger;

  var lang = 'en';
  try {
    var stored = typeof localStorage !== 'undefined' && localStorage.getItem('tga-lang');
    if (stored === 'ru' || stored === 'en') lang = stored;
  } catch (e) {}
  function getLang() { return lang; }

  var theme = (function () {
    try {
      var stored = typeof localStorage !== 'undefined' && localStorage.getItem('tga-theme');
      if (stored === 'light' || stored === 'dark') return stored;
    } catch (e) {}
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
    return 'dark';
  })();
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.setAttribute('data-theme', theme);
  }
  var translations = (typeof window !== 'undefined' && window.TGA_TRANSLATIONS) || {};

  function t(key) {
    if (!key) return '';
    var tr = translations[lang] || translations.en || {};
    var val = tr[key];
    if (val !== undefined && val !== null) return val;
    return key;
  }

  function updateLangUI() {
    if (typeof document === 'undefined' || !document.documentElement) return;
    document.querySelectorAll('.lang-opt').forEach(function (opt) {
      opt.classList.toggle('active', opt.dataset.lang === lang);
    });
    var footer = document.getElementById('footer-text');
    if (footer) footer.textContent = t('footer');
    translateStaticUI();
  }

  function updateThemeUI() {
    if (typeof document === 'undefined' || !document.documentElement) return;
    var btn = document.getElementById('themeToggle');
    if (!btn) return;
    var opts = btn.querySelectorAll('.theme-opt');
    for (var i = 0; i < opts.length; i++) {
      opts[i].classList.toggle('active', opts[i].dataset.theme === theme);
    }
    document.documentElement.setAttribute('data-theme', theme || 'dark');
  }

  var timeSettings = (function () {
    try {
      var raw = typeof localStorage !== 'undefined' && localStorage.getItem('tga-time-settings');
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          var fmt = parsed.timeFormat === '12h' ? '12h' : '24h';
          return { timeFormat: fmt };
        }
      }
    } catch (e) {}
    return { timeFormat: '24h' };
  })();
  function getTimeSettings() { return timeSettings; }
  function setTimeSettings(next) {
    timeSettings = {
      timeFormat: next && next.timeFormat === '12h' ? '12h' : '24h'
    };
    try { if (typeof localStorage !== 'undefined') localStorage.setItem('tga-time-settings', JSON.stringify(timeSettings)); } catch (e) {}
    if (state) state.loadedSeriesId = null;
    updateTimeSettingsUI();
  }

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function parseTimeStringToParts(s) {
    if (s == null || typeof s !== 'string') return null;
    var str = s.trim();
    if (!str) return null;
    // NASCAR/Supercars: "2/5/26 02:00" or "2/5/26 6:00 PM"
    var dated = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(.+)$/);
    if (dated) str = dated[4].trim();
    // "14:30" or "14:30–15:00" or "2:30 PM" or "2:30 PM – 4:00 PM"
    var range = str.split(/\s*[–\-]\s*/);
    var first = (range[0] || '').trim();
    var m12 = first.match(/(\d{1,2}):(\d{2})\s*([ap]\.?m\.?|AM|PM)/i);
    if (m12) {
      var h = parseInt(m12[1], 10);
      var ampm = m12[3].replace(/\./g, '').toUpperCase();
      if (ampm === 'PM' && h < 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      return { hour: h, minute: parseInt(m12[2], 10) || 0 };
    }
    var m24 = first.match(/(\d{1,2}):(\d{2})/);
    if (m24) return { hour: parseInt(m24[1], 10), minute: parseInt(m24[2], 10) || 0 };
    return null;
  }

  /** Returns Eastern → UTC offset (hours) for a date: EST = +5, EDT = +4. America/New_York.  */
  function getEasternToUtcOffsetHours(y, m, d) {
    if (typeof Intl === 'undefined' || !Intl.DateTimeFormat) return 5;
    try {
      var utcNoon = Date.UTC(Number(y), Number(m) - 1, Number(d), 12, 0);
      var formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false });
      var parts = formatter.formatToParts(new Date(utcNoon));
      var hourPart = parts.find(function (p) { return p.type === 'hour'; });
      var nyHour = hourPart ? parseInt(hourPart.value, 10) : 7;
      return 12 - nyHour;
    } catch (e) {
      return 5;
    }
  }

  /** Returns UTC timestamp for (y,m,d, hour, minute) in Eastern (America/New_York, with DST).  */
  function estToUtcMs(y, m, d, hour, minute) {
    var offset = getEasternToUtcOffsetHours(y, m, d);
    return Date.UTC(Number(y), Number(m) - 1, Number(d), hour + offset, minute || 0);
  }

  /** UTC timestamp for (y,m,d, hour, minute) in Moscow (UTC+3).  */
  function mskToUtcMs(y, m, d, hour, minute) {
    return Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hour) - 3, minute || 0);
  }

  var EASTERN_TIME_SERIES = {
    NASCAR_CUP: true,
    NOAPS: true,
    NASCAR_XFINITY: true,
    NASCAR_TRUCK: true,
    ARCA: true,
    NASCAR_MODIFIED: true,
    INDYCAR: true
  };

  var MSK_LOCAL_TRACK_SERIES = {
    F1: true,
    F2: true,
    F3: true,
    FREC: true,
    F4_IT: true,
    SMP_F4_RU: true,
    PSC: true,
    DTM: true,
    SUPER_FORMULA: true
  };

  function scheduleSeriesUpper(e) {
    return String((e && (e._seriesId || e.series_id)) || '').toUpperCase();
  }

  /** Local calendar race date (weekend), not shifted to MSK midnight.  */
  function getEventScheduleLocalDate(e) {
    return String((e && (e.start_date || e.date)) || '').slice(0, 10);
  }

  /**
   * Parses time_msk: "07:00", "1:30 a.m.", "2/5/26 02:00".
   * localDateIso — local race date (start_date) for time-only MSK.
   */
  function parseMskDateTime(mskRaw, localDateIso) {
    var empty = { timeStr: '', mskDateIso: '', utcMs: 0, hasEmbeddedDate: false };
    if (mskRaw == null) return empty;
    var str = String(mskRaw).trim();
    if (!str || /^tbd$/i.test(str) || /^#value!$/i.test(str) || str === '—') return empty;

    var dated = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(.+)$/);
    if (dated) {
      var mo = parseInt(dated[1], 10);
      var da = parseInt(dated[2], 10);
      var yr = parseInt(dated[3], 10);
      if (yr < 100) yr += 2000;
      var parts = parseTimeStringToParts(dated[4]);
      if (!parts) return empty;
      var mskIso = yr + '-' + pad2(mo) + '-' + pad2(da);
      return {
        timeStr: pad2(parts.hour) + ':' + pad2(parts.minute),
        mskDateIso: mskIso,
        utcMs: mskToUtcMs(yr, mo, da, parts.hour, parts.minute),
        hasEmbeddedDate: true
      };
    }

    var parts = parseTimeStringToParts(str);
    if (!parts || !localDateIso) {
      return { timeStr: str, mskDateIso: localDateIso || '', utcMs: 0, hasEmbeddedDate: false };
    }
    var y = parseInt(localDateIso.slice(0, 4), 10);
    var m = parseInt(localDateIso.slice(5, 7), 10);
    var d = parseInt(localDateIso.slice(8, 10), 10);
    if (!y || !m || !d) return empty;
    return {
      timeStr: pad2(parts.hour) + ':' + pad2(parts.minute),
      mskDateIso: localDateIso,
      utcMs: mskToUtcMs(y, m, d, parts.hour, parts.minute),
      hasEmbeddedDate: false
    };
  }

  function computeEventRaceUtcMs(e, localDs, mskParsed) {
    if (!localDs) return 0;
    var sid = scheduleSeriesUpper(e);
    var estRaw = String(e.time_est || e.timeEst || e.time_et || '').trim();
    mskParsed = mskParsed || parseMskDateTime(e.time_msk, localDs);

    if (mskParsed.hasEmbeddedDate && mskParsed.utcMs) {
      return mskParsed.utcMs;
    }

    if (EASTERN_TIME_SERIES[sid] && estRaw && !/^tbd$/i.test(estRaw)) {
      var ep = parseTimeStringToParts(estRaw);
      if (ep) {
        return estToUtcMs(
          parseInt(localDs.slice(0, 4), 10),
          parseInt(localDs.slice(5, 7), 10),
          parseInt(localDs.slice(8, 10), 10),
          ep.hour,
          ep.minute
        );
      }
    }

    if (MSK_LOCAL_TRACK_SERIES[sid] && mskParsed.utcMs) {
      return mskParsed.utcMs;
    }

    if (mskParsed.timeStr) {
      var mp = parseTimeStringToParts(mskParsed.timeStr);
      if (mp) {
        var dayOffset = 0;
        if (estRaw) {
          var ep2 = parseTimeStringToParts(estRaw);
          if (ep2 && ep2.hour >= 17 && mp.hour < 12) dayOffset = 1;
        }
        return mskToUtcMs(
          parseInt(localDs.slice(0, 4), 10),
          parseInt(localDs.slice(5, 7), 10),
          parseInt(localDs.slice(8, 10), 10) + dayOffset,
          mp.hour,
          mp.minute
        );
      }
    }

    if (estRaw) {
      var ep3 = parseTimeStringToParts(estRaw);
      if (ep3) {
        return estToUtcMs(
          parseInt(localDs.slice(0, 4), 10),
          parseInt(localDs.slice(5, 7), 10),
          parseInt(localDs.slice(8, 10), 10),
          ep3.hour,
          ep3.minute
        );
      }
    }

    return 0;
  }

  /** UTC race start moment for sorting / timers.  */
  function getEventRaceUtcMs(e) {
    if (!e) return 0;
    if (e._raceUtcMs) return e._raceUtcMs;
    var localDs = getEventScheduleLocalDate(e);
    return computeEventRaceUtcMs(e, localDs, parseMskDateTime(e.time_msk, localDs));
  }

  /** Normalizes event: time_msk → HH:MM, _raceUtcMs, local date for grouping.  */
  function normalizeScheduleEvent(e) {
    if (!e || typeof e !== 'object') return e;
    var localDs = getEventScheduleLocalDate(e);
    var mskParsed = parseMskDateTime(e.time_msk, localDs);
    e._scheduleDate = localDs;
    e._raceUtcMs = computeEventRaceUtcMs(e, localDs, mskParsed);
    if (mskParsed.timeStr) e.time_msk = mskParsed.timeStr;
    return e;
  }

  /** Race start time in user timezone (from UTC moment).  */
  function formatRaceUtcForDisplay(utcMs) {
    if (!utcMs || typeof Intl === 'undefined' || !Intl.DateTimeFormat) return '';
    var settings = getTimeSettings();
    var df = new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: settings && settings.timeFormat === '12h'
    });
    return df.format(new Date(utcMs)) || '';
  }

  /** Start time in MSK (HH:MM) for display.  */
  function formatMskTimeForDisplay(mskRaw, localDateIso) {
    var parsed = parseMskDateTime(mskRaw, localDateIso);
    if (parsed.timeStr) {
      return formatTimeForDisplay(parsed.timeStr) || parsed.timeStr;
    }
    return formatTimeForDisplay(mskRaw) || mskRaw || '';
  }

  function formatTimeForDisplay(raw) {
    if (raw == null || typeof raw !== 'string') return '';
    var str = raw.trim();
    if (!str) return '';
    var parts = parseTimeStringToParts(str);
    if (!parts || typeof Intl === 'undefined' || !Intl.DateTimeFormat) return str;
    var settings = getTimeSettings();
    var hour12 = settings && settings.timeFormat === '12h';
    var df = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', hour12: hour12 });
    var d = new Date();
    d.setHours(parts.hour, parts.minute || 0, 0, 0);
    return df.format(d);
  }

  function updateTimeSettingsUI() {
    if (typeof document === 'undefined') return;
    var s = getTimeSettings();
    ['time-format-select', 'time-format-select-detail'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && s.timeFormat) el.value = s.timeFormat;
    });
  }

  // ─── trimTrailingZeros (defined before localizeStatValue which uses it) ───
  function trimTrailingZeros(s) {
    if (s == null) return '';
    var v = String(s).trim();
    if (!/^\d/.test(v)) return v;
    v = v.replace(/(\.\d*?)0+$/, '$1');
    v = v.replace(/\.$/, '');
    return v;
  }

  function localizeStatKey(k) {
    if (k == null) return '';
    var key = String(k).toLowerCase().trim();
    var ru = (typeof window !== 'undefined' && window.TGA_RU && window.TGA_RU.raceStatKeysRu) || {};
    return (lang === 'ru' && ru[key]) ? ru[key] : String(k).trim();
  }

  function pluralRu(n, a, b, c) {
    var num = Math.abs(Number(n));
    if (isNaN(num)) return c;
    var mod10 = num % 10, mod100 = num % 100;
    if (mod10 === 1 && mod100 !== 11) return a;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return b;
    return c;
  }

  function localizeStatValue(v) {
    if (v == null) return '';
    var val = String(v).trim();
    if (lang !== 'ru') return trimTrailingZeros(val);
    val = trimTrailingZeros(val);
    val = val.replace(/\bmph\b/gi, 'миль/ч');
    val = val.replace(/\bkm\/h\b/gi, 'км/ч');
    val = val.replace(/\bkm\/hr\b/gi, 'км/ч');
    val = val.replace(/\blaps\b/gi, 'кругов');
    val = val.replace(/\bcaution\b/gi, 'SC');
    val = val.replace(/\bcautions\b/gi, 'машины безопасности');
    val = val.replace(/\bred flag(s?)\b/gi, 'красн$1 флаг$1');
    val = val.replace(/\bminutes\b/gi, 'минут');
    val = val.replace(/\bseconds\b/gi, 'секунд');
    val = val.replace(/\bhours\b/gi, 'часов');
    val = val.replace(/\bdegree(s?)\b/gi, 'градус$1');
    val = val.replace(/\b°\s*F\b/gi, '°F');
    val = val.replace(/\b°\s*C\b/gi, '°C');
    return val;
  }

  var specKeySkip = Object.create ? Object.create(null) : {};
  function normalizeSpecKey(k) {
    if (k == null) return '';
    return String(k).toLowerCase().trim().replace(/\s*\/\s*/g, ' / ');
  }
  var specKeyRu = (typeof window !== 'undefined' && window.TGA_RU && window.TGA_RU.specKeyRu) || {};
  function localizeSpecKey(k) {
    if (k == null) return '';
    var key = normalizeSpecKey(k);
    return (lang === 'ru' && specKeyRu[key]) ? specKeyRu[key] : String(k).trim();
  }

  function localizeSpecValue(v) {
    if (v == null) return '';
    var val = String(v).trim();
    if (lang !== 'ru') return val;
    val = val.replace(/\bhp\b/gi, 'л.с.');
    val = val.replace(/\bkW\b/g, 'кВт');
    val = val.replace(/\bmm\b/gi, 'мм');
    val = val.replace(/\bcm\b/gi, 'см');
    val = val.replace(/\bkg\b/gi, 'кг');
    val = val.replace(/\blb\b/gi, 'фунт.');
    val = val.replace(/\bft\b/gi, 'фут');
    val = val.replace(/\bin\b/gi, 'дюйм');
    val = val.replace(/\bmph\b/gi, 'миль/ч');
    val = val.replace(/\bkm\/h\b/gi, 'км/ч');
    val = val.replace(/\brpm\b/gi, 'об/мин');
    val = val.replace(/\bN⋅m\b/g, 'Н⋅м');
    val = val.replace(/\bNm\b/g, 'Н⋅м');
    val = val.replace(/\bpsi\b/gi, 'psi');
    val = val.replace(/\bbar\b/gi, 'бар');
    val = val.replace(/\bl\b/gi, 'л');
    val = val.replace(/\bgal\b/gi, 'гал');
    val = val.replace(/\bdegrees?\b/gi, 'град.');
    return val;
  }

  var tableHeaderRu = (typeof window !== 'undefined' && window.TGA_RU && window.TGA_RU.tableHeaderRu) || {};
  var carNumHeaders = ['car', 'car #', '#', 'no.', 'no'];

  function findCarNumberColumn(headers) {
    if (!Array.isArray(headers)) return -1;
    for (var i = 0; i < headers.length; i++) {
      var h = (headers[i] != null ? String(headers[i]) : '').toLowerCase().trim();
      for (var j = 0; j < carNumHeaders.length; j++) {
        if (h === carNumHeaders[j]) return i;
      }
    }
    return -1;
  }

  function localizeTableHeader(h) {
    if (h == null) return '';
    var key = String(h).toLowerCase().trim();
    if (lang === 'ru' && tableHeaderRu[key]) return tableHeaderRu[key];
    if (lang === 'ru' && logger && typeof logger.warn === 'function' && !tableHeaderRu[key] && key.length > 0) {
      logger.warn('Missing tableHeaderRu for: "' + key + '"');
    }
    return String(h).trim();
  }

  var cellNotesRu = (typeof window !== 'undefined' && window.TGA_RU && window.TGA_RU.cellNotesRu) || {};
  function localizeCellNote(v) {
    if (v == null) return '';
    var key = String(v).toLowerCase().trim();
    return (lang === 'ru' && cellNotesRu[key]) ? cellNotesRu[key] : String(v).trim();
  }

  var raceReasonParts = (typeof window !== 'undefined' && window.TGA_RU && window.TGA_RU.raceReasonParts) || [];
  function localizeRaceReason(v) {
    if (v == null) return '';
    var text = String(v).trim();
    if (lang !== 'ru' || !raceReasonParts.length) return text;
    for (var i = 0; i < raceReasonParts.length; i++) {
      var pair = raceReasonParts[i];
      if (Array.isArray(pair) && pair[0] && pair[1]) text = text.replace(pair[0], pair[1]);
    }
    return text;
  }

  var translateValueHeaders = ['value'];
  var translateReasonHeaders = ['reason'];

  function localizeDate(s) {
    if (s == null || typeof s !== 'string') return '';
    var str = s.trim();
    if (!str) return '';

    // Try parsing ISO date like "2025-04-06"
    var isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      var year = parseInt(isoMatch[1], 10);
      var monthIdx = parseInt(isoMatch[2], 10) - 1; // 0-based
      var day = parseInt(isoMatch[3], 10);
      var monthsEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      var monthsRu = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
      if (monthIdx >= 0 && monthIdx < 12) {
        if (lang === 'ru') {
          return day + ' ' + monthsRu[monthIdx] + ' ' + year;
        }
        // Default format for event pages: "16 March 2025"
        return day + ' ' + monthsEn[monthIdx] + ' ' + year;
      }
    }

    // For already human-readable dates, keep previous behavior:
    if (lang !== 'ru') return str;
    var monthsRu2 = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    var monthsEn2 = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    for (var i = 0; i < 12; i++) {
      str = str.replace(new RegExp(monthsEn2[i], 'gi'), monthsRu2[i]);
    }
    return str;
  }

  var degRu = { '°': '°', 'degrees': 'градусы', 'degree': 'градус' };
  function localizeEventPreview(s) {
    if (s == null || typeof s !== 'string') return '';
    var str = s.trim();
    if (lang !== 'ru') return str;
    str = str.replace(/\bTurn\s+(\d+)\b/gi, 'Поворот $1');
    str = str.replace(/\bDegrees?\b/gi, 'градусов');
    str = str.replace(/\bdegrees?\b/gi, 'градусов');
    str = str.replace(/\bmiles?\b/gi, 'миль');
    str = str.replace(/\bkm\b/gi, 'км');
    return str;
  }

  function localizeDistance(s) {
    if (s == null) return '';
    var v = String(s).trim();
    if (lang !== 'ru') return trimTrailingZeros(v);
    v = trimTrailingZeros(v);
    v = v.replace(/\bmi\b/gi, 'миль');
    v = v.replace(/\bkm\b/gi, 'км');
    v = v.replace(/\bmiles?\b/gi, 'миль');
    return v;
  }

  function translateStaticUI() {
    if (typeof document === 'undefined') return;
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var key = el.getAttribute('data-i18n');
      if (key) el.textContent = t(key);
    }
  }

  function setLang(newLang) {
    if (lang === newLang) return;
    if (newLang === 'ru' || newLang === 'en') lang = newLang;
    try { localStorage.setItem('tga-lang', lang); } catch (e) {}
    if (state) {
      state.eventCache = {};
      state.loadedSeriesId = null;
    }
    var sl = typeof document !== 'undefined' && document.getElementById('series-list');
    if (sl) sl._listLoaded = false;
    updateLangUI();
    translateStaticUI();
    if (typeof window !== 'undefined' && window.TGA && typeof window.TGA.route === 'function') {
      window.TGA.route();
    }
  }

  function setTheme(newTheme) {
    if (newTheme !== 'light' && newTheme !== 'dark') newTheme = 'dark';
    if (theme === newTheme) return;
    theme = newTheme;
    try { if (typeof localStorage !== 'undefined') localStorage.setItem('tga-theme', theme); } catch (e) {}
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('data-theme', theme);
    }
    updateThemeUI();
  }

  window.TGA.getLang = getLang;
  window.TGA.t = t;
  window.TGA.setLang = setLang;
  window.TGA.setTheme = setTheme;
  window.TGA.updateLangUI = updateLangUI;
  window.TGA.updateThemeUI = updateThemeUI;
  window.TGA.translateStaticUI = translateStaticUI;
  window.TGA.getTimeSettings = getTimeSettings;
  window.TGA.setTimeSettings = setTimeSettings;
  window.TGA.formatTimeForDisplay = formatTimeForDisplay;
  window.TGA.parseTimeStringToParts = parseTimeStringToParts;
  window.TGA.estToUtcMs = estToUtcMs;
  window.TGA.mskToUtcMs = mskToUtcMs;
  window.TGA.parseMskDateTime = parseMskDateTime;
  window.TGA.getEventScheduleLocalDate = getEventScheduleLocalDate;
  window.TGA.getEventRaceUtcMs = getEventRaceUtcMs;
  window.TGA.normalizeScheduleEvent = normalizeScheduleEvent;
  window.TGA.scheduleSeriesUpper = scheduleSeriesUpper;
  window.TGA.formatRaceUtcForDisplay = formatRaceUtcForDisplay;
  window.TGA.formatMskTimeForDisplay = formatMskTimeForDisplay;
  window.TGA.updateTimeSettingsUI = updateTimeSettingsUI;
  window.TGA.findCarNumberColumn = findCarNumberColumn;
  window.TGA.localizeTableHeader = localizeTableHeader;
  window.TGA.localizeCellNote = localizeCellNote;
  window.TGA.localizeRaceReason = localizeRaceReason;
  window.TGA.translateValueHeaders = translateValueHeaders;
  window.TGA.translateReasonHeaders = translateReasonHeaders;
  window.TGA.localizeStatKey = localizeStatKey;
  window.TGA.localizeStatValue = localizeStatValue;
  window.TGA.localizeSpecKey = localizeSpecKey;
  window.TGA.localizeSpecValue = localizeSpecValue;
  window.TGA.normalizeSpecKey = normalizeSpecKey;
  window.TGA.specKeySkip = specKeySkip;
  window.TGA.localizeDate = localizeDate;
  window.TGA.localizeDistance = localizeDistance;
  window.TGA.localizeEventPreview = localizeEventPreview;
  window.TGA.trimTrailingZeros = trimTrailingZeros;
  window.TGA.pluralRu = pluralRu;
})();
