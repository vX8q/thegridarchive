package schedulefile

import (
	"path/filepath"
	"testing"
)

func TestBuildDTMStandings2026PointsAfterLausitzring(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatal(err)
	}
	st, err := BuildStandingsFromEvents(dataDir, "DTM", "2026")
	if err != nil {
		t.Fatalf("BuildStandingsFromEvents: %v", err)
	}
	if st == nil {
		t.Fatal("nil standings")
	}

	// Totals after Round 6 (Lausitzring): race Pts are finish-only;
	// qualifying 3/2/1 added by applyDTMQualifyingAwards (matches dtm.com).
	want := map[string]string{
		"Maro Engel":           "155",
		"Thomas Preining":      "155",
		"Nicki Thiim":          "138",
		"Lucas Auer":           "135",
		"Marco Wittmann":       "132",
		"Matteo Cairoli":       "126",
		"Arjun Maini":          "107",
		"Ben Dorr":             "91",
		"Luca Engstler":        "86",
		"Mirko Bortolotti":     "84",
		"Jules Gounon":         "79",
		"Thierry Vermeulen":    "79",
		"Ricardo Feller":       "76",
		"Kelvin van der Linde": "72",
		"Finn Wiebelhaus":      "63",
		"Tom Kalender":         "44",
		"Bastian Buus":         "42",
		"Marco Mapelli":        "40",
		"Timo Glock":           "29",
		"Nicolas Baert":        "7",
		"Maximilian Paul":      "5",
	}

	got := make(map[string]string, len(st.Rows))
	for _, row := range st.Rows {
		got[row.Driver] = row.Points
	}
	for driver, wantPts := range want {
		if got[driver] != wantPts {
			t.Errorf("%s points = %q, want %q", driver, got[driver], wantPts)
		}
	}
}

func TestDTMQualifyingRaceIndexFromTitle(t *testing.T) {
	cases := map[string]int{
		"Qualifying (Race 1)":           1,
		"Qualifying (Race 2)":           2,
		"Qualifying (Race 1) - Group A": 1,
		"Qualifying (Race 2) - Group B": 2,
		"Practice 1":                    0,
	}
	for title, want := range cases {
		if got := dtmQualifyingRaceIndexFromTitle(title); got != want {
			t.Errorf("dtmQualifyingRaceIndexFromTitle(%q) = %d, want %d", title, got, want)
		}
	}
}
