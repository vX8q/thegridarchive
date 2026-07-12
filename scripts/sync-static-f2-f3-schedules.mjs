#!/usr/bin/env node
/**
 * Sync F2/F3 blocks in web/data/static-schedules.js from data/schedules/f2_f3_sessions.json.
 * Preserves hand-curated circuit strings from the existing static file.
 * Run: node scripts/sync-static-f2-f3-schedules.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const staticPath = path.join(root, 'web', 'data', 'static-schedules.js');
const sessionsPath = path.join(root, 'data', 'schedules', 'f2_f3_sessions.json');
const f2SchedulePath = path.join(root, 'data', 'schedules', 'f2.json');
const f3SchedulePath = path.join(root, 'data', 'schedules', 'f3.json');

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatDisplayDate(iso) {
  const [y, m, d] = String(iso || '').split('-').map(Number);
  if (!y || !m || !d) return '';
  return `${d} ${MONTHS[m - 1]}`;
}

function loadExistingStatic() {
  const src = fs.readFileSync(staticPath, 'utf8');
  const m = src.match(/window\.TGA_STATIC_SCHEDULES\s*=\s*(\{[\s\S]*\});\s*\}\)\(\);/);
  if (!m) throw new Error('Could not parse static-schedules.js');
  return Function(`"use strict"; return (${m[1]});`)();
}

function sessionPair(sessions, kind) {
  const row = (sessions || []).find((s) => s.kind === kind || new RegExp(kind, 'i').test(s.label || ''));
  return row || null;
}

function buildBlock(scheduleRows, sessionsById, existingRows, seriesPrefix) {
  const existingById = {};
  for (const row of existingRows || []) {
    const id = String(row.event_id || '').toUpperCase();
    if (id) existingById[id] = row;
  }

  return scheduleRows.map((ev, idx) => {
    const id = String(ev.id || '').toUpperCase();
    const rd = idx + 1;
    const prev = existingById[id] || {};
    const sessions = sessionsById[id] || [];
    const sprint = sessionPair(sessions, 'sprint');
    const feature = sessionPair(sessions, 'feature');
    const circuit = prev.circuit
      || `${ev.name || ev.circuit_name || ''} — ${ev.circuit_name || ''}, ${ev.location || ''}`.replace(/^ — /, '');

    return {
      rd,
      circuit,
      event_id: id,
      sprint: sprint ? formatDisplayDate(sprint.date) : formatDisplayDate(ev.start_date),
      sprintLocal: sprint?.time_est || '',
      sprintMsk: sprint?.time_msk || '',
      feature: feature ? formatDisplayDate(feature.date) : formatDisplayDate(ev.end_date),
      featureLocal: feature?.time_est || '',
      featureMsk: feature?.time_msk || '',
    };
  });
}

function formatRow(row, indent) {
  const pad = ' '.repeat(indent);
  const inner = `${pad}  { rd: ${String(row.rd).padStart(2, ' ')},  circuit: '${row.circuit.replace(/'/g, "\\'")}', event_id: '${row.event_id}',\n`
    + `${pad}    sprint: '${row.sprint}', sprintLocal: '${row.sprintLocal}', sprintMsk: '${row.sprintMsk}',\n`
    + `${pad}    feature: '${row.feature}', featureLocal: '${row.featureLocal}', featureMsk: '${row.featureMsk}' }`;
  return inner;
}

function replaceBlock(src, key, rows) {
  const re = new RegExp(`(\\n    ${key}: \\[\\n)([\\s\\S]*?)(\\n    \\],)`);
  const body = rows.map((r, i) => formatRow(r, 4) + (i < rows.length - 1 ? ',' : '')).join('\n');
  if (!re.test(src)) throw new Error(`Could not find ${key} block in static-schedules.js`);
  return src.replace(re, `$1${body}$3`);
}

const sessionsById = JSON.parse(fs.readFileSync(sessionsPath, 'utf8'));
const f2Schedule = JSON.parse(fs.readFileSync(f2SchedulePath, 'utf8'));
const f3Schedule = JSON.parse(fs.readFileSync(f3SchedulePath, 'utf8'));
const existing = loadExistingStatic();

const f2Rows = buildBlock(f2Schedule, sessionsById, existing.f2, 'F2');
const f3Rows = buildBlock(f3Schedule, sessionsById, existing.f3, 'F3');

let src = fs.readFileSync(staticPath, 'utf8');
src = replaceBlock(src, 'f2', f2Rows);
src = replaceBlock(src, 'f3', f3Rows);
fs.writeFileSync(staticPath, src);

console.log(`Updated static-schedules.js: f2=${f2Rows.length} rounds, f3=${f3Rows.length} rounds`);
