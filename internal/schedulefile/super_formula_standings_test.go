package schedulefile

import (
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

// Double-header weekends have one schedule row for two rounds, so the second
// round used to come back without a venue and without an event to link to.
func TestBuildStandingsFromEvents_SuperFormula2026_EveryRoundHasVenueAndEvent(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatalf("abs data dir: %v", err)
	}
	data, err := BuildStandingsFromEvents(dataDir, "SUPER_FORMULA", "2026")
	if err != nil {
		t.Fatalf("BuildStandingsFromEvents: %v", err)
	}
	if len(data.EventNames) != len(data.RaceOrder) || len(data.EventIDs) != len(data.RaceOrder) {
		t.Fatalf("lengths: race_order=%d event_names=%d event_ids=%d",
			len(data.RaceOrder), len(data.EventNames), len(data.EventIDs))
	}
	for i, code := range data.RaceOrder {
		if strings.TrimSpace(data.EventNames[i]) == "" {
			t.Errorf("%s has no venue", code)
		}
	}
	// Future calendar rounds may lack a detail JSON; EventIDs stay blank so
	// standings headers do not link to a missing event page.
	completed := map[string]bool{}
	for _, c := range data.CompletedRaces {
		completed[c] = true
	}
	for i, code := range data.RaceOrder {
		if !completed[code] {
			continue
		}
		if strings.TrimSpace(data.EventIDs[i]) == "" {
			t.Errorf("%s (completed) has no event id", code)
		}
	}
	wantVenue := map[string]string{
		"R1": "Motegi", "R2": "Motegi",
		"R3": "Autopolis",
		"R4": "Suzuka", "R5": "Suzuka",
		"R6": "Fuji", "R7": "Fuji",
		"R8": "SUGO",
	}
	for i, code := range data.RaceOrder {
		want, ok := wantVenue[code]
		if !ok {
			continue
		}
		if !strings.Contains(data.EventNames[i], want) {
			t.Errorf("%s venue = %q, want it to contain %q", code, data.EventNames[i], want)
		}
	}
	seen := map[string]bool{}
	for _, code := range data.CompletedRaces {
		if seen[code] {
			t.Errorf("completed_races lists %s twice: %v", code, data.CompletedRaces)
		}
		seen[code] = true
	}
}

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
	if ohta.Races["R3"] != "8" {
		t.Errorf("Ohta R3 (Fuji sprint) want 8, got %q", ohta.Races["R3"])
	}
	if ohta.Races["R4"] == "" || ohta.Races["R5"] == "" {
		t.Errorf("Ohta Suzuka: R4=%q R5=%q", ohta.Races["R4"], ohta.Races["R5"])
	}
	if ohta.Races["R4"] == ohta.Races["R3"] {
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
	// DNF (0 laps) at Fuji reschedule; Autopolis quali bonus still in points.
	if iwas.Races["R3"] != "" && iwas.Races["R3"] != "—" && iwas.Races["R3"] != "DNF" {
		t.Errorf("Iwasa R3 want empty/DNF/dash, got %q", iwas.Races["R3"])
	}
	total, err := strconv.ParseFloat(strings.TrimSpace(iwas.Points), 64)
	if err != nil || total < 3 {
		t.Errorf("Iwasa should have at least 3 quali points on R3, total=%v", iwas.Points)
	}
}

func TestBuildStandingsFromEvents_SuperFormula_QualifyingBonusPerRound(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatalf("abs data dir: %v", err)
	}
	data, err := BuildStandingsFromEvents(dataDir, "SUPER_FORMULA", "2026")
	if err != nil {
		t.Fatalf("BuildStandingsFromEvents: %v", err)
	}
	byDriver := map[string]*StandingRow{}
	for i := range data.Rows {
		byDriver[data.Rows[i].Driver] = &data.Rows[i]
	}
	osu := byDriver["Zak O'Sullivan"]
	if osu == nil {
		t.Fatal("O'Sullivan not found")
	}
	if osu.Races["R6"] != "2" {
		t.Errorf("O'Sullivan R6 pos want 2, got %q", osu.Races["R6"])
	}
	ohta := byDriver["Kakunoshin Ohta"]
	if ohta == nil {
		t.Fatal("Ohta not found")
	}
	if ohta.Races["R7"] != "1" {
		t.Errorf("Ohta R7 want 1, got %q", ohta.Races["R7"])
	}
	total, err := strconv.ParseFloat(strings.TrimSpace(ohta.Points), 64)
	if err != nil {
		t.Fatalf("Ohta points: %v", err)
	}
	// Floor includes Motegi R1(10+2)+R2(20+3)+R3(2+2)+R7(20+1) without other rounds.
	if total < 60 {
		t.Errorf("Ohta total too low (quali bonuses missing?): %v", total)
	}
}

func TestSuperFormulaQualifyingForRound(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatalf("abs data dir: %v", err)
	}
	detail, err := LoadEventDetailAtID(dataDir, "SUPER_FORMULA_2026_6")
	if err != nil || detail == nil {
		t.Fatalf("load Fuji: %v", err)
	}
	q6 := superFormulaQualifyingForRound(detail, 6)
	if q6 == nil || len(q6.Rows) < 3 {
		t.Fatal("expected Qualifying Round 6")
	}
	noCol := firstColIndex(q6.Headers, "No.", "No", "#")
	if noCol < 0 || noCol >= len(q6.Rows[0]) || strings.TrimSpace(q6.Rows[0][noCol]) != "19" {
		t.Errorf("R6 pole car want 19, got headers=%v row0=%v", q6.Headers, q6.Rows[0])
	}
	if superFormulaQualifyingForRound(detail, 3) != nil {
		t.Error("Fuji has no Qualifying Round 3 session")
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
