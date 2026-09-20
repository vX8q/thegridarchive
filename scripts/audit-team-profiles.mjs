/**
 * Full audit of team profiles / metadata / redirects / logos.
 * Usage: node scripts/audit-team-profiles.mjs
 *        node scripts/audit-team-profiles.mjs --json   # full JSON on stdout
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const profiles = JSON.parse(fs.readFileSync(path.join(root, 'data', 'team_profiles.json'), 'utf8'));
const meta = JSON.parse(fs.readFileSync(path.join(root, 'data', 'team_org_metadata.json'), 'utf8'));
const redirects = JSON.parse(fs.readFileSync(path.join(root, 'data', 'team_profile_redirects.json'), 'utf8'));
const aliases = JSON.parse(fs.readFileSync(path.join(root, 'data', 'team_slug_aliases.json'), 'utf8'));
const logosPath = path.join(root, 'data', 'team_logos.json');
const logos = fs.existsSync(logosPath) ? JSON.parse(fs.readFileSync(logosPath, 'utf8')) : {};

const META = ['founded', 'headquarters', 'lineage', 'owner', 'president', 'team_principal'];
const STOCK = new Set(['nascar_cup', 'noaps', 'nascar_truck', 'nascar_modified', 'arca']);
const OPENWHEEL = new Set(['f1', 'f2', 'f3', 'frec', 'f4_it', 'indycar', 'super_formula', 'psc']);
const GENERIC_HQ = new Set([
  'United States',
  'Europe',
  'Japan',
  'France',
  'Italy',
  'Germany',
  'Belgium',
  'United Kingdom',
  'Switzerland',
  'Netherlands',
  'Spain',
  'Poland',
  'Luxembourg',
  'Austria',
  'Canada',
  'Hong Kong',
  'Denmark',
  'Portugal',
  'Australia',
]);

const issues = [];
function add(sev, cat, slug, msg, extra = {}) {
  issues.push({ sev, cat, slug, msg, ...extra });
}

const bySeries = {};
let withFounded = 0;
let withHQ = 0;
let withOwner = 0;
let withPres = 0;
let withTP = 0;
let genericHQ = 0;
let weakOwner = 0;
let logoHits = 0;
let ownerEqualsName = 0;
let noDisplay = 0;

function logoKeyHit(slug) {
  if (logos[slug]) return true;
  for (const k of Object.keys(logos)) {
    const nk = String(k)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (nk === slug) return true;
  }
  return false;
}

for (const [slug, t] of Object.entries(profiles)) {
  const series = t.series_ids || [];
  for (const s of series) bySeries[s] = (bySeries[s] || 0) + 1;

  if (!t.kind) add('error', 'schema', slug, 'missing kind');
  if (!t.canonical_name) add('error', 'schema', slug, 'missing canonical_name');
  if (!series.length) add('error', 'schema', slug, 'empty series_ids');
  if (!t.display_name_by_season || !Object.keys(t.display_name_by_season).length) {
    noDisplay++;
    add('warn', 'schema', slug, 'empty display_name_by_season');
  }

  const founded = String(t.founded || '').trim();
  const hq = String(t.headquarters || '').trim();
  const owner = String(t.owner || '').trim();
  const pres = String(t.president || '').trim();
  const tp = String(t.team_principal || '').trim();

  if (founded) withFounded++;
  else add('info', 'coverage', slug, 'no founded year', { series });
  if (hq) withHQ++;
  else add('warn', 'coverage', slug, 'no headquarters', { series });
  if (owner) withOwner++;
  else add('warn', 'coverage', slug, 'no owner', { series });
  if (pres) withPres++;
  if (tp) withTP++;

  if (hq && GENERIC_HQ.has(hq)) {
    genericHQ++;
    add('info', 'meta-quality', slug, 'generic headquarters: ' + hq, { series });
  }
  if (owner && owner === t.canonical_name) {
    ownerEqualsName++;
    add('info', 'meta-quality', slug, 'owner equals canonical_name (placeholder)', { series });
  } else if (owner && (owner.length <= 3 || /^[A-Z0-9]{1,5}$/.test(owner))) {
    weakOwner++;
    add('warn', 'meta-quality', slug, 'weak/truncated owner: ' + owner, { series });
  }

  const isStock = series.some((s) => STOCK.has(s));
  const isOpen = series.some((s) => OPENWHEEL.has(s));
  if (pres && isOpen && !isStock) {
    add('warn', 'meta-role', slug, 'president set on open-wheel-focused org', { series, pres });
  }
  if (tp && isStock && !isOpen) {
    add('warn', 'meta-role', slug, 'team_principal on stock-car-only org', { series, tp });
  }
  if (founded && !/^\d{4}$/.test(founded)) {
    add('error', 'meta', slug, 'founded not YYYY: ' + founded);
  }
  if (founded) {
    const y = Number(founded);
    if (y < 1900 || y > 2026) add('warn', 'meta', slug, 'founded year out of expected range: ' + founded);
  }

  for (const f of META) {
    const v = String(t[f] || '');
    if (/[^\x00-\x7F]/.test(v)) add('error', 'ascii', slug, f + ' has non-ASCII');
  }
  if (/[^\x00-\x7F]/.test(String(t.canonical_name || ''))) {
    add('warn', 'ascii', slug, 'canonical_name has non-ASCII');
  }

  if (logoKeyHit(slug)) logoHits++;
  else add('info', 'logo', slug, 'no entry in team_logos.json');
}

const byName = {};
for (const [slug, t] of Object.entries(profiles)) {
  const n = String(t.canonical_name || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  (byName[n] = byName[n] || []).push(slug);
}
for (const [n, slugs] of Object.entries(byName)) {
  if (slugs.length > 1) {
    add('warn', 'canon', slugs.join(' | '), 'duplicate canonical_name: ' + n, { slugs });
  }
}

const slugList = Object.keys(profiles);
for (let i = 0; i < slugList.length; i++) {
  for (let j = i + 1; j < slugList.length; j++) {
    const a = slugList[i];
    const b = slugList[j];
    if (a.replace(/-/g, '') === b.replace(/-/g, '')) {
      add('warn', 'canon', a + ' / ' + b, 'near-duplicate slugs (dash-insensitive)', { slugs: [a, b] });
    }
  }
}

// similar names (fold punctuation)
const foldName = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
const byFold = {};
for (const [slug, t] of Object.entries(profiles)) {
  const f = foldName(t.canonical_name);
  if (!f) continue;
  (byFold[f] = byFold[f] || []).push(slug);
}
for (const [f, slugs] of Object.entries(byFold)) {
  if (slugs.length > 1) {
    add('warn', 'canon', slugs.join(' | '), 'near-duplicate names after fold: ' + f, { slugs });
  }
}

let badRedirect = 0;
let selfRedirect = 0;
let orphanRedirectFromProfile = 0;
for (const [from, to] of Object.entries(redirects)) {
  if (from === to) {
    selfRedirect++;
    add('info', 'redirect', from, 'self-redirect');
  }
  if (to && !profiles[to]) {
    badRedirect++;
    add('error', 'redirect', from, 'redirect target missing: ' + to);
  }
}
for (const slug of Object.keys(profiles)) {
  if (redirects[slug] && redirects[slug] !== slug) {
    orphanRedirectFromProfile++;
    add('warn', 'redirect', slug, 'profile slug also redirects to ' + redirects[slug]);
  }
}

let badAlias = 0;
for (const [from, to] of Object.entries(aliases)) {
  if (!to) continue;
  if (!profiles[to]) {
    badAlias++;
    add('warn', 'alias', from, 'alias target not in profiles: ' + to);
  }
}

let metaOnly = 0;
for (const slug of Object.keys(meta)) {
  if (!profiles[slug]) {
    metaOnly++;
    add('warn', 'overlay', slug, 'in team_org_metadata but not profiles');
  }
}

// coverage by series
const coverageBySeries = {};
for (const [slug, t] of Object.entries(profiles)) {
  for (const s of t.series_ids || []) {
    if (!coverageBySeries[s]) {
      coverageBySeries[s] = { teams: 0, founded: 0, cityHQ: 0, genericHQ: 0, president: 0, tp: 0, logos: 0 };
    }
    const c = coverageBySeries[s];
    c.teams++;
    if (t.founded) c.founded++;
    const hq = String(t.headquarters || '').trim();
    if (hq && !GENERIC_HQ.has(hq)) c.cityHQ++;
    if (GENERIC_HQ.has(hq)) c.genericHQ++;
    if (t.president) c.president++;
    if (t.team_principal) c.tp++;
    if (logoKeyHit(slug)) c.logos++;
  }
}

const sevCount = { error: 0, warn: 0, info: 0 };
const byCat = {};
for (const i of issues) {
  sevCount[i.sev] = (sevCount[i.sev] || 0) + 1;
  byCat[i.cat] = (byCat[i.cat] || 0) + 1;
}

const report = {
  generated_at: new Date().toISOString(),
  totals: {
    profiles: Object.keys(profiles).length,
    redirects: Object.keys(redirects).length,
    aliases: Object.keys(aliases).length,
    logos_keys: Object.keys(logos).length,
    meta_overlay: Object.keys(meta).length,
    withFounded,
    withHQ,
    withOwner,
    withPres,
    withTP,
    genericHQ,
    weakOwner,
    ownerEqualsName,
    logoHits,
    noDisplay,
    badRedirect,
    selfRedirect,
    badAlias,
    metaOnly,
    orphanRedirectFromProfile,
  },
  bySeries,
  coverageBySeries,
  sevCount,
  byCat,
  issues,
};

if (process.argv.includes('--json')) {
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

console.log(JSON.stringify({ totals: report.totals, sevCount, byCat }, null, 2));
console.log('\n=== coverageBySeries ===');
for (const s of Object.keys(coverageBySeries).sort()) {
  const c = coverageBySeries[s];
  console.log(
    s,
    'teams=' + c.teams,
    'founded=' + c.founded,
    'cityHQ=' + c.cityHQ,
    'genericHQ=' + c.genericHQ,
    'pres=' + c.president,
    'tp=' + c.tp,
    'logos=' + c.logos
  );
}
console.log('\n=== errors ===');
for (const i of issues.filter((x) => x.sev === 'error')) {
  console.log(i.cat, i.slug, '-', i.msg);
}
console.log('\n=== warns (first 60) ===');
for (const i of issues.filter((x) => x.sev === 'warn').slice(0, 60)) {
  console.log(i.cat, i.slug, '-', i.msg);
}
