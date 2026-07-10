package schedulefile

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestEnsureCompletedRaces_SkipsCupExhibition(t *testing.T) {
	dir := t.TempDir()
	schedulesDir := filepath.Join(dir, "schedules")
	eventsDir := filepath.Join(dir, "events", "NASCAR Cup Series", "2026")
	if err := os.MkdirAll(schedulesDir, 0o750); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(eventsDir, 0o750); err != nil {
		t.Fatal(err)
	}

	schedule := []EventJSON{
		{
			ID: "NASCAR_CUP_2026_0", SeriesID: "NASCAR_CUP", Season: "2026",
			Name: "Cook Out Clash", StartDate: "2026-02-04",
		},
		{
			ID: "NASCAR_CUP_2026_1", SeriesID: "NASCAR_CUP", Season: "2026",
			Name: "Daytona 500", StartDate: "2026-02-15",
		},
	}
	schedBytes, err := json.Marshal(schedule)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(schedulesDir, "nascar_cup.json"), schedBytes, 0o600); err != nil {
		t.Fatal(err)
	}

	clashDetail := map[string]any{
		"tables": map[string]any{
			"race_results": map[string]any{
				"headers": []string{"Pos", "Driver"},
				"rows":    [][]string{{"1", "Test Driver"}},
			},
		},
	}
	clashBytes, err := json.Marshal(clashDetail)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(eventsDir, "nascar_cup_2026_0.json"), clashBytes, 0o600); err != nil {
		t.Fatal(err)
	}

	data := &StandingsData{
		RaceOrder: []string{"DAY", "ATL"},
	}
	EnsureCompletedRaces(dir, "NASCAR_CUP", "2026", data)
	if len(data.CompletedRaces) != 0 {
		t.Fatalf("exhibition clash must not mark championship rounds completed: %v", data.CompletedRaces)
	}
}

func TestEnrichStagesFromEvents_FiltersWrongSeason(t *testing.T) {
	dir := t.TempDir()
	schedulesDir := filepath.Join(dir, "schedules")
	eventsDir := filepath.Join(dir, "events", "NOAPS", "2026")
	if err := os.MkdirAll(schedulesDir, 0o750); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(eventsDir, 0o750); err != nil {
		t.Fatal(err)
	}

	schedule := []EventJSON{
		{ID: "NOAPS_2026_1", SeriesID: "NOAPS", Season: "2026", Name: "Test", StartDate: "2026-03-01"},
		{ID: "NOAPS_2025_1", SeriesID: "NOAPS", Season: "2025", Name: "Old", StartDate: "2025-03-01"},
	}
	schedBytes, err := json.Marshal(schedule)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(schedulesDir, "noaps.json"), schedBytes, 0o600); err != nil {
		t.Fatal(err)
	}

	writeEvent := func(name, driver string, pts int) {
		detail := map[string]any{
			"tables": map[string]any{
				"stage_1": map[string]any{
					"headers": []string{"Driver", "Points"},
					"rows":    [][]string{{driver, itoa(pts)}},
				},
			},
		}
		b, err := json.Marshal(detail)
		if err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(eventsDir, name+".json"), b, 0o600); err != nil {
			t.Fatal(err)
		}
	}
	writeEvent("noaps_2026_1", "A. Driver", 5)
	writeEvent("noaps_2025_1", "A. Driver", 9)

	data := &StandingsData{
		Rows: []StandingRow{{Driver: "A. Driver", Stages: "0"}},
	}
	EnrichStagesFromEvents(dir, "NOAPS", "2026", data)
	if data.Rows[0].Stages != "5" {
		t.Fatalf("got stages %q, want 5 (2025 event must be excluded)", data.Rows[0].Stages)
	}
}

func TestCompletedRacesFromEvents_MatchesBuildCup2026(t *testing.T) {
	dataDir := filepath.Join("..", "..", "data")
	if _, err := os.Stat(dataDir); err != nil {
		t.Skip("data dir missing")
	}
	built, err := BuildStandingsFromEvents(dataDir, "NASCAR_CUP", "2026")
	if err != nil || built == nil {
		t.Fatalf("BuildStandingsFromEvents: %v", err)
	}
	fallback := &StandingsData{RaceOrder: built.RaceOrder}
	EnsureCompletedRaces(dataDir, "NASCAR_CUP", "2026", fallback)
	if len(fallback.CompletedRaces) != len(built.CompletedRaces) {
		t.Fatalf("fallback len %d != build len %d", len(fallback.CompletedRaces), len(built.CompletedRaces))
	}
	for i := range built.CompletedRaces {
		if fallback.CompletedRaces[i] != built.CompletedRaces[i] {
			t.Fatalf("index %d: fallback %q != build %q", i, fallback.CompletedRaces[i], built.CompletedRaces[i])
		}
	}
}
