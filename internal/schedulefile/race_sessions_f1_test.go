package schedulefile

import (
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestLoadEventRaceSessions_F1SprintWeekendIncludesGP(t *testing.T) {
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller failed")
	}
	dataDir := filepath.Clean(filepath.Join(filepath.Dir(thisFile), "..", "..", "data"))

	// Qatar 2025 is a sprint weekend: tables.race.sessions = Sprint, race_results = GP.
	sessions, err := LoadEventRaceSessions(dataDir, "F1_2025_23")
	if err != nil {
		t.Fatalf("LoadEventRaceSessions: %v", err)
	}
	if len(sessions) < 2 {
		t.Fatalf("sessions=%d want ≥2 (sprint + GP), titles=%v", len(sessions), sessionTitles(sessions))
	}
	var hasSprint, hasRace bool
	for _, s := range sessions {
		u := strings.ToUpper(s.Title)
		if strings.Contains(u, "SPRINT") {
			hasSprint = true
			continue
		}
		if len(s.Rows) > 0 {
			hasRace = true
		}
	}
	if !hasSprint {
		t.Fatalf("missing sprint session among %v", sessionTitles(sessions))
	}
	if !hasRace {
		t.Fatalf("missing GP/race_results session among %v", sessionTitles(sessions))
	}
}

func TestLoadEventRaceSessions_F1NonSprintOnlyGP(t *testing.T) {
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller failed")
	}
	dataDir := filepath.Clean(filepath.Join(filepath.Dir(thisFile), "..", "..", "data"))

	sessions, err := LoadEventRaceSessions(dataDir, "F1_2025_24")
	if err != nil {
		t.Fatalf("LoadEventRaceSessions: %v", err)
	}
	if len(sessions) != 1 {
		t.Fatalf("Abu Dhabi sessions=%d want 1, titles=%v", len(sessions), sessionTitles(sessions))
	}
	if strings.Contains(strings.ToUpper(sessions[0].Title), "SPRINT") {
		t.Fatalf("unexpected sprint on non-sprint weekend: %q", sessions[0].Title)
	}
}

func sessionTitles(sessions []RaceSession) []string {
	out := make([]string, len(sessions))
	for i, s := range sessions {
		out[i] = s.Title
	}
	return out
}
