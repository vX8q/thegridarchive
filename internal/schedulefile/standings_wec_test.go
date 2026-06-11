package schedulefile

import (
	"path/filepath"
	"testing"
)

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
	if len(data.CompletedRaces) != 2 {
		t.Fatalf("completed_races: want 2 got %v", data.CompletedRaces)
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

	// Imola + Spa: #20 BMW 10+25=35 leads; #8 Toyota 25+1=26.
	if got := standingRowByCar(hypercar.Rows, "20"); got == nil {
		t.Fatal("hypercar #20 missing")
	} else {
		if got.Points != "35" {
			t.Fatalf("hypercar #20 points: want 35 got %q", got.Points)
		}
		if got.Races["R1"] != "5" || got.Races["R2"] != "1" {
			t.Fatalf("hypercar #20 races: got R1=%q R2=%q", got.Races["R1"], got.Races["R2"])
		}
		if hypercar.Rows[0].Car != "20" {
			t.Fatalf("hypercar leader: want #20 got #%s", hypercar.Rows[0].Car)
		}
	}
	if got := standingRowByCar(hypercar.Rows, "8"); got == nil {
		t.Fatal("hypercar #8 missing")
	} else if got.Points != "26" {
		t.Fatalf("hypercar #8 points: want 26 got %q", got.Points)
	}

	// LMGT3: #69 Imola win (25), #10 Spa win (25) + Imola 1 pt → #10 leads on 26.
	if got := standingRowByCar(lmgt3.Rows, "10"); got == nil {
		t.Fatal("lmgt3 #10 missing")
	} else if got.Points != "26" {
		t.Fatalf("lmgt3 #10 points: want 26 got %q", got.Points)
	}
	if got := standingRowByCar(lmgt3.Rows, "69"); got == nil {
		t.Fatal("lmgt3 #69 missing")
	} else if got.Points != "25" {
		t.Fatalf("lmgt3 #69 points: want 25 got %q", got.Points)
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
