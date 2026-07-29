package schedulefile

import (
	"regexp"
	"strconv"
	"strings"
)

var superFormulaRoundFromTitleRe = regexp.MustCompile(`(?i)round\s*(\d+)`)

// appendUniqueRaceCode keeps completed_races a set: a Super Formula round can be
// touched twice when its race is rescheduled into another weekend's file.
func appendUniqueRaceCode(codes []string, code string) []string {
	for _, c := range codes {
		if c == code {
			return codes
		}
	}
	return append(codes, code)
}

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
func buildSuperFormulaRaceOrder(dataDir string, events []EventJSON, season string) ([]string, []string, []string) {
	maxRound := 0
	venueByRound := map[int]string{}
	eventByRound := map[int]string{}
	roundSets := eventRoundSets("super_formula", events, season)

	seasonEvents := make([]EventJSON, 0, len(events))
	for _, ev := range events {
		if season != "" && ev.Season != "" && ev.Season != season {
			continue
		}
		if _, ok := roundSets[ev.ID]; !ok {
			continue
		}
		seasonEvents = append(seasonEvents, ev)
	}
	venueName := func(ev EventJSON) string {
		name := strings.TrimSpace(ev.CircuitName)
		if name == "" {
			name = strings.TrimSpace(ev.Name)
		}
		return name
	}
	assign := func(rounds []int, name, eventID string) {
		for _, r := range rounds {
			if r > maxRound {
				maxRound = r
			}
			if venueByRound[r] == "" && name != "" {
				venueByRound[r] = name
			}
			if eventByRound[r] == "" && eventID != "" {
				eventByRound[r] = eventID
			}
		}
	}
	// Rounds whose race sits in a file take that file: a rescheduled round links
	// to the weekend that actually ran it (Autopolis R3 was held at Fuji).
	for _, ev := range seasonEvents {
		assign(superFormulaEventSessionRounds(dataDir, ev.ID), "", ev.ID)
	}
	// Calendar rows drive the venue label, so a round keeps its own name even
	// when the race moved elsewhere.
	for _, ev := range seasonEvents {
		assign(roundSets[ev.ID], venueName(ev), ev.ID)
	}
	// Second race of a double-header weekend: no calendar row of its own.
	for _, ev := range seasonEvents {
		assign(superFormulaEventSessionRounds(dataDir, ev.ID), venueName(ev), ev.ID)
	}
	if maxRound == 0 {
		return nil, nil, nil
	}
	raceOrder := make([]string, 0, maxRound)
	eventNames := make([]string, 0, maxRound)
	eventIDs := make([]string, 0, maxRound)
	lastVenue, lastEventID := "", ""
	for i := 1; i <= maxRound; i++ {
		venue := venueByRound[i]
		if venue == "" {
			// Rounds without their own calendar row belong to the weekend that
			// opened at the previous round.
			venue = lastVenue
		}
		eventID := eventByRound[i]
		if eventID == "" {
			eventID = lastEventID
		}
		lastVenue, lastEventID = venue, eventID
		raceOrder = append(raceOrder, "R"+strconv.Itoa(i))
		eventNames = append(eventNames, venue)
		eventIDs = append(eventIDs, eventID)
	}
	return raceOrder, eventNames, eventIDs
}

// superFormulaEventSessionRounds returns championship round numbers named in the
// event's race session titles ("Race Round 6", "Race Round 7", …).
func superFormulaEventSessionRounds(dataDir, eventID string) []int {
	if strings.TrimSpace(dataDir) == "" {
		return nil
	}
	sessions, err := LoadEventRaceSessions(dataDir, eventID)
	if err != nil || len(sessions) == 0 {
		return nil
	}
	var out []int
	for _, s := range sessions {
		m := superFormulaRoundFromTitleRe.FindStringSubmatch(strings.TrimSpace(s.Title))
		if len(m) < 2 {
			continue
		}
		if n, err := strconv.Atoi(m[1]); err == nil && n > 0 {
			out = append(out, n)
		}
	}
	return out
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

// superFormulaQualifyingForRound returns the Qualifying Round N session table
// (3/2/1 pole bonuses). Flat qualifying (no sessions) is handled separately
// for cancelled-race weekends via superFormulaQualifyingTable.
func superFormulaQualifyingForRound(detail *EventDetailJSON, roundNum int) *EventTable {
	if detail == nil || detail.Tables == nil || roundNum <= 0 {
		return nil
	}
	q, ok := detail.Tables["qualifying"]
	if !ok {
		return nil
	}
	want := "round " + strconv.Itoa(roundNum)
	for _, s := range q.Sessions {
		if strings.Contains(strings.ToLower(strings.TrimSpace(s.Title)), want) {
			if len(s.Headers) == 0 || len(s.Rows) == 0 {
				return nil
			}
			return &EventTable{Headers: s.Headers, Rows: s.Rows}
		}
	}
	return nil
}
