#!/usr/bin/env node
import assert from "assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { slugifyDriverName } from "./lib/driver-slug-canon.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const history = JSON.parse(fs.readFileSync(path.join(root, "data", "f1_seasons_history.json"), "utf8"));
const profiles = JSON.parse(fs.readFileSync(path.join(root, "data", "driver_profiles.json"), "utf8"));

const champions = [];
const seen = new Set();
for (const row of history) {
  const name = String(row?.driver_champion || "").trim();
  if (!name) continue;
  const key = name.toLowerCase();
  if (seen.has(key)) continue;
  seen.add(key);
  champions.push(name);
}

assert.ok(champions.length >= 30, `expected dozens of F1 WDCs, got ${champions.length}`);

const missing = [];
const sparse = [];
for (const name of champions) {
  const slug = slugifyDriverName(name);
  const profile = profiles[slug];
  if (!profile) {
    missing.push(`${name} (${slug})`);
    continue;
  }
  if (!String(profile.full_name || "").trim() || !String(profile.citizenship || "").trim()) {
    sparse.push(`${name} (${slug})`);
  }
}

assert.deepStrictEqual(missing, [], `missing F1 WDC profiles:\n${missing.join("\n")}`);
assert.deepStrictEqual(sparse, [], `sparse F1 WDC profiles:\n${sparse.join("\n")}`);

assert.strictEqual(slugifyDriverName("Mika Hakkinen"), "mika-hakkinen");
assert.strictEqual(slugifyDriverName("Mika Häkkinen"), "mika-hakkinen");
assert.strictEqual(slugifyDriverName("Kimi Raikkonen"), "kimi-raikkonen");
assert.strictEqual(slugifyDriverName("Juan Manuel Fangio"), "juan-manuel-fangio");

console.log(`ok ${champions.length} F1 WDC profiles present`);
