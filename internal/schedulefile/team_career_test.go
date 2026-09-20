package schedulefile

import (
	"path/filepath"
	"testing"
)

func TestTeamRawMatchesCanon(t *testing.T) {
	redirects := map[string]string{
		"bwt-alpine-f1-team":  "alpine",
		"scuderia-ferrari-hp": "ferrari",
	}
	if !TeamRawMatchesCanon("BWT Alpine F1 Team", "alpine", redirects) {
		t.Fatal("expected alpine commercial match")
	}
	if !TeamRawMatchesCanon("Alpine", "alpine", redirects) {
		t.Fatal("expected identity match")
	}
	if TeamRawMatchesCanon("Mercedes", "alpine", redirects) {
		t.Fatal("mercedes must not match alpine")
	}
	if !TeamRawMatchesCanon("Joey Gase Motorsports with Scott Osteen", "joey-gase-motorsports", map[string]string{
		"joey-gase-motorsports": "joey-gase-motorsports",
	}) {
		// partnership strip → slug joey-gase-motorsports == canon
		t.Fatal("expected partnership strip match")
	}
}

func TestStripStockCarPartnership(t *testing.T) {
	got := StripStockCarPartnership("SS-Green Light Racing with BRK Racing")
	if got != "SS-Green Light Racing" {
		t.Fatalf("got %q", got)
	}
}

func TestSeriesUsesFullTimeFlag(t *testing.T) {
	deny := []string{"f1", "F1", "f2", "f3", "f4_it", "psc", "indycar", "dtm", "frec", "wec", "elms", "imsa", "super_formula", "super_gt", "gtwce_end", "gtwce_sprint"}
	for _, sid := range deny {
		if seriesUsesFullTimeFlag(sid) {
			t.Fatalf("%s must not use FT/PT", sid)
		}
	}
	allow := []string{"nascar_cup", "noaps", "nascar_truck", "arca", "nascar_modified", "supercars", "nascar_xfinity"}
	for _, sid := range allow {
		if !seriesUsesFullTimeFlag(sid) {
			t.Fatalf("%s should keep FT/PT", sid)
		}
	}
}

func TestBuildTeamCareer_F1NoFullTimeAndRealRounds(t *testing.T) {
	dataDir := filepath.Join("..", "..", "data")
	redirects := map[string]string{
		"oracle-red-bull-racing":             "red-bull-racing",
		"red-bull-racing-red-bull-ford":      "red-bull-racing",
		"visa-cash-app-racing-bulls-f1-team": "racing-bulls",
	}
	_, roster, err := BuildTeamCareerFromEvents(dataDir, "red-bull-racing", "2026", "f1", redirects)
	if err != nil {
		t.Fatal(err)
	}
	if len(roster) == 0 {
		t.Fatal("expected Red Bull 2026 roster")
	}
	var verstappen, hadjar, lawson bool
	for _, s := range roster {
		if s.FullTime != nil {
			t.Fatalf("F1 seat %s #%s must not set full_time, got %v", s.DriverName, s.CarNumber, *s.FullTime)
		}
		if s.Rounds == "" || s.Rounds == "1" {
			t.Fatalf("F1 seat %s #%s: want real rounds, got %q", s.DriverName, s.CarNumber, s.Rounds)
		}
		switch s.DriverName {
		case "Max Verstappen":
			verstappen = true
		case "Isack Hadjar":
			hadjar = true
		case "Liam Lawson":
			lawson = true
		}
	}
	if !verstappen || !hadjar {
		t.Fatalf("expected Verstappen and Hadjar on roster, got verstappen=%v hadjar=%v", verstappen, hadjar)
	}
	if !lawson {
		t.Fatal("expected Lawson on Red Bull roster (rounds 12–13 substitute)")
	}
}

func TestBuildTeamCareer_IndyCarNoFullTime(t *testing.T) {
	dataDir := filepath.Join("..", "..", "data")
	_, roster, err := BuildTeamCareerFromEvents(dataDir, "andretti-global", "2026", "indycar", nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(roster) == 0 {
		t.Fatal("expected Andretti 2026 IndyCar roster")
	}
	for _, s := range roster {
		if s.FullTime != nil {
			t.Fatalf("IndyCar seat %s #%s must not set full_time, got %v", s.DriverName, s.CarNumber, *s.FullTime)
		}
		if s.Rounds == "" {
			t.Fatalf("IndyCar seat %s #%s: want rounds, got empty", s.DriverName, s.CarNumber)
		}
	}
}

func TestBuildTeamCareer_IMSAClassNoFullTime(t *testing.T) {
	dataDir := filepath.Join("..", "..", "data")
	_, roster, err := BuildTeamCareerFromEvents(dataDir, "porsche-penske-motorsport", "2026", "imsa", nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(roster) == 0 {
		t.Fatal("expected Penske IMSA roster")
	}
	var sawClass bool
	for _, s := range roster {
		if s.FullTime != nil {
			t.Fatalf("IMSA seat %s #%s must not set full_time, got %v", s.DriverName, s.CarNumber, *s.FullTime)
		}
		if s.Class != "" {
			sawClass = true
		}
	}
	if !sawClass {
		t.Fatal("IMSA roster should include Class")
	}
}
