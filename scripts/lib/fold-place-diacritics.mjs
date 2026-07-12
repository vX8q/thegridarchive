/**
 * Shared place-name diacritic folding (tests + optional data cleanup).
 */

const FOLD_PAIRS = [
  ['ü', 'u'], ['Ü', 'U'], ['é', 'e'], ['É', 'e'], ['á', 'a'], ['Á', 'a'],
  ['í', 'i'], ['Í', 'i'], ['ó', 'o'], ['Ó', 'o'], ['ú', 'u'], ['Ú', 'u'],
  ['ñ', 'n'], ['Ñ', 'n'], ['ä', 'a'], ['Ä', 'a'], ['ö', 'o'], ['Ö', 'o'],
  ['ß', 'ss'], ['ø', 'o'], ['Ø', 'o'], ['å', 'a'], ['Å', 'a'],
  ['æ', 'ae'], ['Æ', 'ae'], ['ç', 'c'], ['Ç', 'c'],
  ['è', 'e'], ['È', 'e'], ['ê', 'e'], ['Ê', 'e'], ['ë', 'e'], ['Ë', 'e'],
  ['ì', 'i'], ['Ì', 'i'], ['î', 'i'], ['Î', 'i'], ['ï', 'i'], ['Ï', 'i'],
  ['ò', 'o'], ['Ò', 'o'], ['ô', 'o'], ['Ô', 'o'], ['ù', 'u'], ['Ù', 'u'],
  ['û', 'u'], ['Û', 'u'], ['ý', 'y'], ['Ý', 'y'], ['ÿ', 'y'],
  ['ã', 'a'], ['Ã', 'A'], ['õ', 'o'], ['Õ', 'O'],
  ['ō', 'o'], ['Ō', 'O'], ['ā', 'a'], ['Ā', 'A'],
];

export function foldPlace(value) {
  if (typeof value !== 'string' || !/[^\x00-\x7F]/.test(value)) return value;
  let out = value;
  for (const [from, to] of FOLD_PAIRS) {
    if (out.includes(from)) out = out.split(from).join(to);
  }
  return out.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export const PLACE_KEYS = new Set(['location', 'circuit_name', 'track']);

const SCHEDULE_NAME = /^data[\\/]schedules[\\/]/;
const EVENT_RACE = /^data[\\/]events[\\/]/;

export function shouldFoldName(key, filePath, value) {
  if (key !== 'name' && key !== 'race') return false;
  if (key === 'name' && !SCHEDULE_NAME.test(filePath)) return false;
  if (key === 'race' && !EVENT_RACE.test(filePath)) return false;
  if (!/[^\x00-\x7F]/.test(value)) return false;
  return /(s[aã]o paulo|portim[aã]o|taup[oō]|n[uü]rburgring|aut[oó]dromo|w[uü]rth)/i.test(value);
}

export function walkObject(obj, filePath, changes) {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    obj.forEach((item) => walkObject(item, filePath, changes));
    return;
  }
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'string') {
      let fold = false;
      if (PLACE_KEYS.has(key)) fold = true;
      else if (shouldFoldName(key, filePath, val)) fold = true;
      if (fold && val !== foldPlace(val)) {
        changes.push({ key, before: val, after: foldPlace(val) });
        obj[key] = foldPlace(val);
      }
    } else if (typeof val === 'object') {
      walkObject(val, filePath, changes);
    }
  }
}
