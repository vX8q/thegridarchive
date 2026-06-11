import fs from "fs";
import path from "path";

const TRANSLITERATION = {
  // Nordic
  "\u00f8": "o", "\u00d8": "O",
  "\u00e6": "ae", "\u00c6": "AE",
  "\u00e5": "a", "\u00c5": "A",
  "\u00f0": "d", "\u00d0": "D",
  "\u00fe": "th", "\u00de": "TH",
  // Germanic
  "\u00df": "ss",
  "\u00fc": "u", "\u00dc": "U",
  "\u00f6": "o", "\u00d6": "O",
  "\u00e4": "a", "\u00c4": "A",
  // Polish
  "\u0142": "l", "\u0141": "L",
  "\u015b": "s", "\u015a": "S",
  "\u017a": "z", "\u0179": "Z",
  "\u017c": "z", "\u017b": "Z",
  "\u0105": "a", "\u0104": "A",
  "\u0119": "e", "\u0118": "E",
  "\u0107": "c", "\u0106": "C",
  "\u0144": "n", "\u0143": "N",
  // Romanian
  "\u0219": "s", "\u0218": "S",
  "\u021b": "t", "\u021a": "T",
  // Czech / Slovak
  "\u010d": "c", "\u010c": "C",
  "\u0161": "s", "\u0160": "S",
  "\u017e": "z", "\u017d": "Z",
  "\u0159": "r", "\u0158": "R",
  // Spanish / Portuguese
  "\u00f1": "n", "\u00d1": "N",
  "\u00e7": "c", "\u00c7": "C",
};

const FUSED_PARTICLES = [
  [/\bvanderlinde\b/gi, "van der linde"],
  [/\bvanderzande\b/gi, "van der zande"],
  [/\bvanderhelm\b/gi, "van der helm"],
  [/\bvandersteur\b/gi, "van der steur"],
  [/\bvander\b/gi, "van der"],
  [/\bvande\b/gi, "van de"],
  [/\bvanden\b/gi, "van den"],
  [/\bvandel\b/gi, "van del"],
];

const INITIALS_PAIRS = ["aj", "jj", "bj", "pj", "tj", "rj", "cj", "dj"];
const SLUG_ALIASES = {
  // Initial-based abbreviations that must map to canonical dotted-initial slugs.
  "bj-mcleod": "b-j-mcleod",
  "jj-yeley": "j-j-yeley",
  // Surnames with uppercase chunks that are part of the surname (not particles).
  "corey-la-joie": "corey-lajoie",
  "matt-di-benedetto": "matt-dibenedetto",
  "rinus-vee-kay": "rinus-veekay",
  "julian-da-costa-r": "julian-dacosta-r",
  // Fused middle particle from bad source formatting.
  "antonio-felixda-costa": "antonio-felix-da-costa",
};

const EMPTY_PROFILE = {
  full_name: "",
  birth_date: "",
  birth_place: "",
  citizenship: "",
  photo_url: "",
};

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : null;
  };
  return {
    dataDir: get("--data") ?? "./data",
    dryRun: args.includes("--dry-run"),
    validateOnly: args.includes("--validate-only"),
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function walkJsonFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkJsonFiles(full));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
      out.push(full);
    }
  }
  return out;
}

function fixMergedParticles(name) {
  let s = String(name).replace(/([a-z])([A-Z])/g, "$1 $2");
  s = s.replace(/\bMc ([A-Z])/g, "Mc$1");
  s = s.replace(/\bMac ([A-Z])/g, "Mac$1");
  s = s.replace(/([A-Za-z])vander/gi, "$1 vander");
  s = s.replace(/([A-Za-z])vande(n|l)?/gi, "$1 vande$2");
  for (const [pattern, replacement] of FUSED_PARTICLES) {
    s = s.replace(pattern, replacement);
  }
  return s;
}

function stripTrailingHash(name) {
  return String(name).replace(/\s*#\s*$/, "").trim();
}

function stripIneligibleSuffix(name) {
  return String(name).replace(/\s*\(i\)\s*$/i, "").trim();
}

function makeSlug(name) {
  let s = stripTrailingHash(name);
  s = stripIneligibleSuffix(s);
  s = fixMergedParticles(s);

  for (const [ch, repl] of Object.entries(TRANSLITERATION)) {
    s = s.replaceAll(ch, repl);
  }

  s = s.normalize("NFD").replace(/\p{Mn}/gu, "");
  s = s.replace(/[^\w\s-]/g, " ");
  s = s.toLowerCase().trim();
  s = s.replace(/[\s_]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  for (const pair of INITIALS_PAIRS) {
    const [a, b] = pair;
    s = s.replace(new RegExp(`(^|-)${pair}(-|$)`, "g"), `$1${a}-${b}$2`);
  }
  return SLUG_ALIASES[s] ?? s;
}

function profileScore(p) {
  return ["birth_date", "birth_place", "citizenship", "photo_url"].reduce(
    (n, k) => n + (String(p?.[k] ?? "").trim() ? 1 : 0),
    0,
  );
}

function mergeProfile(a, b) {
  const out = { ...EMPTY_PROFILE, ...a };
  const bObj = { ...EMPTY_PROFILE, ...b };
  for (const key of Object.keys(EMPTY_PROFILE)) {
    if (!String(out[key] ?? "").trim() && String(bObj[key] ?? "").trim()) {
      out[key] = bObj[key];
    }
  }
  if (!String(out.full_name ?? "").trim()) {
    out.full_name = String(bObj.full_name ?? "").trim();
  }
  return out;
}

function canonicalizeProfiles(profiles, dryRun) {
  const redirects = {};
  const next = {};
  let renameCount = 0;
  let mergeCount = 0;
  let dropISuffixCount = 0;

  const keys = Object.keys(profiles);
  for (const oldSlug of keys) {
    const profile = { ...EMPTY_PROFILE, ...(profiles[oldSlug] || {}) };
    const baseName = String(profile.full_name || "").trim();
    let canonical = makeSlug(baseName);
    if (!canonical) canonical = String(oldSlug).replace(/-i$/i, "");
    if (String(oldSlug).endsWith("-i")) {
      dropISuffixCount++;
    }
    if (oldSlug !== canonical) {
      redirects[oldSlug] = canonical;
      renameCount++;
    }

    if (!next[canonical]) {
      next[canonical] = profile;
      continue;
    }

    const existing = next[canonical];
    const winner =
      profileScore(profile) > profileScore(existing) ? profile : existing;
    const loser = winner === profile ? existing : profile;
    next[canonical] = mergeProfile(winner, loser);
    mergeCount++;
  }

  const ordered = {};
  for (const key of Object.keys(next).sort()) {
    ordered[key] = next[key];
  }

  if (!dryRun) {
    return {
      profiles: ordered,
      redirects,
      stats: { renameCount, mergeCount, dropISuffixCount },
    };
  }
  return {
    profiles: profiles,
    redirects,
    stats: { renameCount, mergeCount, dropISuffixCount },
  };
}

function patchEntryListRecord(row, redirects) {
  if (!row || typeof row !== "object") return false;
  let changed = false;

  if (typeof row.driver_slug === "string" && row.driver_slug.trim()) {
    const old = row.driver_slug.trim();
    const mapped = redirects[old] || old;
    if (mapped !== old) {
      row.driver_slug = mapped;
      changed = true;
    }
    if (old.endsWith("-i")) {
      if (row.points_eligible !== false) {
        row.points_eligible = false;
        changed = true;
      }
    }
  }

  if (typeof row.driver === "string") {
    const raw = row.driver.trim();
    const isIneligible = /\(i\)\s*$/i.test(raw);
    if (isIneligible) {
      const stripped = stripIneligibleSuffix(raw);
      if (stripped !== raw) {
        row.driver = stripped;
        changed = true;
      }
      if (row.points_eligible !== false) {
        row.points_eligible = false;
        changed = true;
      }
    }
  }

  return changed;
}

function patchEvents(eventsDir, redirects, dryRun) {
  const files = walkJsonFiles(eventsDir);
  let touchedFiles = 0;
  let touchedRows = 0;
  for (const filePath of files) {
    let data;
    try {
      data = readJson(filePath);
    } catch {
      continue;
    }
    if (!Array.isArray(data?.entry_list)) continue;

    let changed = false;
    for (const row of data.entry_list) {
      if (patchEntryListRecord(row, redirects)) {
        changed = true;
        touchedRows++;
      }
    }
    if (changed) {
      touchedFiles++;
      if (!dryRun) writeJson(filePath, data);
    }
  }
  return { touchedFiles, touchedRows };
}

function validate(dataDir) {
  const profilesPath = path.join(dataDir, "driver_profiles.json");
  const eventsDir = path.join(dataDir, "events");
  const profiles = readJson(profilesPath);
  let ok = true;

  const badISuffix = Object.keys(profiles).filter((k) => k.endsWith("-i"));
  if (badISuffix.length) {
    ok = false;
    console.log(`[FAIL] profiles with -i suffix: ${badISuffix.length}`);
    badISuffix.slice(0, 50).forEach((k) => console.log(`  - ${k}`));
  }

  const seenCanon = new Map();
  const dupCanon = [];
  for (const [slug, profile] of Object.entries(profiles)) {
    const canon = makeSlug(profile?.full_name || "");
    if (!canon) continue;
    if (seenCanon.has(canon) && seenCanon.get(canon) !== slug) {
      dupCanon.push(`${canon}: ${seenCanon.get(canon)} vs ${slug}`);
    } else {
      seenCanon.set(canon, slug);
    }
  }
  if (dupCanon.length) {
    ok = false;
    console.log(`[FAIL] duplicate canonical slugs: ${dupCanon.length}`);
    dupCanon.slice(0, 50).forEach((x) => console.log(`  - ${x}`));
  }

  const known = new Set(Object.keys(profiles));
  const orphanRefs = [];
  for (const filePath of walkJsonFiles(eventsDir)) {
    let data;
    try {
      data = readJson(filePath);
    } catch {
      continue;
    }
    if (!Array.isArray(data?.entry_list)) continue;
    for (const row of data.entry_list) {
      const s = typeof row?.driver_slug === "string" ? row.driver_slug.trim() : "";
      if (s && !known.has(s)) {
        orphanRefs.push(`${path.relative(dataDir, filePath)} -> ${s}`);
      }
    }
  }
  if (orphanRefs.length) {
    ok = false;
    console.log(`[FAIL] orphan driver_slug references: ${orphanRefs.length}`);
    orphanRefs.slice(0, 50).forEach((x) => console.log(`  - ${x}`));
  }

  if (ok) {
    console.log(`[OK] validation passed (${Object.keys(profiles).length} profiles)`);
  }
  return ok;
}

function main() {
  const { dataDir, dryRun, validateOnly } = parseArgs();
  const profilesPath = path.join(dataDir, "driver_profiles.json");
  const eventsDir = path.join(dataDir, "events");

  if (!fs.existsSync(profilesPath)) {
    console.error(`Missing file: ${profilesPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(eventsDir)) {
    console.error(`Missing directory: ${eventsDir}`);
    process.exit(1);
  }

  if (validateOnly) {
    process.exit(validate(dataDir) ? 0 : 1);
  }

  const profiles = readJson(profilesPath);
  const { profiles: nextProfiles, redirects, stats } = canonicalizeProfiles(
    profiles,
    dryRun,
  );
  const eventStats = patchEvents(eventsDir, redirects, dryRun);

  console.log(`Phase 1 rename candidates: ${stats.renameCount}`);
  console.log(`Phase 1 merges: ${stats.mergeCount}`);
  console.log(`Phase 2 '-i' remaps: ${stats.dropISuffixCount}`);
  console.log(`Event files touched: ${eventStats.touchedFiles}`);
  console.log(`Entry rows touched: ${eventStats.touchedRows}`);

  if (!dryRun) {
    writeJson(profilesPath, nextProfiles);
    console.log("Wrote updated driver_profiles.json");
    if (!validate(dataDir)) process.exit(1);
  } else {
    console.log("Dry-run mode: no files were modified");
  }
}

main();
