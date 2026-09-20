/**
 * Stage 2: city-level HQ (+ light corrections) for IMSA GTP/LMP2 and GTWCE factory teams.
 * Merges into data/team_org_metadata.json then apply-team-org-metadata.mjs.
 *
 * Usage: node scripts/fill-stage2-city-hq.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const metaPath = path.join(root, 'data', 'team_org_metadata.json');

/** Curated city HQ only — ASCII, no invented founders for Modified/ARCA. */
const PATCH = {
  // IMSA GTP
  'bmw-m-team-wrt': {
    headquarters: 'Bierset, Belgium / Kannapolis, North Carolina, U.S.',
  },
  'team-wrt': {
    headquarters: 'Bierset, Belgium',
  },
  'cadillac-whelen': {
    headquarters: 'Denver, North Carolina, U.S.',
  },
  'aston-martin-thor-team': {
    headquarters: 'Seattle, Washington, U.S.',
    founded: '2020',
  },
  'thor-team': {
    headquarters: 'Seattle, Washington, U.S.',
    founded: '2020',
  },
  'heart-of-racing-team': {
    headquarters: 'Seattle, Washington, U.S.',
  },
  'jdc-miller-motorsports': {
    headquarters: 'Midland, Michigan, U.S.',
  },

  // IMSA LMP2
  'ao-racing': {
    headquarters: 'St. Charles, Illinois, U.S.',
    founded: '2022',
    owner: 'P. J. Hyett / Gunnar Jeannette',
  },
  'era-motorsport': {
    headquarters: 'Indianapolis, Indiana, U.S.',
  },
  'tower-motorsports': {
    headquarters: 'Riviera Beach, Florida, U.S.',
    founded: '2019',
    owner: 'Ricky Capone',
  },
  'united-autosports-usa': {
    headquarters: 'Wakefield, England',
  },
  'inter-europol-competition': {
    headquarters: 'Malopole, Poland',
  },
  'tds-racing': {
    headquarters: 'Magny-Cours, France',
  },
  'crowdstrike-racing-by-apr': {
    headquarters: 'Auburn Hills, Michigan, U.S.',
    founded: '2023',
  },
  dragonspeed: {
    headquarters: 'Indianapolis, Indiana, U.S.',
  },

  // GTWCE factory / works-backed
  'mercedes-amg-team-mann-filter': {
    headquarters: 'Affalterbach, Germany',
  },
  'mercedes-amg-team-verstappen-racing': {
    headquarters: 'Emmen, Netherlands',
  },
  'hrt-ford-racing': {
    headquarters: 'Langenhagen, Germany',
  },
  'rowe-racing': {
    headquarters: 'St. Ingbert, Germany',
  },

  'herberth-motorsport': {
    headquarters: 'Mutterstadt, Germany',
  },
  'walkenhorst-motorsport': {
    headquarters: 'Melle, Germany',
  },
  'rutronik-racing': {
    headquarters: 'Winnenden, Germany',
  },
  'garage-59': {
    headquarters: 'Silverstone, England',
  },
  'kessel-racing': {
    headquarters: 'Lugano, Switzerland',
  },
  'comtoyou-racing': {
    headquarters: 'Ath, Belgium',
  },
  'sainteloc-racing': {
    headquarters: 'Saint-Jean-de-Soudain, France',
  },
  'schumacher-clrt': {
    headquarters: 'Signes, France',
  },
  'winward-racing': {
    headquarters: 'Indianapolis, Indiana, U.S. / Germany',
  },
};

function main() {
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  let touched = 0;
  for (const [slug, fields] of Object.entries(PATCH)) {
    if (!meta[slug]) meta[slug] = {};
    let changed = false;
    for (const [k, v] of Object.entries(fields)) {
      if (meta[slug][k] !== v) {
        meta[slug][k] = v;
        changed = true;
      }
    }
    if (changed) touched++;
  }
  const sorted = {};
  for (const k of Object.keys(meta).sort()) sorted[k] = meta[k];
  fs.writeFileSync(metaPath, JSON.stringify(sorted, null, 2) + '\n');
  console.log('patched', touched, 'orgs');
}

main();
