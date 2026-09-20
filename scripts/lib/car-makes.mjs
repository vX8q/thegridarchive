import fs from 'fs';
import path from 'path';

// Manufacturer spelling for the `Car` column of endurance / GT event tables.
// Timing providers publish makes in caps (ORECA, ASTON MARTIN) and the site
// renders the cell verbatim, so data/events must already hold the canonical
// form. The browser-side fallback in web/lib/event-race-content.js only covers
// the few tables it is wired into, which is why qualifying showed ASTON MARTIN
// while race showed Aston Martin.

export const CANONICAL_CAR_MAKES = [
  'Alpine',
  'Aston Martin',
  'Audi',
  'BMW',
  'Cadillac',
  'Chevrolet',
  'Duqueine',
  'Ferrari',
  'Ford',
  'Honda',
  'Hyundai',
  'Lamborghini',
  'Lexus',
  'Ligier',
  'McLaren',
  'Mercedes-AMG',
  'Nissan',
  'Oreca',
  'Peugeot',
  'Porsche',
  'Subaru',
  'Toyota',
];

// Protocols that name the model or the plain brand where the site shows the
// entrant manufacturer.
export const CAR_MAKE_ALIASES = {
  CORVETTE: 'Chevrolet',
  MERCEDES: 'Mercedes-AMG',
  'MERCEDES AMG': 'Mercedes-AMG',
};

export function normCarKey(raw) {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

const BY_KEY = new Map();
for (const name of CANONICAL_CAR_MAKES) BY_KEY.set(normCarKey(name), name);
for (const [key, name] of Object.entries(CAR_MAKE_ALIASES)) {
  BY_KEY.set(normCarKey(key), name);
}

/** Canonical spelling for a make, or null when the make is not in the list. */
export function canonicalCarMake(raw) {
  const key = normCarKey(raw);
  if (!key) return null;
  return BY_KEY.get(key) ?? null;
}

// Series whose `Car` column holds a manufacturer. Stock-car `Car` is the entry
// number, so those directories stay out of scope.
export const CAR_MAKE_SERIES_DIRS = [
  'DTM',
  'ELMS',
  'GT World Challenge Europe Endurance',
  'GT World Challenge Europe Sprint',
  'IMSA',
  'Super GT',
  'WEC',
];

export const EVENTS_ROOT = path.join(process.cwd(), 'data', 'events');

export function walkCarMakeEventFiles() {
  const out = [];
  for (const dir of CAR_MAKE_SERIES_DIRS) {
    const full = path.join(EVENTS_ROOT, dir);
    if (!fs.existsSync(full)) continue;
    walkJson(full, out);
  }
  return out.sort();
}

function walkJson(dir, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkJson(p, out);
    else if (ent.name.endsWith('.json')) out.push(p);
  }
}

function isCarHeader(header) {
  return String(header ?? '').trim().toLowerCase() === 'car';
}

/**
 * Visit every `Car` cell of every table in an event object, including nested
 * `sessions[]` and per-class tables. `visit(value, set)` may rewrite the cell.
 */
export function forEachCarCell(eventObj, visit) {
  walkTables(eventObj?.tables, visit);
  const entries = eventObj?.entry_list;
  if (Array.isArray(entries)) {
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object' || !('car' in entry)) continue;
      visit(entry.car, (next) => {
        entry.car = next;
      });
    }
  }
}

function walkTables(node, visit) {
  if (Array.isArray(node)) {
    for (const item of node) walkTables(item, visit);
    return;
  }
  if (!node || typeof node !== 'object') return;

  if (Array.isArray(node.headers) && Array.isArray(node.rows)) {
    const idx = node.headers.findIndex(isCarHeader);
    if (idx >= 0) {
      for (const row of node.rows) {
        if (!Array.isArray(row) || idx >= row.length) continue;
        visit(row[idx], (next) => {
          row[idx] = next;
        });
      }
    }
  }
  for (const value of Object.values(node)) {
    if (value && typeof value === 'object') walkTables(value, visit);
  }
}
