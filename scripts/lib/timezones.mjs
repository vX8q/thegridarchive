/**
 * TGA timezone utilities — IANA-based conversion with DST on race date.
 * Reference data: data/timezones-reference.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const libDir = path.dirname(fileURLToPath(import.meta.url));
const refPath = path.join(libDir, '..', '..', 'data', 'timezones-reference.json');
const ref = JSON.parse(fs.readFileSync(refPath, 'utf8'));

export const MSK_IANA = ref.msk.iana;
export const EVENT_TIMEZONES = ref.eventTimezones;
export const EVENT_RACE_DATES = ref.eventRaceDates;
export const NASCAR_EASTERN_SERIES = new Set(ref.nascarEasternSeries);
export const US_LOCAL_TRACK_SERIES = new Set(ref.usLocalTrackSeries);
export const TIMEZONE_OFFSETS = ref.offsets;
export const DST_RULES_2026 = ref.dstRules2026;

const locationRules = ref.locationRules.map((r) => ({
  re: new RegExp(r.pattern, 'i'),
  tz: r.tz,
}));

export function parse12h(t) {
  const m = String(t || '').trim().match(/(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?|AM|PM)/i);
  if (!m) return null;
  let h = +m[1];
  const min = +m[2];
  const ap = m[3].replace(/\./g, '').toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return { h, min };
}

export function parse24h(t) {
  const m = String(t || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return { h: +m[1], min: +m[2] };
}

export function parseTime(t) {
  return parse12h(t) || parse24h(t);
}

/** IANA offset in minutes at local noon on iso date (accounts for DST). */
export function tzOffsetMinutesAt(iso, tz) {
  const [y, mo, d] = iso.split('-').map(Number);
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' });
  const offStr = dtf.formatToParts(new Date(Date.UTC(y, mo - 1, d, 12))).find((x) => x.type === 'timeZoneName')?.value || '';
  const om = offStr.match(/GMT([+-])(\d+)(?::(\d+))?/);
  if (!om) return 0;
  const sign = om[1] === '+' ? 1 : -1;
  return sign * (+om[2] * 60 + (+(om[3] || 0)));
}

/** UTC ms for wall-clock (h, min) on iso date in IANA timezone. */
export function utcMsFromLocal(iso, h, min, tz) {
  const [y, mo, d] = iso.split('-').map(Number);
  const offMin = tzOffsetMinutesAt(iso, tz);
  return Date.UTC(y, mo - 1, d, h, min) - offMin * 60 * 1000;
}

export function formatMskPlain(utcMs) {
  const mp = new Intl.DateTimeFormat('en-US', {
    timeZone: MSK_IANA,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(utcMs));
  const g = (t) => mp.find((x) => x.type === t)?.value;
  return `${g('hour')}:${g('minute')}`;
}

export function formatMskEmbedded(utcMs) {
  const mp = new Intl.DateTimeFormat('en-US', {
    timeZone: MSK_IANA,
    month: 'numeric',
    day: 'numeric',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(utcMs));
  const g = (t) => mp.find((x) => x.type === t)?.value;
  return `${g('month')}/${g('day')}/${g('year')} ${g('hour')}:${g('minute')}`;
}

export function mskDateIsoFromUtc(utcMs) {
  const mp = new Intl.DateTimeFormat('en-US', {
    timeZone: MSK_IANA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(utcMs));
  const g = (t) => mp.find((x) => x.type === t)?.value;
  return `${g('year')}-${g('month')}-${g('day')}`;
}

export function inferTrackTimezone(ev) {
  if (!ev) return null;
  if (ev.id && EVENT_TIMEZONES[ev.id]) return EVENT_TIMEZONES[ev.id];
  const blob = `${ev.location || ''} ${ev.circuit_name || ''} ${ev.name || ''}`.toLowerCase();
  for (const { re, tz } of locationRules) {
    if (re.test(blob)) return tz;
  }
  return null;
}

export function resolveEventTimezone(ev, seriesId) {
  const sid = String(seriesId || ev?.series_id || '').toUpperCase();
  return (
    inferTrackTimezone(ev)
    || (NASCAR_EASTERN_SERIES.has(sid) ? 'America/New_York' : null)
  );
}

export function getRaceDateIso(ev) {
  if (!ev) return '';
  if (EVENT_RACE_DATES[ev.id]) return EVENT_RACE_DATES[ev.id];
  const start = String(ev.start_date || ev.date || '').slice(0, 10);
  const end = String(ev.end_date || '').slice(0, 10);
  if (end && end > start) return end;
  return start;
}

export function mskUtcCandidates(msk, raceDateIso, sid) {
  const s = String(msk || '').trim();
  const dated = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(.+)$/);
  if (dated) {
    const p = parseTime(dated[4]);
    if (!p) return [];
    if (NASCAR_EASTERN_SERIES.has(sid) && raceDateIso) {
      const [y, mo, d] = raceDateIso.split('-').map(Number);
      return [
        Date.UTC(y, mo - 1, d, p.h - 3, p.min),
        Date.UTC(y, mo - 1, d + 1, p.h - 3, p.min),
      ];
    }
    let yr = +dated[3];
    if (yr < 100) yr += 2000;
    return [Date.UTC(yr, +dated[1] - 1, +dated[2], p.h - 3, p.min)];
  }
  const p = parseTime(s);
  if (!p || !raceDateIso) return [];
  const [y, mo, d] = raceDateIso.split('-').map(Number);
  return [
    Date.UTC(y, mo - 1, d - 1, p.h - 3, p.min),
    Date.UTC(y, mo - 1, d, p.h - 3, p.min),
    Date.UTC(y, mo - 1, d + 1, p.h - 3, p.min),
  ];
}

export function expectedUtcMs(ev, sid, raceDateIso, timeEst) {
  if (sid === 'SUPER_FORMULA') {
    const p = parse24h(timeEst);
    if (!p || !raceDateIso) return 0;
    const [y, mo, d] = raceDateIso.split('-').map(Number);
    return Date.UTC(y, mo - 1, d, p.h - 9, p.min);
  }
  const tz = resolveEventTimezone(ev, sid);
  const p = parseTime(timeEst);
  if (!p || !raceDateIso || !tz) return 0;
  return utcMsFromLocal(raceDateIso, p.h, p.min, tz);
}

export function matchesUtc(candidates, expUtc) {
  return candidates.some((c) => c && Math.abs(c - expUtc) <= 60000);
}

/** Local → MSK for schedule JSON (plain or embedded). */
export function localToMskSchedule(raceDateIso, timeLocal, tz, { plainWhenSameMskDay = true } = {}) {
  const p = parseTime(timeLocal);
  if (!p || !raceDateIso || !tz) return null;
  const utcMs = utcMsFromLocal(raceDateIso, p.h, p.min, tz);
  const embedded = formatMskEmbedded(utcMs);
  const plain = formatMskPlain(utcMs);
  const mskDay = mskDateIsoFromUtc(utcMs);
  return {
    time_msk: plainWhenSameMskDay && mskDay === raceDateIso ? plain : embedded,
    utcMs,
  };
}

export function loadTimezoneReference() {
  return ref;
}
