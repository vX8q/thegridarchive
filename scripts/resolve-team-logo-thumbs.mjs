/**
 * Resolve each curated Commons/enwiki file to a Go-decodable raster URL
 * via imageinfo iiurlwidth=200 (official thumb URL).
 *
 * Usage: node scripts/resolve-team-logo-thumbs.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outPath = path.join(root, 'data', 'team_logos.json');
const UA = 'TGA/1.0 (https://github.com/vX8q/tga; resolve logo thumbs)';

/** slug → File: title (without prefix) on commons or enwiki */
const FILES = {
  '23xi-racing': { file: '23XI Racing logo.png', wiki: 'commons' },
  'aix-racing': { file: 'PHMAixLogo.png', wiki: 'commons' },
  alpine: { file: 'Alpine F1 Team Logo.svg', wiki: 'commons' },
  'andretti-global': { file: 'Andretti-global-logo-1.webp', wiki: 'commons' },
  'arrow-mclaren': { file: 'Arrow McLaren logo (2023).png', wiki: 'commons' },
  'art-grand-prix': { file: 'ART Grand Prix.png', wiki: 'en' },
  'aston-martin': { file: 'Aston Martin F1 Team logo 2024.jpg', wiki: 'commons' },
  audi: { file: 'Audi Sport logo.svg', wiki: 'commons' },
  cadillac: { file: 'Cadillac emblem.jpg', wiki: 'commons' },
  'campos-racing': { file: 'Logo Campos Racing 2021.jpg', wiki: 'commons' },
  'dale-coyne-racing': {
    file: 'Dale Coyne Racing with Vasser Sullivan Logo.png',
    wiki: 'commons',
  },
  'dams-lucas-oil': { file: 'Team-Logo DAMS023.webp', wiki: 'commons' },
  'ed-carpenter-racing': { file: 'Ecr 2025 logo.png', wiki: 'commons' },
  ferrari: { file: 'Ferrari wordmark.svg', wiki: 'commons' },
  haas: { file: 'TGR Haas F1 Team Logo (2026).svg', wiki: 'commons' },
  'haas-factory-team': { file: 'Haas F1 Team logo 2019.svg', wiki: 'commons' },
  'hendrick-motorsports': { file: 'Hendrick Motorsports logo.png', wiki: 'commons' },
  hitech: { file: 'Hitech Grand Prix logo (2025).svg', wiki: 'commons' },
  'invicta-racing': { file: 'Virtuosi Racing logo.png', wiki: 'commons' },
  'joe-gibbs-racing': { file: 'Joe Gibbs Racing logo.png', wiki: 'commons' },
  'juncos-hollinger-racing': { file: 'Juncos Hollinger Racing logo.webp', wiki: 'commons' },
  'kick-sauber': { file: 'Logo of Stake F1 Team Kick Sauber.png', wiki: 'commons' },
  'legacy-motor-club': { file: 'Legacy Motor Club logo.png', wiki: 'commons' },
  mclaren: { file: 'McLaren Racing logo.png', wiki: 'commons' },
  mercedes: { file: 'Mercedes-AMG Petronas F1 Team logo (2026).svg', wiki: 'commons' },
  'meyer-shank-racing-with-curb-agajanian': {
    file: 'Meyer Shank Racing logo.png',
    wiki: 'commons',
  },
  'mp-motorsport': { file: 'MP Motorsport logo.svg', wiki: 'commons' },
  'red-bull-racing': { file: 'Red Bull Racing - 2005 Logo.png', wiki: 'commons' },
  'rfk-racing': { file: 'RFK logo.png', wiki: 'commons' },
  'richard-childress-racing': { file: 'Richard Childress Racing.png', wiki: 'commons' },
  'rodin-motorsport': { file: 'Rodin Motorsport logo.svg', wiki: 'commons' },
  'spire-motorsports': { file: 'Spire Motorsports yellow logo.png', wiki: 'commons' },
  'team-penske': { file: 'Team Penske logo.svg', wiki: 'commons' },
  trident: { file: 'Logo Trident 2024-2025.png', wiki: 'commons' },
  'van-amersfoort-racing': { file: 'VAR logo.png', wiki: 'commons' },
  williams: { file: 'Williams Racing Logo 2024.webp', wiki: 'commons' },
  'wood-brothers-racing': { file: 'Wood Brothers Racing.png', wiki: 'commons' },
};

function clean(url) {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return null;
  }
}

async function resolveThumb(file, wiki) {
  const host =
    wiki === 'en' ? 'https://en.wikipedia.org' : 'https://commons.wikimedia.org';
  const api =
    `${host}/w/api.php?` +
    new URLSearchParams({
      action: 'query',
      titles: `File:${file}`,
      prop: 'imageinfo',
      iiprop: 'url|mime|size',
      iiurlwidth: '200',
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
  // Prefer raster thumb; fall back to original if already png/jpeg.
  // API may return thumb.wikimedia.org — rewrite to upload.wikimedia.org (allowlist).
  const rewriteHost = (u) =>
    u ? u.replace('https://thumb.wikimedia.org/', 'https://upload.wikimedia.org/') : null;
  let thumb = rewriteHost(clean(info.thumburl));
  const orig = rewriteHost(clean(info.url));
  const mime = info.mime || '';
  // WebP thumbs sometimes omit .png — force PNG conversion suffix when possible.
  if (thumb && /\.webp$/i.test(thumb) && !/\.webp\.png$/i.test(thumb)) {
    thumb = `${thumb}.png`;
  }
  if (thumb && (/\.png$/i.test(thumb) || /\.jpe?g$/i.test(thumb))) return thumb;
  if (/^image\/(png|jpeg|gif)$/i.test(mime) && orig && info.size && info.size < 500_000) {
    return orig;
  }
  if (thumb) return thumb;
  // Large originals: synthesize a 250px thumb path when possible.
  if (orig) {
    const m = orig.match(
      /^https:\/\/upload\.wikimedia\.org\/wikipedia\/(commons|en)\/([0-9a-f])\/([0-9a-f]{2})\/([^/]+)$/i,
    );
    if (m) {
      const [, project, a, ab, file] = m;
      return `https://upload.wikimedia.org/wikipedia/${project}/thumb/${a}/${ab}/${file}/250px-${file}`;
    }
  }
  return orig;
}

async function main() {
  const out = {};
  const missing = [];
  for (const slug of Object.keys(FILES).sort()) {
    const { file, wiki } = FILES[slug];
    process.stdout.write(`${slug} ... `);
    try {
      const url = await resolveThumb(file, wiki);
      if (url) {
        out[slug] = url;
        console.log(url.split('/').pop());
      } else {
        missing.push(slug);
        console.log('MISS');
      }
    } catch (e) {
      console.log('ERR', e.message);
      missing.push(slug);
      if (e.message === 'rate-limited') break;
    }
    await new Promise((r) => setTimeout(r, 1200));
  }

  const sorted = {};
  for (const k of Object.keys(out).sort()) sorted[k] = out[k];
  fs.writeFileSync(outPath, JSON.stringify(sorted, null, 2) + '\n');
  console.log('\nwritten', Object.keys(sorted).length);
  console.log('missing', missing.join(', ') || '(none)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
