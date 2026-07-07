// Stock-car race/qualifying transforms (NASCAR Cup, NOAPS, Truck, ARCA, Modified).
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  window.TGA = window.TGA || {};

  var STOCK_CAR_SERIES = ['nascar_cup', 'noaps', 'nascar_truck', 'arca', 'nascar_modified'];
  var STAGE_SERIES = ['nascar_cup', 'noaps', 'nascar_truck'];

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

  function hasStageTableRows(tables, n) {
    var t = tgaStageTable(tables, n);
    return !!(t && Array.isArray(t.rows) && t.rows.length > 0);
  }

  function isStockCarSeriesId(seriesId) {
    return STOCK_CAR_SERIES.indexOf(String(seriesId || '').toLowerCase()) >= 0;
  }

  function seriesUsesStages(seriesId) {
    return STAGE_SERIES.indexOf(String(seriesId || '').toLowerCase()) >= 0;
  }

  function stockCarHasStageFormat(d, tables) {
    if (!d) return false;
    if (d.stage4_laps || hasStageTableRows(tables, 4)) return true;
    if (d.stage1_laps || d.stage2_laps || d.stage3_laps) return true;
    return hasStageTableRows(tables, 1) || hasStageTableRows(tables, 2) || hasStageTableRows(tables, 3);
  }

  function hasStage4(d, tables) {
    return !!(d && (d.stage4_laps || hasStageTableRows(tables, 4)));
  }

  function isAllstarStageRace(tables) {
    var rr = tables && tables.race_results;
    return !!(rr && rr.format === 'allstar_stages' && Array.isArray(rr.stages) && rr.stages.length > 0);
  }

  /** @returns {string[]} ordered section labels for assertions */
  function stockCarRaceSectionPlan(d, tables, opts) {
    opts = opts || {};
    var isStockCar = opts.isStockCar !== false;
    if (!isStockCar || isAllstarStageRace(tables)) return [];

    var hasRR = !!(tables.race_results && Array.isArray(tables.race_results.rows) && tables.race_results.rows.length > 0);
    if (!hasRR) return [];

    var stageFormat = stockCarHasStageFormat(d, tables);
    var four = hasStage4(d, tables);
    var out = [];

    if (stageFormat) out.push('heading:race_results');
    if (!stageFormat) {
      out.push('table:race_results');
      return out;
    }

    if (hasStageTableRows(tables, 1)) out.push('table:stage_1');
    if (hasStageTableRows(tables, 2)) out.push('table:stage_2');

    var skipStage3Points = !four && hasStageTableRows(tables, 3);
    if (hasStageTableRows(tables, 3) && !skipStage3Points) out.push('table:stage_3_points');

    if (four && hasStageTableRows(tables, 4) && !hasRR) out.push('table:stage_4_points');

    if (four) out.push('table:race_results_as_stage_4');
    else out.push('table:race_results_as_stage_3');

    return out;
  }

  function shouldSkipStage3PointsTable(isStockCar, fourStage, tables) {
    return !!(isStockCar && !fourStage && tables.race_results &&
      Array.isArray(tables.race_results.rows) && tables.race_results.rows.length > 0 &&
      hasStageTableRows(tables, 3));
  }

  function stageLapsTitle(stageKey, laps, t) {
    var label = (typeof t === 'function' && t(stageKey)) ? t(stageKey) : stageKey;
    if (!laps) return label;
    var lapsWord = (typeof t === 'function' && t('stage.laps')) ? t('stage.laps') : 'laps';
    return label + ' (' + laps + ' ' + lapsWord + ')';
  }

  function stockCarStage3TableTitle(d, tables, isStockCar, t) {
    var defaultTitle = stageLapsTitle('table.stage3', d && d.stage3_laps, t);
    if (isStockCar && tgaStageTable(tables, 3) && !(tables.race_results && tables.race_results.rows && tables.race_results.rows.length)) {
      return stageLapsTitle('table.race_results', d && d.stage3_laps, t);
    }
    return defaultTitle;
  }

  function stockCarRaceResultsTitles(d, stageFormat, fourStage, isStockCar, t) {
    var raceResults = (typeof t === 'function' && t('table.race_results')) ? t('table.race_results') : 'Race Results';
    if (!isStockCar) {
      return { title: raceResults, subtitle: null };
    }
    if (fourStage) {
      var title = (typeof t === 'function' && t('table.stage4')) ? t('table.stage4') : 'Stage 4';
      if (d && d.stage4_laps) {
        title = stageLapsTitle('table.stage4', d.stage4_laps, t);
      }
      return { title: title, subtitle: null };
    }
    if (stageFormat) {
      return {
        title: stageLapsTitle('table.stage3', d && d.stage3_laps, t),
        subtitle: null
      };
    }
    return { title: raceResults, subtitle: null };
  }

  function cautionBreakdownReasonColIndex(headers) {
    if (!Array.isArray(headers)) return 4;
    for (var i = 0; i < headers.length; i++) {
      var h = String(headers[i] || '').trim().toLowerCase();
      if (h === 'reason' || h === 'причина') return i;
    }
    return 4;
  }

  function cautionBreakdownFreePassColIndex(headers) {
    if (!Array.isArray(headers)) return -1;
    for (var i = 0; i < headers.length; i++) {
      var h = String(headers[i] || '').trim().toLowerCase();
      if (h === 'free pass' || h === 'своб. проезд') return i;
    }
    return -1;
  }

  function cautionBreakdownHasFreePass(cell) {
    var fp = String(cell == null ? '' : cell).trim();
    if (!fp) return false;
    return fp.toLowerCase() !== 'none';
  }

  function isCautionBreakdownCautionRow(row, headers) {
    if (!row || !Array.isArray(row)) return false;
    var reasonIdx = cautionBreakdownReasonColIndex(headers);
    if (reasonIdx >= 0 && String(row[reasonIdx] || '').trim() !== '') return true;
    var fpIdx = cautionBreakdownFreePassColIndex(headers);
    if (fpIdx >= 0 && cautionBreakdownHasFreePass(row[fpIdx])) return true;
    var condIdx = -1;
    if (Array.isArray(headers)) {
      for (var ci = 0; ci < headers.length; ci++) {
        if (String(headers[ci] || '').trim().toLowerCase() === 'condition') { condIdx = ci; break; }
      }
    }
    if (condIdx >= 0) {
      var cond = String(row[condIdx] || '').trim().toLowerCase();
      if (cond && cond !== 'green' && cond !== 'green flag') return true;
    }
    return false;
  }

  function cautionBreakdownRowClass(row, headers) {
    return isCautionBreakdownCautionRow(row, headers)
      ? 'caution-row caution-row-caution'
      : 'caution-row caution-row-green';
  }

  function qualCarNoColumnIndex(headers) {
    if (!Array.isArray(headers)) return 1;
    for (var ci = 0; ci < headers.length; ci++) {
      var hc = String(headers[ci] || '').trim().toLowerCase();
      if (hc === 'no.' || hc === 'no' || hc === 'car' || hc === '#') return ci;
    }
    return 1;
  }

  function qualifyingExcludingDidNotQualify(qualTable, dnqTable) {
    if (!qualTable || !dnqTable || !Array.isArray(qualTable.rows) || !Array.isArray(dnqTable.rows) || !dnqTable.rows.length) {
      return qualTable;
    }
    var qualNoIdx = qualCarNoColumnIndex(qualTable.headers);
    var dnqNoIdx = qualCarNoColumnIndex(dnqTable.headers);
    var dnqNos = {};
    dnqTable.rows.forEach(function (row) {
      if (!row || row.length <= dnqNoIdx) return;
      var no = String(row[dnqNoIdx] || '').trim();
      if (no) dnqNos[no] = true;
    });
    if (!Object.keys(dnqNos).length) return qualTable;
    return {
      headers: qualTable.headers,
      rows: qualTable.rows.filter(function (row) {
        if (!row || row.length <= qualNoIdx) return true;
        return !dnqNos[String(row[qualNoIdx] || '').trim()];
      }),
      meta: qualTable.meta,
      title: qualTable.title,
      format: qualTable.format,
      sessions: qualTable.sessions,
      note: qualTable.note
    };
  }

  window.TGA.tgaStageTable = tgaStageTable;
  window.TGA.hasStageTableRows = hasStageTableRows;
  window.TGA.isStockCarSeriesId = isStockCarSeriesId;
  window.TGA.seriesUsesStages = seriesUsesStages;
  window.TGA.stockCarHasStageFormat = stockCarHasStageFormat;
  window.TGA.hasStage4 = hasStage4;
  window.TGA.isAllstarStageRace = isAllstarStageRace;
  window.TGA.stockCarRaceSectionPlan = stockCarRaceSectionPlan;
  window.TGA.shouldSkipStage3PointsTable = shouldSkipStage3PointsTable;
  window.TGA.stockCarStage3TableTitle = stockCarStage3TableTitle;
  window.TGA.stockCarRaceResultsTitles = stockCarRaceResultsTitles;
  window.TGA.qualCarNoColumnIndex = qualCarNoColumnIndex;
  window.TGA.qualifyingExcludingDidNotQualify = qualifyingExcludingDidNotQualify;
  window.TGA.cautionBreakdownReasonColIndex = cautionBreakdownReasonColIndex;
  window.TGA.cautionBreakdownFreePassColIndex = cautionBreakdownFreePassColIndex;
  window.TGA.isCautionBreakdownCautionRow = isCautionBreakdownCautionRow;
  window.TGA.cautionBreakdownRowClass = cautionBreakdownRowClass;
})();
