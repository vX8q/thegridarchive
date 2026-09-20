/**
 * Merge curated org metadata into data/team_profiles.json.
 *
 * Usage:
 *   node scripts/apply-team-org-metadata.mjs
 *   node scripts/apply-team-org-metadata.mjs --check
 *
 * Source: data/team_org_metadata.json
 *   slug → {founded,headquarters,lineage,owner,president,team_principal,staff[]}
 * ASCII-only Latin values; unknown fields omitted.
 * lineage: historical name chain with " → " (omit for greenfield teams).
 * staff[] items: { name, role, group, seasons? } — group is management|sporting|technical|operations|other
 * Optional seasons: string[] of years (e.g. ["2024","2025"]). Omit = applies to all seasons.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check');
const META_KEYS = ['founded', 'headquarters', 'lineage', 'owner', 'president', 'team_principal'];
const STAFF_GROUPS = new Set(['management', 'sporting', 'technical', 'operations', 'other']);

function foldAscii(s) {
  return String(s || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2192/g, '->')
    .replace(/\u00A0/g, ' ')
    .trim();
}

function normalizeStaffSeasons(raw) {
  if (!Array.isArray(raw) || !raw.length) return null;
  const out = [];
  const seen = new Set();
  for (const y of raw) {
    const s = String(y == null ? '' : y).trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out.length ? out : null;
}

function normalizeStaff(list) {
  if (!Array.isArray(list)) return null;
  const out = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const name = foldAscii(raw.name);
    const role = foldAscii(raw.role);
    if (!name || !role) continue;
    let group = foldAscii(raw.group || 'other').toLowerCase();
    if (!STAFF_GROUPS.has(group)) group = 'other';
    const row = { name, role, group };
    const seasons = normalizeStaffSeasons(raw.seasons);
    if (seasons) row.seasons = seasons;
    out.push(row);
  }
  return out;
}

function staffEqual(a, b) {
  return JSON.stringify(a || null) === JSON.stringify(b || null);
}

function main() {
  const profilesPath = path.join(root, 'data', 'team_profiles.json');
  const metaPath = path.join(root, 'data', 'team_org_metadata.json');
  const profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf8'));
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

  let updated = 0;
  let unknownSlugs = [];
  for (const [slug, fields] of Object.entries(meta)) {
    if (!profiles[slug]) {
      unknownSlugs.push(slug);
      continue;
    }
    if (!fields || typeof fields !== 'object') continue;
    let touched = false;
    for (const key of META_KEYS) {
      if (fields[key] == null) continue;
      const v = foldAscii(fields[key]);
      if (!v) continue;
      if (profiles[slug][key] !== v) {
        profiles[slug][key] = v;
        touched = true;
      }
    }
    if (Object.prototype.hasOwnProperty.call(fields, 'staff')) {
      const staff = normalizeStaff(fields.staff);
      if (staff && staff.length) {
        if (!staffEqual(profiles[slug].staff, staff)) {
          profiles[slug].staff = staff;
          touched = true;
        }
      } else if (profiles[slug].staff) {
        delete profiles[slug].staff;
        touched = true;
      }
    }
    if (touched) updated++;
  }

  if (unknownSlugs.length) {
    console.warn('Unknown slugs in metadata (skipped):', unknownSlugs.join(', '));
  }

  if (checkOnly) {
    console.log(`Would update ${updated} profiles (${Object.keys(meta).length} metadata entries).`);
    return;
  }

  fs.writeFileSync(profilesPath, JSON.stringify(profiles, null, 2) + '\n', 'utf8');
  console.log(`Updated ${updated} profiles from ${Object.keys(meta).length} metadata entries.`);
}

main();
