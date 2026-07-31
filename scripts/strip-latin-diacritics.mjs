#!/usr/bin/env node
/**
 * Strip Latin diacritics from all string values under data/ (recursive *.json).
 * Cyrillic (including yo) is preserved.
 *
 * Usage: node scripts/strip-latin-diacritics.mjs [--check]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { walkAllStrings, foldLatin } from './lib/fold-place-diacritics.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const checkOnly = process.argv.includes('--check');

function listJsonFiles(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...listJsonFiles(p));
    else if (ent.isFile() && ent.name.endsWith('.json')) out.push(p);
  }
  return out;
}

let filesChanged = 0;
let totalChanges = 0;

for (const filePath of listJsonFiles(DATA)) {
  const raw = fs.readFileSync(filePath, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    console.warn('skip invalid JSON', path.relative(ROOT, filePath));
    continue;
  }
  const changes = [];
  walkAllStrings(data, changes);
  if (!changes.length) continue;
  totalChanges += changes.length;
  filesChanged += 1;
  const rel = path.relative(ROOT, filePath);
  if (checkOnly) {
    console.log(`would change ${rel} (${changes.length})`);
    for (const c of changes.slice(0, 5)) {
      console.log(`  ${c.key}: ${JSON.stringify(c.before).slice(0, 80)} → ${JSON.stringify(c.after).slice(0, 80)}`);
    }
    continue;
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`patched ${rel} (${changes.length})`);
}

// Sanity: Cyrillic ё must survive foldLatin
if (foldLatin('четвёртый São Paulo José') !== 'четвёртый Sao Paulo Jose') {
  console.error('foldLatin Cyrillic/latin sanity failed');
  process.exit(1);
}

console.log(
  checkOnly
    ? `check: ${filesChanged} files / ${totalChanges} strings would change`
    : `done: ${filesChanged} files / ${totalChanges} strings`,
);
if (checkOnly && filesChanged > 0) process.exit(2);
