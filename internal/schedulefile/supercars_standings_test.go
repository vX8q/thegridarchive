package schedulefile

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestBuildSupercarsStandingsFromEvents_SessionPerRace(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatalf("abs data dir: %v", err)
	}
	data, err := BuildStandingsFromEvents(dataDir, "SUPERCARS", "2026")
	if err != nil {
		t.Fatalf("BuildStandingsFromEvents: %v", err)
	}
	if data == nil || len(data.Rows) == 0 {
		t.Fatal("expected non-empty supercars standings")
	}
	if len(data.RaceOrder) != len(data.CompletedRaces) {
		t.Fatalf("race_order=%d completed=%d, want same length (no future columns)", len(data.RaceOrder), len(data.CompletedRaces))
	}
	if len(data.RaceOrder) > 25 {
		t.Fatalf("race_order=%d, unexpected future columns", len(data.RaceOrder))
	}
	for _, code := range []string{"SMP1", "SMP2", "SMP3", "MLB1", "MLB4", "TPO1", "DAR3"} {
		if _, ok := findRaceCode(data.RaceOrder, code); !ok {
			t.Fatalf("missing race code %q in %v", code, data.RaceOrder)
		}
	}
	for _, old := range []string{"MLB5", "TPO8", "TSV20", "ADL37"} {
		if _, ok := findRaceCode(data.RaceOrder, old); ok {
			t.Fatalf("unexpected future/global code %q in %v", old, data.RaceOrder)
		}
	}
	var kostecki *StandingRow
	for i := range data.Rows {
		if data.Rows[i].Driver == "Brodie Kostecki" {
			kostecki = &data.Rows[i]
			break
		}
	}
	if kostecki == nil || kostecki.Races == nil {
		t.Fatal("Brodie Kostecki row not found")
	}
	if kostecki.Races["SMP1"] == kostecki.Races["SMP2"] {
		t.Fatalf("SMP1 and SMP2 should differ")
	}
	watersCount := 0
	for _, r := range data.Rows {
		if strings.EqualFold(strings.TrimSpace(r.Driver), "Cameron Waters") {
			watersCount++
		}
	}
	if watersCount != 1 {
		t.Fatalf("expected one Cameron Waters row, got %d", watersCount)
	}
	var winterbottom, hazelwood *StandingRow
	for i := range data.Rows {
		switch strings.TrimSpace(data.Rows[i].Driver) {
		case "Mark Winterbottom":
			winterbottom = &data.Rows[i]
		case "Todd Hazelwood":
			hazelwood = &data.Rows[i]
		}
	}
	if winterbottom == nil {
		t.Fatal("expected Mark Winterbottom in standings (Darwin substitute)")
	}
	if hazelwood == nil {
		t.Fatal("expected Todd Hazelwood in standings (Darwin substitute)")
	}
	hasDarwin := false
	for code := range winterbottom.Races {
		if strings.HasPrefix(code, "DAR") {
			hasDarwin = true
			break
		}
	}
	if !hasDarwin {
		t.Fatalf("Winterbottom should have a Darwin column, races=%v", winterbottom.Races)
	}
}

func findRaceCode(order []string, code string) (int, bool) {
	for i, c := range order {
		if c == code {
			return i, true
		}
	}
	return 0, false
}
