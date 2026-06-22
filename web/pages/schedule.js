// Schedule page + global event fetch. Uses window.TGA at call time.
(function () {
  if (typeof window === 'undefined') return;
  window.TGA = window.TGA || {};

  var globalEventsCache = null;

  function getLang() { return window.TGA.getLang(); }
  function setGlobalEventsCache(events) { globalEventsCache = events; }
  function getGlobalEventsCache() { return globalEventsCache; }

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
    var mon = getLang() === 'ru' ? monthsRu[d1.getMonth()] : monthsEn[d1.getMonth()];
    return getLang() === 'ru' ? day + ' ' + mon + ' ' + year : mon + ' ' + day + ', ' + year;
  }
  var d2 = new Date(endIso + 'T12:00:00');
  var d1day = d1.getDate(), d2day = d2.getDate();
  var m1 = getLang() === 'ru' ? monthsRu[d1.getMonth()] : monthsEn[d1.getMonth()];
  var m2 = getLang() === 'ru' ? monthsRu[d2.getMonth()] : monthsEn[d2.getMonth()];
  if (d1.getMonth() === d2.getMonth()) {
    return getLang() === 'ru' ? d1day + '\u2013' + d2day + ' ' + m1 + ' ' + year : m1 + ' ' + d1day + '\u2013' + d2day + ', ' + year;
  }
  return getLang() === 'ru'
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

function fetchAllEvents(seriesData) {
    var categories = window.TGA.categories;
    var API = window.TGA.API;
    if (!categories || !API) return Promise.resolve([]);
  var allIds = [];
  categories.forEach(function (c) { c.ids.forEach(function (id) { allIds.push(id); }); });
  var byId = {};
  seriesData.forEach(function (s) { byId[s.id] = s; });
  var relevant = allIds.map(function (id) { return byId[id]; }).filter(Boolean);

  return Promise.all(relevant.map(function (s) {
    var se = String((s.season != null && s.season !== '') ? s.season : '2026').trim();
    return API.getSeriesEvents(s.id, se)
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
    var renderNextRaceCards = window.TGA.renderNextRaceCards || function () {};
  var nrRow = document.getElementById('next-races-row');
  if (nrRow) nrRow.classList.add('hidden');

  fetchAllEvents(seriesData).then(function (all) {
    var visible = filterVisibleEvents(all);
    globalEventsCache = visible;
    if (window.TGA && typeof window.TGA.setGlobalEventsCache === 'function') {
      setGlobalEventsCache(visible);
    }
    renderNextRaceCards(visible);
    if (window.TGA && typeof window.TGA.renderLastResultsCards === 'function') {
      window.TGA.renderLastResultsCards(visible);
    }
  });
}

// ── Schedule page ─────────────────────────────────────────────────────────
function renderSchedulePage() {
    var showView = window.TGA.showView;
    var t = window.TGA.t;
    var API = window.TGA.API;
    var buildScheduleHTML = window.TGA.buildScheduleHTML || function () {};
    if (!showView || !t || !API) return;
  showView('view-schedule');
  window.scrollTo(0, 0);
  document.title = (window.TGA.documentTitle || function (m) { return m + ' — TGA'; })(t('home.full_schedule'));

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
      date: t('th.date'),
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

  API.getSeries()
    .then(function (data) { return fetchAllEvents(data); })
    .then(function (all) {
      var visible = filterVisibleEvents(all);
      globalEventsCache = visible;
      if (window.TGA && typeof window.TGA.setGlobalEventsCache === 'function') {
        setGlobalEventsCache(visible);
      }
      buildScheduleHTML(visible, 'sched-page-body');
    })
    .catch(function () {
      if (body) body.innerHTML = '<tr><td colspan="5">' + t('error.no_data') + '</td></tr>';
    });
  if (typeof window.TGA.translateStaticUI === 'function') window.TGA.translateStaticUI();
}

  window.TGA.formatDateRangeLong = formatDateRangeLong;
  window.TGA.parseMetaDateToISO = parseMetaDateToISO;
  window.TGA.getEventSessionDateRange = getEventSessionDateRange;
  window.TGA.applySchedulePastVisibility = applySchedulePastVisibility;
  window.TGA.monthDayToISO = monthDayToISO;
  window.TGA.loadGlobalSchedule = loadGlobalSchedule;
  window.TGA.renderSchedulePage = renderSchedulePage;
  window.TGA.setGlobalEventsCache = setGlobalEventsCache;
  window.TGA.getGlobalEventsCache = getGlobalEventsCache;
  window.TGA.filterVisibleEvents = filterVisibleEvents;
})();
