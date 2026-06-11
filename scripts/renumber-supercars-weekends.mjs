/**
 * Renumber Supercars 2026 event JSON files by weekend ordinal (1,2,3,…),
 * not by individual race number in the 37-race schedule.
 */
import fs from "fs";
import path from "path";

const DIR = path.join("data", "events", "Supercars", "2026");

/** old filename (no path) -> weekend ordinal */
const RENAME = {
  "supercars_2026_1.json": 1,   // Sydney
  "supercars_2026_4.json": 2,   // Melbourne
  "supercars_2026_8.json": 3,   // Taupō
  "supercars_2026_11.json": 4,  // Christchurch
  "supercars_2026_14.json": 5,  // Tasmania
};

const DELETE = new Set([
  "supercars_2026_2.json",  // sparse Sydney duplicate
  "supercars_2026_9.json",  // Taupō race 9 duplicate (already in _8)
]);

const temps = [];
for (const [oldName, weekend] of Object.entries(RENAME)) {
  const src = path.join(DIR, oldName);
  if (!fs.existsSync(src)) {
    console.warn("skip missing", oldName);
    continue;
  }
  const data = JSON.parse(fs.readFileSync(src, "utf8"));
  data.event_id = `SUPERCARS_2026_${weekend}`;
  const tmp = path.join(DIR, `__tmp_weekend_${weekend}.json`);
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  temps.push({ tmp, weekend, oldName });
  console.log(`${oldName} -> weekend ${weekend} (${data.event_id})`);
}

for (const name of DELETE) {
  const p = path.join(DIR, name);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    console.log("deleted", name);
  }
}

for (const { tmp, weekend, oldName } of temps) {
  const oldPath = path.join(DIR, oldName);
  if (fs.existsSync(oldPath) && oldName !== `supercars_2026_${weekend}.json`) {
    fs.unlinkSync(oldPath);
  }
  const dest = path.join(DIR, `supercars_2026_${weekend}.json`);
  if (fs.existsSync(dest) && dest !== tmp) {
    fs.unlinkSync(dest);
  }
  fs.renameSync(tmp, dest);
  console.log("wrote", `supercars_2026_${weekend}.json`);
}
