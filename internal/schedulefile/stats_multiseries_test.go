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
	if len(got.Teams) != 1 || got.Teams[0].Team != "Team A" {
		t.Fatalf("expected one team row, got %#v", got.Teams)
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

func TestStatsIsDNFRequiresExplicitStatus(t *testing.T) {
	if statsIsDNF("", 57, 58) {
		t.Fatal("lapped finisher with empty status must not be DNF")
	}
	if statsIsDNF("+1 lap", 57, 58) {
		t.Fatal("+1 lap is a classified finish")
	}
	if statsIsDNF("1:23:06.801", 58, 58) {
		t.Fatal("race time is a classified finish")
	}
	if statsIsDNF("Running", 100, 200) {
		t.Fatal("Running status must not be DNF")
	}
	if !statsIsDNF("Accident", 40, 200) {
		t.Fatal("Accident must be DNF")
	}
	if !statsIsDNF("Collision", 10, 58) {
		t.Fatal("Collision in Time/Retired must be DNF")
	}
	if !statsIsDNF("DNF", 0, 58) {
		t.Fatal("explicit DNF must count")
	}
}

func TestStatsNormalizeRacePosAndStart(t *testing.T) {
	if got := normalizeStatsRacePos("1 / ST 11 ▲10"); got != "1" {
		t.Fatalf("pos = %q, want 1", got)
	}
	if got := normalizeStatsRacePos("NC / ST 28"); got != "NC" {
		t.Fatalf("pos = %q, want NC", got)
	}
	if got := parseStatsStartFromFinST("1 / ST 11 ▲10"); got != 11 {
		t.Fatalf("start = %d, want 11", got)
	}
	if got := parseStatsStartFromFinST("2 / ST 3"); got != 3 {
		t.Fatalf("start = %d, want 3", got)
	}
	headers := []string{"Fin / ST", "No.", "Driver", "Team", "Laps", "Pts"}
	if got := statsPosColIndex(headers); got != 0 {
		t.Fatalf("pos col = %d, want 0", got)
	}
}

func TestStatsAvgStartFromQualifyingAndFinishClassifiedOnly(t *testing.T) {
	dataDir := t.TempDir()
	writeStatsTestEvent(t, dataDir, "F2", "f2_2026_avg", map[string]EventTable{
		"qualifying": {
			Headers: []string{"Pos", "No", "Driver", "Team"},
			Rows: [][]string{
				{"1", "1", "Driver A", "Team A"},
				{"3", "2", "Driver B", "Team B"},
			},
		},
		"race": {
			Sessions: []EventTableSession{
				{Title: "Sprint Race", Headers: []string{"Pos", "No", "Driver", "Team", "Laps", "Points"}, Rows: [][]string{
					{"1", "1", "Driver A", "Team A", "10", "10"},
					{"DNF", "2", "Driver B", "Team B", "4", "0"},
				}},
				{Title: "Feature Race", Headers: []string{"Pos", "No", "Driver", "Team", "Laps", "Grid", "Points"}, Rows: [][]string{
					{"2", "1", "Driver A", "Team A", "10", "2", "18"},
					{"1", "2", "Driver B", "Team B", "10", "1", "25"},
				}},
			},
		},
	}, nil)

	got, err := buildDriverStatsFromJSON(dataDir, "F2", "2026")
	if err != nil {
		t.Fatal(err)
	}
	a := statsRowByDriver(t, got.Rows, "Driver A")
	// Sprint does not inherit Q for avg start; Feature Grid 2 only.
	if a.AvgStart != 2 {
		t.Fatalf("Driver A AvgStart = %v, want 2 (Feature Grid only; Sprint ignores Q)", a.AvgStart)
	}
	// Classified finishes 1 and 2 → avg finish 1.5
	if a.AvgFinish != 1.5 {
		t.Fatalf("Driver A AvgFinish = %v, want 1.5", a.AvgFinish)
	}
	// Q P1 maps to Feature pole only once (Feature Grid is 2, so pole via Grid? Grid==1 is B).
	// Driver A Feature Grid 2 → not pole from Grid. Sprint has no Q pole. Poles = 0.
	if a.Poles != 0 {
		t.Fatalf("Driver A Poles = %d, want 0", a.Poles)
	}
	b := statsRowByDriver(t, got.Rows, "Driver B")
	if b.AvgFinish != 1 {
		t.Fatalf("Driver B AvgFinish = %v, want 1 (DNF excluded)", b.AvgFinish)
	}
	if b.Wins != 1 {
		t.Fatalf("Driver B Wins = %d, want 1 (DNF must not count as win via row index)", b.Wins)
	}
	// Feature Grid 1 only (Sprint Q ignored).
	if b.AvgStart != 1 {
		t.Fatalf("Driver B AvgStart = %v, want 1", b.AvgStart)
	}
	if b.Poles != 1 {
		t.Fatalf("Driver B Poles = %d, want 1 (Feature Grid 1 only)", b.Poles)
	}
}

func TestStatsF2QualPoleNotDoubleCountedOnSprint(t *testing.T) {
	dataDir := t.TempDir()
	writeStatsTestEvent(t, dataDir, "F2", "f2_2026_pole", map[string]EventTable{
		"qualifying": {
			Headers: []string{"Pos", "No", "Driver", "Team"},
			Rows: [][]string{
				{"1", "1", "Pole Driver", "Team A"},
				{"2", "2", "Other Driver", "Team B"},
			},
		},
		"race": {
			Sessions: []EventTableSession{
				{Title: "Sprint Race", Headers: []string{"Pos", "No", "Driver", "Team", "Laps", "Points"}, Rows: [][]string{
					{"2", "1", "Pole Driver", "Team A", "10", "8"},
					{"1", "2", "Other Driver", "Team B", "10", "10"},
				}},
				{Title: "Feature Race", Headers: []string{"Pos", "No", "Driver", "Team", "Laps", "Points"}, Rows: [][]string{
					{"1", "1", "Pole Driver", "Team A", "10", "25"},
					{"2", "2", "Other Driver", "Team B", "10", "18"},
				}},
			},
		},
	}, nil)

	got, err := buildDriverStatsFromJSON(dataDir, "F2", "2026")
	if err != nil {
		t.Fatal(err)
	}
	a := statsRowByDriver(t, got.Rows, "Pole Driver")
	if a.Poles != 1 {
		t.Fatalf("Pole Driver Poles = %d, want 1 (Feature only; Sprint must not reuse Q)", a.Poles)
	}
	if a.AvgStart != 1 {
		t.Fatalf("Pole Driver AvgStart = %v, want 1 (Feature Q only)", a.AvgStart)
	}
}

func TestStatsPSCGuestsExcluded(t *testing.T) {
	dataDir := t.TempDir()
	writeStatsTestEvent(t, dataDir, "PSC", "psc_2026_1", map[string]EventTable{
		"race_results": {
			Headers: []string{"Pos", "No", "Driver", "Team", "Laps", "Grid", "Points"},
			Rows: [][]string{
				{"1", "99", "Guest Winner", "Guest Team", "10", "1", "0"},
				{"2", "1", "Regular Driver", "Regular Team", "10", "2", "25"},
			},
		},
	}, []EntryListRow{
		{Number: "99", Driver: "Guest Winner", Team: "Guest Team", Guest: true},
		{Number: "1", Driver: "Regular Driver", Team: "Regular Team"},
	})

	got, err := buildDriverStatsFromJSON(dataDir, "PSC", "2026")
	if err != nil {
		t.Fatal(err)
	}
	for _, row := range got.Rows {
		if row.Driver == "Guest Winner" {
			t.Fatalf("guest driver must not appear in PSC stats: %#v", row)
		}
	}
	a := statsRowByDriver(t, got.Rows, "Regular Driver")
	if a.Wins != 0 || a.Races != 1 || a.Poles != 0 {
		// Guest took P1/pole — eligible driver finished P2 without pole.
		t.Fatalf("unexpected Regular Driver stats: %#v", a)
	}
	if a.AvgFinish != 2 {
		t.Fatalf("Regular Driver AvgFinish = %v, want 2", a.AvgFinish)
	}
}

func TestSkipChampionshipMetricsEvent(t *testing.T) {
	cases := []struct {
		series, id string
		want       bool
	}{
		{"NASCAR_CUP", "NASCAR_CUP_2026_0", true},
		{"F1", "F1_2026_PRE_SEASON_TEST_1", true},
		{"IMSA", "IMSA_2026_PRE_SEASON_TEST", true},
		{"ELMS", "ELMS_2026_PROLOGUE", true},
		{"F2", "F2_2026_1", false},
		{"F1", "F1_2026_1", false},
	}
	for _, tc := range cases {
		if got := skipChampionshipMetricsEvent(tc.series, tc.id); got != tc.want {
			t.Errorf("skipChampionshipMetricsEvent(%q,%q)=%v want %v", tc.series, tc.id, got, tc.want)
		}
	}
}

func TestStatsFRECFinSTColumn(t *testing.T) {
	dataDir := t.TempDir()
	writeStatsTestEvent(t, dataDir, "FREC", "frec_2026_1", map[string]EventTable{
		"race": {
			Sessions: []EventTableSession{
				{Title: "Race 1", Headers: []string{"Fin / ST", "No.", "Driver", "Team", "Laps", "Pts"}, Rows: [][]string{
					{"1 / ST 2 ▲1", "51", "Kean Nakamura-Berta", "Prema Racing", "19", "25"},
					{"2 / ST 5 ▲3", "71", "Rashid Al Dhaheri", "R-ace GP", "19", "18"},
				}},
			},
		},
	}, nil)

	got, err := buildDriverStatsFromJSON(dataDir, "FREC", "2026")
	if err != nil {
		t.Fatal(err)
	}
	a := statsRowByDriver(t, got.Rows, "Kean Nakamura-Berta")
	if a.Wins != 1 || a.Races != 1 || a.Points != 25 {
		t.Fatalf("expected FREC win from Fin/ST, got %#v", a)
	}
	if a.AvgStart != 2 {
		t.Fatalf("expected avg start 2 from ST in Fin/ST, got %#v", a)
	}
}

func TestStatsELMSEntryListDriversWhenNoDriverColumn(t *testing.T) {
	dataDir := t.TempDir()
	writeStatsTestEvent(t, dataDir, "ELMS", "elms_2026_1", map[string]EventTable{
		"race": {Headers: []string{"Pos", "Class", "Car", "No.", "Team", "Laps", "Points"}, Rows: [][]string{
			{"1", "LMP2", "ORECA", "29", "FORESTIER RACING BY PANIS", "135", "25"},
			{"2", "LMP2", "ORECA", "34", "INTER EUROPOL COMPETITION", "135", "18"},
		}},
	}, []EntryListRow{
		{Number: "29", Class: "LMP2", Team: "FORESTIER RACING BY PANIS", Driver1: "Jonas Ried", Driver2: "Sebastian Priaulx", Driver3: "Mike Rockenfeller"},
		{Number: "34", Class: "LMP2", Team: "INTER EUROPOL COMPETITION", Driver1: "Driver X", Driver2: "Driver Y", Driver3: "Driver Z"},
	})

	got, err := buildDriverStatsFromJSON(dataDir, "ELMS", "2026")
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Rows) < 2 {
		t.Fatalf("expected ELMS crew rows from entry_list, got %#v", got.Rows)
	}
	winner := statsRowByDriver(t, got.Rows, "Jonas Ried / Sebastian Priaulx / Mike Rockenfeller")
	if winner.Wins != 1 || winner.Points != 25 || winner.Class != "LMP2" {
		t.Fatalf("unexpected ELMS winner stats: %#v", winner)
	}
}

func TestStatsLappedFinisherNotDNF(t *testing.T) {
	dataDir := t.TempDir()
	writeStatsTestEvent(t, dataDir, "F1", "f1_2026_1", map[string]EventTable{
		"race_results": {Headers: []string{"Pos", "No.", "Driver", "Constructor", "Laps", "Time/Retired", "Points"}, Rows: [][]string{
			{"1", "63", "George Russell", "Mercedes", "58", "1:23:06.801", "25"},
			{"2", "31", "Esteban Ocon", "Haas", "57", "+1 lap", "18"},
			{"3", "10", "Pierre Gasly", "Alpine", "40", "Collision", "0"},
		}},
	}, nil)

	got, err := buildDriverStatsFromJSON(dataDir, "F1", "2026")
	if err != nil {
		t.Fatal(err)
	}
	ocon := statsRowByDriver(t, got.Rows, "Esteban Ocon")
	if ocon.DNFs != 0 {
		t.Fatalf("lapped Ocon must not be DNF, got %#v", ocon)
	}
	gasly := statsRowByDriver(t, got.Rows, "Pierre Gasly")
	if gasly.DNFs != 1 {
		t.Fatalf("Collision must be DNF, got %#v", gasly)
	}
}
