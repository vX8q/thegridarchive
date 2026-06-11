package schedulefile

import (
	"regexp"
	"strconv"
	"strings"
)

var superFormulaRoundFromTitleRe = regexp.MustCompile(`(?i)round\s*(\d+)`)

func intSlicesEqual(a, b []int) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

// buildSuperFormulaRaceOrder builds R1..Rn from championship round numbers (from event IDs),
// not calendar rows (Motegi/Suzuka — two IDs, one JSON file).
func buildSuperFormulaRaceOrder(events []EventJSON, season string) ([]string, []string) {
	maxRound := 0
	venueByRound := map[int]string{}
	roundSets := eventRoundSets("super_formula", events, season)
	for _, ev := range events {
		if season != "" && ev.Season != "" && ev.Season != season {
			continue
		}
		rs, ok := roundSets[ev.ID]
		if !ok {
			continue
		}
		name := strings.TrimSpace(ev.CircuitName)
		if name == "" {
			name = strings.TrimSpace(ev.Name)
		}
		for _, r := range rs {
			if r > maxRound {
				maxRound = r
			}
			if venueByRound[r] == "" && name != "" {
				venueByRound[r] = name
			}
		}
	}
	if maxRound == 0 {
		return nil, nil
	}
	raceOrder := make([]string, 0, maxRound)
	eventNames := make([]string, 0, maxRound)
	for i := 1; i <= maxRound; i++ {
		raceOrder = append(raceOrder, "R"+strconv.Itoa(i))
		eventNames = append(eventNames, venueByRound[i])
	}
	return raceOrder, eventNames
}

// superFormulaPrimaryEventID is the event JSON file ID for a weekend (smallest ID in the group with a file).
func superFormulaPrimaryEventID(eventID string, events []EventJSON, season string, dataDir string) string {
	roundSets := eventRoundSets("super_formula", events, season)
	target, ok := roundSets[eventID]
	if !ok {
		if EventDetailExists(dataDir, eventID) {
			return eventID
		}
		return ""
	}
	var best string
	for _, ev := range events {
		if season != "" && ev.Season != "" && ev.Season != season {
			continue
		}
		rs, ok2 := roundSets[ev.ID]
		if !ok2 || !intSlicesEqual(rs, target) {
			continue
		}
		if !EventDetailExists(dataDir, ev.ID) {
			continue
		}
		if best == "" || ev.ID < best {
			best = ev.ID
		}
	}
	return best
}

func superFormulaSessionRoundNumber(title string, sessionIndex int, eventRounds []int) int {
	if m := superFormulaRoundFromTitleRe.FindStringSubmatch(strings.TrimSpace(title)); len(m) >= 2 {
		if n, err := strconv.Atoi(m[1]); err == nil && n > 0 {
			return n
		}
	}
	if sessionIndex >= 0 && sessionIndex < len(eventRounds) {
		return eventRounds[sessionIndex]
	}
	return 0
}

func superFormulaQualifyingTable(detail *EventDetailJSON) *EventTable {
	if detail == nil || detail.Tables == nil {
		return nil
	}
	q, ok := detail.Tables["qualifying"]
	if !ok || len(q.Headers) == 0 || len(q.Rows) == 0 {
		return nil
	}
	return &EventTable{Headers: q.Headers, Rows: q.Rows}
}
