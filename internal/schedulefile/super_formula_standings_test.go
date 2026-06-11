package schedulefile

import (
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

func TestBuildStandingsFromEvents_SuperFormula2026_RoundColumns(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatalf("abs data dir: %v", err)
	}
	data, err := BuildStandingsFromEvents(dataDir, "SUPER_FORMULA", "2026")
	if err != nil {
		t.Fatalf("BuildStandingsFromEvents: %v", err)
	}
	if data == nil || len(data.RaceOrder) < 5 {
		t.Fatalf("race_order: got %v", data.RaceOrder)
	}
	if data.RaceOrder[0] != "R1" || data.RaceOrder[1] != "R2" || data.RaceOrder[2] != "R3" || data.RaceOrder[3] != "R4" || data.RaceOrder[4] != "R5" {
		t.Fatalf("expected R1..R5 prefix, got %v", data.RaceOrder[:5])
	}
	completed := map[string]bool{}
	for _, c := range data.CompletedRaces {
		completed[c] = true
	}
	if !completed["R3"] {
		t.Fatal("R3 (cancelled Autopolis) should be in completed_races")
	}
	if !completed["R4"] || !completed["R5"] {
		t.Fatalf("Suzuka rounds missing from completed: %v", data.CompletedRaces)
	}
	var ohta *StandingRow
	for i := range data.Rows {
		if data.Rows[i].Driver == "Kakunoshin Ohta" {
			ohta = &data.Rows[i]
			break
		}
	}
	if ohta == nil {
		t.Fatal("Ohta not in standings")
	}
	if ohta.Races["R3"] != "—" {
		t.Errorf("Ohta R3 want dash, got %q", ohta.Races["R3"])
	}
	if ohta.Races["R4"] == "" || ohta.Races["R5"] == "" {
		t.Errorf("Ohta Suzuka: R4=%q R5=%q", ohta.Races["R4"], ohta.Races["R5"])
	}
	if ohta.Races["R3"] != "" && ohta.Races["R4"] == ohta.Races["R3"] {
		t.Error("Suzuka results should not be in R3 column")
	}
}

func TestBuildStandingsFromEvents_SuperFormula_AutopolisQualiPoints(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatalf("abs data dir: %v", err)
	}
	data, err := BuildStandingsFromEvents(dataDir, "SUPER_FORMULA", "2026")
	if err != nil {
		t.Fatalf("BuildStandingsFromEvents: %v", err)
	}
	var iwas *StandingRow
	for i := range data.Rows {
		if data.Rows[i].Driver == "Ayumu Iwasa" {
			iwas = &data.Rows[i]
			break
		}
	}
	if iwas == nil {
		t.Fatal("Iwasa not found")
	}
	if iwas.Races["R3"] != "—" {
		t.Errorf("Iwasa R3 race cell want dash, got %q", iwas.Races["R3"])
	}
	total, err := strconv.ParseFloat(strings.TrimSpace(iwas.Points), 64)
	if err != nil || total < 3 {
		t.Errorf("Iwasa should have at least 3 quali points on R3, total=%v", iwas.Points)
	}
}

func TestSuperFormulaSessionRoundNumber(t *testing.T) {
	rounds := []int{4, 5}
	if got := superFormulaSessionRoundNumber("Race Round 5", 1, rounds); got != 5 {
		t.Errorf("title: got %d want 5", got)
	}
	if got := superFormulaSessionRoundNumber("", 0, []int{3}); got != 3 {
		t.Errorf("fallback: got %d want 3", got)
	}
}
