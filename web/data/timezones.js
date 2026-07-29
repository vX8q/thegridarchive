// Source: data/timezones-reference.json — keep in sync when editing event/location rules
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  var MSK_IANA = 'Europe/Moscow';
  var EVENT_TIMEZONES = {
  "F1_2026_16": "Asia/Kuala_Lumpur",
  "IMSA_2026_1": "America/New_York",
  "IMSA_2026_2": "America/New_York",
  "IMSA_2026_3": "America/Los_Angeles",
  "IMSA_2026_4": "America/Los_Angeles",
  "IMSA_2026_5": "America/Detroit",
  "IMSA_2026_6": "America/New_York",
  "IMSA_2026_7": "America/Toronto",
  "IMSA_2026_8": "America/Chicago",
  "IMSA_2026_9": "America/New_York",
  "IMSA_2026_10": "America/Indiana/Indianapolis",
  "IMSA_2026_11": "America/New_York",
  "INDYCAR_2026_1": "America/New_York",
  "INDYCAR_2026_2": "America/Phoenix",
  "INDYCAR_2026_3": "America/Chicago",
  "INDYCAR_2026_4": "America/Chicago",
  "INDYCAR_2026_5": "America/Los_Angeles",
  "INDYCAR_2026_6": "America/Indiana/Indianapolis",
  "INDYCAR_2026_7": "America/Indiana/Indianapolis",
  "INDYCAR_2026_8": "America/Detroit",
  "INDYCAR_2026_9": "America/Chicago",
  "INDYCAR_2026_10": "America/Chicago",
  "INDYCAR_2026_11": "America/New_York",
  "INDYCAR_2026_13": "America/Los_Angeles",
  "INDYCAR_2026_14": "America/Toronto",
  "INDYCAR_2026_16": "America/Chicago",
  "INDYCAR_2026_17": "America/Chicago",
  "INDYCAR_2026_18": "America/Los_Angeles",
  "DTM_2026_1": "Europe/Vienna",
  "DTM_2026_2": "Europe/Amsterdam",
  "DTM_2026_3": "Europe/Berlin",
  "DTM_2026_4": "Europe/Berlin",
  "DTM_2026_5": "Europe/Berlin",
  "DTM_2026_6": "Europe/Berlin",
  "DTM_2026_7": "Europe/Berlin",
  "DTM_2026_8": "Europe/Berlin",
  "FREC_2026_1": "Europe/Vienna",
  "FREC_2026_2": "Europe/Amsterdam",
  "FREC_2026_3": "Europe/Brussels",
  "FREC_2026_4": "Europe/Rome",
  "FREC_2026_5": "Europe/Budapest",
  "FREC_2026_6": "Europe/Paris",
  "FREC_2026_7": "Europe/Rome",
  "FREC_2026_8": "Europe/Berlin",
  "F4_IT_2026_1": "Europe/Rome",
  "F4_IT_2026_2": "Europe/Rome",
  "F4_IT_2026_3": "Europe/Rome",
  "F4_IT_2026_4": "Europe/Rome",
  "F4_IT_2026_5": "Europe/Rome",
  "F4_IT_2026_6": "Europe/Rome",
  "F4_IT_2026_7": "Europe/Rome",
  "GTWCE_SPRINT_2026_1": "Europe/London",
  "GTWCE_SPRINT_2026_2": "Europe/Rome",
  "GTWCE_SPRINT_2026_3": "Europe/Paris",
  "GTWCE_SPRINT_2026_4": "Europe/Amsterdam",
  "GTWCE_SPRINT_2026_5": "Europe/Madrid",
  "WEC_2026_PROLOGUE": "Europe/Rome",
  "WEC_2026_1": "Europe/Rome",
  "WEC_2026_2": "Europe/Brussels",
  "WEC_2026_3": "Europe/Paris",
  "WEC_2026_4": "America/Sao_Paulo",
  "WEC_2026_5": "America/Chicago",
  "WEC_2026_6": "Asia/Tokyo",
  "WEC_2026_7": "Europe/Madrid",
  "WEC_2026_8": "Europe/Rome",
  "ELMS_2026_PROLOGUE": "Europe/Madrid",
  "ELMS_2026_1": "Europe/Madrid",
  "ELMS_2026_2": "Europe/Paris",
  "ELMS_2026_3": "Europe/Rome",
  "ELMS_2026_4": "Europe/Brussels",
  "ELMS_2026_5": "Europe/London",
  "ELMS_2026_6": "Europe/Lisbon",
  "GTWCE_END_2026_1": "Europe/Paris",
  "GTWCE_END_2026_2": "Europe/Rome",
  "GTWCE_END_2026_3": "Europe/Brussels",
  "GTWCE_END_2026_4": "Europe/Berlin",
  "GTWCE_END_2026_5": "Europe/Lisbon",
  "PSC_2026_1": "Europe/Monaco",
  "PSC_2026_3": "Europe/Vienna",
  "PSC_2026_4": "Europe/Brussels",
  "PSC_2026_5": "Europe/Budapest",
  "PSC_2026_6": "Europe/Amsterdam",
  "PSC_2026_7": "Europe/Amsterdam",
  "PSC_2026_8": "Europe/Rome",
  "SUPER_GT_2026_1": "Asia/Tokyo",
  "SUPER_GT_2026_2": "Asia/Tokyo",
  "SUPER_GT_2026_4": "Asia/Tokyo",
  "SUPER_GT_2026_5": "Asia/Tokyo",
  "SUPER_GT_2026_6": "Asia/Tokyo",
  "SUPER_GT_2026_7": "Asia/Tokyo",
  "SUPER_GT_2026_8": "Asia/Tokyo",
  "SUPERCARS_2026_1": "Australia/Sydney",
  "SUPERCARS_2026_2": "Australia/Sydney",
  "SUPERCARS_2026_3": "Australia/Sydney",
  "SUPERCARS_2026_4": "Australia/Melbourne",
  "SUPERCARS_2026_5": "Australia/Melbourne",
  "SUPERCARS_2026_6": "Australia/Melbourne",
  "SUPERCARS_2026_7": "Australia/Melbourne",
  "SUPERCARS_2026_8": "Pacific/Auckland",
  "SUPERCARS_2026_9": "Pacific/Auckland",
  "SUPERCARS_2026_10": "Pacific/Auckland",
  "SUPERCARS_2026_11": "Pacific/Auckland",
  "SUPERCARS_2026_12": "Pacific/Auckland",
  "SUPERCARS_2026_13": "Pacific/Auckland",
  "SUPERCARS_2026_14": "Australia/Hobart",
  "SUPERCARS_2026_15": "Australia/Hobart",
  "SUPERCARS_2026_16": "Australia/Hobart",
  "SUPERCARS_2026_17": "Australia/Darwin",
  "SUPERCARS_2026_18": "Australia/Darwin",
  "SUPERCARS_2026_19": "Australia/Darwin",
  "SUPERCARS_2026_20": "Australia/Brisbane",
  "SUPERCARS_2026_21": "Australia/Brisbane",
  "SUPERCARS_2026_22": "Australia/Brisbane",
  "SUPERCARS_2026_23": "Australia/Perth",
  "SUPERCARS_2026_24": "Australia/Perth",
  "SUPERCARS_2026_25": "Australia/Perth",
  "SUPERCARS_2026_26": "Australia/Brisbane",
  "SUPERCARS_2026_27": "Australia/Brisbane",
  "SUPERCARS_2026_28": "Australia/Brisbane",
  "SUPERCARS_2026_29": "Australia/Adelaide",
  "SUPERCARS_2026_30": "Australia/Sydney",
  "SUPERCARS_2026_31": "Australia/Brisbane",
  "SUPERCARS_2026_32": "Australia/Brisbane",
  "SUPERCARS_2026_33": "Australia/Melbourne",
  "SUPERCARS_2026_34": "Australia/Melbourne",
  "SUPERCARS_2026_35": "Australia/Adelaide",
  "SUPERCARS_2026_36": "Australia/Adelaide",
  "SUPERCARS_2026_37": "Australia/Adelaide"
};
  var EVENT_RACE_DATES = {
  "ELMS_2026_PROLOGUE": "2026-04-06",
  "ELMS_2026_1": "2026-04-12",
  "ELMS_2026_2": "2026-05-03",
  "ELMS_2026_3": "2026-07-05",
  "ELMS_2026_4": "2026-08-23",
  "ELMS_2026_5": "2026-09-13",
  "ELMS_2026_6": "2026-10-10",
  "GTWCE_END_2026_1": "2026-04-11",
  "GTWCE_END_2026_2": "2026-05-31",
  "GTWCE_END_2026_3": "2026-06-27",
  "GTWCE_END_2026_4": "2026-08-30",
  "GTWCE_END_2026_5": "2026-10-18",
  "PSC_2026_1": "2026-06-07",
  "PSC_2026_3": "2026-06-28",
  "PSC_2026_4": "2026-07-19",
  "PSC_2026_5": "2026-07-26",
  "PSC_2026_6": "2026-08-22",
  "PSC_2026_7": "2026-08-23",
  "PSC_2026_8": "2026-09-06",
  "IMSA_2026_1": "2026-01-24",
  "IMSA_2026_2": "2026-03-21",
  "IMSA_2026_3": "2026-04-19",
  "IMSA_2026_4": "2026-05-03",
  "IMSA_2026_5": "2026-05-30",
  "IMSA_2026_6": "2026-06-28",
  "IMSA_2026_7": "2026-07-12",
  "IMSA_2026_8": "2026-08-02",
  "IMSA_2026_9": "2026-08-23",
  "IMSA_2026_10": "2026-09-20",
  "IMSA_2026_11": "2026-10-03",
  "INDYCAR_2026_1": "2026-03-01",
  "INDYCAR_2026_2": "2026-03-07",
  "INDYCAR_2026_3": "2026-03-15",
  "INDYCAR_2026_4": "2026-03-29",
  "INDYCAR_2026_5": "2026-04-19",
  "INDYCAR_2026_6": "2026-05-09",
  "INDYCAR_2026_7": "2026-05-24",
  "INDYCAR_2026_8": "2026-05-31",
  "INDYCAR_2026_9": "2026-06-07",
  "INDYCAR_2026_10": "2026-06-21",
  "INDYCAR_2026_11": "2026-07-05",
  "INDYCAR_2026_13": "2026-08-09",
  "INDYCAR_2026_14": "2026-08-16",
  "INDYCAR_2026_16": "2026-08-29",
  "INDYCAR_2026_17": "2026-08-30",
  "INDYCAR_2026_18": "2026-09-06",
  "SUPER_GT_2026_1": "2026-04-12",
  "SUPER_GT_2026_2": "2026-05-04",
  "SUPER_GT_2026_4": "2026-08-02",
  "SUPER_GT_2026_5": "2026-08-23",
  "SUPER_GT_2026_6": "2026-09-20",
  "SUPER_GT_2026_7": "2026-10-18",
  "SUPER_GT_2026_8": "2026-11-08"
};
  var NASCAR_EASTERN = ["NASCAR_CUP","NOAPS","NASCAR_XFINITY","NASCAR_TRUCK","ARCA","NASCAR_MODIFIED"];
  var US_LOCAL_TRACK = ["INDYCAR","IMSA"];

  var LOCATION_RULES = [
    { re: /melbourne|albert park|sandown|springvale/i, tz: 'Australia/Melbourne' },
    { re: /sydney|eastern creek|bathurst|mount panorama/i, tz: 'Australia/Sydney' },
    { re: /taup[oō]|new zealand|christchurch|euromarque|auckland/i, tz: 'Pacific/Auckland' },
    { re: /darwin|hidden valley/i, tz: 'Australia/Darwin' },
    { re: /townsville|brisbane|gold coast|surfers|queensland|ipswich/i, tz: 'Australia/Brisbane' },
    { re: /perth|wanneroo/i, tz: 'Australia/Perth' },
    { re: /adelaide|bend|tailem/i, tz: 'Australia/Adelaide' },
    { re: /hobart|launceston|tasmania|symmons/i, tz: 'Australia/Hobart' },
    { re: /shanghai/i, tz: 'Asia/Shanghai' },
    { re: /sepang|kuala lumpur|selangor/i, tz: 'Asia/Kuala_Lumpur' },
    { re: /suzuka|japan|fuji|motegi|sugo|super gt|okayama/i, tz: 'Asia/Tokyo' },
    { re: /sakhir|bahrain international/i, tz: 'Asia/Bahrain' },
    { re: /yas marina|abu dhabi/i, tz: 'Asia/Dubai' },
    { re: /jeddah|saudi/i, tz: 'Asia/Riyadh' },
    { re: /las vegas|paradise, nevada/i, tz: 'America/Los_Angeles' },
    { re: /austin|circuit of the americas|cota/i, tz: 'America/Chicago' },
    { re: /long beach|monterey|laguna|portland/i, tz: 'America/Los_Angeles' },
    { re: /phoenix|avondale/i, tz: 'America/Phoenix' },
    { re: /detroit/i, tz: 'America/Detroit' },
    { re: /madison|elkhart|road america|milwaukee|chicago|arlington|birmingham, alabama/i, tz: 'America/Chicago' },
    { re: /indianapolis|speedway, indiana/i, tz: 'America/Indiana/Indianapolis' },
    { re: /bowmanville|ontario|markham|montreal/i, tz: 'America/Toronto' },
    { re: /miami|daytona|st\. petersburg|nashville|watkins glen|virginia|north carolina|bowman gray|lexington|charlotte|martinsville|darlington|talladega|bristol|richmond|dover|pocono|new hampshire/i, tz: 'America/New_York' },
    { re: /mexico city|mexico/i, tz: 'America/Mexico_City' },
    { re: /s[aã]o paulo|interlagos|brazil/i, tz: 'America/Sao_Paulo' },
    { re: /lusail|qatar/i, tz: 'Asia/Qatar' },
    { re: /singapore|marina bay/i, tz: 'Asia/Singapore' },
    { re: /baku|azerbaijan/i, tz: 'Asia/Baku' },
    { re: /monaco/i, tz: 'Europe/Monaco' },
    { re: /imola|monza|madrid|madring|barcelona|montmel[oó]|mugello/i, tz: 'Europe/Rome' },
    { re: /spa|stavelot|zandvoort|brussels|n[uü]rburg|nurburg/i, tz: 'Europe/Brussels' },
    { re: /silverstone/i, tz: 'Europe/London' },
    { re: /hungaroring|mogyor[oó]d/i, tz: 'Europe/Budapest' },
    { re: /spielberg|red bull ring/i, tz: 'Europe/Vienna' },
    { re: /hockenheim|norisring|nuremberg|oschersleben|lausitzring|klettwitz|sachsenring|hohenstein/i, tz: 'Europe/Berlin' },
    { re: /zandvoort/i, tz: 'Europe/Amsterdam' },
    { re: /barcelona|catalunya/i, tz: 'Europe/Madrid' },
    { re: /estoril|portim[aã]o|lisbon/i, tz: 'Europe/Lisbon' },
    { re: /le castellet|paul ricard/i, tz: 'Europe/Paris' }
  ];

  function inferTrackTimezone(ev) {
    if (!ev) return null;
    if (ev.id && EVENT_TIMEZONES[ev.id]) return EVENT_TIMEZONES[ev.id];
    var blob = (String(ev.location || '') + ' ' + String(ev.circuit_name || '') + ' ' + String(ev.name || '')).toLowerCase();
    for (var i = 0; i < LOCATION_RULES.length; i++) {
      if (LOCATION_RULES[i].re.test(blob)) return LOCATION_RULES[i].tz;
    }
    return null;
  }

  function resolveEventTimezone(ev, seriesId) {
    var sid = String(seriesId || (ev && ev.series_id) || '').toUpperCase();
    var tz = inferTrackTimezone(ev);
    if (tz) return tz;
    if (NASCAR_EASTERN.indexOf(sid) >= 0) return 'America/New_York';
    return null;
  }

  function getLocalTzToUtcOffsetHours(y, m, d, tz) {
    if (typeof Intl === 'undefined' || !Intl.DateTimeFormat || !tz) return 0;
    try {
      var utcNoon = Date.UTC(Number(y), Number(m) - 1, Number(d), 12, 0);
      var formatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false });
      var parts = formatter.formatToParts(new Date(utcNoon));
      var hourPart = parts.find(function (p) { return p.type === 'hour'; });
      var localHour = hourPart ? parseInt(hourPart.value, 10) : 12;
      return 12 - localHour;
    } catch (e) {
      return 0;
    }
  }

  function localTrackToUtcMs(y, m, d, hour, minute, tz) {
    var offset = getLocalTzToUtcOffsetHours(y, m, d, tz);
    return Date.UTC(Number(y), Number(m) - 1, Number(d), hour + offset, minute || 0);
  }

  function getRaceDateIso(ev) {
    if (!ev) return '';
    if (EVENT_RACE_DATES[ev.id]) return EVENT_RACE_DATES[ev.id];
    var start = String(ev.start_date || ev.date || '').slice(0, 10);
    var end = String(ev.end_date || ev.endDate || '').slice(0, 10);
    if (end && end > start) return end;
    return start;
  }

  window.TGA_TIMEZONES = {
    MSK_IANA: MSK_IANA,
    EVENT_TIMEZONES: EVENT_TIMEZONES,
    EVENT_RACE_DATES: EVENT_RACE_DATES,
    NASCAR_EASTERN: NASCAR_EASTERN,
    US_LOCAL_TRACK: US_LOCAL_TRACK,
    inferTrackTimezone: inferTrackTimezone,
    resolveEventTimezone: resolveEventTimezone,
    localTrackToUtcMs: localTrackToUtcMs,
    getRaceDateIso: getRaceDateIso
  };
})();
