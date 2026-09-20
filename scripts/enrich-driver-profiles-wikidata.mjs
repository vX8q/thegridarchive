#!/usr/bin/env node
/**
 * Enrich data/driver_profiles.json from Wikidata (P569 birth, P27 citizenship, P19 place).
 * Only fills EMPTY fields. Does not overwrite existing values.
 *
 * Usage:
 *   node scripts/enrich-driver-profiles-wikidata.mjs           # dry-run summary
 *   node scripts/enrich-driver-profiles-wikidata.mjs --write    # apply
 *   node scripts/enrich-driver-profiles-wikidata.mjs --write --limit=50
 *   node scripts/enrich-driver-profiles-wikidata.mjs --write --slugs=ben-gomersall,dino-van-der-geest
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const profilesPath = path.join(root, 'data', 'driver_profiles.json');
const UA = 'TGA/1.0 (https://github.com/vX8q/tga; enrich driver_profiles from Wikidata)';
const DELAY_MS = 1100;

const args = process.argv.slice(2);
const doWrite = args.includes('--write');
const limitArg = args.find((a) => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;
const slugsArg = args.find((a) => a.startsWith('--slugs='));
const onlySlugs = slugsArg
  ? new Set(slugsArg.split('=')[1].split(',').map((s) => s.trim()).filter(Boolean))
  : null;

const CIT_MAP = {
  'United States of America': 'United States',
  USA: 'United States',
  'U.S.': 'United States',
  'U.S.A.': 'United States',
  'Kingdom of the Netherlands': 'Netherlands',
  'People\'s Republic of China': 'China',
  'Republic of Korea': 'South Korea',
  'Czech Republic': 'Czechia',
  England: 'Great Britain',
  Scotland: 'Great Britain',
  Wales: 'Great Britain',
  'United Kingdom': 'Great Britain',
  'United Kingdom of Great Britain and Ireland': 'Great Britain',
  'Kingdom of Denmark': 'Denmark',
  'Kingdom of Sweden': 'Sweden',
  'Kingdom of Norway': 'Norway',
  'Kingdom of Spain': 'Spain',
  'Kingdom of Belgium': 'Belgium',
  'Federal Republic of Germany': 'Germany',
  'French Republic': 'France',
  'Italian Republic': 'Italy',
  'Swiss Confederation': 'Switzerland',
  'Republic of Austria': 'Austria',
  'Republic of Finland': 'Finland',
  'Republic of Poland': 'Poland',
  'Portuguese Republic': 'Portugal',
  'Republic of Ireland': 'Ireland',
  'Republic of India': 'India',
  'Federative Republic of Brazil': 'Brazil',
  'Argentine Republic': 'Argentina',
  'United Mexican States': 'Mexico',
  'New Zealand': 'New Zealand',
  Australia: 'Australia',
  Japan: 'Japan',
  Canada: 'Canada',
  Monaco: 'Monaco',
  'Hong Kong': 'Hong Kong',
  'People\'s Republic of China': 'China',
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function needsEnrich(d) {
  return !String(d.birth_date || '').trim()
    || !String(d.birth_place || '').trim()
    || !String(d.citizenship || '').trim();
}

function mapCitizenship(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  return CIT_MAP[s] || s;
}

function formatPlace(city, region, country) {
  const parts = [city, region, country].map((x) => String(x || '').trim()).filter(Boolean);
  // Drop duplicate country if region already ends with it
  const out = [];
  for (const p of parts) {
    if (out.length && out[out.length - 1] === p) continue;
    out.push(p);
  }
  if (out.length === 0) return '';
  // Canonical US suffix
  if (out[out.length - 1] === 'United States') {
    out[out.length - 1] = 'U.S.';
  }
  return out.join(', ');
}

async function wdSearch(name) {
  const u = new URL('https://www.wikidata.org/w/api.php');
  u.searchParams.set('action', 'wbsearchentities');
  u.searchParams.set('search', name);
  u.searchParams.set('language', 'en');
  u.searchParams.set('type', 'item');
  u.searchParams.set('limit', '8');
  u.searchParams.set('format', 'json');
  const res = await fetch(u, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`search HTTP ${res.status}`);
  const data = await res.json();
  const hits = Array.isArray(data.search) ? data.search : [];
  // ONLY accept motorsport-related descriptions — bare name matches are often wrong people
  for (const h of hits) {
    const desc = String(h.description || '').toLowerCase();
    if (/racing|motorsport|formula|nascar|rally|pilote|stock car|racing driver|race car/.test(desc)) {
      return h.id;
    }
  }
  return '';
}

/** Reject absurd DOBs for contemporary racing drivers (active ~1950–present). */
function plausibleBirthDate(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const y = parseInt(ymd.slice(0, 4), 10);
  if (y < 1945 || y > 2015) return false;
  return true;
}

async function wdEntity(qid) {
  const u = new URL('https://www.wikidata.org/w/api.php');
  u.searchParams.set('action', 'wbgetentities');
  u.searchParams.set('ids', qid);
  u.searchParams.set('props', 'claims|labels');
  u.searchParams.set('languages', 'en');
  u.searchParams.set('format', 'json');
  const res = await fetch(u, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`entity HTTP ${res.status}`);
  const data = await res.json();
  return data.entities?.[qid] || null;
}

async function wdLabel(qid, cache) {
  if (!qid) return '';
  if (cache[qid]) return cache[qid];
  const u = new URL('https://www.wikidata.org/w/api.php');
  u.searchParams.set('action', 'wbgetentities');
  u.searchParams.set('ids', qid);
  u.searchParams.set('props', 'labels');
  u.searchParams.set('languages', 'en');
  u.searchParams.set('format', 'json');
  const res = await fetch(u, { headers: { 'User-Agent': UA } });
  if (!res.ok) return '';
  const data = await res.json();
  const lab = data.entities?.[qid]?.labels?.en?.value || '';
  cache[qid] = lab;
  return lab;
}

function firstClaim(entity, prop) {
  const arr = entity?.claims?.[prop];
  if (!Array.isArray(arr) || !arr.length) return null;
  return arr[0]?.mainsnak?.datavalue?.value || null;
}

function birthFromClaim(val) {
  if (!val || typeof val !== 'object') return '';
  const t = String(val.time || '');
  // +1990-05-08T00:00:00Z
  const m = t.match(/([+-]?\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const y = m[1].replace(/^\+/, '');
  if (y.length !== 4) return '';
  return `${y}-${m[2]}-${m[3]}`;
}

async function resolvePlace(entity, labelCache) {
  const placeVal = firstClaim(entity, 'P19');
  if (!placeVal || !placeVal.id) return '';
  const placeId = placeVal.id;
  await sleep(200);
  // Get place entity for P131 (located in) + P17 (country)
  const placeEnt = await wdEntity(placeId);
  const city = await wdLabel(placeId, labelCache);
  let region = '';
  let country = '';
  const admin = firstClaim(placeEnt, 'P131');
  if (admin?.id) {
    await sleep(200);
    region = await wdLabel(admin.id, labelCache);
  }
  const ctry = firstClaim(placeEnt, 'P17');
  if (ctry?.id) {
    await sleep(200);
    country = mapCitizenship(await wdLabel(ctry.id, labelCache));
  }
  return formatPlace(city, region, country);
}

async function enrichOne(name, labelCache) {
  const qid = await wdSearch(name);
  if (!qid) return { ok: false, reason: 'not_found' };
  await sleep(DELAY_MS);
  const ent = await wdEntity(qid);
  if (!ent) return { ok: false, reason: 'no_entity' };
  const birth = birthFromClaim(firstClaim(ent, 'P569'));
  const citId = firstClaim(ent, 'P27')?.id || '';
  let citizenship = '';
  if (citId) {
    await sleep(200);
    citizenship = mapCitizenship(await wdLabel(citId, labelCache));
  }
  const birth_place = await resolvePlace(ent, labelCache);
  return { ok: true, qid, birth_date: birth, citizenship, birth_place };
}

function normalizePlaceString(place) {
  let s = String(place || '').trim();
  if (!s) return s;
  // "City (Country)" → "City, Country"
  s = s.replace(/^(.+?)\s*\(([^)]+)\)\s*$/, '$1, $2');
  // Country-only places stay as-is (better than empty)
  return s;
}

async function main() {
  const profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf8'));
  const report = {
    scanned: 0,
    candidates: 0,
    updated: 0,
    skipped: 0,
    notFound: 0,
    errors: 0,
    mechanical: { usa: 0, placeParen: 0 },
    changes: [],
  };

  // Mechanical fixes for all profiles
  for (const [slug, d] of Object.entries(profiles)) {
    if (!d || typeof d !== 'object') continue;
    if (String(d.citizenship || '').trim() === 'USA') {
      d.citizenship = 'United States';
      report.mechanical.usa++;
      report.changes.push({ slug, field: 'citizenship', from: 'USA', to: 'United States', source: 'normalize' });
    }
    const place = String(d.birth_place || '');
    if (/\([^)]+\)\s*$/.test(place)) {
      const next = normalizePlaceString(place);
      if (next !== place) {
        d.birth_place = next;
        report.mechanical.placeParen++;
        report.changes.push({ slug, field: 'birth_place', from: place, to: next, source: 'normalize' });
      }
    }
  }

  const candidates = Object.entries(profiles)
    .filter(([slug, d]) => {
      if (onlySlugs && !onlySlugs.has(slug)) return false;
      return needsEnrich(d);
    })
    .slice(0, Number.isFinite(limit) ? limit : undefined);

  report.scanned = Object.keys(profiles).length;
  report.candidates = candidates.length;

  const labelCache = {};
  let i = 0;
  for (const [slug, d] of candidates) {
    i++;
    const name = String(d.full_name || slug).trim();
    process.stderr.write(`[${i}/${candidates.length}] ${slug} (${name})… `);
    try {
      await sleep(DELAY_MS);
      const got = await enrichOne(name, labelCache);
      if (!got.ok) {
        report.notFound++;
        process.stderr.write(`${got.reason}\n`);
        continue;
      }
      const fields = [];
      if (!String(d.birth_date || '').trim() && got.birth_date) {
        if (!plausibleBirthDate(got.birth_date)) {
          process.stderr.write(`reject DOB ${got.birth_date} `);
        } else {
          d.birth_date = got.birth_date;
          fields.push('birth_date');
          report.changes.push({ slug, field: 'birth_date', to: got.birth_date, source: `wikidata:${got.qid}` });
        }
      }
      if (!String(d.citizenship || '').trim() && got.citizenship) {
        d.citizenship = got.citizenship;
        fields.push('citizenship');
        report.changes.push({ slug, field: 'citizenship', to: got.citizenship, source: `wikidata:${got.qid}` });
      }
      if (!String(d.birth_place || '').trim() && got.birth_place) {
        d.birth_place = got.birth_place;
        fields.push('birth_place');
        report.changes.push({ slug, field: 'birth_place', to: got.birth_place, source: `wikidata:${got.qid}` });
      }
      if (fields.length) {
        report.updated++;
        process.stderr.write(`ok ${fields.join(',')}\n`);
      } else {
        report.skipped++;
        process.stderr.write('no empty fields filled\n');
      }
    } catch (err) {
      report.errors++;
      process.stderr.write(`ERR ${err.message}\n`);
    }
  }

  if (doWrite) {
    fs.writeFileSync(profilesPath, JSON.stringify(profiles, null, 2) + '\n');
    process.stderr.write(`Wrote ${profilesPath}\n`);
  } else {
    process.stderr.write('Dry-run only (pass --write to save).\n');
  }

  const reportPath = path.join(root, 'docs', 'DRIVER_PROFILES_ENRICHMENT_REPORT.md');
  // Always write machine JSON for the human report builder
  fs.writeFileSync(
    path.join(root, '_driver_profiles_enrichment.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify({
    write: doWrite,
    scanned: report.scanned,
    candidates: report.candidates,
    updated: report.updated,
    notFound: report.notFound,
    errors: report.errors,
    mechanical: report.mechanical,
    changeCount: report.changes.length,
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
