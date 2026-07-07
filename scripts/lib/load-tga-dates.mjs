#!/usr/bin/env node
/**
 * Load tga-dates-*.js modules in Node for unit tests.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function runBrowserModule(relPath, window) {
  const src = fs.readFileSync(path.join(root, relPath), 'utf8');
  vm.runInNewContext(src, { window, console });
}

/**
 * @param {Object} [opts]
 * @param {string} [opts.lang]
 */
export function createTgaDatesApi(opts = {}) {
  const lang = opts.lang || 'en';
  const window = {
    TGA: {
      getLang() { return lang; },
      localizeDate(iso) { return iso; },
    },
    console,
  };
  runBrowserModule('web/lib/tga-dates-core.js', window);
  runBrowserModule('web/lib/tga-dates-format.js', window);
  runBrowserModule('web/lib/tga-dates-event.js', window);
  return window.TGA;
}
