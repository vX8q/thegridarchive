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
