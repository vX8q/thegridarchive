package schedulefile

import (
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func TestBuildStandingsFromEvents_PSC_GuestDriversSplit(t *testing.T) {
	dataDir := filepath.Join("..", "..", "data")
	data, err := BuildStandingsFromEvents(dataDir, "PSC", "2026")
	if err != nil {
		t.Fatalf("BuildStandingsFromEvents: %v", err)
	}
	if data == nil {
		t.Fatal("BuildStandingsFromEvents returned nil")
	}

	guestNames := map[string]bool{
		"Rodin Younessi":       true,
		"Eugenio Pisani":       true,
		"Taichi Watarai":       true,
		"Alexander Tauscher":   true,
		"Jukka Honkavuori":     true,
		"Jacques Villeneuve":   true,
		"Gianmarco Quaresmini": true,
		"Bert de Heus":         true,
		"Maik Rosenberg":       true,
		// Zandvoort double-header additions.
		"Michael Verhagen":   true,
		"Niels Troost":       true,
		"Paul de Prenter":    true,
		"Dino van der Geest": true,
		"Nick Ho":            true,
		"Senna van Soelen":   true,
		// Monza finale guests.
		"Andrea Galli":  true,
		"Henry Wheeler": true,
	}
	for _, r := range data.Rows {
		if guestNames[r.Driver] {
			t.Errorf("guest driver %q in main standings", r.Driver)
		}
	}
	if len(data.Ineligible) != 17 {
		t.Fatalf("ineligible guests: got %d, want 17", len(data.Ineligible))
	}
	for _, r := range data.Ineligible {
		if !guestNames[r.Driver] {
			t.Errorf("unexpected guest row: %q", r.Driver)
		}
		if r.Points != "0" {
			t.Errorf("guest %q points = %q, want 0", r.Driver, r.Points)
		}
	}
}

func TestBuildStandingsFromEvents_PSC_ZeroPointsByBestFinish(t *testing.T) {
	dataDir := filepath.Join("..", "..", "data")
	data, err := BuildStandingsFromEvents(dataDir, "PSC", "2026")
	if err != nil {
		t.Fatalf("BuildStandingsFromEvents: %v", err)
	}

	var zeroFinishers []string
	for _, r := range data.Rows {
		if r.Points != "0" {
			continue
		}
		zeroFinishers = append(zeroFinishers, r.Driver)
	}
	// Zero-point drivers ordered by best race finish after Monza.
	wantOrder := []string{
		"Luciano Martinez",
		"Samer Shahin",
		"Juan Pablo Vega Dieppa",
		"Jorge Ramirez",
		"Kai Pfister",
	}
	if len(zeroFinishers) != len(wantOrder) {
		t.Fatalf("zero-point drivers: got %d, want %d (%v)", len(zeroFinishers), len(wantOrder), zeroFinishers)
	}
	for i, name := range wantOrder {
		if zeroFinishers[i] != name {
			t.Errorf("pos %d: got %q, want %q (full: %v)", 16+i, zeroFinishers[i], name, zeroFinishers)
			break
		}
	}
}

func TestBuildStandingsFromEvents_PSC_ZandvoortTwoColumns(t *testing.T) {
	dataDir := filepath.Join("..", "..", "data")
	data, err := BuildStandingsFromEvents(dataDir, "PSC", "2026")
	if err != nil {
		t.Fatalf("BuildStandingsFromEvents: %v", err)
	}
	wantOrder := []string{"R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8"}
	if !reflect.DeepEqual(data.RaceOrder, wantOrder) {
		t.Fatalf("race_order = %v, want %v", data.RaceOrder, wantOrder)
	}
	if len(data.EventIDs) != len(wantOrder) {
		t.Fatalf("event_ids len = %d, want %d", len(data.EventIDs), len(wantOrder))
	}
	if !strings.EqualFold(data.EventIDs[5], "PSC_2026_6") {
		t.Errorf("R6 event_id = %q, want PSC_2026_6", data.EventIDs[5])
	}
	if !strings.EqualFold(data.EventIDs[6], "PSC_2026_6") {
		t.Errorf("R7 event_id = %q, want PSC_2026_6", data.EventIDs[6])
	}
	if !strings.EqualFold(data.EventIDs[7], "PSC_2026_8") {
		t.Errorf("R8 event_id = %q, want PSC_2026_8", data.EventIDs[7])
	}
	completed := map[string]bool{}
	for _, c := range data.CompletedRaces {
		completed[c] = true
	}
	// Zandvoort double-header + Monza finale are filled.
	for _, c := range []string{"R6", "R7", "R8"} {
		if !completed[c] {
			t.Errorf("filled PSC session not marked completed: %s", c)
		}
	}
}

func TestBuildStandingsFromEvents_PSC_MatchesOfficialMonzaTotals(t *testing.T) {
	dataDir := filepath.Join("..", "..", "data")
	data, err := BuildStandingsFromEvents(dataDir, "PSC", "2026")
	if err != nil {
		t.Fatalf("BuildStandingsFromEvents: %v", err)
	}
	official := map[string]string{
		"Flynt Schuring": "132.5", "Robert de Haan": "107", "Theo Oeverhaus": "95",
		"Chester Kieffer": "82", "Marcus Amand": "74", "Paul Cauhaupe": "67",
		"Gustav Burton": "66", "Andrea Bristot": "64.5", "Jaap van Lagen": "63",
		"Wouter Boerekamps": "56.5", "Dirk Schouten": "52.5", "Keagan Masters": "52",
		"Matheus Ferreira": "43", "Jack Young": "33.5", "Liam McNeilly": "32.5",
		"Caleb Sumich": "22", "Aldo Festante": "16", "Filip Ugran": "9",
		"Jonas Greif": "3", "William Mezzetti": "1.5", "Luciano Martinez": "0",
		"Samer Shahin": "0", "Juan Pablo Vega Dieppa": "0", "Kai Pfister": "0", "Jorge Ramirez": "0",
	}
	got := map[string]string{}
	for _, r := range data.Rows {
		got[r.Driver] = r.Points
	}
	for name, want := range official {
		if got[name] != want {
			t.Errorf("%s points = %q, want %q", name, got[name], want)
		}
	}
	if len(got) != len(official) {
		t.Errorf("main standings rows = %d, want %d", len(got), len(official))
	}
}
