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

	want := map[string]string{
		"Tsolov":         "161",
		"Minì":           "134",
		"Câmara":         "125",
		"Dunne":          "108",
		"León":           "69",
		"Maini":          "63",
		"Beganovic":      "63",
		"Stenshorne":     "58",
		"Hoepen":         "47",
		"Villagómez":     "38",
		"Miyata":         "34",
		"Montoya":        "28",
		"Goethe":         "29",
		"Inthraphuvasak": "46",
		"Dürksen":        "36",
		"Bilinski":       "24",
		"Herta":          "26",
		"Bennett":        "17",
		"Varrone":        "14",
		"Shields":        "10",
		"Fittipaldi":     "10",
		"Boya":           "12",
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
