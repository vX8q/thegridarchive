import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploads = path.join(process.env.USERPROFILE || '', '.cursor/projects/c-Users-stepa-Documents-TGA/uploads');
const schedDir = path.join(__dirname, '../data/schedules');

const seriesMap = [
  ['2026_Formula_One_World_Championship-0.md', 'f1.json', 2026],
  ['2026_Formula_2_Championship-1.md', 'f2.json', 2026],
  ['2026_FIA_Formula_3_Championship-2.md', 'f3.json', 2026],
  ['2026_Formula_Regional_European_Championship-3.md', 'frec.json', 2026],
  ['2026_Italian_F4_Championship-4.md', 'f4_it.json', 2026],
  ['2026_Porsche_Supercup-5.md', 'psc.json', 2026],
  ['2026_NASCAR_Cup_Series-6.md', 'nascar_cup.json', 2026],
  ['2026_NASCAR_O_Reilly_Auto_Parts_Series-7.md', 'noaps.json', 2026],
  ['2026_NASCAR_Craftsman_Truck_Series-8.md', 'nascar_truck.json', 2026],
  ['2026_ARCA_Menards_Series-9.md', 'arca.json', 2026],
  ['2026_NASCAR_Whelen_Modified_Tour-10.md', 'nascar_modified.json', 2026],
  ['2026_IndyCar_Series-11.md', 'indycar.json', 2026],
  ['2026_Supercars_Championship-12.md', 'supercars.json', 2026],
  ['2026_FIA_World_Endurance_Championship-13.md', 'wec.json', 2026],
  ['2026_European_Le_Mans_Series-14.md', 'elms.json', 2026],
  ['2026_GT_World_Challenge_Europe_Endurance_Cup-15.md', 'gtwce_end.json', 2026],
  ['2026_GT_World_Challenge_Europe_Sprint_Cup-16.md', 'gtwce_sprint.json', 2026],
  ['2026_Deutsche_Tourenwagen_Masters-17.md', 'dtm.json', 2026],
  ['2026_Super_GT_Series-18.md', 'super_gt.json', 2026],
  ['2026_IMSA_SportsCar_Championship-19.md', 'imsa.json', 2026],
  ['2026_Super_Formula_Championship-20.md', 'super_formula.json', 2026],
];

const months = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8,
  september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function parseWikiDate(s, year = 2026) {
  if (!s) return null;
  s = s.replace(/\\\[.*?\]/g, '').replace(/\[\[.*?\]\]/g, '').trim();

  let m = s.match(/(\d{1,2})\s*[–\-]\s*(\d{1,2})\s+([A-Za-z]+)/);
  if (m) {
    const mo = months[m[3].toLowerCase()];
    if (mo) {
      return {
        start: `${year}-${String(mo).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`,
        end: `${year}-${String(mo).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`,
      };
    }
  }
  m = s.match(/([A-Za-z]+)\s+(\d{1,2})\s*[–\-]\s*(\d{1,2})/);
  if (m) {
    const mo = months[m[1].toLowerCase()];
    if (mo) {
      return {
        start: `${year}-${String(mo).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`,
        end: `${year}-${String(mo).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`,
      };
    }
  }
  m = s.match(/(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?/);
  if (m) {
    const y = m[3] ? parseInt(m[3], 10) : year;
    const mo = months[m[2].toLowerCase()];
    if (mo) {
      const iso = `${y}-${String(mo).padStart(2, '0')}-${String(parseInt(m[1], 10)).padStart(2, '0')}`;
      return { start: iso, end: iso };
    }
  }
  m = s.match(/([A-Za-z]+)\s+(\d{1,2})(?:,?\s+(\d{4}))?/);
  if (m) {
    const y = m[3] ? parseInt(m[3], 10) : year;
    const mo = months[m[1].toLowerCase()];
    if (mo) {
      const iso = `${y}-${String(mo).padStart(2, '0')}-${String(parseInt(m[2], 10)).padStart(2, '0')}`;
      return { start: iso, end: iso };
    }
  }
  return null;
}

function extractName(cell) {
  const m = cell.match(/\[([^\]]+)\]\(/);
  if (m) return m[1].replace(/\\-/g, '-').trim();
  return cell.replace(/\|/g, '').trim().slice(0, 120);
}

function parseWikiCalendar(text) {
  const lines = text.split('\n');
  const rows = [];
  for (const line of lines) {
    if (!line.trim().startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 3) continue;
    const r0 = cells[0].replace(/\\\[.*?\]/g, '').trim();
    if (!/^\d+$/.test(r0)) continue;
    const round = parseInt(r0, 10);
    if (cells.length > 10 && cells.slice(1).every((c) => /^[\d\s\[\]().,_-]+$/.test(c.replace(/\[.*?\]/g, '')))) continue;
    const name = extractName(cells[1]);
    const dateCell = [...cells].reverse().find((c) =>
      /(January|February|March|April|May|June|July|August|September|October|November|December|\d{1,2}\s+\w+)/i.test(c)
    );
    const d = parseWikiDate(dateCell || cells[cells.length - 1]);
    if (!name || !d) continue;
    rows.push({ round, name, ...d, dateRaw: (dateCell || '').slice(0, 80) });
  }
  const byRound = new Map();
  for (const r of rows) byRound.set(r.round, r);
  return [...byRound.values()].sort((a, b) => a.round - b.round);
}

function loadTga(file, year) {
  const data = JSON.parse(fs.readFileSync(path.join(schedDir, file), 'utf8'));
  const events = (Array.isArray(data) ? data : data.events || [])
    .filter((e) => String(e.season || '2026') === String(year))
    .filter((e) => !/PRE_SEASON|PROLOGUE/i.test(String(e.id || '')));
  return events.map((e, i) => ({
    round: i + 1,
    id: e.id,
    name: e.name,
    start: (e.start_date || '').slice(0, 10),
    end: (e.end_date || e.start_date || '').slice(0, 10),
  }));
}

function normName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(grand prix|gp|presented by|the)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function namesMatch(a, b) {
  const na = normName(a);
  const nb = normName(b);
  if (!na || !nb) return false;
  if (na.includes(nb) || nb.includes(na)) return true;
  const wa = na.split(' ');
  const wb = nb.split(' ');
  const common = wa.filter((w) => w.length > 3 && wb.includes(w));
  return common.length >= 2;
}

function datesMatch(wiki, tga) {
  const wEnd = wiki.end || wiki.start;
  const wStart = wiki.start;
  const { start: tStart, end: tEnd } = tga;
  if (wEnd === tEnd || wEnd === tStart) return true;
  if (wStart === tStart) return true;
  if (tStart && tEnd && wEnd >= tStart && wEnd <= tEnd) return true;
  if (tStart && tEnd && wStart >= tStart && wStart <= tEnd) return true;
  return false;
}

for (const [wikiFile, jsonFile] of seriesMap) {
  const wikiPath = path.join(uploads, wikiFile);
  if (!fs.existsSync(wikiPath)) {
    console.log('MISSING', wikiFile);
    continue;
  }
  const wikiRows = parseWikiCalendar(fs.readFileSync(wikiPath, 'utf8'));
  const tgaRows = loadTga(jsonFile, 2026);
  const issues = [];
  if (wikiRows.length !== tgaRows.length) {
    issues.push({ type: 'COUNT', wiki: wikiRows.length, tga: tgaRows.length });
  }
  const max = Math.max(wikiRows.length, tgaRows.length);
  for (let i = 0; i < max; i++) {
    const w = wikiRows[i];
    const t = tgaRows[i];
    if (!w) {
      issues.push({ type: 'EXTRA_TGA', round: i + 1, tga: `${t.name} (${t.start})` });
      continue;
    }
    if (!t) {
      issues.push({ type: 'MISSING_TGA', round: w.round, wiki: `${w.name} (${w.start})` });
      continue;
    }
    if (!namesMatch(w.name, t.name)) {
      issues.push({ type: 'NAME', round: w.round, wiki: w.name, tga: t.name, id: t.id });
    }
    if (!datesMatch(w, t)) {
      issues.push({
        type: 'DATE',
        round: w.round,
        wiki: `${w.name}: ${w.start}${w.end !== w.start ? '–' + w.end : ''}`,
        tga: `${t.name}: ${t.start}${t.end !== t.start ? '–' + t.end : ''}`,
        id: t.id,
      });
    }
  }
  console.log(`\n======== ${jsonFile} ========`);
  console.log(`Wiki: ${wikiRows.length} | TGA: ${tgaRows.length}`);
  if (issues.length === 0) console.log('OK');
  else issues.forEach((iss) => console.log(JSON.stringify(iss)));
}
