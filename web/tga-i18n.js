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
    if (lang !== 'en') {
      var enTr = translations.en || {};
      val = enTr[key];
      if (val !== undefined && val !== null) return val;
    }
    return key;
  }

  function updateLangUI() {
    if (typeof document === 'undefined' || !document.documentElement) return;
    document.documentElement.lang = lang;
    document.querySelectorAll('.lang-opt').forEach(function (opt) {
      var active = opt.dataset.lang === lang;
      opt.classList.toggle('active', active);
      if (opt.tagName === 'BUTTON') {
        opt.setAttribute('aria-pressed', active ? 'true' : 'false');
      }
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
    var key = String(k).toLowerCase().trim().replace(/\s*\/\s*/g, ' / ');
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

  function unitLabelRu(n, one, few, many) {
    return String(n) + ' ' + pluralRu(Number(n), one, few, many);
  }

  function joinRuList(parts) {
    if (!parts.length) return '';
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return parts[0] + ' и ' + parts[1];
    return parts.slice(0, -1).join(', ') + ' и ' + parts[parts.length - 1];
  }

  function formatDurationRu(hours, minutes, seconds) {
    var parts = [];
    if (hours > 0) parts.push(unitLabelRu(hours, 'час', 'часа', 'часов'));
    if (minutes > 0) parts.push(unitLabelRu(minutes, 'минута', 'минуты', 'минут'));
    if (seconds > 0) parts.push(unitLabelRu(seconds, 'секунда', 'секунды', 'секунд'));
    return joinRuList(parts);
  }

  function localizeRaceTimeRu(val) {
    var hm = val.match(/^(\d+):(\d{1,2}):(\d{1,2})$/);
    if (hm) return formatDurationRu(parseInt(hm[1], 10), parseInt(hm[2], 10), parseInt(hm[3], 10));

    var onlyMinSec = val.match(/^(\d+)\s+minutes?\s*(?:,?\s*and\s*)?(\d+)\s+seconds?$/i);
    if (onlyMinSec) return formatDurationRu(0, parseInt(onlyMinSec[1], 10), parseInt(onlyMinSec[2], 10));

    var hms = val.match(/^(\d+)\s+hours?,?\s*(\d+)\s+minutes?,?\s*(?:,?\s*and\s*)?(\d+)\s+seconds?$/i);
    if (hms) return formatDurationRu(parseInt(hms[1], 10), parseInt(hms[2], 10), parseInt(hms[3], 10));

    var hmSing = val.match(/^(\d+)\s+hour,?\s*(\d+)\s+minutes?,?\s*(?:,?\s*and\s*)?(\d+)\s+seconds?$/i);
    if (hmSing) return formatDurationRu(parseInt(hmSing[1], 10), parseInt(hmSing[2], 10), parseInt(hmSing[3], 10));

    var minSing = val.match(/^(\d+)\s+hours?,?\s*(\d+)\s+minute\s*(?:,?\s*and\s*)?(\d+)\s+seconds?$/i);
    if (minSing) return formatDurationRu(parseInt(minSing[1], 10), parseInt(minSing[2], 10), parseInt(minSing[3], 10));

    return null;
  }

  function localizeStructuredStatValue(val) {
    var timeRu = localizeRaceTimeRu(val);
    if (timeRu) return timeRu;

    var speed = val.match(/^([\d.]+)\s+miles\s+per\s+hour\s*\(([\d.]+)\s*km\/h\)$/i);
    if (speed) return speed[1] + ' миль/ч (' + speed[2] + ' км/ч)';

    var mphOnly = val.match(/^([\d.]+)\s*mph$/i);
    if (mphOnly) return mphOnly[1] + ' миль/ч';

    var cautions = val.match(/^(\d+)\s+for\s+(\d+)(?:\s+laps)?$/i);
    if (cautions) {
      var lapN = parseInt(cautions[2], 10);
      return cautions[1] + ' за ' + lapN + ' ' + pluralRu(lapN, 'круг', 'круга', 'кругов');
    }

    var leaders = val.match(/^(\d+)\s+among\s+(\d+)\s+different\s+drivers?$/i);
    if (leaders) {
      var drvN = parseInt(leaders[2], 10);
      return leaders[1] + ' у ' + drvN + ' разных ' + pluralRu(drvN, 'пилота', 'пилотов', 'пилотов');
    }

    var margin = val.match(/^([\d.]+)\s+sec(?:onds?)?\.?$/i);
    if (margin) return margin[1] + ' сек.';

    return null;
  }

  function normalizePreviewKey(s) {
    return String(s).trim().toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[\u201c\u201d]/g, '"');
  }

  var eventPreviewExact = (typeof window !== 'undefined' && window.TGA_RU && window.TGA_RU.eventPreviewExact) || {};
  var eventPreviewParts = (typeof window !== 'undefined' && window.TGA_RU && window.TGA_RU.eventPreviewParts) || [];

  function localizeStatValue(v) {
    if (v == null) return '';
    var val = String(v).trim();
    if (lang !== 'ru') return trimTrailingZeros(val);
    val = trimTrailingZeros(val);
    var structured = localizeStructuredStatValue(val);
    if (structured != null) return structured;
    val = applyRuPhraseParts(val, statValueParts);
    val = localizeSpecUnits(val);
    val = val.replace(/\bmiles\s+per\s+hour\b/gi, 'миль/ч');
    val = val.replace(/\blaps\b/gi, 'кругов');
    val = val.replace(/\bcaution\b/gi, 'SC');
    val = val.replace(/\bcautions\b/gi, 'машины безопасности');
    val = val.replace(/\bred flags\b/gi, 'красные флаги');
    val = val.replace(/\bred flag\b/gi, 'красный флаг');
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
  var specKeyParts = (typeof window !== 'undefined' && window.TGA_RU && window.TGA_RU.specKeyParts) || [];
  var specSectionRu = (typeof window !== 'undefined' && window.TGA_RU && window.TGA_RU.specSectionRu) || {};
  function localizeSpecKey(k) {
    if (k == null) return '';
    var key = normalizeSpecKey(k);
    if (lang === 'ru' && specKeyRu[key]) return specKeyRu[key];
    if (lang === 'ru' && specKeyParts.length) {
      var text = String(k).trim();
      for (var i = 0; i < specKeyParts.length; i++) {
        var pair = specKeyParts[i];
        if (Array.isArray(pair) && pair[0] && pair[1] != null) {
          text = text.replace(pair[0], pair[1]);
        }
      }
      if (text !== String(k).trim()) return text;
    }
    return String(k).trim();
  }

  function localizeSpecSection(title) {
    if (title == null) return '';
    var text = String(title).trim();
    if (!text || lang !== 'ru') return text;
    var key = text.toLowerCase();
    return specSectionRu[key] || text;
  }

  function applyRuPhraseParts(text, parts) {
    if (!text || !parts || !parts.length) return text;
    for (var i = 0; i < parts.length; i++) {
      var pair = parts[i];
      if (Array.isArray(pair) && pair[0] && pair[1] != null) {
        text = text.replace(pair[0], pair[1]);
      }
    }
    return text;
  }

  var specValueExact = (typeof window !== 'undefined' && window.TGA_RU && window.TGA_RU.specValueExact) || {};
  var specValueParts = (typeof window !== 'undefined' && window.TGA_RU && window.TGA_RU.specValueParts) || [];
  var statValueParts = (typeof window !== 'undefined' && window.TGA_RU && window.TGA_RU.statValueParts) || [];

  function localizeSpecUnits(val) {
    val = val.replace(/(\d+(?:[.,]\d+)?)\s*L\b/g, '$1 л');
    val = val.replace(/\bcu\.?\s*in\.?\b/gi, 'куб. дюйм');
    val = val.replace(/\bhp\b/gi, 'л.с.');
    val = val.replace(/\bbhp\b/gi, 'л.с.');
    val = val.replace(/\bhorsepower\b/gi, 'л.с.');
    val = val.replace(/\bkW\b/g, 'кВт');
    val = val.replace(/\bkilowatts?\b/gi, 'кВт');
    val = val.replace(/\bmm\b/gi, 'мм');
    val = val.replace(/\bcm\b/gi, 'см');
    val = val.replace(/\bkg\b/gi, 'кг');
    val = val.replace(/\blb\b/gi, 'фунт.');
    val = val.replace(/\bft\b/gi, 'фут');
    val = val.replace(/\bin\b/gi, 'дюйм');
    val = val.replace(/\bmph\b/gi, 'миль/ч');
    val = val.replace(/\bkm\/h\b/gi, 'км/ч');
    val = val.replace(/\bkm\/hr\b/gi, 'км/ч');
    val = val.replace(/\brpm\b/gi, 'об/мин');
    val = val.replace(/\bN⋅m\b/g, 'Н⋅м');
    val = val.replace(/\bNm\b/g, 'Н⋅м');
    val = val.replace(/\bnewton-metres?\b/gi, 'Н⋅м');
    val = val.replace(/\bpound force-feet\b/gi, 'фунт·фут');
    val = val.replace(/\bft⋅lbf\b/gi, 'фунт·фут');
    val = val.replace(/\bft·lb\b/gi, 'фунт·фут');
    val = val.replace(/\bpsi\b/gi, 'psi');
    val = val.replace(/\bbar\b/gi, 'бар');
    val = val.replace(/\bgal\b/gi, 'гал');
    val = val.replace(/\bUS gal\b/gi, 'гал (США)');
    val = val.replace(/\bdegrees?\b/gi, 'град.');
    val = val.replace(/\bcubic centimetres?\b/gi, 'см³');
    val = val.replace(/\bcubic inches?\b/gi, 'куб. дюйм');
    return val;
  }

  function localizeSpecValue(v) {
    if (v == null) return '';
    var val = String(v).trim();
    if (lang !== 'ru') return val;
    var exactKey = val.toLowerCase().replace(/\s+/g, ' ');
    if (specValueExact[exactKey]) return specValueExact[exactKey];
    val = applyRuPhraseParts(val, specValueParts);
    val = localizeSpecUnits(val);
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
    if (typeof h === 'function') return '';
    var raw = String(h).trim();
    var key = raw.toLowerCase();
    if (lang === 'ru' && key === 'car' && raw === 'Car') return t('th.car');
    if (lang === 'ru' && Object.prototype.hasOwnProperty.call(tableHeaderRu, key)) {
      return tableHeaderRu[key];
    }
    if (lang === 'ru' && logger && typeof logger.warn === 'function' && key.length > 0) {
      logger.warn('Missing tableHeaderRu for: "' + key + '"');
    }
    return raw;
  }

  var cellNotesRu = (typeof window !== 'undefined' && window.TGA_RU && window.TGA_RU.cellNotesRu) || {};
  function localizeCellNote(v) {
    if (v == null) return '';
    var key = String(v).toLowerCase().trim();
    return (lang === 'ru' && cellNotesRu[key]) ? cellNotesRu[key] : String(v).trim();
  }

  function localizeRaceReason(v) {
    if (v == null) return '';
    var text = String(v).trim();
    if (!text || lang !== 'ru') return text;
    var exact = (typeof window !== 'undefined' && window.TGA_RU && window.TGA_RU.raceReasonExact) || {};
    var exactKey = text.toLowerCase();
    if (exact[exactKey]) return exact[exactKey];
    var parts = (typeof window !== 'undefined' && window.TGA_RU && window.TGA_RU.raceReasonParts) || [];
    for (var i = 0; i < parts.length; i++) {
      var pair = parts[i];
      if (Array.isArray(pair) && pair[0] && pair[1] != null) text = text.replace(pair[0], pair[1]);
    }
    text = text.replace(/\band\b/gi, 'и');
    text = text.replace(/\[red flag:\s*([^\]]+)\]/gi, function (_m, inner) {
      var ru = String(inner)
        .replace(/\blaps\b/gi, 'кругов')
        .replace(/\blap\b/gi, 'круг');
      return '[красный флаг: ' + ru + ']';
    });
    return text.trim();
  }

  function localizeCautionFlagLabel(text, isCautionPeriod) {
    if (lang !== 'ru') {
      var en = (text != null ? String(text).trim() : '');
      if (en) return en;
      return isCautionPeriod ? 'Caution' : 'Green flag';
    }
    var raw = (text != null ? String(text).trim() : '');
    if (raw) {
      var lk = raw.toLowerCase();
      if (lk === 'green' || lk === 'green flag') return t('caution.green_flag');
      if (lk === 'caution' || lk === 'yellow' || lk === 'yellow flag' || lk === 'sc') return t('caution.yellow');
      return raw;
    }
    return isCautionPeriod ? t('caution.yellow') : t('caution.green_flag');
  }

  var translateValueHeaders = ['value'];
  var translateReasonHeaders = ['reason', 'причина'];
  var translateFreePassHeaders = ['free pass'];

  function localizeFreePass(v) {
    if (v == null) return '';
    var text = String(v).trim();
    if (!text || lang !== 'ru') return text;
    if (/^none$/i.test(text)) return 'никто';
    return text;
  }

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

  var countryNameRu = (typeof window !== 'undefined' && window.TGA_RU && window.TGA_RU.countryNameRu) || {};
  var countryIsoRu = (typeof window !== 'undefined' && window.TGA_RU && window.TGA_RU.countryIsoRu) || {};

  function localizeCountryName(name) {
    if (name == null) return '';
    var val = String(name).trim();
    if (!val || lang !== 'ru') return val;
    if (/^[A-Za-z]{2}$/.test(val)) {
      var isoRu = countryIsoRu[val.toUpperCase()];
      if (isoRu) return isoRu;
    }
    var key = val.toLowerCase();
    return countryNameRu[key] || val;
  }

  function localizeBirthPlace(place) {
    return localizeCompoundPlace(place);
  }

  var seriesNameRu = (typeof window !== 'undefined' && window.TGA_RU && window.TGA_RU.seriesNameRu) || {};
  var grandPrixLocationRu = (typeof window !== 'undefined' && window.TGA_RU && window.TGA_RU.grandPrixLocationRu) || {};
  var eventNameRu = (typeof window !== 'undefined' && window.TGA_RU && window.TGA_RU.eventNameRu) || {};
  var driverStatusRu = (typeof window !== 'undefined' && window.TGA_RU && window.TGA_RU.driverStatusRu) || {};

  function localizeSeriesName(name, seriesId) {
    if (lang !== 'ru') return (name || seriesId || '').trim();
    var sid = (seriesId != null ? String(seriesId) : '').toLowerCase().trim();
    if (sid && seriesNameRu[sid]) return seriesNameRu[sid];
    var key = (name != null ? String(name) : '').toLowerCase().trim();
    if (key && seriesNameRu[key]) return seriesNameRu[key];
    return (name || seriesId || '').trim();
  }

  function localizeEventName(name) {
    if (name == null) return '';
    var s = String(name).trim();
    if (!s || lang !== 'ru') return s;
    var exactKey = s.toLowerCase();
    if (eventNameRu[exactKey]) return eventNameRu[exactKey];
    var gpSuffix = s.match(/^(.+?)\s+Grand\s+Prix$/i);
    if (gpSuffix) {
      var locKey = gpSuffix[1].toLowerCase().trim();
      var loc = grandPrixLocationRu[locKey] || gpSuffix[1];
      return 'Гран-при ' + loc;
    }
    var gpOf = s.match(/^Grand\s+Prix\s+of\s+(.+)$/i);
    if (gpOf) return 'Гран-при ' + gpOf[1].trim();
    return s;
  }

  function localizeEventFromData(d) {
    if (!d) return '';
    if (lang === 'ru') {
      var ruName = d.name_ru || d.event_name_ru;
      if (ruName != null && String(ruName).trim() !== '') return String(ruName).trim();
    }
    var name = (d.name != null && String(d.name).trim() !== '')
      ? String(d.name).trim()
      : ((d.race != null && String(d.race).trim() !== '') ? String(d.race).trim() : '');
    return localizeEventName(name);
  }

  var racingClassKeys = {
    'hypercar': 'class.hypercar',
    'lmgt3': 'class.lmgt3',
    'lmp2': 'class.lmp2',
    'lmp2 pro/am': 'class.lmp2_pro_am',
    'lmp3': 'class.lmp3',
    'gtp': 'class.gtp',
    'gtd pro': 'class.gtd_pro',
    'gtd': 'class.gtd',
    'pro': 'class.gtwce_pro',
    'gold': 'class.gtwce_gold',
    'silver': 'class.gtwce_silver',
    'bronze': 'class.gtwce_bronze'
  };

  function localizeRacingClass(label) {
    if (label == null) return '';
    var val = String(label).trim();
    if (!val || lang !== 'ru') return val;
    var key = racingClassKeys[val.toLowerCase()];
    return key ? t(key) : val;
  }

  var teamNameRu = (typeof window !== 'undefined' && window.TGA_RU && window.TGA_RU.teamNameRu) || {};
  function localizeTeamName(name) {
    if (name == null) return '';
    var val = String(name).trim();
    if (!val || lang !== 'ru') return val;
    var map = (typeof window !== 'undefined' && window.TGA_RU && window.TGA_RU.teamNameRu) || teamNameRu;
    var ru = map[val.toLowerCase()];
    return ru != null ? ru : val;
  }

  function localizeImsaScheduleLength(length) {
    if (length == null) return '—';
    var raw = String(length).trim();
    if (!raw || lang !== 'ru') return raw || '—';
    var hm = raw.match(/^(\d+)\s+hours?$/i);
    if (hm) return t('schedule.hours').replace('{n}', hm[1]);
    var mm = raw.match(/^(\d+)\s+minutes?$/i);
    if (mm) return t('schedule.minutes').replace('{n}', mm[1]);
    return raw;
  }

  function localizeImsaScheduleClasses(classes) {
    if (classes == null) return '—';
    var raw = String(classes).trim();
    if (!raw || lang !== 'ru') return raw || '—';
    if (/^all$/i.test(raw)) return t('schedule.classes_all');
    return raw.split(/\s*,\s*/).map(function (part) {
      return localizeRacingClass(part.trim());
    }).join(', ');
  }

  function localizeQualifyingSeparator(text) {
    if (text == null) return '';
    var val = String(text).trim();
    if (!val || lang !== 'ru') return val;
    var l = val.toLowerCase();
    if (l === "qualified by owner's points") return t('qualifying.qualified_by_points');
    if (l === 'failed to qualify') return t('qualifying.failed_to_qualify');
    return val;
  }

  function documentTitle(main) {
    var suffix = t('app.title');
    return main ? (String(main) + ' — ' + suffix) : suffix;
  }

  function localizeDriverRaceLabel(label) {
    if (label == null) return '';
    var raw = String(label).trim();
    if (!raw || lang !== 'ru') return raw;
    if (/^sprint$/i.test(raw) || /sprint/i.test(raw)) return t('standings.sprint');
    if (/^feature$/i.test(raw)) return t('standings.feature');
    if (/^entry\s+list$/i.test(raw)) return t('driver.entry_list');
    return raw;
  }

  function localizeWinnerCardLabel(label) {
    if (label == null) return '';
    var raw = String(label).trim();
    if (!raw || lang !== 'ru') return raw;
    var cls = localizeRacingClass(raw);
    if (cls !== raw) return cls;
    var raceLbl = localizeDriverRaceLabel(raw);
    if (raceLbl !== raw) return raceLbl;
    if (/^gtd\s*pro$/i.test(raw)) return t('class.gtd_pro');
    if (/^gtp$/i.test(raw)) return t('class.gtp');
    if (/^gtd$/i.test(raw)) return t('class.gtd');
    var rm = raw.match(/^race\s+(\d+)$/i);
    if (rm) return t('th.race_col') + ' ' + rm[1];
    var stageM = raw.match(/^stage\s+(\d+)$/i);
    if (stageM) {
      var sk = 'table.stage' + stageM[1];
      var st = t(sk);
      return st !== sk ? st : raw;
    }
    if (/^main\s+race$/i.test(raw)) return t('table.race_results');
    if (/^overall$/i.test(raw)) return t('card.overall');
    return raw;
  }

  function localizeDriverStatus(v) {
    if (v == null) return '';
    var text = String(v).trim();
    if (!text || lang !== 'ru') return text;
    var key = text.toLowerCase();
    if (driverStatusRu[key]) return driverStatusRu[key];
    var fromCell = localizeCellNote(text);
    return fromCell !== text ? fromCell : text;
  }

  function localizeDriverNamesInText(text) {
    if (text == null) return '';
    if (lang !== 'ru') return String(text);
    var str = String(text);
    var map = (typeof window !== 'undefined' && window.TGA_RU && window.TGA_RU.driverNameRu) || driverNameRu;
    var keys = Object.keys(map).filter(function (k) { return k && k.length > 2; });
    keys.sort(function (a, b) { return b.length - a.length; });
    keys.forEach(function (key) {
      var matchKey = key.replace(/\s*\((?:i|r|g)\)\s*$/i, '').trim();
      var escaped = matchKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var re = new RegExp('(?<![A-Za-zÀ-ÿ])' + escaped + '(?:\\s*\\((?:i|r|g)\\))?(?![A-Za-zÀ-ÿ])', 'gi');
      str = str.replace(re, function (match) { return localizeDriverName(match); });
    });
    str = str.replace(
      /(?<![A-Za-zÀ-ÿ])((?:[A-Z]\.\s*){0,3}[A-Z][A-Za-zÀ-ÿ'’-]+(?:\s+(?:(?:van|von|de|da|di|del|der|la|le|st)\s+)?[A-Z][A-Za-zÀ-ÿ'’-]+){1,3})(?![A-Za-zÀ-ÿ])/g,
      function (match) {
        var resolveFn = (typeof window !== 'undefined' && window.TGA_RU && window.TGA_RU.resolveDriverNameRu);
        if (typeof resolveFn === 'function') {
          var resolved = resolveFn(match, map);
          if (resolved) return resolved;
        }
        return match;
      }
    );
    return str;
  }

  function localizeEventPreview(s) {
    if (s == null || typeof s !== 'string') return '';
    var str = s.trim();
    if (lang !== 'ru') return str;
    var exactKey = normalizePreviewKey(str);
    if (eventPreviewExact[exactKey]) return eventPreviewExact[exactKey];
    str = applyRuPhraseParts(str, eventPreviewParts);
    str = str.replace(/\bTurn\s+(\d+)\b/gi, 'Поворот $1');
    str = str.replace(/\bdegrees?\b/gi, 'градусов');
    str = str.replace(/\bmi\b/gi, 'мили');
    str = str.replace(/\bkm\b/gi, 'км');
    str = str.replace(/\bmiles?\b/gi, 'миль');
    str = str.replace(/\bft\b/gi, 'футов');
    str = str.replace(/\((\d{1,3}(?:,\d{3})*)\s+m\)/gi, '($1 м)');
    str = str.replace(/\((\d+)\s+m\)/gi, '($1 м)');
    return localizeDriverNamesInText(str);
  }

  function localizeTyreCompounds(s) {
    if (s == null) return '';
    var val = String(s).trim();
    if (!val || lang !== 'ru') return val;
    function compoundsList(part) {
      return part.replace(/,\s*and\s+/gi, ' и ').replace(/\s+and\s+/gi, ' и ');
    }
    var m = val.match(/^Tyre supplier Pirelli will bring(?: the)? (.+?) tyre compounds\.?$/i);
    if (m) return 'Поставщик шин Pirelli привезёт составы ' + compoundsList(m[1]) + '.';
    m = val.match(/^Tyre supplier Pirelli brought(?: the)? (.+?) tyre compounds\.?$/i);
    if (m) return 'Поставщик шин Pirelli привёз составы ' + compoundsList(m[1]) + '.';
    return localizeCompoundLegend(val);
  }

  function localizeCompoundLegend(s) {
    if (s == null) return '';
    var val = String(s).trim();
    if (!val || lang !== 'ru') return val;
    val = val.replace(/\bHard\b/gi, 'жёсткий');
    val = val.replace(/\bMedium\b/gi, 'средний');
    val = val.replace(/\bSoft\b/gi, 'мягкий');
    val = val.replace(/\bIntermediate\b/gi, 'промежуточный');
    val = val.replace(/\bWet\b/gi, 'дождевой');
    val = val.replace(/\bwhite\b/gi, 'белый');
    val = val.replace(/\byellow\b/gi, 'жёлтый');
    val = val.replace(/\bred\b/gi, 'красный');
    val = val.replace(/\bgreen\b/gi, 'зелёный');
    val = val.replace(/\bblue\b/gi, 'синий');
    return val;
  }

  var sectionTitleKeys = {
    'pit stops': 'table.pit_stops',
    'race neutralisation': 'table.vsc',
    'feature highlights': 'section.highlights_feature',
    'sprint highlights': 'section.highlights_sprint',
    'highlights': 'section.highlights',
    'penalties during the race': 'table.penalties',
    'penalties added after the chequered flag': 'table.penalties_after',
    'laps led': 'table.laps_led',
    'best laps': 'table.best_laps',
    'race results': 'table.race_results',
    'sprint results': 'table.sprint_results',
    'stage results': 'table.stage_results',
    'points system': 'table.points_system',
    'results': 'table.results',
    'caution breakdown': 'table.caution_breakdown',
    'hypercar': 'class.hypercar',
    'lmgt3': 'class.lmgt3',
    'lmp2': 'class.lmp2',
    'lmp2 pro/am': 'class.lmp2_pro_am',
    'lmp3': 'class.lmp3'
  };

  function localizeSectionTitle(s) {
    if (s == null) return '';
    var val = String(s).trim();
    if (!val || lang !== 'ru') return val;
    var key = val.toLowerCase();
    if (sectionTitleKeys[key]) return t(sectionTitleKeys[key]);
    if (/^sprint\s+[—–-]\s+/i.test(val)) {
      return 'Спринт — ' + localizeSectionTitle(val.replace(/^sprint\s+[—–-]\s+/i, ''));
    }
    return val;
  }

  function localizeDistance(s) {
    if (s == null) return '';
    var v = String(s).trim();
    if (lang !== 'ru') return trimTrailingZeros(v);
    v = trimTrailingZeros(v);
    var distanceParts = (typeof window !== 'undefined' && window.TGA_RU && window.TGA_RU.distanceParts) || [];
    v = applyRuPhraseParts(v, distanceParts);
    return v;
  }

  var locationRu = (typeof window !== 'undefined' && window.TGA_RU && window.TGA_RU.locationRu) || {};
  var placeNameRu = (typeof window !== 'undefined' && window.TGA_RU && window.TGA_RU.placeNameRu) || {};
  var usStateRu = (typeof window !== 'undefined' && window.TGA_RU && window.TGA_RU.usStateRu) || {};
  var regionRu = (typeof window !== 'undefined' && window.TGA_RU && window.TGA_RU.regionRu) || {};
  var cityNameRu = (typeof window !== 'undefined' && window.TGA_RU && window.TGA_RU.cityNameRu) || {};
  var driverNameRu = (typeof window !== 'undefined' && window.TGA_RU && window.TGA_RU.driverNameRu) || {};
  var translitDriverNameToRu = (typeof window !== 'undefined' && window.TGA_RU && window.TGA_RU.translitDriverNameToRu) || null;

  function foldPlaceKey(s) {
    var val = String(s == null ? '' : s);
    if (typeof window !== 'undefined' && window.TGA && typeof window.TGA.foldDiacritics === 'function') {
      val = window.TGA.foldDiacritics(val);
    } else {
      val = val.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
    return val.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function localizePlaceSegment(seg) {
    if (seg == null) return '';
    var val = String(seg).trim();
    if (!val || lang !== 'ru') return val;
    var key = foldPlaceKey(val);
    if (placeNameRu[key]) return placeNameRu[key];
    if (locationRu[key]) return locationRu[key];
    if (cityNameRu[key]) return cityNameRu[key];
    if (usStateRu[key]) return usStateRu[key];
    if (regionRu[key]) return regionRu[key];
    var country = localizeCountryName(val);
    if (country !== val) return country;
    return val;
  }

  function localizeCompoundPlace(s) {
    if (s == null) return '';
    var val = String(s).trim();
    if (!val || val === '—' || lang !== 'ru') return val;
    var exact = foldPlaceKey(val);
    if (placeNameRu[exact]) return placeNameRu[exact];
    if (locationRu[exact]) return locationRu[exact];
    var emDash = val.match(/^(.+?)\s+[—–]\s+(.+)$/);
    if (emDash) {
      return localizePlaceSegment(emDash[1].trim()) + ' — ' + localizeCompoundPlace(emDash[2].trim());
    }
    var countryDash = val.match(/^(.+?)\s+[—–-]\s+(.+)$/);
    if (countryDash && countryDash[1].indexOf(',') < 0) {
      var left = localizeCountryName(countryDash[1].trim());
      if (left !== countryDash[1].trim()) {
        return left + ' — ' + localizeCompoundPlace(countryDash[2].trim());
      }
    }
    if (val.indexOf(', ') >= 0) {
      return val.split(/,\s*/).map(function (p) { return localizePlaceSegment(p); }).join(', ');
    }
    return localizePlaceSegment(val);
  }

  function localizeCircuitName(name) {
    if (name == null) return '';
    return String(name).trim();
  }

  /** Circuit / venue line: track name stays EN; country and "City, State" tails are localized. */
  function localizeVenueLine(s) {
    if (s == null) return '';
    var val = String(s).trim();
    if (!val || val === '—' || lang !== 'ru') return val;
    var emDash = val.match(/^(.+?)\s+[—–]\s+(.+)$/);
    if (emDash) {
      return localizePlaceSegment(emDash[1].trim()) + ' — ' + localizeVenueLine(emDash[2].trim());
    }
    var comma = val.indexOf(', ');
    if (comma < 0) return val;
    return val.slice(0, comma) + ', ' + localizeCompoundPlace(val.slice(comma + 2));
  }

  function localizeLocation(place) {
    return localizeCompoundPlace(place);
  }

  function driverNameKey(name) {
    return foldPlaceKey(name)
      .replace(/\s*\((?:i|r|g)\)\s*$/i, function (m) { return m.toLowerCase(); })
      .replace(/\b([a-z])\.\s+(?=[a-z]\.)/g, '$1.')
      .trim();
  }

  function lookupDriverNameRu(name) {
    if (name == null) return '';
    var val = String(name).trim();
    if (!val) return val;
    if (/[\u0400-\u04FF]/.test(val)) return val;
    var ruApi = (typeof window !== 'undefined' && window.TGA_RU) || {};
    var map = ruApi.driverNameRu || driverNameRu;
    var resolveFn = ruApi.resolveDriverNameRu;
    if (typeof resolveFn === 'function') {
      var fromEtalon = resolveFn(val, map);
      if (fromEtalon) return fromEtalon;
    }
    var translitFn = ruApi.translitDriverNameToRu || translitDriverNameToRu;
    if (typeof translitFn === 'function') return translitFn(val);
    return val;
  }

  function localizeDriverName(name) {
    if (name == null) return '';
    var val = String(name).trim();
    if (!val || lang !== 'ru') return val;
    return lookupDriverNameRu(val);
  }

  function translateStaticUI() {
    if (typeof document === 'undefined') return;
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var key = el.getAttribute('data-i18n');
      if (key) el.textContent = t(key);
    }
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var phKey = el.getAttribute('data-i18n-placeholder');
      if (phKey) el.placeholder = t(phKey);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
      var ariaKey = el.getAttribute('data-i18n-aria');
      if (ariaKey) el.setAttribute('aria-label', t(ariaKey));
    });
    var titleNode = document.querySelector('title[data-i18n]');
    if (titleNode) {
      var titleKey = titleNode.getAttribute('data-i18n');
      if (titleKey) document.title = t(titleKey);
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
  window.TGA.localizeFreePass = localizeFreePass;
  window.TGA.localizeCautionFlagLabel = localizeCautionFlagLabel;
  window.TGA.translateValueHeaders = translateValueHeaders;
  window.TGA.translateReasonHeaders = translateReasonHeaders;
  window.TGA.translateFreePassHeaders = translateFreePassHeaders;
  window.TGA.localizeStatKey = localizeStatKey;
  window.TGA.localizeStatValue = localizeStatValue;
  window.TGA.localizeSpecKey = localizeSpecKey;
  window.TGA.localizeSpecSection = localizeSpecSection;
  window.TGA.localizeSpecValue = localizeSpecValue;
  window.TGA.normalizeSpecKey = normalizeSpecKey;
  window.TGA.specKeySkip = specKeySkip;
  window.TGA.localizeDate = localizeDate;
  window.TGA.localizeDistance = localizeDistance;
  window.TGA.localizeEventPreview = localizeEventPreview;
  window.TGA.localizeDriverNamesInText = localizeDriverNamesInText;
  window.TGA.localizeTyreCompounds = localizeTyreCompounds;
  window.TGA.localizeCompoundLegend = localizeCompoundLegend;
  window.TGA.localizeSectionTitle = localizeSectionTitle;
  window.TGA.localizeCountryName = localizeCountryName;
  window.TGA.localizeBirthPlace = localizeBirthPlace;
  window.TGA.localizeSeriesName = localizeSeriesName;
  window.TGA.localizeEventName = localizeEventName;
  window.TGA.localizeEventFromData = localizeEventFromData;
  window.TGA.localizeRacingClass = localizeRacingClass;
  window.TGA.localizeTeamName = localizeTeamName;
  window.TGA.localizeImsaScheduleLength = localizeImsaScheduleLength;
  window.TGA.localizeImsaScheduleClasses = localizeImsaScheduleClasses;
  window.TGA.localizeQualifyingSeparator = localizeQualifyingSeparator;
  window.TGA.documentTitle = documentTitle;
  window.TGA.localizeDriverRaceLabel = localizeDriverRaceLabel;
  window.TGA.localizeWinnerCardLabel = localizeWinnerCardLabel;
  window.TGA.localizeDriverStatus = localizeDriverStatus;
  window.TGA.localizeCircuitName = localizeCircuitName;
  window.TGA.localizeVenueLine = localizeVenueLine;
  window.TGA.localizeLocation = localizeLocation;
  window.TGA.localizeDriverName = localizeDriverName;
  window.TGA.lookupDriverNameRu = lookupDriverNameRu;
  window.TGA.trimTrailingZeros = trimTrailingZeros;
  window.TGA.pluralRu = pluralRu;

  function initLangToggle() {
    document.querySelectorAll('.lang-opt[data-lang]').forEach(function (btn) {
      if (btn.dataset.langBound === '1') return;
      btn.dataset.langBound = '1';
      btn.addEventListener('click', function () {
        setLang(btn.dataset.lang);
      });
    });
    updateLangUI();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initLangToggle);
    } else {
      initLangToggle();
    }
  }
})();
