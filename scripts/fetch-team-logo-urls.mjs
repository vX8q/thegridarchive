/**
 * Resolve Wikimedia Commons File: titles → upload.wikimedia.org URLs
 * and write data/team_logos.json for curated team slugs.
 *
 * Usage: node scripts/fetch-team-logo-urls.mjs
 *        node scripts/fetch-team-logo-urls.mjs --force   # re-resolve all
 *        node scripts/fetch-team-logo-urls.mjs --search  # Commons search fallback
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const UA = 'TGA/1.0 (https://github.com/vX8q/tga; team logo URL resolver)';
const force = process.argv.includes('--force');
const useSearch = process.argv.includes('--search');

/** slug → Commons File: titles (without File: prefix), preferred first */
const CANDIDATES = {
  // F1
  ferrari: ['Ferrari wordmark.svg', 'Scuderia Ferrari logo.svg'],
  mercedes: [
    'Mercedes-AMG Petronas F1 Team logo (2026).svg',
    'Mercedes AMG Petronas F1 Logo.svg',
  ],
  mclaren: ['McLaren Racing logo.png', 'McLaren logo 2021.svg'],
  'red-bull-racing': [
    'Red Bull Racing - 2005 Logo.png',
    'Oracle Red Bull Racing logo.svg',
    'Red Bull Racing logo.svg',
  ],
  williams: [
    'Williams Racing Logo 2024.webp',
    'Williams Racing logo.svg',
    'Williams F1 logo.svg',
  ],
  alpine: ['Alpine F1 Team Logo.svg', 'BWT Alpine F1 Team logo.svg', 'Alpine F1 Team logo.svg'],
  'aston-martin': [
    'Aston Martin Aramco Cognizant F1 logo.png',
    'Aston Martin Aramco F1 Team logo.svg',
    'Aston Martin F1 Team logo.png',
    'Aston Martin logo 2021.svg',
  ],
  haas: [
    'TGR Haas F1 Team Logo (2026).svg',
    'MoneyGram Haas F1 Team logo.svg',
    'Haas F1 Team logo 2019.svg',
  ],
  'racing-bulls': [
    'Visa Cash App RB Formula One Team logo.png',
    'Racing Bulls logo.png',
    'Visa Cash App RB logo.svg',
    'Scuderia AlphaTauri logo.svg',
  ],
  'kick-sauber': [
    'Logo of Stake F1 Team Kick Sauber.png',
    'Stake F1 Team Kick Sauber logo.png',
    'Kick Sauber logo.svg',
  ],
  audi: ['Audi Sport logo.svg', 'Audi rings.svg'],
  cadillac: ['Cadillac Formula 1 Team logo.svg', 'Cadillac logo.svg', 'Cadillac wordmark.svg'],

  // Cup / shared
  'hendrick-motorsports': ['Hendrick Motorsports logo.png', 'Hendrick Motorsports logo.svg'],
  'joe-gibbs-racing': ['Joe Gibbs Racing logo.png', 'Joe Gibbs Racing logo.svg'],
  'team-penske': ['Team Penske logo.svg', 'Penske logo.svg'],
  'richard-childress-racing': [
    'Richard Childress Racing logo.png',
    'Richard Childress Racing logo.svg',
  ],
  'rfk-racing': [
    'RFK Racing logo.png',
    'Roush Fenway Keselowski Racing logo.png',
    'Roush Fenway Racing logo.svg',
  ],
  '23xi-racing': ['23XI Racing logo.png', '23XI Racing logo.svg'],
  'trackhouse-racing': ['Trackhouse Racing logo.png', 'Trackhouse Racing logo.svg'],
  'front-row-motorsports': ['Front Row Motorsports logo.png', 'Front Row Motorsports logo.svg'],
  'spire-motorsports': ['Spire Motorsports logo.png', 'Spire Motorsports logo.svg'],
  'wood-brothers-racing': ['Wood Brothers Racing logo.png', 'Wood Brothers Racing logo.svg'],
  'kaulig-racing': ['Kaulig Racing logo.png', 'Kaulig Racing logo.svg'],
  'legacy-motor-club': ['Legacy Motor Club logo.png', 'Legacy Motor Club logo.svg'],
  'rick-ware-racing': ['Rick Ware Racing logo.png', 'Rick Ware Racing logo.svg'],
  'jr-motorsports': ['JR Motorsports logo.png', 'JR Motorsports logo.svg'],
  'haas-factory-team': [
    'Haas F1 Team logo 2019.svg',
    'Haas Factory Team logo.svg',
    'Haas Automation logo.svg',
  ],

  // IndyCar
  'andretti-global': [
    'Andretti Global logo.png',
    'Andretti Autosport logo.svg',
    'Andretti Autosport logo.png',
  ],
  'chip-ganassi-racing': ['Chip Ganassi Racing logo.png', 'Chip Ganassi Racing logo.svg'],
  'arrow-mclaren': [
    'Arrow McLaren logo (2023).png',
    'Arrow McLaren logo.svg',
    'Arrow McLaren SP logo.svg',
  ],
  'a-j-foyt-enterprises': [
    'A. J. Foyt Enterprises logo.png',
    'A.J. Foyt Enterprises logo.png',
    'A. J. Foyt Enterprises logo.svg',
  ],
  'dale-coyne-racing': ['Dale Coyne Racing logo.png', 'Dale Coyne Racing logo.svg'],
  'ed-carpenter-racing': ['Ed Carpenter Racing logo.png', 'Ed Carpenter Racing logo.svg'],
  'rahal-letterman-lanigan-racing': [
    'Rahal Letterman Lanigan Racing logo.png',
    'Rahal Letterman Lanigan Racing logo.svg',
  ],
  'meyer-shank-racing-with-curb-agajanian': [
    'Meyer Shank Racing logo.png',
    'Meyer Shank Racing logo.svg',
  ],
  'juncos-hollinger-racing': [
    'Juncos Hollinger Racing logo.png',
    'Juncos Racing logo.svg',
  ],
  'dreyer-reinbold-racing': [
    'Dreyer & Reinbold Racing logo.png',
    'Dreyer Reinbold Racing logo.png',
  ],

  // Supercars
  'triple-eight-race-engineering': [
    'Triple Eight Race Engineering logo.png',
    'Triple Eight Race Engineering logo.svg',
  ],
  'dick-johnson-racing': ['Dick Johnson Racing logo.png', 'Dick Johnson Racing logo.svg'],
  'tickford-racing': ['Tickford Racing logo.png', 'Tickford Racing logo.svg'],
  'walkinshaw-twg-racing': [
    'Walkinshaw Andretti United logo.png',
    'Walkinshaw TWG Racing logo.svg',
    'Walkinshaw Racing logo.png',
  ],
  'brad-jones-racing': ['Brad Jones Racing logo.png', 'Brad Jones Racing logo.svg'],
  'erebus-motorsport': ['Erebus Motorsport logo.png', 'Erebus Motorsport logo.svg'],
  'grove-racing': ['Grove Racing logo.png', 'Grove Racing logo.svg'],
  'team-18': ['Team 18 logo.png', 'Team 18 Supercars logo.png'],
  'matt-stone-racing': ['Matt Stone Racing logo.png', 'Matt Stone Racing logo.svg'],
  'premiair-racing': ['PremiAir Racing logo.png', 'PremiAir Racing logo.svg'],
  'blanchard-racing-team': ['Blanchard Racing Team logo.png', 'Blanchard Racing Team logo.svg'],

  // F2 / F3
  'prema-racing': ['Prema Racing logo.png', 'Prema Racing logo.svg', 'Prema Powerteam logo.svg'],
  'art-grand-prix': ['ART Grand Prix logo.png', 'ART Grand Prix logo.svg'],
  'campos-racing': ['Campos Racing logo.png', 'Campos Racing logo.svg'],
  'mp-motorsport': ['MP Motorsport logo.svg', 'MP Motorsport logo.png'],
  trident: ['Trident Motorsport logo.png', 'Trident Racing logo.svg', 'Trident logo.png'],
  'van-amersfoort-racing': [
    'Van Amersfoort Racing logo.png',
    'Van Amersfoort Racing logo.svg',
  ],
  hitech: ['Hitech Grand Prix logo.png', 'Hitech Grand Prix logo.svg', 'Hitech GP logo.png'],
  'dams-lucas-oil': ['DAMS logo.png', 'DAMS logo.svg', 'DAMS Lucas Oil logo.svg'],
  'rodin-motorsport': [
    'Rodin Motorsport logo.svg',
    'Rodin Carlin logo.svg',
    'Carlin Motorsport logo.svg',
  ],
  'invicta-racing': [
    'Invicta Racing logo.png',
    'Invicta Racing logo.svg',
    'Virtuosi Racing logo.svg',
  ],
  'aix-racing': ['AIX Racing logo.png', 'AIX Racing logo.svg'],
};

/** Extra search queries when candidates miss (used with --search). */
const SEARCH_QUERIES = {
  'aston-martin': 'Aston Martin Formula One logo',
  cadillac: 'Cadillac Formula One Team',
  'racing-bulls': 'Visa Cash App RB logo',
  'prema-racing': 'Prema Racing',
  'art-grand-prix': 'ART Grand Prix',
  'campos-racing': 'Campos Racing team logo',
  'dams-lucas-oil': 'DAMS motorsport logo',
  hitech: 'Hitech Grand Prix',
  'invicta-racing': 'Invicta Racing',
  trident: 'Trident Motorsport',
  'van-amersfoort-racing': 'Van Amersfoort Racing',
  'aix-racing': 'AIX Racing',
  'richard-childress-racing': 'Richard Childress Racing',
  'trackhouse-racing': 'Trackhouse Racing',
  'rfk-racing': 'RFK Racing',
  'front-row-motorsports': 'Front Row Motorsports',
  'kaulig-racing': 'Kaulig Racing',
  'spire-motorsports': 'Spire Motorsports',
  'wood-brothers-racing': 'Wood Brothers Racing',
  'jr-motorsports': 'JR Motorsports',
  'rick-ware-racing': 'Rick Ware Racing',
  'andretti-global': 'Andretti Global',
  'chip-ganassi-racing': 'Chip Ganassi Racing',
  'a-j-foyt-enterprises': 'A. J. Foyt Enterprises',
  'rahal-letterman-lanigan-racing': 'Rahal Letterman Lanigan',
  'ed-carpenter-racing': 'Ed Carpenter Racing',
  'dale-coyne-racing': 'Dale Coyne Racing',
  'juncos-hollinger-racing': 'Juncos Hollinger',
  'dreyer-reinbold-racing': 'Dreyer Reinbold',
  'triple-eight-race-engineering': 'Triple Eight Race Engineering',
  'dick-johnson-racing': 'Dick Johnson Racing',
  'tickford-racing': 'Tickford Racing',
  'walkinshaw-twg-racing': 'Walkinshaw Andretti United',
  'brad-jones-racing': 'Brad Jones Racing',
  'erebus-motorsport': 'Erebus Motorsport',
  'grove-racing': 'Grove Racing Supercars',
  'team-18': 'Team 18 Supercars',
  'matt-stone-racing': 'Matt Stone Racing',
  'premiair-racing': 'PremiAir Racing',
  'blanchard-racing-team': 'Blanchard Racing Team',
};

function cleanUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith('wikimedia.org') && u.hostname !== 'upload.wikimedia.org') return null;
    return u.origin + u.pathname;
  } catch {
    return null;
  }
}

async function resolveFileUrl(fileTitle) {
  const title = fileTitle.startsWith('File:') ? fileTitle : `File:${fileTitle}`;
  const api =
    'https://commons.wikimedia.org/w/api.php?' +
    new URLSearchParams({
      action: 'query',
      titles: title,
      prop: 'imageinfo',
      iiprop: 'url|mime',
      format: 'json',
      origin: '*',
    });
  const resp = await fetch(api, { headers: { 'User-Agent': UA } });
  if (!resp.ok) return null;
  const data = await resp.json();
  const pages = data?.query?.pages || {};
  for (const page of Object.values(pages)) {
    if (page.missing != null) continue;
    const url = cleanUrl(page.imageinfo?.[0]?.url);
    if (url) return url;
  }
  return null;
}

async function searchCommons(query) {
  const api =
    'https://commons.wikimedia.org/w/api.php?' +
    new URLSearchParams({
      action: 'query',
      list: 'search',
      srnamespace: '6',
      srlimit: '8',
      srsearch: query,
      format: 'json',
      origin: '*',
    });
  const resp = await fetch(api, { headers: { 'User-Agent': UA } });
  if (!resp.ok) return [];
  const data = await resp.json();
  return (data.query?.search || []).map((s) => s.title);
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function looksLikeLogo(title) {
  const t = title.toLowerCase();
  if (!/\.(svg|png|webp|jpg|jpeg)$/i.test(t)) return false;
  if (/(car|cockpit|helmet|driver|race|circuit|podium|grid)/i.test(t) && !/logo/i.test(t)) {
    return false;
  }
  return /logo|wordmark|emblem|badge/i.test(t) || /\.svg$/i.test(t);
}

async function main() {
  const outPath = path.join(root, 'data', 'team_logos.json');
  let existing = {};
  try {
    existing = JSON.parse(fs.readFileSync(outPath, 'utf8')) || {};
  } catch {
    existing = {};
  }

  // Strip UTM junk from any prior entries.
  const found = {};
  for (const [k, v] of Object.entries(existing)) {
    const c = cleanUrl(v);
    if (c) found[k] = c;
  }
  // arrow-mclaren previously pointed at generic McLaren Racing — force re-resolve.
  if (found['arrow-mclaren']?.includes('McLaren_Racing_logo')) {
    delete found['arrow-mclaren'];
  }

  const missing = [];
  const slugs = Object.keys(CANDIDATES).sort();

  for (const slug of slugs) {
    if (!force && found[slug]) {
      console.log('keep', slug);
      continue;
    }
    let url = null;
    for (const file of CANDIDATES[slug]) {
      process.stdout.write(`try ${slug} ← ${file} ... `);
      url = await resolveFileUrl(file);
      await sleep(800);
      if (url) {
        console.log('OK');
        found[slug] = url;
        break;
      }
      console.log('miss');
    }
    if (!url && useSearch) {
      const q = SEARCH_QUERIES[slug] || slug.replace(/-/g, ' ');
      process.stdout.write(`search ${slug} ← ${q} ... `);
      const titles = await searchCommons(q);
      await sleep(1000);
      for (const title of titles) {
        if (!looksLikeLogo(title)) continue;
        url = await resolveFileUrl(title);
        await sleep(800);
        if (url) {
          console.log('OK', title);
          found[slug] = url;
          break;
        }
      }
      if (!url) console.log('miss');
    }
    if (!url) missing.push(slug);
  }

  const sorted = {};
  for (const k of Object.keys(found).sort()) sorted[k] = found[k];

  const tmp = outPath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(sorted, null, 2) + '\n');
  fs.renameSync(tmp, outPath);

  console.log('\nwritten', Object.keys(sorted).length, 'logos →', outPath);
  console.log('still missing', missing.length, missing.join(', ') || '(none)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
