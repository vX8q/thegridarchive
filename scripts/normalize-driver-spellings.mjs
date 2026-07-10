#!/usr/bin/env node
/**
 * Normalize driver name spellings across event JSON, teams, and profiles.
 * Run from repo root: node scripts/normalize-driver-spellings.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Full-name replacements (longer strings first). */
const REPLACEMENTS = [
  ['Sebastian alvarez', 'Sebastián Álvarez'],
  ['Sebastian Alvarez', 'Sebastián Álvarez'],
  ['alex Palou', 'Alex Palou'],
  ['Blake Mcdonald', 'Blake McDonald'],
  ['Manuel Espirito Santo', 'Manuel Espírito Santo'],
  ['Joshua Durksen', 'Joshua Dürksen'],
  ['Rafael Villagomez', 'Rafael Villagómez'],
  ['Gabriele Mini', 'Gabriele Minì'],
  ['Sebastian Montoya', 'Sebastián Montoya'],
  ['Theophile Nael', 'Théophile Naël'],
  ['Noah Stromsted', 'Noah Strømsted'],
  ['Maciej Gladysz', 'Maciej Gładysz'],
  ['Jose Garfias', 'José Garfias'],
  ['Giacomo Altoe', 'Giacomo Altoè'],
  ['Tobias Lutke', 'Tobias Lütke'],
  ['Salih Yoluc', 'Salih Yoluç'],
  ['Alfredo Hernandez', 'Alfredo Hernández'],
  ['Daniel Suarez', 'Daniel Suárez'],
  ['Andres Perez de Lara', 'Andrés Pérez de Lara'],
  ['Andrija Kostic', 'Andrija Kostić'],
  ['Ayhancan Guven', 'Ayhancan Güven'],
  ['Ben Dorr', 'Ben Dörr'],
  ['Cesar Gazeau', 'César Gazeau'],
  ['Frederic Makowiecki', 'Frédéric Makowiecki'],
  ['Marco Sorensen', 'Marco Sørensen'],
  ['Marvin Kirchhofer', 'Marvin Kirchhöfer'],
  ['Maximilian Gotz', 'Maximilian Götz'],
  ['Mikael Grenier', 'Mikaël Grenier'],
  ['Noel Leon', 'Noel León'],
  ['Rafael Duran', 'Rafael Durán'],
  ['Sebastien Baud', 'Sébastien Baud'],
  ['Sven Muller', 'Sven Müller'],
  ['Andrea Dupe', 'Andrea Dupé'],
  ['Tomass stolcermanis', 'Tomass Štolcermanis'],
  ['Tomass Stolcermanis', 'Tomass Štolcermanis'],
  ['Alex Labbe', 'Alex Labbé'],
  ['Marcus Sæter', 'Marcus Saeter'],
  ['Dominik simek', 'Dominik Simek'],
  ['Dean Macdonald', 'Dean MacDonald'],
  ['etienne Cheli', 'Étienne Cheli'],
  ['Jakub smiechowski', 'Jakub Smiechowski'],
  ['Pj Hyett', 'PJ Hyett'],
  ['P. J. Hyett', 'PJ Hyett'],
  ['Valentin Hasse Clot', 'Valentin Hasse-Clot'],
  ['Jonathan McKennedy', 'Jon McKennedy'],
  ['David Sapienza', 'Dave Sapienza'],
];

function applyReplacements(text) {
  let out = text;
  for (const [from, to] of REPLACEMENTS) {
    if (out.includes(from)) {
      out = out.split(from).join(to);
    }
  }
  return out;
}

function walkJsonFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkJsonFiles(p, out);
    else if (ent.name.endsWith('.json')) out.push(p);
  }
  return out;
}

const targets = [
  path.join(root, 'data', 'events'),
  path.join(root, 'data', 'teams'),
  path.join(root, 'data', 'driver_profiles.json'),
];

let changed = 0;
for (const base of targets) {
  const files = fs.statSync(base).isDirectory() ? walkJsonFiles(base) : [base];
  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8');
    const next = applyReplacements(raw);
    if (next !== raw) {
      fs.writeFileSync(file, next, 'utf8');
      changed++;
      console.log('updated', path.relative(root, file));
    }
  }
}
console.log(`Done. ${changed} file(s) updated.`);
