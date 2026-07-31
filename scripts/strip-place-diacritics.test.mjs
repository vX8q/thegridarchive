#!/usr/bin/env node
import assert from 'assert';
import {
  foldLatin,
  foldPlace,
  walkObject,
  walkAllStrings,
  shouldFoldName,
} from './lib/fold-place-diacritics.mjs';

function test(name, fn) {
  try {
    fn();
    console.log('ok', name);
  } catch (err) {
    console.error('FAIL', name);
    throw err;
  }
}

test('foldLatin: São Paulo → Sao Paulo', () => {
  assert.strictEqual(foldLatin('São Paulo'), 'Sao Paulo');
  assert.strictEqual(foldPlace('São Paulo'), 'Sao Paulo');
});

test('foldLatin: Portimão and Nürburgring', () => {
  assert.strictEqual(foldLatin('Portimão'), 'Portimao');
  assert.strictEqual(foldLatin('Nürburgring'), 'Nurburgring');
});

test('foldLatin: preserves Cyrillic ё', () => {
  assert.strictEqual(foldLatin('четвёртый'), 'четвёртый');
  assert.strictEqual(
    foldLatin('Rolex 6 Hours of São Paulo — четвёртый этап'),
    'Rolex 6 Hours of Sao Paulo — четвёртый этап',
  );
});

test('foldLatin: driver names', () => {
  assert.strictEqual(foldLatin('Niccolò Maccagnani'), 'Niccolo Maccagnani');
  assert.strictEqual(foldLatin('José María López'), 'Jose Maria Lopez');
  assert.strictEqual(foldLatin('Petru Umbrărescu'), 'Petru Umbrarescu');
  assert.strictEqual(foldLatin('Rafael Câmara'), 'Rafael Camara');
  assert.strictEqual(foldLatin('Noel León'), 'Noel Leon');
  assert.strictEqual(foldLatin('Gabriele Minì'), 'Gabriele Mini');
});

test('walkObject folds places and previews', () => {
  const obj = {
    location: 'São Paulo',
    circuit_name: 'Autódromo José Carlos Pace',
    event_preview: 'São Paulo hosts the 6 Hours with Portimão-style drama.',
    event_preview_ru: 'В São Paulo проходит четвёртый этап.',
  };
  const changes = [];
  walkObject(obj, 'data/events/WEC/2026/wec_2026_4.json', changes);
  assert.strictEqual(obj.location, 'Sao Paulo');
  assert.strictEqual(obj.circuit_name, 'Autodromo Jose Carlos Pace');
  assert.strictEqual(obj.event_preview, 'Sao Paulo hosts the 6 Hours with Portimao-style drama.');
  assert.strictEqual(obj.event_preview_ru, 'В Sao Paulo проходит четвёртый этап.');
  assert.ok(changes.some((c) => c.key === 'event_preview'));
});

test('walkAllStrings folds nested driver cells', () => {
  const obj = {
    entry_list: [{ driver: 'Ben Dörr', team: 'Team' }],
    tables: { race: { rows: [['1', 'José María López']] } },
  };
  const changes = [];
  walkAllStrings(obj, changes);
  assert.strictEqual(obj.entry_list[0].driver, 'Ben Dorr');
  assert.strictEqual(obj.tables.race.rows[0][1], 'Jose Maria Lopez');
  assert.ok(changes.length >= 2);
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
