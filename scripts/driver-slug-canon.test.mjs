#!/usr/bin/env node
import assert from 'assert';
import {
  canonicalizeDriverSlug,
  slugifyDriverName,
} from './lib/driver-slug-canon.mjs';

function test(name, fn) {
  fn();
  console.log('ok', name);
}

test('slugify matches Go fold for Câmara / ø', () => {
  assert.strictEqual(slugifyDriverName('Rafael Câmara'), 'rafael-camara');
  assert.strictEqual(slugifyDriverName('Noah Strømsted'), 'noah-stromsted');
  assert.strictEqual(slugifyDriverName('Maciej Gładysz'), 'maciej-gladysz');
});

test('canonicalize nickname aliases', () => {
  assert.strictEqual(canonicalizeDriverSlug('matt-payne'), 'matthew-payne');
  assert.strictEqual(canonicalizeDriverSlug('nicolas-varrone'), 'nico-varrone');
  assert.strictEqual(canonicalizeDriverSlug('Cam Waters'), 'cameron-waters');
  assert.strictEqual(canonicalizeDriverSlug('giovanni-ruggiero'), 'gio-ruggiero');
});

test('canonicalize is idempotent on canon', () => {
  assert.strictEqual(canonicalizeDriverSlug('matthew-payne'), 'matthew-payne');
  assert.strictEqual(canonicalizeDriverSlug('nico-varrone'), 'nico-varrone');
});

console.log('All driver-slug-canon tests passed.');
