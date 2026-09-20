/**
 * Normalize team_logos.json:
 * - strip UTM
 * - convert SVG/WebP to Commons PNG thumbs (Go image.Decode can't read SVG/WebP)
 * - add a few known Wikipedia/Commons raster logos
 *
 * Usage: node scripts/normalize-team-logos.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outPath = path.join(root, 'data', 'team_logos.json');
const UA = 'TGA/1.0 (https://github.com/vX8q/tga; normalize team logos)';

/** Extra raster logos (PNG/JPG) known to exist */
const EXTRA = {
  'art-grand-prix':
    'https://upload.wikimedia.org/wikipedia/en/5/54/ART_Grand_Prix.png',
  'dams-lucas-oil':
    'https://upload.wikimedia.org/wikipedia/commons/a/ae/Team-Logo_DAMS023.webp',
};

function cleanUrl(url) {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('wikimedia.org') && u.hostname !== 'a.espncdn.com') {
      return null;
    }
    return u.origin + u.pathname;
  } catch {
    return null;
  }
}

/** Commons/enwiki upload URL → 200px PNG thumb when source is svg/webp */
function toDecodableThumb(url) {
  const clean = cleanUrl(url);
  if (!clean) return null;
  if (clean.includes('a.espncdn.com')) return clean;
  if (/\.(png|jpe?g|gif)$/i.test(clean) && !/\.svg\.png$/i.test(clean)) {
    return clean;
  }
  // Already a thumb PNG
  if (/\/thumb\/.+\.png$/i.test(clean)) return clean;

  // https://upload.wikimedia.org/wikipedia/commons/f/fc/File.svg
  // → https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/File.svg/200px-File.svg.png
  const m = clean.match(
    /^https:\/\/upload\.wikimedia\.org\/wikipedia\/(commons|en)\/([0-9a-f])\/([0-9a-f]{2})\/([^/]+)$/i,
  );
  if (!m) return clean;
  const [, project, a, ab, file] = m;
  if (!/\.(svg|webp)$/i.test(file)) return clean;
  return `https://upload.wikimedia.org/wikipedia/${project}/thumb/${a}/${ab}/${file}/200px-${file}.png`;
}

async function urlOk(url) {
  try {
    const r = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': UA, Range: 'bytes=0-32' },
    });
    const ct = r.headers.get('content-type') || '';
    return (r.ok || r.status === 206) && /image/i.test(ct);
  } catch {
    return false;
  }
}

async function main() {
  let raw = fs.readFileSync(outPath, 'utf8').replace(/\\n\s*$/, '').trim();
  const end = raw.lastIndexOf('}');
  if (end >= 0) raw = raw.slice(0, end + 1);
  const logos = { ...JSON.parse(raw), ...EXTRA };
  delete logos['chip-ganassi-racing']; // junk CHANCLETA

  const out = {};
  for (const slug of Object.keys(logos).sort()) {
    let url = toDecodableThumb(logos[slug]);
    if (!url) continue;
    // webp EXTRA also needs thumb conversion
    url = toDecodableThumb(url) || url;
    process.stdout.write(`${slug} ... `);
    const ok = await urlOk(url);
    if (ok) {
      out[slug] = url;
      console.log('OK');
    } else {
      // try original if thumb failed
      const orig = cleanUrl(logos[slug]);
      if (orig && orig !== url && (await urlOk(orig))) {
        out[slug] = orig;
        console.log('OK-orig');
      } else {
        console.log('FAIL', url);
      }
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
  console.log('\nwritten', Object.keys(out).length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
