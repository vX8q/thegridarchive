// Display formatting for calendar dates (uses TGA.getLang at call time).
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  window.TGA = window.TGA || {};

  function getLang() {
    return (window.TGA && window.TGA.getLang) ? window.TGA.getLang() : 'en';
  }

  function formatShortDate(dateStr) {
    if (!dateStr) return '—';
    var d = new Date(dateStr + 'T12:00:00');
    if (isNaN(d.getTime())) return dateStr;
    var months_en = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var months_ru = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    var day = d.getDate();
    var mon = getLang() === 'ru' ? months_ru[d.getMonth()] : months_en[d.getMonth()];
    return getLang() === 'ru' ? day + ' ' + mon : mon + ' ' + day;
  }

  function formatDateRange(startDs, endDs) {
    if (!startDs) return '—';
    var months_en = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var months_ru = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    var d1 = new Date(startDs + 'T12:00:00');
    if (!endDs || startDs === endDs) {
      var day = d1.getDate();
      var mon = getLang() === 'ru' ? months_ru[d1.getMonth()] : months_en[d1.getMonth()];
      return getLang() === 'ru' ? day + ' ' + mon : mon + ' ' + day;
    }
    var d2 = new Date(endDs + 'T12:00:00');
    var d1day = d1.getDate(), d2day = d2.getDate();
    var m1 = getLang() === 'ru' ? months_ru[d1.getMonth()] : months_en[d1.getMonth()];
    var m2 = getLang() === 'ru' ? months_ru[d2.getMonth()] : months_en[d2.getMonth()];
    if (d1.getMonth() === d2.getMonth()) {
      return getLang() === 'ru' ? d1day + '\u2013' + d2day + '\u00a0' + m1 : m1 + '\u00a0' + d1day + '\u2013' + d2day;
    }
    return getLang() === 'ru'
      ? d1day + '\u00a0' + m1 + '\u2013' + d2day + '\u00a0' + m2
      : m1 + '\u00a0' + d1day + '\u2013' + m2 + '\u00a0' + d2day;
  }

  /** Date range with full month name for event page: "March 5–8, 2026" */
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

  /** Date line for event page header (range from start_date/end_date, or prose date field). */
  function buildEventMetaDate(d) {
    if (!d) return '';
    var parseIso = window.TGA && window.TGA.parseIsoDatePrefix;
    var iso = parseIso || function () { return ''; };
    var startIso = iso(d.start_date || d.startDate);
    var endIso = iso(d.end_date || d.endDate);
    if (startIso && endIso && endIso > startIso) {
      return formatDateRange(startIso, endIso);
    }
    if (startIso) {
      var localizeDateFn = window.TGA && window.TGA.localizeDate;
      return typeof localizeDateFn === 'function' ? localizeDateFn(startIso) : formatShortDate(startIso);
    }
    var dateStr = String(d.date || '').trim();
    if (!dateStr) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      var localizeDateFn2 = window.TGA && window.TGA.localizeDate;
      return typeof localizeDateFn2 === 'function' ? localizeDateFn2(dateStr.slice(0, 10)) : dateStr.slice(0, 10);
    }
    return dateStr;
  }

  window.TGA.formatShortDate = formatShortDate;
  window.TGA.formatDateRange = formatDateRange;
  window.TGA.formatDateRangeLong = formatDateRangeLong;
  window.TGA.buildEventMetaDate = buildEventMetaDate;
})();
