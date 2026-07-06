package schedulefile

import (
	"path/filepath"
	"testing"
)

func TestBuildImsaStandingsFromEvents_2026_HasClasses(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatalf("abs data dir: %v", err)
	}
	data, err := BuildImsaStandingsFromEvents(dataDir, "2026")
	if err != nil {
		t.Fatalf("BuildImsaStandingsFromEvents: %v", err)
	}
	if data == nil {
		t.Fatal("nil standings")
	}
	if len(data.Classes) == 0 {
		t.Fatal("expected IMSA classes")
	}
	if len(data.RaceOrder) < 5 {
		t.Fatalf("race_order: %v", data.RaceOrder)
	}
	if data.RaceOrder[0] != "DAY24" || data.RaceOrder[4] != "DET" {
		t.Fatalf("unexpected race_order prefix: %v", data.RaceOrder)
	}
	var gtp *StandingsClass
	for i := range data.Classes {
		if data.Classes[i].ID == "GTP" {
			gtp = &data.Classes[i]
			break
		}
	}
	if gtp == nil || len(gtp.Rows) == 0 {
		t.Fatal("GTP class missing")
	}
	var gtpLeader, car31 *StandingRow
	for i := range gtp.Rows {
		if gtp.Rows[i].Car == "31" {
			car31 = &gtp.Rows[i]
		}
		if gtpLeader == nil {
			gtpLeader = &gtp.Rows[i]
		}
	}
	if gtpLeader == nil {
		t.Fatal("GTP class empty")
	}
	if car31 == nil {
		t.Fatal("GTP #31 missing")
	}
	if car31.Races["DET"] != "1" {
		t.Errorf("GTP #31 DET race = %q, want 1", car31.Races["DET"])
	}
	if car31.Quals["DET"] != "" {
		t.Errorf("GTP #31 DET qual = %q, want empty (no qual points)", car31.Quals["DET"])
	}
	if parseGtwcePointsCell(gtpLeader.Points) <= 0 {
		t.Errorf("GTP leader should have points, got %q", gtpLeader.Points)
	}
}

func TestBuildElmsStandingsFromEvents_2026_HasClasses(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatalf("abs data dir: %v", err)
	}
	data, err := BuildElmsStandingsFromEvents(dataDir, "2026")
	if err != nil {
		t.Fatalf("BuildElmsStandingsFromEvents: %v", err)
	}
	if data == nil {
		t.Fatal("nil standings")
	}
	if len(data.Classes) == 0 {
		t.Fatal("expected ELMS classes")
	}
	if len(data.RaceOrder) < 2 {
		t.Fatalf("race_order: %v", data.RaceOrder)
	}
	if data.RaceOrder[0] != "BAR" || data.RaceOrder[1] != "LEC" {
		t.Fatalf("unexpected race_order: %v", data.RaceOrder)
	}
	var lmp2 *StandingsClass
	for i := range data.Classes {
		if data.Classes[i].ID == "LMP2" {
			lmp2 = &data.Classes[i]
			break
		}
	}
	if lmp2 == nil || len(lmp2.Rows) == 0 {
		t.Fatal("LMP2 class missing")
	}
	if lmp2.Rows[0].Races["BAR"] == "" || lmp2.Rows[0].Races["LEC"] == "" {
		t.Errorf("LMP2 leader missing BAR/LEC: %#v", lmp2.Rows[0].Races)
	}
}

func TestImsaStandingsRaceCode(t *testing.T) {
	tests := []struct {
		name string
		ev   EventJSON
		want string
	}{
		{"daytona", EventJSON{Name: "Rolex 24 at Daytona", CircuitName: "Daytona International Speedway"}, "DAY24"},
		{"detroit", EventJSON{Name: "Chevrolet Detroit Sports Car Classic", Location: "Detroit, Michigan"}, "DET"},
		{"fallback", EventJSON{ID: "IMSA_2026_8"}, "R8"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := imsaStandingsRaceCode(tc.ev); got != tc.want {
				t.Fatalf("imsaStandingsRaceCode() = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestElmsStandingsRaceCode(t *testing.T) {
	tests := []struct {
		name string
		ev   EventJSON
		want string
	}{
		{"barcelona", EventJSON{Name: "4 Hours of Barcelona", CircuitName: "Circuit de Barcelona-Catalunya"}, "BAR"},
		{"ricard", EventJSON{Name: "4 Hours of Le Castellet", Location: "Le Castellet"}, "LEC"},
		{"spa", EventJSON{Name: "4 Hours of Spa-Francorchamps"}, "SPA"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := elmsStandingsRaceCode(tc.ev); got != tc.want {
				t.Fatalf("elmsStandingsRaceCode() = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestCarNumbersMatch(t *testing.T) {
	if !carNumbersMatch("03", "3") {
		t.Fatal("03 and 3 should match")
	}
	if !carNumbersMatch("911", "911") {
		t.Fatal("911 should match itself")
	}
	if carNumbersMatch("18", "81") {
		t.Fatal("18 and 81 should not match")
	}
}

func TestImsaCarAliasesDaytonaGTP(t *testing.T) {
	got := imsaCarAliases("DAY24", "GTP", "5")
	if len(got) != 2 {
		t.Fatalf("aliases = %v", got)
	}
	found85 := false
	for _, c := range got {
		if c == "85" {
			found85 = true
		}
	}
	if !found85 {
		t.Fatalf("expected 85 alias for car 5 at DAY24, got %v", got)
	}
}

func TestBuildElmsStandingsFromEvents_ProAmSeparateFromLMP2(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatalf("abs data dir: %v", err)
	}
	data, err := BuildElmsStandingsFromEvents(dataDir, "2026")
	if err != nil {
		t.Fatalf("BuildElmsStandingsFromEvents: %v", err)
	}
	var lmp2, proAm *StandingsClass
	for i := range data.Classes {
		switch data.Classes[i].ID {
		case "LMP2":
			lmp2 = &data.Classes[i]
		case "LMP2 Pro/Am":
			proAm = &data.Classes[i]
		}
	}
	if lmp2 == nil || proAm == nil {
		t.Fatal("expected LMP2 and LMP2 Pro/Am classes")
	}
	inLMP2 := func(car string) bool {
		for _, r := range lmp2.Rows {
			if r.Car == car {
				return true
			}
		}
		return false
	}
	inProAm := func(car string) bool {
		for _, r := range proAm.Rows {
			if r.Car == car {
				return true
			}
		}
		return false
	}
	if !inProAm("3") {
		t.Fatal("car #3 (Pro/Am entry) should appear in LMP2 Pro/Am standings")
	}
	if inLMP2("3") {
		t.Fatal("car #3 should not appear in pure LMP2 standings")
	}
}

func TestBuildImsaStandingsFromEvents_QualsPopulated(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatalf("abs data dir: %v", err)
	}
	data, err := BuildImsaStandingsFromEvents(dataDir, "2026")
	if err != nil {
		t.Fatalf("BuildImsaStandingsFromEvents: %v", err)
	}
	var gtp *StandingsClass
	for i := range data.Classes {
		if data.Classes[i].ID == "GTP" {
			gtp = &data.Classes[i]
			break
		}
	}
	if gtp == nil {
		t.Fatal("GTP class missing")
	}
	hasQuals := false
	for _, row := range gtp.Rows {
		if len(row.Quals) > 0 {
			hasQuals = true
			break
		}
	}
	if !hasQuals {
		t.Fatal("expected at least one GTP row with quals map")
	}
}
