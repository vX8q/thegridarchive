#!/usr/bin/env node
/**
 * Load last-results-dates.js in Node for unit tests.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { createEventCardDateApi } from './load-event-card-date.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function createLastResultsDatesApi() {
  const TGA = createEventCardDateApi();
  TGA.formatDateRange = function (start, end) {
    if (!start) return '—';
    if (!end || start === end) return start;
    return start + '–' + end;
  };
  TGA.formatShortDate = function (iso) {
    return iso || '—';
  };
  TGA.formatEventRaceStartDate = function (e) {
    const r = TGA.getEventRaceDateRangeIso(e);
    if (r.start && r.end && r.end > r.start) {
      return TGA.formatDateRange(r.start, r.end);
    }
    return TGA.formatShortDate(r.start || r.end);
  };
  const window = { TGA, console };
  const src = fs.readFileSync(path.join(root, 'web', 'lib', 'last-results-dates.js'), 'utf8');
  vm.runInNewContext(src, { window, console });
  return window.TGA;
}
