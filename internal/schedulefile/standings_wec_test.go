package schedulefile

import (
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

func TestWecRoundEligibility_LeMans2026(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatalf("abs data dir: %v", err)
	}
	el := loadWecRoundEligibility(dataDir, "WEC_2026_3")
	if el == nil {
		t.Fatal("nil eligibility")
	}
	if !el.hasSeriesCol["hypercar"] || !el.hasSeriesCol["lmgt3"] {
		t.Fatalf("want series column: %+v", el.hasSeriesCol)
	}
	if el.wecCars["hypercar"]["101"] {
		t.Fatal("#101 IMSA hypercar should not be WEC-eligible")
	}
	if !el.wecCars["hypercar"]["7"] {
		t.Fatal("#7 should be WEC-eligible")
	}
	if el.wecCars["lmgt3"]["2"] {
		t.Fatal("#2 ELMS should not be WEC-eligible")
	}
	if !el.wecCars["lmgt3"]["33"] {
		t.Fatal("#33 should be WEC-eligible")
	}
}

func TestBuildWecStandingsFromEvents_2026(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatalf("abs data dir: %v", err)
	}
	data, err := BuildWecStandingsFromEvents(dataDir, "2026")
	if err != nil {
		t.Fatalf("BuildWecStandingsFromEvents: %v", err)
	}
	if data == nil {
		t.Fatal("nil data")
	}
	if len(data.Classes) != 2 {
		t.Fatalf("classes: want 2 got %d", len(data.Classes))
	}
	if len(data.RaceOrder) < 2 {
		t.Fatalf("race_order: want >=2 got %v", data.RaceOrder)
	}
	if data.RaceOrder[0] != "R1" || data.RaceOrder[1] != "R2" {
		t.Fatalf("race_order start: got %v", data.RaceOrder[:2])
	}
	wantCompleted := wecRoundsWithResults(t, dataDir)
	if len(data.CompletedRaces) != wantCompleted {
		t.Fatalf("completed_races: want %d (rounds with race tables) got %v", wantCompleted, data.CompletedRaces)
	}

	var hypercar, lmgt3 *StandingsClass
	for i := range data.Classes {
		switch data.Classes[i].ID {
		case "hypercar":
			hypercar = &data.Classes[i]
		case "lmgt3":
			lmgt3 = &data.Classes[i]
		}
	}
	if hypercar == nil || lmgt3 == nil {
		t.Fatal("missing hypercar or lmgt3 class")
	}
	if len(hypercar.Rows) == 0 || len(lmgt3.Rows) == 0 {
		t.Fatal("expected non-empty class rows")
	}

	// Imola + Spa + Le Mans finishes are settled history; totals are summed from
	// the event Pts columns so later rounds do not invalidate the check.
	if got := standingRowByCar(hypercar.Rows, "7"); got == nil {
		t.Fatal("hypercar #7 missing")
	} else {
		if got.Races["R1"] != "3" || got.Races["R2"] != "5" || got.Races["R3"] != "1" {
			t.Fatalf("hypercar #7 races: got R1=%q R2=%q R3=%q", got.Races["R1"], got.Races["R2"], got.Races["R3"])
		}
	}
	for _, tc := range []struct {
		class *StandingsClass
		name  string
		car   string
	}{
		{hypercar, "hypercar", "7"},
		{hypercar, "hypercar", "20"},
		{lmgt3, "lmgt3", "33"},
		{lmgt3, "lmgt3", "21"},
	} {
		got := standingRowByCar(tc.class.Rows, tc.car)
		if got == nil {
			t.Fatalf("%s #%s missing", tc.name, tc.car)
		}
		want := itoa(wecCarPointsFromEvents(t, dataDir, tc.name, tc.car))
		if got.Points != want {
			t.Errorf("%s #%s points: want %s got %q", tc.name, tc.car, want, got.Points)
		}
	}
	for i := 1; i < len(hypercar.Rows); i++ {
		prev, _ := strconv.Atoi(hypercar.Rows[i-1].Points)
		cur, _ := strconv.Atoi(hypercar.Rows[i].Points)
		if cur > prev {
			t.Fatalf("hypercar rows not ordered by points: #%s %s before #%s %s",
				hypercar.Rows[i-1].Car, hypercar.Rows[i-1].Points, hypercar.Rows[i].Car, hypercar.Rows[i].Points)
		}
	}

	// Le Mans guest entries (IMSA / ELMS / GTWC) must not appear in WEC standings.
	if got := standingRowByCar(hypercar.Rows, "101"); got != nil {
		t.Fatalf("hypercar #101 (IMSA) should be excluded, got %+v", got)
	}
	for _, guest := range []string{"2", "13", "57", "74", "150"} {
		if got := standingRowByCar(lmgt3.Rows, guest); got != nil {
			t.Fatalf("lmgt3 #%s (non-WEC) should be excluded", guest)
		}
	}
}

// wecRaceTables returns the race classification of every WEC round of the season.
func wecRaceTables(t *testing.T, dataDir string) []EventTable {
	t.Helper()
	events, err := LoadEvents(dataDir, "WEC")
	if err != nil {
		t.Fatalf("load WEC events: %v", err)
	}
	var out []EventTable
	for _, ev := range events {
		if ev.Season != "2026" {
			continue
		}
		detail, err := LoadEventDetail(dataDir, ev.ID)
		if err != nil || detail == nil || detail.Tables == nil {
			continue
		}
		for _, key := range []string{"race_results", "race"} {
			if tbl, ok := detail.Tables[key]; ok && len(tbl.Headers) > 0 && len(tbl.Rows) > 0 {
				out = append(out, tbl)
				break
			}
		}
	}
	return out
}

func wecRoundsWithResults(t *testing.T, dataDir string) int {
	t.Helper()
	return len(wecRaceTables(t, dataDir))
}

func wecCarPointsFromEvents(t *testing.T, dataDir, class, car string) int {
	t.Helper()
	total := 0
	for _, tbl := range wecRaceTables(t, dataDir) {
		classCol := colIndex(tbl.Headers, "Class")
		carCol := colIndex(tbl.Headers, "No.")
		ptsCol := colIndex(tbl.Headers, "Pts")
		if carCol < 0 || ptsCol < 0 {
			continue
		}
		for _, row := range tbl.Rows {
			if carCol >= len(row) || ptsCol >= len(row) {
				continue
			}
			if strings.TrimSpace(row[carCol]) != car {
				continue
			}
			if classCol >= 0 && classCol < len(row) && !strings.EqualFold(strings.TrimSpace(row[classCol]), class) {
				continue
			}
			pts, err := strconv.Atoi(strings.TrimSpace(row[ptsCol]))
			if err != nil {
				continue
			}
			total += pts
		}
	}
	return total
}

func standingRowByCar(rows []StandingRow, car string) *StandingRow {
	for i := range rows {
		if rows[i].Car == car {
			return &rows[i]
		}
	}
	return nil
}
