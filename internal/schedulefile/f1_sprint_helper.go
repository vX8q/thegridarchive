package schedulefile

import (
	"strings"
)

// isF1PreSeasonEvent — pre-season tests are excluded from championship standings.
func isF1PreSeasonEvent(eventID string) bool {
	u := strings.ToUpper(strings.TrimSpace(eventID))
	return strings.Contains(u, "PRE_SEASON") || strings.Contains(u, "PRESEASON")
}

// eventHasSprintRaceSession returns true if tables.race.sessions contains
// at least one sprint race results session (title contains "sprint").
func eventHasSprintRaceSession(dataDir, eventID string) bool {
	sessions, err := loadEventRaceSessionsFromRaceTable(dataDir, eventID)
	if err != nil || len(sessions) == 0 {
		return false
	}
	for _, s := range sessions {
		title := strings.ToLower(strings.TrimSpace(s.Title))
		if strings.Contains(title, "sprint") && len(s.Headers) > 0 && len(s.Rows) > 0 {
			return true
		}
	}
	return false
}

// f1SprintWeekendTables returns sprint and feature race tables for F1/F2/F3 sprint weekends.
// Sprint from tables.race.sessions (title with "sprint"); feature from race_results or Race/Grand Prix session.
func f1SprintWeekendTables(dataDir, eventID string) (sprintTable, featureTable EventTable, detail *EventDetailJSON, ok bool) {
	sessions, err := loadEventRaceSessionsFromRaceTable(dataDir, eventID)
	if err != nil || len(sessions) == 0 {
		return EventTable{}, EventTable{}, nil, false
	}
	var sprintSess, featureSess *RaceSession
	for i := range sessions {
		titleLower := strings.ToLower(strings.TrimSpace(sessions[i].Title))
		if strings.Contains(titleLower, "sprint") {
			if sprintSess == nil || strings.Contains(titleLower, "race") {
				sprintSess = &sessions[i]
			}
			continue
		}
		if strings.Contains(titleLower, "race") || strings.Contains(titleLower, "grand prix") {
			if featureSess == nil {
				featureSess = &sessions[i]
			}
		}
	}
	if sprintSess == nil || len(sprintSess.Headers) == 0 || len(sprintSess.Rows) == 0 {
		return EventTable{}, EventTable{}, nil, false
	}
	sprintTable = EventTable{Headers: sprintSess.Headers, Rows: sprintSess.Rows}

	det, errDet := LoadEventDetail(dataDir, eventID)
	if errDet != nil || det == nil || det.Tables == nil {
		return EventTable{}, EventTable{}, nil, false
	}
	detail = det
	if featureSess != nil && len(featureSess.Headers) > 0 && len(featureSess.Rows) > 0 {
		featureTable = EventTable{Headers: featureSess.Headers, Rows: featureSess.Rows}
	} else if rr, hasRR := det.Tables["race_results"]; hasRR && len(rr.Headers) > 0 && len(rr.Rows) > 0 {
		featureTable = rr
	} else if ra, hasRace := det.Tables["race"]; hasRace && len(ra.Headers) > 0 && len(ra.Rows) > 0 {
		featureTable = ra
	}
	if len(featureTable.Headers) == 0 || len(featureTable.Rows) == 0 {
		return EventTable{}, EventTable{}, nil, false
	}
	return sprintTable, featureTable, detail, true
}

