package schedulefile

import (
	"path/filepath"
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
	if len(data.CompletedRaces) != 3 {
		t.Fatalf("completed_races: want 3 got %v", data.CompletedRaces)
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

	// After Imola + Spa + Le Mans: #7 Toyota 75 leads; #20 BMW 71.
	if got := standingRowByCar(hypercar.Rows, "7"); got == nil {
		t.Fatal("hypercar #7 missing")
	} else {
		if got.Points != "75" {
			t.Fatalf("hypercar #7 points: want 75 got %q", got.Points)
		}
		if got.Races["R1"] != "3" || got.Races["R2"] != "5" || got.Races["R3"] != "1" {
			t.Fatalf("hypercar #7 races: got R1=%q R2=%q R3=%q", got.Races["R1"], got.Races["R2"], got.Races["R3"])
		}
		if hypercar.Rows[0].Car != "7" {
			t.Fatalf("hypercar leader: want #7 got #%s", hypercar.Rows[0].Car)
		}
	}
	if got := standingRowByCar(hypercar.Rows, "20"); got == nil {
		t.Fatal("hypercar #20 missing")
	} else if got.Points != "71" {
		t.Fatalf("hypercar #20 points: want 71 got %q", got.Points)
	}

	// LMGT3: #33 TF Sport 72 after Le Mans win (50) on top of Imola + Spa.
	if got := standingRowByCar(lmgt3.Rows, "33"); got == nil {
		t.Fatal("lmgt3 #33 missing")
	} else if got.Points != "72" {
		t.Fatalf("lmgt3 #33 points: want 72 got %q", got.Points)
	}
	if got := standingRowByCar(lmgt3.Rows, "21"); got == nil {
		t.Fatal("lmgt3 #21 missing")
	} else if got.Points != "40" {
		t.Fatalf("lmgt3 #21 points: want 40 got %q", got.Points)
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

func standingRowByCar(rows []StandingRow, car string) *StandingRow {
	for i := range rows {
		if rows[i].Car == car {
			return &rows[i]
		}
	}
	return nil
}
