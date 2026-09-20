export const P1_GAP = '—';

const POS_HEADERS = new Set(['pos', 'pos.', 'rank', 'fin']);
const GAP_HEADERS = new Set(['gap', 'int', 'interval']);

// Leader placeholders from timing PDFs. Real deltas (`+0.932`, `3.787`,
// `1 LAP`) are left alone. Diff is out of scope: IndyCar Diff can hold a
// lap number when the protocol columns shift, and stock-car practice uses
// `---.---` as its own convention.
const PLACEHOLDERS = new Set([
  '',
  '-',
  '–',
  '--',
  '---',
  '--.--',
  '--.----',
  '---.---',
  '0',
  '0.0',
  '0.00',
  '0.000',
  '0.0000',
]);

export function normHeader(h) {
  return String(h ?? '')
    .trim()
    .toLowerCase()
    .replace(/\./g, '');
}

export function isP1Pos(raw) {
  return String(raw ?? '').trim() === '1' || String(raw ?? '').trim() === '1.';
}

export function isLeaderPlaceholder(raw) {
  return PLACEHOLDERS.has(String(raw ?? '').trim());
}

export function posColumnIndex(headers) {
  const lows = (headers || []).map(normHeader);
  for (let i = 0; i < lows.length; i++) {
    if (POS_HEADERS.has(lows[i])) return i;
  }
  return -1;
}

export function gapColumnIndexes(headers) {
  const lows = (headers || []).map(normHeader);
  const out = [];
  lows.forEach((h, i) => {
    if (GAP_HEADERS.has(h)) out.push(i);
  });
  return out;
}

/**
 * Visit every Gap / Int / Interval cell on a Pos=1 row. `visit(value, set)`
 * may rewrite the cell.
 */
export function forEachP1GapCell(eventObj, visit) {
  walkTables(eventObj?.tables, visit);
}

function walkTables(node, visit) {
  if (Array.isArray(node)) {
    for (const item of node) walkTables(item, visit);
    return;
  }
  if (!node || typeof node !== 'object') return;

  if (Array.isArray(node.headers) && Array.isArray(node.rows)) {
    const pi = posColumnIndex(node.headers);
    const gi = gapColumnIndexes(node.headers);
    if (pi >= 0 && gi.length) {
      for (const row of node.rows) {
        if (!Array.isArray(row) || !isP1Pos(row[pi])) continue;
        for (const idx of gi) {
          if (idx >= row.length) continue;
          visit(row[idx], (next) => {
            row[idx] = next;
          });
        }
      }
    }
  }
  for (const value of Object.values(node)) {
    if (value && typeof value === 'object') walkTables(value, visit);
  }
}
