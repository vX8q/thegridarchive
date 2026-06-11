package schedulefile

import (
	"fmt"
	"strings"
)

// ResolveEventDetailID maps a schedule event ID to the on-disk event JSON id.
// Supercars stores one JSON file per race weekend (ordinal 1,2,3,…), while the
// schedule lists each individual race (up to 37). Any race in a weekend resolves
// to the same weekend bundle file (e.g. SUPERCARS_2026_5 -> supercars_2026_2 for Melbourne).
func ResolveEventDetailID(dataDir, eventID string) string {
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
	return fmt.Sprintf("supercars_%s_%d", season, weekend)
}
