/**
 * Re-key profiles and driver_slug fields from broken diacritic slugs
 * (e.g. nico-h-lkenberg -> nico-hulkenberg, sergio-p-rez -> sergio-perez).
 */
import fs from "fs";
import path from "path";

const DATA = "./data";
const MIGRATIONS = {
  "nico-h-lkenberg": "nico-hulkenberg",
  "sergio-p-rez": "sergio-perez",
  "cem-bolukba-i": "cem-bolukbasi",
  "rafael-c-mara": "rafael-camara",
  "connor-zilisch-r": "connor-zilisch",
};

const profilesPath = path.join(DATA, "driver_profiles.json");
const redirectsPath = path.join(DATA, "driver_profile_redirects.json");
const profiles = JSON.parse(fs.readFileSync(profilesPath, "utf8"));
const redirects = JSON.parse(fs.readFileSync(redirectsPath, "utf8"));

for (const [from, to] of Object.entries(MIGRATIONS)) {
  if (profiles[from]) {
    if (!profiles[to]) profiles[to] = { ...profiles[from] };
    else {
      for (const k of ["full_name", "birth_date", "birth_place", "citizenship", "photo_url", "death_date"]) {
        if (!String(profiles[to][k] ?? "").trim() && String(profiles[from][k] ?? "").trim()) {
          profiles[to][k] = profiles[from][k];
        }
      }
    }
    delete profiles[from];
    console.log("profile", from, "->", to);
  }
  redirects[from] = to;
}

const ordered = {};
for (const k of Object.keys(profiles).sort()) ordered[k] = profiles[k];
fs.writeFileSync(profilesPath, `${JSON.stringify(ordered, null, 2)}\n`, "utf8");
fs.writeFileSync(redirectsPath, `${JSON.stringify(redirects, null, 2)}\n`, "utf8");

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile() && e.name.endsWith(".json")) out.push(p);
  }
  return out;
}

let files = 0;
let cells = 0;
for (const filePath of walk(path.join(DATA, "events"))) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    continue;
  }
  let changed = false;
  for (const row of data.entry_list || []) {
    if (typeof row?.driver_slug === "string" && MIGRATIONS[row.driver_slug]) {
      row.driver_slug = MIGRATIONS[row.driver_slug];
      changed = true;
      cells++;
    }
  }
  if (changed) {
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    files++;
  }
}
console.log(`Updated driver_slug in ${files} event files (${cells} rows)`);
