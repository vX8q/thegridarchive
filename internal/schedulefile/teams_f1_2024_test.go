package schedulefile

import (
	"path/filepath"
	"runtime"
	"testing"
)

func TestEnrichTeamsRoundsFromEvents_F1_2024_FromEntryList(t *testing.T) {
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller failed")
	}
	dataDir := filepath.Clean(filepath.Join(filepath.Dir(thisFile), "..", "..", "data"))

	data := &TeamsWithSpec{} // no curated rows — build from entry_list
	EnrichTeamsRoundsFromEvents(dataDir, "f1", "2024", data)
	if len(data.Teams) == 0 {
		t.Fatal("expected teams built from F1 2024 entry_list")
	}

	check := func(driver, team, constructor, chassis, pu, wantRounds string) {
		t.Helper()
		var found *TeamJSON
		for i := range data.Teams {
			tm := &data.Teams[i]
			if tm.Driver == driver && (team == "" || tm.Team == team) {
				found = tm
				break
			}
		}
		if found == nil {
			t.Fatalf("missing driver %q team %q", driver, team)
			return
		}
		if found.Manufacturer != constructor {
			t.Fatalf("%s/%s constructor: got %q want %q", driver, team, found.Manufacturer, constructor)
		}
		if found.Chassis != chassis {
			t.Fatalf("%s/%s chassis: got %q want %q", driver, team, found.Chassis, chassis)
		}
		if found.PowerUnit != pu {
			t.Fatalf("%s/%s power_unit: got %q want %q", driver, team, found.PowerUnit, pu)
		}
		if wantRounds != "" && found.Rounds != wantRounds {
			t.Fatalf("%s/%s rounds: got %q want %q", driver, team, found.Rounds, wantRounds)
		}
	}

	check("Max Verstappen", "", "Red Bull Racing-Honda RBPT", "RB20", "Honda RBPTH002", "1–24")
	check("Pierre Gasly", "", "Alpine-Renault", "A524", "Renault E-Tech RE24", "1–24")
	check("Jack Doohan", "", "Alpine-Renault", "A524", "Renault E-Tech RE24", "24")
	check("Oliver Bearman", "Scuderia Ferrari", "Ferrari", "SF-24", "Ferrari 066/12", "2")
	check("Oliver Bearman", "MoneyGram Haas F1 Team", "Haas-Ferrari", "VF-24", "Ferrari 066/10", "17, 21")
	check("Kevin Magnussen", "", "Haas-Ferrari", "VF-24", "Ferrari 066/10", "1–16, 18–20, 22–24")
	check("Carlos Sainz Jr.", "", "Ferrari", "SF-24", "Ferrari 066/12", "1, 3–24")
	check("Franco Colapinto", "", "Williams-Mercedes", "FW46", "Mercedes-AMG F1 M15", "16–24")
	check("Liam Lawson", "", "RB-Honda RBPT", "VCARB 01", "Honda RBPTH002", "19–24")
	check("Logan Sargeant", "", "Williams-Mercedes", "FW46", "Mercedes-AMG F1 M15", "1–15")

	if data.Teams[0].Team != "BWT Alpine F1 Team" {
		t.Fatalf("first team want Alpine, got %q", data.Teams[0].Team)
	}
}
