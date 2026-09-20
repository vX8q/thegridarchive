#!/usr/bin/env node
/**
 * Audit JSON files for compact layout vs legacy multi-line table rows.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === ".git") continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name.endsWith(".json")) out.push(p);
  }
  return out;
}

/** Legacy: opening bracket of array then newline then quoted cell on next line (table pretty-print). */
const LEGACY_ROW_OPEN = /\[\s*\r?\n\s*"/g;

const files = walk(root).sort();
let parseErrors = [];
let legacyFiles = [];
let outsideData = [];
let lineStats = { under500: 0, between500_1500: 0, over1500: 0 };

for (const abs of files) {
  const rel = path.relative(root, abs).replace(/\\/g, "/");
  let text;
  try {
    text = fs.readFileSync(abs, "utf8");
    JSON.parse(text);
  } catch (e) {
    parseErrors.push({ rel, err: e.message });
    continue;
  }
  const lines = text.split(/\r?\n/).length;
  if (lines < 500) lineStats.under500++;
  else if (lines <= 1500) lineStats.between500_1500++;
  else lineStats.over1500++;

  if (!rel.startsWith("data/")) outsideData.push(rel);

  const matches = text.match(LEGACY_ROW_OPEN);
  if (matches && matches.length >= 3) {
    legacyFiles.push({ rel, legacyOpens: matches.length, lines });
  }
}

legacyFiles.sort((a, b) => b.legacyOpens - a.legacyOpens);

console.log(JSON.stringify({
  totalJsonFiles: files.length,
  underData: files.filter((f) => path.relative(root, f).replace(/\\/g, "/").startsWith("data/")).length,
  outsideDataCount: outsideData.length,
  outsideData,
  parseErrors,
  lineStats,
  legacyFileCount: legacyFiles.length,
  topLegacy: legacyFiles.slice(0, 15),
}, null, 2));

if (parseErrors.length) process.exitCode = 1;
