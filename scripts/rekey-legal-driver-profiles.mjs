/**
 * Re-key driver_profiles.json entries stored under legal full-name slugs
 * to the slug used in event data (race results, entry lists).
 *
 * full_name stays as the legal name (shown on driver page, searchable).
 * Profile key becomes the event display-name slug (e.g. charles-leclerc).
 */
import fs from "fs";
import path from "path";

const DATA_DIR = process.argv.includes("--data")
  ? process.argv[process.argv.indexOf("--data") + 1]
  : "./data";
const DRY_RUN = process.argv.includes("--dry-run");

const TRANSLITERATION = {
  "\u00f8": "o", "\u00d8": "O", "\u00e6": "ae", "\u00c6": "AE",
  "\u00e5": "a", "\u00c5": "A", "\u00df": "ss", "\u00fc": "u", "\u00dc": "U",
  "\u00f6": "o", "\u00d6": "O", "\u00e4": "a", "\u00c4": "A", "\u0142": "l",
  "\u00f1": "n", "\u00d1": "N", "\u00e7": "c", "\u00c7": "C",
};

function stripIneligible(name) {
  return String(name || "").trim().replace(/\s*\(i\)\s*$/i, "").trim();
}

function makeSlug(name) {
  let s = stripIneligible(name);
  for (const [ch, repl] of Object.entries(TRANSLITERATION)) {
    s = s.replaceAll(ch, repl);
  }
  s = s.normalize("NFD").replace(/\p{Mn}/gu, "");
  s = s.toLowerCase().trim();
  s = s.replace(/[^\w\s-]/g, " ");
  s = s.replace(/[\s_]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  return s;
}

function walkJsonFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkJsonFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".json")) out.push(full);
  }
  return out;
}

function profileScore(p) {
  return ["birth_date", "birth_place", "citizenship", "photo_url"].reduce(
    (n, k) => n + (String(p?.[k] ?? "").trim() ? 1 : 0),
    0,
  );
}

function mergeProfile(a, b) {
  const keys = ["full_name", "birth_date", "birth_place", "citizenship", "photo_url"];
  const out = { ...a };
  for (const k of keys) {
    if (!String(out[k] ?? "").trim() && String(b[k] ?? "").trim()) out[k] = b[k];
  }
  return out;
}

/** Collect event driver names keyed by slug. */
function buildEventDriverIndex(eventsDir) {
  /** @type {Map<string, Map<string, number>>} */
  const bySlug = new Map();
  const add = (raw) => {
    const name = stripIneligible(raw);
    if (!name || name.includes("/") || name.includes(";")) return;
    const slug = makeSlug(name);
    if (!slug) return;
    if (!bySlug.has(slug)) bySlug.set(slug, new Map());
    const names = bySlug.get(slug);
    names.set(name, (names.get(name) || 0) + 1);
  };

  for (const filePath of walkJsonFiles(eventsDir)) {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
      continue;
    }
    for (const row of data.entry_list || []) {
      if (row?.driver) add(row.driver);
    }
    const tables = data.tables || {};
    for (const tbl of Object.values(tables)) {
      if (!tbl?.headers || !tbl?.rows) continue;
      const hi = tbl.headers.findIndex((h) => /^driver$/i.test(String(h)));
      if (hi < 0) continue;
      for (const row of tbl.rows) {
        if (Array.isArray(row)) add(row[hi]);
      }
    }
  }
  return bySlug;
}

function topEventName(bySlug, slug) {
  const names = bySlug.get(slug);
  if (!names) return "";
  return [...names.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

function firstLastSlug(fullName) {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return "";
  return makeSlug(`${parts[0]} ${parts[parts.length - 1]}`);
}

function resolveEventSlug(oldSlug, profile, bySlug) {
  const legal = String(profile.full_name || "").trim();
  const legalSlug = makeSlug(legal);

  // Already an event slug with data.
  if (bySlug.has(oldSlug)) return oldSlug;

  // Legal-name key: try first+last slug if it exists in events.
  const fl = firstLastSlug(legal);
  if (fl && bySlug.has(fl)) return fl;

  // Old slug equals legal slug — try first+last.
  if (oldSlug === legalSlug && fl && fl !== oldSlug && bySlug.has(fl)) return fl;

  // Scan event slugs sharing last name token.
  const parts = legal.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const lastTok = makeSlug(parts[parts.length - 1]);
    const firstTok = makeSlug(parts[0]);
    let best = "";
    let bestCount = 0;
    for (const [slug, names] of bySlug.entries()) {
      if (!slug.endsWith(`-${lastTok}`) && slug !== lastTok) continue;
      if (!slug.startsWith(`${firstTok}-`) && slug !== `${firstTok}-${lastTok}`) continue;
      const count = [...names.values()].reduce((a, b) => a + b, 0);
      if (count > bestCount) {
        best = slug;
        bestCount = count;
      }
    }
    if (best) return best;
  }

  return oldSlug;
}

function main() {
  const profilesPath = path.join(DATA_DIR, "driver_profiles.json");
  const eventsDir = path.join(DATA_DIR, "events");
  const profiles = JSON.parse(fs.readFileSync(profilesPath, "utf8"));
  const bySlug = buildEventDriverIndex(eventsDir);

  const next = {};
  const redirects = {};
  let moved = 0;
  let merged = 0;

  for (const [oldSlug, rawProfile] of Object.entries(profiles)) {
    const profile = { ...rawProfile };
    const legal = String(profile.full_name || "").trim();
    const legalParts = legal.split(/\s+/).filter(Boolean);

    let newSlug = resolveEventSlug(oldSlug, profile, bySlug);

    // Keep legal name in full_name when profile was keyed by legal slug.
    if (legalParts.length > 2 && makeSlug(legal) === oldSlug && legal) {
      // full_name already legal — keep as-is
    } else if (legalParts.length <= 2 && topEventName(bySlug, newSlug)) {
      // short profile name matches event; nothing to change
    }

    if (oldSlug !== newSlug) {
      redirects[oldSlug] = newSlug;
      moved++;
    }

    if (next[newSlug]) {
      next[newSlug] = mergeProfile(
        profileScore(profile) >= profileScore(next[newSlug]) ? profile : next[newSlug],
        profileScore(profile) >= profileScore(next[newSlug]) ? next[newSlug] : profile,
      );
      merged++;
    } else {
      next[newSlug] = profile;
    }
  }

  const ordered = {};
  for (const key of Object.keys(next).sort()) ordered[key] = next[key];

  console.log(`Re-keyed ${moved} profile(s), merged ${merged}, redirects: ${Object.keys(redirects).length}`);
  for (const [from, to] of Object.entries(redirects).sort()) {
    if (from.includes("leclerc") || from.includes("sainz") || from.includes("albon") || from.includes("hamilton")) {
      console.log(`  ${from} -> ${to}`);
    }
  }

  if (!DRY_RUN) {
    fs.writeFileSync(profilesPath, `${JSON.stringify(ordered, null, 2)}\n`, "utf8");
    const redirectPath = path.join(DATA_DIR, "driver_profile_redirects.json");
    fs.writeFileSync(redirectPath, `${JSON.stringify(redirects, null, 2)}\n`, "utf8");
    console.log(`Wrote ${profilesPath} and ${redirectPath}`);
  } else {
    console.log("(dry run — no files written)");
  }
}

main();
