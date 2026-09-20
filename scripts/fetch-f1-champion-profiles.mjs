#!/usr/bin/env node
/**
 * Fill data/driver_profiles.json for F1 World Drivers' Champions from Wikidata.
 * Names/slugs come from data/f1_seasons_history.json (driver_champion).
 *
 * Usage: node scripts/fetch-f1-champion-profiles.mjs
 *
 * Rate-limits Wikidata at ~1.2s between search requests (same as cmd/fetch-driver-wikidata).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { foldLatin } from "./lib/fold-place-diacritics.mjs";
import { slugifyDriverName } from "./lib/driver-slug-canon.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const historyPath = path.join(root, "data", "f1_seasons_history.json");
const profilesPath = path.join(root, "data", "driver_profiles.json");
const wikidataAPI = "https://www.wikidata.org/w/api.php";
const userAgent = "TGA/1.0 (https://github.com/vX8q/tga; fetch F1 champion profiles from Wikidata)";
const delayMs = 1200;

const CITIZENSHIP_MAP = {
  "United Kingdom": "Great Britain",
  "United Kingdom of Great Britain and Northern Ireland": "Great Britain",
  "United States of America": "United States",
  "Kingdom of Italy": "Italy",
  "Italian Republic": "Italy",
  "West Germany": "Germany",
  "Federal Republic of Germany": "Germany",
  "Kingdom of the Netherlands": "Netherlands",
  "Republic of Finland": "Finland",
  "Argentine Republic": "Argentina",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isFilled(profile) {
  if (!profile || typeof profile !== "object") return false;
  return (
    String(profile.full_name || "").trim() !== "" &&
    String(profile.birth_date || "").trim() !== "" &&
    String(profile.citizenship || "").trim() !== ""
  );
}

function wikiGet(url) {
  return fetch(url, { headers: { "User-Agent": userAgent, Accept: "application/json" } }).then(
    async (resp) => {
      if (!resp.ok) {
        throw new Error(`wikidata HTTP ${resp.status}`);
      }
      return resp.json();
    },
  );
}

const QID_OVERRIDES = {
  "Giuseppe Farina": "Q2040",
};

const HOSPITAL_PLACE_RE = /hospital|clinic|maternity|nursing home|ospedale|birth (center|centre)/i;
const SKIP_REGION_RE =
  /^(canton|arrondissement|landkreis|metropolitan (city|municipality)|province|government region)\b| government region$| metropolitan municipality$/i;

function pickSearchId(results) {
  const list = Array.isArray(results) ? results : [];
  const scored = list.map((s) => {
    const desc = String(s.description || "").toLowerCase();
    let score = 0;
    if (/(racing driver|racecar driver|race car driver|motor racing driver)/.test(desc)) score += 25;
    if (desc.includes("formula one") || desc.includes("formula 1")) score += 8;
    if (desc.includes("motorsport") || desc.includes("motor racing")) score += 6;
    if (desc.includes("driver")) score += 3;
    if (/formula one team|constructor|museum|disambiguation|football|entrepreneur/.test(desc)) {
      score -= 50;
    }
    if (desc.includes("team") && !desc.includes("driver")) score -= 40;
    if (desc.includes("circuit") && !desc.includes("driver")) score -= 15;
    return { id: s.id, score, desc };
  });
  scored.sort((a, b) => b.score - a.score);
  if (scored[0] && scored[0].score > 0) return scored[0].id;
  return list[0]?.id || "";
}

async function searchWikidata(name) {
  const u =
    wikidataAPI +
    "?action=wbsearchentities&search=" +
    encodeURIComponent(name) +
    "&language=en&format=json";
  const data = await wikiGet(u);
  return pickSearchId(data.search);
}

function claimList(entity, pid) {
  const list = entity?.claims?.[pid];
  if (!Array.isArray(list) || !list.length) return [];
  const preferred = list.filter((c) => c.rank === "preferred" && c.mainsnak?.snaktype === "value");
  const normal = list.filter(
    (c) => (c.rank === "normal" || c.rank == null) && c.mainsnak?.snaktype === "value",
  );
  return preferred.length ? preferred : normal;
}

function entityIdFromClaim(claim) {
  const v = claim?.mainsnak?.datavalue?.value;
  if (v && typeof v === "object" && typeof v.id === "string") return v.id;
  return "";
}

function parseTimeClaim(claim) {
  const v = claim?.mainsnak?.datavalue?.value;
  if (!v || typeof v !== "object") return "";
  const precision = Number(v.precision || 0);
  if (precision < 11) return "";
  let t = String(v.time || "");
  t = t.replace(/^\+/, "");
  const idx = t.indexOf("T");
  if (idx > 0) t = t.slice(0, idx);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return "";
  if (t.startsWith("0000") || t.endsWith("-00-00")) return "";
  return t;
}

function parseMonolingual(claim) {
  const v = claim?.mainsnak?.datavalue?.value;
  if (!v || typeof v !== "object") return { text: "", language: "" };
  return { text: String(v.text || "").trim(), language: String(v.language || "") };
}

function pickBirthName(entity, fallbackLabel) {
  const claims = claimList(entity, "P1477");
  let en = "";
  let any = "";
  for (const c of claims) {
    const { text, language } = parseMonolingual(c);
    if (!text) continue;
    if (language === "en") en = text;
    if (!any) any = text;
  }
  return foldLatin(en || any || fallbackLabel || "").trim();
}

function mapCitizenship(label) {
  const raw = foldLatin(String(label || "").trim());
  if (!raw) return "";
  return CITIZENSHIP_MAP[raw] || raw;
}

function normPlaceToken(s) {
  return foldLatin(String(s || "").trim())
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/\s+/g, " ");
}

function formatBirthPlace(city, region, country) {
  city = foldLatin(String(city || "").trim());
  region = foldLatin(String(region || "").trim());
  country = foldLatin(String(country || "").trim());
  if (country === "United States of America" || country === "United States") country = "U.S.";
  if (country === "United Kingdom of Great Britain and Northern Ireland") country = "United Kingdom";
  const parts = [];
  if (city) parts.push(city);
  const regionAdmin = SKIP_REGION_RE.test(region.toLowerCase());
  if (
    region &&
    !regionAdmin &&
    normPlaceToken(region) !== normPlaceToken(city) &&
    normPlaceToken(region) !== normPlaceToken(country)
  ) {
    parts.push(region);
  }
  if (country && country !== city) parts.push(country);
  return parts.join(", ");
}

function allValueClaims(entity, pid) {
  const list = entity?.claims?.[pid];
  if (!Array.isArray(list)) return [];
  return list.filter((c) => c.rank !== "deprecated" && c.mainsnak?.snaktype === "value");
}

function pickPlaceId(entity, pid, places) {
  const ids = allValueClaims(entity, pid).map(entityIdFromClaim).filter(Boolean);
  for (const id of ids) {
    const label = entityLabel(places[id] || {});
    if (label && !HOSPITAL_PLACE_RE.test(label)) return id;
  }
  const fallback = ids[0];
  if (!fallback || !places[fallback]) return fallback || "";
  const parent = entityIdFromClaim(claimList(places[fallback], "P131")[0]);
  return parent || fallback;
}

function entityLabel(entity) {
  return String(entity?.labels?.en?.value || "").trim();
}

function idsParam(ids) {
  return [...new Set(ids.filter(Boolean))].join("|");
}

async function getEntities(ids, props) {
  const unique = [...new Set(ids.filter(Boolean))];
  const out = {};
  const chunkSize = 40;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const u =
      wikidataAPI +
      "?action=wbgetentities&ids=" +
      encodeURIComponent(idsParam(chunk)) +
      "&props=" +
      encodeURIComponent(props) +
      "&languages=en&format=json";
    const data = await wikiGet(u);
    Object.assign(out, data.entities || {});
    if (i + chunkSize < unique.length) await sleep(delayMs);
  }
  return out;
}

function profileObject(p) {
  const out = {
    full_name: String(p.full_name || "").trim(),
    birth_date: String(p.birth_date || "").trim(),
    birth_place: String(p.birth_place || "").trim(),
    citizenship: String(p.citizenship || "").trim(),
  };
  if (String(p.death_date || "").trim()) out.death_date = String(p.death_date).trim();
  if (String(p.death_place || "").trim()) out.death_place = String(p.death_place).trim();
  out.photo_url = String(p.photo_url || "");
  return out;
}

function uniqueChampions(history) {
  const names = [];
  const seen = new Set();
  for (const row of history) {
    const name = String(row?.driver_champion || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

async function main() {
  const history = JSON.parse(fs.readFileSync(historyPath, "utf8"));
  const profiles = JSON.parse(fs.readFileSync(profilesPath, "utf8"));
  const names = uniqueChampions(history);
  const toFetch = [];
  const skippedExisting = [];
  for (const name of names) {
    const slug = slugifyDriverName(name);
    if (!slug) continue;
    if (isFilled(profiles[slug])) {
      skippedExisting.push({ name, slug });
      continue;
    }
    toFetch.push({ name, slug });
  }

  console.log(`champions=${names.length} already_filled=${skippedExisting.length} to_fetch=${toFetch.length}`);

  const found = [];
  const problems = [];
  for (let i = 0; i < toFetch.length; i++) {
    const { name, slug } = toFetch[i];
    await sleep(delayMs);
    let qid = QID_OVERRIDES[name] || "";
    try {
      if (!qid) qid = await searchWikidata(name);
    } catch (err) {
      problems.push({ name, reason: "search: " + err.message });
      console.log(`[${i + 1}/${toFetch.length}] ${name} search failed: ${err.message}`);
      continue;
    }
    if (!qid) {
      problems.push({ name, reason: "not found in Wikidata" });
      console.log(`[${i + 1}/${toFetch.length}] ${name} not found`);
      continue;
    }
    found.push({ name, slug, qid });
    console.log(`[${i + 1}/${toFetch.length}] ${name} -> ${qid} (${slug})`);
  }

  if (!found.length) {
    console.log("nothing to write");
    if (problems.length) console.log("problems", problems);
    return;
  }

  await sleep(delayMs);
  const entities = await getEntities(
    found.map((f) => f.qid),
    "claims|labels",
  );

  const countryIds = [];
  const placeIds = [];
  for (const row of found) {
    const ent = entities[row.qid];
    if (!ent) continue;
    for (const c of allValueClaims(ent, "P27")) {
      const id = entityIdFromClaim(c);
      if (id) countryIds.push(id);
    }
    for (const pid of ["P19", "P20"]) {
      for (const c of allValueClaims(ent, pid)) {
        const id = entityIdFromClaim(c);
        if (id) placeIds.push(id);
      }
    }
  }

  await sleep(delayMs);
  const places = await getEntities([...placeIds, ...countryIds], "claims|labels");

  const extraIds = [];
  for (const place of Object.values(places)) {
    for (const pid of ["P131", "P17"]) {
      for (const c of claimList(place, pid)) {
        const id = entityIdFromClaim(c);
        if (id && !places[id] && !entities[id]) extraIds.push(id);
      }
    }
  }
  if (extraIds.length) {
    await sleep(delayMs);
    Object.assign(places, await getEntities(extraIds, "labels|claims"));
  }

  const labelOf = (qid) => {
    if (!qid) return "";
    if (places[qid]) return foldLatin(entityLabel(places[qid]));
    if (entities[qid]) return foldLatin(entityLabel(entities[qid]));
    return "";
  };

  let added = 0;
  let updated = 0;
  for (const row of found) {
    const ent = entities[row.qid];
    if (!ent) {
      problems.push({ name: row.name, reason: "entity missing after wbgetentities" });
      continue;
    }
    let fullName = pickBirthName(ent, entityLabel(ent) || row.name);
    const birth = parseTimeClaim(claimList(ent, "P569")[0]);
    const death = parseTimeClaim(claimList(ent, "P570")[0]);
    const citizenships = [];
    const seenCit = new Set();
    for (const c of claimList(ent, "P27")) {
      const mapped = mapCitizenship(labelOf(entityIdFromClaim(c)));
      const key = mapped.toLowerCase();
      if (!mapped || seenCit.has(key)) continue;
      seenCit.add(key);
      citizenships.push(mapped);
    }
    const placeId = pickPlaceId(ent, "P19", places);
    const placeEnt = placeId ? places[placeId] : null;
    const city = placeEnt ? entityLabel(placeEnt) : "";
    const regionId = placeEnt ? entityIdFromClaim(claimList(placeEnt, "P131")[0]) : "";
    const countryId = placeEnt ? entityIdFromClaim(claimList(placeEnt, "P17")[0]) : "";
    const birthPlace = formatBirthPlace(city, labelOf(regionId), labelOf(countryId));
    const deathPlaceId = pickPlaceId(ent, "P20", places);
    const deathPlaceEnt = deathPlaceId ? places[deathPlaceId] : null;
    const deathPlace = deathPlaceEnt
      ? formatBirthPlace(
          entityLabel(deathPlaceEnt),
          labelOf(entityIdFromClaim(claimList(deathPlaceEnt, "P131")[0])),
          labelOf(entityIdFromClaim(claimList(deathPlaceEnt, "P17")[0])),
        )
      : "";

    if (!fullName && !birth && !citizenships.length && !birthPlace) {
      problems.push({ name: row.name, reason: "no usable Wikidata claims" });
      continue;
    }
    if (row.slug === "emerson-fittipaldi") {
      // Wikidata also lists Poland via a maternal-name claim; citizenship is Brazilian.
      citizenships.splice(0, citizenships.length, "Brazil");
    }
    if (row.slug === "emerson-fittipaldi" && /wojciechowska/i.test(fullName)) {
      fullName = "Emerson Fittipaldi";
    }

    const next = profileObject({
      full_name: fullName || row.name,
      birth_date: birth,
      birth_place: birthPlace,
      citizenship: citizenships.join(", "),
      death_date: death,
      death_place: deathPlace,
      photo_url: profiles[row.slug]?.photo_url || "",
    });
    const existed = Boolean(profiles[row.slug]);
    profiles[row.slug] = next;
    if (existed) updated++;
    else added++;
    console.log(
      `  write ${row.slug}: birth=${next.birth_date || "-"} citizenship=${next.citizenship || "-"} place=${next.birth_place || "-"} death=${next.death_date || "-"}`,
    );
  }

  const ordered = {};
  for (const key of Object.keys(profiles).sort()) {
    ordered[key] = profiles[key];
  }
  fs.writeFileSync(profilesPath, `${JSON.stringify(ordered, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ added, updated, skipped_existing: skippedExisting.length, problems }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
