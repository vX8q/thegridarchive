package schedulefile

import (
	"path/filepath"
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
		"Rodin Younessi":      true,
		"Eugenio Pisani":      true,
		"Taichi Watarai":      true,
		"Alexander Tauscher":  true,
		"Jukka Honkavuori":    true,
		"Jacques Villeneuve":  true,
	}
	for _, r := range data.Rows {
		if guestNames[r.Driver] {
			t.Errorf("guest driver %q in main standings", r.Driver)
		}
	}
	if len(data.Ineligible) != 6 {
		t.Fatalf("ineligible guests: got %d, want 6", len(data.Ineligible))
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
	wantOrder := []string{
		"Jonas Greif",
		"Luciano Martinez",
		"Juan Pablo Vega Dieppa",
		"Samer Shahin",
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
