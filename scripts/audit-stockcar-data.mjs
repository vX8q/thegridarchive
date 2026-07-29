#!/usr/bin/env node
/**
 * Audit stock-car event JSON for common data issues.
 * Run: node scripts/audit-stockcar-data.mjs
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
  maxQualifyingPos,
  looksLikeSponsorNotOrg,
  carsMissingFromEntryList,
} from './lib/stockcar-event-utils.mjs';

const issues = [];

function push(kind, eventId, relFile, detail) {
  issues.push({ kind, eventId, file: relFile, ...detail });
}

function auditTableTeams(eventId, relFile, tableKey, table, teamMap) {
  const headers = table?.headers;
  const rows = table?.rows;
  if (!Array.isArray(headers) || !Array.isArray(rows) || teamMap.size === 0) return;

  const carIdx = headerIndex(headers, CAR_HEADERS);
  const teamIdx = headerIndex(headers, TEAM_HEADERS);
  if (carIdx < 0 || teamIdx < 0) return;

  const started = rows
    .filter((row) => Array.isArray(row) && !isSeparatorRow(row) && row.length > carIdx)
    .map((row) => row[carIdx]);
  for (const car of carsMissingFromEntryList(teamMap, started)) {
    push('car_not_in_entry_list', eventId, relFile, { table: tableKey, car });
  }

  rows.forEach((row, ri) => {
    if (!Array.isArray(row) || isSeparatorRow(row)) return;
    if (row.length <= Math.max(carIdx, teamIdx)) return;
    const car = String(row[carIdx] ?? '').trim();
    const got = String(row[teamIdx] ?? '').trim();
    const want = lookupTeam(teamMap, car);
    if (!want || !got) return;
    if (got !== want) {
      push('team_mismatch', eventId, relFile, {
        table: tableKey,
        row: ri + 1,
        car,
        got,
        want,
      });
    }
    if (/\bwith\b/i.test(got)) {
      push('partnership_in_table', eventId, relFile, {
        table: tableKey,
        row: ri + 1,
        car,
        team: got,
      });
    }
  });
}

function auditEntryList(eventId, relFile, entryList) {
  if (!Array.isArray(entryList)) return;
  for (const e of entryList) {
    const num = String(e?.number ?? '').trim();
    const team = String(e?.team ?? '').trim();
    if (!team) continue;
    if (/\bwith\b/i.test(team)) {
      push('partnership_in_entry_list', eventId, relFile, { car: num, team });
    }
    if (looksLikeSponsorNotOrg(team)) {
      push('suspected_sponsor_entry_list', eventId, relFile, { car: num, team });
    }
  }
}

function auditDnqPositions(eventId, relFile, tables) {
  const dnq = tables?.did_not_qualify;
  const qual = tables?.qualifying;
  if (!dnq?.rows?.length || !qual) return;

  const posIdx = headerIndex(dnq.headers, ['pos', 'pos.']);
  if (posIdx < 0) return;

  const maxQual = maxQualifyingPos(qual);
  if (maxQual < 1) return;

  const dnqPos = dnq.rows
    .filter((r) => Array.isArray(r))
    .map((r) => parseInt(String(r[posIdx] ?? '').trim(), 10))
    .filter((n) => !Number.isNaN(n));

  if (!dnqPos.length) return;

  const isSequentialFromOne =
    dnqPos[0] === 1 && dnqPos.every((p, i) => p === i + 1);

  if (isSequentialFromOne && maxQual >= dnqPos.length) {
    push('dnq_pos_internal_numbering', eventId, relFile, {
      maxQual,
      got: dnqPos.join(', '),
      want: dnqPos.map((_, i) => maxQual + i + 1).join(', '),
    });
  }
}

for (const filePath of walkStockCarJsonFiles()) {
  const relFile = path.relative(process.cwd(), filePath);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    continue;
  }
  const eventId = data.event_id || path.basename(filePath, '.json');
  const teamMap = buildTeamMap(data.entry_list);

  auditEntryList(eventId, relFile, data.entry_list);
  for (const { key, table } of iterTeamTables(data.tables)) {
    auditTableTeams(eventId, relFile, key, table, teamMap);
  }
  auditDnqPositions(eventId, relFile, data.tables);
}

const byKind = {};
for (const i of issues) {
  byKind[i.kind] = (byKind[i.kind] || 0) + 1;
}

console.log('Stock-car data audit —', issues.length, 'issue(s)');
for (const [kind, n] of Object.entries(byKind).sort()) {
  console.log(`  ${kind}: ${n}`);
}

const show = (kind, limit = 20) => {
  const rows = issues.filter((i) => i.kind === kind);
  if (!rows.length) return;
  console.log(`\n## ${kind} (${rows.length})`);
  for (const r of rows.slice(0, limit)) {
    if (kind === 'team_mismatch') {
      console.log(`  ${r.eventId} ${r.table} #${r.car} row ${r.row}: "${r.got}" → should be "${r.want}"`);
    } else if (kind === 'dnq_pos_internal_numbering') {
      console.log(`  ${r.eventId}: got [${r.got}], want [${r.want}] (max qual ${r.maxQual})`);
    } else if (kind === 'car_not_in_entry_list') {
      console.log(`  ${r.eventId} ${r.table}: #${r.car} has no entry_list row`);
    } else if (kind === 'partnership_in_entry_list' || kind === 'partnership_in_table') {
      console.log(`  ${r.eventId} #${r.car || '?'} ${r.team || ''} (${r.table || 'entry_list'})`);
    } else {
      console.log(`  ${r.eventId} #${r.car || '?'} ${r.team || JSON.stringify(r)}`);
    }
  }
  if (rows.length > limit) console.log(`  … +${rows.length - limit} more`);
};

for (const kind of Object.keys(byKind).sort()) show(kind);

if (issues.length) process.exit(1);
