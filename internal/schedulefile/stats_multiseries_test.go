package schedulefile

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func writeStatsTestJSON(t *testing.T, path string, v any) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("mkdir %s: %v", filepath.Dir(path), err)
	}
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		t.Fatalf("marshal %s: %v", path, err)
	}
	if err := os.WriteFile(path, b, 0o644); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
}

func writeStatsTestEvent(t *testing.T, dataDir, seriesID, eventID string, tables map[string]EventTable, entryList []EntryListRow) {
	t.Helper()
	writeStatsTestJSON(t, filepath.Join(dataDir, "schedules", strings.ToLower(seriesID)+".json"), []EventJSON{{
		ID:        eventID,
		SeriesID:  seriesID,
		Season:    "2026",
		Name:      eventID,
		StartDate: "2026-01-01",
		EndDate:   "2026-01-01",
	}})
	writeStatsTestJSON(t, filepath.Join(dataDir, "events", strings.ToLower(eventID)+".json"), EventDetailJSON{
		EventID:   eventID,
		Laps:      "10",
		EntryList: entryList,
		Tables:    tables,
	})
}

func statsRowByDriver(t *testing.T, rows []DriverStatsRow, driver string) DriverStatsRow {
	t.Helper()
	for _, row := range rows {
		if row.Driver == driver {
			return row
		}
	}
	t.Fatalf("driver %q not found in %#v", driver, rows)
	return DriverStatsRow{}
}

func TestStatsF2SprintFeatureMetrics(t *testing.T) {
	dataDir := t.TempDir()
	writeStatsTestEvent(t, dataDir, "F2", "f2_2026_1", map[string]EventTable{
		"race": {
			Sessions: []EventTableSession{
				{Title: "Sprint Race", Headers: []string{"Pos", "No", "Driver", "Team", "Laps", "Grid", "Best lap", "Points"}, Rows: [][]string{
					{"1", "1", "Driver A", "Team A", "10", "2", "1:31.000", "10"},
					{"2", "2", "Driver B", "Team B", "10", "1", "1:32.000", "8"},
				}},
				{Title: "Feature Race", Headers: []string{"Pos", "No", "Driver", "Team", "Laps", "Grid", "Best lap", "Points"}, Rows: [][]string{
					{"2", "1", "Driver A", "Team A", "10", "1", "1:30.000", "18"},
					{"1", "2", "Driver B", "Team B", "10", "2", "1:31.500", "25"},
				}},
			},
		},
	}, nil)

	got, err := buildDriverStatsFromJSON(dataDir, "F2", "2026")
	if err != nil {
		t.Fatal(err)
	}
	a := statsRowByDriver(t, got.Rows, "Driver A")
	if a.Races != 2 || a.SprintWins != 1 || a.SprintPodiums != 1 || a.FeatureWins != 0 || a.FeaturePodiums != 1 || a.Points != 28 || a.FastestLaps != 2 {
		t.Fatalf("unexpected Driver A F2 stats: %#v", a)
	}
}

func TestStatsDTMCountsTwoRaceSessions(t *testing.T) {
	dataDir := t.TempDir()
	writeStatsTestEvent(t, dataDir, "DTM", "dtm_2026_1", map[string]EventTable{
		"race": {
			Sessions: []EventTableSession{
				{Title: "Race 1", Headers: []string{"Pos", "No", "Driver", "Team", "Manufacturer", "Laps", "Grid", "Points"}, Rows: [][]string{{"1", "11", "Driver A", "Team A", "BMW", "10", "1", "25"}}},
				{Title: "Race 2", Headers: []string{"Pos", "No", "Driver", "Team", "Manufacturer", "Laps", "Grid", "Points"}, Rows: [][]string{{"2", "11", "Driver A", "Team A", "BMW", "10", "3", "18"}}},
			},
		},
	}, nil)

	got, err := buildDriverStatsFromJSON(dataDir, "DTM", "2026")
	if err != nil {
		t.Fatal(err)
	}
	a := statsRowByDriver(t, got.Rows, "Driver A")
	if a.Races != 2 || a.Wins != 1 || a.Points != 43 {
		t.Fatalf("expected two DTM race sessions, got %#v", a)
	}
}

func TestStatsSuperGTClassSplit(t *testing.T) {
	dataDir := t.TempDir()
	writeStatsTestEvent(t, dataDir, "SUPER_GT", "super_gt_2026_1", map[string]EventTable{
		"race": {Headers: []string{"Pos", "No", "Class", "Drivers", "Team", "Manufacturer", "Laps", "Points"}, Rows: [][]string{
			{"1", "36", "GT500", "GT500 Crew", "Team 500", "Toyota", "10", "20"},
			{"1", "2", "GT300", "GT300 Crew", "Team 300", "Subaru", "9", "20"},
		}},
	}, nil)

	got, err := buildDriverStatsFromJSON(dataDir, "SUPER_GT", "2026")
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Classes) != 2 {
		t.Fatalf("expected GT500/GT300 class split, got %#v", got.Classes)
	}
}

func TestStatsIMSAMultiDriverEntryStaysCrewBased(t *testing.T) {
	dataDir := t.TempDir()
	writeStatsTestEvent(t, dataDir, "IMSA", "imsa_2026_1", map[string]EventTable{
		"race": {Headers: []string{"Pos", "No", "Drivers", "Team", "Laps", "Points"}, Rows: [][]string{
			{"1", "7", "Driver A / Driver B / Driver C", "Porsche Penske Motorsport", "10", "35"},
		}},
	}, []EntryListRow{{Number: "7", Class: "GTP", Manufacturer: "Porsche", Driver1: "Driver A", Driver2: "Driver B", Driver3: "Driver C"}})

	got, err := buildDriverStatsFromJSON(dataDir, "IMSA", "2026")
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Rows) != 1 || got.Rows[0].Driver != "Driver A / Driver B / Driver C" || got.Rows[0].Class != "GTP" {
		t.Fatalf("expected crew-based IMSA entry stats, got %#v", got.Rows)
	}
}

func TestStatsStockCarStageStatsRemainAvailable(t *testing.T) {
	dataDir := t.TempDir()
	writeStatsTestEvent(t, dataDir, "NASCAR_CUP", "nascar_cup_2026_1", map[string]EventTable{
		"race_results": {Headers: []string{"Pos", "No", "Driver", "Team", "Manufacturer", "Laps", "Grid"}, Rows: [][]string{{"1", "5", "Driver A", "Team A", "Chevrolet", "10", "1"}}},
		"stage_1":      {Headers: []string{"Pos", "No", "Driver", "Points"}, Rows: [][]string{{"1", "5", "Driver A", "10"}}},
		"stage_2":      {Headers: []string{"Pos", "No", "Driver", "Points"}, Rows: [][]string{{"2", "5", "Driver A", "9"}}},
	}, nil)

	got, err := buildDriverStatsFromJSON(dataDir, "NASCAR_CUP", "2026")
	if err != nil {
		t.Fatal(err)
	}
	a := statsRowByDriver(t, got.Rows, "Driver A")
	if a.StageWins != 1 || a.StagePoints != 19 {
		t.Fatalf("expected stock-car stage stats, got %#v", a)
	}
}
