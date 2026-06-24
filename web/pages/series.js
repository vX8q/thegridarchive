// web/pages/series.js — series/season detail page (renderDetail)
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  window.TGA = window.TGA || {};

  var P = window.TGA.pageDeps();
  var t = P.t;
  var getLang = P.getLang;
  var esc = P.esc;
  var dash = P.dash;
  var slugify = P.slugify;
  var driverDisplayName = P.driverDisplayName;
  var isGuestEntryRow = P.isGuestEntryRow;
  var guestCarNumberSet = P.guestCarNumberSet;
  var entryListDriverCell = P.entryListDriverCell;
  var entryListDriverLabel = P.entryListDriverLabel;
  var localizeStatKey = P.localizeStatKey;
  var localizeStatValue = P.localizeStatValue;
  var localizeSpecKey = P.localizeSpecKey;
  var localizeSpecSection = P.localizeSpecSection;
  var localizeSpecValue = P.localizeSpecValue;
  var normalizeSpecKey = P.normalizeSpecKey;
  var specKeySkip = P.specKeySkip;
  var localizeTableHeader = P.localizeTableHeader;
  var localizeCellNote = P.localizeCellNote;
  var localizeRaceReason = P.localizeRaceReason;
  var translateValueHeaders = P.translateValueHeaders;
  var translateReasonHeaders = P.translateReasonHeaders;
  var localizeDate = P.localizeDate;
  var localizeDistance = P.localizeDistance;
  var localizeEventPreview = P.localizeEventPreview;
  var localizeEventName = P.localizeEventName;
  var localizeEventFromData = P.localizeEventFromData;
  var localizeRacingClass = P.localizeRacingClass;
  var localizeImsaScheduleLength = P.localizeImsaScheduleLength || function (v) { return v; };
  var localizeImsaScheduleClasses = P.localizeImsaScheduleClasses || function (v) { return v; };
  var teamLabel = P.teamLabel;
  var documentTitle = P.documentTitle;
  var localizeCircuitName = P.localizeCircuitName;
  var localizeVenueLine = P.localizeVenueLine;
  var localizeLocation = P.localizeLocation;
  var trimTrailingZeros = P.trimTrailingZeros;
  var countryHtml = P.countryHtml;
  var seriesBadge = P.seriesBadge;
  var formatShortDate = P.formatShortDate;
  var formatDateRange = P.formatDateRange;
  var parseEventDate = P.parseEventDate;
  var formatDateRangeLong = P.formatDateRangeLong;
  var getEventSessionDateRange = P.getEventSessionDateRange;
  var addObjectTableSort = P.addObjectTableSort;
  var typeLabel = P.typeLabel;
  var syncStandingsScrollBars = P.syncStandingsScrollBars;
  var adjustEventPanelPadding = P.adjustEventPanelPadding;
  var adjustDetailPanelPadding = P.adjustDetailPanelPadding;
  var renderSupercarsStaticSpecs = P.renderSupercarsStaticSpecs;
  var translateStaticUI = P.translateStaticUI;
  var logger = P.logger;
  var state = P.state;
  var API = P.API;
  var categories = P.categories;
  var categoryBySeriesId = P.categoryBySeriesId;

  /** Playoff cutline: dashed row above this position + 1 in driver standings. */
  var STOCKCAR_STANDINGS_PLAYOFF_CUTLINE = {
    nascar_cup: 16,
    noaps: 12,
    nascar_truck: 10
  };

  function makeTableSortable() { return P.makeTableSortable.apply(null, arguments); }
  function makeSimpleTableSortable(tableEl) { P.makeSimpleTableSortable(tableEl); }

  function showView(activeId) { P.showView(activeId); }

  function teamLink(name) {
    if (!name) return '—';
    var raw = String(name).trim();
    if (!raw || raw === '—') return '—';
    var label = teamLabel ? teamLabel(raw) : raw;
    return '<a href="/team/' + encodeURIComponent(slugify(raw)) + '" class="track-link">' + esc(label) + '</a>';
  }

  function filterVisibleEvents(events) {
    if (window.TGA && typeof window.TGA.filterVisibleEvents === 'function') {
      return window.TGA.filterVisibleEvents(events);
    }
    if (!Array.isArray(events)) return events;
    return events;
  }

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

function renderDetail(seriesId, subPath) {
  subPath = subPath || '';
  var API = window.TGA.API;
  var state = window.TGA._state || {};
  var categoryBySeriesId = window.TGA.categoryBySeriesId || {};
  var specKeySkip = window.TGA.specKeySkip || {};
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
  var hasStats = true;

  function driverLink(name) {
    if (window.TGA && window.TGA.driverLinkHtml) return window.TGA.driverLinkHtml(name);
    var display = driverDisplayName(name);
    var label = (window.TGA && window.TGA.driverLabel) ? window.TGA.driverLabel(name) : display;
    return display ? '<a href="/driver/' + encodeURIComponent(slugify(display)) + '" class="track-link">' + esc(label) + '</a>' : '—';
  }

  // Special labels for some series
  var teamsHeaderEl = document.querySelector('.teams-section h3');
  if (teamsHeaderEl) {
    var sidLower = (seriesId || '').toLowerCase();
    if (sidLower === 'supercars') {
      teamsHeaderEl.textContent = t('teams.championship_entries');
    } else if (sidLower === 'imsa') {
      teamsHeaderEl.textContent = t('nav.classes');
    } else {
      teamsHeaderEl.textContent = t('section.h3.teams');
    }
  }

  // Same series — switch tabs only. No early return if Schedule tab is open and table is empty (then full reload).
  var sameSeries = (state.loadedSeriesId === seriesId);
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
        if (typeof renderImsaClassesSpecIfNeeded === 'function') renderImsaClassesSpecIfNeeded();
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
    if (subPath === 'history' && typeof renderF1HistoryFromStatic === 'function') {
      renderF1HistoryFromStatic();
    }
    translateStaticUI();
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
    detailMeta.textContent = t('series.world');
    document.title = documentTitle(seasonTitle);
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
      if (typeof renderImsaClassesSpecIfNeeded === 'function') renderImsaClassesSpecIfNeeded();
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
  var manufacturerStatsWrapInit = document.getElementById('manufacturer-stats-wrap');
  var manufacturerStatsBodyInit = document.querySelector('#manufacturer-stats-table tbody');
  var manufacturerStatsEmptyInit = document.getElementById('manufacturer-stats-empty');
  if (manufacturerStatsWrapInit) manufacturerStatsWrapInit.classList.add('hidden');
  if (manufacturerStatsBodyInit) manufacturerStatsBodyInit.innerHTML = '';
  if (manufacturerStatsEmptyInit) manufacturerStatsEmptyInit.classList.add('hidden');

  API.getSeriesMeta(seriesId)
    .then(function (s) {
      state.loadedSeriesId = seriesId;
      if (!isF1SeasonSlug) {
        detailTitle.textContent = s.name;
        document.title = documentTitle(s.name);
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
      if (!isF1SeasonSlug) detailTitle.textContent = t('error.series_not_found');
      adjustDetailPanelPadding();
    });

  // Update series live banner from /api/live-events data.
  (function updateSeriesLiveBanner() {
    var liveBanner = document.getElementById('series-live-banner');
    if (!liveBanner) return;
    API.getLiveEvents()
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

  API.getSeriesTeams(seriesId)
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
        if (wrapReset && wrapReset.parentElement) {
          var wecBlocksReset = wrapReset.parentElement.querySelector('.wec-teams-class-blocks');
          if (wecBlocksReset) wecBlocksReset.remove();
        }
        if (wrapReset) {
          wrapReset.classList.remove('hidden');
          wrapReset.classList.add('table-wrap');
        }
        if (wrapReset && !(tableReset && wrapReset.contains(tableReset))) {
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
              return '<tr><td class="col-field">' + esc(dash(localizeSpecKey(s.key))) + '</td><td>' + esc(dash(localizeSpecValue(s.value))) + '</td></tr>';
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
            '<th>' + esc(t('th.constructor')) + '</th>' +
            '<th>' + esc(t('th.chassis')) + '</th>' +
            '<th>' + esc(t('th.power_unit')) + '</th>' +
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

        tableWrapImsa.innerHTML = sectionsHtml || '<p class="empty-msg">' + t('error.no_imsa_teams') + '</p>';
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
          '<th>' + t('th.team') + '</th><th>' + t('th.engine') + '</th><th>' + t('th.no') + '</th><th>' + t('th.driver') + '</th><th>' + t('th.rounds') + '</th>' +
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
          '<thead><tr><th>' + t('th.team') + '</th><th>' + t('th.no') + '</th><th>' + t('th.driver') + '</th><th>' + t('th.rounds') + '</th></tr></thead>' +
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
            '<td>' + esc(dash(localizeSpecValue(tm.power_unit))) + '</td>' +
            '<td class="col-num">' + esc(dash(tm.number)) + '</td>' +
            '<td>' + driverLink(tm.driver) + '</td>' +
            '<td>' + esc(dash(tm.rounds)) + '</td>' +
            '</tr>';
        }

        var dtmTable = '<table class="data-table dtm-teams-table" id="teams-table">' +
          '<thead><tr>' +
          '<th>' + t('th.team') + '</th><th>' + t('th.car') + '</th><th>' + t('th.engine') + '</th><th>' + t('th.no') + '</th><th>' + t('th.driver') + '</th><th>' + t('th.rounds') + '</th>' +
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
                '<td>' + esc(dash(w.rounds)) + '</td>' +
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
            '<thead><tr><th>#</th><th>' + t('th.team') + '</th><th>' + t('th.constructor') + '</th><th>' + t('th.chassis') + '</th><th>' + t('th.engine') + '</th><th data-i18n="th.no">' + t('th.no') + '</th><th data-i18n="th.driver">' + t('th.driver') + '</th><th data-i18n="th.rounds">' + t('th.rounds') + '</th></tr></thead>' +
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
        var dualWrapGt = wrapGt.parentElement;
        if (dualWrapGt) {
          var wecBlocksEl = dualWrapGt.querySelector('.wec-teams-class-blocks');
          if (wecBlocksEl) wecBlocksEl.remove();
        }
        wrapGt.classList.add('table-wrap');
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

        function buildGtTeamRows(teamList) {
          return teamList.map(function (tm) {
            return '<tr><td class="col-num">' + esc(dash(tm.number)) + '</td>' +
              '<td>' + teamLink(tm.team) + '</td>' +
              '<td>' + esc(dash(tm.car)) + '</td>' +
              '<td>' + gtDriversCell(tm) + '</td>' +
              '<td>' + gtRoundsCell(tm) + '</td></tr>';
          }).join('');
        }

        var gtTheadNoClass = '<thead><tr><th>' + t('th.no') + '</th><th>' + t('th.team') + '</th>' +
          '<th>' + t('th.car') + '</th><th>' + t('th.drivers') + '</th><th>' + t('th.rounds') + '</th></tr></thead>';

        // WEC: separate Hypercar / LMGT3 / LMP2 tables (no Class column).
        // Titles stay outside .table-wrap (see style.css table layout system).
        if (seriesKeyTeams === 'wec') {
          var hypercarTeams = teams.filter(function (tm) { return String(tm.class || '').trim() === 'Hypercar'; });
          var lmgt3Teams = teams.filter(function (tm) { return String(tm.class || '').trim() === 'LMGT3'; });
          var lmp2Teams = teams.filter(function (tm) { return String(tm.class || '').trim() === 'LMP2'; });
          function wecTableBlock(title, teamList) {
            return '<h4 class="table-section-title">' + esc(localizeRacingClass(title)) + '</h4>' +
              '<div class="table-wrap">' +
              '<table class="data-table gt-endurance-teams-table">' +
              gtTheadNoClass +
              '<tbody>' + buildGtTeamRows(teamList) + '</tbody></table></div>';
          }
          var wecHtml = '';
          if (hypercarTeams.length > 0) wecHtml += wecTableBlock('Hypercar', hypercarTeams);
          if (lmgt3Teams.length > 0) wecHtml += wecTableBlock('LMGT3', lmgt3Teams);
          if (lmp2Teams.length > 0) wecHtml += wecTableBlock('LMP2', lmp2Teams);
          wrapGt.classList.add('hidden');
          wrapGt.innerHTML = '';
          if (dualWrapGt && wecHtml) {
            var wecContainer = document.createElement('div');
            wecContainer.className = 'wec-teams-class-blocks';
            wecContainer.innerHTML = wecHtml;
            dualWrapGt.insertBefore(wecContainer, wrapGt);
          }
          return;
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
      if (['f2', 'f3', 'f1', 'f4_it', 'psc'].indexOf(seriesKeyTeams) >= 0) hasFullTimeFlag = false;
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
          } else if (['f2', 'f3', 'f4_it'].indexOf(seriesKeyTeams) >= 0) {
            var wrapEl = document.getElementById('teams-table-wrap');
            if (wrapEl) {
              wrapEl.innerHTML = buildEntryListTeamsTableHTML(teams, seriesKeyTeams);
              if (typeof makeSimpleTableSortable === 'function') makeSimpleTableSortable(wrapEl.querySelector('.data-table'));
            }
          } else if (seriesKeyTeams === 'f1') {
            var wrapF1 = document.getElementById('teams-table-wrap');
            if (wrapF1) {
              wrapF1.innerHTML = '<table class="data-table f1-teams-table" id="teams-table">' +
                '<thead><tr><th>#</th><th>' + t('th.team') + '</th><th>' + t('th.constructor') + '</th><th>' + t('th.chassis') + '</th><th>' + t('th.engine') + '</th><th data-i18n="th.no">' + t('th.no') + '</th><th data-i18n="th.driver">' + t('th.driver') + '</th></tr></thead>' +
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
          if (specsTitleStatic) specsTitleStatic.textContent = t('specs.tech_regulations_2026');
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
          return '<h4 class="table-section-title">' + esc(localizeSpecSection(sec.title)) + '</h4>' +
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
              return esc(dash(val)) + '<br>' + esc(localizeSpecValue('750 hp at tracks under 1.5 miles and road courses.'));
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
          if (s.key && s.key.toLowerCase().trim() === 'power output') val += '\n' + localizeSpecValue('750 hp at tracks under 1.5 miles and road courses.');
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
              if (s.key && s.key.toLowerCase().trim() === 'power output') val += '\n' + localizeSpecValue('750 hp at tracks under 1.5 miles and road courses.');
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
            var enginesTableHtml = '<div class="table-wrap"><table class="data-table"><thead><tr><th>' + t('specs.car_model') + '</th><th>' + t('specs.engine_spec') + '</th></tr></thead><tbody>' +
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
            var homologTableHtml = '<div class="table-wrap"><table class="data-table"><thead><tr><th>' + t('th.manufacturer') + '</th><th>' + t('specs.homologating_team') + '</th></tr></thead><tbody>' +
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
        if (specsTitleEl) specsTitleEl.textContent = t('nav.classes');

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
            '<h4 class="table-section-title">' + t('nav.classes') + '</h4>' +
            '<div class="table-wrap">' +
              '<table class="data-table">' +
                '<thead><tr><th>' + t('th.class') + '</th></tr></thead>' +
                '<tbody>' +
                  imsaClasses.map(function (name) {
                    return '<tr><td>' + esc(localizeSpecValue(name)) + '</td></tr>';
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
      translateStaticUI();
    })
    .catch(function (err) {
      logger.error('Teams fetch failed', err);
      teamsEmpty.classList.remove('hidden');
    });

  API.getSeriesStandings(seriesId)
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
        if (sk === 'f1' || sk === 'f2' || sk === 'f3' || sk === 'frec' || sk === 'f4_it' || String(currentSeriesId || '').toLowerCase().indexOf('f1-') === 0) {
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
                }
                if (en === prevName) {
                  colSpan++;
                } else {
                  if (prevName != null) eventRow += '<th class="col-race-group" colspan="' + colSpan + '">' + esc(localizeEventName(prevName)) + '</th>';
                  prevName = en;
                  colSpan = 1;
                }
              }
              if (prevName != null) eventRow += '<th class="col-race-group" colspan="' + colSpan + '">' + esc(localizeEventName(prevName)) + '</th>';
              var topRowF1 = '<tr class="standings-header-row-top">' +
                '<th class="col-num" rowspan="2">' + t('th.pos') + '</th>' +
                '<th class="col-car" rowspan="2">#</th>' +
                '<th rowspan="2">' + t('th.driver') + '</th>' +
                eventRow +
                '<th class="col-pts" rowspan="2">' + t('th.pts') + '</th></tr>';
              var bottomRowF1 = '<tr id="standings-thead">';
              var useSprintFeature = (sk === 'f2' || sk === 'f3');
              var useFrecRaceLabels = (sk === 'frec' || sk === 'f4_it');
              for (var j = 0; j < raceOrder.length; j++) {
                var sub = (raceOrder[j] != null && raceOrder[j] !== undefined) ? String(raceOrder[j]).replace(/<nil>|^null$/gi, '').trim() : '';
                var subLabel;
                if (useSprintFeature) {
                  subLabel = (j % 2 === 0 ? (t('standings.sprint') || 'Sprint') : (t('standings.feature') || 'Feature'));
                } else if (useFrecRaceLabels) {
                  var mFrec = sub.match(/-(\d+)$/);
                  subLabel = mFrec && mFrec[1] ? ('R' + mFrec[1]) : (sub || 'Race');
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
                if (sk === 'f4_it' && emptyRace) {
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
                  if (!isF1SeasonView && (sk === 'frec' || sk === 'f4_it')) {
                    var mRq = rq.match(/-(\d+)$/);
                    rqLabel = mRq && mRq[1] ? ('R' + mRq[1]) : rqLabel;
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
          if (getLang() === 'ru') label = label.replace(/^R(\d*)$/i, 'Р$1');
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
        var playoffCutline = STOCKCAR_STANDINGS_PLAYOFF_CUTLINE[sk] || 0;
        standingsBody.innerHTML = list.map(function (row) {
          var posDisplay = (row.pos === 0 || row.pos === null || row.pos === undefined) ? '—' : row.pos;
          var posNum = posDisplay === '—' ? null : parseInt(String(row.pos), 10);
          var rowClass = (playoffCutline > 0 && posNum === playoffCutline + 1) ? ' standings-playoff-cutline' : '';
            var td = '<td class="col-num">' + posDisplay + '</td>';
            if (hasCar) td += '<td class="col-car">' + esc(dash(row.car)) + '</td>';
            td += '<td>' + driverLink(row.driver) + '</td><td>' + teamLink(row.team) + '</td>';
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
          return '<tr' + (rowClass ? ' class="' + rowClass.trim() + '"' : '') + '>' + td + '</tr>';
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
                  td += '<td>' + driverLink(row.driver) + '</td><td>' + teamLink(row.team) + '</td>';
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
                return '<tr><td>' + teamLink(row.team) + '</td><td>' + esc(dash(row.manufacturer)) + '</td><td>' + esc(dash(row.status)) + '</td></tr>';
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
        API.getSeriesTeams('supercars').then(function (teamsResp) {
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
        API.getSeriesEvents('super_gt', null, { cacheBust: false })
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
              return API.getEvent(eventApiId)
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

      API.getSeriesStats(seriesId)
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
            '<th>' + t('th.pos') + '</th>' +
            '<th>' + t('th.no') + '</th>' +
            '<th>' + t('th.driver') + '</th>' +
            '<th>' + t('th.team') + '</th>' +
            '<th>' + t('stats.starts') + '</th>' +
            '<th>' + t('standings.wins') + '</th>' +
            '<th>' + t('stats.top2') + '</th>' +
            '<th>' + t('stats.top3') + '</th>' +
            '<th>' + t('stats.podiums') + '</th>' +
            '<th>' + t('standings.top5') + '</th>' +
            '<th>' + t('standings.top10') + '</th>' +
            '<th>' + t('standings.avg_start') + '</th>' +
            '<th>' + t('stats.avg_qualifying') + '</th>' +
            '<th>' + t('standings.poles') + '</th>' +
            '<th>' + t('standings.avg_finish') + '</th>' +
            '<th>' + t('stats.q2') + '</th>' +
            '<th>' + t('stats.q3') + '</th>' +
            '<th>' + t('standings.laps_led') + '</th>' +
            '<th>' + t('stats.laps_completed') + '</th>';

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
      API.getSeriesStats(seriesId)
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
          API.getSeriesTeams('supercars').then(function (teamsResp) {
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
          var labelEl = selectEl.parentNode;
          if (selectEl.closest) {
            var closestLabel = selectEl.closest('label');
            if (closestLabel) labelEl = closestLabel;
          }
          if (seriesKeyStats === 'nascar_cup' || seriesKeyStats === 'noaps') {
            config = [5, 10, 20, 30];
          } else if (seriesKeyStats === 'nascar_truck') {
            config = [5, 10, 20];
          } else if (seriesKeyStats === 'arca' || seriesKeyStats === 'nascar_modified') {
            config = [5, 10];
          }

          if (!config) {
            // For other series temporarily hide minimum starts filter.
            if (labelEl && labelEl.style) {
              labelEl.style.display = 'none';
            }
            return;
          }
          if (labelEl && labelEl.style) {
            labelEl.style.display = '';
          }

          var allLabel = t('stats.all_starts');

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

        function hasAnyValue(list, key) {
          return list.some(function (row) {
            var v = row && row[key];
            if (v == null || v === '' || v === '—') return false;
            if (typeof v === 'number') return v !== 0;
            var num = parseFloat(String(v));
            if (!isNaN(num)) return num !== 0;
            return String(v).trim() !== '';
          });
        }

        function hasAnyText(list, key) {
          return list.some(function (row) {
            var v = row && row[key];
            return v != null && String(v).trim() !== '' && String(v).trim() !== '—';
          });
        }

        function makeStatsColumn(key, label, render, className) {
          return { key: key, label: label, render: render, className: className || '' };
        }

        function setStatsHead(table, columns) {
          var headRow = table && table.querySelector('thead tr');
          if (!headRow) return null;
          headRow.innerHTML = columns.map(function (col) {
            return '<th>' + esc(col.label) + '</th>';
          }).join('');
          return headRow;
        }

        function attachStatsSort(table, columns, dataArray, renderFn, numericKeys) {
          var headRow = table && table.querySelector('thead tr');
          if (!headRow) return;
          var ths = headRow.querySelectorAll('th');
          for (var c = 0; c < ths.length; c++) {
            (function (colIndex) {
              var col = columns[colIndex];
              if (!col || !col.key) return;
              ths[colIndex].classList.add('sortable');
              ths[colIndex].addEventListener('click', function () {
                var dir = ths[colIndex].dataset.sortDir === 'asc' ? -1 : 1;
                dataArray.sort(function (a, b) {
                  var va = a[col.key];
                  var vb = b[col.key];
                  var ae = (va === null || va === undefined || va === '');
                  var be = (vb === null || vb === undefined || vb === '');
                  if (ae && be) return 0;
                  if (ae) return 1;
                  if (be) return -1;
                  if (numericKeys.indexOf(col.key) >= 0) {
                    var na = parseFloat(va);
                    var nb = parseFloat(vb);
                    if (!isNaN(na) && !isNaN(nb)) return dir * (na - nb);
                  }
                  return dir * String(va).localeCompare(String(vb), undefined, { numeric: true });
                });
                [].forEach.call(ths, function (th) { th.classList.remove('sort-asc', 'sort-desc'); th.removeAttribute('data-sort-dir'); });
                ths[colIndex].classList.add(dir === 1 ? 'sort-asc' : 'sort-desc');
                ths[colIndex].dataset.sortDir = (dir === 1 ? 'asc' : 'desc');
                renderFn(dataArray);
              });
            })(c);
          }
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
            class: row.class || '',
            chassis: row.chassis || '',
            races: row.races || 0,
            wins: row.wins || 0,
            points: row.points || 0,
            top2: row.top2 || 0,
            top3: row.top3 || 0,
            podiums: row.podiums != null ? row.podiums : (row.wins || 0) + (row.top2 || 0) + (row.top3 || 0),
            poles: row.poles || 0,
            top5: row.top5 || 0,
            top10: row.top10 || 0,
            top15: row.top15 || 0,
            top20: row.top20 || 0,
            fastest_laps: row.fastest_laps || 0,
            dnfs: row.dnfs || 0,
            sprint_wins: row.sprint_wins || 0,
            sprint_podiums: row.sprint_podiums || 0,
            feature_wins: row.feature_wins || 0,
            feature_podiums: row.feature_podiums || 0,
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
        var statsClassControl = document.getElementById('stats-class-control');
        var statsClassSelect = document.getElementById('stats-class-filter');
        setupMinStartsSelect(statsMinStartsSelect, 'driver');
        var isStockCarStatsSeries = ['nascar_cup', 'noaps', 'nascar_truck', 'arca', 'nascar_modified'].indexOf(seriesKeyStats) >= 0;
        var isEngineStatsSeries = (seriesKeyStats === 'indycar' || seriesKeyStats === 'super_formula');
        function shouldShowManufacturerStats(seriesKey) {
          var key = String(seriesKey || '').toLowerCase();
          if (key.indexOf('f1-') === 0) return true;
          return [
            'f1', 'indycar', 'super_formula',
            'nascar_cup', 'noaps', 'nascar_truck', 'arca', 'nascar_modified',
            'supercars', 'dtm', 'wec', 'imsa', 'elms',
            'gtwce_end', 'gtwce_sprint', 'gtwc_america', 'super_gt'
          ].indexOf(key) >= 0;
        }
        var hasClassStats = data && Array.isArray(data.classes) && data.classes.length > 0;
        if (statsClassControl) statsClassControl.classList.toggle('hidden', !hasClassStats);
        if (statsClassSelect && hasClassStats) {
          statsClassSelect.innerHTML = '<option value="">' + esc(t('stats.all_classes') || 'All classes') + '</option>' + data.classes.map(function (cls) {
            return '<option value="' + esc(cls.name || cls.id || '') + '">' + esc(cls.name || cls.id || '') + '</option>';
          }).join('');
          if (['imsa', 'wec', 'elms', 'gtwce_end', 'gtwce_sprint', 'gtwc_america', 'super_gt'].indexOf(seriesKeyStats) >= 0 && data.classes[0]) {
            statsClassSelect.value = data.classes[0].name || data.classes[0].id || '';
          }
        } else if (statsClassSelect) {
          statsClassSelect.innerHTML = '';
        }
        var avgStartLabel = seriesKeyStats === 'supercars' ? t('stats.avg_qualifying') : t('standings.avg_start');

        function passesStatsFilter(row) {
          var minStarts = 0;
          if (statsMinStartsSelect && statsMinStartsSelect.value) {
            var parsed = parseInt(statsMinStartsSelect.value, 10);
            if (!isNaN(parsed) && parsed > 0) minStarts = parsed;
          }
          if (minStarts && (row.races || 0) < minStarts) return false;
          if (statsClassSelect && statsClassSelect.value && row.class !== statsClassSelect.value) return false;
          var q = statsFilterInput && statsFilterInput.value
            ? statsFilterInput.value.trim().toLowerCase()
            : '';
          if (!q) return true;
          var haystack = [
            row.driver || '',
            row.team || '',
            row.manufacturer || '',
            row.class || ''
          ].join(' ').toLowerCase();
          return haystack.indexOf(q) !== -1;
        }

        var driverNumericKeys = [
          'pos', 'car', 'races', 'wins', 'top2', 'top3', 'podiums', 'poles', 'top5', 'top10', 'top15', 'top20',
          'points', 'fastest_laps', 'dnfs', 'sprint_wins', 'sprint_podiums', 'feature_wins', 'feature_podiums',
          'avg_start', 'avg_qualifying', 'avg_finish', 'q2_passes', 'q3_passes', 'stage_wins', 'stage_points', 'avg_stage_points', 'laps_led',
          'laps_completed', 'laps_completed_pct', 'pos_diff'
        ];
        var avgStartFmt = function (row) {
          return (row.avg_start == null || row.avg_start === 0 || row.avg_start === '0') ? '—' : fmtNum(row.avg_start, 2);
        };
        var avgFinishFmt = function (row) { return fmtNum(row.avg_finish, 2); };
        var lapsPct = function (row) { return row.laps_completed_pct != null ? fmtNum(row.laps_completed_pct, 1) + '%' : '—'; };
        var posDiff = function (row) { return row.pos_diff != null ? fmtNum(row.pos_diff, 1) : '—'; };
        var avgStagePts = function (row) { return (row.avg_stage_points == null || row.avg_stage_points === 0 || row.avg_stage_points === '0') ? '—' : fmtNum(row.avg_stage_points, 2); };
        var driverColumns = [
          makeStatsColumn('pos', t('th.pos'), function (row) { return row.pos; }, 'col-num')
        ];
        if (hasAnyText(statsRows, 'car')) {
          driverColumns.push(makeStatsColumn('car', t('th.no'), function (row) { return esc(dash(row.car)); }, 'col-car'));
        }
        driverColumns.push(makeStatsColumn('driver', t('th.driver'), function (row) { return driverLink(row.driver); }));
        if (hasAnyText(statsRows, 'team')) {
          driverColumns.push(makeStatsColumn('team', t('th.team'), function (row) { return teamLink(row.team); }));
        }
        if (hasAnyText(statsRows, 'manufacturer')) {
          driverColumns.push(makeStatsColumn('manufacturer', isEngineStatsSeries ? t('th.engine') : t('th.manufacturer'), function (row) { return esc(dash(row.manufacturer || '')); }));
        }
        if (hasClassStats && hasAnyText(statsRows, 'class')) {
          driverColumns.push(makeStatsColumn('class', 'Class', function (row) { return esc(dash(row.class || '')); }));
        }
        driverColumns.push(makeStatsColumn('races', t('stats.starts_short'), function (row) { return row.races; }));
        driverColumns.push(makeStatsColumn('wins', t('standings.wins'), function (row) { return row.wins; }));
        if (hasAnyValue(statsRows, 'points')) {
          driverColumns.push(makeStatsColumn('points', t('standings.points'), function (row) { return fmtNum(row.points, 1); }));
        }
        if (hasAnyValue(statsRows, 'sprint_wins') || hasAnyValue(statsRows, 'sprint_podiums')) {
          driverColumns.push(makeStatsColumn('sprint_wins', 'Sprint W', function (row) { return row.sprint_wins; }));
          driverColumns.push(makeStatsColumn('sprint_podiums', 'Sprint Pod', function (row) { return row.sprint_podiums; }));
        }
        if (hasAnyValue(statsRows, 'feature_wins') || hasAnyValue(statsRows, 'feature_podiums')) {
          driverColumns.push(makeStatsColumn('feature_wins', 'Feature W', function (row) { return row.feature_wins; }));
          driverColumns.push(makeStatsColumn('feature_podiums', 'Feature Pod', function (row) { return row.feature_podiums; }));
        }
        if (!isStockCarStatsSeries && (hasAnyValue(statsRows, 'top2') || hasAnyValue(statsRows, 'top3'))) {
          driverColumns.push(makeStatsColumn('top2', t('stats.top2'), function (row) { return row.top2; }));
          driverColumns.push(makeStatsColumn('top3', t('stats.top3'), function (row) { return row.top3; }));
          driverColumns.push(makeStatsColumn('podiums', t('stats.podiums'), function (row) { return row.podiums; }));
        }
        if (hasAnyValue(statsRows, 'poles')) {
          driverColumns.push(makeStatsColumn('poles', t('standings.poles'), function (row) { return row.poles; }));
        }
        driverColumns.push(makeStatsColumn('top5', t('standings.top5'), function (row) { return row.top5; }));
        driverColumns.push(makeStatsColumn('top10', t('standings.top10'), function (row) { return row.top10; }));
        if (isStockCarStatsSeries) {
          driverColumns.push(makeStatsColumn('top15', t('standings.top15'), function (row) { return row.top15; }));
          driverColumns.push(makeStatsColumn('top20', t('standings.top20'), function (row) { return row.top20; }));
        }
        if (hasAnyValue(statsRows, 'avg_start')) {
          driverColumns.push(makeStatsColumn('avg_start', avgStartLabel, avgStartFmt));
        }
        if (isF1Stats && hasAnyValue(statsRows, 'avg_qualifying')) {
          driverColumns.push(makeStatsColumn('avg_qualifying', t('stats.avg_qualifying'), function (row) {
            return (row.avg_qualifying == null || row.avg_qualifying === 0 || row.avg_qualifying === '') ? '—' : fmtNum(row.avg_qualifying, 2);
          }));
        }
        driverColumns.push(makeStatsColumn('avg_finish', t('standings.avg_finish'), avgFinishFmt));
        if (isF1Stats && hasAnyValue(statsRows, 'q2_passes')) {
          driverColumns.push(makeStatsColumn('q2_passes', t('stats.q2'), function (row) { return row.q2_passes; }));
        }
        if (isF1Stats && hasAnyValue(statsRows, 'q3_passes')) {
          driverColumns.push(makeStatsColumn('q3_passes', t('stats.q3'), function (row) { return row.q3_passes; }));
        }
        if (hasAnyValue(statsRows, 'fastest_laps')) {
          driverColumns.push(makeStatsColumn('fastest_laps', t('stats.fastest_laps'), function (row) { return row.fastest_laps; }));
        }
        if (isEngineStatsSeries && hasAnyValue(statsRows, 'dnfs')) {
          driverColumns.push(makeStatsColumn('dnfs', 'DNF', function (row) { return row.dnfs; }));
        }
        if (hasAnyValue(statsRows, 'stage_wins') || hasAnyValue(statsRows, 'stage_points')) {
          driverColumns.push(makeStatsColumn('stage_wins', t('standings.stage_wins'), function (row) { return row.stage_wins; }));
          driverColumns.push(makeStatsColumn('stage_points', t('standings.stage_points'), function (row) { return row.stage_points; }));
          driverColumns.push(makeStatsColumn('avg_stage_points', t('standings.avg_stage_points'), avgStagePts));
        }
        if (hasAnyValue(statsRows, 'laps_led')) {
          driverColumns.push(makeStatsColumn('laps_led', t('stats.laps_led_short'), function (row) { return row.laps_led; }));
        }
        if (isStockCarStatsSeries && hasAnyValue(statsRows, 'laps_completed_pct')) {
          driverColumns.push(makeStatsColumn('laps_completed_pct', t('stats.laps_completed_pct'), lapsPct));
        } else if (!isStockCarStatsSeries && hasAnyValue(statsRows, 'laps_completed')) {
          driverColumns.push(makeStatsColumn('laps_completed', t('stats.laps_completed'), function (row) { return row.laps_completed; }));
        }
        if (hasAnyValue(statsRows, 'avg_start') && hasAnyValue(statsRows, 'pos_diff')) {
          driverColumns.push(makeStatsColumn('pos_diff', t('stats.pos_diff'), posDiff));
        }

        function renderStatsTable(dataArray) {
          var filtered = dataArray.filter(passesStatsFilter);
          tbody.innerHTML = filtered.map(function (row) {
            var td = driverColumns.map(function (col) {
              return '<td' + (col.className ? ' class="' + col.className + '"' : '') + '>' + col.render(row) + '</td>';
            }).join('');
            return '<tr>' + td + '</tr>';
          }).join('');
        }

        var statsTable = document.getElementById('stats-table');
        if (statsTable) {
          setStatsHead(statsTable, driverColumns);
          attachStatsSort(statsTable, driverColumns, statsRows, renderStatsTable, driverNumericKeys);
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
        if (statsClassSelect) {
          statsClassSelect.addEventListener('change', function () {
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
                points: row.points || 0,
                poles: row.poles || 0,
                top2: row.top2 || 0,
                top3: row.top3 || 0,
                podiums: row.podiums != null ? row.podiums : (row.wins || 0) + (row.top2 || 0) + (row.top3 || 0),
                top5: row.top5 || 0,
                top10: row.top10 || 0,
                top15: row.top15 || 0,
                top20: row.top20 || 0,
                fastest_laps: row.fastest_laps || 0,
                dnfs: row.dnfs || 0,
                sprint_wins: row.sprint_wins || 0,
                sprint_podiums: row.sprint_podiums || 0,
                feature_wins: row.feature_wins || 0,
                feature_podiums: row.feature_podiums || 0,
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
                var td = teamColumns.map(function (col) {
                  return '<td' + (col.className ? ' class="' + col.className + '"' : '') + '>' + col.render(row) + '</td>';
                }).join('');
                return '<tr>' + td + '</tr>';
              }).join('');
            }

            var teamHeadRow = teamTable.querySelector('thead tr');
            var teamColumns = [
              makeStatsColumn('pos', t('th.pos'), function (row) { return row.pos; }, 'col-num'),
              makeStatsColumn('team', t('th.team'), function (row) { return row.team === '—' ? '—' : teamLink(row.team); }),
              makeStatsColumn('races', t('stats.starts_short'), function (row) { return row.races; }),
              makeStatsColumn('wins', t('standings.wins'), function (row) { return row.wins; })
            ];
            if (hasAnyValue(teamData, 'points')) {
              teamColumns.push(makeStatsColumn('points', t('standings.points'), function (row) { return fmtNum(row.points, 1); }));
            }
            if (hasAnyValue(teamData, 'poles')) {
              teamColumns.push(makeStatsColumn('poles', t('standings.poles'), function (row) { return row.poles; }));
            }
            if (!isStockCarStatsSeries && (hasAnyValue(teamData, 'top2') || hasAnyValue(teamData, 'top3'))) {
              teamColumns.push(makeStatsColumn('top2', t('stats.top2'), function (row) { return row.top2; }));
              teamColumns.push(makeStatsColumn('top3', t('stats.top3'), function (row) { return row.top3; }));
              teamColumns.push(makeStatsColumn('podiums', t('stats.podiums'), function (row) { return row.podiums; }));
            }
            teamColumns.push(makeStatsColumn('top5', t('standings.top5'), function (row) { return row.top5; }));
            teamColumns.push(makeStatsColumn('top10', t('standings.top10'), function (row) { return row.top10; }));
            if (isStockCarStatsSeries) {
              teamColumns.push(makeStatsColumn('top15', t('standings.top15'), function (row) { return row.top15; }));
              teamColumns.push(makeStatsColumn('top20', t('standings.top20'), function (row) { return row.top20; }));
            }
            if (hasAnyValue(teamData, 'avg_start')) {
              teamColumns.push(makeStatsColumn('avg_start', avgStartLabel, function (row) {
                return (row.avg_start == null || row.avg_start === 0 || row.avg_start === '0') ? '—' : fmtNum(row.avg_start, 2);
              }));
            }
            teamColumns.push(makeStatsColumn('avg_finish', t('standings.avg_finish'), function (row) { return fmtNum(row.avg_finish, 2); }));
            if (hasAnyValue(teamData, 'fastest_laps')) {
              teamColumns.push(makeStatsColumn('fastest_laps', t('stats.fastest_laps'), function (row) { return row.fastest_laps; }));
            }
            if (hasAnyValue(teamData, 'dnfs')) {
              teamColumns.push(makeStatsColumn('dnfs', 'DNF', function (row) { return row.dnfs; }));
            }
            if (hasAnyValue(teamData, 'sprint_wins') || hasAnyValue(teamData, 'sprint_podiums')) {
              teamColumns.push(makeStatsColumn('sprint_wins', 'Sprint W', function (row) { return row.sprint_wins; }));
              teamColumns.push(makeStatsColumn('sprint_podiums', 'Sprint Pod', function (row) { return row.sprint_podiums; }));
            }
            if (hasAnyValue(teamData, 'feature_wins') || hasAnyValue(teamData, 'feature_podiums')) {
              teamColumns.push(makeStatsColumn('feature_wins', 'Feature W', function (row) { return row.feature_wins; }));
              teamColumns.push(makeStatsColumn('feature_podiums', 'Feature Pod', function (row) { return row.feature_podiums; }));
            }
            if (hasAnyValue(teamData, 'stage_wins') || hasAnyValue(teamData, 'stage_points')) {
              teamColumns.push(makeStatsColumn('stage_wins', t('standings.stage_wins'), function (row) { return row.stage_wins; }));
              teamColumns.push(makeStatsColumn('stage_points', t('standings.stage_points'), function (row) { return row.stage_points; }));
              teamColumns.push(makeStatsColumn('avg_stage_points', t('standings.avg_stage_points'), function (row) {
                return (row.avg_stage_points == null || row.avg_stage_points === 0 || row.avg_stage_points === '0') ? '—' : fmtNum(row.avg_stage_points, 2);
              }));
            }
            if (hasAnyValue(teamData, 'laps_led')) {
              teamColumns.push(makeStatsColumn('laps_led', t('stats.laps_led_short'), function (row) { return row.laps_led; }));
            }
            if (isStockCarStatsSeries && hasAnyValue(teamData, 'laps_completed_pct')) {
              teamColumns.push(makeStatsColumn('laps_completed_pct', t('stats.laps_completed_pct'), function (row) {
                return row.laps_completed_pct != null ? fmtNum(row.laps_completed_pct, 1) + '%' : '—';
              }));
            }
            if (hasAnyValue(teamData, 'avg_start') && hasAnyValue(teamData, 'pos_diff')) {
              teamColumns.push(makeStatsColumn('pos_diff', t('stats.pos_diff'), function (row) {
                return row.pos_diff != null ? fmtNum(row.pos_diff, 1) : '—';
              }));
            }
            if (teamHeadRow) {
              setStatsHead(teamTable, teamColumns);
              attachStatsSort(teamTable, teamColumns, teamData, renderTeamTable, driverNumericKeys);
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
        var manWrap = document.getElementById('manufacturer-stats-wrap');
        var showManufacturerStats = shouldShowManufacturerStats(seriesKeyStats);
        if (manWrap) manWrap.classList.toggle('hidden', !showManufacturerStats);
        if (!showManufacturerStats) {
          if (manTable) {
            var hiddenManTbody = manTable.querySelector('tbody');
            if (hiddenManTbody) hiddenManTbody.innerHTML = '';
          }
          if (manEmpty) manEmpty.classList.add('hidden');
        } else if (manTable) {
          var manTbody = manTable.querySelector('tbody');
          if (manRowsRaw && manRowsRaw.length > 0 && manTbody) {
            if (manEmpty) manEmpty.classList.add('hidden');
            var manData = manRowsRaw.map(function (row, idx) {
              return {
                pos: idx + 1,
                manufacturer: row.manufacturer || '',
                races: row.races || 0,
                wins: row.wins || 0,
                points: row.points || 0,
                poles: row.poles || 0,
                top2: row.top2 || 0,
                top3: row.top3 || 0,
                podiums: row.podiums != null ? row.podiums : (row.wins || 0) + (row.top2 || 0) + (row.top3 || 0),
                top5: row.top5 || 0,
                top10: row.top10 || 0,
                top15: row.top15 || 0,
                top20: row.top20 || 0,
                fastest_laps: row.fastest_laps || 0,
                dnfs: row.dnfs || 0,
                sprint_wins: row.sprint_wins || 0,
                sprint_podiums: row.sprint_podiums || 0,
                feature_wins: row.feature_wins || 0,
                feature_podiums: row.feature_podiums || 0,
                avg_start: row.avg_start,
                avg_qualifying: row.avg_qualifying,
                avg_finish: row.avg_finish,
                stage_wins: row.stage_wins || 0,
                stage_points: row.stage_points || 0,
                avg_stage_points: row.avg_stage_points,
                q2_passes: row.q2_passes != null ? row.q2_passes : 0,
                q3_passes: row.q3_passes != null ? row.q3_passes : 0,
                laps_led: row.laps_led || 0,
                laps_completed: row.laps_completed != null ? row.laps_completed : 0,
                laps_completed_pct: row.laps_completed_pct,
                pos_diff: row.pos_diff
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
                var td = manColumns.map(function (col) {
                  return '<td' + (col.className ? ' class="' + col.className + '"' : '') + '>' + col.render(row) + '</td>';
                }).join('');
                return '<tr>' + td + '</tr>';
              }).join('');
            }

            var manHeadRow = manTable.querySelector('thead tr');
            var manColumns = [
              makeStatsColumn('pos', t('th.pos'), function (row) { return row.pos; }, 'col-num'),
              makeStatsColumn('manufacturer', isEngineStatsSeries ? t('th.engine') : t('th.manufacturer'), function (row) { return esc(dash(row.manufacturer || '')); }),
              makeStatsColumn('races', t('stats.starts'), function (row) { return row.races; }),
              makeStatsColumn('wins', t('standings.wins'), function (row) { return row.wins; })
            ];
            if (hasAnyValue(manData, 'points')) {
              manColumns.push(makeStatsColumn('points', t('standings.points'), function (row) { return fmtNum(row.points, 1); }));
            }
            if (hasAnyValue(manData, 'poles')) {
              manColumns.push(makeStatsColumn('poles', t('standings.poles'), function (row) { return row.poles; }));
            }
            if (!isStockCarStatsSeries && (hasAnyValue(manData, 'top2') || hasAnyValue(manData, 'top3'))) {
              manColumns.push(makeStatsColumn('top2', t('stats.top2'), function (row) { return row.top2; }));
              manColumns.push(makeStatsColumn('top3', t('stats.top3'), function (row) { return row.top3; }));
              manColumns.push(makeStatsColumn('podiums', t('stats.podiums'), function (row) { return row.podiums; }));
            }
            manColumns.push(makeStatsColumn('top5', t('standings.top5'), function (row) { return row.top5; }));
            manColumns.push(makeStatsColumn('top10', t('standings.top10'), function (row) { return row.top10; }));
            if (isStockCarStatsSeries) {
              manColumns.push(makeStatsColumn('top15', t('standings.top15'), function (row) { return row.top15; }));
              manColumns.push(makeStatsColumn('top20', t('standings.top20'), function (row) { return row.top20; }));
            }
            if (hasAnyValue(manData, 'avg_start')) {
              manColumns.push(makeStatsColumn('avg_start', avgStartLabel, function (row) {
                return (row.avg_start == null || row.avg_start === 0 || row.avg_start === '0') ? '—' : fmtNum(row.avg_start, 2);
              }));
            }
            if (hasAnyValue(manData, 'avg_qualifying')) {
              manColumns.push(makeStatsColumn('avg_qualifying', t('stats.avg_qualifying'), function (row) {
                return (row.avg_qualifying == null || row.avg_qualifying === 0 || row.avg_qualifying === '') ? '—' : fmtNum(row.avg_qualifying, 2);
              }));
            }
            manColumns.push(makeStatsColumn('avg_finish', t('standings.avg_finish'), function (row) { return fmtNum(row.avg_finish, 2); }));
            if (hasAnyValue(manData, 'fastest_laps')) {
              manColumns.push(makeStatsColumn('fastest_laps', t('stats.fastest_laps'), function (row) { return row.fastest_laps; }));
            }
            if (hasAnyValue(manData, 'dnfs')) {
              manColumns.push(makeStatsColumn('dnfs', 'DNF', function (row) { return row.dnfs; }));
            }
            if (hasAnyValue(manData, 'sprint_wins') || hasAnyValue(manData, 'sprint_podiums')) {
              manColumns.push(makeStatsColumn('sprint_wins', 'Sprint W', function (row) { return row.sprint_wins; }));
              manColumns.push(makeStatsColumn('sprint_podiums', 'Sprint Pod', function (row) { return row.sprint_podiums; }));
            }
            if (hasAnyValue(manData, 'feature_wins') || hasAnyValue(manData, 'feature_podiums')) {
              manColumns.push(makeStatsColumn('feature_wins', 'Feature W', function (row) { return row.feature_wins; }));
              manColumns.push(makeStatsColumn('feature_podiums', 'Feature Pod', function (row) { return row.feature_podiums; }));
            }
            if (hasAnyValue(manData, 'stage_wins') || hasAnyValue(manData, 'stage_points')) {
              manColumns.push(makeStatsColumn('stage_wins', t('standings.stage_wins'), function (row) { return row.stage_wins; }));
              manColumns.push(makeStatsColumn('stage_points', t('standings.stage_points'), function (row) { return row.stage_points; }));
            }
            if (hasAnyValue(manData, 'q2_passes')) {
              manColumns.push(makeStatsColumn('q2_passes', t('stats.q2'), function (row) { return row.q2_passes; }));
            }
            if (hasAnyValue(manData, 'q3_passes')) {
              manColumns.push(makeStatsColumn('q3_passes', t('stats.q3'), function (row) { return row.q3_passes; }));
            }
            if (hasAnyValue(manData, 'laps_led')) {
              manColumns.push(makeStatsColumn('laps_led', t('standings.laps_led'), function (row) { return row.laps_led; }));
            }
            if (isStockCarStatsSeries && hasAnyValue(manData, 'laps_completed_pct')) {
              manColumns.push(makeStatsColumn('laps_completed_pct', t('stats.laps_completed_pct'), function (row) {
                return row.laps_completed_pct != null ? fmtNum(row.laps_completed_pct, 1) + '%' : '—';
              }));
            } else if (!isStockCarStatsSeries && hasAnyValue(manData, 'laps_completed')) {
              manColumns.push(makeStatsColumn('laps_completed', t('stats.laps_completed'), function (row) {
                return row.laps_completed != null ? row.laps_completed : '—';
              }));
            }
            if (hasAnyValue(manData, 'avg_start') && hasAnyValue(manData, 'pos_diff')) {
              manColumns.push(makeStatsColumn('pos_diff', t('stats.pos_diff'), function (row) {
                return row.pos_diff != null ? fmtNum(row.pos_diff, 1) : '—';
              }));
            }
            if (manHeadRow) {
              setStatsHead(manTable, manColumns);
              attachStatsSort(manTable, manColumns, manData, renderManTable, driverNumericKeys);
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

  API.getSeriesEvents(seriesId, null, { cacheBust: false })
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
        var supercarsSprintBanner = '<tr class="schedule-section-banner"><td colspan="7">' + esc(t('schedule.supercars_sprint')) + '</td></tr>';
        var supercarsEnduroBanner  = '<tr class="schedule-section-banner"><td colspan="7">' + esc(t('schedule.supercars_enduro')) + '</td></tr>';
        var supercarsFinalsBanner  = '<tr class="schedule-section-banner"><td colspan="7">' + esc(t('schedule.supercars_finals')) + '</td></tr>';
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
              '<th>' + esc(t('th.date')) + '</th>' +
              '<th>' + esc(t('th.time')) + '</th>';
          } else if (seriesKey === 'imsa') {
            // IMSA: Rnd. | Race | Length | Classes | Circuit | Location | Date
            schedHeadRow.innerHTML =
              '<th>' + esc(t('th.round')) + '</th>' +
              '<th>' + esc(t('th.race_col')) + '</th>' +
              '<th>' + esc(t('schedule.length')) + '</th>' +
              '<th>' + esc(t('schedule.classes')) + '</th>' +
              '<th>' + esc(t('th.circuit')) + '</th>' +
              '<th>' + esc(t('th.location')) + '</th>' +
              '<th>' + esc(t('th.date')) + '</th>';
          } else if (isIndycar) {
            schedHeadRow.innerHTML =
              '<th>' + esc(t('th.rd')) + '</th>' +
              '<th>' + esc(t('th.date')) + '</th>' +
              '<th>' + esc(t('th.race_col')) + '</th>' +
              '<th>' + esc(t('th.track')) + '</th>' +
              '<th>' + esc(t('th.location')) + '</th>' +
              '<th>' + esc(t('th.time')) + '</th>';
          } else if (isSuperFormula) {
            schedHeadRow.innerHTML =
              '<th>' + esc(t('th.rd')) + '</th>' +
              '<th>' + esc(t('th.date')) + '</th>' +
              '<th>' + esc(t('th.venue')) + '</th>' +
              '<th>' + esc(t('th.time')) + '</th>';
          } else if (isF1 && !isMultiRaceSchedule) {
            // F1 (current season): Round | Grand Prix | Circuit | Date | Time
            schedHeadRow.innerHTML =
              '<th>' + esc(t('th.round')) + '</th>' +
              '<th>' + esc(t('standings.grand_prix')) + '</th>' +
              '<th>' + esc(t('th.circuit')) + '</th>' +
              '<th>' + esc(t('th.date')) + '</th>' +
              '<th>' + esc(t('th.time')) + '</th>';
          } else if (isF1Season) {
            // Historical F1 seasons: Round | Grand Prix | Circuit | Race date (no Time column)
            schedHeadRow.innerHTML =
              '<th>' + esc(t('th.round')) + '</th>' +
              '<th>' + esc(t('standings.grand_prix')) + '</th>' +
              '<th>' + esc(t('th.circuit')) + '</th>' +
              '<th>' + esc(t('th.race_date')) + '</th>';
          } else if (isStockCarSeries) {
            schedHeadRow.innerHTML =
              '<th>' + esc(t('th.no')) + '</th>' +
              '<th>' + esc(t('th.race_col')) + '</th>' +
              '<th>' + esc(t('th.track')) + '</th>' +
              '<th>' + esc(t('th.location')) + '</th>' +
              '<th>' + esc(t('th.date')) + '</th>' +
              '<th>' + esc(t('th.time')) + '</th>';
          } else {
            schedHeadRow.innerHTML =
              '<th>' + esc(t('th.no')) + '</th>' +
              '<th>' + esc(t('th.date')) + '</th>' +
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
                '<td>' + esc(localizeVenueLine(r.track)) + '</td>' +
                '<td>' + esc(localizeLocation(r.location)) + '</td>' +
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
                '<td>' + esc(localizeEventName(r.grand_prix)) + '</td>' +
                '<td>' + esc(localizeVenueLine(r.circuit)) + '</td>' +
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
                '<td>' + esc(localizeEventName(r.grand_prix)) + '</td>' +
                '<td>' + esc(localizeVenueLine(r.circuit)) + '</td>' +
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
          var eventName = localizeEventFromData(Object.assign({}, e, { name: e.name || '—' }));
          if (isGroupedRaceSchedule) {
            var strippedName = (window.TGA && window.TGA.normalizeSeriesScheduleBaseName)
              ? window.TGA.normalizeSeriesScheduleBaseName(e.name || '')
              : String(e.name || '').replace(/\s+Race\s+\d+$/i, '').trim();
            eventName = localizeEventFromData(Object.assign({}, e, { name: strippedName })) || strippedName || '—';
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
          var trackNameRaw = e.circuit_name || e.location || '—';
          var trackName = trackNameRaw;
          if (isStockCarSeries && trackName !== '—' && trackName.indexOf(', ') >= 0) {
            trackName = trackName.split(', ')[0];
          }
          var trackNameDisplay = trackName === '—' ? '—' : localizeVenueLine(trackName);
          var trackSlug = slugify(e.circuit_name || e.location || trackName);
          var trackCell;
          var seriesKeyRow = (seriesId || '').toLowerCase();
          if (seriesKeyRow === 'wec') {
            // For WEC merge track cell only (no date) for Prologue and first round.
            if (opts.circuitContinuation) {
              trackCell = '';
            } else if (opts.circuitFirst && opts.circuitRowSpan && opts.circuitRowSpan > 1 && trackName !== '—') {
              trackCell = '<td rowspan="' + opts.circuitRowSpan + '" class="col-circuit-span"><a href="/track/' + encodeURIComponent(trackSlug) + '" class="track-link" data-track-name="' + esc(trackName) + '">' + esc(trackNameDisplay) + '</a></td>';
            } else if (opts.circuitFirst && opts.circuitRowSpan && opts.circuitRowSpan > 1 && trackName === '—') {
              trackCell = '<td rowspan="' + opts.circuitRowSpan + '" class="col-circuit-span">' + esc(trackName) + '</td>';
            } else if (trackName === '—') {
              trackCell = '<td>' + esc(trackName) + '</td>';
            } else {
              trackCell = '<td><a href="/track/' + encodeURIComponent(trackSlug) + '" class="track-link" data-track-name="' + esc(trackName) + '">' + esc(trackNameDisplay) + '</a></td>';
            }
          } else {
            if (opts.continuation || opts.groupContinuation) {
              trackCell = '';
            } else if (opts.groupFirst && opts.groupRowSpan > 1 && trackName !== '—') {
              trackCell = '<td rowspan="' + opts.groupRowSpan + '" class="col-circuit-span"><a href="/track/' + encodeURIComponent(trackSlug) + '" class="track-link" data-track-name="' + esc(trackName) + '">' + esc(trackNameDisplay) + '</a></td>';
            } else if (opts.groupFirst && opts.groupRowSpan > 1 && trackName === '—') {
              trackCell = '<td rowspan="' + opts.groupRowSpan + '" class="col-circuit-span">' + esc(trackName) + '</td>';
            } else if (trackName === '—') {
              trackCell = '<td>' + esc(trackName) + '</td>';
            } else {
              trackCell = '<td><a href="/track/' + encodeURIComponent(trackSlug) + '" class="track-link" data-track-name="' + esc(trackName) + '">' + esc(trackNameDisplay) + '</a></td>';
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
            var locText = e.location ? localizeLocation(e.location) : '—';
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
            var lengthCell = '<td>' + esc(localizeImsaScheduleLength(meta.length || '—')) + '</td>';
            var classesCell = '<td>' + esc(localizeImsaScheduleClasses(meta.classes || '—')) + '</td>';
            var locTextImsa = e.location ? localizeLocation(e.location) : '—';
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
            var locCellIndy = '<td>' + esc(e.location ? localizeLocation(e.location) : '—') + '</td>';
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
            var venueSfRaw = (window.TGA && window.TGA.superFormulaVenueLine)
              ? window.TGA.superFormulaVenueLine(e)
              : ((e.circuit_name || '') + (e.location ? ' — ' + e.location : '') || '—');
            var venueSf = venueSfRaw === '—' ? '—' : venueSfRaw;
            var trackSlugSf = slugify(e.circuit_name || e.location || venueSf);
            var venueCellSf = trackSlugSf && trackSlugSf !== '—'
              ? '<td><a href="/track/' + encodeURIComponent(trackSlugSf) + '" class="track-link" data-track-name="' + esc(e.circuit_name || venueSfRaw) + '">' + esc(venueSf) + '</a></td>'
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
            var locTextStockRaw = (e.circuit_name && e.circuit_name.indexOf(', ') >= 0)
              ? e.circuit_name.slice(e.circuit_name.indexOf(', ') + 2).trim()
              : (e.location || '—');
            var locTextStock = locTextStockRaw === '—' ? '—' : localizeLocation(locTextStockRaw);
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
            note.textContent = t('imsa.endurance_cup_note');
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
  translateStaticUI();
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
    thead.innerHTML = '<th>' + t('history.season') + '</th><th>' + t('history.races') + '</th><th>' + t('history.driver_champion') + '</th><th>' + t('th.pts') + '</th><th>' + t('th.team') + '</th><th>' + t('th.chassis') + '</th><th>' + t('th.engine') + '</th><th>' + t('history.constructors_champion') + '</th><th>' + t('th.pts') + '</th>';
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
      '<td>' + teamLink(team) + '</td>' +
      '<td>' + esc(chassis) + '</td>' +
      '<td>' + esc(engine) + '</td>' +
      '<td>' + esc(constructor) + '</td>' +
      '<td>' + constructorPtsCell + '</td>' +
      '</tr>';
  }
  historyBody.innerHTML = rowsHtml;
  if (typeof makeSimpleTableSortable === 'function') makeSimpleTableSortable(historyTable);
}

// For NASCAR Cup: DAY column must be based on Daytona 500 only,
// excluding exhibition Cook Out Clash (NASCAR_CUP_2026_0).
function rebuildNascarCupDayFromDaytona(baseData) {
  if (!baseData || typeof baseData !== 'object') return Promise.resolve(baseData);
  var raceOrder = Array.isArray(baseData.race_order) ? baseData.race_order.slice() : [];
  if (raceOrder.indexOf('DAY') < 0) return Promise.resolve(baseData);

  var eventId = 'NASCAR_CUP_2026_1'; // Daytona 500
  return API.getEvent(eventId, { cacheBust: false })
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

// ─── IMSA static class/regulations tables (/series/imsa/classes) ─────────────
function renderImsaClassesSpecIfNeeded() {
  var path = (window.location && window.location.pathname) || '';
  if (path.indexOf('/series/imsa/classes') !== 0) return;
  var el = document.getElementById('imsa-classes-static');
  var spec = window.IMSA_CLASSES_SPEC;
  if (!el || !spec) return;

  var locHeader = (typeof localizeTableHeader === 'function') ? localizeTableHeader : function (h) { return h; };
  var locKey = (typeof localizeSpecKey === 'function') ? localizeSpecKey : function (k) { return k; };
  var locVal = (typeof localizeSpecValue === 'function') ? localizeSpecValue : function (v) { return v; };
  var locSec = (typeof localizeSpecSection === 'function') ? localizeSpecSection : function (s) { return s; };

  var html = '';
  if (spec.classes && spec.classes.length) {
    html += '<div class="table-wrap"><table class="data-table"><thead><tr><th>' +
      esc(locHeader('Class')) + '</th></tr></thead><tbody>' +
      spec.classes.map(function (c) {
        return '<tr><td>' + esc(locVal(c)) + '</td></tr>';
      }).join('') +
      '</tbody></table></div>';
  }
  (spec.sections || []).forEach(function (sec) {
    html += '<h4 class="table-section-title">' + esc(locSec(sec.title)) + '</h4><div class="table-wrap"><table class="data-table">';
    if (sec.layout === 'compare') {
      html += '<thead><tr><th>' + esc(locHeader('Parameter')) + '</th>';
      (sec.columns || []).forEach(function (col) {
        html += '<th>' + esc(locHeader(col)) + '</th>';
      });
      html += '</tr></thead><tbody>';
      (sec.rows || []).forEach(function (row) {
        html += '<tr><td>' + esc(locKey(row.key)) + '</td>';
        (row.values || []).forEach(function (v) {
          html += '<td>' + esc(locVal(v)) + '</td>';
        });
        html += '</tr>';
      });
    } else {
      html += '<thead><tr><th>' + esc(locHeader('Parameter')) + '</th><th>' +
        esc(locHeader(sec.valueHeader || 'Value')) + '</th></tr></thead><tbody>';
      (sec.rows || []).forEach(function (row) {
        html += '<tr><td>' + esc(locKey(row.key)) + '</td><td>' + esc(locVal(row.value)) + '</td></tr>';
      });
    }
    html += '</tbody></table></div>';
  });
  el.innerHTML = html;
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
        ? t('specs.tech_regulations_2025')
        : t('specs.tech_regulations_2026');
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
    return '<h4 class="table-section-title">' + esc((typeof localizeSpecSection === 'function') ? localizeSpecSection(sec.title) : sec.title) + '</h4>' +
           '<div class="table-wrap tech-spec-section-table">' +
             '<table class="data-table table-field-value"><tbody>' + body + '</tbody></table>' +
           '</div>';
  }).join('');
}

  window.TGA.renderDetail = renderDetail;
  window.TGA.rebuildNascarCupDayFromDaytona = rebuildNascarCupDayFromDaytona;
  window.TGA.renderF1StaticSpecsIfNeeded = renderF1StaticSpecsIfNeeded;
  window.TGA.renderImsaClassesSpecIfNeeded = renderImsaClassesSpecIfNeeded;
  window.addEventListener('load', renderF1StaticSpecsIfNeeded);
  window.addEventListener('load', renderImsaClassesSpecIfNeeded);
})();
