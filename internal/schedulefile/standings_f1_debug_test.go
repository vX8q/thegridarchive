package schedulefile

import (
	"path/filepath"
	"testing"
)

func TestF1Standings2026_SprintWeekendFeatureRaceAndMonaco(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatalf("abs data dir: %v", err)
	}
	data, err := BuildStandingsFromEvents(dataDir, "F1", "2026")
	if err != nil {
		t.Fatalf("build: %v", err)
	}

	// Pre-season tests must not appear in standings.
	for _, name := range data.EventNames {
		if name == "Pre-Season Testing 1" || name == "Pre-Season Testing 2" {
			t.Fatalf("pre-season event in standings: %q", name)
		}
	}

	var ant *StandingRow
	for i := range data.Rows {
		if data.Rows[i].Driver == "Kimi Antonelli" {
			ant = &data.Rows[i]
			break
		}
	}
	if ant == nil {
		t.Fatal("Kimi Antonelli not in standings")
	}

	// Canadian GP = R5S/R5F, Monaco = R6 (no pre-season shift).
	if v := ant.Races["R5S"]; v == "" {
		t.Errorf("Canada sprint R5S empty, races=%v", ant.Races)
	}
	if v := ant.Races["R5F"]; v != "1" {
		t.Errorf("Canada feature R5F = %q, want 1", v)
	}
	if v := ant.Races["R6"]; v != "1" {
		t.Errorf("Monaco R6 = %q, want 1", v)
	}

	found := false
	for _, code := range data.CompletedRaces {
		if code == "R5F" || code == "R6" {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("completed races missing R5F/R6: %v", data.CompletedRaces)
	}
}

func TestF1SprintWeekendTables_Canada(t *testing.T) {
	dataDir, _ := filepath.Abs(filepath.Join("..", "..", "data"))
	sprint, feature, _, ok := f1SprintWeekendTables(dataDir, "F1_2026_5")
	if !ok {
		t.Fatal("expected sprint weekend tables for Canada")
	}
	if len(sprint.Rows) == 0 || len(feature.Rows) == 0 {
		t.Fatalf("empty sprint/feature rows: sprint=%d feature=%d", len(sprint.Rows), len(feature.Rows))
	}
}
