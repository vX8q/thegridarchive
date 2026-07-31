package schedulefile

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestEnrichTeamsRoundsFromEvents_F2CamaraSingleRow(t *testing.T) {
	dataDir, err := filepath.Abs("../../data")
	if err != nil {
		t.Fatal(err)
	}
	data, err := LoadTeamsForSeason(dataDir, "f2", "2026")
	if err != nil {
		t.Fatal(err)
	}
	EnrichTeamsRoundsFromEvents(dataDir, "f2", "2026", data)

	var camara []TeamJSON
	for _, r := range data.Teams {
		if driverMatchKey(r.Driver) == driverMatchKey("Rafael Camara") {
			camara = append(camara, r)
		}
	}
	if len(camara) != 1 {
		for _, r := range camara {
			t.Logf("Camara row: driver=%q rounds=%q", r.Driver, r.Rounds)
		}
		t.Fatalf("want 1 Camara row on #1, got %d", len(camara))
	}
	if camara[0].Rounds != "1–9" && camara[0].Rounds != "1-9" {
		t.Fatalf("rounds = %q, want 1–9", camara[0].Rounds)
	}
	if camara[0].Driver != "Rafael Camara" {
		t.Fatalf("driver display = %q, want ASCII form from events", camara[0].Driver)
	}
	// No leftover diacritic spelling as a separate row.
	for _, r := range data.Teams {
		if strings.TrimSpace(r.Number) == "1" && strings.Contains(r.Driver, "â") {
			t.Fatalf("diacritic curated/event row still present: %+v", r)
		}
	}
}
