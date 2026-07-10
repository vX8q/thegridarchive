package schedulefile

import (
	"path/filepath"
	"testing"
)

func TestBuildDTMStandings2026PointsAfterNorisring(t *testing.T) {
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

	want := map[string]string{
		"Nicki Thiim":          "117",
		"Maro Engel":           "108",
		"Lucas Auer":           "106",
		"Matteo Cairoli":       "83",
		"Marco Wittmann":       "77",
		"Ben Dörr":             "76",
		"Arjun Maini":          "74",
		"Thomas Preining":      "70",
		"Thierry Vermeulen":    "67",
		"Finn Wiebelhaus":      "63",
		"Jules Gounon":         "59",
		"Kelvin van der Linde": "54",
		"Ricardo Feller":       "50",
		"Mirko Bortolotti":     "37",
		"Luca Engstler":        "32",
		"Marco Mapelli":        "31",
		"Bastian Buus":         "23",
		"Tom Kalender":         "21",
		"Timo Glock":           "13",
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
		"Qualifying (Race 1)":             1,
		"Qualifying (Race 2)":             2,
		"Qualifying (Race 1) - Group A":   1,
		"Qualifying (Race 2) - Group B":   2,
		"Practice 1":                      0,
	}
	for title, want := range cases {
		if got := dtmQualifyingRaceIndexFromTitle(title); got != want {
			t.Errorf("dtmQualifyingRaceIndexFromTitle(%q) = %d, want %d", title, got, want)
		}
	}
}
