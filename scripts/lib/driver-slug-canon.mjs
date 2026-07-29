/**
 * Canonical driver slug helpers (shared by sync + fix scripts).
 * Alias map: data/driver_slug_aliases.json (nickname → preferred profile slug).
 * Also applies data/driver_profile_redirects.json when present.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const DIACRITICS = [
  ['ü', 'u'], ['Ü', 'u'], ['é', 'e'], ['É', 'e'], ['á', 'a'], ['Á', 'a'],
  ['â', 'a'], ['Â', 'a'], ['ã', 'a'], ['Ã', 'a'], ['à', 'a'], ['À', 'a'],
  ['í', 'i'], ['Í', 'i'], ['ó', 'o'], ['Ó', 'o'], ['ú', 'u'], ['Ú', 'u'],
  ['ñ', 'n'], ['Ñ', 'n'], ['ä', 'a'], ['Ä', 'a'], ['ö', 'o'], ['Ö', 'o'],
  ['ß', 'ss'], ['ø', 'o'], ['Ø', 'o'], ['å', 'a'], ['Å', 'a'],
  ['æ', 'ae'], ['Æ', 'ae'], ['ç', 'c'], ['Ç', 'c'],
  ['è', 'e'], ['È', 'e'], ['ê', 'e'], ['Ê', 'e'], ['ë', 'e'], ['Ë', 'e'],
  ['ì', 'i'], ['Ì', 'i'], ['î', 'i'], ['Î', 'i'], ['ï', 'i'], ['Ï', 'i'],
  ['ò', 'o'], ['Ò', 'o'], ['ô', 'o'], ['Ô', 'o'],
  ['ù', 'u'], ['Ù', 'u'], ['û', 'u'], ['Û', 'u'],
  ['ý', 'y'], ['Ý', 'y'], ['ÿ', 'y'],
  ['ž', 'z'], ['Ž', 'z'], ['š', 's'], ['Š', 's'], ['č', 'c'], ['Č', 'c'],
  ['ř', 'r'], ['Ř', 'r'], ['ď', 'd'], ['Ď', 'd'], ['ť', 't'], ['Ť', 't'],
  ['ň', 'n'], ['Ň', 'n'], ['ł', 'l'], ['Ł', 'l'],
  ['ą', 'a'], ['Ą', 'a'], ['ę', 'e'], ['Ę', 'e'], ['ś', 's'], ['Ś', 's'],
  ['ź', 'z'], ['Ź', 'z'], ['ż', 'z'], ['Ż', 'z'], ['ć', 'c'], ['Ć', 'c'],
  ['ő', 'o'], ['Ő', 'o'], ['ű', 'u'], ['Ű', 'u'],
];

export function foldDiacritics(s) {
  let out = String(s ?? '');
  for (const [from, to] of DIACRITICS) {
    out = out.split(from).join(to);
  }
  return out.trim();
}

/** Match Go driverutil.Slug / frontend foldDiacritics slugify. */
export function slugifyDriverName(name) {
  let s = foldDiacritics(String(name ?? '').trim().toLowerCase());
  s = s.replace(/[^a-z0-9\u0400-\u04ff]+/g, '-').replace(/^-+|-+$/g, '');
  return s;
}

function loadJson(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

let cachedAliases = null;
let cachedRedirects = null;

export function loadDriverSlugAliases() {
  if (!cachedAliases) cachedAliases = loadJson('data/driver_slug_aliases.json');
  return cachedAliases;
}

export function loadDriverProfileRedirects() {
  if (!cachedRedirects) cachedRedirects = loadJson('data/driver_profile_redirects.json');
  return cachedRedirects;
}

export function reloadDriverSlugMaps() {
  cachedAliases = null;
  cachedRedirects = null;
}

function stripEligibilitySuffix(slug) {
  const s = String(slug || '').trim().toLowerCase();
  for (const suf of ['-i', '-r', '-g']) {
    if (s.endsWith(suf) && s.length > suf.length) return s.slice(0, -suf.length);
  }
  return s;
}

/**
 * Resolve any slug/name to the canonical profile slug.
 * Order: strip eligibility → aliases → redirects (multi-hop) → return.
 */
export function canonicalizeDriverSlug(raw, opts = {}) {
  let slug = String(raw || '').trim().toLowerCase();
  if (!slug) return '';
  if (slug.includes(' ') || /[A-ZА-Я]/.test(String(raw || ''))) {
    // Looks like a display name — slugify first.
    if (!/^[a-z0-9\u0400-\u04ff-]+$/.test(slug) || slug.includes(' ')) {
      slug = slugifyDriverName(raw);
    }
  }
  slug = stripEligibilitySuffix(slug);

  const aliases = opts.aliases || loadDriverSlugAliases();
  const redirects = opts.redirects || loadDriverProfileRedirects();
  const seen = Object.create(null);

  for (let hop = 0; hop < 8; hop++) {
    if (seen[slug]) break;
    seen[slug] = true;
    if (aliases[slug]) {
      slug = String(aliases[slug]).trim().toLowerCase();
      continue;
    }
    if (redirects[slug]) {
      slug = String(redirects[slug]).trim().toLowerCase();
      continue;
    }
    break;
  }
  return slug;
}

/** Preferred display full_name for a canonical slug (when merging/creating). */
export const CANON_DISPLAY_NAMES = {
  'matthew-payne': 'Matthew Payne',
  'cameron-waters': 'Cameron Waters',
  'gio-ruggiero': 'Gio Ruggiero',
  'nico-varrone': 'Nicolas Varrone',
  'dave-sapienza': 'Dave Sapienza',
  'jon-mckennedy': 'Jon McKennedy',
  'alex-dunne': 'Alex Dunne',
  'daniel-juncadella': 'Daniel Juncadella',
  'maxwell-lynn': 'Maxwell Lynn',
  'daniel-harper': 'Daniel Harper',
  'kakunoshin-ohta': 'Kakunoshin Ohta',
  'josh-rattican': 'Josh Rattican',
  'benjamin-hanley': 'Benjamin Hanley',
  'john-hunter-nemechek': 'John Hunter Nemechek',
  'bobby-dale-earnhardt': 'Bobby Dale Earnhardt',
  'tobias-lutke': 'Tobias Lütke',
};

export function repoRoot() {
  return root;
}
