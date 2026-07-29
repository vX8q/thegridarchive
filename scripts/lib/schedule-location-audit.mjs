/**
 * Audit helpers for stockcar venue/location migration (Node only).
 */

/**
 * Manual overrides — comma in track name or ambiguous split.
 * @type {Readonly<Record<string, { reason: string, track: string, location: string }>>}
 */
export const SCHEDULE_LOCATION_MANUAL_REVIEW = Object.freeze({
  // 'Some Sponsor, LLC Speedway, City, State': {
  //   reason: 'comma in official track name — do not auto-split on first comma',
  //   track: 'Some Sponsor, LLC Speedway',
  //   location: 'City, State',
  // },
});

/** City names that exist in multiple states/countries — flag during manual review. */
export const AMBIGUOUS_GEO_CITIES = Object.freeze([
  'portland',
  'kansas city',
  'bristol',
  'rochester',
  'springfield',
  'arlington',
  'richmond',
  'lexington',
  'dover',
  'burlington',
  'manchester',
  'salem',
  'washington',
  'jackson',
  'madison',
  'franklin',
  'georgetown',
  'hamilton',
  'milton',
  'auburn',
]);

const AMBIGUOUS_GEO_SET = new Set(AMBIGUOUS_GEO_CITIES);

/**
 * @param {string} location
 * @returns {{ code: string, message: string }[]}
 */
export function geoReviewWarnings(location) {
  const loc = String(location || '').trim();
  const warnings = [];
  if (!loc) return warnings;

  if (!loc.includes(', ')) {
    warnings.push({
      code: 'missing_state_region',
      message: 'location has no ", State/Province/Region" — add geography for non-US series',
    });
  }

  const city = loc.split(', ')[0].trim().toLowerCase();
  if (AMBIGUOUS_GEO_SET.has(city)) {
    warnings.push({
      code: 'ambiguous_city',
      message: `city "${loc.split(', ')[0].trim()}" exists in multiple regions — confirm state/province in review`,
    });
  }

  return warnings;
}

/**
 * @param {string} circuit
 * @returns {{ reason: string, track: string, location: string } | null}
 */
export function manualReviewEntry(circuit) {
  return SCHEDULE_LOCATION_MANUAL_REVIEW[String(circuit || '').trim()] || null;
}

/**
 * @param {{ id?: string, event_id?: string }} row
 * @returns {string}
 */
export function normalizeStockcarEventId(row) {
  return String(row?.id || row?.event_id || '').trim().toUpperCase();
}

/**
 * Pair schedule + event rows that share an id and both need migration.
 * @param {object[]} scheduleFindings
 * @param {object[]} eventFindings
 */
export function collectDualMigrationPairs(scheduleFindings, eventFindings) {
  const scheduleById = new Map();
  for (const f of scheduleFindings) {
    const id = normalizeStockcarEventId(f);
    if (!id) continue;
    scheduleById.set(id, f);
  }

  const pairs = [];
  for (const f of eventFindings) {
    const id = normalizeStockcarEventId(f);
    const sched = scheduleById.get(id);
    if (!sched) continue;
    pairs.push({
      id,
      schedule_source: sched.source,
      event_source: f.source,
      schedule_circuit: sched.circuit,
      schedule_location: sched.location,
      event_track: f.circuit,
      event_location: f.location,
      schedule_issues: sched.issues.map((i) => i.code),
      event_issues: f.issues.map((i) => i.code),
    });
  }
  return pairs.sort((a, b) => a.id.localeCompare(b.id));
}
