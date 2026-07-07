/**
 * Re-exports stock-car plan helpers from web/lib/stockcar-race.js (single source of truth).
 */
import { loadStockcarRaceApi } from './load-stockcar-race.mjs';

const TGA = loadStockcarRaceApi();

export const stageTable = TGA.tgaStageTable;
export const hasStageTableRows = TGA.hasStageTableRows;
export const stockCarHasStageFormat = TGA.stockCarHasStageFormat;
export const hasStage4 = TGA.hasStage4;
export const isAllstarStageRace = TGA.isAllstarStageRace;
export const stockCarRaceSectionPlan = TGA.stockCarRaceSectionPlan;
