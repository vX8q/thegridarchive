#!/usr/bin/env node
/**
 * Phase 1 data pipeline gate (warn-only compare-wiki until W2).
 * Run: node scripts/check-data.mjs
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(cmd, args, opts = {}) {
  const label = opts.label || `${cmd} ${args.join(' ')}`;
  console.log(`\n==> ${label}`);
  const res = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: false });
  if (res.status !== 0 && !opts.warnOnly) {
    console.error(`FAILED: ${label}`);
    process.exit(res.status || 1);
  }
  if (res.status !== 0 && opts.warnOnly) {
    console.warn(`WARN (non-blocking): ${label}`);
  }
}

run('node', ['scripts/validate-schedule-times.mjs']);
run('node', ['scripts/audit-card-dates.mjs']);
run('node', ['scripts/compare-wiki-schedules.mjs'], { warnOnly: true, label: 'compare-wiki-schedules (warn-only)' });
run('go', ['test', './internal/schedulefile/...', '-count=1', '-run', 'Standings']);
run('node', ['scripts/audit-innerhtml.mjs'], { warnOnly: true, label: 'audit-innerhtml (warn-only)' });

console.log('\nAll check-data steps completed.');
