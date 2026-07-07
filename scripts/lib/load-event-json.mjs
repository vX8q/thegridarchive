#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const eventsRoot = path.join(root, 'data', 'events');

const cache = new Map();

function walkJsonFiles(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walkJsonFiles(full, out);
    else if (name.endsWith('.json')) out.push(full);
  }
}

function buildIndex() {
  const files = [];
  walkJsonFiles(eventsRoot, files);
  for (const file of files) {
    try {
      let raw = fs.readFileSync(file, 'utf8');
      if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
      const data = JSON.parse(raw);
      const id = String(data.event_id || '').toUpperCase();
      if (id) cache.set(id, data);
    } catch {
      /* skip invalid */
    }
  }
}

export function loadEventJson(eventId) {
  if (cache.size === 0) buildIndex();
  return cache.get(String(eventId || '').toUpperCase()) || null;
}
