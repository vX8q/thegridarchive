#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function loadRenderModules() {
  const window = { TGA: {}, console };
  const libs = [
    'openwheel-race.js',
    'touring-race.js',
    'stockcar-race.js',
  ];
  for (const file of libs) {
    const src = fs.readFileSync(path.join(root, 'web', 'lib', file), 'utf8');
    vm.runInNewContext(src, { window, console });
  }
  return window.TGA;
}
