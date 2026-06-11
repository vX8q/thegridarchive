/**
 * Parse FREC starting-grid PDFs (pole = bottom-left, Y↑ = higher grid slot).
 * Run: node scripts/parse-frec-grid.mjs <pdf-path>
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const VALID = new Set([
  '2', '3', '4', '5', '7', '8', '9', '11', '12', '15', '19', '23', '24', '27', '28',
  '33', '47', '51', '55', '60', '67', '69', '71', '73', '78', '87', '88', '95', '98', '99',
]);

function normalizeCarToken(raw) {
  const s = String(raw || '').trim();
  if (VALID.has(s)) return s;
  const ocr = s.replace(/[lI|]/g, '1').replace(/O/g, '0');
  if (VALID.has(ocr)) return ocr;
  const m = ocr.match(/^(\d{1,2})$/);
  if (m && VALID.has(m[1])) return m[1];
  // OCR noise like "|!ill98" — not plain gap/time numbers ("155", "14.987").
  if (/[^0-9.:+\-]/.test(s)) {
    const tail = ocr.match(/(\d{2})$/);
    if (tail && VALID.has(tail[1])) return tail[1];
  }
  return null;
}

export async function parseFrecStartingGridPdf(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await getDocument({ data, disableWorker: true }).promise;
  const page = await doc.getPage(1);
  const content = await page.getTextContent();

  const hits = [];
  for (const it of content.items) {
    const no = normalizeCarToken(it.str);
    if (!no) continue;
    const x = it.transform[4];
    const y = it.transform[5];
    if (x < 230 || x > 420 || y < 200 || y > 680) continue;
    hits.push({ no, x, y, raw: String(it.str).trim() });
  }

  hits.sort((a, b) => a.y - b.y || a.x - b.x);

  const rows = [];
  for (const h of hits) {
    const row = rows.find((r) => Math.abs(r.y - h.y) < 22);
    if (row) {
      row.items.push(h);
      row.y = (row.y + h.y) / 2;
    } else {
      rows.push({ y: h.y, items: [h] });
    }
  }
  rows.sort((a, b) => a.y - b.y);
  for (const row of rows) row.items.sort((a, b) => a.x - b.x);

  const ordered = rows.flatMap((r) => r.items);
  // Drop duplicate car numbers (PDF noise); keep first by grid order.
  const seen = new Set();
  const unique = ordered.filter((h) => {
    if (seen.has(h.no)) return false;
    seen.add(h.no);
    return true;
  });

  return unique.map((h, i) => ({ st: i + 1, no: h.no, x: h.x, y: h.y }));
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.error('Usage: node scripts/parse-frec-grid.mjs <pdf-path>');
    process.exit(1);
  }
  const grid = await parseFrecStartingGridPdf(pdfPath);
  console.log(JSON.stringify(grid, null, 2));
  const missing = [...VALID].filter((n) => !grid.some((g) => g.no === n));
  if (missing.length) console.error('missing:', missing.join(', '));
}
