// web/lib/deps.js — shared call-time deps for page modules
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  window.TGA = window.TGA || {};

  function wrap(name, fn) {
    return function () { return fn.apply(null, arguments); };
  }

  window.TGA.pageDeps = function pageDeps() {
    var T = window.TGA;
    return {
      t: wrap('t', function (k) { return T.t(k); }),
      getLang: wrap('getLang', function () { return T.getLang(); }),
      esc: wrap('esc', function (s) { return T.esc(s); }),
      dash: wrap('dash', function (v) { return T.dash(v); }),
      slugify: wrap('slugify', function (s) { return T.slugify(s); }),
      driverDisplayName: wrap('driverDisplayName', function (n) { return T.driverDisplayName(n); }),
      driverLabel: wrap('driverLabel', function (n) { return T.driverLabel(n); }),
      resolveDriverFromEntryList: wrap('resolveDriverFromEntryList', function (n, e) { return T.resolveDriverFromEntryList(n, e); }),
      teamLabel: wrap('teamLabel', function (n) { return T.teamLabel(n); }),
      isGuestEntryRow: wrap('isGuestEntryRow', function (r) { return T.isGuestEntryRow(r); }),
      guestCarNumberSet: wrap('guestCarNumberSet', function (el) { return T.guestCarNumberSet(el); }),
      entryListDriverCell: wrap('entryListDriverCell', function (r, g) { return T.entryListDriverCell(r, g); }),
      entryListDriverLabel: wrap('entryListDriverLabel', function (r, g) { return T.entryListDriverLabel(r, g); }),
      localizeStatKey: wrap('localizeStatKey', function (k) { return T.localizeStatKey(k); }),
      localizeStatValue: wrap('localizeStatValue', function (v) { return T.localizeStatValue(v); }),
      localizeSpecKey: wrap('localizeSpecKey', function (k) { return T.localizeSpecKey(k); }),
      localizeSpecSection: wrap('localizeSpecSection', function (s) { return T.localizeSpecSection(s); }),
      localizeSpecValue: wrap('localizeSpecValue', function (v) { return T.localizeSpecValue(v); }),
      normalizeSpecKey: wrap('normalizeSpecKey', function (k) { return T.normalizeSpecKey(k); }),
      specKeySkip: T.specKeySkip,
      localizeTableHeader: wrap('localizeTableHeader', function (h) { return T.localizeTableHeader(h); }),
      localizeCellNote: wrap('localizeCellNote', function (v) { return T.localizeCellNote(v); }),
      localizeRaceReason: wrap('localizeRaceReason', function (v) { return T.localizeRaceReason(v); }),
      localizeFreePass: wrap('localizeFreePass', function (v) { return T.localizeFreePass(v); }),
      localizeCautionFlagLabel: wrap('localizeCautionFlagLabel', function (t, c) { return T.localizeCautionFlagLabel(t, c); }),
      translateValueHeaders: T.translateValueHeaders,
      translateReasonHeaders: T.translateReasonHeaders,
      translateFreePassHeaders: T.translateFreePassHeaders,
      localizeDate: wrap('localizeDate', function (s) { return T.localizeDate(s); }),
      localizeDistance: wrap('localizeDistance', function (s) { return T.localizeDistance(s); }),
      localizeEventPreview: wrap('localizeEventPreview', function (s) { return T.localizeEventPreview(s); }),
      localizeTyreCompounds: wrap('localizeTyreCompounds', function (s) { return T.localizeTyreCompounds(s); }),
      localizeSectionTitle: wrap('localizeSectionTitle', function (s) { return T.localizeSectionTitle(s); }),
      localizeCompoundLegend: wrap('localizeCompoundLegend', function (s) { return T.localizeCompoundLegend(s); }),
      localizeEventName: wrap('localizeEventName', function (s) { return T.localizeEventName(s); }),
      localizeEventFromData: wrap('localizeEventFromData', function (d) { return T.localizeEventFromData(d); }),
      localizeRacingClass: wrap('localizeRacingClass', function (s) { return T.localizeRacingClass(s); }),
      localizeTeamName: wrap('localizeTeamName', function (n) { return T.localizeTeamName(n); }),
      localizeImsaScheduleLength: wrap('localizeImsaScheduleLength', function (v) { return T.localizeImsaScheduleLength(v); }),
      localizeImsaScheduleClasses: wrap('localizeImsaScheduleClasses', function (v) { return T.localizeImsaScheduleClasses(v); }),
      localizeQualifyingSeparator: wrap('localizeQualifyingSeparator', function (s) { return T.localizeQualifyingSeparator(s); }),
      documentTitle: wrap('documentTitle', function (m) { return T.documentTitle(m); }),
      localizeSeriesName: wrap('localizeSeriesName', function (n, id) { return T.localizeSeriesName(n, id); }),
      localizeCircuitName: wrap('localizeCircuitName', function (s) { return T.localizeCircuitName(s); }),
      localizeVenueLine: wrap('localizeVenueLine', function (s) { return T.localizeVenueLine(s); }),
      localizeLocation: wrap('localizeLocation', function (s) { return T.localizeLocation(s); }),
      localizeDriverName: wrap('localizeDriverName', function (s) { return T.localizeDriverName(s); }),
      localizeDriverNamesInText: wrap('localizeDriverNamesInText', function (s) { return T.localizeDriverNamesInText(s); }),
      driverTableCell: wrap('driverTableCell', function (r, j) { return T.driverTableCell(r, j); }),
      driverLinkHtml: wrap('driverLinkHtml', function (n) { return T.driverLinkHtml(n); }),
      trimTrailingZeros: wrap('trimTrailingZeros', function (s) { return T.trimTrailingZeros(s); }),
      countryHtml: wrap('countryHtml', function (c) { return T.countryHtml(c); }),
      categories: T.categories,
      categoryBySeriesId: T.categoryBySeriesId,
      seriesBadge: wrap('seriesBadge', function (id) { return T.seriesBadge(id); }),
      formatShortDate: wrap('formatShortDate', function (s) { return T.formatShortDate(s); }),
      formatEventRaceStartDate: wrap('formatEventRaceStartDate', function (e) { return T.formatEventRaceStartDate(e); }),
      buildEventMetaDate: wrap('buildEventMetaDate', function (d) { return T.buildEventMetaDate(d); }),
      formatDateRange: wrap('formatDateRange', function (a, b) { return T.formatDateRange(a, b); }),
      parseEventDate: wrap('parseEventDate', function (a, b, c) { return T.parseEventDate(a, b, c); }),
      formatDateRangeLong: wrap('formatDateRangeLong', function (a, b) { return T.formatDateRangeLong(a, b); }),
      getEventSessionDateRange: wrap('getEventSessionDateRange', function (d) { return T.getEventSessionDateRange(d); }),
      addObjectTableSort: wrap('addObjectTableSort', function (a, b, c, d, e) { return T.addObjectTableSort(a, b, c, d, e); }),
      typeLabel: wrap('typeLabel', function (k) { return T.typeLabel(k); }),
      syncStandingsScrollBars: wrap('syncStandingsScrollBars', function () { return T.syncStandingsScrollBars(); }),
      adjustEventPanelPadding: wrap('adjustEventPanelPadding', function () { return T.adjustEventPanelPadding(); }),
      adjustDetailPanelPadding: wrap('adjustDetailPanelPadding', function () { return T.adjustDetailPanelPadding(); }),
      renderSupercarsStaticSpecs: wrap('renderSupercarsStaticSpecs', function () { return T.renderSupercarsStaticSpecs(); }),
      translateStaticUI: wrap('translateStaticUI', function () { return T.translateStaticUI(); }),
      logger: T.logger || { error: function () {}, warn: function () {} },
      state: T._state,
      API: T.API,
      makeTableSortable: function () {
        var fn = (T.makeTableSortable) || (typeof window.makeTableSortable === 'function' ? window.makeTableSortable : null);
        if (typeof fn === 'function') return fn.apply(null, arguments);
      },
      makeSimpleTableSortable: function (tableEl) {
        var fn = T.makeSimpleTableSortable;
        if (typeof fn === 'function') fn(tableEl);
      },
      showView: function (activeId) {
        if (typeof T.showView === 'function') T.showView(activeId);
      },
    };
  };
})();
