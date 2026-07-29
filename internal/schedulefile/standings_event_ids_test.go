package schedulefile

import (
	"path/filepath"
	"strings"
	"testing"
)

// Standings headers link each race column to its event, so every column must
// name an event that actually has a page.
func TestStandingsEventIDsAlignWithRaceOrder(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatal(err)
	}
	series := []string{
		"NASCAR_CUP", "NOAPS", "NASCAR_TRUCK", "ARCA", "NASCAR_MODIFIED",
		"INDYCAR", "PSC", "SUPER_GT", "F1", "F2", "F3", "DTM", "FREC", "F4_IT",
		"SUPERCARS", "SUPER_FORMULA",
	}
	build := func(seriesID string) (*StandingsData, error) {
		switch strings.ToUpper(seriesID) {
		case "IMSA":
			return BuildImsaStandingsFromEvents(dataDir, "2026")
		case "ELMS":
			return BuildElmsStandingsFromEvents(dataDir, "2026")
		case "WEC":
			return BuildWecStandingsFromEvents(dataDir, "2026")
		case "GTWCE_END", "GTWCE_SPRINT":
			return BuildGtwceStandingsFromEvents(dataDir, seriesID, "2026")
		}
		return BuildStandingsFromEvents(dataDir, seriesID, "2026")
	}
	series = append(series, "IMSA", "ELMS", "WEC", "GTWCE_END", "GTWCE_SPRINT")

	detailFiles := EventDetailFileSet(dataDir)
	for _, seriesID := range series {
		data, err := build(seriesID)
		if err != nil || data == nil {
			t.Errorf("%s: build standings: %v", seriesID, err)
			continue
		}
		if len(data.RaceOrder) == 0 {
			continue
		}
		if len(data.EventIDs) != len(data.RaceOrder) {
			t.Errorf("%s: event_ids has %d entries, want %d (one per race column)",
				seriesID, len(data.EventIDs), len(data.RaceOrder))
			continue
		}
		linked := 0
		for i, id := range data.EventIDs {
			if strings.TrimSpace(id) == "" {
				continue
			}
			linked++
			if !EventHasDetail(dataDir, detailFiles, id) {
				t.Errorf("%s column %s links to %s, which has no event file", seriesID, data.RaceOrder[i], id)
			}
		}
		if linked == 0 {
			t.Errorf("%s: no race column links to an event", seriesID)
		}
	}
}

// The column must point at the round it shows, not at a neighbouring weekend.
func TestStandingsEventIDsMatchEventNames(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatal(err)
	}
	// Supercars is excluded: its columns are single races while the link points
	// to the weekend bundle file, whose ID does not match the schedule row.
	for _, seriesID := range []string{"F1", "F2", "F3", "DTM", "FREC", "F4_IT", "PSC", "SUPER_GT", "SUPER_FORMULA"} {
		data, err := BuildStandingsFromEvents(dataDir, seriesID, "2026")
		if err != nil || data == nil {
			t.Errorf("%s: build standings: %v", seriesID, err)
			continue
		}
		if len(data.EventNames) != len(data.RaceOrder) || len(data.EventIDs) != len(data.RaceOrder) {
			continue
		}
		events, err := LoadEvents(dataDir, seriesID)
		if err != nil {
			t.Errorf("%s: load events: %v", seriesID, err)
			continue
		}
		nameByID := make(map[string]string, len(events))
		for _, ev := range events {
			nameByID[strings.ToUpper(ev.ID)] = strings.TrimSpace(ev.Name)
		}
		for i, id := range data.EventIDs {
			if strings.TrimSpace(id) == "" {
				continue
			}
			want := nameByID[strings.ToUpper(id)]
			got := strings.TrimSpace(data.EventNames[i])
			if want == "" || got == "" || strings.EqualFold(want, got) {
				continue
			}
			// Super Formula names venues, the schedule names weekends.
			if strings.Contains(strings.ToLower(want), strings.ToLower(got)) {
				continue
			}
			t.Errorf("%s column %s: header says %q but links to %s (%q)", seriesID, data.RaceOrder[i], got, id, want)
		}
	}
}
