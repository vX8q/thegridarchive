/**
 * Remove placeholder owners where owner === canonical_name (or display name).
 * Updates team_org_metadata.json and team_profiles.json.
 *
 * Usage: node scripts/scrub-placeholder-team-owners.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function fold(s) {
  return String(s || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function main() {
  const profilesPath = path.join(root, 'data', 'team_profiles.json');
  const metaPath = path.join(root, 'data', 'team_org_metadata.json');
  const profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf8'));
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

  let scrubbedProfiles = 0;
  let scrubbedMeta = 0;

  for (const [slug, t] of Object.entries(profiles)) {
    const owner = String(t.owner || '').trim();
    if (!owner) continue;
    const canon = String(t.canonical_name || '').trim();
    const displays = Object.values(t.display_name_by_season || {}).map((d) => String(d || '').trim());
    const isPlaceholder =
      fold(owner) === fold(canon) || displays.some((d) => d && fold(owner) === fold(d));
    if (!isPlaceholder) continue;
    delete t.owner;
    scrubbedProfiles++;
    if (meta[slug] && meta[slug].owner != null) {
      delete meta[slug].owner;
      scrubbedMeta++;
    }
  }

  // Also scrub meta-only placeholders that still match profile names
  for (const [slug, m] of Object.entries(meta)) {
    if (!m || m.owner == null) continue;
    const owner = String(m.owner || '').trim();
    const canon = String(profiles[slug]?.canonical_name || '').trim();
    if (canon && fold(owner) === fold(canon)) {
      delete m.owner;
      scrubbedMeta++;
    }
  }

  fs.writeFileSync(profilesPath, JSON.stringify(profiles, null, 2) + '\n');
  const sortedMeta = {};
  for (const k of Object.keys(meta).sort()) sortedMeta[k] = meta[k];
  fs.writeFileSync(metaPath, JSON.stringify(sortedMeta, null, 2) + '\n');
  console.log('scrubbed owners from profiles:', scrubbedProfiles, 'from meta:', scrubbedMeta);
}

main();
