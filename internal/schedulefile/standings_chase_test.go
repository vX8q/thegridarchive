package schedulefile

import (
	"path/filepath"
	"strings"
	"testing"
)

func testChaseDriver(name string, eligible bool, pts map[string]float64, pos map[string]string, stages map[string]int) *chaseDriver {
	return &chaseDriver{
		Key:       canonicalDriverKey(name),
		Name:      name,
		Eligible:  eligible,
		RacePts:   pts,
		Pos:       pos,
		StageWins: stages,
	}
}

func TestStockCarChaseConfig_MatchesCalendar(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatal(err)
	}
	wantField := map[string]int{"NASCAR_CUP": 16, "NOAPS": 12, "NASCAR_TRUCK": 10}
	for _, seriesID := range []string{"NASCAR_CUP", "NOAPS", "NASCAR_TRUCK"} {
		cfg, ok := stockCarChaseConfig(seriesID)
		if !ok {
			t.Fatalf("%s: missing chase config", seriesID)
		}
		if cfg.FieldSize != wantField[seriesID] {
			t.Errorf("%s FieldSize = %d, want %d", seriesID, cfg.FieldSize, wantField[seriesID])
		}
		base, err := LoadStandings(dataDir, seriesID)
		if err != nil || base == nil {
			t.Fatalf("%s: load standings: %v", seriesID, err)
		}
		if cfg.RegularSeasonRaces <= 0 || cfg.RegularSeasonRaces >= len(base.RaceOrder) {
			t.Errorf("%s regular-season races %d vs race_order %d", seriesID, cfg.RegularSeasonRaces, len(base.RaceOrder))
		}
	}
}

func TestChaseSeedForRank(t *testing.T) {
	want := []int{2100, 2075, 2065, 2060, 2055, 2050, 2045, 2040, 2035, 2030, 2025, 2020, 2015, 2010, 2005, 2000}
	for i, s := range want {
		if got := chaseSeedForRank(i); got != s {
			t.Errorf("seed[%d] = %d, want %d", i, got, s)
		}
	}
}

func TestApplyStockCarChase_RegularSeasonNoReset(t *testing.T) {
	cfg := chaseConfig{RegularSeasonRaces: 4, FieldSize: 4}
	raceOrder := []string{"R1", "R2", "R3", "R4", "C1", "C2", "F"}
	a := testChaseDriver("A", true, map[string]float64{"R1": 55, "R2": 35, "R3": 55}, map[string]string{"R1": "1", "R2": "2", "R3": "1"}, map[string]int{"R1": 1})
	b := testChaseDriver("B", true, map[string]float64{"R1": 30, "R2": 55, "R3": 20}, map[string]string{"R1": "3", "R2": "1", "R3": "5"}, nil)
	a.Points = 145
	b.Points = 105
	state := applyStockCarChase(cfg, raceOrder, []string{"R1", "R2", "R3"}, []*chaseDriver{a, b})
	if state.Active {
		t.Fatal("chase must stay inactive until the regular-season finale is filled")
	}
	if state.Round != chaseRoundRegular {
		t.Fatalf("round = %q", state.Round)
	}
	if a.Points != 145 || b.Points != 105 {
		t.Fatalf("points were reset too early: A=%v B=%v", a.Points, b.Points)
	}
	if a.PlayoffPts != 0 || b.PlayoffPts != 0 {
		t.Fatalf("2026 Chase has no playoff points, got A=%d B=%d", a.PlayoffPts, b.PlayoffPts)
	}
}

func TestApplyStockCarChase_FinaleSeedsWithoutEliminations(t *testing.T) {
	cfg := chaseConfig{RegularSeasonRaces: 3, FieldSize: 4}
	raceOrder := []string{"R1", "R2", "R3", "C1", "C2", "F"}
	mk := func(name string, pts float64, wins int) *chaseDriver {
		pos := map[string]string{"R1": "5", "R2": "5", "R3": "5"}
		rp := map[string]float64{"R1": pts / 3, "R2": pts / 3, "R3": pts / 3}
		if wins > 0 {
			pos["R1"] = "1"
		}
		d := testChaseDriver(name, true, rp, pos, nil)
		d.Points = pts
		return d
	}
	drivers := []*chaseDriver{
		mk("Alpha", 300, 1),
		mk("Bravo", 280, 0),
		mk("Charlie", 260, 0),
		mk("Delta", 240, 0),
		mk("Echo", 220, 0),
		testChaseDriver("Guest (i)", false, map[string]float64{"R1": 55, "R2": 55, "R3": 55}, map[string]string{"R1": "1", "R2": "1", "R3": "1"}, nil),
	}
	state := applyStockCarChase(cfg, raceOrder, []string{"R1", "R2", "R3"}, drivers)
	if !state.Active || state.Round != chaseRoundChase {
		t.Fatalf("after finale: active=%v round=%q", state.Active, state.Round)
	}
	if state.Cutline != 4 || state.FieldSize != 4 {
		t.Fatalf("cutline/field = %d/%d", state.Cutline, state.FieldSize)
	}
	wantSeed := []float64{2100, 2075, 2065, 2060}
	in := 0
	for _, d := range drivers {
		if d.Name == "Guest (i)" {
			if d.Status == chaseStatusIn || d.Points >= 2000 {
				t.Fatalf("ineligible driver must not enter The Chase: %+v", d)
			}
			continue
		}
		if d.Name == "Echo" {
			if d.Status == chaseStatusIn || d.Points >= 2000 {
				t.Fatalf("5th on points must miss the 4-driver field: %+v", d)
			}
			continue
		}
		if d.Status != chaseStatusIn {
			t.Fatalf("%s status = %q, want in", d.Name, d.Status)
		}
		if in >= len(wantSeed) || d.Points != wantSeed[in] {
			t.Fatalf("%s seed = %v, want %v (rank %d)", d.Name, d.Points, wantSeed[in], in)
		}
		in++
	}
	if in != 4 {
		t.Fatalf("chase field = %d, want 4", in)
	}

	for i, d := range drivers {
		if !d.Eligible {
			continue
		}
		if d.RacePts == nil {
			d.RacePts = map[string]float64{}
			d.Pos = map[string]string{}
		}
		d.RacePts["C1"] = float64(40 - i)
		if i == 0 {
			d.Pos["C1"] = "1"
			d.RacePts["C1"] = 55
		} else {
			d.Pos["C1"] = itoa(i + 1)
		}
	}
	state = applyStockCarChase(cfg, raceOrder, []string{"R1", "R2", "R3", "C1"}, drivers)
	if state.Round != chaseRoundChase || state.FieldSize != 4 {
		t.Fatalf("mid-chase: %+v", state)
	}
	if drivers[0].Status != chaseStatusIn {
		t.Fatalf("winner status = %q, want in (no lock/elim)", drivers[0].Status)
	}
	if drivers[0].Points != 2100+55 {
		t.Fatalf("Alpha after C1 = %v, want 2155", drivers[0].Points)
	}
	if drivers[4].Status == chaseStatusIn {
		t.Fatal("Echo must stay outside The Chase after C1")
	}
	if drivers[4].Points != 220+float64(40-4) {
		t.Fatalf("Echo continues regular-season total + chase pts, got %v", drivers[4].Points)
	}

	for i, d := range drivers {
		if !d.Eligible {
			continue
		}
		d.RacePts["C2"] = float64(35 - i)
		d.Pos["C2"] = itoa(i + 1)
	}
	state = applyStockCarChase(cfg, raceOrder, []string{"R1", "R2", "R3", "C1", "C2"}, drivers)
	if state.Round != chaseRoundChase || state.FieldSize != 4 {
		t.Fatalf("after C2 still full field: %+v", state)
	}
	in = 0
	for _, d := range drivers {
		if d.Status == chaseStatusIn {
			in++
		}
	}
	if in != 4 {
		t.Fatalf("no eliminations: field = %d, want 4", in)
	}

	drivers[0].RacePts["F"] = 55
	drivers[0].Pos["F"] = "1"
	drivers[1].RacePts["F"] = 35
	drivers[1].Pos["F"] = "2"
	state = applyStockCarChase(cfg, raceOrder, []string{"R1", "R2", "R3", "C1", "C2", "F"}, drivers)
	if state.Championship {
		t.Fatal("2026 Chase has no Championship 4 flag")
	}
	if drivers[0].Points != 2100+55+35+55 {
		t.Fatalf("Alpha finale points = %v", drivers[0].Points)
	}
	if drivers[1].Points != 2075+39+34+35 {
		t.Fatalf("Bravo finale points = %v", drivers[1].Points)
	}
}

func TestSelectChaseField_PointsNotWins(t *testing.T) {
	lowWinner := testChaseDriver("Winner", true, map[string]float64{"R1": 55}, map[string]string{"R1": "1"}, nil)
	lowWinner.rsWins = 1
	lowWinner.rsPoints = 55
	highPoints := testChaseDriver("Points", true, map[string]float64{"R1": 200}, map[string]string{"R1": "2"}, nil)
	highPoints.rsPoints = 200
	field := selectChaseField([]*chaseDriver{highPoints, lowWinner}, 1)
	if len(field) != 1 || field[0].Name != "Points" {
		t.Fatalf("field = %v, want Points (wins do not lock a berth)", namesOf(field))
	}
}

func namesOf(list []*chaseDriver) []string {
	out := make([]string, len(list))
	for i, d := range list {
		if d != nil {
			out[i] = d.Name
		}
	}
	return out
}

func TestBuildStandingsFromEvents_ChaseActivatesAfterFinale(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatal(err)
	}

	// Regular season still running (Daytona, race 26, not yet in the data).
	beforeFinale := standingsDataDirUpToRound(t, "NASCAR Cup Series", "2026", 25)
	cupPending, err := BuildStandingsFromEvents(beforeFinale, "NASCAR_CUP", "2026")
	if err != nil || cupPending == nil {
		t.Fatalf("cup before finale: %v", err)
	}
	if cupPending.Chase == nil {
		t.Fatal("cup standings missing chase metadata")
	}
	if cupPending.Chase.Active {
		t.Fatal("Cup Chase must wait until Daytona (race 26) has race_results")
	}
	if cupPending.Chase.Cutline != 16 {
		t.Fatalf("cup regular-season cutline = %d, want 16", cupPending.Chase.Cutline)
	}

	// Daytona is in the data — the Chase is seeded.
	cup, err := BuildStandingsFromEvents(dataDir, "NASCAR_CUP", "2026")
	if err != nil || cup == nil {
		t.Fatalf("cup: %v", err)
	}
	if cup.Chase == nil || !cup.Chase.Active {
		t.Fatal("Cup regular season is complete; Chase should already be seeded")
	}
	if cup.Chase.Cutline != 16 {
		t.Fatalf("cup chase cutline = %d, want 16", cup.Chase.Cutline)
	}

	// Seeds are asserted at the regular-season finale (NOAPS race 24), before
	// Chase races start adding points on top of the seeds.
	noaps, err := BuildStandingsFromEvents(standingsDataDirUpToRound(t, "NOAPS", "2026", 24), "NOAPS", "2026")
	if err != nil || noaps == nil {
		t.Fatalf("noaps: %v", err)
	}
	if noaps.Chase == nil || !noaps.Chase.Active {
		t.Fatal("NOAPS regular season is complete; Chase should already be seeded")
	}
	if noaps.Chase.Round != chaseRoundChase || noaps.Chase.Cutline != 12 {
		t.Fatalf("noaps round/cutline = %q/%d", noaps.Chase.Round, noaps.Chase.Cutline)
	}
	if len(noaps.Rows) < 12 {
		t.Fatal("noaps rows empty")
	}
	if parsePointsValueForTest(noaps.Rows[0].Points) != 2100 {
		t.Fatalf("noaps leader seed = %s, want 2100", noaps.Rows[0].Points)
	}
	if parsePointsValueForTest(noaps.Rows[1].Points) != 2075 {
		t.Fatalf("noaps 2nd seed = %s, want 2075", noaps.Rows[1].Points)
	}
	if parsePointsValueForTest(noaps.Rows[2].Points) != 2065 {
		t.Fatalf("noaps 3rd seed = %s, want 2065", noaps.Rows[2].Points)
	}
	wantNoaps := []string{
		"Justin Allgaier", "Carson Kvapil", "Sheldon Creed", "Jesse Love",
		"Austin Hill", "Brandon Jones", "Corey Day", "Sammy Smith",
		"Parker Retzlaff", "Sam Mayer", "Taylor Gray", "Rajah Caruth",
	}
	gotNoaps := make([]string, 0, 12)
	for i := 0; i < 12 && i < len(noaps.Rows); i++ {
		gotNoaps = append(gotNoaps, noaps.Rows[i].Driver)
		if noaps.Rows[i].ChaseStatus != "in" {
			t.Errorf("noaps %s status = %q, want in", noaps.Rows[i].Driver, noaps.Rows[i].ChaseStatus)
		}
		if noaps.Rows[i].PlayoffPoints != "" {
			t.Errorf("noaps %s still has playoff_points=%q", noaps.Rows[i].Driver, noaps.Rows[i].PlayoffPoints)
		}
	}
	for _, name := range wantNoaps {
		found := false
		for _, g := range gotNoaps {
			if g == name {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("noaps Chase missing %s; field=%v", name, gotNoaps)
		}
	}
	for _, g := range gotNoaps {
		if g == "Ryan Sieg" || g == "William Sawalich" {
			t.Errorf("noaps Chase should not include %s", g)
		}
	}

	truck, err := BuildStandingsFromEvents(standingsDataDirUpToRound(t, "NASCAR Truck", "2026", 18), "NASCAR_TRUCK", "2026")
	if err != nil || truck == nil {
		t.Fatalf("truck: %v", err)
	}
	if truck.Chase == nil || !truck.Chase.Active {
		t.Fatal("Truck regular season is complete; Chase should already be seeded")
	}
	if truck.Chase.Round != chaseRoundChase {
		t.Fatalf("truck round = %q, want the_chase", truck.Chase.Round)
	}
	if truck.Chase.Cutline != 10 {
		t.Fatalf("truck cutline = %d, want 10", truck.Chase.Cutline)
	}
	if len(truck.Rows) == 0 {
		t.Fatal("truck rows empty")
	}
	if parsePointsValueForTest(truck.Rows[0].Points) != 2100 {
		t.Fatalf("truck leader seed = %s, want 2100", truck.Rows[0].Points)
	}
	wantTruck := []string{
		"Layne Riggs", "Kaden Honeycutt", "Chandler Smith", "Christian Eckes",
		"Gio Ruggiero", "Ty Majeski", "Grant Enfinger", "Daniel Hemric",
		"Ben Rhodes", "Tyler Ankrum",
	}
	gotTruck := make([]string, 0, 10)
	for i := 0; i < 10 && i < len(truck.Rows); i++ {
		gotTruck = append(gotTruck, truck.Rows[i].Driver)
		if truck.Rows[i].ChaseStatus != "in" {
			t.Errorf("truck %s status = %q, want in", truck.Rows[i].Driver, truck.Rows[i].ChaseStatus)
		}
	}
	for _, name := range wantTruck {
		found := false
		for _, g := range gotTruck {
			if g == name {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("truck Chase missing %s; field=%v", name, gotTruck)
		}
	}
	for _, g := range gotTruck {
		if g == "Corey Heim" {
			t.Errorf("truck Chase should not include Corey Heim (part-time, below cutline)")
		}
	}
}

func parsePointsValueForTest(raw string) float64 {
	s := strings.TrimSpace(raw)
	n := 0.0
	for _, c := range s {
		if c >= '0' && c <= '9' {
			n = n*10 + float64(c-'0')
		} else if c == '.' {
			break
		}
	}
	return n
}

func TestStockCarRaceWin(t *testing.T) {
	if !stockCarRaceWin("1") || !stockCarRaceWin("1*") || !stockCarRaceWin("1. ") {
		t.Fatal("expected P1 to count as a win")
	}
	if stockCarRaceWin("2") || stockCarRaceWin("10") || stockCarRaceWin("DNF") || stockCarRaceWin("") {
		t.Fatal("non-wins must not count")
	}
}
