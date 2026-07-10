package schedulefile

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestEnrichTeamsRoundsFromEvents_WECEnrichesCuratedTeams(t *testing.T) {
	dir := t.TempDir()
	schedulesDir := filepath.Join(dir, "schedules")
	eventsDir := filepath.Join(dir, "events", "WEC", "2026")
	if err := os.MkdirAll(schedulesDir, 0o750); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(eventsDir, 0o750); err != nil {
		t.Fatal(err)
	}

	schedule := []EventJSON{
		{ID: "WEC_2026_1", SeriesID: "WEC", Season: "2026", StartDate: "2026-03-01"},
	}
	schedBytes, err := json.Marshal(schedule)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(schedulesDir, "wec.json"), schedBytes, 0o600); err != nil {
		t.Fatal(err)
	}

	event := map[string]any{
		"tables": map[string]any{
			"entry_list": map[string]any{
				"sessions": []any{
					map[string]any{
						"title":   "Hypercar",
						"headers": []any{"No.", "Drivers", "Entrant", "Car"},
						"rows": []any{
							[]any{"7", "Driver A", "Team A", "Car A"},
						},
					},
				},
			},
		},
	}
	eventBytes, err := json.Marshal(event)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(eventsDir, "wec_2026_1.json"), eventBytes, 0o600); err != nil {
		t.Fatal(err)
	}

	data := &TeamsWithSpec{
		Teams: []TeamJSON{
			{Number: "7", Team: "Team A", Driver: "Driver A"},
		},
	}
	EnrichTeamsRoundsFromEvents(dir, "wec", "2026", data)
	if data.Teams[0].Rounds == "" {
		t.Fatalf("expected curated WEC row to receive rounds, got %+v", data.Teams[0])
	}
}
