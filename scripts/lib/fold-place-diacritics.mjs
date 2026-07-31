/**
 * Latin diacritic folding for TGA data (places, previews, driver names, …).
 * Preserves Cyrillic (including ё). Aligns with web/tga-utils.js foldDiacritics pairs.
 */

const FOLD_PAIRS = [
  ['ü', 'u'], ['Ü', 'U'], ['é', 'e'], ['É', 'E'], ['á', 'a'], ['Á', 'A'],
  ['í', 'i'], ['Í', 'I'], ['ó', 'o'], ['Ó', 'O'], ['ú', 'u'], ['Ú', 'U'],
  ['ñ', 'n'], ['Ñ', 'N'], ['ä', 'a'], ['Ä', 'A'], ['ö', 'o'], ['Ö', 'O'],
  ['ß', 'ss'], ['ø', 'o'], ['Ø', 'O'], ['å', 'a'], ['Å', 'A'],
  ['æ', 'ae'], ['Æ', 'AE'], ['ç', 'c'], ['Ç', 'C'],
  ['è', 'e'], ['È', 'E'], ['ê', 'e'], ['Ê', 'E'], ['ë', 'e'], ['Ë', 'E'],
  ['ì', 'i'], ['Ì', 'I'], ['î', 'i'], ['Î', 'I'], ['ï', 'i'], ['Ï', 'I'],
  ['ò', 'o'], ['Ò', 'O'], ['ô', 'o'], ['Ô', 'O'], ['ù', 'u'], ['Ù', 'U'],
  ['û', 'u'], ['Û', 'U'], ['ý', 'y'], ['Ý', 'Y'], ['ÿ', 'y'],
  ['ž', 'z'], ['Ž', 'Z'], ['š', 's'], ['Š', 'S'], ['č', 'c'], ['Č', 'C'],
  ['ř', 'r'], ['Ř', 'R'], ['ď', 'd'], ['Ď', 'D'], ['ť', 't'], ['Ť', 'T'],
  ['ň', 'n'], ['Ň', 'N'], ['ł', 'l'], ['Ł', 'L'], ['ą', 'a'], ['Ą', 'A'],
  ['ę', 'e'], ['Ę', 'E'], ['ś', 's'], ['Ś', 'S'], ['ź', 'z'], ['Ź', 'Z'],
  ['ż', 'z'], ['Ż', 'Z'], ['ć', 'c'], ['Ć', 'C'], ['ő', 'o'], ['Ő', 'O'],
  ['ű', 'u'], ['Ű', 'U'], ['à', 'a'], ['À', 'A'], ['â', 'a'], ['Â', 'A'],
  ['ã', 'a'], ['Ã', 'A'], ['õ', 'o'], ['Õ', 'O'], ['ð', 'd'], ['Ð', 'D'],
  ['þ', 'th'], ['Þ', 'Th'], ['đ', 'd'], ['Đ', 'D'], ['ħ', 'h'], ['Ħ', 'H'],
  ['ı', 'i'], ['İ', 'I'],
  ['ă', 'a'], ['Ă', 'A'], ['ș', 's'], ['Ș', 'S'], ['ț', 't'], ['Ț', 'T'],
  ['ō', 'o'], ['Ō', 'O'], ['ā', 'a'], ['Ā', 'A'],
  // Case variants used by older place fold (lowercase É→e etc. kept for place titles)
];

function isCyrillic(ch) {
  const o = ch.codePointAt(0);
  return o >= 0x0400 && o <= 0x04FF;
}

/** Fold Latin diacritics → ASCII; leave Cyrillic untouched (ё stays ё). */
export function foldLatin(value) {
  if (typeof value !== 'string' || !/[^\x00-\x7F]/.test(value)) return value;
  let out = value;
  for (const [from, to] of FOLD_PAIRS) {
    if (out.includes(from)) out = out.split(from).join(to);
  }
  // NFD strip combining marks, but never rewrite Cyrillic code points
  let result = '';
  for (const ch of out) {
    if (isCyrillic(ch)) {
      result += ch;
      continue;
    }
    const nfd = ch.normalize('NFD');
    for (const c of nfd) {
      const cp = c.codePointAt(0);
      if (cp >= 0x0300 && cp <= 0x036f) continue;
      result += c;
    }
  }
  return result;
}

/** @deprecated alias — same as foldLatin */
export function foldPlace(value) {
  return foldLatin(value);
}

export const PLACE_KEYS = new Set(['location', 'circuit_name', 'track']);
export const PREVIEW_KEYS = new Set(['event_preview', 'event_preview_ru']);

const SCHEDULE_NAME = /^data[\\/]schedules[\\/]/;
const EVENT_RACE = /^data[\\/]events[\\/]/;

export function shouldFoldName(key, filePath, value) {
  if (key !== 'name' && key !== 'race') return false;
  if (key === 'name' && !SCHEDULE_NAME.test(filePath)) return false;
  if (key === 'race' && !EVENT_RACE.test(filePath)) return false;
  if (!/[^\x00-\x7F]/.test(value)) return false;
  return /(s[aã]o paulo|portim[aã]o|taup[oō]|n[uü]rburgring|aut[oó]dromo|w[uü]rth)/i.test(value);
}

/**
 * Fold place / preview / selected race-title fields.
 * For a full data sweep use walkAllStrings.
 */
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
      else if (PREVIEW_KEYS.has(key)) fold = true;
      else if (shouldFoldName(key, filePath, val)) fold = true;
      if (fold) {
        const after = foldLatin(val);
        if (val !== after) {
          changes.push({ key, before: val, after });
          obj[key] = after;
        }
      }
    } else if (typeof val === 'object') {
      walkObject(val, filePath, changes);
    }
  }
}

/** Fold Latin diacritics in every string value (Cyrillic-safe). */
export function walkAllStrings(obj, changes, path = '') {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      if (typeof item === 'string') {
        const after = foldLatin(item);
        if (item !== after) {
          changes.push({ key: `${path}[${i}]`, before: item, after });
          obj[i] = after;
        }
      } else if (item && typeof item === 'object') {
        walkAllStrings(item, changes, `${path}[${i}]`);
      }
    });
    return;
  }
  for (const [key, val] of Object.entries(obj)) {
    const p = path ? `${path}.${key}` : key;
    if (typeof val === 'string') {
      const after = foldLatin(val);
      if (val !== after) {
        changes.push({ key: p, before: val, after });
        obj[key] = after;
      }
    } else if (val && typeof val === 'object') {
      walkAllStrings(val, changes, p);
    }
  }
}
