/**
 * Build team_profiles.json, team_slug_aliases.json, team_profile_redirects.json
 * from ALL distinct entry_list.team / constructor strings (not only display_name_by_season).
 *
 * Usage:
 *   node scripts/build-team-canon.mjs
 *   node scripts/build-team-canon.mjs --check
 *
 * Curated org metadata (founded, headquarters, lineage, owner, president, team_principal, staff)
 * on existing profiles is preserved across rebuilds.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  auditTeamEntryNames,
  slugifyTeamName,
  applyCuratedSlugMerge,
  titleCaseAllCapsOrgName,
  asciiOrgName,
  CURATED_SLUG_MERGES,
  root,
} from './lib/team-slug-canon.mjs';

const checkOnly = process.argv.includes('--check');

/** Optional curated scalar fields — copied forward from prior team_profiles.json. */
const ORG_META_KEYS = [
  'founded',
  'headquarters',
  'lineage',
  'owner',
  'president',
  'team_principal',
];

function pickVoteWinner(votes) {
  let best = '';
  let bestN = -1;
  for (const [k, n] of votes) {
    if (n > bestN || (n === bestN && k.length > best.length)) {
      best = k;
      bestN = n;
    }
  }
  return best;
}

function sortObject(obj) {
  const out = {};
  for (const k of Object.keys(obj).sort()) out[k] = obj[k];
  return out;
}

function readJsonObject(p) {
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
}

function mergeOrgMeta(profile, prior) {
  if (!prior || typeof prior !== 'object') return profile;
  for (const key of ORG_META_KEYS) {
    const v = prior[key];
    if (v == null) continue;
    const s = String(v).trim();
    if (s) profile[key] = s;
  }
  if (Array.isArray(prior.staff) && prior.staff.length) {
    const staff = [];
    for (const raw of prior.staff) {
      if (!raw || typeof raw !== 'object') continue;
      const name = String(raw.name || '').trim();
      const role = String(raw.role || '').trim();
      if (!name || !role) continue;
      let group = String(raw.group || 'other').trim().toLowerCase() || 'other';
      const row = { name, role, group };
      if (Array.isArray(raw.seasons) && raw.seasons.length) {
        row.seasons = [...new Set(raw.seasons.map((y) => String(y).trim()).filter(Boolean))];
      }
      staff.push(row);
    }
    if (staff.length) profile.staff = staff;
  }
  return profile;
}

function main() {
  const { byOrg } = auditTeamEntryNames();

  // Merge orgs that share the same slug across fold keys (e.g. same stock name in cup+truck
  // already share fold key via stock:fold; F1 cores share f1:slug).
  // If two fold keys collide on slug with different series families, keep both under
  // slug + keep first; rare — log collisions.
  const profiles = {};
  const aliases = {};
  const slugOwners = new Map(); // slug → foldKey

  const orgs = [...byOrg.values()].sort((a, b) => a.slug.localeCompare(b.slug));

  for (const o of orgs) {
    let slug = o.slug;
    if (!slug) continue;

    // Collision: same slug, different foldKey → prefer existing if same canonical family
    if (slugOwners.has(slug) && slugOwners.get(slug) !== o.foldKey) {
      const prev = profiles[slug];
      if (prev) {
        // Merge series_ids and raw alias coverage into existing
        for (const sid of o.seriesIds) {
          if (!prev.series_ids.includes(sid)) prev.series_ids.push(sid);
        }
        prev.series_ids.sort();
        for (const [raw] of o.rawNames) {
          const rawSlug = slugifyTeamName(raw);
          if (rawSlug && rawSlug !== slug) aliases[rawSlug] = slug;
        }
        for (const [sk, votes] of o.displayBySeason) {
          const winner = pickVoteWinner(votes);
          if (winner && !prev.display_name_by_season[sk]) {
            prev.display_name_by_season[sk] = winner;
          }
        }
        continue;
      }
    }

    const display_name_by_season = {};
    for (const [sk, votes] of o.displayBySeason) {
      const winner = pickVoteWinner(votes);
      if (winner) display_name_by_season[sk] = winner;
    }

    const series_ids = [...o.seriesIds].sort();
    profiles[slug] = {
      kind: 'organization',
      canonical_name: o.canonicalName,
      series_ids,
      display_name_by_season: sortObject(display_name_by_season),
    };
    slugOwners.set(slug, o.foldKey);

    // Aliases from EVERY distinct raw string for this org
    for (const [raw] of o.rawNames) {
      if (typeof raw !== 'string' || !raw.trim()) continue;
      if (/^function\s/i.test(raw) || raw.includes('[native code]')) continue;
      const rawSlug = applyCuratedSlugMerge(slugifyTeamName(raw));
      if (!rawSlug || rawSlug === slug) continue;
      // Don't steal another profile's canonical slug
      if (byOrgHasCanonSlug(orgs, rawSlug) && rawSlug !== slug) {
        // only alias if rawSlug is not itself a profile key we'll create
        const other = orgs.find((x) => x.slug === rawSlug && x.foldKey !== o.foldKey);
        if (other) continue;
      }
      aliases[rawSlug] = slug;
    }
  }

  // Explicit curated merges → redirects even if no raw alias was emitted
  for (const [from, to] of Object.entries(CURATED_SLUG_MERGES)) {
    if (from && to && from !== to) aliases[from] = to;
  }

  // Second pass: ensure every profile slug is not an alias target of itself
  for (const slug of Object.keys(profiles)) {
    delete aliases[slug];
  }

  // Normalize display names: ALL CAPS → title case; ASCII en-dash fold
  for (const slug of Object.keys(profiles)) {
    const p = profiles[slug];
    p.canonical_name = asciiOrgName(titleCaseAllCapsOrgName(p.canonical_name));
    if (p.display_name_by_season) {
      for (const k of Object.keys(p.display_name_by_season)) {
        p.display_name_by_season[k] = asciiOrgName(
          titleCaseAllCapsOrgName(p.display_name_by_season[k])
        );
      }
    }
  }

  // Preserve curated org metadata from the previous profiles file
  const profilesPath = path.join(root, 'data', 'team_profiles.json');
  const priorProfiles = readJsonObject(profilesPath);
  for (const slug of Object.keys(profiles)) {
    mergeOrgMeta(profiles[slug], priorProfiles[slug]);
  }
  // When curated merges retire a slug, carry its meta onto the canon target
  for (const [from, to] of Object.entries(CURATED_SLUG_MERGES)) {
    if (priorProfiles[from] && profiles[to]) {
      mergeOrgMeta(profiles[to], priorProfiles[from]);
    }
  }

  // Drop bogus aliases (defensive; see constructor prototype bug)
  for (const k of Object.keys(aliases)) {
    if (k === 'function-object-native-code' || k.startsWith('function-')) delete aliases[k];
  }

  // Redirects = aliases (runtime one-hop), plus identity for documentation
  const redirects = { ...aliases };

  const aliasesPath = path.join(root, 'data', 'team_slug_aliases.json');
  const redirectsPath = path.join(root, 'data', 'team_profile_redirects.json');

  const profilesOut = sortObject(profiles);
  const aliasesOut = sortObject(aliases);
  const redirectsOut = sortObject(redirects);

  const nextProfiles = JSON.stringify(profilesOut, null, 2) + '\n';
  const nextAliases = JSON.stringify(aliasesOut, null, 2) + '\n';
  const nextRedirects = JSON.stringify(redirectsOut, null, 2) + '\n';

  if (checkOnly) {
    const drift =
      readOrEmpty(profilesPath) !== nextProfiles ||
      readOrEmpty(aliasesPath) !== nextAliases ||
      readOrEmpty(redirectsPath) !== nextRedirects;
    if (drift) {
      console.error('team canon drift: run node scripts/build-team-canon.mjs');
      process.exit(1);
    }
    console.log(
      JSON.stringify({
        ok: true,
        profiles: Object.keys(profilesOut).length,
        aliases: Object.keys(aliasesOut).length,
      })
    );
    return;
  }

  fs.writeFileSync(profilesPath, nextProfiles);
  fs.writeFileSync(aliasesPath, nextAliases);
  fs.writeFileSync(redirectsPath, nextRedirects);

  // Sample audit: Alpine / JR / Ferrari
  const samples = ['alpine', 'jr-motorsports', 'ferrari', 'mercedes', 'prema-racing'];
  const sampleInfo = {};
  for (const s of samples) {
    sampleInfo[s] = profilesOut[s]
      ? {
          name: profilesOut[s].canonical_name,
          series: profilesOut[s].series_ids,
          seasons: Object.keys(profilesOut[s].display_name_by_season).length,
          alias_count: Object.values(aliasesOut).filter((v) => v === s).length,
        }
      : null;
  }

  console.log(
    JSON.stringify(
      {
        profiles: Object.keys(profilesOut).length,
        aliases: Object.keys(aliasesOut).length,
        redirects: Object.keys(redirectsOut).length,
        samples: sampleInfo,
      },
      null,
      2
    )
  );
}

function byOrgHasCanonSlug(orgs, slug) {
  return orgs.some((o) => o.slug === slug);
}

function readOrEmpty(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return '';
  }
}

main();
