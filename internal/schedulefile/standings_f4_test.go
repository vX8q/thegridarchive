package schedulefile

import (
	"path/filepath"
	"testing"
)

func TestBuildStandingsFromEvents_F4IT_MisanoMergedByCar(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatalf("abs data dir: %v", err)
	}
	data, err := BuildStandingsFromEvents(dataDir, "F4_IT", "2026")
	if err != nil {
		t.Fatalf("BuildStandingsFromEvents: %v", err)
	}
	if data == nil {
		t.Fatal("nil standings")
	}
	var aksoy *StandingRow
	for i := range data.Rows {
		if data.Rows[i].Car == "10" {
			aksoy = &data.Rows[i]
			break
		}
	}
	if aksoy == nil {
		t.Fatal("car #10 not found in standings")
	}
	// Aksoy ran Race 1, Race 2 and Final (not Race 3 — other heat groups).
	if aksoy.Races["R1-1"] == "" || aksoy.Races["R1-2"] == "" || aksoy.Races["R1-4"] == "" {
		t.Errorf("expected R1-1, R1-2, R1-4 filled, got %#v", aksoy.Races)
	}
	if aksoy.Races["R1-3"] != "" {
		t.Errorf("Aksoy did not start Race 3, got %q", aksoy.Races["R1-3"])
	}
	if aksoy.Races["R1-1"] != "1" {
		t.Errorf("R1-1: got %q want 1", aksoy.Races["R1-1"])
	}
	if standingsRacePosCell("F4_IT", "1*30") != "1" {
		t.Errorf("standingsRacePosCell: got %q", standingsRacePosCell("F4_IT", "1*30"))
	}
	if aksoy.Driver != "Alp Aksoy" {
		t.Errorf("driver name: got %q want Alp Aksoy", aksoy.Driver)
	}
	// Misano (R1) = 82 pts; Vallelunga (R2) adds 62 after event 2 was published.
	if aksoy.Points != "144" {
		t.Errorf("total points: got %q want 144", aksoy.Points)
	}
	if aksoy.Races["R2-1"] == "" {
		t.Errorf("expected Vallelunga R2-1 filled after round 2, got %#v", aksoy.Races)
	}
}

func TestStandingsAggregateKey_F4UsesCar(t *testing.T) {
	k1 := standingsAggregateKey("F4_IT", "A. Aksoy", "10")
	k2 := standingsAggregateKey("F4_IT", "Alp Aksoy", "10")
	if k1 != k2 {
		t.Fatalf("keys differ: %q vs %q", k1, k2)
	}
}
