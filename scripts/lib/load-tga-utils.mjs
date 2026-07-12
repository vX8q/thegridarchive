#!/usr/bin/env node
/**
 * Load tga-utils.js race-timing helpers in Node (isPastForLastResultsEvent, etc.).
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { createEventCardDateApi } from './load-event-card-date.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * @returns {import('../../web/tga-utils.js').TGA & Record<string, unknown>}
 */
export function createTgaUtilsApi() {
  const TGA = createEventCardDateApi();
  TGA.t = (k) => k;
  TGA.localizeSpecKey = (k) => k;
  TGA.localizeSpecValue = (v) => v;
  TGA._state = { loadedSeriesId: null };
  TGA.logger = console;

  const document = {
    documentElement: { setAttribute() {}, lang: 'en' },
    createElement() {
      return { textContent: '', innerHTML: '', setAttribute() {} };
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById() { return null; },
  };

  const localStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = v; },
  };

  const sandbox = vm.createContext({
    window: {
      TGA,
      document,
      localStorage,
      console,
      matchMedia: () => ({ matches: false }),
      addEventListener() {},
      removeEventListener() {},
      TGA_TRANSLATIONS: {},
      TGA_CATEGORY_COLORS: {},
      TGA_SERIES_COLORS: {},
      TGA_SERIES_SHORT: {},
    },
    document,
    localStorage,
    console,
    Date,
  });

  vm.runInContext(fs.readFileSync(path.join(root, 'web', 'data', 'timezones.js'), 'utf8'), sandbox);
  Object.assign(TGA, sandbox.window.TGA);

  sandbox.window.TGA = TGA;
  vm.runInContext(fs.readFileSync(path.join(root, 'web', 'tga-i18n.js'), 'utf8'), sandbox);
  Object.assign(TGA, sandbox.window.TGA);

  sandbox.window.TGA = TGA;
  sandbox.window.TGA.categories = [];
  vm.runInContext(fs.readFileSync(path.join(root, 'web', 'tga-utils.js'), 'utf8'), sandbox);
  Object.assign(TGA, sandbox.window.TGA);

  sandbox.window.TGA.__nativeIsPast = sandbox.window.TGA.isPastForLastResultsEvent;
  const invokeIsPast = function (ev) {
    sandbox.ev = ev;
    sandbox.liveIds = TGA.liveEventIds || {};
    return vm.runInContext('window.TGA.liveEventIds = liveIds; window.TGA.__nativeIsPast(ev)', sandbox);
  };
  sandbox.window.TGA.isPastForLastResultsEvent = invokeIsPast;

  return TGA;
}
