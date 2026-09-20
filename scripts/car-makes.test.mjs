#!/usr/bin/env node
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import {
  CANONICAL_CAR_MAKES,
  CAR_MAKE_ALIASES,
  canonicalCarMake,
} from './lib/car-makes.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function test(name, fn) {
  fn();
  console.log('ok', name);
}

// The browser keeps its own copy of the map as a fallback for freshly pasted
// event JSON. If the two drift, a table can render a spelling the audit thinks
// is already canonical.
function loadBrowserFormatter() {
  const src = fs.readFileSync(
    path.join(root, 'web', 'lib', 'event-race-content.js'),
    'utf8',
  );
  const sandbox = { window: {}, document: undefined, console };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  const fn = sandbox.window.TGA && sandbox.window.TGA.formatElmsCarMake;
  assert.strictEqual(typeof fn, 'function', 'window.TGA.formatElmsCarMake missing');
  return fn;
}

test('canonical spelling is a fixed point', () => {
  for (const name of CANONICAL_CAR_MAKES) {
    assert.strictEqual(canonicalCarMake(name), name);
  }
});

test('shouted and aliased makes resolve', () => {
  assert.strictEqual(canonicalCarMake('ASTON MARTIN'), 'Aston Martin');
  assert.strictEqual(canonicalCarMake('  oreca '), 'Oreca');
  assert.strictEqual(canonicalCarMake('McLAREN'), 'McLaren');
  assert.strictEqual(canonicalCarMake('CORVETTE'), 'Chevrolet');
  assert.strictEqual(canonicalCarMake('MERCEDES'), 'Mercedes-AMG');
});

test('model designations stay unknown', () => {
  assert.strictEqual(canonicalCarMake('BMW M4 GT3 EVO'), null);
  assert.strictEqual(canonicalCarMake(''), null);
  assert.strictEqual(canonicalCarMake(null), null);
});

test('browser fallback agrees with the canonical map', () => {
  const format = loadBrowserFormatter();
  const inputs = [
    ...CANONICAL_CAR_MAKES,
    ...CANONICAL_CAR_MAKES.map((n) => n.toUpperCase()),
    ...Object.keys(CAR_MAKE_ALIASES),
  ];
  for (const input of inputs) {
    const expected = canonicalCarMake(input);
    if (expected == null) continue;
    assert.strictEqual(
      format(input),
      expected,
      `web formatElmsCarMake(${JSON.stringify(input)}) != ${expected}`,
    );
  }
});

console.log('All car-makes tests passed.');
