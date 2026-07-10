#!/usr/bin/env node
/**
 * Warn-only audit: flag innerHTML assignments that do not use esc() on the same line.
 * Run: node scripts/audit-innerhtml.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const webDir = path.join(root, 'web');

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (name.endsWith('.js')) out.push(full);
  }
  return out;
}

const suspicious = [];
for (const file of walk(webDir)) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    if (!line.includes('.innerHTML')) return;
    if (line.includes('esc(') || line.includes('safeHref(')) return;
    if (/innerHTML\s*=\s*['"]\s*['"]/.test(line)) return;
    if (/innerHTML\s*=\s*['"]<tr><td/.test(line) && line.includes('loading')) return;
    suspicious.push({ rel, line: i + 1, text: line.trim().slice(0, 120) });
  });
}

if (suspicious.length) {
  console.log(`innerHTML audit: ${suspicious.length} line(s) without esc() on same line (review manually):`);
  for (const item of suspicious.slice(0, 40)) {
    console.log(`  ${item.rel}:${item.line}  ${item.text}`);
  }
  if (suspicious.length > 40) {
    console.log(`  ... and ${suspicious.length - 40} more`);
  }
  process.exit(0);
}

console.log('innerHTML audit: no obvious unescaped assignments on same line');
