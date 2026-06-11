import fs from 'fs';

const files = [
  'data/events/Super Formula/2026/super_formula_2026_4.json',
  'data/events/Super Formula/2026/super_formula_2026_1.json',
];

function teamByNumber(entryList) {
  const m = new Map();
  for (const e of entryList) {
    if (e?.number != null && e?.team) m.set(String(e.number).trim(), String(e.team).trim());
  }
  return m;
}

function teamColIndex(headers) {
  const i = headers.indexOf('Team');
  return i >= 0 ? i : -1;
}

function noColIndex(headers) {
  const i = headers.indexOf('No.');
  return i >= 0 ? i : headers.indexOf('No');
}

function fixRows(rows, headers, teams) {
  if (!Array.isArray(rows) || teamColIndex(headers) < 0) return 0;
  const ti = teamColIndex(headers);
  const ni = noColIndex(headers);
  if (ni < 0) return 0;
  let n = 0;
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const no = String(row[ni] ?? '').trim();
    const team = teams.get(no);
    if (team && row[ti] !== team) {
      row[ti] = team;
      n++;
    }
  }
  return n;
}

function walkTables(tables, teams) {
  let total = 0;
  if (!tables || typeof tables !== 'object') return 0;
  for (const key of Object.keys(tables)) {
    const block = tables[key];
    if (!block || typeof block !== 'object') continue;
    if (Array.isArray(block.sessions)) {
      for (const s of block.sessions) {
        if (s?.headers && s?.rows) total += fixRows(s.rows, s.headers, teams);
      }
    } else if (block.headers && block.rows) {
      total += fixRows(block.rows, block.headers, teams);
    }
  }
  return total;
}

for (const path of files) {
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  const teams = teamByNumber(data.entry_list || []);
  const n = walkTables(data.tables, teams);
  fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
  console.log(path, 'updated', n, 'cells');
}
