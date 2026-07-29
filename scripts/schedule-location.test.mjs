#!/usr/bin/env node
/**
 * Unit tests for schedule venue/location helpers (legacy vs migrated stockcar).
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  createScheduleLocationApi,
  formatScheduleLocationPlain,
} from './lib/load-schedule-location.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function test(name, fn) {
  fn();
  console.log('ok', name);
}

const TGA = createScheduleLocationApi();

test('isStockCarLegacyCombinedCircuit: duplicate full line', () => {
  const line = 'EchoPark Speedway, Hampton, Georgia';
  assert.strictEqual(TGA.isStockCarLegacyCombinedCircuit(line, line), true);
});

test('isStockCarLegacyCombinedCircuit: location matches geo tail', () => {
  assert.strictEqual(
    TGA.isStockCarLegacyCombinedCircuit(
      'EchoPark Speedway, Hampton, Georgia',
      'Hampton, Georgia'
    ),
    true
  );
});

test('isStockCarLegacyCombinedCircuit: migrated row is not legacy', () => {
  assert.strictEqual(
    TGA.isStockCarLegacyCombinedCircuit(
      'North Wilkesboro Speedway',
      'North Wilkesboro, North Carolina'
    ),
    false
  );
});

test('isStockCarLegacyCombinedCircuit: layout suffix without comma is not legacy', () => {
  assert.strictEqual(
    TGA.isStockCarLegacyCombinedCircuit(
      'Charlotte Motor Speedway Roval',
      'Concord, North Carolina'
    ),
    false
  );
});

test('isStockCarLegacyCombinedCircuit: road course layout suffix is not legacy', () => {
  assert.strictEqual(
    TGA.isStockCarLegacyCombinedCircuit(
      'Daytona International Speedway Road Course',
      'Daytona Beach, Florida'
    ),
    false
  );
  assert.strictEqual(
    TGA.isStockCarLegacyCombinedCircuit(
      'Charlotte Motor Speedway Roval',
      'Concord, North Carolina'
    ),
    false
  );
});

test('stockCarDisplayTrack: layout names pass through unchanged', () => {
  assert.strictEqual(
    TGA.stockCarDisplayTrack('Daytona International Speedway Road Course', 'Daytona Beach, Florida'),
    'Daytona International Speedway Road Course'
  );
  assert.strictEqual(
    TGA.stockCarDisplayLocation('Daytona International Speedway Road Course', 'Daytona Beach, Florida'),
    'Daytona Beach, Florida'
  );
});

test('geoReviewWarnings flags missing state and ambiguous cities', async () => {
  const { geoReviewWarnings, AMBIGUOUS_GEO_CITIES } = await import('./lib/schedule-location-audit.mjs');
  assert.ok(AMBIGUOUS_GEO_CITIES.includes('portland'));
  const portland = geoReviewWarnings('Portland, Oregon');
  assert.ok(portland.some((w) => w.code === 'ambiguous_city'));
  const bare = geoReviewWarnings('Sao Paulo');
  assert.ok(bare.some((w) => w.code === 'missing_state_region'));
  const clear = geoReviewWarnings('Hampton, Georgia');
  assert.strictEqual(clear.length, 0);
});

test('collectDualMigrationPairs links schedule and event rows by id', async () => {
  const { collectDualMigrationPairs } = await import('./lib/schedule-location-audit.mjs');
  const pairs = collectDualMigrationPairs(
    [{
      id: 'NASCAR_CUP_2026_20',
      source: 'data/schedules/nascar_cup.json',
      circuit: 'EchoPark Speedway, Hampton, Georgia',
      location: 'EchoPark Speedway, Hampton, Georgia',
      issues: [{ code: 'legacy_combined' }],
    }],
    [{
      id: 'NASCAR_CUP_2026_20',
      source: 'data/events/NASCAR Cup Series/2026/nascar_cup_2026_20.json',
      circuit: 'EchoPark Speedway',
      location: 'EchoPark Speedway, Hampton, Georgia',
      issues: [{ code: 'location_has_venue_keyword' }],
    }]
  );
  assert.strictEqual(pairs.length, 1);
  assert.strictEqual(pairs[0].id, 'NASCAR_CUP_2026_20');
  assert.ok(pairs[0].event_issues.includes('location_has_venue_keyword'));
});

test('SCHEDULE_LOCATION_MANUAL_REVIEW entries include reason', async () => {
  const { SCHEDULE_LOCATION_MANUAL_REVIEW } = await import('./lib/schedule-location-audit.mjs');
  for (const entry of Object.values(SCHEDULE_LOCATION_MANUAL_REVIEW)) {
    assert.ok(entry.reason && entry.track && entry.location);
  }
});

test('stockCarDisplayTrack: legacy splits; migrated no-op', () => {
  assert.strictEqual(
    TGA.stockCarDisplayTrack('EchoPark Speedway, Hampton, Georgia', 'EchoPark Speedway, Hampton, Georgia'),
    'EchoPark Speedway'
  );
  assert.strictEqual(
    TGA.stockCarDisplayTrack('North Wilkesboro Speedway', 'North Wilkesboro, North Carolina'),
    'North Wilkesboro Speedway'
  );
  assert.strictEqual(
    TGA.stockCarDisplayTrack('Charlotte Motor Speedway Roval', 'Concord, North Carolina'),
    'Charlotte Motor Speedway Roval'
  );
});

test('stockCarDisplayLocation: legacy vs migrated', () => {
  assert.strictEqual(
    TGA.stockCarDisplayLocation('EchoPark Speedway, Hampton, Georgia', 'EchoPark Speedway, Hampton, Georgia'),
    'Hampton, Georgia'
  );
  assert.strictEqual(
    TGA.stockCarDisplayLocation('North Wilkesboro Speedway', 'North Wilkesboro, North Carolina'),
    'North Wilkesboro, North Carolina'
  );
});

test('formatScheduleLocationPlain: same nascar_cup row before/after migration shape', () => {
  const legacy = {
    series_id: 'NASCAR_CUP',
    circuit_name: 'EchoPark Speedway, Hampton, Georgia',
    location: 'EchoPark Speedway, Hampton, Georgia',
  };
  const migrated = {
    series_id: 'NASCAR_CUP',
    circuit_name: 'EchoPark Speedway',
    location: 'Hampton, Georgia',
  };
  assert.strictEqual(formatScheduleLocationPlain(legacy, TGA), 'EchoPark Speedway');
  assert.strictEqual(formatScheduleLocationPlain(migrated, TGA), 'EchoPark Speedway');
});

test('formatScheduleLocationPlain: real schedule file legacy entry', () => {
  const cup = JSON.parse(fs.readFileSync(path.join(root, 'data/schedules/nascar_cup.json'), 'utf8'));
  const row = cup.find((e) => e.id === 'NASCAR_CUP_2026_20');
  assert.ok(row);
  assert.strictEqual(formatScheduleLocationPlain(row, TGA), 'EchoPark Speedway');
});

test('locationLooksLikeVenueName flags venue tokens in location', () => {
  assert.strictEqual(TGA.locationLooksLikeVenueName('Hampton, Georgia'), false);
  assert.strictEqual(TGA.locationLooksLikeVenueName('North Wilkesboro, North Carolina'), false);
  assert.strictEqual(TGA.locationLooksLikeVenueName('Speedway, Indiana'), false);
  assert.strictEqual(TGA.locationLooksLikeVenueName('EchoPark Speedway, Hampton, Georgia'), true);
  assert.strictEqual(TGA.locationLooksLikeVenueName('Bowmanville, Ontario'), false);
});

console.log('\nAll schedule-location tests passed.');
