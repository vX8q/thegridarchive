#!/usr/bin/env node
/**
 * Load web/lib/schedule-location.js helpers in Node for tests and audit scripts.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function createScheduleLocationApi() {
  const TGA = {
    isStockCarSeriesId(id) {
      return (TGA.STOCK_CAR_SERIES_IDS || []).indexOf(String(id || '').toLowerCase()) >= 0;
    },
  };

  const sandbox = vm.createContext({
    window: { TGA },
    console,
  });

  vm.runInContext(
    fs.readFileSync(path.join(root, 'web', 'lib', 'schedule-location.js'), 'utf8'),
    sandbox
  );

  return sandbox.window.TGA;
}

/**
 * Same display logic as web/components/schedule.js formatScheduleLocation (EN, no i18n).
 */
export function formatScheduleLocationPlain(e, TGA) {
  const circuitRaw = String((e.circuit_name || e.track) || '').trim();
  const locRaw = String(e.location || '').trim();
  const seriesSlug = String(e._seriesId || e.series_id || '').toLowerCase();
  const isStockCar = TGA.isStockCarSeriesId(seriesSlug);

  let circuit = circuitRaw;
  if (isStockCar && TGA.stockCarDisplayTrack) {
    circuit = TGA.stockCarDisplayTrack(circuitRaw, locRaw);
  }
  if (circuit) return circuit;
  if (locRaw) return locRaw;
  return '—';
}
