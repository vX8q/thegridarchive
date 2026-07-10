import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'scripts', 'lib', 'f1-event-normalize.mjs'), 'utf8');
const body = src.replace(/^export /gm, '');
const out =
  "(function () {\n" +
  "  'use strict';\n" +
  "  if (typeof window === 'undefined') return;\n" +
  "  window.TGA = window.TGA || {};\n" +
  body +
  "\n  window.TGA.normalizeF1EventTo2026Format = normalizeF1EventTo2026Format;\n" +
  "})();\n";
fs.writeFileSync(path.join(root, 'web', 'lib', 'f1-event-normalize.js'), out, 'utf8');
console.log('wrote web/lib/f1-event-normalize.js');
