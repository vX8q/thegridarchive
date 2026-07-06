package schedulefile

import (
	"path/filepath"
	"strings"
	"testing"
)

func findStandingRowByDriverSubstr(rows []StandingRow, substr string) *StandingRow {
	substr = strings.ToLower(substr)
	for i := range rows {
		if strings.Contains(strings.ToLower(rows[i].Driver), substr) {
			return &rows[i]
		}
	}
	return nil
}

func raceOrderContains(order []string, code string) bool {
	for _, c := range order {
		if c == code {
			return true
		}
	}
	return false
}

func TestBuildStandingsFromEvents_ARCA2026_ElkRound(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatalf("abs data dir: %v", err)
	}
	data, err := BuildStandingsFromEvents(dataDir, "ARCA", "2026")
	if err != nil {
		t.Fatalf("BuildStandingsFromEvents: %v", err)
	}
	if data == nil || len(data.Rows) == 0 {
		t.Fatal("expected non-empty ARCA standings")
	}
	if !raceOrderContains(data.RaceOrder, "ELK") {
		t.Fatalf("race_order missing ELK: %v", data.RaceOrder)
	}
	if !raceOrderContains(data.CompletedRaces, "ELK") {
		t.Fatalf("completed_races missing ELK: %v", data.CompletedRaces)
	}

	reaves := findStandingRowByDriverSubstr(data.Rows, "Max Reaves")
	if reaves == nil {
		t.Fatal("Max Reaves missing from ARCA standings")
	}
	if reaves.Races["ELK"] != "1" {
		t.Errorf("Reaves ELK finish = %q, want 1", reaves.Races["ELK"])
	}

	bollman := findStandingRowByDriverSubstr(data.Rows, "Jake Bollman")
	if bollman == nil {
		t.Fatal("Jake Bollman missing from ARCA standings")
	}
	if bollman.Races["ELK"] != "2" {
		t.Errorf("Bollman ELK finish = %q, want 2", bollman.Races["ELK"])
	}
	if parseGtwcePointsCell(bollman.Points) < parseGtwcePointsCell(reaves.Points) {
		t.Errorf("Bollman total %q should exceed Reaves %q after Elko (Bollman 92 vs Reaves 47 race pts)",
			bollman.Points, reaves.Points)
	}
}
