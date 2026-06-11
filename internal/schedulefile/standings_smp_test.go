package schedulefile

import (
	"path/filepath"
	"strings"
	"testing"
)

func containsDriver(name, sub string) bool {
	return strings.Contains(strings.ToLower(name), strings.ToLower(sub))
}

func TestBuildStandings_SMPF4Ru_Moscow(t *testing.T) {
	dataDir := filepath.Join("..", "..", "data")
	data, err := BuildStandingsFromEvents(dataDir, "SMP_F4_RU", "2026")
	if err != nil {
		t.Fatalf("BuildStandingsFromEvents: %v", err)
	}
	if data == nil || len(data.Rows) == 0 {
		t.Fatal("expected standings rows")
	}
	wantOrder := []string{"R1-R1", "R1-R2", "R1-R3", "R1-R4"}
	if len(data.RaceOrder) < len(wantOrder) {
		t.Fatalf("race_order: got %v", data.RaceOrder)
	}
	for i, code := range wantOrder {
		if data.RaceOrder[i] != code {
			t.Fatalf("race_order[%d]: got %q want %q", i, data.RaceOrder[i], code)
		}
	}
	var verk *StandingRow
	for i := range data.Rows {
		d := data.Rows[i].Driver
		if d == "V. Verkholantsev" || d == "Verkholantsev" || containsDriver(d, "Verkholantsev") {
			verk = &data.Rows[i]
			break
		}
	}
	if verk == nil {
		for _, r := range data.Rows {
			t.Logf("row: %q car=%q pts=%s", r.Driver, r.Car, r.Points)
		}
		t.Fatal("Verkholantsev not found in standings")
	}
	if verk.Races["R1-R1"] != "2" {
		t.Errorf("R1 fin: got %q want 2", verk.Races["R1-R1"])
	}
	if verk.Races["R1-R2"] != "4" {
		t.Errorf("R2 fin: got %q want 4", verk.Races["R1-R2"])
	}
	if verk.Races["R1-R3"] != "2" {
		t.Errorf("R3 fin: got %q want 2", verk.Races["R1-R3"])
	}
	if verk.Races["R1-R4"] != "2" {
		t.Errorf("R4 fin: got %q want 2", verk.Races["R1-R4"])
	}
	if verk.Points != "77" {
		t.Errorf("total points (sum 6 sessions): got %q want 77", verk.Points)
	}
	var pigaev *StandingRow
	for i := range data.Rows {
		if containsDriver(data.Rows[i].Driver, "Pigaev") {
			pigaev = &data.Rows[i]
			break
		}
	}
	if pigaev == nil || pigaev.Points != "74" {
		t.Fatalf("Pigaev points: got %v want 74", pigaev)
	}
	if len(data.EventNames) < 4 || data.EventNames[0] != "MRA1" {
		t.Errorf("event label: got %v want MRA1 for round 1", data.EventNames)
	}
	var guba *StandingRow
	for i := range data.Rows {
		if containsDriver(data.Rows[i].Driver, "Guba") {
			guba = &data.Rows[i]
			break
		}
	}
	if guba == nil {
		t.Fatal("Guba not found in standings")
	}
	if guba.Races["R1-R1"] != "17" || guba.Races["R1-R2"] != "16" || guba.Races["R1-R3"] != "16" || guba.Races["R1-R4"] != "18" {
		t.Errorf("Guba fins: got R1=%q R2=%q R3=%q R4=%q", guba.Races["R1-R1"], guba.Races["R1-R2"], guba.Races["R1-R3"], guba.Races["R1-R4"])
	}
}
