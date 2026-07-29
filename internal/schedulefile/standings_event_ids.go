package schedulefile

import "strings"

// keepEventIDsWithDetail blanks race columns whose event has no detail file yet,
// so the standings header does not link to a page that cannot be opened.
func keepEventIDsWithDetail(dataDir string, ids []string) []string {
	if len(ids) == 0 {
		return ids
	}
	detailFiles := EventDetailFileSet(dataDir)
	kept := 0
	for i, id := range ids {
		if strings.TrimSpace(id) == "" {
			continue
		}
		if EventHasDetail(dataDir, detailFiles, id) {
			kept++
			continue
		}
		ids[i] = ""
	}
	if kept == 0 {
		return nil
	}
	return ids
}

// standingsRaceColumnEventIDs maps every race column of raceOrder to the event
// that hosts it, so standings headers can link to that event page. Rounds still
// waiting for their event file get an empty entry — there is no page to open yet.
// columnsPerEvent reports how many race columns an event contributes (a sprint
// weekend or a double-header round takes more than one).
func standingsRaceColumnEventIDs(dataDir, seriesID, season string, events []EventJSON, raceOrder []string, columnsPerEvent func(EventJSON) int) []string {
	if len(raceOrder) == 0 || len(events) == 0 {
		return nil
	}
	detailFiles := EventDetailFileSet(dataDir)
	ids := make([]string, len(raceOrder))
	idx := 0
	filled := 0
	for _, ev := range events {
		if idx >= len(ids) {
			break
		}
		if ev.Season != season || isExhibitionEvent(seriesID, ev.ID) {
			continue
		}
		if strings.EqualFold(seriesID, "F1") && isF1PreSeasonEvent(ev.ID) {
			continue
		}
		columns := 1
		if columnsPerEvent != nil {
			columns = columnsPerEvent(ev)
		}
		id := ""
		if EventHasDetail(dataDir, detailFiles, ev.ID) {
			id = ev.ID
			filled++
		}
		for i := 0; i < columns && idx < len(ids); i++ {
			ids[idx] = id
			idx++
		}
	}
	if filled == 0 {
		return nil
	}
	return ids
}