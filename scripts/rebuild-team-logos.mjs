/**
 * Rebuild curated team_logos.json with raster-friendly URLs.
 * SVG/WebP → Commons 200px PNG thumb. No live probe (rate limits).
 *
 * Usage: node scripts/rebuild-team-logos.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outPath = path.join(root, 'data', 'team_logos.json');

/** slug → original upload.wikimedia.org URL (commons or en) */
const RAW = {
  '23xi-racing':
    'https://upload.wikimedia.org/wikipedia/commons/2/21/23XI_Racing_logo.png',
  'aix-racing': 'https://upload.wikimedia.org/wikipedia/commons/3/36/PHMAixLogo.png',
  alpine: 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Alpine_F1_Team_Logo.svg',
  'andretti-global':
    'https://upload.wikimedia.org/wikipedia/commons/c/c2/Andretti-global-logo-1.webp',
  'arrow-mclaren':
    'https://upload.wikimedia.org/wikipedia/commons/2/26/Arrow_McLaren_logo_%282023%29.png',
  'art-grand-prix': 'https://upload.wikimedia.org/wikipedia/en/5/54/ART_Grand_Prix.png',
  'aston-martin':
    'https://upload.wikimedia.org/wikipedia/commons/0/03/Aston_Martin_F1_Team_logo_2024.jpg',
  audi: 'https://upload.wikimedia.org/wikipedia/commons/b/bc/Audi_Sport_logo.svg',
  cadillac: 'https://upload.wikimedia.org/wikipedia/commons/1/16/Cadillac_emblem.jpg',
  'campos-racing':
    'https://upload.wikimedia.org/wikipedia/commons/b/be/Logo_Campos_Racing_2021.jpg',
  'dale-coyne-racing':
    'https://upload.wikimedia.org/wikipedia/commons/9/97/Dale_Coyne_Racing_with_Vasser_Sullivan_Logo.png',
  'dams-lucas-oil':
    'https://upload.wikimedia.org/wikipedia/commons/a/ae/Team-Logo_DAMS023.webp',
  'ed-carpenter-racing':
    'https://upload.wikimedia.org/wikipedia/commons/e/e3/Ecr_2025_logo.png',
  ferrari: 'https://upload.wikimedia.org/wikipedia/commons/9/9b/Ferrari_wordmark.svg',
  haas: 'https://upload.wikimedia.org/wikipedia/commons/1/18/TGR_Haas_F1_Team_Logo_%282026%29.svg',
  'haas-factory-team':
    'https://upload.wikimedia.org/wikipedia/commons/0/08/Haas_F1_Team_logo_2019.svg',
  'hendrick-motorsports':
    'https://upload.wikimedia.org/wikipedia/commons/2/2d/Hendrick_Motorsports_logo.png',
  hitech:
    'https://upload.wikimedia.org/wikipedia/commons/e/e7/Hitech_Grand_Prix_logo_%282025%29.svg',
  'invicta-racing':
    'https://upload.wikimedia.org/wikipedia/commons/8/89/Virtuosi_Racing_logo.png',
  'joe-gibbs-racing':
    'https://upload.wikimedia.org/wikipedia/commons/8/89/Joe_Gibbs_Racing_logo.png',
  'juncos-hollinger-racing':
    'https://upload.wikimedia.org/wikipedia/commons/1/13/Juncos_Hollinger_Racing_logo.webp',
  'kick-sauber':
    'https://upload.wikimedia.org/wikipedia/commons/e/e4/Logo_of_Stake_F1_Team_Kick_Sauber.png',
  'legacy-motor-club':
    'https://upload.wikimedia.org/wikipedia/commons/a/a2/Legacy_Motor_Club_logo.png',
  mclaren: 'https://upload.wikimedia.org/wikipedia/commons/2/20/McLaren_Racing_logo.png',
  mercedes:
    'https://upload.wikimedia.org/wikipedia/commons/f/fc/Mercedes-AMG_Petronas_F1_Team_logo_%282026%29.svg',
  'meyer-shank-racing-with-curb-agajanian':
    'https://upload.wikimedia.org/wikipedia/commons/7/71/Meyer_Shank_Racing_logo.png',
  'mp-motorsport':
    'https://upload.wikimedia.org/wikipedia/commons/7/7b/MP_Motorsport_logo.svg',
  'red-bull-racing':
    'https://upload.wikimedia.org/wikipedia/commons/9/9f/Red_Bull_Racing_-_2005_Logo.png',
  'rfk-racing': 'https://upload.wikimedia.org/wikipedia/commons/b/b4/RFK_logo.png',
  'richard-childress-racing':
    'https://upload.wikimedia.org/wikipedia/commons/0/02/Richard_Childress_Racing.png',
  'rodin-motorsport':
    'https://upload.wikimedia.org/wikipedia/commons/e/e3/Rodin_Motorsport_logo.svg',
  'spire-motorsports':
    'https://upload.wikimedia.org/wikipedia/commons/6/62/Spire_Motorsports_yellow_logo.png',
  'team-penske': 'https://upload.wikimedia.org/wikipedia/commons/2/20/Team_Penske_logo.svg',
  trident: 'https://upload.wikimedia.org/wikipedia/commons/d/d6/Logo_Trident_2024-2025.png',
  'van-amersfoort-racing':
    'https://upload.wikimedia.org/wikipedia/commons/3/3c/VAR_logo.png',
  williams:
    'https://upload.wikimedia.org/wikipedia/commons/8/8d/Williams_Racing_Logo_2024.webp',
  'wood-brothers-racing':
    'https://upload.wikimedia.org/wikipedia/commons/e/e0/Wood_Brothers_Racing.png',
};

/** Convert SVG/WebP upload URLs to 200px PNG thumbs for Go image.Decode */
function toDecodable(url) {
  const u = url.split('?')[0];
  if (/\.(png|jpe?g|gif)$/i.test(u) && !/\.svg\.png$/i.test(u) && !/\.webp\.png$/i.test(u)) {
    return u;
  }
  const m = u.match(
    /^https:\/\/upload\.wikimedia\.org\/wikipedia\/(commons|en)\/([0-9a-f])\/([0-9a-f]{2})\/([^/]+)$/i,
  );
  if (!m) return u;
  const [, project, a, ab, file] = m;
  if (!/\.(svg|webp)$/i.test(file)) return u;
  return `https://upload.wikimedia.org/wikipedia/${project}/thumb/${a}/${ab}/${file}/200px-${file}.png`;
}

const out = {};
for (const k of Object.keys(RAW).sort()) {
  out[k] = toDecodable(RAW[k]);
}

fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log('wrote', Object.keys(out).length, 'logos');
const nonRaster = Object.entries(out).filter(([, v]) => /\.(svg|webp)$/i.test(v));
if (nonRaster.length) {
  console.log('WARNING still non-raster:', nonRaster.map(([k]) => k).join(', '));
}
