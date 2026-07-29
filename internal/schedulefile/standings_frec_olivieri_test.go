package schedulefile

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestBuildStandingsFromEvents_FREC_OlivieriAfterHungaroring(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatalf("abs data dir: %v", err)
	}
	data, err := BuildStandingsFromEvents(dataDir, "FREC", "2026")
	if err != nil {
		t.Fatalf("BuildStandingsFromEvents: %v", err)
	}
	if data == nil {
		t.Fatal("nil standings")
	}

	var olivieri *StandingRow
	for i := range data.Rows {
		if strings.Contains(data.Rows[i].Driver, "Olivieri") || data.Rows[i].Car == "73" {
			olivieri = &data.Rows[i]
			break
		}
	}
	if olivieri == nil {
		t.Fatal("Olivieri not found in standings")
	}

	if olivieri.Races["R5-1"] != "4" {
		t.Errorf("HUN R1 position: got %q want 4", olivieri.Races["R5-1"])
	}
	if olivieri.Races["R5-2"] != "2" {
		t.Errorf("HUN R2 position: got %q want 2", olivieri.Races["R5-2"])
	}
	if olivieri.Points != "152" {
		t.Errorf("total points: got %q want 152", olivieri.Points)
	}

	sessions, err := LoadEventRaceSessions(dataDir, "FREC_2026_5")
	if err != nil {
		t.Fatalf("load sessions: %v", err)
	}
	wantPts := []string{"13", "18"}
	for si, sess := range sessions[:2] {
		ptsCol := pointsColIndex(sess.Headers)
		noCol := firstColIndex(sess.Headers, "No", "No.", "#", "Car")
		for _, row := range sess.Rows {
			if noCol >= len(row) || row[noCol] != "73" {
				continue
			}
			if ptsCol >= len(row) && row[ptsCol] != wantPts[si] {
				t.Errorf("HUN R%d Pts: got %q want %q", si+1, row[ptsCol], wantPts[si])
			}
		}
	}
}
