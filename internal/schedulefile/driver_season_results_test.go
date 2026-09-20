package schedulefile

import (
	"path/filepath"
	"strings"
	"testing"

	"github.com/vX8q/tga/config"
	"github.com/vX8q/tga/models"
)

func TestBuildDriverSeasonResultsFromEvents_IMSAFoleyClassPos(t *testing.T) {
	dataDir := filepath.Join("..", "..", "data")
	results, err := BuildDriverSeasonResultsFromEvents(dataDir, "robby-foley", "2026")
	if err != nil {
		t.Fatalf("BuildDriverSeasonResultsFromEvents: %v", err)
	}
	want := map[string]int{
		"IMSA_2026_1": 10, // Daytona GTD class pos
		"IMSA_2026_2": 5,  // Sebring
		"IMSA_2026_3": 2,  // Long Beach
		"IMSA_2026_4": 7,  // Monterey
		"IMSA_2026_6": 7,  // Watkins Glen
	}
	for eventID, wantPos := range want {
		var row *models.DriverSeasonResult
		for i := range results {
			r := &results[i]
			if r.EventID != eventID || strings.EqualFold(r.RaceName, "Entry list") {
				continue
			}
			if !strings.EqualFold(r.SeriesID, "IMSA") || r.CarNumber != "96" {
				continue
			}
			row = r
			break
		}
		if row == nil {
			t.Fatalf("missing IMSA result for %s", eventID)
		}
		if row.CarNumber != "96" {
			t.Fatalf("%s car = %q, want 96", eventID, row.CarNumber)
		}
		if row.Position != wantPos {
			t.Fatalf("%s position = %d, want %d (overall vs class pos bug?)", eventID, row.Position, wantPos)
		}
		if row.Points <= 0 {
			t.Fatalf("%s points = %v, want > 0", eventID, row.Points)
		}
		if row.Points > 500 {
			t.Fatalf("%s points = %v looks like season total, want per-event points", eventID, row.Points)
		}
	}
}

func TestBuildDriverSeasonResultsFromEvents_F1PosDotHeader(t *testing.T) {
	dataDir := filepath.Join("..", "..", "data")
	results, err := BuildDriverSeasonResultsFromEvents(dataDir, "pierre-gasly", "2026")
	if err != nil {
		t.Fatalf("BuildDriverSeasonResultsFromEvents: %v", err)
	}

	var barcelona *struct {
		position int
		laps     int
		points   float64
		status   string
	}
	for _, r := range results {
		if r.EventID != "F1_2026_7" {
			continue
		}
		if strings.EqualFold(strings.TrimSpace(r.RaceName), "Entry list") {
			continue
		}
		rowCopy := r
		barcelona = &struct {
			position int
			laps     int
			points   float64
			status   string
		}{
			position: rowCopy.Position,
			laps:     rowCopy.Laps,
			points:   rowCopy.Points,
			status:   rowCopy.Status,
		}
		break
	}
	if barcelona == nil {
		t.Fatal("expected Barcelona race result for Pierre Gasly")
	}
	if barcelona.position != 7 {
		t.Fatalf("position = %d, want 7", barcelona.position)
	}
	if barcelona.laps != 65 {
		t.Fatalf("laps = %d, want 65", barcelona.laps)
	}
	if barcelona.points != 6 {
		t.Fatalf("points = %v, want 6", barcelona.points)
	}
}

func TestBuildDriverSeasonResultsFromEvents_PosDotRaceTablesHaveLaps(t *testing.T) {
	dataDir := filepath.Join("..", "..", "data")

	var checked int
	for _, champ := range config.Championships {
		events, err := LoadEvents(dataDir, champ.ID)
		if err != nil {
			continue
		}
		for _, ev := range events {
			if ev.Season != "2026" {
				continue
			}
			detail, err := LoadEventDetail(dataDir, ev.ID)
			if err != nil || detail == nil || detail.Tables == nil {
				continue
			}
			headers, rows, ok := tableHeadersRows(detail.Tables, "race_results")
			if !ok || len(headers) == 0 || len(rows) == 0 {
				continue
			}
			if colIndex(headers, "Pos.") < 0 {
				continue
			}
			driver := valueAt(rows[0], firstColIndex(headers, "Driver", "Drivers"))
			if driver == "" {
				continue
			}
			slug := driverSlugFromEntry(driver, detail.EntryList)
			if slug == "" {
				continue
			}
			results, err := BuildDriverSeasonResultsFromEvents(dataDir, slug, "2026")
			if err != nil {
				t.Fatalf("%s %s: BuildDriverSeasonResultsFromEvents: %v", ev.ID, slug, err)
			}
			found := false
			for _, r := range results {
				if r.EventID != ev.ID || strings.EqualFold(r.RaceName, "Entry list") {
					continue
				}
				found = true
				if r.Laps <= 0 {
					t.Errorf("%s driver %s: laps = %d, want > 0", ev.ID, slug, r.Laps)
				}
				if r.Position <= 0 {
					t.Errorf("%s driver %s: position = %d, want > 0", ev.ID, slug, r.Position)
				}
				break
			}
			if !found {
				t.Errorf("%s driver %s: no race result parsed", ev.ID, slug)
			}
			checked++
		}
	}
	if checked == 0 {
		t.Fatal("expected at least one Pos. race_results table in 2026 data")
	}
}

func driverSlugFromEntry(driver string, entry []EntryListRow) string {
	for _, e := range entry {
		if strings.EqualFold(strings.TrimSpace(e.Driver), strings.TrimSpace(driver)) {
			return strings.TrimSpace(e.DriverSlug)
		}
	}
	return ""
}

func TestParseDriverFromRaceTable_EmptyTeamUsesConstructor(t *testing.T) {
	headers := []string{"Pos", "No.", "Driver", "Team", "Constructor", "Laps", "Points"}
	rows := [][]string{
		{"1", "44", "Lewis Hamilton", "", "Mercedes", "57", "25"},
	}
	got := parseDriverFromRaceTable("F1", "Formula 1", "F1_2024_1", "Bahrain Grand Prix", "Feature", headers, rows, "lewis-hamilton", "2024", "Sakhir")
	if len(got) != 1 {
		t.Fatalf("got %d rows, want 1", len(got))
	}
	if got[0].TeamName != "Mercedes" {
		t.Fatalf("team = %q, want Mercedes from Constructor column", got[0].TeamName)
	}
}

func TestParseDriverFromRaceTable_FRECFinST(t *testing.T) {
	headers := []string{"Fin / ST", "No.", "Driver", "Team", "Laps", "Pts"}
	rows := [][]string{
		{"1 / ST 1 —", "51", "Kean Nakamura-Berta", "Prema Racing", "19", "27"},
		{"2 / ST 5 ▲3", "71", "Rashid Al Dhaheri", "R-ace GP", "19", "18"},
	}
	got := parseDriverFromRaceTable("FREC", "Formula Regional European Championship", "FREC_2026_1", "Spielberg", "Race 1", headers, rows, "kean-nakamura-berta", "2026", "Red Bull Ring")
	if len(got) != 1 {
		t.Fatalf("got %d rows, want 1 (Fin/ST tables were skipped as entry-list only)", len(got))
	}
	if got[0].Position != 1 {
		t.Fatalf("position = %d, want 1", got[0].Position)
	}
	if got[0].Points != 27 {
		t.Fatalf("points = %v, want 27", got[0].Points)
	}
	if got[0].Laps != 19 {
		t.Fatalf("laps = %d, want 19", got[0].Laps)
	}
}

func TestBuildDriverSeasonResultsFromEvents_NakamuraBertaHasRaceResults(t *testing.T) {
	dataDir := filepath.Join("..", "..", "data")
	results, err := BuildDriverSeasonResultsFromEvents(dataDir, "kean-nakamura-berta", "2026")
	if err != nil {
		t.Fatalf("BuildDriverSeasonResultsFromEvents: %v", err)
	}
	var raceRows, entryOnly int
	for _, r := range results {
		if !strings.EqualFold(r.SeriesID, "FREC") {
			continue
		}
		if strings.EqualFold(strings.TrimSpace(r.RaceName), "Entry list") {
			entryOnly++
			continue
		}
		raceRows++
		if r.Position <= 0 && r.Laps <= 0 {
			t.Errorf("%s %s: empty race parse (pos=%d laps=%d)", r.EventID, r.RaceName, r.Position, r.Laps)
		}
	}
	if raceRows == 0 {
		t.Fatalf("expected FREC race results for Kean Nakamura-Berta, got %d entry-list-only rows", entryOnly)
	}
}

func TestFillEmptyDriverTeamNames_FromEntryList(t *testing.T) {
	rows := []models.DriverSeasonResult{
		{TeamName: "", CarNumber: "44", EventID: "F1_2024_1"},
		{TeamName: "Ferrari", CarNumber: "44", EventID: "F1_2025_1"},
	}
	entry := []EntryListRow{
		{Number: "44", Driver: "Lewis Hamilton", Team: "Mercedes-AMG Petronas F1 Team", Constructor: "Mercedes", DriverSlug: "lewis-hamilton"},
	}
	fillEmptyDriverTeamNames(rows, entry, "lewis-hamilton")
	if rows[0].TeamName != "Mercedes-AMG Petronas F1 Team" {
		t.Fatalf("filled team = %q", rows[0].TeamName)
	}
	if rows[1].TeamName != "Ferrari" {
		t.Fatalf("existing team overwritten: %q", rows[1].TeamName)
	}
}

func TestFillEmptyDriverTeamNames_ConstructorWhenTeamBlank(t *testing.T) {
	rows := []models.DriverSeasonResult{{TeamName: "—", CarNumber: "44"}}
	entry := []EntryListRow{
		{Number: "44", Driver: "Lewis Hamilton", Team: "", Constructor: "Mercedes", DriverSlug: "lewis-hamilton"},
	}
	fillEmptyDriverTeamNames(rows, entry, "lewis-hamilton")
	if rows[0].TeamName != "Mercedes" {
		t.Fatalf("team = %q, want Mercedes constructor", rows[0].TeamName)
	}
}

func TestImsaClassPosition_FallsBackToClassRanking(t *testing.T) {
	headers := []string{"POS", "CAR NO", "DRIVERS", "CLASS", "CLASS POS"}
	rows := [][]string{
		{"24", "912", "A", "GTD", "1"},
		{"30", "96", "B", "GTD", ""},
		{"31", "023", "C", "GTD", ""},
		{"10", "31", "D", "GTP", "1"},
	}
	got := imsaClassPosition(headers, rows, rows[1])
	if got != 2 {
		t.Fatalf("got class pos %d, want 2", got)
	}
}
