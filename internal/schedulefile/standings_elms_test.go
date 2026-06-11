package schedulefile

import (
	"path/filepath"
	"testing"
)

func TestLoadStandings_ELMS_HasClassTables(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatalf("abs data dir: %v", err)
	}
	data, err := LoadStandings(dataDir, "ELMS")
	if err != nil {
		t.Fatalf("LoadStandings: %v", err)
	}
	if data == nil {
		t.Fatal("nil standings")
	}
	if len(data.Classes) == 0 {
		t.Fatal("expected classes in elms.json")
	}
	if len(data.RaceOrder) < 2 {
		t.Fatalf("race_order: %v", data.RaceOrder)
	}
	var lmp2 *StandingsClass
	for i := range data.Classes {
		if data.Classes[i].ID == "LMP2" {
			lmp2 = &data.Classes[i]
			break
		}
	}
	if lmp2 == nil || len(lmp2.Rows) == 0 {
		t.Fatal("LMP2 class missing or empty")
	}
	if lmp2.Rows[0].Races["BAR"] == "" || lmp2.Rows[0].Races["LEC"] == "" {
		t.Errorf("LMP2 leader missing BAR/LEC: %#v", lmp2.Rows[0].Races)
	}
}

func TestBuildStandingsFromEvents_ELMS_FallsBackToBaseClasses(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatalf("abs data dir: %v", err)
	}
	data, err := BuildStandingsFromEvents(dataDir, "ELMS", "2026")
	if err != nil {
		t.Fatalf("BuildStandingsFromEvents: %v", err)
	}
	if data == nil {
		t.Fatal("nil standings")
	}
	if len(data.Rows) != 0 {
		t.Fatalf("auto-build should not produce driver rows (race tables lack Driver column), got %d", len(data.Rows))
	}
	if len(data.Classes) == 0 {
		t.Fatal("when auto-build finds no drivers, standings should fall back to class tables from elms.json")
	}
}
