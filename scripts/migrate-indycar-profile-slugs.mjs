/**
 * Move IndyCar driver profiles from legal-name slugs to event display slugs.
 */
import fs from "fs";
import path from "path";

const DATA_DIR = "./data";
const DRY_RUN = process.argv.includes("--dry-run");

const MIGRATIONS = [
  ["alex-palou-montalbo", "alex-palou"],
  ["everette-edward-carpenter-jr", "ed-carpenter"],
  ["hans-christian-rhod-rasmussen", "christian-rasmussen"],
  ["helio-alves-de-castro-neves", "helio-castroneves"],
  ["karl-felix-helmer-rosenqvist", "felix-rosenqvist"],
];

const profilesPath = path.join(DATA_DIR, "driver_profiles.json");
const redirectsPath = path.join(DATA_DIR, "driver_profile_redirects.json");

const profiles = JSON.parse(fs.readFileSync(profilesPath, "utf8"));
const redirects = JSON.parse(fs.readFileSync(redirectsPath, "utf8"));

for (const [from, to] of MIGRATIONS) {
  const src = profiles[from];
  if (!src) {
    console.warn(`skip: missing profile ${from}`);
    continue;
  }
  if (profiles[to]) {
    console.warn(`skip: target already exists ${to}`);
  } else {
    profiles[to] = { ...src };
    console.log(`profile: ${from} -> ${to}`);
  }
  delete profiles[from];
  redirects[from] = to;
  console.log(`redirect: ${from} -> ${to}`);
}

if (!DRY_RUN) {
  fs.writeFileSync(profilesPath, `${JSON.stringify(profiles, null, 2)}\n`, "utf8");
  fs.writeFileSync(redirectsPath, `${JSON.stringify(redirects, null, 2)}\n`, "utf8");
  console.log("Wrote driver_profiles.json and driver_profile_redirects.json");
} else {
  console.log("Dry-run: no files written");
}
