package schedulefile

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestAggregatedScheduleMaxMtime_UpdatesOnScheduleAndEventChange(t *testing.T) {
	dir := t.TempDir()
	schedulesDir := filepath.Join(dir, "schedules")
	eventsDir := filepath.Join(dir, "events", "TEST", "2026")
	if err := os.MkdirAll(schedulesDir, 0o750); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(eventsDir, 0o750); err != nil {
		t.Fatal(err)
	}

	schedPath := filepath.Join(schedulesDir, "test.json")
	schedBytes, err := json.Marshal([]EventJSON{
		{ID: "TEST_2026_1", SeriesID: "TEST", Season: "2026", Name: "Round 1", StartDate: "2026-01-01"},
	})
	if err != nil {
		t.Fatal(err)
	}
	base := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	if err := os.WriteFile(schedPath, schedBytes, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Chtimes(schedPath, base, base); err != nil {
		t.Fatal(err)
	}

	m1 := AggregatedScheduleMaxMtime(dir)
	if !m1.Equal(base) {
		t.Fatalf("initial mtime = %v, want %v", m1, base)
	}

	eventPath := filepath.Join(eventsDir, "test_2026_1.json")
	eventBytes := []byte(`{"tables":{"race_results":{"headers":["Pos"],"rows":[["1"]]}}}`)
	eventTime := base.Add(2 * time.Hour)
	if err := os.WriteFile(eventPath, eventBytes, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Chtimes(eventPath, eventTime, eventTime); err != nil {
		t.Fatal(err)
	}

	m2 := AggregatedScheduleMaxMtime(dir)
	if !m2.After(m1) {
		t.Fatalf("event touch mtime = %v, want after %v", m2, m1)
	}

	schedTime := base.Add(4 * time.Hour)
	if err := os.Chtimes(schedPath, schedTime, schedTime); err != nil {
		t.Fatal(err)
	}
	m3 := AggregatedScheduleMaxMtime(dir)
	if !m3.After(m2) {
		t.Fatalf("schedule touch mtime = %v, want after %v", m3, m2)
	}
}
