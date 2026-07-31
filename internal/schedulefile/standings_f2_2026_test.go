package schedulefile

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestBuildStandingsFromEvents_F2_2026_OfficialTotals(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatalf("abs data dir: %v", err)
	}
	data, err := BuildStandingsFromEvents(dataDir, "F2", "2026")
	if err != nil {
		t.Fatalf("BuildStandingsFromEvents: %v", err)
	}
	if data == nil {
		t.Fatal("nil standings")
	}

	// Official FIA F2 2026 driver totals (after Hungary / round 9), matching event Pts sums.
	want := map[string]string{
		"Tsolov":         "167",
		"Mini":           "147",
		"Camara":         "145",
		"Dunne":          "108",
		"Leon":           "94",
		"Maini":          "88",
		"Beganovic":      "79",
		"Hoepen":         "65",
		"Stenshorne":     "59",
		"Inthraphuvasak": "59",
		"Durksen":        "42",
		"Villagomez":     "38",
		"Miyata":         "34",
		"Goethe":         "29",
		"Montoya":        "28",
		"Herta":          "26",
		"Bilinski":       "24",
		"Bennett":        "18",
		"Varrone":        "14",
		"Boya":           "12",
		"Shields":        "10",
		"Fittipaldi":     "10",
	}

	for key, wantPts := range want {
		var found *StandingRow
		for i := range data.Rows {
			if strings.Contains(data.Rows[i].Driver, key) {
				found = &data.Rows[i]
				break
			}
		}
		if found == nil {
			t.Errorf("driver %q not found in standings", key)
			continue
		}
		if found.Points != wantPts {
			t.Errorf("%s total points: got %q want %q", found.Driver, found.Points, wantPts)
		}
	}
}
