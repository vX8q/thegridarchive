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

func TestBuildStandingsFromEvents_FREC_MaosherjiAfterHungaroring(t *testing.T) {
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

	var maosherji *StandingRow
	for i := range data.Rows {
		if data.Rows[i].Car == "3" {
			maosherji = &data.Rows[i]
			break
		}
	}
	if maosherji == nil {
		t.Fatal("car #3 (Maosherji) not found in standings")
	}
	if maosherji.Points != "15" {
		t.Errorf("total points: got %q want 15", maosherji.Points)
	}
	if maosherji.Races["R4-2"] != "9" {
		t.Errorf("Monza R2 (sprint): got %q want 9", maosherji.Races["R4-2"])
	}
	if maosherji.Races["R4-3"] != "10" {
		t.Errorf("Monza R3: got %q want 10", maosherji.Races["R4-3"])
	}
	if maosherji.Races["R5-1"] != "6" {
		t.Errorf("Hungaroring R1: got %q want 6", maosherji.Races["R5-1"])
	}
	if maosherji.Races["R5-2"] != "8" {
		t.Errorf("Hungaroring R2: got %q want 8", maosherji.Races["R5-2"])
	}

	for i := range data.Rows {
		if data.Rows[i].Car == "3" && i > 0 && data.Rows[i-1].Car == "3" {
			t.Fatal("duplicate standings row for car #3")
		}
	}
}

func TestBuildStandingsFromEvents_FREC_GomezAfterHungaroring(t *testing.T) {
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

	var gomez *StandingRow
	for i := range data.Rows {
		if data.Rows[i].Car == "78" {
			gomez = &data.Rows[i]
			break
		}
	}
	if gomez == nil {
		t.Fatal("car #78 (Gomez) not found in standings")
	}
	if gomez.Points != "48" {
		t.Errorf("total points: got %q want 48", gomez.Points)
	}
	if gomez.Races["R1-3"] != "7" {
		t.Errorf("Spielberg R3: got %q want 7", gomez.Races["R1-3"])
	}
	if gomez.Races["R3-1"] != "9" {
		t.Errorf("Spa R1: got %q want 9", gomez.Races["R3-1"])
	}
	if gomez.Races["R3-3"] != "17" {
		t.Errorf("Spa R3: got %q want 17", gomez.Races["R3-3"])
	}
	if gomez.Races["R4-3"] != "4" {
		t.Errorf("Monza R3: got %q want 4", gomez.Races["R4-3"])
	}
	if gomez.Races["R5-2"] != "10" {
		t.Errorf("Hungaroring R2: got %q want 10", gomez.Races["R5-2"])
	}
}
