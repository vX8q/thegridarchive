package schedulefile

import (
	"path/filepath"
	"testing"
)

func TestBuildStandingsFromEvents_FREC_SpaCancelledRace2(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatalf("abs data dir: %v", err)
	}
	data, err := BuildStandingsFromEvents(dataDir, "FREC", "2026")
	if err != nil {
		t.Fatalf("BuildStandingsFromEvents: %v", err)
	}
	if data == nil {
		t.Fatal("nil standings")
	}

	var popov *StandingRow
	for i := range data.Rows {
		if data.Rows[i].Car == "33" {
			popov = &data.Rows[i]
			break
		}
	}
	if popov == nil {
		t.Fatal("car #33 (Popov) not found in standings")
	}
	if popov.Races["R3-2"] != "—" {
		t.Errorf("cancelled Spa Race 2 (R3-2): got %q want em dash", popov.Races["R3-2"])
	}
	if popov.Races["R3-3"] != "1" {
		t.Errorf("Spa Race 3 winner should be in R3-3: got %q want 1", popov.Races["R3-3"])
	}
	if popov.Races["R3-1"] == "" {
		t.Errorf("expected Spa Race 1 in R3-1, got %#v", popov.Races)
	}
}
