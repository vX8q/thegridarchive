package schedulefile

import (
	"encoding/json"
	"fmt"
	"strings"
)

// ResolveEventDetailID maps a schedule event ID to the on-disk event JSON id.
// Supercars stores one JSON file per race weekend (ordinal 1,2,3,…), while the
// schedule lists each individual race (up to 37). Any race in a weekend resolves
// to the same weekend bundle file (e.g. SUPERCARS_2026_5 -> supercars_2026_2 for Melbourne).
// Site URLs use weekend numbers via ResolveSupercarsHTTPFileID instead.
func ResolveEventDetailID(dataDir, eventID string) string {
	return resolveSupercarsScheduleRaceToWeekendFile(dataDir, eventID)
}

func resolveSupercarsScheduleRaceToWeekendFile(dataDir, eventID string) string {
	id := strings.ToUpper(strings.TrimSpace(eventID))
	if !strings.HasPrefix(id, "SUPERCARS_") {
		return strings.ToLower(eventID)
	}
	parts := strings.Split(id, "_")
	if len(parts) < 3 {
		return strings.ToLower(eventID)
	}
	season := parts[1]
	events, err := LoadEvents(dataDir, "SUPERCARS")
	if err != nil || len(events) == 0 {
		return strings.ToLower(eventID)
	}
	roundSets := eventRoundSets("supercars", events, season)
	rounds := roundSets[id]
	if len(rounds) == 0 {
		return strings.ToLower(eventID)
	}
	weekend := rounds[0]
	return SupercarsWeekendFileID(season, weekend)
}

// ResolveSupercarsHTTPFileID resolves a site/API event slug to a weekend bundle file.
// The number in the URL is the championship stage (supercars_2026_2 = Melbourne),
// not the schedule race number (SUPERCARS_2026_4 is Melbourne race 1 but lives in _2).
// When no direct weekend file exists, fall back to schedule race → weekend mapping
// (e.g. supercars-2026-17 → supercars_2026_6).
func ResolveSupercarsHTTPFileID(dataDir, eventID string) string {
	id := strings.ToUpper(strings.TrimSpace(eventID))
	if !strings.HasPrefix(id, "SUPERCARS_") {
		return strings.ToLower(eventID)
	}
	parts := strings.Split(id, "_")
	if len(parts) < 3 {
		return strings.ToLower(eventID)
	}
	season := parts[1]
	var n int
	if _, err := fmt.Sscanf(parts[2], "%d", &n); err != nil || n <= 0 {
		return strings.ToLower(eventID)
	}
	direct := SupercarsWeekendFileID(season, n)
	if eventDetailFileExistsRaw(dataDir, direct) {
		return direct
	}
	if w := SupercarsWeekendNumber(dataDir, id); w > 0 {
		return SupercarsWeekendFileID(season, w)
	}
	return strings.ToLower(eventID)
}

// SupercarsWeekendFileID is the on-disk bundle path id for a championship weekend
// (ordinal 1…N), not an individual race number. Sydney R1–3 → supercars_2026_1,
// Melbourne R4–7 → supercars_2026_2, Darwin R17–19 → supercars_2026_6, etc.
func SupercarsWeekendFileID(season string, weekend int) string {
	return fmt.Sprintf("supercars_%s_%d", season, weekend)
}

// SupercarsWeekendNumber returns the championship weekend ordinal for a schedule
// race ID (e.g. SUPERCARS_2026_17 → 6). Returns 0 when unknown.
func SupercarsWeekendNumber(dataDir, eventID string) int {
	id := strings.ToUpper(strings.TrimSpace(eventID))
	if !strings.HasPrefix(id, "SUPERCARS_") {
		return 0
	}
	parts := strings.Split(id, "_")
	if len(parts) < 3 {
		return 0
	}
	season := parts[1]
	events, err := LoadEvents(dataDir, "SUPERCARS")
	if err != nil || len(events) == 0 {
		return 0
	}
	roundSets := eventRoundSets("supercars", events, season)
	rounds := roundSets[id]
	if len(rounds) == 0 {
		return 0
	}
	return rounds[0]
}

// PatchSupercarsEventIDFromRequest sets canonical_event_id when the request slug
// differs from the loaded weekend bundle (legacy race-number URLs).
func PatchSupercarsEventIDFromRequest(body []byte, requestedEventID, fileID string) []byte {
	req := strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(requestedEventID), "-", "_"))
	if !strings.HasPrefix(req, "SUPERCARS_") {
		return body
	}
	fileSlug := strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(fileID), "-", "_"))
	if fileSlug == "" || strings.EqualFold(req, fileSlug) {
		return body
	}
	var m map[string]interface{}
	if err := json.Unmarshal(body, &m); err != nil {
		return body
	}
	m["canonical_event_id"] = fileSlug
	out, err := json.Marshal(m)
	if err != nil {
		return body
	}
	return out
}
