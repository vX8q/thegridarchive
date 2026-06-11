package schedulefile

import (
	"path/filepath"
	"testing"
)

func TestBuildGtwceStandingsFromEvents_Sprint2026(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatal(err)
	}
	data, err := BuildGtwceStandingsFromEvents(dataDir, "GTWCE_SPRINT", "2026")
	if err != nil {
		t.Fatal(err)
	}
	if data == nil {
		t.Fatal("nil data")
	}
	if len(data.Classes) != 4 {
		t.Fatalf("classes: want 4 got %d", len(data.Classes))
	}
	if len(data.RaceOrder) < 2 {
		t.Fatalf("race_order: want >=2 cols for sprint, got %d", len(data.RaceOrder))
	}
	var overallPts int
	for _, c := range data.Classes {
		if c.ID == "overall" {
			overallPts = len(c.Rows)
			break
		}
	}
	if overallPts == 0 {
		t.Fatal("expected Overall table with at least one row from gtwce sprint event data")
	}
	// Brands Hatch 2026: 34 cars in results + entry_list merge (not fewer than entered crews).
	if overallPts < 33 {
		t.Fatalf("overall standings: want >=33 rows (full grid / entry list), got %d — пересоберите сервер и сбросьте кэш API", overallPts)
	}
}

func TestBuildGtwceStandingsFromEvents_Endurance2026(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatal(err)
	}
	data, err := BuildGtwceStandingsFromEvents(dataDir, "GTWCE_END", "2026")
	if err != nil {
		t.Fatal(err)
	}
	if len(data.Classes) != 4 {
		t.Fatalf("classes: want 4 got %d", len(data.Classes))
	}
	if len(data.RaceOrder) < 1 {
		t.Fatal("expected at least one race column")
	}
	var overall, gold, silver, bronze *StandingsClass
	for i := range data.Classes {
		switch data.Classes[i].ID {
		case "overall":
			overall = &data.Classes[i]
		case "gold":
			gold = &data.Classes[i]
		case "silver":
			silver = &data.Classes[i]
		case "bronze":
			bronze = &data.Classes[i]
		}
	}
	if overall == nil || gold == nil || silver == nil || bronze == nil {
		t.Fatal("missing championship class tables")
	}
	if r := gtwceRowByCar(overall.Rows, "48"); r == nil || r.Points != "43" {
		t.Fatalf("overall #48: want 43 pts after Paul Ricard + Monza, got %v", r)
	}
	if r := gtwceRowByCar(gold.Rows, "58"); r == nil || r.Points != "52" {
		t.Fatalf("gold #58: want 52 pts, got %v", r)
	}
	if r := gtwceRowByCar(silver.Rows, "66"); r == nil || r.Points != "40" {
		t.Fatalf("silver #66: want 40 pts, got %v", r)
	}
	if r := gtwceRowByCar(bronze.Rows, "74"); r == nil || r.Points != "37" {
		t.Fatalf("bronze #74: want 37 pts, got %v", r)
	}
}

func gtwceRowByCar(rows []StandingRow, car string) *StandingRow {
	for i := range rows {
		if rows[i].Car == car {
			return &rows[i]
		}
	}
	return nil
}
