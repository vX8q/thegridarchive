/**
 * Fix weak/missing top-series logos: resolve known File: titles → upload thumbs.
 * Usage: node scripts/fix-team-logos-quality.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outPath = path.join(root, 'data', 'team_logos.json');
const UA = 'TGA/1.0 (https://github.com/vX8q/tga; fix team logos)';

/** Prefer better files; DROP means delete bad entry. */
const REPLACE = {
  // Prefer Italian wordmark over ancient 2005 bull if available; else keep 2005.
  'red-bull-racing': [
    { file: 'Red Bull Racing logo ita.png', wiki: 'commons' },
    { file: 'Red Bull Racing - 2005 Logo.png', wiki: 'commons' },
  ],
  // Drop historic Holden Red Bull mark if we can find Ampol / Triple Eight
  'triple-eight-race-engineering': [
    { file: 'Red Bull Ampol Racing logo.png', wiki: 'en' },
    { file: 'Red Bull Ampol Racing logo.svg', wiki: 'commons' },
    { file: 'Triple Eight Race Engineering logo.png', wiki: 'en' },
    { file: 'Red Bull Holden Racing Team logo.png', wiki: 'en' },
  ],
  cadillac: [
    { file: 'Cadillac Formula 1 Team logo.png', wiki: 'en' },
    { file: 'Cadillac Racing logo.svg', wiki: 'commons' },
    { file: 'Cadillac wordmark.svg', wiki: 'commons' },
  ],
  // Keep RFK (verified racing logo) — re-resolve clean thumb
  'rfk-racing': [{ file: 'RFK logo.png', wiki: 'commons' }],
};

const ADD = {
  'prema-racing': [
    { file: 'Prema Racing logo.png', wiki: 'en' },
    { file: 'Prema Powerteam logo.png', wiki: 'en' },
    { file: 'Prema logo.svg', wiki: 'commons' },
  ],
  'chip-ganassi-racing': [
    { file: 'Chip Ganassi Racing logo.png', wiki: 'en' },
    { file: 'Chip Ganassi Racing.svg', wiki: 'commons' },
    { file: 'Ganassi logo.png', wiki: 'en' },
  ],
  'kaulig-racing': [
    { file: 'Kaulig Racing logo.png', wiki: 'en' },
    { file: 'Kaulig Racing.png', wiki: 'commons' },
  ],
  'front-row-motorsports': [
    { file: 'Front Row Motorsports logo.png', wiki: 'en' },
    { file: 'Front Row Motorsports.png', wiki: 'commons' },
  ],
  'jr-motorsports': [
    { file: 'JR Motorsports logo.png', wiki: 'en' },
    { file: 'JR Motorsports.png', wiki: 'commons' },
  ],
  'rick-ware-racing': [
    { file: 'Rick Ware Racing logo.png', wiki: 'en' },
    { file: 'Rick Ware Racing.png', wiki: 'commons' },
  ],
  'a-j-foyt-enterprises': [
    { file: 'A. J. Foyt Enterprises logo.png', wiki: 'en' },
    { file: 'AJ Foyt Racing logo.png', wiki: 'en' },
  ],
  'rahal-letterman-lanigan-racing': [
    { file: 'Rahal Letterman Lanigan Racing logo.png', wiki: 'en' },
    { file: 'RLL Racing logo.png', wiki: 'en' },
  ],
  'tickford-racing': [
    { file: 'Tickford Racing logo.png', wiki: 'en' },
    { file: 'Tickford Racing.png', wiki: 'commons' },
  ],
  'walkinshaw-twg-racing': [
    { file: 'Walkinshaw Andretti United logo.png', wiki: 'en' },
    { file: 'Walkinshaw Andretti United logo.jpg', wiki: 'commons' },
  ],
  'brad-jones-racing': [
    { file: 'Brad Jones Racing logo.png', wiki: 'en' },
    { file: 'Brad Jones Racing.png', wiki: 'commons' },
  ],
  'erebus-motorsport': [
    { file: 'Erebus Motorsport logo.png', wiki: 'en' },
    { file: 'Erebus Motorsport.png', wiki: 'commons' },
  ],
  'grove-racing': [
    { file: 'Grove Racing logo.png', wiki: 'en' },
    { file: 'Grove Racing.png', wiki: 'commons' },
  ],
  'team-18': [
    { file: 'Team 18 logo.png', wiki: 'en' },
    { file: 'Team 18 Supercars logo.png', wiki: 'en' },
  ],
  'matt-stone-racing': [
    { file: 'Matt Stone Racing logo.png', wiki: 'en' },
  ],
  'premiair-racing': [
    { file: 'PremiAir Racing logo.png', wiki: 'en' },
  ],
  'blanchard-racing-team': [
    { file: 'Blanchard Racing Team logo.png', wiki: 'en' },
  ],
  // After GetSpeed merge — attach logo to canon slug if any
  getspeed: [
    { file: 'GetSpeed logo.png', wiki: 'en' },
    { file: 'Mercedes-AMG Team GetSpeed logo.png', wiki: 'en' },
  ],
};

function clean(url) {
  if (!url) return null;
  try {
    const u = new URL(url.split('?')[0]);
    return u.origin.replace('thumb.wikimedia.org', 'upload.wikimedia.org') + u.pathname;
  } catch {
    return null;
  }
}

function toThumb(url) {
  let u = clean(url);
  if (!u) return null;
  u = u.replace('https://thumb.wikimedia.org/', 'https://upload.wikimedia.org/');
  if (/\.webp$/i.test(u) && !/\.webp\.png$/i.test(u)) u += '.png';
  return u;
}

async function resolve(file, wiki) {
  const host = wiki === 'en' ? 'https://en.wikipedia.org' : 'https://commons.wikimedia.org';
  const api =
    `${host}/w/api.php?` +
    new URLSearchParams({
      action: 'query',
      titles: `File:${file}`,
      prop: 'imageinfo',
      iiprop: 'url|mime|size',
      iiurlwidth: '250',
      format: 'json',
      origin: '*',
    });
  const r = await fetch(api, { headers: { 'User-Agent': UA } });
  const t = await r.text();
  if (t.startsWith('You are')) throw new Error('rate-limited');
  const j = JSON.parse(t);
  const page = Object.values(j.query?.pages || {})[0];
  if (!page || page.missing != null || !page.imageinfo?.[0]) return null;
  const info = page.imageinfo[0];
  return toThumb(info.thumburl || info.url);
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function tryList(slug, candidates, logos) {
  for (const c of candidates) {
    process.stdout.write(`${slug} ← ${c.file} (${c.wiki}) ... `);
    try {
      const url = await resolve(c.file, c.wiki);
      await sleep(1000);
      if (url) {
        logos[slug] = url;
        console.log('OK', url.split('/').pop());
        return true;
      }
      console.log('miss');
    } catch (e) {
      console.log('ERR', e.message);
      throw e;
    }
  }
  return false;
}

async function main() {
  let raw = fs.readFileSync(outPath, 'utf8');
  const end = raw.lastIndexOf('}');
  const logos = JSON.parse(raw.slice(0, end + 1));

  // Remap logos from merged slugs onto canon
  const remap = {
    'mercedes-amg-team-getspeed': 'getspeed',
    'cadillac-wayne-taylor-racing': 'wayne-taylor-racing',
    'dinamic-gt': 'dinamic-motorsport',
    'af-corse-usa': 'af-corse',
  };
  for (const [from, to] of Object.entries(remap)) {
    if (logos[from] && !logos[to]) logos[to] = logos[from];
    delete logos[from];
  }

  for (const [slug, cands] of Object.entries(REPLACE)) {
    await tryList(slug, cands, logos);
  }
  for (const [slug, cands] of Object.entries(ADD)) {
    if (logos[slug]) {
      console.log('keep', slug);
      continue;
    }
    await tryList(slug, cands, logos);
  }

  const sorted = {};
  for (const k of Object.keys(logos).sort()) sorted[k] = logos[k];
  fs.writeFileSync(outPath, JSON.stringify(sorted, null, 2) + '\n');
  console.log('total logos', Object.keys(sorted).length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
