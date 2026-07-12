#!/usr/bin/env node
import assert from 'assert';
import { foldPlace, walkObject, shouldFoldName } from './lib/fold-place-diacritics.mjs';

function test(name, fn) {
  try {
    fn();
    console.log('ok', name);
  } catch (err) {
    console.error('FAIL', name);
    throw err;
  }
}

test('foldPlace: São Paulo → Sao Paulo', () => {
  assert.strictEqual(foldPlace('São Paulo'), 'Sao Paulo');
});

test('foldPlace: Portimão and Nürburgring', () => {
  assert.strictEqual(foldPlace('Portimão'), 'Portimao');
  assert.strictEqual(foldPlace('Nürburgring'), 'Nurburgring');
});

test('walkObject folds location but not event_preview', () => {
  const obj = {
    location: 'São Paulo',
    circuit_name: 'Autódromo José Carlos Pace',
    event_preview: 'São Paulo hosts the 6 Hours with Portimão-style drama.',
    event_preview_ru: 'В São Paulo проходит гонка.',
  };
  const changes = [];
  walkObject(obj, 'data/schedules/wec.json', changes);
  assert.strictEqual(obj.location, 'Sao Paulo');
  assert.strictEqual(obj.circuit_name, 'Autodromo Jose Carlos Pace');
  assert.strictEqual(obj.event_preview, 'São Paulo hosts the 6 Hours with Portimão-style drama.');
  assert.strictEqual(obj.event_preview_ru, 'В São Paulo проходит гонка.');
  assert.ok(changes.some((c) => c.key === 'location'));
  assert.ok(!changes.some((c) => c.key === 'event_preview'));
});

test('shouldFoldName matches schedule race titles with place names', () => {
  assert.strictEqual(
    shouldFoldName('name', 'data/schedules/wec.json', 'ROLEX 6 Hours of São Paulo'),
    true,
  );
  assert.strictEqual(
    shouldFoldName('name', 'data/events/F1/2026/f1_2026_1.json', 'British Grand Prix'),
    false,
  );
});

console.log('All strip-place-diacritics tests passed.');
