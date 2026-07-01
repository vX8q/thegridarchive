// tga-series.js — F1 static data + series page helpers (buildF1TeamsTableHTML, etc.).
// renderDetail (full series page) lives in web/pages/series.js.
// Depends: lib/state.js, tga-i18n.js, tga-utils.js, fetch-json.js. Load before app.js.

(function () {
  'use strict';
  window.TGA = window.TGA || {};

  var state = window.TGA._state;
  var fetchJSON = window.TGA.fetchJSON;
  var logger = window.TGA.logger;
  var t = function (k) { return window.TGA.t(k); };
  var getLang = function () { return window.TGA.getLang(); };
  var esc = function (s) { return window.TGA.esc(s); };
  var dash = function (v) { return window.TGA.dash(v); };
  var isSeriesId = function (id, name) { return window.TGA.isSeriesId(id, name); };
  var driverDisplayName = function (n) { return window.TGA.driverDisplayName(n); };
  var addObjectTableSort = function (a, b, c, d, e) { return window.TGA.addObjectTableSort(a, b, c, d, e); };
  var trimTrailingZeros = function (s) { return window.TGA.trimTrailingZeros(s); };
  var specKeySkip = window.TGA.specKeySkip;
  var normalizeSpecKey = function (k) { return window.TGA.normalizeSpecKey(k); };
  var localizeSpecKey = function (k) { return window.TGA.localizeSpecKey(k); };
  var localizeSpecValue = function (v) { return window.TGA.localizeSpecValue(v); };
  var formatTimeForDisplay = function (r) { return window.TGA.formatTimeForDisplay(r); };
  var getTimeSettings = function () { return window.TGA.getTimeSettings(); };
  var parseTimeStringToParts = function (s) { return window.TGA.parseTimeStringToParts(s); };
  var formatDateRange = function (a, b) { return window.TGA.formatDateRange(a, b); };
  var formatDateRangeLong = function (a, b) { return window.TGA.formatDateRangeLong ? window.TGA.formatDateRangeLong(a, b) : (window.TGA.formatDateRange ? window.TGA.formatDateRange(a, b) : (a || '')); };
  var formatShortDate = function (s) { return window.TGA.formatShortDate ? window.TGA.formatShortDate(s) : (s || '').slice(0, 10); };
  var getScheduleTimeLabel = function (e, seriesId) { return (window.TGA.getScheduleTimeLabel && window.TGA.getScheduleTimeLabel(e, seriesId)) || (e.time_est || e.time_msk || '—'); };
  var countryHtml = function (c) { return window.TGA.countryHtml(c); };
  var syncStandingsScrollBars = function () { return window.TGA.syncStandingsScrollBars(); };
  var categoryBySeriesId = window.TGA.categoryBySeriesId;
  var renderSupercarsStaticSpecs = function () { return window.TGA.renderSupercarsStaticSpecs(); };
  var adjustDetailPanelPadding = function () { return window.TGA.adjustDetailPanelPadding(); };
  var adjustSeasonPanelPadding = function () { return window.TGA.adjustSeasonPanelPadding(); };

  function showView(id) {
    if (window.TGA.showView) window.TGA.showView(id);
  }
  function slugify(s) {
    return window.TGA.slugify ? window.TGA.slugify(s) : (s != null ? String(s).toLowerCase().replace(/[^a-z0-9\u0400-\u04ff]+/g, '-').replace(/^-+|-+$/g, '') : '');
  }
  function seriesIdToSlug(id) {
    return window.TGA.seriesIdToSlug ? window.TGA.seriesIdToSlug(id) : (id != null ? slugify(String(id).replace(/_/g, ' ')) : '');
  }

  var rebuildNascarCupDayFromDaytona = function (d) {
    return window.TGA.rebuildNascarCupDayFromDaytona ? window.TGA.rebuildNascarCupDayFromDaytona(d) : Promise.resolve(d);
  };

  // ─── F1 static data (keyed by season year where applicable) ─────────────────
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
    '2020': 17, '2021': 22, '2022': 22, '2023': 22, '2024': 24, '2025': 24
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

  // F1 2025 teams: canonical data for /season/f1-2025/teams (used when API returns wrong/2026 data)
  var F1_2025_TEAMS = [
    { manufacturer: 'Alpine-Renault', team: 'BWT Alpine F1 Team', number: '7', driver: 'Jack Doohan', rounds: '1–6' },
    { manufacturer: 'Alpine-Renault', team: 'BWT Alpine F1 Team', number: '43', driver: 'Franco Colapinto', rounds: '7–24' },
    { manufacturer: 'Alpine-Renault', team: 'BWT Alpine F1 Team', number: '10', driver: 'Pierre Gasly', rounds: 'All' },
    { manufacturer: 'Aston Martin Aramco-Mercedes', team: 'Aston Martin Aramco F1 Team', number: '14', driver: 'Fernando Alonso', rounds: 'All' },
    { manufacturer: 'Aston Martin Aramco-Mercedes', team: 'Aston Martin Aramco F1 Team', number: '18', driver: 'Lance Stroll', rounds: 'All' },
    { manufacturer: 'Ferrari', team: 'Scuderia Ferrari HP', number: '16', driver: 'Charles Leclerc', rounds: 'All' },
    { manufacturer: 'Ferrari', team: 'Scuderia Ferrari HP', number: '44', driver: 'Lewis Hamilton', rounds: 'All' },
    { manufacturer: 'Haas-Ferrari', team: 'MoneyGram Haas F1 Team', number: '31', driver: 'Esteban Ocon', rounds: 'All' },
    { manufacturer: 'Haas-Ferrari', team: 'MoneyGram Haas F1 Team', number: '87', driver: 'Oliver Bearman', rounds: 'All' },
    { manufacturer: 'Kick Sauber-Ferrari', team: 'Stake F1 Team Kick Sauber', number: '5', driver: 'Gabriel Bortoleto', rounds: 'All' },
    { manufacturer: 'Kick Sauber-Ferrari', team: 'Stake F1 Team Kick Sauber', number: '27', driver: 'Nico Hülkenberg', rounds: 'All' },
    { manufacturer: 'McLaren-Mercedes', team: 'McLaren Formula 1 Team', number: '4', driver: 'Lando Norris', rounds: 'All' },
    { manufacturer: 'McLaren-Mercedes', team: 'McLaren Formula 1 Team', number: '81', driver: 'Oscar Piastri', rounds: 'All' },
    { manufacturer: 'Mercedes', team: 'Mercedes-AMG Petronas F1 Team', number: '12', driver: 'Kimi Antonelli', rounds: 'All' },
    { manufacturer: 'Mercedes', team: 'Mercedes-AMG Petronas F1 Team', number: '63', driver: 'George Russell', rounds: 'All' },
    { manufacturer: 'Racing Bulls-Honda RBPT', team: 'Visa Cash App Racing Bulls F1 Team', number: '6', driver: 'Isack Hadjar', rounds: 'All' },
    { manufacturer: 'Racing Bulls-Honda RBPT', team: 'Visa Cash App Racing Bulls F1 Team', number: '22', driver: 'Yuki Tsunoda', rounds: '1–2' },
    { manufacturer: 'Racing Bulls-Honda RBPT', team: 'Visa Cash App Racing Bulls F1 Team', number: '30', driver: 'Liam Lawson', rounds: '3–24' },
    { manufacturer: 'Red Bull Racing-Honda RBPT', team: 'Oracle Red Bull Racing', number: '1', driver: 'Max Verstappen', rounds: 'All' },
    { manufacturer: 'Red Bull Racing-Honda RBPT', team: 'Oracle Red Bull Racing', number: '30', driver: 'Liam Lawson', rounds: '1–2' },
    { manufacturer: 'Red Bull Racing-Honda RBPT', team: 'Oracle Red Bull Racing', number: '22', driver: 'Yuki Tsunoda', rounds: '3–24' },
    { manufacturer: 'Williams-Mercedes', team: 'Atlassian Williams Racing', number: '23', driver: 'Alexander Albon', rounds: 'All' },
    { manufacturer: 'Williams-Mercedes', team: 'Atlassian Williams Racing', number: '55', driver: 'Carlos Sainz Jr.', rounds: 'All' }
  ];

  // F1 2025 teams: chassis and engine by constructor name (manufacturer)
  // Used for /season/f1-2025/teams and F1_2025_1 entry list.
  var F1_2025_CHASSIS = {
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
  var F1_2025_ENGINE = {
    'Alpine-Renault': 'Renault E-Tech RE25',
    'Aston Martin Aramco-Mercedes': 'Mercedes-AMG F1 M16',
    'Ferrari': 'Ferrari 066/15',
    'Haas-Ferrari': 'Ferrari 066/15',
    'Kick Sauber-Ferrari': 'Ferrari 066/15',
    'McLaren-Mercedes': 'Mercedes-AMG F1 M16',
    'Mercedes': 'Mercedes-AMG F1 M16',
    'Racing Bulls-Honda RBPT': 'Honda RBPTH003',
    'Red Bull Racing-Honda RBPT': 'Honda RBPTH003',
    'Williams-Mercedes': 'Mercedes-AMG F1 M16'
  };

  // Chassis map by driver name for F1 2025 (used on /season/f1-2025/stats).
  var F1_2025_CHASSIS_BY_DRIVER = {};
  F1_2025_TEAMS.forEach(function (t) {
    var man = t.manufacturer;
    var drv = t.driver;
    if (!man || !drv) return;
    var ch = F1_2025_CHASSIS[man];
    if (!ch) return;
    // If one driver appears in multiple rows (extra numbers/rounds),
    // keep the first non-empty value.
    if (!F1_2025_CHASSIS_BY_DRIVER[drv]) {
      F1_2025_CHASSIS_BY_DRIVER[drv] = ch;
    }
  });

  var F1_2025_TECH_SPEC = (typeof window !== 'undefined' && window.F1_2025_TECH_SPEC) || [];

  function buildF1TeamsTableHTML(teamsArr, chassisMeta, engineMeta) {
    if (!teamsArr || teamsArr.length === 0) return '';
    function teamLink(name) {
      return name ? '<a href="/team/' + encodeURIComponent(slugify(name)) + '" class="track-link">' + esc(name) + '</a>' : '—';
    }
    function driverLink(name) {
      if (window.TGA && window.TGA.driverLinkHtml) return window.TGA.driverLinkHtml(name);
      var display = driverDisplayName(name);
      var label = (window.TGA && window.TGA.driverLabel) ? window.TGA.driverLabel(name) : display;
      return display ? '<a href="/driver/' + encodeURIComponent(slugify(display)) + '" class="track-link">' + esc(label) + '</a>' : '—';
    }
    var len = teamsArr.length;
    var rows = [];
    var i = 0;
    while (i < len) {
      var base = teamsArr[i];
      var man = String(base.manufacturer || '').trim();
      var teamName = String(base.team || '').trim();
      var chassis = (chassisMeta && chassisMeta[man]) || '';
      var engine = (engineMeta && engineMeta[man]) || '';
      var span = 1;
      for (var j = i + 1; j < len; j++) {
        var t2 = teamsArr[j];
        if (String(t2.manufacturer || '').trim() !== man || String(t2.team || '').trim() !== teamName) break;
        span++;
      }
      for (var k = 0; k < span; k++) {
        var tm = teamsArr[i + k];
        var cells = '';
        if (k === 0) {
          cells += '<td rowspan="' + span + '">' + esc(dash(man)) + '</td>' +
                   '<td rowspan="' + span + '">' + esc(dash(chassis)) + '</td>' +
                   '<td rowspan="' + span + '">' + esc(dash(engine)) + '</td>' +
                   '<td rowspan="' + span + '">' + teamLink(teamName) + '</td>';
        }
        cells += '<td class="col-num">' + esc(dash(tm.number)) + '</td>' +
                 '<td>' + driverLink(tm.driver) + '</td>' +
                 '<td>' + esc(dash(tm.rounds)) + '</td>';
        rows.push('<tr>' + cells + '</tr>');
      }
      i += span;
    }
    var header = '<thead><tr>' +
      '<th data-i18n="th.manufacturer">' + t('th.manufacturer') + '</th>' +
      '<th data-i18n="th.chassis">' + t('th.chassis') + '</th>' +
      '<th data-i18n="th.engine">' + t('th.engine') + '</th>' +
      '<th data-i18n="th.team">' + t('th.team') + '</th>' +
      '<th data-i18n="th.no">' + t('th.no') + '</th>' +
      '<th data-i18n="th.driver">' + t('th.driver') + '</th>' +
      '<th data-i18n="th.rounds">' + t('th.rounds') + '</th></tr></thead>';
    return '<table class="data-table">' + header + '<tbody>' + rows.join('') + '</tbody></table>';
  }

  /** Entry-list format (F2, F3): Entrant/Team | No. | Driver name | Rounds, grouped by team (no country). */
  function buildEntryListTeamsTableHTML(teamsArr, seriesSlug) {
    if (!teamsArr || teamsArr.length === 0) return '';
    var isF3 = (seriesSlug || '').toLowerCase() === 'f3';
    var col1Header = isF3 ? t('th.entrant') : t('th.team');
    var col3Header = isF3 ? t('th.driver_name') : t('th.driver');
    function teamLink(name) {
      return name ? '<a href="/team/' + encodeURIComponent(slugify(name)) + '" class="track-link">' + esc(name) + '</a>' : '—';
    }
    function driverLink(name) {
      if (window.TGA && window.TGA.driverLinkHtml) return window.TGA.driverLinkHtml(name);
      var display = driverDisplayName(name);
      var label = (window.TGA && window.TGA.driverLabel) ? window.TGA.driverLabel(name) : display;
      return display ? '<a href="/driver/' + encodeURIComponent(slugify(display)) + '" class="track-link">' + esc(label) + '</a>' : '—';
    }
    var len = teamsArr.length;
    var rows = [];
    var i = 0;
    while (i < len) {
      var base = teamsArr[i];
      var teamName = String(base.team || '').trim();
      var teamCellText = teamLink(teamName);
      var span = 1;
      for (var j = i + 1; j < len; j++) {
        if (String(teamsArr[j].team || '').trim() !== teamName) break;
        span++;
      }
      for (var k = 0; k < span; k++) {
        var tm = teamsArr[i + k];
        var cells = k === 0 ? '<td rowspan="' + span + '">' + teamCellText + '</td>' : '';
        cells += '<td class="col-num">' + esc(dash(tm.number)) + '</td><td>' + driverLink(tm.driver) + '</td><td>' + esc(dash(tm.rounds)) + '</td>';
        rows.push('<tr>' + cells + '</tr>');
      }
      i += span;
    }
    var header = '<thead><tr><th>' + esc(col1Header) + '</th><th>' + esc(t('th.no')) + '</th><th>' + esc(col3Header) + '</th><th>' + esc(t('th.rounds')) + '</th></tr></thead>';
    return '<table class="data-table">' + header + '<tbody>' + rows.join('') + '</tbody></table>';
  }

  function eventRow(e, roundNum, seriesId) {
    if (isSeriesId(seriesId, 'super_formula')) {
      var formatEventRaceStartDate = window.TGA && window.TGA.formatEventRaceStartDate;
      var dateLabelSf = formatEventRaceStartDate
        ? formatEventRaceStartDate(e)
        : (formatShortDate ? formatShortDate((e.start_date || e.date || '').slice(0, 10)) : (e.start_date || e.date || ''));
      var rdSf = e._sfRdLabel ? String(e._sfRdLabel) : String(roundNum);
      var venueSf = (window.TGA && window.TGA.superFormulaVenueLine)
        ? window.TGA.superFormulaVenueLine(e)
        : ((e.circuit_name || '') + (e.location ? ' — ' + e.location : '') || '—');
      var timeLabelSf = getScheduleTimeLabel(e, seriesId);
      return '<tr><td class="col-num">' + esc(rdSf) + '</td><td>' + esc(dateLabelSf || '—') + '</td><td class="col-location">' + esc(venueSf) + '</td><td class="col-time">' + esc(timeLabelSf || '—') + '</td></tr>';
    }
    var formatEventRaceStartDate = window.TGA && window.TGA.formatEventRaceStartDate;
    var dateLabel = formatEventRaceStartDate
      ? formatEventRaceStartDate(e)
      : (formatShortDate ? formatShortDate((e.start_date || e.date || '').slice(0, 10)) : (e.start_date || e.date || ''));
    var name = e.name || '—';
    var eventSlug = (e.id || '').toLowerCase().replace(/_+/g, '-');
    var link = e.has_detail
      ? '<a href="/event/' + encodeURIComponent(eventSlug) + '" class="event-link">' + esc(name) + '</a>'
      : '<span class="event-no-data">' + esc(name) + '</span>';
    var loc = e.circuit_name || e.location || '—';
    var timeLabel = getScheduleTimeLabel(e, seriesId);
    return '<tr><td class="col-num">' + esc(String(roundNum)) + '</td><td>' + esc(dateLabel || '—') + '</td><td>' +
      link + '</td><td class="col-location">' + esc(loc) + '</td><td class="col-time">' + esc(timeLabel || '—') + '</td></tr>';
  }

  // renderDetail lives in web/pages/series.js. Dead renderSeries* removed.

  window.TGA.buildF1TeamsTableHTML = buildF1TeamsTableHTML;
  window.TGA.F1_2025_TEAMS = F1_2025_TEAMS;
  window.TGA.F1_2025_CHASSIS = F1_2025_CHASSIS;
  window.TGA.F1_2025_CHASSIS_BY_DRIVER = F1_2025_CHASSIS_BY_DRIVER;
  window.TGA.F1_2025_ENGINE = F1_2025_ENGINE;
  window.TGA.F1_2025_TECH_SPEC = F1_2025_TECH_SPEC;
})();
