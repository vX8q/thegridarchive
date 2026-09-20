#!/usr/bin/env node
/**
 * P1 Gap / Int / Interval gate. Leader cells must be the em dash "—", not a
 * hyphen, empty string, or protocol placeholder (`--.----`, `0.0000`).
 *
 *   node scripts/audit-p1-gap.mjs           report only
 *   node scripts/audit-p1-gap.mjs --write   rewrite placeholder cells
 *   node scripts/audit-p1-gap.mjs --check   exit 1 while a placeholder remains
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  P1_GAP,
  forEachP1GapCell,
  isLeaderPlaceholder,
} from './lib/p1-gap.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const eventsRoot = path.join(root, 'data', 'events');

const write = process.argv.includes('--write');
const check = process.argv.includes('--check');

function walkJson(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkJson(p, out);
    else if (ent.name.endsWith('.json')) out.push(p);
  }
  return out;
}

function serialize(obj) {
  return JSON.stringify(obj, null, 2) + '\n';
}

const fixable = [];
const skipped = [];
let filesChanged = 0;

for (const file of walkJson(eventsRoot).sort()) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const original = fs.readFileSync(file, 'utf8');
  let obj;
  try {
    obj = JSON.parse(original);
  } catch (err) {
    console.error(`${rel}: unreadable JSON (${err.message})`);
    process.exit(1);
  }
  const reformats = serialize(obj) !== original;

  let changed = false;
  forEachP1GapCell(obj, (value, set) => {
    if (value === P1_GAP) return;
    if (!isLeaderPlaceholder(value)) return;
    const from = String(value ?? '');
    fixable.push({ rel, from, to: P1_GAP });
    if (write && !reformats) {
      set(P1_GAP);
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
    const key = `${JSON.stringify(item.from)} -> ${JSON.stringify(item.to)}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

if (write) {
  console.log(`\np1-gap audit: ${filesChanged} file(s) rewritten.`);
  if (skipped.length) {
    console.log('skipped (not in 2-space format, fix by hand):');
    for (const rel of skipped) console.log(`  ${rel}`);
    process.exit(1);
  }
  process.exit(0);
}

if (!fixable.length) {
  console.log('\np1-gap audit: all P1 Gap/Int cells use "—"');
  process.exit(0);
}

console.log(`\np1-gap audit: ${fixable.length} P1 cell(s) need "—":`);
for (const [pair, count] of summarize(fixable)) {
  console.log(`  ${pair}  x${count}`);
}
const files = [...new Set(fixable.map((f) => f.rel))];
console.log(`  in ${files.length} file(s), e.g. ${files.slice(0, 3).join(', ')}`);

if (check) {
  console.error('\nFAILED: run `node scripts/audit-p1-gap.mjs --write`');
  process.exit(1);
}
