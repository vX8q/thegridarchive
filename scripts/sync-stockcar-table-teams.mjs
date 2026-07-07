/**
 * Sync Team / Official Team columns from entry_list (car number -> team)
 * for stock-car event JSON tables.
 *
 * Run from repo root: node scripts/sync-stockcar-table-teams.mjs
 */
import fs from 'fs';
import path from 'path';
import {
  walkStockCarJsonFiles,
  buildTeamMap,
  lookupTeam,
  headerIndex,
  CAR_HEADERS,
  TEAM_HEADERS,
  iterTeamTables,
  isSeparatorRow,
} from './lib/stockcar-event-utils.mjs';

function syncTable(table, teamMap) {
  if (!table || typeof table !== 'object') return false;
  const headers = table.headers;
  const rows = table.rows;
  if (!Array.isArray(headers) || !Array.isArray(rows)) return false;

  const carIdx = headerIndex(headers, CAR_HEADERS);
  const teamIdx = headerIndex(headers, TEAM_HEADERS);
  if (carIdx < 0 || teamIdx < 0) return false;

  let changed = false;
  for (const row of rows) {
    if (!Array.isArray(row) || isSeparatorRow(row)) continue;
    if (row.length <= Math.max(carIdx, teamIdx)) continue;
    const t = lookupTeam(teamMap, row[carIdx]);
    if (t == null) continue;
    const old = String(row[teamIdx] ?? '');
    if (old !== t) {
      row[teamIdx] = t;
      changed = true;
    }
  }
  return changed;
}

function processFile(filePath) {
  let obj;
  try {
    obj = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return false;
  }
  const teamMap = buildTeamMap(obj.entry_list);
  if (teamMap.size === 0) return false;

  const tables = obj.tables;
  if (!tables || typeof tables !== 'object') return false;

  let any = false;
  for (const { table } of iterTeamTables(tables)) {
    if (syncTable(table, teamMap)) any = true;
  }
  if (!any) return false;

  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  return true;
}

const files = walkStockCarJsonFiles();
let n = 0;
for (const f of files) {
  if (processFile(f)) {
    n++;
    console.log('updated', path.relative(process.cwd(), f));
  }
}
console.log('done, files updated:', n, 'of', files.length, 'candidates');
