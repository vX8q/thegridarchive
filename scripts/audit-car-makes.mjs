#!/usr/bin/env node
/**
 * Car-make casing gate for endurance / GT event JSON.
 *
 *   node scripts/audit-car-makes.mjs           report only
 *   node scripts/audit-car-makes.mjs --write   rewrite cells to canonical spelling
 *   node scripts/audit-car-makes.mjs --check   exit 1 while a fixable cell remains (CI)
 *
 * Unknown makes are always reported and never rewritten — add them to
 * scripts/lib/car-makes.mjs after checking the official entry list.
 */
import fs from 'fs';
import path from 'path';
import {
  canonicalCarMake,
  forEachCarCell,
  walkCarMakeEventFiles,
} from './lib/car-makes.mjs';

const write = process.argv.includes('--write');
const check = process.argv.includes('--check');

const fixable = [];
const unknown = new Map();
const skipped = [];
let filesChanged = 0;

function serialize(obj) {
  return JSON.stringify(obj, null, 2) + '\n';
}

for (const file of walkCarMakeEventFiles()) {
  const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');
  const original = fs.readFileSync(file, 'utf8');
  let obj;
  try {
    obj = JSON.parse(original);
  } catch (err) {
    console.error(`${rel}: unreadable JSON (${err.message})`);
    process.exit(1);
  }
  // Writing goes through JSON.stringify, so a file that is not already in the
  // repo's 2-space format would come back reformatted end to end. Skip it and
  // let a human fix the casing rather than bury it in a whole-file diff.
  const reformats = serialize(obj) !== original;

  let changed = false;
  forEachCarCell(obj, (value, set) => {
    const raw = String(value ?? '').trim();
    if (!raw || raw === '—' || raw === '-') return;
    const canonical = canonicalCarMake(raw);
    if (canonical == null) {
      // A model designation ("BMW M4 GT3 EVO", "Oreca 07 Gibson") is normal;
      // only a bare shouted make is worth reporting.
      if (raw === raw.toUpperCase() && /[A-Z]/.test(raw) && !/\d/.test(raw)) {
        if (!unknown.has(raw)) unknown.set(raw, new Set());
        unknown.get(raw).add(rel);
      }
      return;
    }
    if (canonical === raw) return;
    fixable.push({ rel, from: raw, to: canonical });
    if (write && !reformats) {
      set(canonical);
      changed = true;
    }
  });

  if (write && reformats && fixable.some((f) => f.rel === rel)) {
    skipped.push(rel);
  }
  if (changed) {
    fs.writeFileSync(file, serialize(obj), 'utf8');
    filesChanged++;
    console.log('updated', rel);
  }
}

function summarize(items) {
  const counts = new Map();
  for (const item of items) {
    const key = `${item.from} -> ${item.to}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

if (unknown.size) {
  console.log(`\ncar-make audit: ${unknown.size} make(s) not in the canonical list:`);
  for (const [make, files] of [...unknown.entries()].sort()) {
    const sample = [...files].slice(0, 3).join(', ');
    console.log(`  ${make}  (${files.size} file(s): ${sample}${files.size > 3 ? ', ...' : ''})`);
  }
}

if (write) {
  console.log(`\ncar-make audit: ${filesChanged} file(s) rewritten.`);
  if (skipped.length) {
    console.log('skipped (not in 2-space format, fix casing by hand):');
    for (const rel of skipped) console.log(`  ${rel}`);
    process.exit(1);
  }
  process.exit(0);
}

if (!fixable.length) {
  console.log('\ncar-make audit: all Car cells use canonical spelling');
  process.exit(0);
}

console.log(`\ncar-make audit: ${fixable.length} cell(s) need canonical spelling:`);
for (const [pair, count] of summarize(fixable)) {
  console.log(`  ${pair}  x${count}`);
}
const files = [...new Set(fixable.map((f) => f.rel))];
console.log(`  in ${files.length} file(s), e.g. ${files.slice(0, 3).join(', ')}`);

if (check) {
  console.error('\nFAILED: run `node scripts/audit-car-makes.mjs --write`');
  process.exit(1);
}
