#!/usr/bin/env node
/**
 * Run all scripts/*.test.mjs gate tests (Phase 4 CI bundle).
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const scriptsDir = path.join(root, 'scripts');

const files = fs.readdirSync(scriptsDir)
  .filter((name) => name.endsWith('.test.mjs'))
  .sort();

if (files.length === 0) {
  console.error('No *.test.mjs files found in scripts/');
  process.exit(1);
}

let failed = 0;
for (const file of files) {
  const full = path.join(scriptsDir, file);
  console.log('\n==> ' + file);
  const res = spawnSync(process.execPath, [full], { stdio: 'inherit', cwd: root });
  if (res.status !== 0) failed++;
}

console.log('\n---');
if (failed) {
  console.error(`${failed}/${files.length} JS test file(s) failed.`);
  process.exit(1);
}
console.log(`All ${files.length} JS test files passed.`);
