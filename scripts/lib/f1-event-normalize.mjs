/**
 * Normalize F1 event JSON to the 2026 layout:
 * - qualifying.sessions[]
 * - race_results for GP; tables.race.sessions[] for sprint only
 * - canonical race_results headers (Laps Led, Best Lap embedded)
 * - entry_list manufacturer = chassis code (2025 legacy)
 */

/** Constructor / power-unit label → chassis code (2025 season). */
export const F1_2025_CHASSIS_BY_LABEL = {
  'Alpine-Renault': 'A525',
  'Aston Martin Aramco-Mercedes': 'AMR25',
  Ferrari: 'SF-25',
  'Haas-Ferrari': 'VF-25',
  'Kick Sauber-Ferrari': 'C45',
  'McLaren-Mercedes': 'MCL39',
  Mercedes: 'F1 W16',
  'Racing Bulls-Honda RBPT': 'VCARB02',
  'Red Bull Racing-Honda RBPT': 'RB21',
  'Williams-Mercedes': 'FW47',
};

/** Hard-coded laps-led totals when range table is incomplete (legacy data). */
const F1_LAPS_LED_OVERRIDES = {
  F1_2025_8: { 'Lando Norris': 42, 'Charles Leclerc': 3, 'Max Verstappen': 33 },
  F1_2025_9: { 'Oscar Piastri': 60, 'Max Verstappen': 6 },
  F1_2025_10: {
    'George Russell': 43,
    'Kimi Antonelli': 1,
    'Oscar Piastri': 5,
    'Lando Norris': 15,
    'Charles Leclerc': 6,
  },
  F1_2025_11: { 'Lando Norris': 62, 'Oscar Piastri': 7, 'Lewis Hamilton': 1 },
};

export const F1_RACE_RESULTS_HEADERS = [
  'Pos',
  'St',
  'No.',
  'Driver',
  'Constructor',
  'Laps',
  'Time/Retired',
  'Laps Led',
  'Best Lap',
  'Points',
];

function isF1EventId(id) {
  return /^F1_\d{4}_/i.test(String(id || ''));
}

function isGrandPrixSessionTitle(title) {
  const t = String(title || '').trim().toLowerCase();
  return t === 'race' || t === 'grand prix' || /^race\s+classification/.test(t);
}

function isSprintSessionTitle(title) {
  return /^sprint/i.test(String(title || ''));
}

function headerLower(headers) {
  return (headers || []).map((h) => String(h || '').trim().toLowerCase());
}

function colIndex(headers, ...names) {
  const lower = headerLower(headers);
  for (const n of names) {
    const key = String(n).toLowerCase();
    const i = lower.indexOf(key);
    if (i >= 0) return i;
  }
  for (const n of names) {
    const key = String(n).toLowerCase();
    for (let i = 0; i < lower.length; i++) {
      if (lower[i].includes(key)) return i;
    }
  }
  return -1;
}

function renameHeader(headers, fromNames, to) {
  const out = headers.slice();
  const idx = colIndex(out, ...fromNames);
  if (idx >= 0) out[idx] = to;
  return out;
}

function normalizeGridToSt(tbl) {
  if (!tbl || !Array.isArray(tbl.headers) || !Array.isArray(tbl.rows)) return tbl;
  const headers = tbl.headers.map((h) => String(h || '').trim());
  const lower = headerLower(headers);
  const gridIdx = lower.indexOf('grid');
  if (gridIdx < 0) return tbl;
  if (lower.indexOf('q1') >= 0 || lower.indexOf('final grid') >= 0 || lower.indexOf('sprint grid') >= 0) {
    return tbl;
  }
  if (lower[0] !== 'pos' && lower[0] !== 'pos.') return tbl;
  let isRace = false;
  for (const lh of lower) {
    if (
      lh === 'laps' ||
      lh.includes('time') ||
      lh.includes('laps led') ||
      lh === 'points' ||
      lh.includes('pts')
    ) {
      isRace = true;
      break;
    }
  }
  if (!isRace) return tbl;
  const newHeaders = headers.filter((_h, idx) => idx !== gridIdx);
  newHeaders.splice(1, 0, 'St');
  const rows = tbl.rows.map((row) => {
    if (!Array.isArray(row)) return row;
    const r = row.slice();
    const gridVal = gridIdx < r.length ? r[gridIdx] : '';
    r.splice(gridIdx, 1);
    r.splice(1, 0, gridVal);
    return r;
  });
  return { headers: newHeaders, rows };
}

function lapsLedFromRows(rows) {
  const byDriver = {};
  for (const row of rows || []) {
    const range = row[0] != null ? String(row[0]).trim() : '';
    const drv = row[1] != null ? String(row[1]).trim() : '';
    if (!drv || !range) continue;
    let count = 0;
    const m = range.match(/^(\d+)\s*[\u2013\u2014\-]\s*(\d+)$/);
    if (m) {
      const a = parseInt(m[1], 10);
      const b = parseInt(m[2], 10);
      if (!isNaN(a) && !isNaN(b) && b >= a) count = b - a + 1;
    } else if (/^\d+$/.test(range)) count = 1;
    if (count > 0) byDriver[drv] = (byDriver[drv] || 0) + count;
  }
  return byDriver;
}

function bestLapByCarFromRows(rows) {
  const byNo = {};
  for (const row of rows || []) {
    const no = row[1] != null ? String(row[1]).trim() : '';
    const time = row[6] != null ? String(row[6]).trim() : '';
    if (no && time) byNo[no] = time;
  }
  return byNo;
}

function looksLikeChassisCode(manu) {
  const s = String(manu || '').trim();
  if (!s) return false;
  if (/mercedes|ferrari|mclaren|alpine|williams|haas|sauber|bull|racing|aston/i.test(s)) return false;
  return true;
}

function normalizeQualifying(tables) {
  const q = tables.qualifying;
  if (!q || typeof q !== 'object') return;
  if (Array.isArray(q.sessions) && q.sessions.length > 0) return;
  if (!Array.isArray(q.headers) || !Array.isArray(q.rows)) return;
  const { headers, rows, meta, note, title } = q;
  tables.qualifying = {
    sessions: [
      {
        title: title && String(title).trim() ? String(title).trim() : 'Qualifying classification',
        headers,
        rows,
        ...(meta ? { meta } : {}),
        ...(note ? { note } : {}),
      },
    ],
  };
}

function collectLapsLed(tables, eventId, isSprint) {
  if (!isSprint) {
    const override = F1_LAPS_LED_OVERRIDES[String(eventId || '').toUpperCase()];
    if (override) return { ...override };
  }
  const key = isSprint ? 'laps_led_sprint' : 'laps_led';
  const block = tables[key];
  if (block && Array.isArray(block.rows) && block.rows.length > 0) {
    return lapsLedFromRows(block.rows);
  }
  return {};
}

function collectBestLaps(tables, isSprint) {
  const key = isSprint ? 'best_laps_sprint' : 'best_laps';
  const block = tables[key];
  if (block && Array.isArray(block.rows) && block.rows.length > 0) {
    return bestLapByCarFromRows(block.rows);
  }
  return {};
}

function headerAliases(canonical) {
  const c = String(canonical || '').toLowerCase();
  if (c === 'st') return ['st', 'grid'];
  if (c === 'constructor') return ['constructor', 'team'];
  if (c === 'time/retired') return ['time/retired', 'time / retired'];
  if (c === 'no.') return ['no.', 'no', '#', 'car'];
  if (c === 'points') return ['points', 'pts', 'pts.'];
  if (c === 'driver') return ['driver', 'drivers'];
  return [canonical];
}

function enrichToCanonicalRaceResults(tbl, tables, eventId, isSprint) {
  if (!tbl || !Array.isArray(tbl.headers) || !Array.isArray(tbl.rows)) return tbl;
  const working = normalizeGridToSt(tbl);
  const oldHeaders = working.headers.map((h) => String(h || '').trim());
  let headers = oldHeaders.slice();
  headers = renameHeader(headers, ['team'], 'Constructor');
  headers = renameHeader(headers, ['time / retired', 'time/retired'], 'Time/Retired');
  headers = renameHeader(headers, ['pts', 'pts.', 'points'], 'Points');
  headers = renameHeader(headers, ['no', '#'], 'No.');

  const lapsLedByDriver = collectLapsLed(tables, eventId, isSprint);
  const bestLapByNo = collectBestLaps(tables, isSprint);

  let hasLapsLed = colIndex(headers, 'laps led') >= 0;
  let hasBestLap = colIndex(headers, 'best lap') >= 0;
  let ptsIdx = colIndex(headers, 'points', 'pts', 'pts.');

  if (!hasLapsLed || !hasBestLap) {
    const next = [];
    for (let i = 0; i < headers.length; i++) {
      if (i === ptsIdx) {
        if (!hasLapsLed) next.push('Laps Led');
        if (!hasBestLap) next.push('Best Lap');
      }
      next.push(headers[i]);
    }
    if (ptsIdx < 0) {
      if (!hasLapsLed) next.push('Laps Led');
      if (!hasBestLap) next.push('Best Lap');
    }
    headers = next;
    hasLapsLed = colIndex(headers, 'laps led') >= 0;
    hasBestLap = colIndex(headers, 'best lap') >= 0;
    ptsIdx = colIndex(headers, 'points', 'pts', 'pts.');
  }

  const driverIdx = colIndex(oldHeaders, 'driver', 'drivers');
  const noIdx = colIndex(oldHeaders, 'no.', 'no', '#', 'car');
  const lapsIdx = colIndex(oldHeaders, 'laps');
  const posIdx = colIndex(oldHeaders, 'pos', 'pos.');

  const rows = working.rows.map((row) => {
    const r = row.slice();
    const out = new Array(headers.length);
    for (let hi = 0; hi < headers.length; hi++) {
      const canon = headers[hi];
      const lc = canon.toLowerCase();
      if (lc === 'laps led') {
        const drv = driverIdx >= 0 && driverIdx < r.length ? String(r[driverIdx]).trim() : '';
        const v = lapsLedByDriver[drv];
        out[hi] = v != null && String(v).trim() !== '' ? String(v) : '0';
        continue;
      }
      if (lc === 'best lap') {
        const no = noIdx >= 0 && noIdx < r.length ? String(r[noIdx]).trim() : '';
        const posRaw = posIdx >= 0 && posIdx < r.length ? String(r[posIdx]).trim() : '';
        const lapsRaw = lapsIdx >= 0 && lapsIdx < r.length ? String(r[lapsIdx]).trim() : '';
        const lapsNum = parseInt(lapsRaw, 10);
        let bestVal = bestLapByNo[no] || '';
        if (/^dns/i.test(posRaw) || lapsNum === 0) bestVal = '';
        out[hi] = bestVal;
        continue;
      }
      if (lc === 'points' || lc === 'pts' || lc === 'pts.') {
        const src = colIndex(oldHeaders, 'points', 'pts', 'pts.');
        let v = src >= 0 && src < r.length ? r[src] : '';
        if (v == null || String(v).trim() === '') v = '0';
        out[hi] = v;
        continue;
      }
      const src = colIndex(oldHeaders, ...headerAliases(canon));
      out[hi] = src >= 0 && src < r.length ? r[src] : '';
    }
    return out;
  });

  return { headers, rows, ...(tbl.intro ? { intro: tbl.intro } : {}) };
}

function splitRaceBlock(tables, eventId) {
  const race = tables.race;
  if (!race || typeof race !== 'object') return;

  if (Array.isArray(race.sessions) && race.sessions.length > 0) {
    const sprintSessions = [];
    let gpSession = null;
    for (const sess of race.sessions) {
      if (isSprintSessionTitle(sess.title)) sprintSessions.push(sess);
      else if (isGrandPrixSessionTitle(sess.title)) gpSession = sess;
      else if (!gpSession) gpSession = sess;
      else sprintSessions.push(sess);
    }
    if (gpSession && !tables.race_results) {
      tables.race_results = enrichToCanonicalRaceResults(
        { headers: gpSession.headers, rows: gpSession.rows },
        tables,
        eventId,
        false
      );
    }
    if (sprintSessions.length > 0) tables.race = { sessions: sprintSessions };
    else delete tables.race;
    return;
  }

  if (Array.isArray(race.headers) && Array.isArray(race.rows) && race.rows.length > 0 && !tables.race_results) {
    tables.race_results = enrichToCanonicalRaceResults(race, tables, eventId, false);
    delete tables.race;
  }
}

function normalizeRaceResultsInPlace(tables, eventId) {
  const rr = tables.race_results;
  if (!rr || !Array.isArray(rr.headers) || !Array.isArray(rr.rows)) return;
  const enriched = enrichToCanonicalRaceResults(rr, tables, eventId, false);
  tables.race_results = enriched;
}

function pruneEmptyRaceSessions(tables) {
  const race = tables.race;
  if (!race || !Array.isArray(race.sessions)) return;
  race.sessions = race.sessions.filter(
    (s) => s && Array.isArray(s.headers) && Array.isArray(s.rows) && s.rows.length > 0
  );
  if (race.sessions.length === 0) delete tables.race;
}

function normalizeEntryList(entryList, eventId) {
  if (!Array.isArray(entryList) || !/^F1_2025_/i.test(eventId)) return;
  for (const e of entryList) {
    if (!e || typeof e !== 'object') continue;
    const constructor = String(e.constructor || e.manufacturer || '').trim();
    const manu = String(e.manufacturer || '').trim();
    const label = constructor || manu;
    const chassis = F1_2025_CHASSIS_BY_LABEL[label] || F1_2025_CHASSIS_BY_LABEL[manu];
    if (!chassis) continue;
    if (!looksLikeChassisCode(manu)) {
      if (!e.constructor && label) e.constructor = label;
      e.manufacturer = chassis;
    }
  }
}

function normalizeYoutube(d) {
  if (!d || typeof d !== 'object') return;
  const id = d.youtube_id != null ? String(d.youtube_id).trim() : '';
  if (!id) return;
  if (!Array.isArray(d.youtube_highlights) || d.youtube_highlights.length === 0) {
    d.youtube_highlights = [{ id, title: 'Race Highlights' }];
  }
}

function normalizeEmptySkeleton(tables) {
  if (!tables.practice) tables.practice = { sessions: [] };
  if (!Array.isArray(tables.practice.sessions)) tables.practice = { sessions: [] };
  if (!tables.qualifying) tables.qualifying = { sessions: [] };
  if (!Array.isArray(tables.qualifying.sessions)) {
    normalizeQualifying(tables);
    if (!Array.isArray(tables.qualifying.sessions)) tables.qualifying = { sessions: [] };
  }
  pruneEmptyRaceSessions(tables);
}

/**
 * @param {object} d event JSON (mutated in place)
 * @returns {object} same reference
 */
export function normalizeF1EventTo2026Format(d) {
  if (!d || typeof d !== 'object' || !isF1EventId(d.event_id)) return d;
  if (!d.tables || typeof d.tables !== 'object') d.tables = {};

  normalizeQualifying(d.tables);
  splitRaceBlock(d.tables, d.event_id);
  normalizeRaceResultsInPlace(d.tables, d.event_id);
  pruneEmptyRaceSessions(d.tables);
  normalizeEmptySkeleton(d.tables);
  normalizeEntryList(d.entry_list, d.event_id);
  normalizeYoutube(d);
  return d;
}
