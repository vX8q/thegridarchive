#!/usr/bin/env node
/**
 * Fix / audit nickname dual driver profiles.
 *
 *   node scripts/fix-driver-slug-aliases.mjs           # write mode
 *   node scripts/fix-driver-slug-aliases.mjs --check  # exit 1 if drift
 *
 * - Merges data/driver_slug_aliases.json into driver_profile_redirects.json
 * - Removes alias keys from driver_profiles.json (keeps canon; merges non-empty bio)
 * - Rewrites entry_list.driver_slug (+ nested) across data/events to canon
 * - Does not change display names in tables (only slugs)
 */
import fs from 'fs';
import path from 'path';
import {
  CANON_DISPLAY_NAMES,
  canonicalizeDriverSlug,
  loadDriverSlugAliases,
  reloadDriverSlugMaps,
  repoRoot,
} from './lib/driver-slug-canon.mjs';

const root = repoRoot();
const checkOnly = process.argv.includes('--check');

const aliasesPath = path.join(root, 'data', 'driver_slug_aliases.json');
const redirectsPath = path.join(root, 'data', 'driver_profile_redirects.json');
const profilesPath = path.join(root, 'data', 'driver_profiles.json');
const eventsDir = path.join(root, 'data', 'events');

const aliases = loadDriverSlugAliases();
const redirects = JSON.parse(fs.readFileSync(redirectsPath, 'utf8'));
const profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf8'));

const stats = {
  redirects_added: 0,
  redirects_updated: 0,
  profiles_removed: 0,
  profiles_merged_fields: 0,
  event_files_touched: 0,
  driver_slugs_rewritten: 0,
  issues: [],
};

function preferProfile(a, b) {
  // Prefer the one with more filled fields; else keep a.
  const score = (p) => {
    if (!p || typeof p !== 'object') return 0;
    let n = 0;
    for (const k of ['full_name', 'birth_date', 'birth_place', 'citizenship', 'photo_url']) {
      if (String(p[k] || '').trim()) n++;
    }
    return n;
  };
  return score(b) > score(a) ? b : a;
}

function mergeProfile(canon, aliasProf) {
  if (!aliasProf || typeof aliasProf !== 'object') return canon;
  const out = { ...(canon || {}) };
  for (const k of ['full_name', 'birth_date', 'birth_place', 'citizenship', 'photo_url', 'death_date', 'death_place']) {
    const av = String(out[k] || '').trim();
    const bv = String(aliasProf[k] || '').trim();
    if (!av && bv) {
      out[k] = aliasProf[k];
      stats.profiles_merged_fields++;
    }
  }
  return out;
}

// 1) Redirects: every alias → canon
for (const [alias, canon] of Object.entries(aliases)) {
  const a = String(alias).toLowerCase();
  const c = String(canon).toLowerCase();
  if (!c || a === c) {
    stats.issues.push(`bad alias ${a} → ${c}`);
    continue;
  }
  if (redirects[a] !== c) {
    if (redirects[a]) stats.redirects_updated++;
    else stats.redirects_added++;
    redirects[a] = c;
  }
  // Never keep a redirect that points alias→something else as a profile key.
}

// Fix broken known redirect if target missing: drop or leave for later
if (redirects['abdulla-ali-al-khelaifi'] && !profiles['abdulla-al-khelaifi'] && !profiles[redirects['abdulla-ali-al-khelaifi']]) {
  // Keep redirect; ensure empty target profile exists so API doesn't 404
  if (!profiles['abdulla-al-khelaifi']) {
    profiles['abdulla-al-khelaifi'] = {
      full_name: 'Abdulla Al Khelaifi',
      birth_date: '',
      birth_place: '',
      citizenship: '',
      photo_url: '',
    };
  }
}

// 2) Profiles: remove aliases, ensure canons exist
for (const [alias, canon] of Object.entries(aliases)) {
  const a = String(alias).toLowerCase();
  const c = String(canon).toLowerCase();
  if (profiles[a]) {
    const merged = mergeProfile(profiles[c], profiles[a]);
    if (CANON_DISPLAY_NAMES[c] && !String(merged.full_name || '').trim()) {
      merged.full_name = CANON_DISPLAY_NAMES[c];
    } else if (CANON_DISPLAY_NAMES[c]) {
      // Prefer canonical display name when both empty-bio stubs
      const bothEmpty =
        !String(merged.photo_url || '').trim() &&
        !String(merged.birth_date || '').trim();
      if (bothEmpty) merged.full_name = CANON_DISPLAY_NAMES[c];
    }
    profiles[c] = merged || profiles[c] || {
      full_name: CANON_DISPLAY_NAMES[c] || c.replace(/-/g, ' '),
      birth_date: '',
      birth_place: '',
      citizenship: '',
      photo_url: '',
    };
    delete profiles[a];
    stats.profiles_removed++;
  } else if (!profiles[c]) {
    profiles[c] = {
      full_name: CANON_DISPLAY_NAMES[c] || c.replace(/-/g, ' '),
      birth_date: '',
      birth_place: '',
      citizenship: '',
      photo_url: '',
    };
  } else if (CANON_DISPLAY_NAMES[c]) {
    const bothEmpty =
      !String(profiles[c].photo_url || '').trim() &&
      !String(profiles[c].birth_date || '').trim();
    if (bothEmpty) profiles[c].full_name = CANON_DISPLAY_NAMES[c];
  }
}

// Ensure no profile key is also a redirect source
for (const src of Object.keys(redirects)) {
  if (profiles[src]) {
    const target = redirects[src];
    profiles[target] = preferProfile(profiles[target], profiles[src]);
    profiles[target] = mergeProfile(profiles[target], profiles[src]);
    delete profiles[src];
    stats.profiles_removed++;
    stats.issues.push(`removed profile that was redirect source: ${src} → ${target}`);
  }
}

function rewriteSlugsInObject(obj) {
  let n = 0;
  if (!obj || typeof obj !== 'object') return n;
  if (Array.isArray(obj)) {
    for (const item of obj) n += rewriteSlugsInObject(item);
    return n;
  }
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'driver_slug' && typeof v === 'string' && v.trim()) {
      const canon = canonicalizeDriverSlug(v, { aliases, redirects });
      if (canon && canon !== v) {
        obj[k] = canon;
        n++;
      }
    } else if (v && typeof v === 'object') {
      n += rewriteSlugsInObject(v);
    }
  }
  return n;
}

function walkEvents(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walkEvents(p);
      continue;
    }
    if (!ent.isFile() || !ent.name.endsWith('.json')) continue;
    let obj;
    try {
      obj = JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch {
      continue;
    }
    const n = rewriteSlugsInObject(obj);
    if (n > 0) {
      stats.event_files_touched++;
      stats.driver_slugs_rewritten += n;
      if (!checkOnly) {
        fs.writeFileSync(p, `${JSON.stringify(obj, null, 2)}\n`, 'utf8');
      }
    }
  }
}

walkEvents(eventsDir);

// Sort redirects + profiles for stable diffs
const orderedRedirects = {};
for (const k of Object.keys(redirects).sort()) orderedRedirects[k] = redirects[k];
const orderedProfiles = {};
for (const k of Object.keys(profiles).sort()) orderedProfiles[k] = profiles[k];

const drift =
  stats.redirects_added +
  stats.redirects_updated +
  stats.profiles_removed +
  stats.driver_slugs_rewritten +
  stats.profiles_merged_fields;

if (checkOnly) {
  console.log(JSON.stringify({ mode: 'check', drift, ...stats }, null, 2));
  if (drift > 0) process.exit(1);
  process.exit(0);
}

fs.writeFileSync(redirectsPath, `${JSON.stringify(orderedRedirects, null, 2)}\n`, 'utf8');
fs.writeFileSync(profilesPath, `${JSON.stringify(orderedProfiles, null, 2)}\n`, 'utf8');
// Keep aliases file sorted
const orderedAliases = {};
for (const k of Object.keys(aliases).sort()) orderedAliases[k] = aliases[k];
fs.writeFileSync(aliasesPath, `${JSON.stringify(orderedAliases, null, 2)}\n`, 'utf8');

reloadDriverSlugMaps();
console.log(JSON.stringify({ mode: 'write', ...stats, total_profiles: Object.keys(orderedProfiles).length }, null, 2));
