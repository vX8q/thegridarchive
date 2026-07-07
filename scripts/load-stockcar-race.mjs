import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadStockcarRaceApi() {
  const window = { TGA: {}, console };
  const src = fs.readFileSync(path.join(root, 'web', 'lib', 'stockcar-race.js'), 'utf8');
  vm.runInNewContext(src, { window, console });
  return window.TGA;
}
