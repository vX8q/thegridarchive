import fs from 'fs';
import path from 'path';

export const STOCKCAR_EVENT_ROOT = path.join(process.cwd(), 'data', 'events');

export function isStockCarRel(rel) {
  const l = rel.replace(/\\/g, '/').toLowerCase();
  return (
    l.includes('nascar cup series') ||
    l.includes('nascar truck') ||
    l.includes('noaps') ||
    l.includes('/arca/') ||
    l.includes('arca/') ||
    l.includes('nascar modified')
  );
}

export function walkStockCarJsonFiles(dir = STOCKCAR_EVENT_ROOT, base = dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkStockCarJsonFiles(p, base, out);
    else if (ent.name.endsWith('.json')) {
      const rel = path.relative(base, p);
      if (isStockCarRel(rel)) out.push(p);
    }
  }
  return out;
}

export function normHeader(h) {
  return String(h ?? '')
    .trim()
    .toLowerCase()
    .replace(/\./g, '');
}

export function headerIndex(headers, candidates) {
  const lows = (headers || []).map(normHeader);
  for (const c of candidates) {
    const want = normHeader(c);
    const i = lows.indexOf(want);
    if (i >= 0) return i;
  }
  return -1;
}

export const CAR_HEADERS = ['car', 'no', 'no.', '#', 'trk'];
export const TEAM_HEADERS = ['team', 'official team'];

export function buildTeamMap(entryList) {
  const m = new Map();
  if (!Array.isArray(entryList)) return m;
  for (const e of entryList) {
    const num = String(e?.number ?? '').trim();
    const team = String(e?.team ?? '').trim();
    if (num && team) m.set(num, team);
  }
  return m;
}

export function lookupTeam(map, carRaw) {
  const car = String(carRaw ?? '').trim();
  if (!car || car === '—' || car === '-') return null;
  if (map.has(car)) return map.get(car);
  if (!/^\d+$/.test(car)) return null;
  const n = parseInt(car, 10);
  if (Number.isNaN(n)) return null;
  const tries = [String(n), String(n).padStart(2, '0'), String(n).padStart(3, '0')];
  for (const k of tries) {
    if (map.has(k)) return map.get(k);
  }
  return null;
}

export function isSeparatorRow(row) {
  if (!row || !row.length) return false;
  const first = String(row[0] ?? '').trim();
  if (!first) return false;
  const lower = first.toLowerCase();
  if (
    lower === "qualified by owner's points" ||
    lower === 'failed to qualify' ||
    lower === 'did not qualify'
  ) {
    return true;
  }
  for (let i = 1; i < row.length; i++) {
    if (row[i] != null && String(row[i]).trim() !== '') return false;
  }
  return true;
}

export const TEAM_TABLE_KEYS = [
  'practice',
  'qualifying',
  'race_results',
  'starting_lineup',
  'did_not_qualify',
  'duel1',
  'duel2',
  'last_chance',
];

export function* iterTeamTables(tables) {
  if (!tables || typeof tables !== 'object') return;
  for (const key of TEAM_TABLE_KEYS) {
    const t = tables[key];
    if (t) yield { key, table: t };
    if (key === 'practice' && t?.sessions) {
      for (let i = 0; i < t.sessions.length; i++) {
        yield { key: `practice.sessions[${i}]`, table: t.sessions[i] };
      }
    }
    if (key === 'qualifying' && t?.sessions) {
      for (let i = 0; i < t.sessions.length; i++) {
        yield { key: `qualifying.sessions[${i}]`, table: t.sessions[i] };
      }
    }
  }
  for (const key of Object.keys(tables)) {
    if (/^stage_\d+$/.test(key)) yield { key, table: tables[key] };
  }
}

export function maxQualifyingPos(qualifying) {
  if (!qualifying?.rows) return 0;
  let max = 0;
  for (const row of qualifying.rows) {
    if (isSeparatorRow(row)) continue;
    const p = parseInt(String(row[0] ?? '').trim(), 10);
    if (!Number.isNaN(p) && p > max) max = p;
  }
  return max;
}

export function seriesTeamFile(relPath) {
  const l = relPath.replace(/\\/g, '/').toLowerCase();
  if (l.includes('nascar cup')) return 'nascar_cup.json';
  if (l.includes('nascar truck')) return 'nascar_truck.json';
  if (l.includes('noaps')) return 'noaps.json';
  if (l.includes('arca')) return 'arca.json';
  if (l.includes('nascar modified')) return 'nascar_modified.json';
  return null;
}

export function loadCanonicalTeams(teamFile) {
  if (!teamFile) return new Set();
  const p = path.join(process.cwd(), 'data', 'teams', teamFile);
  if (!fs.existsSync(p)) return new Set();
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  const names = new Set();
  for (const row of data.teams || []) {
    const t = String(row.team ?? '').trim();
    if (t) names.add(t);
  }
  return names;
}

const TEAM_ORG_MARKERS = /\b(racing|motorsports|motorsport|team|garage|sport|inc\.?|llc|ltd)\b/i;

export function looksLikeSponsorNotOrg(name) {
  const s = String(name ?? '').trim();
  if (!s) return false;
  if (/\.com\b/i.test(s)) return true;
  if (/\bwith\b/i.test(s)) return true;
  if (!TEAM_ORG_MARKERS.test(s) && s.length <= 24 && !/\s{2,}/.test(s)) {
    // Short single-line names without org markers are often primary sponsors.
    if (!/^[A-Z][a-z]+(\s+[A-Z][a-z]+){0,2}$/.test(s)) return false;
    const words = s.split(/\s+/);
    if (words.length === 1) return true;
  }
  return false;
}
