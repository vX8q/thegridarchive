package schedulefile

import (
	"path/filepath"
	"testing"
)

func TestBuildDTMStandings2026PointsAfterOschersleben(t *testing.T) {
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

	// Totals after Round 5 (Oschersleben): race Pts are finish-only;
	// qualifying 3/2/1 added by applyDTMQualifyingAwards (matches dtm.com).
	want := map[string]string{
		"Maro Engel":           "145",
		"Nicki Thiim":          "124",
		"Lucas Auer":           "123",
		"Thomas Preining":      "117",
		"Matteo Cairoli":       "94",
		"Arjun Maini":          "94",
		"Marco Wittmann":       "91",
		"Ben Dorr":             "76",
		"Thierry Vermeulen":    "75",
		"Mirko Bortolotti":     "73",
		"Kelvin van der Linde": "72",
		"Luca Engstler":        "67",
		"Jules Gounon":         "66",
		"Ricardo Feller":       "64",
		"Finn Wiebelhaus":      "63",
		"Marco Mapelli":        "33",
		"Bastian Buus":         "30",
		"Tom Kalender":         "24",
		"Timo Glock":           "21",
		"Maximilian Paul":      "5",
		"Nicolas Baert":        "2",
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
