/**
 * Team org canon helpers (entrant identity, not marque).
 * Aliases are generated from ALL distinct entry_list.team / constructor strings,
 * not only from display_name_by_season (display is seasonal UI only).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { foldDiacritics, slugifyDriverName } from './driver-slug-canon.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const STOCK_SERIES = new Set([
  'NASCAR Cup Series',
  'NASCAR Xfinity Series',
  'NASCAR Truck',
  'NASCAR Modified',
  'ARCA',
  'NOAPS',
]);

/** Map event-folder / series label → data series id used in profiles. */
export function seriesIdFromEventPath(seriesFolder) {
  const s = String(seriesFolder || '').trim();
  const map = {
    F1: 'f1',
    F2: 'f2',
    F3: 'f3',
    FREC: 'frec',
    'Italian F4': 'f4_it',
    DTM: 'dtm',
    IndyCar: 'indycar',
    IMSA: 'imsa',
    WEC: 'wec',
    ELMS: 'elms',
    'GT World Challenge Europe Endurance': 'gtwce_end',
    'GT World Challenge Europe Sprint': 'gtwce_sprint',
    Supercars: 'supercars',
    'Super Formula': 'super_formula',
    'Super GT': 'super_gt',
    'Porsche Supercup': 'psc',
    'NASCAR Cup Series': 'nascar_cup',
    'NASCAR Xfinity Series': 'noaps',
    'NASCAR Truck': 'nascar_truck',
    'NASCAR Modified': 'nascar_modified',
    ARCA: 'arca',
  };
  return map[s] || slugifyDriverName(s).replace(/-/g, '_');
}

export function slugifyTeamName(name) {
  return slugifyDriverName(name);
}

/**
 * Curated same-org slug merges (alias → canon). Applied before profiles are keyed,
 * so careers/rosters aggregate and logos can be attached once.
 * Order: canon merges → redirects → then logos (Sprint B).
 */
export const CURATED_SLUG_MERGES = {
  '2seas-motorsport': '2-seas-motorsport',
  'mcanally-hilgemann': 'mcanally-hilgemann-racing',
  'trident-motorsport': 'trident',
  'acura-meyer-shank-racing-with-curb-agajanian': 'meyer-shank-racing-with-curb-agajanian',
  // Same racing org across classes/series (Hypercar/LMGT3/IMSA/etc.) — marque stays in display_name.
  'af-corse-usa': 'af-corse',
  'richard-mille-af-corse': 'af-corse',
  'getspeed-team-dubai': 'getspeed',
  'getspeed-team-pcx': 'getspeed',
  'getspeed-team-noble-racing': 'getspeed',
  'getspeed-team-bartone-bros': 'getspeed',
  'bartone-bros-with-getspeed': 'getspeed',
  'mercedes-amg-team-getspeed': 'getspeed',
  'cadillac-wayne-taylor-racing': 'wayne-taylor-racing',
  'freedom-racing-enterprises': 'freedom-racing',
  'dinamic-gt': 'dinamic-motorsport',
  'team-gp-elite': 'gp-elite',
  'tommy-baldwin-racing-llc': 'tommy-baldwin-racing',
  'tjs-holdings-llc': 'tjs-holdings',
  'goodie-racing': 'goodie-motorsports',
  'jonathan-mckennedy-racing': 'jon-mckennedy-racing',
};

export function applyCuratedSlugMerge(slug) {
  const s = String(slug || '').trim().toLowerCase();
  if (!s) return '';
  return CURATED_SLUG_MERGES[s] || s;
}

/** Title-case ALL CAPS protocol names; keep short tokens (AF, GP, RT) upper. */
export function titleCaseAllCapsOrgName(name) {
  const s = String(name || '').trim();
  if (s.length < 4) return s;
  if (s !== s.toUpperCase()) return s;
  if (!/[A-Z]/.test(s)) return s;
  return s
    .split(/(\s+|[-/])/)
    .map((tok) => {
      if (!/^[A-Z0-9]+$/.test(tok)) return tok;
      if (tok.length <= 3) return tok;
      return tok.charAt(0) + tok.slice(1).toLowerCase();
    })
    .join('');
}

/** ASCII fold for Latin canonical names (en-dash → hyphen, strip diacritics). */
export function asciiOrgName(name) {
  return foldDiacritics(String(name || ''))
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .trim();
}

/** Strip stock-car partnership tails: "Joey Gase Motorsports with Scott Osteen" → org. */
export function stripStockCarPartnership(name) {
  let s = String(name || '').trim();
  const m = s.match(/^(.*?)\s+with\s+.+$/i);
  if (m) s = m[1].trim();
  return s;
}

export function foldStockCarTeamKey(name) {
  let s = stripStockCarPartnership(name).toLowerCase();
  s = s.replace(/[\u2013\u2014\-'.&,]/g, '');
  s = s.replace(/[^a-z0-9]/g, '');
  return s;
}

function stripF1PowerUnit(name) {
  let s = String(name || '').trim();
  const lower = s.toLowerCase();
  const suffixes = [
    '-honda rbpt',
    '-red bull ford',
    '-red bull powertrains',
    '-mercedes',
    '-ferrari',
    '-renault',
    '-ford',
  ];
  for (const suf of suffixes) {
    if (lower.endsWith(suf)) return s.slice(0, s.length - suf.length).trim();
  }
  return s;
}

/** Port of schedulefile.foldF1TeamAlias — commercial / constructor → core entrant. */
export function foldF1TeamAlias(name) {
  const lower = String(name || '').trim().toLowerCase();
  if (!lower) return '';
  if (lower.includes('ferrari')) return 'Ferrari';
  if (lower.includes('alpine')) return 'Alpine';
  if (lower.includes('mercedes')) return 'Mercedes';
  if (lower.includes('mclaren')) return 'McLaren';
  if (lower.includes('racing bull') || lower.includes('visa cash app') || lower === 'rb') {
    return 'Racing Bulls';
  }
  if (lower.includes('red bull')) return 'Red Bull Racing';
  if (lower.includes('williams')) return 'Williams';
  if (lower.includes('aston martin')) return 'Aston Martin';
  if (lower.includes('haas')) return 'Haas';
  if (lower.includes('sauber')) return 'Kick Sauber';
  if (lower.includes('audi')) return 'Audi';
  if (lower.includes('cadillac')) return 'Cadillac';
  return String(name || '').trim();
}

export function f1TeamCoreName(name) {
  let s = stripF1PowerUnit(name);
  s = foldF1TeamAlias(s);
  s = stripF1PowerUnit(s);
  return s;
}

/**
 * Provisional org key for grouping raw strings before curated profiles exist.
 * Returns { seriesId, foldKey, canonicalName, slug }.
 */
export function provisionalOrgFromRaw(seriesFolder, team, constructor) {
  const seriesId = seriesIdFromEventPath(seriesFolder);
  const rawTeam = String(team || '').trim();
  const rawCtor = String(constructor || '').trim();
  const preferred = rawTeam || rawCtor;
  if (!preferred) return null;

  if (seriesId === 'f1') {
    const core = f1TeamCoreName(preferred) || f1TeamCoreName(rawCtor) || preferred;
    const slug = applyCuratedSlugMerge(slugifyTeamName(core));
    return { seriesId, foldKey: `f1:${slug}`, canonicalName: core, slug };
  }

  if (
    seriesId === 'nascar_cup' ||
    seriesId === 'noaps' ||
    seriesId === 'nascar_truck' ||
    seriesId === 'nascar_modified' ||
    seriesId === 'arca' ||
    STOCK_SERIES.has(seriesFolder)
  ) {
    const cleaned = stripStockCarPartnership(preferred);
    const foldKey = foldStockCarTeamKey(cleaned);
    if (!foldKey) return null;
    return {
      seriesId,
      foldKey: `stock:${foldKey}`,
      canonicalName: cleaned,
      slug: applyCuratedSlugMerge(slugifyTeamName(cleaned)),
    };
  }

  const cleaned = preferred.replace(/\s+/g, ' ').trim();
  const slug = applyCuratedSlugMerge(slugifyTeamName(cleaned));
  return {
    seriesId,
    foldKey: `${seriesId}:${slug}`,
    canonicalName: cleaned,
    slug,
  };
}

export function walkEventJsonFiles(eventsRoot = path.join(root, 'data', 'events')) {
  const out = [];
  function walk(d) {
    if (!fs.existsSync(d)) return;
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith('.json')) out.push(p);
    }
  }
  walk(eventsRoot);
  return out;
}

/**
 * Audit all entry_list team/constructor strings.
 * @returns {{ rows: Array, byOrg: Map, rawStrings: Map }}
 */
export function auditTeamEntryNames() {
  const files = walkEventJsonFiles();
  /** @type {Map<string, { seriesId, season, team, constructor, count, files: Set }>} */
  const combos = new Map();
  /** foldKey → { slug, canonicalName, seriesIds:Set, rawNames:Map, displayBySeason:Map } */
  const byOrg = new Map();

  for (const f of files) {
    let j;
    try {
      j = JSON.parse(fs.readFileSync(f, 'utf8'));
    } catch {
      continue;
    }
    const el = j.entry_list;
    if (!Array.isArray(el)) continue;
    const parts = f.split(path.sep);
    const ei = parts.indexOf('events');
    const seriesFolder = parts[ei + 1] || '';
    const season = String(parts[ei + 2] || j.start_date?.slice?.(0, 4) || '').trim();

    for (const e of el) {
      const team = String(e.team || '').trim();
      // NOTE: must not read e.constructor — every object has Object.prototype.constructor.
      const ctor = Object.prototype.hasOwnProperty.call(e, 'constructor')
        ? String(e.constructor || '').trim()
        : '';
      if (!team && !ctor) continue;
      const org = provisionalOrgFromRaw(seriesFolder, team, ctor);
      if (!org) continue;

      const comboKey = `${org.seriesId}|${season}|${team}|${ctor}`;
      let c = combos.get(comboKey);
      if (!c) {
        c = { seriesId: org.seriesId, season, team, constructor: ctor, count: 0, files: new Set() };
        combos.set(comboKey, c);
      }
      c.count++;
      c.files.add(path.relative(root, f).replace(/\\/g, '/'));

      let o = byOrg.get(org.foldKey);
      if (!o) {
        o = {
          foldKey: org.foldKey,
          slug: org.slug,
          canonicalName: org.canonicalName,
          seriesIds: new Set(),
          rawNames: new Map(), // raw string → count
          displayBySeason: new Map(), // seriesId|season → Map(rawTeam→count)
        };
        byOrg.set(org.foldKey, o);
      }
      o.seriesIds.add(org.seriesId);
      // Prefer longer / commercial team string as canonical display seed
      if (team && team.length >= o.canonicalName.length && !/^[A-Z0-9\-]+$/.test(team)) {
        // keep short core for F1; for stock keep first cleaned name
        if (!org.foldKey.startsWith('f1:')) {
          /* keep first cleaned */
        }
      }
      for (const raw of [team, ctor].filter(Boolean)) {
        o.rawNames.set(raw, (o.rawNames.get(raw) || 0) + 1);
      }
      if (season && team) {
        const sk = `${org.seriesId}|${season}`;
        let votes = o.displayBySeason.get(sk);
        if (!votes) {
          votes = new Map();
          o.displayBySeason.set(sk, votes);
        }
        votes.set(team, (votes.get(team) || 0) + 1);
      }
    }
  }

  return { combos, byOrg };
}

function loadJson(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

let cachedAliases = null;
let cachedRedirects = null;
let cachedProfiles = null;

export function loadTeamSlugAliases() {
  if (!cachedAliases) cachedAliases = loadJson('data/team_slug_aliases.json');
  return cachedAliases;
}

export function loadTeamProfileRedirects() {
  if (!cachedRedirects) cachedRedirects = loadJson('data/team_profile_redirects.json');
  return cachedRedirects;
}

export function loadTeamProfiles() {
  if (!cachedProfiles) cachedProfiles = loadJson('data/team_profiles.json');
  return cachedProfiles;
}

export function reloadTeamSlugMaps() {
  cachedAliases = null;
  cachedRedirects = null;
  cachedProfiles = null;
}

/** Resolve slug → canon using redirects (runtime) then aliases. */
export function resolveTeamSlug(slug) {
  let s = String(slug || '').trim().toLowerCase();
  if (!s) return '';
  const redirects = loadTeamProfileRedirects();
  const aliases = loadTeamSlugAliases();
  const profiles = loadTeamProfiles();
  const seen = new Set();
  while (s && !seen.has(s)) {
    seen.add(s);
    if (redirects[s]) {
      s = String(redirects[s]).trim().toLowerCase();
      continue;
    }
    if (aliases[s]) {
      s = String(aliases[s]).trim().toLowerCase();
      continue;
    }
    break;
  }
  if (profiles[s]) return s;
  return s;
}

export { foldDiacritics, root };
