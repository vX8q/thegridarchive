#!/usr/bin/env node
/**
 * Rewrite JSON on disk in TGA compact layout:
 * - Table row arrays: one row per line (JSON.stringify(row))
 * - Arrays of plain objects (entry_list, youtube_highlights, …): one object per line
 * - String/primitive header arrays: single line
 * - Other structures: indented objects, recursive rules
 *
 * Usage:
 *   node scripts/format-compact-json.mjs [paths…]
 *   node scripts/format-compact-json.mjs data/events
 *   node scripts/format-compact-json.mjs data
 */

import fs from "node:fs";
import path from "node:path";

const INDENT = "  ";

function isPrimitiveCell(v) {
  return (
    v === null ||
    typeof v === "string" ||
    typeof v === "number" ||
    typeof v === "boolean"
  );
}

function isStringOrNumberArray(arr) {
  return arr.length > 0 && arr.every(isPrimitiveCell);
}

function isTableRowArray(arr) {
  return (
    arr.length > 0 &&
    arr.every(
      (row) => Array.isArray(row) && row.every((cell) => isPrimitiveCell(cell)),
    )
  );
}

function isPlainObjectArray(arr) {
  return (
    arr.length > 0 &&
    arr.every(
      (item) =>
        item !== null &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        Object.values(item).every(
          (v) =>
            isPrimitiveCell(v) ||
            (Array.isArray(v) &&
              (v.length === 0 || v.every((x) => isPrimitiveCell(x)))),
        ),
    )
  );
}

function isShallowObject(obj) {
  return Object.values(obj).every((v) => {
    if (isPrimitiveCell(v)) return true;
    if (Array.isArray(v)) return v.length === 0 || v.every(isPrimitiveCell);
    return false;
  });
}

function formatValue(value, depth) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  const pad = INDENT.repeat(depth);
  const padIn = INDENT.repeat(depth + 1);

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    if (isStringOrNumberArray(value)) return JSON.stringify(value);
    if (isTableRowArray(value)) {
      const lines = value.map((row) => padIn + JSON.stringify(row));
      return "[\n" + lines.join(",\n") + "\n" + pad + "]";
    }
    if (isPlainObjectArray(value)) {
      const lines = value.map((obj) => padIn + JSON.stringify(obj));
      return "[\n" + lines.join(",\n") + "\n" + pad + "]";
    }
    const lines = value.map((item) => padIn + formatValue(item, depth + 1));
    return "[\n" + lines.join(",\n") + "\n" + pad + "]";
  }

  const keys = Object.keys(value);
  if (keys.length === 0) return "{}";
  if (depth > 0 && isShallowObject(value)) {
    return JSON.stringify(value);
  }
  const lines = keys.map(
    (key) => padIn + JSON.stringify(key) + ": " + formatValue(value[key], depth + 1),
  );
  return "{\n" + lines.join(",\n") + "\n" + pad + "}";
}

function formatJsonDocument(obj) {
  return formatValue(obj, 0) + "\n";
}

function collectJsonFiles(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) {
    return target.endsWith(".json") ? [target] : [];
  }
  const out = [];
  for (const ent of fs.readdirSync(target, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === ".git") continue;
    out.push(...collectJsonFiles(path.join(target, ent.name)));
  }
  return out;
}

const roots = process.argv.slice(2);
const targets = roots.length > 0 ? roots : ["data"];

let files = [];
for (const t of targets) {
  const abs = path.resolve(t);
  if (!fs.existsSync(abs)) {
    console.error("Missing:", abs);
    process.exitCode = 1;
    continue;
  }
  files.push(...collectJsonFiles(abs));
}
files = [...new Set(files)].sort();

let changed = 0;
for (const file of files) {
  const before = fs.readFileSync(file, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(before);
  } catch (e) {
    console.error("Parse error:", file, e.message);
    process.exitCode = 1;
    continue;
  }
  const after = formatJsonDocument(parsed);
  if (after !== before) {
    fs.writeFileSync(file, after, "utf8");
    changed++;
  }
}

console.log(`Compact-formatted ${changed} / ${files.length} JSON file(s).`);
