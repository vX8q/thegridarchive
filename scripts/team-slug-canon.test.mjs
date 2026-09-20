import test from 'node:test';
import assert from 'node:assert/strict';
import {
  f1TeamCoreName,
  foldF1TeamAlias,
  stripStockCarPartnership,
  provisionalOrgFromRaw,
  slugifyTeamName,
} from './lib/team-slug-canon.mjs';

test('F1 commercial names fold to entrant core', () => {
  assert.equal(foldF1TeamAlias('BWT Alpine F1 Team'), 'Alpine');
  assert.equal(foldF1TeamAlias('Alpine-Mercedes'), 'Alpine');
  assert.equal(f1TeamCoreName('Scuderia Ferrari HP'), 'Ferrari');
  assert.equal(f1TeamCoreName('Oracle Red Bull Racing'), 'Red Bull Racing');
  assert.equal(slugifyTeamName(f1TeamCoreName('Mercedes-AMG Petronas F1 Team')), 'mercedes');
});

test('stock-car partnership strip', () => {
  assert.equal(
    stripStockCarPartnership('Joey Gase Motorsports with Scott Osteen'),
    'Joey Gase Motorsports'
  );
});

test('provisional org maps raw entry strings onto stable fold keys', () => {
  const a = provisionalOrgFromRaw('F1', 'BWT Alpine F1 Team', 'Alpine-Mercedes');
  const b = provisionalOrgFromRaw('F1', '', 'Alpine-Renault');
  assert.equal(a.slug, 'alpine');
  assert.equal(b.slug, 'alpine');
  assert.equal(a.foldKey, b.foldKey);

  const jr = provisionalOrgFromRaw('NASCAR Cup Series', 'JR Motorsports', '');
  const jrX = provisionalOrgFromRaw('NASCAR Xfinity Series', 'JR Motorsports', '');
  assert.equal(jr.foldKey, jrX.foldKey);
  assert.equal(jr.slug, 'jr-motorsports');
});
