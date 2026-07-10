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
		"Tsolov":         "141",
		"Minì":           "124",
		"Câmara":         "94",
		"Dunne":          "92",
		"León":           "69",
		"Maini":          "63",
		"Beganovic":      "57",
		"Stenshorne":     "48",
		"Hoepen":         "47",
		"Villagómez":     "30",
		"Miyata":         "30",
		"Montoya":        "28",
		"Goethe":         "28",
		"Inthraphuvasak": "28",
		"Dürksen":        "26",
		"Bilinski":       "22",
		"Herta":          "20",
		"Bennett":        "17",
		"Varrone":        "14",
		"Shields":        "10",
		"Fittipaldi":     "10",
		"Boya":           "10",
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
