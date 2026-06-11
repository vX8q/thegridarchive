/**
 * Parse Italian F4 starting-grid PDFs.
 * Positions: bottom → top, left → right (pole = bottom-left).
 */
import fs from 'fs';
import path from 'path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

export async function parseStartingGridPdf(pdfPath, validCarNumbers) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await getDocument({ data, disableWorker: true }).promise;
  const page = await doc.getPage(1);
  const content = await page.getTextContent();

  const cars = content.items
    .filter((it) => it.str && validCarNumbers.has(it.str.trim()))
    .map((it) => ({
      no: it.str.trim(),
      x: it.transform[4],
      y: it.transform[5],
    }))
    // Row position labels sit in the left margin (~x 42); car numbers are on the grid.
    .filter((it) => it.x > 80);

  cars.sort((a, b) => a.y - b.y || a.x - b.x);

  const rows = [];
  for (const c of cars) {
    const row = rows.find((r) => Math.abs(r.y - c.y) < 12);
    if (row) {
      row.items.push(c);
      row.y = (row.y + c.y) / 2;
    } else {
      rows.push({ y: c.y, items: [c] });
    }
  }

  rows.sort((a, b) => a.y - b.y);
  for (const r of rows) r.items.sort((a, b) => a.x - b.x);

  return rows.flatMap((r) => r.items.map((i) => i.no));
}
