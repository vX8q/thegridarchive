/**
 * Fills data/standings/imsa.json per-class "quals" from event tables.qualifying
 * (CLASS POS column) and verifies "races" CLASS POS vs tables.race where present.
 *
 * Run: node scripts/sync-imsa-standings-quals.mjs [--check]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ST_PATH = path.join(ROOT, 'data', 'standings', 'imsa.json');

const ROUNDS = [
  { key: 'DAY24', eventFile: path.join(ROOT, 'data', 'events', 'IMSA', '2026', 'imsa_2026_1.json') },
  { key: 'SEB12', eventFile: path.join(ROOT, 'data', 'events', 'IMSA', '2026', 'imsa_2026_2.json') },
  { key: 'LB', eventFile: path.join(ROOT, 'data', 'events', 'IMSA', '2026', 'imsa_2026_3.json') },
  { key: 'MON', eventFile: path.join(ROOT, 'data', 'events', 'IMSA', '2026', 'imsa_2026_4.json') },
];

/** Optional event car numbers that differ from standings "car" on that round. */
const CAR_CANDIDATES = {
  DAY24: {
    GTP: { 5: ['5', '85'], 85: ['85', '5'] },
  },
};

function normCarToken(s) {
  return String(s == null ? '' : s).trim();
}

function ix(h, name) {
  const i = h.indexOf(name);
  return i < 0 ? -1 : i;
}

/** Try [standingsCar, ...aliases]. */
function candidatesForRound(cls, roundKey, standingsCar) {
  const sc = normCarToken(standingsCar);
  const set = new Map();
  const add = (x) => {
    const t = normCarToken(x);
    if (t) set.set(t, true);
  };
  add(sc);
  const rd = CAR_CANDIDATES[roundKey];
  if (rd && rd[cls] && rd[cls][sc]) {
    for (const c of rd[cls][sc]) add(c);
    for (const c of rd[cls][Number(sc)] || []) add(c); // numeric key if JSON used number
  }
  return Object.keys(Object.fromEntries(set));
}

function matchesCarField(val, candidates) {
  const v = normCarToken(val);
  if (!v) return false;
  return candidates.some(function (c) {
    if (c === v) return true;
    if (/^\d+$/.test(c) && /^\d+$/.test(v) && parseInt(c, 10) === parseInt(v, 10)) return true;
    return false;
  });
}

function extractFromQual(headers, rows, cls, standingsCar, roundKey) {
  const icar = ix(headers, 'CAR NO');
  const icls = ix(headers, 'CLASS');
  const icp = ix(headers, 'CLASS POS');
  if (icar < 0 || icp < 0) return null;
  const cand = candidatesForRound(cls, roundKey, standingsCar);
  let row = null;
  if (icls >= 0) {
    row = rows.find(function (r) {
      return normCarToken(r[icls]) === cls && matchesCarField(r[icar], cand);
    });
    // Daytona (and similar): some GTD Pro cars are tagged "GTD" in the JSON.
    if (!row && (cls === 'GTD Pro' || cls === 'GTD')) {
      const alt = cls === 'GTD Pro' ? 'GTD' : 'GTD Pro';
      row = rows.find(function (r) {
        return normCarToken(r[icls]) === alt && matchesCarField(r[icar], cand);
      });
    }
  } else {
    row = rows.find(function (r) {
      return matchesCarField(r[icar], cand);
    });
  }
  if (!row) return null;
  const q = normCarToken(row[icp]);
  return q === '' ? null : q;
}

function extractFromRace(headers, rows, cls, standingsCar, roundKey) {
  const icar = ix(headers, 'CAR NO');
  const icls = ix(headers, 'CLASS');
  const icp = ix(headers, 'CLASS POS');
  const istat = ix(headers, 'STATUS');
  if (icar < 0 || icls < 0 || icp < 0) return null;
  const cand = candidatesForRound(cls, roundKey, standingsCar);
  let row = rows.find(function (r) {
    return normCarToken(r[icls]) === cls && matchesCarField(r[icar], cand);
  });
  if (
    !row &&
    (cls === 'GTD Pro' || cls === 'GTD')
  ) {
    const alt = cls === 'GTD Pro' ? 'GTD' : 'GTD Pro';
    row = rows.find(function (r) {
      return normCarToken(r[icls]) === alt && matchesCarField(r[icar], cand);
    });
  }
  if (!row) return null;
  const st = istat >= 0 ? normCarToken(row[istat]).toUpperCase() : '';
  if (st.includes('DNS') || st.includes('WD') || st.includes('OUT')) {
    return 'DNS';
  }
  const rp = normCarToken(row[icp]);
  return rp === '' ? null : rp;
}

function loadEventTable(file, key) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const t = j.tables && j.tables[key];
  if (!t || !Array.isArray(t.headers) || !Array.isArray(t.rows)) return null;
  return t;
}

async function main() {
  const checkOnly = process.argv.includes('--check');
  const st = JSON.parse(fs.readFileSync(ST_PATH, 'utf8'));
  const raceOrder = st.race_order || [];
  const roundByKey = {};
  for (const r of ROUNDS) roundByKey[r.key] = r;

  const cache = {};
  for (const rk of raceOrder) {
    const def = roundByKey[rk];
    if (!def) continue;
    cache[rk] = {
      qual: loadEventTable(def.eventFile, 'qualifying'),
      race: loadEventTable(def.eventFile, 'race'),
    };
  }

  const mismatches = [];
  const missingQual = [];

  for (const cls of st.classes || []) {
    const id = cls.id;
    for (const row of cls.rows || []) {
      const car = row.car;
      const quals = { ...(row.quals || {}) };
      for (const rk of raceOrder) {
        const pack = cache[rk];
        if (!pack) continue;
        const wantRace = row.races && row.races[rk];
        const raceStr =
          wantRace === null || wantRace === undefined ? '' : String(wantRace).trim();
        const isNonRaceCode =
          raceStr !== '' && !/^\d+$/.test(raceStr);
        /** Did not compete at this sprint / no starter row → do not insist on qualifying. */
        const skipRoundDetail = /^(DNS|DNF|NC|NR|WD|NO\s*TIME|OTL|DSQ)$/i.test(raceStr);

        if (pack.qual) {
          const eq = extractFromQual(pack.qual.headers, pack.qual.rows, id, car, rk);
          if (eq != null) quals[rk] = eq;
          else if (
            raceStr !== '' &&
            !isNonRaceCode &&
            !skipRoundDetail
          ) {
            missingQual.push({ class: id, car, round: rk, note: 'had race result, no qual row in event JSON' });
          }
        }

        if (
          pack.race &&
          raceStr !== '' &&
          !isNonRaceCode &&
          !skipRoundDetail
        ) {
          const er = extractFromRace(pack.race.headers, pack.race.rows, id, car, rk);
          if (er != null && raceStr !== er) {
            mismatches.push({
              class: id,
              car,
              round: rk,
              standings: String(wantRace).trim(),
              eventRaceClassPosOrDNS: er,
            });
          }
        }
      }
      if (!checkOnly) {
        row.quals = quals;
      }
    }
  }

  console.log(checkOnly ? 'check mode (no write)' : 'writing', ST_PATH);
  if (mismatches.length) {
    console.log('\nrace mismatches (standings vs event CLASS POS):');
    for (const m of mismatches) console.log(JSON.stringify(m));
    process.exitCode = 1;
  } else {
    console.log('\nraces: CLASS POS matches standings (within extracted rows)');
  }

  if (missingQual.length) {
    console.log('\nmissing qualifying row (informative):');
    for (const m of missingQual) console.log(JSON.stringify(m));
  }

  if (!checkOnly && !mismatches.length) {
    fs.writeFileSync(ST_PATH, JSON.stringify(st, null, 2) + '\n');
  }
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});
