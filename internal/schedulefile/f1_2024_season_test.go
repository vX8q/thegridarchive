package schedulefile

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"testing"
)

func f1_2024DataDir(t *testing.T) string {
	t.Helper()
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller failed")
	}
	return filepath.Clean(filepath.Join(filepath.Dir(thisFile), "..", "..", "data"))
}

// TestF1_2024_ScheduleAndEventFiles locks the 24-round calendar scaffolding.
func TestF1_2024_ScheduleAndEventFiles(t *testing.T) {
	dataDir := f1_2024DataDir(t)
	events, err := LoadEvents(dataDir, "F1")
	if err != nil {
		t.Fatalf("LoadEvents: %v", err)
	}
	var round2024 []EventJSON
	for _, e := range events {
		if e.Season == "2024" {
			round2024 = append(round2024, e)
		}
	}
	if len(round2024) != 24 {
		t.Fatalf("2024 schedule events = %d, want 24", len(round2024))
	}

	wantNames := []string{
		"Bahrain Grand Prix",
		"Saudi Arabian Grand Prix",
		"Australian Grand Prix",
		"Japanese Grand Prix",
		"Chinese Grand Prix",
		"Miami Grand Prix",
		"Emilia Romagna Grand Prix",
		"Monaco Grand Prix",
		"Canadian Grand Prix",
		"Spanish Grand Prix",
		"Austrian Grand Prix",
		"British Grand Prix",
		"Hungarian Grand Prix",
		"Belgian Grand Prix",
		"Dutch Grand Prix",
		"Italian Grand Prix",
		"Azerbaijan Grand Prix",
		"Singapore Grand Prix",
		"United States Grand Prix",
		"Mexico City Grand Prix",
		"Sao Paulo Grand Prix",
		"Las Vegas Grand Prix",
		"Qatar Grand Prix",
		"Abu Dhabi Grand Prix",
	}
	wantDates := []string{
		"2024-03-02", "2024-03-09", "2024-03-24", "2024-04-07", "2024-04-21",
		"2024-05-05", "2024-05-19", "2024-05-26", "2024-06-09", "2024-06-23",
		"2024-06-30", "2024-07-07", "2024-07-21", "2024-07-28", "2024-08-25",
		"2024-09-01", "2024-09-15", "2024-09-22", "2024-10-20", "2024-10-27",
		"2024-11-03", "2024-11-23", "2024-12-01", "2024-12-08",
	}

	byID := map[string]EventJSON{}
	for _, e := range round2024 {
		byID[e.ID] = e
	}
	for i := 1; i <= 24; i++ {
		id := "F1_2024_" + strconv.Itoa(i)
		e, ok := byID[id]
		if !ok {
			t.Fatalf("missing schedule id %s", id)
		}
		if e.Name != wantNames[i-1] {
			t.Errorf("%s name=%q want %q", id, e.Name, wantNames[i-1])
		}
		if e.StartDate != wantDates[i-1] {
			t.Errorf("%s start_date=%q want %q", id, e.StartDate, wantDates[i-1])
		}
		path := filepath.Join(dataDir, "events", "F1", "2024", "f1_2024_"+strconv.Itoa(i)+".json")
		if _, err := os.Stat(path); err != nil {
			t.Errorf("missing event file %s: %v", path, err)
		}
	}
}

// TestF1_2024_EntryListSchema: constructor / chassis (manufacturer) / power_unit on every row.
func TestF1_2024_EntryListSchema(t *testing.T) {
	dataDir := f1_2024DataDir(t)
	wantMeta := map[string][3]string{
		"BWT Alpine F1 Team":                {"Alpine-Renault", "A524", "Renault E-Tech RE24"},
		"Aston Martin Aramco F1 Team":       {"Aston Martin Aramco-Mercedes", "AMR24", "Mercedes-AMG F1 M15"},
		"Scuderia Ferrari":                  {"Ferrari", "SF-24", "Ferrari 066/12"},
		"MoneyGram Haas F1 Team":            {"Haas-Ferrari", "VF-24", "Ferrari 066/10"},
		"Stake F1 Team Kick Sauber":         {"Kick Sauber-Ferrari", "C44", "Ferrari 066/12"},
		"McLaren Formula 1 Team":            {"McLaren-Mercedes", "MCL38", "Mercedes-AMG F1 M15"},
		"Mercedes-AMG Petronas F1 Team":     {"Mercedes", "F1 W15", "Mercedes-AMG F1 M15"},
		"Visa Cash App RB F1 Team":          {"RB-Honda RBPT", "VCARB 01", "Honda RBPTH002"},
		"Oracle Red Bull Racing":            {"Red Bull Racing-Honda RBPT", "RB20", "Honda RBPTH002"},
		"Williams Racing":                   {"Williams-Mercedes", "FW46", "Mercedes-AMG F1 M15"},
	}

	for rd := 1; rd <= 24; rd++ {
		detail, err := LoadEventDetail(dataDir, "F1_2024_"+strconv.Itoa(rd))
		if err != nil {
			t.Fatalf("round %d: %v", rd, err)
		}
		if detail == nil || len(detail.EntryList) == 0 {
			t.Fatalf("round %d: empty entry_list", rd)
		}
		for _, e := range detail.EntryList {
			meta, ok := wantMeta[strings.TrimSpace(e.Team)]
			if !ok {
				t.Errorf("R%d unknown team %q", rd, e.Team)
				continue
			}
			if e.Constructor != meta[0] {
				t.Errorf("R%d %s constructor=%q want %q", rd, e.Driver, e.Constructor, meta[0])
			}
			if e.Manufacturer != meta[1] {
				t.Errorf("R%d %s chassis(manufacturer)=%q want %q", rd, e.Driver, e.Manufacturer, meta[1])
			}
			if e.PowerUnit != meta[2] {
				t.Errorf("R%d %s power_unit=%q want %q", rd, e.Driver, e.PowerUnit, meta[2])
			}
		}
	}
}

// TestLoadTeamsForSeason_F1_2024_EmptyFileDoesNotLeakCurrentSeason guards the
// regression where empty f1_2024.json fell back to f1.json (2026 grid).
func TestLoadTeamsForSeason_F1_2024_EmptyFileDoesNotLeakCurrentSeason(t *testing.T) {
	dataDir := f1_2024DataDir(t)

	seasonPath := filepath.Join(dataDir, "teams", "f1_2024.json")
	raw, err := os.ReadFile(seasonPath)
	if err != nil {
		t.Fatalf("read f1_2024.json: %v", err)
	}
	var probe struct {
		Teams []TeamJSON `json:"teams"`
	}
	if err := json.Unmarshal(raw, &probe); err != nil {
		t.Fatalf("parse f1_2024.json: %v", err)
	}
	if len(probe.Teams) != 0 {
		t.Fatalf("f1_2024.json should have empty teams[] for build-from-events, got %d", len(probe.Teams))
	}

	loaded, err := LoadTeamsForSeason(dataDir, "f1", "2024")
	if err != nil {
		t.Fatalf("LoadTeamsForSeason: %v", err)
	}
	if loaded == nil {
		t.Fatal("nil teams payload")
	}
	if len(loaded.Teams) != 0 {
		t.Fatalf("LoadTeamsForSeason(f1,2024) leaked %d curated rows (want 0 before enrich)", len(loaded.Teams))
	}
	for _, tm := range loaded.Teams {
		if strings.Contains(tm.Chassis, "26") || strings.Contains(tm.Chassis, "MCL40") || tm.Chassis == "RB22" {
			t.Fatalf("leaked 2026 chassis into 2024 load: %+v", tm)
		}
	}

	EnrichTeamsRoundsFromEvents(dataDir, "f1", "2024", loaded)
	if len(loaded.Teams) < 20 {
		t.Fatalf("after enrich teams=%d, want full 2024 grid", len(loaded.Teams))
	}
	for _, tm := range loaded.Teams {
		if tm.Manufacturer == "" || tm.Chassis == "" || tm.PowerUnit == "" {
			t.Fatalf("incomplete meta after enrich: %+v", tm)
		}
		if strings.HasSuffix(tm.Chassis, "26") || tm.Chassis == "MCL40" || tm.Chassis == "RB22" || tm.Chassis == "SF-26" {
			t.Fatalf("2026 chassis leaked after enrich: %+v", tm)
		}
	}
	if loaded.Teams[0].Team != "BWT Alpine F1 Team" {
		t.Fatalf("entrant order: first=%q want Alpine", loaded.Teams[0].Team)
	}
}

// TestF1_2024_ScoringHandbook locks SERIES_TEMPLATES §2 GP/sprint point tables.
func TestF1_2024_ScoringHandbook(t *testing.T) {
	race := []int{25, 18, 15, 12, 10, 8, 6, 4, 2, 1}
	sprint := []int{8, 7, 6, 5, 4, 3, 2, 1}

	racePts := func(pos int, flInTop10 bool) int {
		if pos < 1 || pos > 10 {
			return 0
		}
		p := race[pos-1]
		if flInTop10 {
			p++
		}
		return p
	}
	sprintPts := func(pos int) int {
		if pos < 1 || pos > 8 {
			return 0
		}
		return sprint[pos-1]
	}

	if got := racePts(1, true); got != 26 {
		t.Fatalf("P1+FL = %d want 26", got)
	}
	if got := racePts(10, true); got != 2 {
		t.Fatalf("P10+FL = %d want 2", got)
	}
	if got := racePts(11, true); got != 0 {
		t.Fatalf("P11+FL = %d want 0 (FL only in top 10)", got)
	}
	if got := racePts(5, false); got != 10 {
		t.Fatalf("P5 = %d want 10", got)
	}
	if got := sprintPts(1); got != 8 {
		t.Fatalf("sprint P1 = %d want 8", got)
	}
	if got := sprintPts(8); got != 1 {
		t.Fatalf("sprint P8 = %d want 1", got)
	}
	if got := sprintPts(9); got != 0 {
		t.Fatalf("sprint P9 = %d want 0", got)
	}
}

// TestBuildStandingsFromEvents_F1_2024_Scaffold: calendar wiring without filled results.
func TestBuildStandingsFromEvents_F1_2024_Scaffold(t *testing.T) {
	dataDir := f1_2024DataDir(t)
	data, err := BuildStandingsFromEvents(dataDir, "F1", "2024")
	if err != nil {
		t.Fatalf("BuildStandingsFromEvents: %v", err)
	}
	if data == nil {
		t.Fatal("nil standings")
	}
	if len(data.RaceOrder) != 24 {
		t.Fatalf("race_order len=%d want 24 (got %#v)", len(data.RaceOrder), data.RaceOrder)
	}
	// Stubs have empty race tables — no championship totals yet.
	for _, r := range data.Rows {
		if r.Points != "" && r.Points != "0" {
			t.Fatalf("unexpected scored driver %q pts=%q before results are filled", r.Driver, r.Points)
		}
	}
}
