/**
 * Unify driver display names and driver_slug in event JSON:
 * - "(i)" spacing: "Name(i)" -> "Name (i)"
 * - Accented canonical forms from entry_list (Pérez, Hülkenberg, …)
 * - Jr. trailing period consistency
 * - Trailing "#" on driver names
 */
import fs from "fs";
import path from "path";

const DATA_DIR = process.argv.includes("--data")
  ? process.argv[process.argv.indexOf("--data") + 1]
  : "./data";
const DRY_RUN = process.argv.includes("--dry-run");
const ONLY = process.argv.includes("--only")
  ? process.argv[process.argv.indexOf("--only") + 1].split(",").map((s) => s.trim()).filter(Boolean)
  : null;

const TRANSLITERATION = {
  "\u00f8": "o", "\u00d8": "O", "\u00e6": "ae", "\u00c6": "AE",
  "\u00e5": "a", "\u00c5": "A", "\u00df": "ss", "\u00fc": "u", "\u00dc": "U",
  "\u00f6": "o", "\u00d6": "O", "\u00e4": "a", "\u00c4": "A", "\u0142": "l",
  "\u00f1": "n", "\u00d1": "N", "\u00e7": "c", "\u00c7": "C",
};

const SLUG_ALIASES = {
  "nico-hulkenberg": "nico-h-lkenberg",
  "sergio-perez": "sergio-p-rez",
  "carlos-sainz-jr": "carlos-sainz-jr",
  "aj-allmendinger": "a-j-allmendinger",
};

/** Display names when entry_list and tables disagree on accents / Jr. */
const CANONICAL_OVERRIDES = {
  "nico-h-lkenberg": "Nico Hülkenberg",
  "sergio-p-rez": "Sergio Pérez",
  "carlos-sainz-jr": "Carlos Sainz Jr.",
  "a-j-allmendinger": "A. J. Allmendinger",
};

const DRIVER_HEADERS = new Set([
  "driver", "drivers", "driver 1", "driver 2", "driver 3",
]);

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, data) {
  fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`, "utf8");
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

function stripTrailingHash(name) {
  return String(name).replace(/\s*#\s*$/, "").trim();
}

function stripIneligibleSuffix(name) {
  return String(name).replace(/\s*\(i\)\s*$/i, "").trim();
}

function hasIneligibleSuffix(name) {
  return /\(i\)\s*$/i.test(String(name).trim());
}

function fixIneligibleSpacing(name) {
  const raw = String(name).trim();
  const m = raw.match(/^(.+?)\s*\(i\)\s*$/i);
  if (!m) return raw;
  return `${m[1].trim()} (i)`;
}

function makeSlug(name) {
  let s = stripTrailingHash(name);
  s = stripIneligibleSuffix(s);
  for (const [ch, repl] of Object.entries(TRANSLITERATION)) {
    s = s.replaceAll(ch, repl);
  }
  s = s.normalize("NFD").replace(/\p{Mn}/gu, "");
  s = s.toLowerCase().trim();
  s = s.replace(/[^\w\s-]/g, " ");
  s = s.replace(/[\s_]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  return SLUG_ALIASES[s] ?? s;
}

function nameScore(name) {
  const s = String(name);
  let score = s.length;
  if (/[À-ÿ]/.test(s)) score += 20;
  if (/\bJr\.\s*$/i.test(s)) score += 5;
  if (hasIneligibleSuffix(s)) score += 3;
  return score;
}

function pickBetter(a, b) {
  if (!a) return b;
  if (!b) return a;
  return nameScore(a) >= nameScore(b) ? a : b;
}

function normalizeJr(name) {
  return String(name).replace(/\bJr\.?\s*$/i, (m) =>
    m.includes(".") ? "Jr." : "Jr.",
  );
}

function shouldSkipDriverCell(raw) {
  const t = String(raw ?? "").trim();
  if (!t) return true;
  const l = t.toLowerCase();
  return (
    l.includes("qualified by") ||
    l.includes("failed to qualify") ||
    l.includes("elimination") ||
    l.includes("fast six") ||
    l.includes("group ")
  );
}

function buildCanonicalIndex(eventsDir) {
  /** @type {Map<string, string>} */
  const bySlug = new Map();

  for (const filePath of walkJsonFiles(eventsDir)) {
    let data;
    try {
      data = readJson(filePath);
    } catch {
      continue;
    }
    for (const row of data.entry_list || []) {
      const raw = typeof row?.driver === "string" ? row.driver.trim() : "";
      if (!raw) continue;
      const slug = makeSlug(raw);
      if (!slug) continue;
      const fixed = fixIneligibleSpacing(stripTrailingHash(raw));
      bySlug.set(slug, pickBetter(bySlug.get(slug), normalizeJr(fixed)));
    }
  }
  for (const [slug, name] of Object.entries(CANONICAL_OVERRIDES)) {
    bySlug.set(slug, pickBetter(bySlug.get(slug), name));
  }
  return bySlug;
}

function canonicalDisplay(raw, bySlug) {
  if (shouldSkipDriverCell(raw)) return raw;
  const trimmed = stripTrailingHash(String(raw).trim());
  if (!trimmed) return raw;

  const spaced = fixIneligibleSpacing(trimmed);
  const ineligible = hasIneligibleSuffix(spaced);
  const slug = makeSlug(spaced);
  const canon = bySlug.get(slug);
  if (!canon) {
    return spaced !== trimmed ? spaced : trimmed;
  }

  let out = stripIneligibleSuffix(canon);
  out = normalizeJr(out);
  if (ineligible) out = `${out} (i)`;
  return out;
}

function patchEntryList(row, bySlug) {
  if (!row || typeof row !== "object") return false;
  let changed = false;

  if (typeof row.driver === "string" && row.driver.trim()) {
    const next = canonicalDisplay(row.driver, bySlug);
    if (next !== row.driver) {
      row.driver = next;
      changed = true;
    }
  }

  const slug = makeSlug(row.driver || "");
  if (slug) {
    const want = slug;
    if (row.driver_slug !== want) {
      row.driver_slug = want;
      changed = true;
    }
    if (hasIneligibleSuffix(row.driver) && row.points_eligible !== false) {
      row.points_eligible = false;
      changed = true;
    }
  }

  return changed;
}

function patchTable(tbl, bySlug) {
  if (!tbl?.headers || !tbl?.rows) return 0;
  const cols = [];
  tbl.headers.forEach((h, i) => {
    if (DRIVER_HEADERS.has(String(h ?? "").trim().toLowerCase())) cols.push(i);
  });
  if (!cols.length) return 0;

  let n = 0;
  for (const row of tbl.rows) {
    if (!Array.isArray(row)) continue;
    for (const i of cols) {
      if (i >= row.length || typeof row[i] !== "string") continue;
      const next = canonicalDisplay(row[i], bySlug);
      if (next !== row[i]) {
        row[i] = next;
        n++;
      }
    }
  }
  return n;
}

function shouldProcessFile(filePath, eventsDir) {
  if (!ONLY?.length) return true;
  const rel = path.relative(eventsDir, filePath).replace(/\\/g, "/");
  return ONLY.some((p) => rel === p || rel.endsWith("/" + p) || rel.includes(p));
}

function main() {
  const eventsDir = path.join(DATA_DIR, "events");
  const bySlug = buildCanonicalIndex(eventsDir);
  let files = 0;
  let rows = 0;

  for (const filePath of walkJsonFiles(eventsDir)) {
    if (!shouldProcessFile(filePath, eventsDir)) continue;
    let data;
    try {
      data = readJson(filePath);
    } catch {
      continue;
    }
    let changed = false;

    for (const row of data.entry_list || []) {
      if (patchEntryList(row, bySlug)) {
        changed = true;
        rows++;
      }
    }

    for (const tbl of Object.values(data.tables || {})) {
      let n = patchTable(tbl, bySlug);
      if (Array.isArray(tbl?.sessions)) {
        for (const sess of tbl.sessions) {
          n += patchTable(sess, bySlug);
        }
      }
      if (n) {
        changed = true;
        rows += n;
      }
    }

    if (changed) {
      files++;
      if (!DRY_RUN) writeJson(filePath, data);
    }
  }

  console.log(
    `${DRY_RUN ? "[dry-run] " : ""}Touched ${files} files, ${rows} row/cell updates`,
  );
  console.log(`Canonical slugs indexed: ${bySlug.size}`);
}

main();
