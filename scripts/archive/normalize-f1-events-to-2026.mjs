#!/usr/bin/env node
/**
 * Migrate F1 event JSON under data/events/F1/ to the 2026 table layout.
 * Usage: node scripts/archive/normalize-f1-events-to-2026.mjs [--dry-run] [--year=2025]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizeF1EventTo2026Format } from './lib/f1-event-normalize.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dryRun = process.argv.includes('--dry-run');
const yearArg = process.argv.find((a) => a.startsWith('--year='));
const year = yearArg ? yearArg.split('=')[1] : '2025';
const f1Dir = path.join(root, 'data', 'events', 'F1', year);

if (!fs.existsSync(f1Dir)) {
  console.error('Directory not found:', f1Dir);
  process.exit(1);
}

const files = fs.readdirSync(f1Dir).filter((n) => n.endsWith('.json')).sort();
let changed = 0;

for (const name of files) {
  const file = path.join(f1Dir, name);
  let raw = fs.readFileSync(file, 'utf8');
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  const before = JSON.parse(raw);
  const after = normalizeF1EventTo2026Format(JSON.parse(JSON.stringify(before)));
  const out = JSON.stringify(after, null, 2) + '\n';
  const prev = JSON.stringify(before, null, 2) + '\n';
  if (out !== prev) {
    changed++;
    console.log(dryRun ? '[dry-run] would update' : 'updated', name);
    if (!dryRun) fs.writeFileSync(file, out, 'utf8');
  } else {
    console.log('unchanged', name);
  }
}

console.log(`Done: ${changed}/${files.length} file(s) ${dryRun ? 'would change' : 'updated'}.`);
