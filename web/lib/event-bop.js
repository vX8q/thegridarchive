// IMSA Balance of Performance (extracted from event.js)
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  window.TGA = window.TGA || {};
  function t(key) { return window.TGA.t(key); }
  function getLang() { return window.TGA.getLang(); }
  function renderBopContent(escapeFn, eventData) {
    var e = escapeFn || function (s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
    var evKey = ((eventData && eventData.event_id) || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
    var isImsa2026Round1 = evKey === 'IMSA_2026_1';
    var isImsa2026Round2 = evKey === 'IMSA_2026_2';
    var isImsa2026Round3 = evKey === 'IMSA_2026_3';
    var isImsa2026Round4 = evKey === 'IMSA_2026_4';
    var isImsa2026Round5 = evKey === 'IMSA_2026_5';
    var isImsa2026Round6 = evKey === 'IMSA_2026_6';
    function bopH(key) { return t('event.bop.h.' + key); }
    function bopHeaders(keys) { return keys.map(bopH); }
    function localizeBopCell(val) {
      var s = String(val == null ? '' : val);
      if (getLang() !== 'ru') return s;
      if (s === 'BoP Table') return t('event.bop.bop_table');
      return s
        .replace(/\(2026 Homologation\)/g, t('event.bop.homologation_2026'))
        .replace(/\(2025 Homologation\)/g, t('event.bop.homologation_2025'));
    }
    function row(cells) {
      return '<tr>' + cells.map(function (c) {
        return '<td>' + e(localizeBopCell(c)).replace(/\n/g, '<br>') + '</td>';
      }).join('') + '</tr>';
    }
    function theadRow(cells) { return '<tr>' + cells.map(function (c) { return '<th>' + e(c) + '</th>'; }).join('') + '</tr>'; }
    function bopNotes(noteKeys) {
      var items = noteKeys.map(function (k) {
        return '<li>' + e(t('event.bop.note.' + k)) + '</li>';
      }).join('');
      return '<p class="bop-notes"><strong>' + e(t('event.bop.notes_label')) + '</strong></p><ul class="bop-notes-list">' + items + '</ul>';
    }
    var gtpCars = isImsa2026Round3 ? [
      ['Acura', 'ARX-06', '1059', '9512', '96.2', '97.1', '190', '200', '901', '22.525', 'R80'],
      ['Aston Martin', 'Valkyrie', '1030', '8400', '100.0', '100.0', '190', '200', '913', '22.825', 'R80'],
      ['BMW', 'M Hybrid V8', '1059', '8000', '99.0', '96.9', '190', '200', '908', '22.700', 'R80'],
      ['Cadillac', 'V-Series.R', '1058', '8800', '98.3', '97.1', '190', '200', '906', '22.650', 'R80'],
      ['Porsche', '963 (2026 Homologation)', '1100', '8158', '92.3', '100.0', '190', '200', '913', '22.825', 'R80'],
      ['Porsche', '963 (2025 Homologation)', '1060', '8158', '96.0', '96.0', '190', '200', '906', '22.650', 'R80']
    ] : isImsa2026Round5 ? [
      ['Acura', 'ARX-06', '1051', '9512', '100.0', '96.2', '190', '200', '907', '22.675', 'R80'],
      ['Aston Martin', 'Valkyrie', '1030', '8400', '100.0', '100.0', '190', '200', '909', '22.725', 'R80'],
      ['BMW', 'M Hybrid V8', '1031', '8000', '99.6', '94.0', '190', '200', '896', '22.400', 'R80'],
      ['Cadillac', 'V-Series.R', '1038', '8800', '98.5', '95.2', '190', '200', '896', '22.400', 'R80'],
      ['Porsche', '963 (2026 Homologation)', '1100', '8158', '94.0', '100.0', '190', '200', '910', '22.750', 'R80'],
      ['Porsche', '963 (2025 Homologation)', '1082', '8158', '98.8', '98.3', '190', '200', '914', '22.850', 'R80']
    ] : isImsa2026Round4 ? [
      ['Acura', 'ARX-06', '1056', '9512', '97.7', '97.3', '190', '200', '904', '22.600', 'R80'],
      ['Aston Martin', 'Valkyrie', '1030', '8400', '100.0', '100.0', '190', '200', '913', '22.825', 'R80'],
      ['BMW', 'M Hybrid V8', '1042', '8000', '98.5', '95.4', '190', '200', '902', '22.550', 'R80'],
      ['Cadillac', 'V-Series.R', '1043', '8800', '98.1', '96.0', '190', '200', '901', '22.525', 'R80'],
      ['Porsche', '963 (2026 Homologation)', '1084', '8158', '92.3', '100.0', '190', '200', '891', '22.275', 'R80'],
      ['Porsche', '963 (2025 Homologation)', '1052', '8158', '96.0', '97.3', '190', '200', '895', '22.375', 'R80']
    ] : isImsa2026Round6 ? [
      ['Acura', 'ARX-06', '1045', '9512', '98.3', '99.6', '230', '240', '911', '22.775', 'R80'],
      ['Aston Martin', 'Valkyrie', '1020', '8400', '100.0', '100.0', '230', '240', '914', '22.850', 'R80'],
      ['BMW', 'M Hybrid V8', '1030', '8000', '98.8', '96.9', '230', '240', '901', '22.525', 'R80'],
      ['Cadillac', 'V-Series.R', '1032', '8800', '97.1', '99.0', '230', '240', '903', '22.575', 'R80'],
      ['Porsche', '963 (2026 Homologation)', '1073', '8158', '96.3', '100.0', '230', '240', '913', '22.825', 'R80'],
      ['Porsche', '963 (2025 Homologation)', '1058', '8158', '100.0', '97.3', '230', '240', '909', '22.725', 'R80']
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
    var gtpRegForRender = (isImsa2026Round4 || isImsa2026Round5 || isImsa2026Round6)
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
    ] : isImsa2026Round5 ? [
      ['BMW', 'M4 GT3 EVO', '1338', '7500', '92.3', '90.3', '170', '180', '-2.0', '5.0', '875', '21.875'],
      ['Corvette', 'Z06 GT3.R', '1370', '8000', '97.6', '96.1', '170', '180', '-1.8', '6.4', '889', '22.225'],
      ['Ford', 'Mustang GT3', '1326', '8250', '100.0', '96.5', '170', '180', '-0.4', '7.1', '890', '22.250'],
      ['Lamborghini', 'Temerario GT3', '1337', '8000', '87.9', '88.0', '170', '180', '1.0', '5.2', '888', '22.200'],
      ['Lexus', 'RC F GT3', '1356', '7200', '95.6', '95.8', '170', '180', '4.0', '11.0', '914', '22.850'],
      ['McLaren', '720S GT3 EVO', '1330', '8100', '93.2', '92.3', '170', '180', '3.1', '11.3', '887', '22.175'],
      ['Porsche', '911 GT3 R (992)', '1384', '8950', '92.7', '97.3', '170', '180', '7.3', '9.3', '874', '21.850']
    ] : isImsa2026Round6 ? [
      ['Aston Martin', 'Vantage GT3 EVO', '1287', '7000', '87.6', '86.3', '190', '200', '5.0', '11.1', '858', '21.450'],
      ['BMW', 'M4 GT3 EVO', '1340', '7500', '91.0', '93.2', '190', '200', '-2.0', '5.0', '890', '22.250'],
      ['Corvette', 'Z06 GT3.R', '1373', '8000', '98.4', '99.8', '190', '200', '-1.8', '6.4', '926', '23.150'],
      ['Ferrari', '296 GT3 EVO', '1350', '7750', '83.9', '88.6', '190', '200', '-1.7', '4.1', '875', '21.875'],
      ['Ford', 'Mustang GT3', '1332', '8250', '99.3', '98.7', '190', '200', '-0.4', '7.1', '932', '23.300'],
      ['Lamborghini', 'Huracan GT3 EVO2', '1353', '8300', '85.8', '90.8', '190', '200', '2.0', '8.4', '917', '22.925'],
      ['Lamborghini', 'Temerario GT3', '1340', '8000', '86.3', '91.5', '190', '200', '1.0', '5.2', '923', '23.075'],
      ['Lexus', 'RC F GT3', '1356', '7200', '96.1', '98.6', '190', '200', '4.0', '11.0', '988', '24.700'],
      ['McLaren', '720S GT3 EVO', '1330', '8100', '94.6', '94.3', '190', '200', '3.1', '11.3', '924', '23.100'],
      ['Mercedes-AMG', 'GT3', '1356', '7900', '95.5', '90.9', '190', '200', '0.0', '9.0', '964', '24.100'],
      ['Porsche', '911 GT3 R (992)', '1374', '8950', '97.1', '100.0', '190', '200', '7.3', '9.3', '887', '22.175']
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
    var gtpHead = bopHeaders(['manufacturer', 'car_model', 'weight_kg', 'nmax_rpm', 'power_le_v1', 'power_ge_v2', 'v1_kmh', 'v2_kmh', 'max_stint_energy', 'replenishment_rate', 'fuel']);
    var gtpRegHead = bopHeaders(['regulatory_param', 'gtp', 'unit']);
    var gtdHead = bopHeaders(['manufacturer', 'car_model', 'weight_kg', 'nmax_rpm', 'power_le_v1', 'power_ge_v2', 'v1_kmh', 'v2_kmh', 'wing_min', 'wing_max', 'max_stint_energy', 'replenishment_rate']);
    var gtdRegHead = bopHeaders(['parameter', 'value', 'unit']);
    var out = '';
    out += '<div class="bop-content">';
    var bopTitleKey = 'event.bop.title.daytona';
    var bopRound = '1';
    if (isImsa2026Round2) {
      bopTitleKey = 'event.bop.title.sebring';
      bopRound = '2';
    } else if (isImsa2026Round3) {
      bopTitleKey = 'event.bop.title.long_beach';
      bopRound = '3';
    } else if (isImsa2026Round4) {
      bopTitleKey = 'event.bop.title.monterey';
      bopRound = '4';
    } else if (isImsa2026Round5) {
      bopTitleKey = 'event.bop.title.detroit';
      bopRound = '5';
    } else if (isImsa2026Round6) {
      bopTitleKey = 'event.bop.title.watkins_glen';
      bopRound = '6';
    } else if (isImsa2026Round1) {
      bopTitleKey = 'event.bop.title.daytona';
      bopRound = '1';
    }
    var bopTitle = t(bopTitleKey);
    var bopSubtitle = t('event.bop.subtitle').replace('{round}', bopRound);
    out += '<h2 class="bop-main-title">' + e(bopTitle) + '</h2>';
    out += '<p class="bop-subtitle">' + e(bopSubtitle) + '</p>';
    out += '<hr class="bop-divider">';
    out += '<h3 class="bop-class-title">' + e(t('event.bop.gtp_class')) + '</h3>';
    out += '<div class="table-wrap"><table class="data-table bop-table">';
    out += '<thead>' + theadRow(gtpHead) + '</thead><tbody>';
    gtpCars.forEach(function (r) { out += row(r); });
    out += '</tbody></table></div>';
    out += bopNotes(['gtp_1', 'gtp_2', 'gtp_3']);
    if (!isImsa2026Round3) {
      out += '<h4 class="table-section-title">' + e(t('event.bop.gtp_reg_title')) + '</h4>';
      out += '<div class="table-wrap"><table class="data-table bop-table">';
      out += '<thead>' + theadRow(gtpRegHead) + '</thead><tbody>';
      gtpRegForRender.forEach(function (r) { out += row(r); });
      out += '</tbody></table></div>';
    }
    out += '<hr class="bop-divider">';
    out += '<h3 class="bop-class-title">' + e(t(isImsa2026Round3 ? 'event.bop.gtd_class' : 'event.bop.gtd_pro_class')) + '</h3>';
    out += '<div class="table-wrap"><table class="data-table bop-table bop-table--wide">';
    out += '<thead>' + theadRow(gtdHead) + '</thead><tbody>';
    gtdCars.forEach(function (r) { out += row(r); });
    out += '</tbody></table></div>';
    out += bopNotes(['gtd_1', 'gtd_2', 'gtd_3', 'gtd_4', 'gtd_5', 'gtd_6']);
    if (!isImsa2026Round3) {
      out += '<h4 class="table-section-title">' + e(t('event.bop.gtd_reg_title')) + '</h4>';
      out += '<div class="table-wrap"><table class="data-table bop-table">';
      out += '<thead>' + theadRow(gtdRegHead) + '</thead><tbody>';
      gtdReg.forEach(function (r) { out += row(r); });
      out += '</tbody></table></div>';
    }
    out += '</div>';
    return out;
  }
  window.TGA.renderBopContent = renderBopContent;
})();
